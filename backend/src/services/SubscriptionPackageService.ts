import { prisma } from '../config/prisma';
import { SubscriptionType } from '@prisma/client';
import WalletService from './WalletService';
import NotificationService from './NotificationService';
import SubscriptionPackageRepository from '../repositories/SubscriptionPackageRepository';

interface SubscribeToFormulaRequest {
  formulaId: string;
  startDate?: Date;
}

class SubscriptionPackageService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }
  /**
   * Get all available packages
   */
  async getAvailablePackages() {
    return await SubscriptionPackageRepository.getAllPackages(false);
  }

  /**
   * Get package details with formulas
   */
  async getPackageDetails(packageId: string) {
    return await SubscriptionPackageRepository.getPackageById(packageId);
  }

  /**
   * Get user's current active subscription
   */
  async getCurrentSubscription(userId: string) {
    // Check for active subscription (based on dates and isActive flag)
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        package: { include: { formulas: true } },
        formula: true,
        user: true
      }
    });

    if (!subscription) return null;

    const formula = subscription.formula as any;
    const isDuration = formula?.formulaType === 'DURATION';
    const maxMinutes = isDuration && formula?.maxRideDurationHours
      ? formula.maxRideDurationHours * 60
      : null;
    const usedMinutes = (subscription as any).usedRideMinutes ?? 0;

    return {
      id: subscription.id,
      packageName: subscription.package?.name ?? '',
      formulaName: subscription.formula?.name ?? '',
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      dayResetTime: subscription.dayResetTime,
      currentDay: subscription.currentDay,
      numberOfDays: subscription.formula?.numberOfDays ?? 0,
      dayStartHour: subscription.formula?.dayStartHour ?? 0,
      dayEndHour: subscription.formula?.dayEndHour ?? 0,
      chargeAfterHours: subscription.formula?.chargeAfterHours ?? false,
      // Nouveau système : type de formule
      formulaType: formula?.formulaType ?? 'TIME_WINDOW',
      maxRideDurationHours: formula?.maxRideDurationHours ?? null,
      usedRideMinutes: usedMinutes,
      remainingRideMinutes: maxMinutes !== null ? Math.max(0, maxMinutes - usedMinutes) : null,
      status: 'ACTIVE',
      remainingDays: Math.ceil(
        (subscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    };
  }

  /**
   * Subscribe to a formula
   */
  async subscribeToFormula(userId: string, data: SubscribeToFormulaRequest) {
    const formula = await SubscriptionPackageRepository.getFormulaById(data.formulaId);
    
    if (!formula) {
      throw new Error('Formule non trouvée');
    }

    // Get package for reference
    const pkg = await SubscriptionPackageRepository.getPackageById(formula.packageId);
    if (!pkg) {
      throw new Error('Forfait non trouvé');
    }

    // Check balance
    const balance = await WalletService.getBalance(userId);
    if (balance.balance < formula.price) {
      throw new Error('Solde insuffisant');
    }

    // Check for existing active subscription
    const existingSubscription = await this.getCurrentSubscription(userId);
    if (existingSubscription) {
      throw new Error('Vous avez déjà un abonnement actif');
    }

    const startDate = data.startDate || new Date();
    const resetHour = formula.dayStartHour ?? 0;
    const dayResetTime = new Date(startDate);
    dayResetTime.setHours(resetHour, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + formula.numberOfDays);
    endDate.setHours(resetHour, 0, 0, 0);

    // Create subscription in transaction
    const result = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          userId,
          packageId: formula.packageId,
          formulaId: data.formulaId,
          type: SubscriptionType[`${formula.numberOfDays === 1 ? 'DAILY' : formula.numberOfDays === 7 ? 'WEEKLY' : 'MONTHLY'}`] || SubscriptionType.DAILY,
          startDate,
          endDate,
          dayResetTime,
          currentDay: 1,
          isActive: true
        },
        include: {
          package: true,
          formula: true,
          user: true
        }
      });

      // Deduct from wallet
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Portefeuille non trouvé');

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: formula.price } }
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'SUBSCRIPTION_PAYMENT',
          amount: formula.price,
          fees: 0,
          totalAmount: formula.price,
          status: 'COMPLETED',
          paymentMethod: 'WALLET',
          metadata: {
            subscriptionId: subscription.id,
            packageName: pkg.name,
            formulaName: formula.name,
            numberOfDays: formula.numberOfDays
          }
        }
      });

      return subscription;
    });

    // Send notification
    await this.notificationService.createNotification({
      userId,
      title: 'Abonnement activé',
      message: `Vous êtes maintenant abonné à ${pkg.name} - ${formula.name}. Votre abonnement est valide jusqu'au ${endDate.toLocaleDateString('fr-FR')}.`,
      type: 'SUBSCRIPTION'
    });

    return result;
  }

  /**
   * Cancel active subscription
   */
  async cancelSubscription(subscriptionId: string, userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId }
    });

    if (!subscription) {
      throw new Error('Abonnement non trouvé');
    }

    if (!subscription.isActive) {
      throw new Error('L\'abonnement est déjà inactif');
    }

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false }
    });

    const pkg = await SubscriptionPackageRepository.getPackageById(subscription.packageId ?? '');
    
    await this.notificationService.createNotification({
      userId,
      title: 'Abonnement annulé',
      message: `Votre abonnement ${pkg?.name} a été annulé.`,
      type: 'SUBSCRIPTION'
    });
  }

  /**
   * Change subscription to a different formula
   */
  async changeSubscription(subscriptionId: string, userId: string, newFormulaId: string) {
    const currentSubscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId }
    });

    if (!currentSubscription) {
      throw new Error('Abonnement actuel non trouvé');
    }

    const newFormula = await SubscriptionPackageRepository.getFormulaById(newFormulaId);
    if (!newFormula) {
      throw new Error('Nouvelle formule non trouvée');
    }

    // Cancel current subscription
    await this.cancelSubscription(subscriptionId, userId);

    // Subscribe to new formula
    return await this.subscribeToFormula(userId, {
      formulaId: newFormulaId,
      startDate: new Date()
    });
  }

  /**
   * Check if currently within subscription day hours
   */
  isWithinDayHours(subscription: any, date: Date = new Date()): boolean {
    const hours = date.getHours();
    return hours >= subscription.dayStartHour && hours <= subscription.dayEndHour;
  }

  /**
   * Calculate if ride should be charged based on subscription
   */
  calculateRideCharge(subscription: any, rideStartTime: Date, rideEndTime: Date): {
    shouldCharge: boolean;
    amount: number;
    reason: string;
  } {
    const currentTime = new Date();

    // Check if subscription is still active
    if (!subscription.isActive || currentTime > subscription.endDate) {
      return {
        shouldCharge: true,
        amount: 0,
        reason: 'Abonnement expiré'
      };
    }

    const rideStartHour = rideStartTime.getHours();
    const rideEndHour = rideEndTime.getHours();
    const withinHours = rideStartHour >= subscription.dayStartHour && rideEndHour <= subscription.dayEndHour;

    // If ride is completely within subscription hours, no charge
    if (withinHours) {
      return {
        shouldCharge: false,
        amount: 0,
        reason: 'Couvert par l\'abonnement'
      };
    }

    // If ride ends after hours and after-hours charging is enabled
    if (rideEndHour > subscription.dayEndHour && subscription.chargeAfterHours) {
      return {
        shouldCharge: true,
        amount: subscription.formula.afterHoursPrice || 0,
        reason: 'Tarif après horaire'
      };
    }

    // If after-hours charging is disabled, no charge
    if (!subscription.chargeAfterHours) {
      return {
        shouldCharge: false,
        amount: 0,
        reason: 'Pas de tarif après horaire'
      };
    }

    return {
      shouldCharge: false,
      amount: 0,
      reason: 'Gratuit'
    };
  }

  /**
   * Update subscription day counter
   */
  async updateSubscriptionDay(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      throw new Error('Abonnement non trouvé');
    }

    const currentDay = subscription.currentDay + 1;
    const formula = await SubscriptionPackageRepository.getFormulaById(subscription.formulaId ?? '');

    // If we've reached the end of days, mark as complete
    if (formula && currentDay > formula.numberOfDays) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { isActive: false }
      });
      return;
    }

    // Otherwise, increment day
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { currentDay }
    });
  }

  /**
   * Create subscription package (admin)
   */
  async createPackage(data: { name: string; description?: string }) {
    return await SubscriptionPackageRepository.createPackage(data);
  }

  /**
   * Update subscription package (admin)
   */
  async updatePackage(id: string, data: any) {
    return await SubscriptionPackageRepository.updatePackage(id, data);
  }

  /**
   * Delete subscription package (admin)
   */
  async deletePackage(id: string) {
    return await SubscriptionPackageRepository.deletePackage(id);
  }

  /**
   * Create formula (admin)
   */
  async createFormula(data: any) {
    return await SubscriptionPackageRepository.createFormula(data);
  }

  /**
   * Update formula (admin)
   */
  async updateFormula(id: string, data: any) {
    return await SubscriptionPackageRepository.updateFormula(id, data);
  }

  /**
   * Delete formula (admin)
   */
  async deleteFormula(id: string) {
    return await SubscriptionPackageRepository.deleteFormula(id);
  }
}

export default new SubscriptionPackageService();
