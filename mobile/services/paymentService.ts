import { API_CONFIG, handleApiResponse } from '@/lib/api/config';
import { authService } from './authService';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: 'ride' | 'topup' | 'refund' | 'withdrawal';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  rideId?: string;
  createdAt: string;
}

export interface TopUpRequest {
  amount: number;
  paymentMethodId: string;
  currency?: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  lastTopUp?: string;
}

class PaymentService {
  private baseUrl = `${API_CONFIG.BASE_URL}/payments`;
  private ridesUrl = `${API_CONFIG.BASE_URL}/rides`;

  private async getAuthHeaders() {
    const token = await authService.getToken();
    return {
      ...API_CONFIG.HEADERS,
      'Authorization': `Bearer ${token}`,
    };
  }

  async getTransactionHistory(page: number = 1, limit: number = 20): Promise<{ transactions: Transaction[]; total: number; page: number }> {
    const headers = await this.getAuthHeaders();

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await fetch(`${this.baseUrl}/transactions?${queryParams.toString()}`, {
      method: 'GET',
      headers,
    });

    return await handleApiResponse(response);
  }

  async getWalletBalance(): Promise<WalletBalance> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseUrl}/wallet/balance`, {
      method: 'GET',
      headers,
    });

    return await handleApiResponse(response);
  }

  async topUpWallet(request: TopUpRequest): Promise<Transaction> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseUrl}/wallet/topup`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    return await handleApiResponse(response);
  }

  async getRideCostEstimate(distance: number, duration: number): Promise<{ cost: number; currency: string }> {
    const headers = await this.getAuthHeaders();

    const queryParams = new URLSearchParams({
      distance: distance.toString(),
      duration: duration.toString(),
    });

    const response = await fetch(`${this.ridesUrl}/estimate?${queryParams.toString()}`, {
      method: 'GET',
      headers,
    });

    return await handleApiResponse(response);
  }
}

export const paymentService = new PaymentService();
