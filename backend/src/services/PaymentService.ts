import axios, { AxiosInstance } from 'axios';
import { config } from '../config/config';
import { prisma } from '../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

export interface PaymentInitiationRequest {
  amount: number;
  userId: string;
  paymentMethod: 'ORANGE_MONEY' | 'MOMO';
  phoneNumber: string;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  externalId?: string;
  amount: number;
  fees: number;
  totalAmount: number;
  status: string;
  message?: string;
}

export interface FeeCalculation {
  baseAmount: number;
  coolpayFee: number;
  orangeFee: number;
  totalFees: number;
  totalAmount: number;
}

export class PaymentService {
  private coolpayClient: AxiosInstance;

  constructor() {
    this.coolpayClient = axios.create({
      baseURL: config.coolpay.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.coolpay.apiKey}`,
        'X-Merchant-Id': config.coolpay.merchantId
      },
      timeout: 30000
    });
  }

  /**
   * Calculate fees for a given amount
   * Includes CoolPay fees and Orange Money/MoMo fees
   */
  public calculateFees(amount: number): FeeCalculation {
    const coolpayFee = (amount * config.coolpay.feePercentage) / 100;
    const orangeFee = (amount * config.coolpay.orangeFeePercentage) / 100;
    const totalFees = coolpayFee + orangeFee;
    const totalAmount = amount + totalFees;

    return {
      baseAmount: amount,
      coolpayFee: Math.round(coolpayFee),
      orangeFee: Math.round(orangeFee),
      totalFees: Math.round(totalFees),
      totalAmount: Math.round(totalAmount)
    };
  }

  /**
   * Initiate a deposit payment via My-CoolPay
   */
  public async initiateDeposit(request: PaymentInitiationRequest): Promise<PaymentResponse> {
    try {
      // Calculate fees
      const feeCalc = this.calculateFees(request.amount);

      // Get merchant number based on payment method
      const merchantNumber = request.paymentMethod === 'ORANGE_MONEY' 
        ? process.env.ORANGE_MONEY_NUMBER 
        : process.env.MOMO_NUMBER;

      if (!merchantNumber) {
        throw new Error('Merchant number not configured for this payment method');
      }

      // Create transaction record first
      const wallet = await prisma.wallet.findUnique({
        where: { userId: request.userId }
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const transaction = await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount: feeCalc.baseAmount,
          fees: feeCalc.totalFees,
          totalAmount: feeCalc.totalAmount,
          status: TransactionStatus.PENDING,
          paymentMethod: request.paymentMethod,
          paymentProvider: 'MY_COOLPAY',
          metadata: {
            phoneNumber: request.phoneNumber,
            merchantNumber: merchantNumber,
            description: request.description || 'Wallet recharge'
          }
        }
      });

      // Call My-CoolPay API
      const coolpayResponse = await this.coolpayClient.post('/payments/initiate', {
        merchant_id: config.coolpay.merchantId,
        transaction_id: transaction.id,
        amount: feeCalc.totalAmount,
        currency: 'XAF',
        payment_method: request.paymentMethod === 'ORANGE_MONEY' ? 'orange_money' : 'mtn_momo',
        customer_phone: request.phoneNumber,
        merchant_phone: merchantNumber,
        description: request.description || 'FreeBike Wallet Recharge',
        callback_url: `${process.env.API_URL || 'http://localhost:8080'}/api/v1/payments/callback`,
        return_url: `${config.app.frontendUrl}/wallet?payment=success`,
        cancel_url: `${config.app.frontendUrl}/wallet?payment=cancelled`
      });

      // Update transaction with external ID
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          externalId: coolpayResponse.data.payment_id || coolpayResponse.data.transaction_id,
          metadata: {
            ...transaction.metadata as object,
            coolpayResponse: coolpayResponse.data
          }
        }
      });

      return {
        success: true,
        transactionId: transaction.id,
        externalId: coolpayResponse.data.payment_id || coolpayResponse.data.transaction_id,
        amount: feeCalc.baseAmount,
        fees: feeCalc.totalFees,
        totalAmount: feeCalc.totalAmount,
        status: 'PENDING',
        message: 'Payment initiated. Please complete the payment on your phone.'
      };

    } catch (error: any) {
      console.error('Payment initiation error:', error);
      
      // Log error details
      if (error.response) {
        console.error('CoolPay API Error:', error.response.data);
      }

      throw new Error(error.response?.data?.message || error.message || 'Payment initiation failed');
    }
  }

  /**
   * Handle payment callback from My-CoolPay
   */
  public async handlePaymentCallback(callbackData: any): Promise<void> {
    try {
      const transactionId = callbackData.transaction_id || callbackData.merchant_reference;
      const status = callbackData.status || callbackData.payment_status;
      const externalId = callbackData.payment_id || callbackData.coolpay_transaction_id;

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { wallet: true }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction status based on callback
      if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'success') {
        // Payment successful - credit wallet
        await prisma.$transaction(async (tx) => {
          // Update transaction status
          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: TransactionStatus.COMPLETED,
              externalId: externalId,
              metadata: {
                ...transaction.metadata as object,
                callback: callbackData,
                completedAt: new Date().toISOString()
              }
            }
          });

          // Credit wallet
          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: {
                increment: transaction.amount
              }
            }
          });

          // Create notification
          await tx.notification.create({
            data: {
              userId: transaction.wallet.userId,
              title: 'Deposit Successful',
              message: `Your wallet has been credited with ${transaction.amount} XAF`,
              type: 'PAYMENT'
            }
          });
        });

      } else if (status === 'FAILED' || status === 'failed' || status === 'REJECTED') {
        // Payment failed
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: TransactionStatus.FAILED,
            metadata: {
              ...transaction.metadata as object,
              callback: callbackData,
              failedAt: new Date().toISOString()
            }
          }
        });

        // Create notification
        await prisma.notification.create({
          data: {
            userId: transaction.wallet.userId,
            title: 'Deposit Failed',
            message: `Your deposit of ${transaction.totalAmount} XAF has failed`,
            type: 'PAYMENT'
          }
        });

      } else {
        // Update with current status
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            metadata: {
              ...transaction.metadata as object,
              callback: callbackData
            }
          }
        });
      }

    } catch (error: any) {
      console.error('Payment callback handling error:', error);
      throw error;
    }
  }

  /**
   * Verify payment status with My-CoolPay
   */
  public async verifyPayment(transactionId: string): Promise<any> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction || !transaction.externalId) {
        throw new Error('Transaction not found or no external ID');
      }

      const response = await this.coolpayClient.get(`/payments/status/${transaction.externalId}`);
      
      return response.data;

    } catch (error: any) {
      console.error('Payment verification error:', error);
      throw new Error(error.response?.data?.message || 'Payment verification failed');
    }
  }

  /**
   * Process ride payment from wallet
   */
  public async processRidePayment(userId: string, rideId: string, amount: number): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId }
        });

        if (!wallet) {
          throw new Error('Wallet not found');
        }

        if (wallet.balance < amount) {
          throw new Error('Insufficient balance');
        }

        // Deduct from wallet
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              decrement: amount
            }
          }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.RIDE_PAYMENT,
            amount: amount,
            fees: 0,
            totalAmount: amount,
            status: TransactionStatus.COMPLETED,
            paymentMethod: 'WALLET',
            metadata: {
              rideId: rideId,
              paidAt: new Date().toISOString()
            }
          }
        });
      });

    } catch (error: any) {
      console.error('Ride payment error:', error);
      throw error;
    }
  }

  /**
   * Refund a payment
   */
  public async refundPayment(transactionId: string, reason?: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const originalTransaction = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: { wallet: true }
        });

        if (!originalTransaction) {
          throw new Error('Transaction not found');
        }

        if (originalTransaction.status !== TransactionStatus.COMPLETED) {
          throw new Error('Only completed transactions can be refunded');
        }

        // Credit wallet
        await tx.wallet.update({
          where: { id: originalTransaction.walletId },
          data: {
            balance: {
              increment: originalTransaction.amount
            }
          }
        });

        // Create refund transaction
        await tx.transaction.create({
          data: {
            walletId: originalTransaction.walletId,
            type: TransactionType.REFUND,
            amount: originalTransaction.amount,
            fees: 0,
            totalAmount: originalTransaction.amount,
            status: TransactionStatus.COMPLETED,
            metadata: {
              originalTransactionId: transactionId,
              reason: reason || 'Refund',
              refundedAt: new Date().toISOString()
            }
          }
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: originalTransaction.wallet.userId,
            title: 'Refund Processed',
            message: `A refund of ${originalTransaction.amount} XAF has been credited to your wallet`,
            type: 'PAYMENT'
          }
        });
      });

    } catch (error: any) {
      console.error('Refund error:', error);
      throw error;
    }
  }
}

export default new PaymentService();
