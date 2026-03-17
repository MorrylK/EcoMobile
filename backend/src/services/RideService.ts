import { prisma } from '../config/prisma';
import { RideStatus, Ride } from '@prisma/client';
import BikeService from './BikeService';
import WalletService from './WalletService';
import FreeDaysRuleService from './FreeDaysRuleService';
import PricingTierService from './PricingTierService';
import { AppError } from '../middleware/errorHandler';
import { t } from '../locales';

export interface CreateRideDto {
  userId: string;
  bikeId: string;
  startLatitude: number;
  startLongitude: number;
}

export interface EndRideDto {
  endLatitude: number;
  endLongitude: number;
}

export interface RideWithDetails extends Ride {
  bike?: any;
  user?: any;
  gpsTrack?: any[];
}

export class RideService {
  constructor() {}

  async startRide(userId: string, bikeId: string, startLocation: any, language: 'fr' | 'en' = 'fr'): Promise<Ride> {
    // Check if user has active ride
    const activeRide = await prisma.ride.findFirst({
      where: { 
        userId, 
        status: RideStatus.IN_PROGRESS 
      }
    });

    if (activeRide) {
      throw new AppError(t('ride.already_in_progress', language), 400);
    }

    // Check if bike is available and unlock it
    const bike = await BikeService.getBikeById(bikeId);
    if (!bike) {
      throw new AppError(t('bike.not_found', language), 404);
    }

    if (bike.status !== 'AVAILABLE') {
      throw new AppError(t('bike.unavailable', language), 400);
    }

    // Check user wallet balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    if (!user?.wallet || user.wallet.balance < 5) { // Minimum 5 units required
      throw new AppError(t('wallet.insufficient_balance', language), 400);
    }

    try {
      // Start transaction
      const ride = await prisma.$transaction(async (tx) => {
        // Create ride
        const newRide = await tx.ride.create({
          data: {
            userId,
            bikeId,
            startTime: new Date(),
            startLatitude: startLocation.latitude,
            startLongitude: startLocation.longitude,
            status: RideStatus.IN_PROGRESS
          }
        });

        // Unlock bike via BikeService (which handles GPS sync)
        await BikeService.unlockBike(bikeId);

        return newRide;
      });

      // Send notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'success',
          title: language === 'fr' ? 'Trajet commencé' : 'Ride started',
          message: language === 'fr' 
            ? `Votre trajet avec le vélo ${bike.code} a commencé`
            : `Your ride with bike ${bike.code} has started`,
          isRead: false
        }
      });

      return ride;
    } catch (error) {
      console.error('Error starting ride:', error);
      throw new AppError(t('error.ride.start_failed', language), 500);
    }
  }

  /**
   * Terminer un trajet avec la logique de pricing avancée
   */
  async endRide(rideId: string, endLocation: any, language: 'fr' | 'en' = 'fr'): Promise<any> {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        bike: { include: { pricingPlan: { include: { overrides: true } } } },
        user: { include: { wallet: true } },
        plan: { include: { overrides: true } }
      }
    });

    if (!ride) {
      throw new AppError(t('ride.not_found', language), 404);
    }

    if (ride.status !== RideStatus.IN_PROGRESS) {
      throw new AppError(t('ride.not_in_progress', language), 400);
    }

    // Calculer la durée
    const duration = Math.floor((new Date().getTime() - new Date(ride.startTime).getTime()) / 1000 / 60);
    
    // Calculer la distance
    let distance = BikeService.calculateDistance(
      ride.startLatitude,
      ride.startLongitude,
      endLocation.latitude,
      endLocation.longitude
    );

    // Obtenir la piste GPS pour une distance plus précise
    try {
      const gpsTrack = await BikeService.getBikeTrack(ride.bikeId, ride.startTime, new Date());
      if (gpsTrack.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < gpsTrack.length; i++) {
          totalDistance += BikeService.calculateDistance(
            gpsTrack[i-1].latitude,
            gpsTrack[i-1].longitude,
            gpsTrack[i].latitude,
            gpsTrack[i].longitude
          );
        }
        if (totalDistance > distance && totalDistance < distance * 3) {
          distance = totalDistance;
        }
      }
    } catch (error) {
      console.warn('Failed to get GPS track:', error);
    }

    // Vérifier l'abonnement actif
    const activeSubscription = await this.getActiveSubscriptionForRide(ride.userId);
    
    // Utiliser le plan du vélo si le plan de la course n'est pas défini
    const ridePlan = ride.plan || ride.bike?.pricingPlan;
    
    // Calculer le coût avec la logique avancée
    const costCalculation = await this.calculateAdvancedRideCost(
      ride.userId,
      duration,
      ride.startTime,
      activeSubscription,
      ridePlan
    );

    // Appliquer un jour gratuit si l'utilisateur n'a pas de forfait payant
    // La règle est lue dynamiquement → un changement admin s'applique immédiatement
    if (costCalculation.paymentMethod === 'WALLET') {
      const rideEndTime = new Date();
      const pricingConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
      if (!pricingConfig) throw new Error('Aucune configuration tarifaire active trouvée');
      const fallbackHourlyRate = pricingConfig.baseHourlyRate;
      const freeDayResult = await FreeDaysRuleService.applyFreeDay(
        ride.userId,
        ride.startTime,
        rideEndTime,
        fallbackHourlyRate,
      );
      if (freeDayResult.applied) {
        costCalculation.finalCost = freeDayResult.overtimeCost;
        costCalculation.discountApplied = costCalculation.originalCost - freeDayResult.overtimeCost;
        costCalculation.appliedRule = freeDayResult.overtimeCost > 0
          ? `Jour gratuit (${freeDayResult.ruleName}) + overtime`
          : `Jour gratuit (${freeDayResult.ruleName})`;
        costCalculation.paymentMethod = freeDayResult.overtimeCost > 0 ? 'FREE_DAY_OVERTIME' : 'FREE_DAY';
      }
    }

    // Vérifier la capacité de paiement
    await this.validatePaymentCapacity(ride.user, costCalculation.finalCost);

    try {
      const updatedRide = await prisma.$transaction(async (tx) => {
        // Mettre à jour le trajet
        const completedRide = await tx.ride.update({
          where: { id: rideId },
          data: {
            endTime: new Date(),
            endLatitude: endLocation.latitude,
            endLongitude: endLocation.longitude,
            distance: Math.round(distance * 100) / 100,
            duration,
            cost: costCalculation.finalCost,
            status: RideStatus.COMPLETED
          },
          include: {
            bike: true,
            user: { include: { wallet: true } }
          }
        });

        // Traiter le paiement avec la logique avancée
        if (costCalculation.finalCost > 0) {
          await WalletService.processRidePayment(
            ride.userId,
            rideId,
            costCalculation.finalCost,
            !!activeSubscription,
            costCalculation.isOvertime,
            ride.startTime
          );
        }

        // Pour les formules DURATION : incrémenter les minutes de trajet utilisées
        if (activeSubscription?.formulaType === 'DURATION' && activeSubscription.type === 'SUBSCRIPTION') {
          const maxMinutes = activeSubscription.maxRideDurationHours
            ? activeSubscription.maxRideDurationHours * 60
            : null;
          const used = activeSubscription.usedRideMinutes ?? 0;
          // On ne consomme que les minutes couvertes (pas le dépassement)
          const consumed = maxMinutes !== null
            ? Math.min(duration, Math.max(0, maxMinutes - used))
            : duration;
          if (consumed > 0) {
            await tx.subscription.update({
              where: { id: activeSubscription.id },
              data: { usedRideMinutes: { increment: consumed } } as any
            });
          }
        }

        // Créer une transaction avec détails
        await tx.transaction.create({
          data: {
            walletId: ride.user.wallet!.id,
            type: 'RIDE_PAYMENT',
            amount: costCalculation.finalCost,
            fees: 0,
            totalAmount: costCalculation.finalCost,
            status: 'COMPLETED',
            paymentMethod: costCalculation.paymentMethod,
            metadata: {
              rideId,
              originalCost: costCalculation.originalCost,
              discountApplied: costCalculation.discountApplied,
              isOvertime: costCalculation.isOvertime,
              hasActiveSubscription: !!activeSubscription,
              subscriptionType: activeSubscription?.packageType,
              appliedRule: costCalculation.appliedRule,
              duration,
              distance
            }
          }
        });

        return completedRide;
      });

      // Verrouiller le vélo et mettre à jour sa position
      await BikeService.lockBike(ride.bikeId);
      await BikeService.updateBikeLocation(ride.bikeId, endLocation.latitude, endLocation.longitude);

      // Notification avec détails du pricing
      const rideInfo = `${duration} min, ${distance.toFixed(2)} km`;
      const notificationMessage =
        costCalculation.paymentMethod === 'FREE_DAY'
          ? `Trajet terminé (${rideInfo}). Trajet gratuit — jour gratuit utilisé.`
          : costCalculation.paymentMethod === 'FREE_DAY_OVERTIME'
          ? `Trajet terminé (${rideInfo}). Jour gratuit utilisé + ${costCalculation.finalCost} XAF d'overtime (dépassement de la plage horaire).`
          : costCalculation.finalCost === 0
          ? `Trajet terminé (${rideInfo}). Inclus dans votre forfait ${activeSubscription?.planName}!`
          : costCalculation.discountApplied > 0
          ? `Trajet terminé (${rideInfo}). Coût: ${costCalculation.finalCost} XAF (économie: ${costCalculation.discountApplied} XAF)`
          : `Trajet terminé (${rideInfo}). Coût: ${costCalculation.finalCost} XAF`;

      await prisma.notification.create({
        data: {
          userId: ride.userId,
          type: 'success',
          title: language === 'fr' ? 'Trajet terminé' : 'Ride completed',
          message: notificationMessage,
          isRead: false
        }
      });

      return { ...updatedRide, costDetails: costCalculation };
    } catch (error) {
      console.error('Error ending ride:', error);
      throw new AppError(t('error.ride.end_failed', language), 500);
    }
  }

  async getUserRides(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { userId },
        include: {
          bike: true
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit
      }),
      prisma.ride.count({ where: { userId } })
    ]);

    return {
      rides,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getActiveRide(userId: string, _language: 'fr' | 'en' = 'fr'): Promise<RideWithDetails | null> {
    const ride = await prisma.ride.findFirst({
      where: { 
        userId, 
        status: RideStatus.IN_PROGRESS 
      },
      include: {
        bike: true,
        user: true
      }
    });

    if (!ride) return null;

    // Get real-time bike location if available
    if (ride.bike?.code) {
      try {
        const updatedBike = await BikeService.getBikeById(ride.bikeId);
        if (updatedBike) {
          ride.bike = updatedBike;
        }
      } catch (error) {
        console.warn('Failed to get updated bike location:', error);
      }
    }

    return ride;
  }

  async getRideById(rideId: string): Promise<RideWithDetails | null> {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        bike: true,
        user: true
      }
    });

    if (!ride) return null;

    // Get GPS track if ride is completed
    if (ride.status === RideStatus.COMPLETED && ride.endTime) {
      try {
        const gpsTrack = await BikeService.getBikeTrack(
          ride.bikeId,
          ride.startTime,
          ride.endTime
        );
        return { ...ride, gpsTrack };
      } catch (error) {
        console.warn('Failed to get GPS track for completed ride:', error);
      }
    }

    return ride;
  }

  async cancelRide(rideId: string, userId: string, language: 'fr' | 'en' = 'fr'): Promise<Ride> {
    const ride = await prisma.ride.findFirst({
      where: { 
        id: rideId,
        userId,
        status: RideStatus.IN_PROGRESS 
      },
      include: { bike: true }
    });

    if (!ride) {
      throw new AppError(t('ride.not_found', language), 404);
    }

    try {
      const cancelledRide = await prisma.$transaction(async (tx) => {
        // Update ride status
        const updatedRide = await tx.ride.update({
          where: { id: rideId },
          data: {
            status: RideStatus.CANCELLED,
            endTime: new Date()
          }
        });

        return updatedRide;
      });

      // Lock bike and sync location
      try {
        await BikeService.lockBike(ride.bikeId);
      } catch (error) {
        console.error('Failed to lock bike after cancellation:', error);
      }

      // Send notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'info',
          title: language === 'fr' ? 'Trajet annulé' : 'Ride cancelled',
          message: language === 'fr'
            ? `Votre trajet avec le vélo ${ride.bike?.code} a été annulé`
            : `Your ride with bike ${ride.bike?.code} has been cancelled`,
          isRead: false
        }
      });

      return cancelledRide;
    } catch (error) {
      console.error('Error cancelling ride:', error);
      throw new AppError(t('error.ride.cancel_failed', language), 500);
    }
  }

  async getRideStats(userId: string): Promise<{
    totalRides: number;
    totalDistance: number;
    totalDuration: number;
    totalCost: number;
    averageDistance: number;
    averageDuration: number;
  }> {
    const stats = await prisma.ride.aggregate({
      where: {
        userId,
        status: RideStatus.COMPLETED
      },
      _count: { id: true },
      _sum: {
        distance: true,
        duration: true,
        cost: true
      }
    });

    const totalRides = stats._count.id || 0;
    const totalDistance = stats._sum.distance || 0;
    const totalDuration = stats._sum.duration || 0;
    const totalCost = stats._sum.cost || 0;

    return {
      totalRides,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration,
      totalCost: Math.round(totalCost * 100) / 100,
      averageDistance: totalRides > 0 ? Math.round((totalDistance / totalRides) * 100) / 100 : 0,
      averageDuration: totalRides > 0 ? Math.round(totalDuration / totalRides) : 0
    };
  }

  /**
   * Calculer le coût avec la logique avancée (forfaits, overtime, réductions)
   */
  private async calculateAdvancedRideCost(
    _userId: string,
    duration: number,
    startTime: Date,
    activeSubscription: any,
    _ridePlan: any
  ) {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const roundedHours = Math.ceil(duration / 60);

    let finalCost = 0;
    let originalCost = 0;
    let discountApplied = 0;
    let appliedRule = 'Tarif normal';
    let paymentMethod = 'WALLET';
    let isOvertime = false;
    let breakdown: any[] = [];

    // ── Utilisateur sans abonnement → facturation par PricingTier ──
    if (!activeSubscription) {
      const calc = await PricingTierService.calculateRideCost(duration, startTime, endTime);
      originalCost = calc.totalCost;
      finalCost = calc.totalCost;
      breakdown = calc.breakdown;
      appliedRule = 'Tarification sans forfait (paliers)';
      return { originalCost, finalCost, discountApplied, isOvertime, appliedRule, paymentMethod, hasActiveSubscription: false, roundedHours, breakdown };
    }

    // ── Abonnement DURATION ──
    if (activeSubscription.formulaType === 'DURATION') {
      const durationTierApplies = this.durationFormulaAppliesNow(activeSubscription, startTime);

      if (!durationTierApplies) {
        // Hors plage horaire de la formule → facturation sans forfait
        const calc = await PricingTierService.calculateRideCost(duration, startTime, endTime);
        originalCost = calc.totalCost;
        finalCost = calc.totalCost;
        breakdown = calc.breakdown;
        isOvertime = true;
        appliedRule = 'Forfait durée — hors plage horaire, tarification standard';
        paymentMethod = 'SUBSCRIPTION_OVERTIME';
        return { originalCost, finalCost, discountApplied, isOvertime, appliedRule, paymentMethod, hasActiveSubscription: true, roundedHours, breakdown };
      }

      const maxMinutes = activeSubscription.maxRideDurationHours
        ? activeSubscription.maxRideDurationHours * 60
        : null;
      const usedMinutes = activeSubscription.usedRideMinutes ?? 0;
      const remainingMinutes = maxMinutes !== null ? Math.max(0, maxMinutes - usedMinutes) : null;

      // Calcul du "coût de référence" pour le détail (via PricingTier, pour l'overtime éventuel)
      const baseCalc = await PricingTierService.calculateRideCost(duration, startTime, endTime);
      originalCost = baseCalc.totalCost;

      if (remainingMinutes !== null && remainingMinutes <= 0) {
        // Crédit épuisé → facturation standard
        finalCost = originalCost;
        isOvertime = true;
        appliedRule = 'Forfait durée épuisé — tarification standard';
        paymentMethod = 'SUBSCRIPTION_OVERTIME';
        breakdown = baseCalc.breakdown;
      } else if (remainingMinutes !== null && duration > remainingMinutes) {
        // Dépassement partiel → facturer seulement l'overtime
        const overtimeMinutes = duration - remainingMinutes;
        const overtimeCalc = await PricingTierService.calculateRideCost(overtimeMinutes, new Date(startTime.getTime() + remainingMinutes * 60000), endTime);
        finalCost = overtimeCalc.totalCost;
        discountApplied = originalCost - finalCost;
        isOvertime = true;
        appliedRule = `Forfait durée — dépassement de ${overtimeMinutes} min`;
        paymentMethod = 'SUBSCRIPTION_OVERTIME';
        breakdown = overtimeCalc.breakdown;
      } else {
        // Couvert entièrement
        finalCost = 0;
        discountApplied = originalCost;
        appliedRule = `Inclus dans ${activeSubscription.planName} (durée)`;
        paymentMethod = 'SUBSCRIPTION';
        breakdown = [];
      }
      return { originalCost, finalCost, discountApplied, isOvertime, appliedRule, paymentMethod, hasActiveSubscription: true, roundedHours, breakdown };
    }

    // ── Abonnement TIME_WINDOW ──
    {
      const calc = await PricingTierService.calculateRideCost(duration, startTime, endTime);
      originalCost = calc.totalCost;

      isOvertime = await this.checkIfOvertime(startTime, activeSubscription.packageType, activeSubscription.planId);

      if (isOvertime) {
        const overrideRule = await this.getOverrideRule(activeSubscription.planId);
        if (overrideRule) {
          if (overrideRule.overTimeType === 'FIXED_PRICE') {
            finalCost = overrideRule.overTimeValue;
            appliedRule = `Prix fixe overtime: ${overrideRule.overTimeValue} FCFA`;
          } else {
            const reduction = Math.round(originalCost * (overrideRule.overTimeValue / 100));
            finalCost = Math.max(0, originalCost - reduction);
            discountApplied = reduction;
            appliedRule = `Réduction overtime: ${overrideRule.overTimeValue}%`;
          }
        } else {
          // Pas d'override → facturation standard sans forfait hors plage
          finalCost = originalCost;
          appliedRule = 'Hors plage horaire — tarification standard';
        }
        paymentMethod = 'SUBSCRIPTION_OVERTIME';
        breakdown = calc.breakdown;
      } else {
        finalCost = 0;
        discountApplied = originalCost;
        appliedRule = `Inclus dans le forfait ${activeSubscription.planName}`;
        paymentMethod = 'SUBSCRIPTION';
        breakdown = [];
      }
      return { originalCost, finalCost, discountApplied, isOvertime, appliedRule, paymentMethod, hasActiveSubscription: true, roundedHours, breakdown };
    }
  }

  /**
   * Check if a DURATION formula applies at the given time (optional time window).
   */
  private durationFormulaAppliesNow(subscription: any, time: Date): boolean {
    if (subscription.dayStartHour === null || subscription.dayEndHour === null) return true;
    const hour = time.getHours();
    const start = subscription.dayStartHour;
    const end = subscription.dayEndHour;
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end; // overnight
  }

  /**
   * Vérifier si on est en overtime selon le type de forfait
   */
  private async checkIfOvertime(startTime: Date, packageType: string, planId?: string): Promise<boolean> {
    const hour = startTime.getHours();
    
    // Si un planId est fourni, vérifier les plages horaires définies dans PlanOverride
    if (planId) {
      const override = await this.getOverrideRule(planId);
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
        return hour < 8 || hour >= 19; // 8h-19h
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
        return hour < 6 || hour >= 12; // 6h-12h
      case 'evening':
      case 'soirée':
        return hour < 19 || hour >= 22; // 19h-22h
      case 'weekly':
      case 'monthly':
        return false; // Pas d'overtime pour ces forfaits
      default:
        return false;
    }
  }

  /**
   * Obtenir l'abonnement actif pour un trajet
   */
  private async getActiveSubscriptionForRide(userId: string) {
    // Vérifier d'abord les réservations (priorité)
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: { plan: { include: { overrides: true } } }
    });

    if (activeReservation) {
      return {
        id: activeReservation.id,
        planId: activeReservation.planId,
        planName: activeReservation.plan?.name || 'Unknown',
        packageType: activeReservation.packageType,
        type: 'RESERVATION'
      };
    }

    // Sinon vérifier les abonnements généraux
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        plan: { include: { overrides: true } },
        formula: true,
        package: true,
      }
    });

    if (activeSubscription) {
      const formula = activeSubscription.formula as any;
      return {
        id: activeSubscription.id,
        planId: activeSubscription.planId,
        planName: activeSubscription.plan?.name || activeSubscription.package?.name || 'Unknown',
        packageType: activeSubscription.type,
        type: 'SUBSCRIPTION',
        // Champs formule nouveau système
        formulaType: formula?.formulaType ?? 'TIME_WINDOW',
        maxRideDurationHours: formula?.maxRideDurationHours ?? null,
        dayStartHour: formula?.dayStartHour ?? null,
        dayEndHour: formula?.dayEndHour ?? null,
        usedRideMinutes: (activeSubscription as any).usedRideMinutes ?? 0,
      };
    }

    return null;
  }

  /**
   * Obtenir la règle d'override pour un plan
   */
  private async getOverrideRule(planId: string) {
    return await prisma.planOverride.findFirst({
      where: { planId }
    });
  }

  /**
   * Valider la capacité de paiement
   */
  private async validatePaymentCapacity(user: any, amount: number) {
    if (amount === 0) return; // Rien à payer

    const totalAvailable = user.wallet.balance + user.depositBalance;
    
    if (totalAvailable < amount) {
      throw new AppError(
        `Solde insuffisant. Requis: ${amount} XOF, Disponible: ${totalAvailable} XOF (Wallet: ${user.wallet.balance}, Caution: ${user.depositBalance})`,
        400
      );
    }
  }
}

export default new RideService();