import { prisma } from '../config/prisma';
import { RequestStatus, BikeStatus } from '@prisma/client';
import NotificationService from './NotificationService';
import { imageService } from './ImageService';
import PricingTierService from './PricingTierService';
import FreeDaysRuleService from './FreeDaysRuleService';

export class BikeRequestService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Créer une demande de déverrouillage
   */
  async createUnlockRequest(userId: string, bikeId: string, metadata?: any, req?: any): Promise<any> {
    // Vérifier la caution
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    const requiredDeposit = await this.getRequiredDeposit();
    
    if (!user || !user.wallet) {
      throw new Error('Portefeuille non trouvé');
    }

    // Vérifier si l'utilisateur a un déblocage sans caution actif
    const hasActiveExemption = user.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date();

    if (!hasActiveExemption && user.wallet.deposit < requiredDeposit) {
      throw new Error(`Caution insuffisante. Minimum requis : ${requiredDeposit} FCFA. Votre caution actuelle est de : ${user.wallet.deposit} FCFA`);
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const existingRequest = await prisma.unlockRequest.findFirst({
      where: {
        userId,
        status: RequestStatus.PENDING
      }
    });

    if (existingRequest) {
      throw new Error('Vous avez déjà une demande en attente');
    }

    // Vérifier qu'il n'y a pas de trajet en cours
    const activeRide = await prisma.ride.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS'
      }
    });

    if (activeRide) {
      throw new Error('Vous avez déjà un trajet en cours');
    }

    // Traiter les images si présentes
    let processedMetadata = metadata;
    if (metadata?.inspection?.photos) {
      const savedImagePaths = await imageService.saveMultipleImages(metadata.inspection.photos);
      processedMetadata = {
        ...metadata,
        inspection: {
          ...metadata.inspection,
          photos: savedImagePaths
        }
      };
    }

    // Vérifier aussi dans inspectionData (nouvelle structure)
    if (metadata?.inspectionData?.photos) {
      const savedImagePaths = await imageService.saveMultipleImages(metadata.inspectionData.photos);
      processedMetadata = {
        ...metadata,
        inspectionData: {
          ...metadata.inspectionData,
          photos: savedImagePaths
        }
      };
    }

    const request = await prisma.unlockRequest.create({
      data: {
        userId,
        bikeId,
        status: RequestStatus.PENDING,
        metadata: processedMetadata || {}
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        bike: { select: { code: true, model: true } }
      }
    });

    const responseMetadata = this.prepareMetadataForResponse(request.metadata, req);

    const response = {
      ...request,
      metadata: responseMetadata
    };

    // Notifier les admins
    await this.notifyAdmins('unlock', request);

    return response;
  }

  /**
   * Créer une demande de verrouillage
   */
  async createLockRequest(userId: string, bikeId: string, rideId?: string, location?: { lat: number; lng: number }, metadata?: any, req?: any): Promise<any> {
    // Vérifier si une demande de verrouillage existe déjà pour ce vélo
    const existingLockRequest = await prisma.lockRequest.findFirst({
      where: {
        bikeId,
        status: RequestStatus.PENDING
      }
    });

    if (existingLockRequest) {
      throw new Error('Une demande de verrouillage est déjà en attente pour ce vélo');
    }

    // Traiter les images si présentes
    let processedMetadata = metadata;
    if (metadata?.inspection?.photos) {
      const savedImagePaths = await imageService.saveMultipleImages(metadata.inspection.photos);
      processedMetadata = {
        ...metadata,
        inspection: {
          ...metadata.inspection,
          photos: savedImagePaths
        }
      };
    }

    // Vérifier aussi dans inspectionData (nouvelle structure)
    if (metadata?.inspectionData?.photos) {
      const savedImagePaths = await imageService.saveMultipleImages(metadata.inspectionData.photos);
      processedMetadata = {
        ...metadata,
        inspectionData: {
          ...metadata.inspectionData,
          photos: savedImagePaths
        }
      };
    }

    const request = await prisma.lockRequest.create({
      data: {
        userId,
        bikeId,
        rideId,
        latitude: location?.lat,
        longitude: location?.lng,
        status: RequestStatus.PENDING,
        metadata: processedMetadata || {}
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        bike: { select: { code: true, model: true } }
      }
    });

    const responseMetadata = this.prepareMetadataForResponse(request.metadata, req);

    const response = {
      ...request,
      metadata: responseMetadata
    };

    // Notifier les admins
    await this.notifyAdmins('lock', request);

    return response;
  }

  /**
   * Supprimer une demande
   */
  async deleteRequest(type: 'unlock' | 'lock', requestId: string): Promise<void> {
    let request;
    
    if (type === 'unlock') {
      request = await prisma.unlockRequest.findUnique({
        where: { id: requestId }
      });
    } else {
      request = await prisma.lockRequest.findUnique({
        where: { id: requestId }
      });
    }

    if (!request) {
      throw new Error('Demande non trouvée');
    }

    // Supprimer les images associées
    const metadata = request.metadata as any;
    if (metadata?.inspectionData?.photos) {
      await imageService.deleteMultipleImages(metadata.inspectionData.photos);
    }

    // Supprimer la demande
    if (type === 'unlock') {
      await prisma.unlockRequest.delete({ where: { id: requestId } });
    } else {
      await prisma.lockRequest.delete({ where: { id: requestId } });
    }
  }

  /**
   * Valider une demande de déverrouillage (admin)
   */
  async approveUnlockRequest(requestId: string, adminId: string): Promise<any> {
    const request = await prisma.unlockRequest.findUnique({
      where: { id: requestId },
      include: { bike: true, user: { include: { wallet: true } }, reservation: true }
    });

    if (!request || request.status !== RequestStatus.PENDING) {
      throw new Error('Demande non trouvée ou déjà traitée');
    }

    // Vérifier que le vélo est disponible
    if (request.bike.status !== BikeStatus.AVAILABLE && request.bike.status !== BikeStatus.IN_USE) {
      throw new Error('Le vélo n\'est pas disponible');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Valider la demande
      const updatedRequest = await tx.unlockRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          validatedAt: new Date(),
          validatedBy: adminId
        }
      });

      // Déverrouiller le vélo
      await tx.bike.update({
        where: { id: request.bikeId },
        data: { status: BikeStatus.IN_USE }
      });

      // Créer le trajet
      const ride = await tx.ride.create({
        data: {
          userId: request.userId,
          bikeId: request.bikeId,
          startTime: new Date(),
          startLatitude: request.bike.latitude || 0,
          startLongitude: request.bike.longitude || 0,
          status: 'IN_PROGRESS',
          planId: request.reservation?.planId || null
        }
      });

      // Si c'est lié à une réservation, mettre à jour son statut
      if (request.reservationId) {
        await tx.reservation.update({
          where: { id: request.reservationId },
          data: { status: 'IN_USE' }
        });
      }

      return { request: updatedRequest, ride };
    });

    // Notifier l'utilisateur
    await this.notificationService.createNotification({
      userId: request.userId,
      title: 'Déverrouillage validé - Trajet démarré',
      message: `Votre demande de déverrouillage du vélo ${request.bike.code} a été approuvée. Votre trajet a commencé !`,
      type: 'UNLOCK_APPROVED',
      metadata: {
        bikeId: request.bikeId,
        bike: request.bike,
        rideId: result.ride.id
      }
    });

    return result;
  }

  /**
   * Rejeter une demande de déverrouillage (admin)
   */
  async rejectUnlockRequest(requestId: string, adminId: string, reason: string): Promise<any> {
    const request = await prisma.unlockRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.REJECTED,
        rejectedAt: new Date(),
        validatedBy: adminId,
        rejectionReason: reason
      },
      include: { user: true, bike: true }
    });

    // Notifier l'utilisateur
    await this.notificationService.createNotification({
      userId: request.userId,
      title: 'Déverrouillage refusé',
      message: `Votre demande de déverrouillage a été refusée. Raison: ${reason}`,
      type: 'UNLOCK_REJECTED',
      metadata: {
        bikeId: request.bikeId,
        reason
      }
    });

    return request;
  }

  /**
   * Valider une demande de verrouillage (admin)
   */
  async approveLockRequest(requestId: string, adminId: string): Promise<any> {
    const request = await prisma.lockRequest.findUnique({
      where: { id: requestId },
      include: { bike: { include: { pricingPlan: { include: { overrides: true } } } }, user: { include: { wallet: true } }, ride: { include: { plan: { include: { overrides: true } } } } }
    });

    if (!request || request.status !== RequestStatus.PENDING) {
      throw new Error('Demande non trouvée ou déjà traitée');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Valider la demande
      await tx.lockRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.APPROVED,
          validatedAt: new Date(),
          validatedBy: adminId
        }
      });

      // Verrouiller le vélo
      await tx.bike.update({
        where: { id: request.bikeId },
        data: { 
          status: BikeStatus.AVAILABLE,
          latitude: request.latitude,
          longitude: request.longitude
        }
      });

      let rideResult = null;
      let paymentResult = null;

      // Terminer le trajet si spécifié
      if (request.rideId && request.ride) {
        const ride = request.ride;

        if (ride.status === 'IN_PROGRESS') {
          const now = new Date();
          const duration = Math.floor((now.getTime() - ride.startTime.getTime()) / 1000 / 60);
          
          // Utiliser le plan du vélo si le plan de la course n'est pas défini
          const ridePlan = ride.plan || request.bike?.pricingPlan;
          
          // Calculer le coût avec la logique avancée
          const costCalculation = await this.calculateAdvancedRideCost(
            request.userId,
            duration,
            ride.startTime,
            ridePlan
          );

          // Appliquer un jour gratuit si l'utilisateur n'a pas de forfait payant
          // (même logique que RideService.endRide)
          if (costCalculation.paymentMethod === 'WALLET') {
            const rideEndTime = new Date();
            const pricingConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
            if (pricingConfig) {
              const freeDayResult = await FreeDaysRuleService.applyFreeDay(
                request.userId,
                ride.startTime,
                rideEndTime,
                pricingConfig.baseHourlyRate,
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
          }
          console.log(`[BILLING] ══ COÛT FINAL approveLockRequest: finalCost=${costCalculation.finalCost} paymentMethod=${costCalculation.paymentMethod} appliedRule="${costCalculation.appliedRule}"`);

          // Mettre à jour le trajet
          rideResult = await tx.ride.update({
            where: { id: request.rideId },
            data: {
              endTime: now,
              endLatitude: request.latitude,
              endLongitude: request.longitude,
              duration,
              cost: costCalculation.finalCost,
              status: 'COMPLETED'
            }
          });

          // Effectuer le paiement
          if (costCalculation.finalCost > 0 && request.user.wallet) {
            paymentResult = await this.processRidePayment(
              tx,
              request.userId,
              request.user.wallet.id,
              request.rideId,
              costCalculation,
              duration
            );
          }

          // Mettre à jour la réservation si elle existe
          const reservation = await tx.reservation.findFirst({
            where: {
              userId: request.userId,
              bikeId: request.bikeId,
              status: { in: ['ACTIVE', 'IN_USE'] }
            }
          });

          if (reservation) {
            await tx.reservation.update({
              where: { id: reservation.id },
              data: { status: 'COMPLETED' }
            });
          }
        }
      }

      return { request, ride: rideResult, payment: paymentResult };
    });

    // Notifier l'utilisateur
    const message = result.ride 
      ? `Votre trajet avec le vélo ${request.bike.code} est terminé. Durée: ${result.ride.duration} min, Coût: ${result.ride.cost} FCFA`
      : `Votre demande de verrouillage du vélo ${request.bike.code} a été approuvée`;

    await this.notificationService.createNotification({
      userId: request.userId,
      title: 'Trajet terminé',
      message,
      type: 'LOCK_APPROVED',
      metadata: {
        bikeId: request.bikeId,
        rideId: request.rideId
      }
    });

    return result;
  }

  /**
   * Traiter le paiement du trajet
   */
  private async processRidePayment(
    tx: any,
    _userId: string,
    walletId: string,
    rideId: string,
    costCalculation: any,
    duration: number
  ) {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new Error('Portefeuille non trouvé');

    const amount = costCalculation.finalCost;
    let deductedFromWallet = 0;
    let deductedFromDeposit = 0;

    if (wallet.balance >= amount) {
      // Tout depuis le wallet
      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: amount } }
      });
      deductedFromWallet = amount;
    } else {
      // Wallet + caution
      const remaining = amount - wallet.balance;
      deductedFromWallet = wallet.balance;
      deductedFromDeposit = Math.min(remaining, wallet.deposit);
      const addToNegative = Math.max(0, remaining - wallet.deposit);

      await tx.wallet.update({
        where: { id: walletId },
        data: { 
          balance: 0,
          deposit: { decrement: deductedFromDeposit },
          negativeBalance: { increment: addToNegative }
        }
      });
    }

    // Créer la transaction
    const transaction = await tx.transaction.create({
      data: {
        walletId,
        type: 'RIDE_PAYMENT',
        amount,
        fees: 0,
        totalAmount: amount,
        status: 'COMPLETED',
        paymentMethod: costCalculation.paymentMethod || 'MIXED',
        metadata: {
          rideId,
          originalCost: costCalculation.originalCost,
          discountApplied: costCalculation.discountApplied,
          isOvertime: costCalculation.isOvertime,
          hasActiveSubscription: costCalculation.hasActiveSubscription,
          appliedRule: costCalculation.appliedRule,
          duration,
          deductedFromWallet,
          deductedFromDeposit,
          paidAt: new Date().toISOString()
        }
      }
    });

    return transaction;
  }

  /**
   * Calculer le coût avec la logique avancée
   */
  private async calculateAdvancedRideCost(
    userId: string,
    duration: number,
    startTime: Date,
    _ridePlan: any
  ) {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const roundedHours = Math.ceil(duration / 60);

    // Coût de base via PricingTierService (même logique que RideService.endRide)
    const calc = await PricingTierService.calculateRideCost(duration, startTime, endTime);
    const originalCost = calc.totalCost;

    let finalCost = originalCost;
    let discountApplied = 0;
    let appliedRule = 'Tarification sans forfait (paliers)';
    let paymentMethod = 'WALLET';
    let isOvertime = false;
    let hasActiveSubscription = false;

    // Vérifier l'abonnement actif
    const activeSubscription = await this.getActiveSubscriptionForRide(userId);

    if (activeSubscription) {
      hasActiveSubscription = true;
      const hour = startTime.getHours();

      if (activeSubscription.hasFormula) {
        // Nouveau système SubscriptionFormula :
        // - dayStartHour/dayEndHour null → pas de restriction horaire → jamais overtime
        // - dayStartHour/dayEndHour définis → vérifier la plage
        if (activeSubscription.dayStartHour !== null && activeSubscription.dayStartHour !== undefined) {
          const start = activeSubscription.dayStartHour as number;
          const end = activeSubscription.dayEndHour as number;
          if (start <= end) {
            isOvertime = !(hour >= start && hour < end);
          } else { // plage qui traverse minuit (ex: 22h-06h)
            isOvertime = !(hour >= start || hour < end);
          }
          console.log(`[BILLING]   overtime via formule dayStartHour=${start} dayEndHour=${end} hour=${hour} → isOvertime=${isOvertime}`);
        } else {
          // Formule sans restriction horaire = toujours couvert
          isOvertime = false;
          console.log(`[BILLING]   formule sans restriction horaire (dayStartHour=null) → isOvertime=false`);
        }
      } else {
        // Ancien système PricingPlan → PlanOverride ou valeurs par défaut
        isOvertime = await this.checkIfOvertime(startTime, activeSubscription.packageType, activeSubscription?.planId || undefined);
        console.log(`[BILLING]   overtime via checkIfOvertime (ancien système) → isOvertime=${isOvertime}`);
      }

      if (isOvertime) {
        const overrideRule = activeSubscription.planId ? await this.getOverrideRule(activeSubscription.planId) : null;

        if (overrideRule) {
          if (overrideRule.overTimeType === 'FIXED_PRICE') {
            finalCost = overrideRule.overTimeValue;
            appliedRule = `Prix fixe overtime: ${overrideRule.overTimeValue} FCFA`;
          } else if (overrideRule.overTimeType === 'PERCENTAGE_REDUCTION') {
            const reduction = Math.round(originalCost * (overrideRule.overTimeValue / 100));
            finalCost = Math.max(0, originalCost - reduction);
            discountApplied = reduction;
            appliedRule = `Réduction overtime: ${overrideRule.overTimeValue}%`;
          } else {
            finalCost = originalCost;
          }
        } else {
          const reduction = Math.round(originalCost * 0.3);
          finalCost = originalCost - reduction;
          discountApplied = reduction;
          appliedRule = 'Réduction forfait overtime par défaut: 30%';
        }
        paymentMethod = 'SUBSCRIPTION_OVERTIME';
      } else {
        finalCost = 0;
        discountApplied = originalCost;
        appliedRule = `Inclus dans le forfait ${activeSubscription.planName}`;
        paymentMethod = 'SUBSCRIPTION';
      }
    }

    return {
      originalCost,
      finalCost,
      discountApplied,
      isOvertime,
      hasActiveSubscription,
      appliedRule,
      paymentMethod,
      roundedHours
    };
  }

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
    
    // Fallback sur les valeurs par défaut si aucune plage n'est définie
    switch (packageType.toLowerCase()) {
      case 'daily':
      case 'journalier':
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
        return hour < 6 || hour >= 12;
      case 'evening':
      case 'soirée':
        return hour < 19 || hour >= 22;
      default:
        return false;
    }
  }

  private async getActiveSubscriptionForRide(userId: string) {
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'IN_USE'] },
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: { plan: { include: { overrides: true } } }
    });

    if (activeReservation) {
      return {
        id: activeReservation.id,
        planId: activeReservation.planId,
        planName: activeReservation.plan.name,
        packageType: activeReservation.packageType,
        type: 'RESERVATION',
        formulaType: 'TIME_WINDOW',
        dayStartHour: null as number | null,
        dayEndHour: null as number | null,
      };
    }

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
        planName: activeSubscription.plan?.name || (activeSubscription.package as any)?.name || 'Unknown',
        packageType: activeSubscription.type,
        type: 'SUBSCRIPTION',
        hasFormula: !!formula,                              // true si nouveau système SubscriptionFormula
        formulaType: formula?.formulaType ?? 'TIME_WINDOW',
        dayStartHour: (formula?.dayStartHour ?? null) as number | null,
        dayEndHour: (formula?.dayEndHour ?? null) as number | null,
        maxRideDurationHours: formula?.maxRideDurationHours ?? null,
        usedRideMinutes: (activeSubscription as any).usedRideMinutes ?? 0,
      };
    }

    return null;
  }

  private async getOverrideRule(planId: string) {
    return await prisma.planOverride.findFirst({
      where: { planId }
    });
  }

  /**
   * Obtenir les URLs complètes des images d'une demande
   */
  async getRequestImages(requestId: string, type: 'unlock' | 'lock'): Promise<string[]> {
    let request;
    
    if (type === 'unlock') {
      request = await prisma.unlockRequest.findUnique({
        where: { id: requestId }
      });
    } else {
      request = await prisma.lockRequest.findUnique({
        where: { id: requestId }
      });
    }

    if (!request) {
      throw new Error('Demande non trouvée');
    }

    const metadata = request.metadata as any;
    const images: string[] = [];

    if (metadata?.inspectionData?.photos) {
      images.push(...metadata.inspectionData.photos);
    }

    if (metadata?.inspection?.photos) {
      images.push(...metadata.inspection.photos);
    }

    return imageService.getImageUrls(images.filter(img => img && img.trim() !== ''));
  }

  /**
   * Obtenir les demandes en attente (admin)
   */
  async getPendingRequests(type: 'unlock' | 'lock', page: number = 1, limit: number = 20, req?: any) {
    const skip = (page - 1) * limit;

    if (type === 'unlock') {
      const [requests, total] = await Promise.all([
        prisma.unlockRequest.findMany({
          where: { status: RequestStatus.PENDING },
          include: {
            user: { select: { firstName: true, lastName: true } },
            bike: { select: { code: true, model: true, latitude: true, longitude: true } },
            reservation: { select: { id: true, startDate: true, endDate: true, status: true, packageType: true } }
          },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit
        }),
        prisma.unlockRequest.count({ where: { status: RequestStatus.PENDING } })
      ]);

      const processedRequests = requests.map(request => ({
        ...request,
        metadata: this.prepareMetadataForResponse(request.metadata, req)
      }));

      return { requests: processedRequests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    } else {
      const [requests, total] = await Promise.all([
        prisma.lockRequest.findMany({
          where: { status: RequestStatus.PENDING },
          include: {
            user: { select: { firstName: true, lastName: true } },
            bike: { select: { code: true, model: true } },
            ride: { select: { id: true, startTime: true, endTime: true, cost: true, duration: true } }
          },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit
        }),
        prisma.lockRequest.count({ where: { status: RequestStatus.PENDING } })
      ]);

      const processedRequests = requests.map(request => ({
        ...request,
        metadata: this.prepareMetadataForResponse(request.metadata, req)
      }));

      return { requests: processedRequests, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
  }

  private async notifyAdmins(type: 'unlock' | 'lock', request: any) {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        isActive: true
      }
    });

    for (const admin of admins) {
      await this.notificationService.createNotification({
        userId: admin.id,
        title: `Demande de ${type === 'unlock' ? 'déverrouillage' : 'verrouillage'}`,
        message: `${request.user.firstName} ${request.user.lastName} demande ${type === 'unlock' ? 'à déverrouiller' : 'à verrouiller'} le vélo ${request.bike.code}`,
        type: type === 'unlock' ? 'UNLOCK_REQUEST' : 'LOCK_REQUEST'
      });
    }
  }

  private async getRequiredDeposit(): Promise<number> {
    const setting = await prisma.settings.findUnique({
      where: { key: 'required_deposit' }
    });
    return setting ? parseFloat(setting.value) : 20000;
  }

  /**
   * Préparer les métadonnées pour la réponse (convertir les chemins en URLs)
   */
  private prepareMetadataForResponse(metadata: any, req?: any): any {
    if (!metadata) return metadata;
    
    const result = { ...metadata };
    
    // Traiter inspection.photos
    if (result.inspection?.photos) {
      result.inspection.photos = imageService.getImageUrls(result.inspection.photos, req);
    }
    
    // Traiter inspectionData.photos
    if (result.inspectionData?.photos) {
      result.inspectionData.photos = imageService.getImageUrls(result.inspectionData.photos, req);
    }
    
    return result;
  }
}

export default new BikeRequestService();