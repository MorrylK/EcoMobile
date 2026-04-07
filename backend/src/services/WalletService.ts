import { prisma } from '../config/prisma';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class WalletService {
  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 0,
          deposit: 0,
          negativeBalance: 0
        }
      });
    }

    return wallet;
  }

  /**
   * Get wallet balance with deposit info
   */
  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: wallet.balance,
      deposit: wallet.deposit,
      negativeBalance: wallet.negativeBalance,
      walletId: wallet.id
    };
  }

  /**
   * Get deposit information
   */
  async getDepositInfo(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const requiredDeposit = await this.getRequiredDeposit();
    
    // Vérifier si l'utilisateur a un déblocage sans caution actif
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { depositExemptionUntil: true }
    });
    
    const hasActiveExemption = user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date();
    
    return {
      currentDeposit: wallet.deposit,
      requiredDeposit,
      canUseService: hasActiveExemption || wallet.deposit >= requiredDeposit,
      negativeBalance: wallet.negativeBalance,
      hasDepositExemption: hasActiveExemption,
      depositExemptionUntil: user?.depositExemptionUntil || null
    };
  }

  /**
   * Get balances and deposit info for multiple users in a single query (optimized)
   * This reduces N+1 queries when fetching user lists
   */
  async getBulkWalletInfo(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map();
    }

    // Récupérer tous les wallets en une seule requête
    const wallets = await prisma.wallet.findMany({
      where: {
        userId: { in: userIds }
      },
      select: {
        userId: true,
        balance: true,
        deposit: true,
        negativeBalance: true,
      }
    });

    // Récupérer les informations d'exemption de caution en une seule requête
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        depositExemptionUntil: true,
      }
    });

    const requiredDeposit = await this.getRequiredDeposit();
    const now = new Date();

    // Créer un Map pour un accès rapide
    const walletMap = new Map();
    const userMap = new Map(users.map(u => [u.id, u]));

    wallets.forEach(wallet => {
      const user = userMap.get(wallet.userId);
      const hasActiveExemption = user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > now;

      walletMap.set(wallet.userId, {
        balance: wallet.balance,
        deposit: wallet.deposit,
        negativeBalance: wallet.negativeBalance,
        currentDeposit: wallet.deposit,
        requiredDeposit,
        canUseService: hasActiveExemption || wallet.deposit >= requiredDeposit,
        hasDepositExemption: hasActiveExemption,
        depositExemptionUntil: user?.depositExemptionUntil || null,
      });
    });

    // Pour les utilisateurs sans wallet, créer des entrées par défaut
    userIds.forEach(userId => {
      if (!walletMap.has(userId)) {
        const user = userMap.get(userId);
        const hasActiveExemption = user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > now;

        walletMap.set(userId, {
          balance: 0,
          deposit: 0,
          negativeBalance: 0,
          currentDeposit: 0,
          requiredDeposit,
          canUseService: hasActiveExemption,
          hasDepositExemption: hasActiveExemption,
          depositExemptionUntil: user?.depositExemptionUntil || null,
        });
      }
    });

    return walletMap;
  }

  /**
   * Recharge deposit from wallet balance
   */
  async rechargeDeposit(userId: string, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Solde insuffisant pour recharger la caution');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Déduire du wallet et ajouter à la caution
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          deposit: { increment: amount }
        }
      });

      // Créer la transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT_RECHARGE,
          amount,
          fees: 0,
          totalAmount: amount,
          status: TransactionStatus.COMPLETED,
          paymentMethod: 'WALLET',
          metadata: { 
            type: 'deposit_recharge',
            transferredAt: new Date().toISOString()
          }
        }
      });

      return { wallet: updatedWallet, transaction };
    });

    return result;
  }

  /**
   * Charge user for damage (Admin only)
   */
  async chargeDamage(userId: string, amount: number, description: string, images?: string[], chargedBy?: string, incidentId?: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const result = await prisma.$transaction(async (tx) => {
      // Vérifier si l'utilisateur a un déblocage sans caution actif
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { depositExemptionUntil: true }
      });

      const hasActiveExemption = user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date();
      
      let deductFromDeposit = 0;
      let deductFromBalance = 0;
      let remainingAmount = 0;
      let source = 'DEPOSIT';

      if (hasActiveExemption) {
        // Si l'exemption est active, on prend sur le solde
        source = 'BALANCE';
        deductFromBalance = Math.min(amount, wallet.balance);
        remainingAmount = amount - deductFromBalance;
      } else {
        // Sinon, on prend sur la caution (comportement par défaut)
        source = 'DEPOSIT';
        deductFromDeposit = Math.min(amount, wallet.deposit);
        remainingAmount = amount - deductFromDeposit;
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: hasActiveExemption ? { decrement: deductFromBalance } : undefined,
          deposit: !hasActiveExemption ? { decrement: deductFromDeposit } : undefined,
          negativeBalance: remainingAmount > 0 ? { increment: remainingAmount } : undefined
        }
      });

      // Créer la transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DAMAGE_CHARGE,
          amount,
          fees: 0,
          totalAmount: amount,
          status: TransactionStatus.COMPLETED,
          paymentMethod: source,
          validatedBy: chargedBy,
          validatedAt: new Date(),
          metadata: { 
            description,
            images: images || [],
            chargedBy,
            deductFromDeposit,
            deductFromBalance,
            source,
            addedToNegativeBalance: remainingAmount,
            incidentId: incidentId || null
          }
        }
      });

      // Notification à l'utilisateur
      const sourceText = hasActiveExemption ? 'portefeuille' : 'caution';
      await tx.notification.create({
        data: {
          userId,
          title: 'Frais de dégâts',
          message: `Des frais de ${amount} FCFA ont été prélevés sur votre ${sourceText} pour : ${description}`,
          type: 'DAMAGE_CHARGE'
        }
      });

      return { wallet: updatedWallet, transaction };
    });

    return result;
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(language: string = 'fr') {
    return [
      {
        code: 'ORANGE_MONEY',
        name: 'Orange Money',
        logo: '/assets/logos/orange-money.png',
        fees: {
          percentage: 1.5,
          fixed: 50,
          minimum: 50,
          maximum: 1000
        },
        isActive: true,
        minAmount: 500,
        maxAmount: 1000000,
        description: language === 'fr' 
          ? 'Rechargez votre portefeuille via Orange Money'
          : 'Top up your wallet via Orange Money'
      },
      {
        code: 'MOMO',
        name: 'Mobile Money',
        logo: '/assets/logos/momo.png',
        fees: {
          percentage: 1.2,
          fixed: 50,
          minimum: 50,
          maximum: 800
        },
        isActive: true,
        minAmount: 500,
        maxAmount: 1000000,
        description: language === 'fr' 
          ? 'Rechargez votre portefeuille via Mobile Money'
          : 'Top up your wallet via Mobile Money'
      }
    ];
  }

  /**
   * Get current active subscription
   */
  async getCurrentSubscription(userId: string) {
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        plan: {
          include: {
            overrides: true
          }
        },
        bike: {
          select: {
            code: true,
            model: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeReservation) {
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        },
        include: {
          plan: true
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeSubscription) return null;

      return {
        id: activeSubscription.id,
        planName: activeSubscription.plan?.name || 'Unknown',
        packageType: activeSubscription.type,
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate,
        status: 'ACTIVE',
        type: 'SUBSCRIPTION',
        remainingDays: Math.ceil((activeSubscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      };
    }

    return {
      id: activeReservation.id,
      planName: activeReservation.plan.name,
      packageType: activeReservation.packageType,
      startDate: activeReservation.startDate,
      endDate: activeReservation.endDate,
      status: activeReservation.status,
      type: 'RESERVATION',
      bikeCode: activeReservation.bike?.code,
      remainingDays: Math.ceil((activeReservation.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Get user reports (incidents)
   */
  async getUserReports(userId: string) {
    const incidents = await prisma.incident.findMany({
      where: { userId },
      include: {
        bike: {
          select: {
            code: true,
            model: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return incidents.map(incident => ({
      id: incident.id,
      type: incident.type,
      description: incident.description,
      status: incident.status,
      bikeCode: incident.bike?.code,
      bikeModel: incident.bike?.model,
      createdAt: incident.createdAt,
      refundAmount: incident.refundAmount,
      adminNote: incident.adminNote
    }));
  }

  /**
   * Process ride payment with advanced logic including overtime rules
   */
  async processRidePayment(
    userId: string, 
    rideId: string, 
    amount: number, 
    hasActiveSubscription: boolean = false, 
    isOvertime: boolean = false,
    rideStartTime?: Date
  ) {
    const wallet = await this.getOrCreateWallet(userId);
    const requiredDeposit = await this.getRequiredDeposit();

    // Vérifier que la caution est suffisante
    if (wallet.deposit < requiredDeposit) {
      throw new Error(`Caution insuffisante. Minimum requis : ${requiredDeposit} FCFA`);
    }

    const result = await prisma.$transaction(async (tx) => {
      let finalAmount = amount;
      let discountApplied = 0;
      let appliedRule = null;
      
      // Appliquer la réduction si l'utilisateur a un forfait actif
      if (hasActiveSubscription) {
        const activeReservation = await tx.reservation.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() }
          },
          include: { 
            plan: {
              include: {
                overrides: true
              }
            }
          }
        });

        if (activeReservation) {
          // Déterminer si on est en overtime (en dehors des heures du forfait)
          const isActuallyOvertime = await this.isOvertimeForSubscription(
            rideStartTime || new Date(), 
            activeReservation.packageType,
            activeReservation.planId
          );

          if ((isOvertime || isActuallyOvertime) && activeReservation.plan.overrides.length > 0) {
            // Appliquer les règles d'override pour les dépassements
            const override = activeReservation.plan.overrides[0];
            
            if (override.overTimeType === 'FIXED_PRICE') {
              finalAmount = override.overTimeValue;
              appliedRule = `Prix fixe overtime: ${override.overTimeValue} FCFA`;
            } else if (override.overTimeType === 'PERCENTAGE_REDUCTION') {
              const reductionAmount = Math.round(amount * (override.overTimeValue / 100));
              finalAmount = Math.max(0, amount - reductionAmount);
              appliedRule = `Réduction overtime: ${override.overTimeValue}%`;
            }
            discountApplied = amount - finalAmount;
          } else {
            // Dans les heures du forfait = gratuit ou très réduit
            finalAmount = 0; // Déjà payé avec l'abonnement
            discountApplied = amount;
            appliedRule = 'Inclus dans le forfait';
          }
        }
      }

      // Procéder au paiement seulement si finalAmount > 0
      if (finalAmount > 0) {
        if (wallet.balance >= finalAmount) {
          // Paiement normal depuis le wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: finalAmount } }
          });
        } else {
          // Déduire ce qui reste du solde puis de la caution
          const remaining = finalAmount - wallet.balance;
          const maxFromDeposit = Math.min(remaining, wallet.deposit);
          const addToNegative = Math.max(0, remaining - wallet.deposit);

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { 
              balance: 0,
              deposit: { decrement: maxFromDeposit },
              negativeBalance: { increment: addToNegative }
            }
          });
        }
      }

      // Créer la transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'RIDE_PAYMENT',
          amount: finalAmount,
          fees: 0,
          totalAmount: finalAmount,
          status: 'COMPLETED',
          paymentMethod: finalAmount === 0 ? 'SUBSCRIPTION' : 'MIXED',
          metadata: { 
            rideId,
            originalAmount: amount,
            discountApplied,
            hasActiveSubscription,
            isOvertime: isOvertime || false,
            appliedRule,
            paidAt: new Date().toISOString()
          }
        }
      });

      return { 
        transaction, 
        finalAmount, 
        discountApplied, 
        appliedRule,
        isOvertime: isOvertime || false
      };
    });

    return result;
  }

  /**
   * Determine if a ride time is considered overtime for a subscription
   */
  private async isOvertimeForSubscription(rideTime: Date, packageType: string, planId?: string): Promise<boolean> {
    const hour = rideTime.getHours();
    
    // Si un planId est fourni, vérifier les plages horaires définies dans PlanOverride
    if (planId) {
      const override = await prisma.planOverride.findFirst({
        where: { planId }
      });
      
      if (override) {
        const packageTypeLower = packageType.toLowerCase();
        let startHour: number | null = null;
        let endHour: number | null = null;
        
        switch (packageTypeLower) {
          case 'hourly':
          case 'horaire':
            startHour = override.hourlyStartHour;
            endHour = override.hourlyEndHour;
            break;
          case 'daily':
          case 'journalier':
            startHour = override.dailyStartHour;
            endHour = override.dailyEndHour;
            break;
          case 'weekly':
          case 'hebdomadaire':
            startHour = override.weeklyStartHour;
            endHour = override.weeklyEndHour;
            break;
          case 'monthly':
          case 'mensuel':
            startHour = override.monthlyStartHour;
            endHour = override.monthlyEndHour;
            break;
        }
        
        // Si des plages horaires sont définies, les utiliser
        if (startHour !== null && endHour !== null) {
          if (startHour <= endHour) {
            // Plage normale (ex: 8h-19h)
            return hour < startHour || hour >= endHour;
          } else {
            // Plage qui traverse minuit (ex: 22h-6h)
            return hour < startHour && hour >= endHour;
          }
        }
      }
    }
    
    // Fallback sur les valeurs par défaut
    switch (packageType.toLowerCase()) {
      case 'daily':
      case 'journalier':
        // Forfait journalier valide de 8h à 19h
        return hour < 8 || hour >= 19;
      case 'hourly':
      case 'horaire':
        return hour < 8 || hour >= 19;
      case 'weekly':
      case 'hebdomadaire':
        return hour < 8 || hour >= 19;
      case 'monthly':
      case 'mensuel':
        return hour < 8 || hour >= 19;
      case 'morning':
      case 'matin':
        // Forfait matinal valide de 6h à 12h
        return hour < 6 || hour >= 12;
      case 'evening':
      case 'soirée':
        // Forfait soirée valide de 19h à 22h
        return hour < 19 || hour >= 22;
      default:
        return false;
    }
  }

  /**
   * Add funds to wallet (for refunds, promotions, etc.)
   * This creates a proper transaction record unlike addBalance
   */
  async addFunds(
    userId: string, 
    amount: number, 
    reason: string = 'refund',
    metadata?: any
  ) {
    const wallet = await this.getOrCreateWallet(userId);

    await prisma.$transaction(async (tx) => {
      // Update wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount
          }
        }
      });

      // Create transaction record based on reason
      let transactionType: TransactionType;
      
      switch (reason) {
        case 'refund':
          transactionType = TransactionType.REFUND;
          break;
        case 'promotion':
        case 'bonus':
          transactionType = TransactionType.DEPOSIT;
          break;
        default:
          transactionType = TransactionType.DEPOSIT;
      }

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: transactionType,
          amount,
          fees: 0,
          totalAmount: amount,
          status: TransactionStatus.COMPLETED,
          paymentMethod: 'SYSTEM',
          paymentProvider: 'INTERNAL',
          metadata: {
            reason,
            ...metadata
          }
        }
      });
    });

    return await this.getBalance(userId);
  }

  /**
   * Create cash deposit request
   */
  async createCashDepositRequest(request: { 
    userId: string; 
    amount: number; 
    description?: string; 
  }) {
    const wallet = await this.getOrCreateWallet(request.userId);

    if (request.amount < 500) {
      throw new Error('Le montant minimum pour une recharge en espèces est de 500 FCFA');
    }
    
    const transaction = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: TransactionType.DEPOSIT,
        amount: request.amount,
        fees: 0,
        totalAmount: request.amount,
        status: TransactionStatus.PENDING,
        paymentMethod: 'CASH',
        paymentProvider: 'MANUAL',
        requestedBy: request.userId,
        canModify: true,
        metadata: {
          description: request.description,
          requestedAt: new Date().toISOString(),
          type: 'cash_deposit_request'
        }
      },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Create notification for admins
    await this.notifyAdminsOfCashRequest(transaction);
    
    return transaction;
  }

  /**
   * Update cash deposit request amount (only if still pending and modifiable)
   */
  async updateCashDepositRequest(transactionId: string, userId: string, newAmount: number) {
    if (newAmount <= 0) {
      throw new Error('Le montant doit être supérieur à 0');
    }
    
    if (newAmount < 500) {
      throw new Error('Le montant minimum est de 500 FCFA');
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        wallet: { userId },
        type: { in: [TransactionType.DEPOSIT, TransactionType.DEPOSIT_RECHARGE] },
        status: TransactionStatus.PENDING,
        canModify: true
      },
      include: {
        wallet: true
      }
    });

    if (!transaction) {
      throw new Error('Demande de recharge non trouvée ou non modifiable');
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        amount: newAmount,
        totalAmount: newAmount,
        metadata: {
          ...transaction.metadata as object,
          modifiedAt: new Date().toISOString(),
          originalAmount: transaction.amount
        }
      }
    });

    return updatedTransaction;
  }

  /**
   * Cancel cash deposit request (only if still pending and modifiable)
   */
  async cancelCashDepositRequest(transactionId: string, userId: string) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        wallet: { userId },
        type: { in: [TransactionType.DEPOSIT, TransactionType.DEPOSIT_RECHARGE] },
        status: TransactionStatus.PENDING,
        canModify: true
      }
    });

    if (!transaction) {
      throw new Error('Demande de recharge non trouvée ou non modifiable');
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.CANCELLED,
        canModify: false,
        metadata: {
          ...transaction.metadata as object,
          cancelledAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Get all transactions for admin with filters
   */
  async getAllTransactionsAdmin(page: number, limit: number, filters: any) {
    const where: any = {};

    // Apply filters
    if (filters.type) {
      where.type = filters.type;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.userId) {
      where.wallet = { userId: filters.userId };
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.transaction.count({ where })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Validate cash deposit request (Admin only)
   */
  async validateCashDeposit(transactionId: string, adminId: string, adminNote?: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: true
          }
        }
      }
    });

    if (!transaction) {
      throw new Error('Transaction non trouvée');
    }

    if (transaction.type !== TransactionType.DEPOSIT && transaction.type !== TransactionType.DEPOSIT_RECHARGE) {
      throw new Error('Ce n\'est pas une demande de recharge en espèces');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Cette demande a déjà été traitée');
    }

    // Process validation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update transaction status
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          validatedBy: adminId,
          validatedAt: new Date(),
          canModify: false,
          metadata: {
            ...transaction.metadata as object,
            validatedAt: new Date().toISOString(),
            validatedBy: adminId,
            adminNote: adminNote || 'Validé par l\'administrateur'
          }
        },
        include: {
          wallet: {
            include: {
              user: true
            }
          }
        }
      });

      // Credit wallet
      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: { increment: transaction.amount }
        }
      });

      // Create notification for user
      await tx.notification.create({
        data: {
          userId: transaction.wallet.userId,
          title: 'Recharge Validée',
          message: `Votre demande de recharge de ${transaction.amount} FCFA a été validée. Le montant a été ajouté à votre portefeuille.`,
          type: 'PAYMENT'
        }
      });

      return updatedTransaction;
    });

    return result;
  }

  /**
   * Reject cash deposit request (Admin only)
   */
  async rejectCashDeposit(transactionId: string, adminId: string, reason: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: true
          }
        }
      }
    });

    if (!transaction) {
      throw new Error('Transaction non trouvée');
    }

    if (transaction.type !== TransactionType.DEPOSIT && transaction.type !== TransactionType.DEPOSIT_RECHARGE) {
      throw new Error('Ce n\'est pas une demande de recharge en espèces');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error('Cette demande a déjà été traitée');
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.FAILED,
        validatedBy: adminId,
        validatedAt: new Date(),
        rejectionReason: reason,
        canModify: false,
        metadata: {
          ...transaction.metadata as object,
          rejectedAt: new Date().toISOString(),
          rejectedBy: adminId,
          rejectionReason: reason
        }
      },
      include: {
        wallet: {
          include: {
            user: true
          }
        }
      }
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: transaction.wallet.userId,
        title: 'Recharge Rejetée',
        message: `Votre demande de recharge de ${transaction.amount} FCFA a été rejetée. Raison : ${reason}`,
        type: 'PAYMENT'
      }
    });

    return updatedTransaction;
  }

  /**
   * Notify admins of new cash deposit request
   */
  private async notifyAdminsOfCashRequest(transaction: any) {
    // Get all admin users
    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'SUPER_ADMIN' }
        ],
        isActive: true
      }
    });

    // Create notifications for each admin
    const notificationPromises = admins.map(admin => 
      prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Nouvelle Demande de Recharge en Espèces',
          message: `Une nouvelle demande de recharge en espèces de ${transaction.amount} FCFA a été soumise par ${transaction.wallet.user.firstName} ${transaction.wallet.user.lastName}.`,
          type: 'ADMIN_ACTION'
        }
      })
    );

    await Promise.all(notificationPromises);
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await this.getOrCreateWallet(userId);

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.transaction.count({
        where: { walletId: wallet.id }
      })
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        walletId: wallet.id
      }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * Check if user has sufficient balance
   */
  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance >= amount;
  }

  /**
   * Check if user can use service (has sufficient deposit)
   */
  async canUseService(userId: string): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(userId);
    const requiredDeposit = await this.getRequiredDeposit();
    return wallet.deposit >= requiredDeposit;
  }

  /**
   * Deduct amount from wallet (for ride payments)
   */
  async deductBalance(userId: string, amount: number, rideId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amount
          }
        }
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.RIDE_PAYMENT,
          amount,
          fees: 0,
          totalAmount: amount,
          status: TransactionStatus.COMPLETED,
          paymentMethod: 'WALLET',
          metadata: { rideId }
        }
      });
    });

    return await this.getBalance(userId);
  }

  /**
   * Add balance to wallet (after successful payment)
   * Note: This is a simpler version without transaction record
   */
  async addBalance(userId: string, amount: number, _transactionId?: string) {
    const wallet = await this.getOrCreateWallet(userId);

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    return await this.getBalance(userId);
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    const [totalDeposits, totalSpent, totalRefunds, totalDepositRecharges, totalDamageCharges] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.RIDE_PAYMENT,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT_RECHARGE,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: {
          walletId: wallet.id,
          type: TransactionType.DAMAGE_CHARGE,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    return {
      currentBalance: wallet.balance,
      currentDeposit: wallet.deposit,
      negativeBalance: wallet.negativeBalance,
      totalDeposited: totalDeposits._sum.amount || 0,
      totalSpent: totalSpent._sum.amount || 0,
      totalRefunded: totalRefunds._sum.amount || 0,
      totalDepositRecharges: totalDepositRecharges._sum.amount || 0,
      totalDamageCharges: totalDamageCharges._sum.amount || 0,
      depositCount: totalDeposits._count,
      ridePaymentCount: totalSpent._count,
      refundCount: totalRefunds._count
    };
  }

  /**
   * Get global wallet statistics (Admin only)
   */
  async getGlobalWalletStats() {
    // Statistiques globales des portefeuilles
    const [
      totalBalanceResult,
      totalDepositResult,
      totalNegativeBalanceResult,
      totalTransactionsResult,
      pendingCashRequestsResult,
      completedTransactionsResult,
      failedTransactionsResult,
      totalDepositedResult,
      totalWithdrawnResult
    ] = await Promise.all([
      // Balance totale de tous les portefeuilles
      prisma.wallet.aggregate({
        _sum: { balance: true }
      }),
      // Caution totale
      prisma.wallet.aggregate({
        _sum: { deposit: true }
      }),
      // Solde négatif total
      prisma.wallet.aggregate({
        _sum: { negativeBalance: true }
      }),
      // Nombre total de transactions
      prisma.transaction.count(),
      // Nombre de demandes en espèces en attente
      prisma.transaction.count({
        where: {
          type: { in: [TransactionType.DEPOSIT, TransactionType.DEPOSIT_RECHARGE] },
          status: TransactionStatus.PENDING
        }
      }),
      // Transactions complétées
      prisma.transaction.count({
        where: { status: TransactionStatus.COMPLETED }
      }),
      // Transactions échouées
      prisma.transaction.count({
        where: { status: TransactionStatus.FAILED }
      }),
      // Total déposé (tous types de dépôts)
      prisma.transaction.aggregate({
        where: {
          OR: [
            { type: TransactionType.DEPOSIT },
            { type: TransactionType.DEPOSIT_RECHARGE }
          ],
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true }
      }),
      // Total retiré
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED
        },
        _sum: { amount: true }
      })
    ]);

    return {
      totalBalance: totalBalanceResult._sum.balance || 0,
      totalDeposit: totalDepositResult._sum.deposit || 0,
      totalNegativeBalance: totalNegativeBalanceResult._sum.negativeBalance || 0,
      totalTransactions: totalTransactionsResult || 0,
      pendingCashRequests: pendingCashRequestsResult || 0,
      completedTransactions: completedTransactionsResult || 0,
      failedTransactions: failedTransactionsResult || 0,
      totalDeposited: totalDepositedResult._sum.amount || 0,
      totalWithdrawn: totalWithdrawnResult._sum.amount || 0
    };
  }

  /**
   * Get transaction by ID for admin (includes user info)
   */
  async getTransactionByIdAdmin(transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      throw new Error('Transaction non trouvée');
    }

    return transaction;
  }

  /**
   * Get required deposit amount from settings
   */
  private async getRequiredDeposit(): Promise<number> {
    const setting = await prisma.settings.findUnique({
      where: { key: 'required_deposit' }
    });
    return setting ? parseInt(setting.value) : 20000;
  }

  /**
   * Create or update plan override
   */
  async createPlanOverride(
    planId: string, 
    overTimeType: 'FIXED_PRICE' | 'PERCENTAGE_REDUCTION', 
    overTimeValue: number,
    timeSlots?: {
      hourlyStartHour?: number | null;
      hourlyEndHour?: number | null;
      dailyStartHour?: number | null;
      dailyEndHour?: number | null;
      weeklyStartHour?: number | null;
      weeklyEndHour?: number | null;
      monthlyStartHour?: number | null;
      monthlyEndHour?: number | null;
    }
  ) {
    const existingOverride = await prisma.planOverride.findFirst({
      where: { planId }
    });

    const overrideData: any = {
      overTimeType,
      overTimeValue
    };

    // Ajouter les plages horaires si fournies
    if (timeSlots) {
      if (timeSlots.hourlyStartHour !== undefined) overrideData.hourlyStartHour = timeSlots.hourlyStartHour;
      if (timeSlots.hourlyEndHour !== undefined) overrideData.hourlyEndHour = timeSlots.hourlyEndHour;
      if (timeSlots.dailyStartHour !== undefined) overrideData.dailyStartHour = timeSlots.dailyStartHour;
      if (timeSlots.dailyEndHour !== undefined) overrideData.dailyEndHour = timeSlots.dailyEndHour;
      if (timeSlots.weeklyStartHour !== undefined) overrideData.weeklyStartHour = timeSlots.weeklyStartHour;
      if (timeSlots.weeklyEndHour !== undefined) overrideData.weeklyEndHour = timeSlots.weeklyEndHour;
      if (timeSlots.monthlyStartHour !== undefined) overrideData.monthlyStartHour = timeSlots.monthlyStartHour;
      if (timeSlots.monthlyEndHour !== undefined) overrideData.monthlyEndHour = timeSlots.monthlyEndHour;
    }

    if (existingOverride) {
      return await prisma.planOverride.update({
        where: { id: existingOverride.id },
        data: overrideData
      });
    } else {
      return await prisma.planOverride.create({
        data: {
          planId,
          ...overrideData
        }
      });
    }
  }

  /**
   * Get plan override
   */
  async getPlanOverride(planId: string) {
    return await prisma.planOverride.findFirst({
      where: { planId }
    });
  }

  /**
   * Delete plan override
   */
  async deletePlanOverride(planId: string) {
    const override = await prisma.planOverride.findFirst({
      where: { planId }
    });
    
    if (override) {
      await prisma.planOverride.delete({
        where: { id: override.id }
      });
    }
  }
}

export default new WalletService();