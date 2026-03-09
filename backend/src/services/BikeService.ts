import { prisma } from '../config/prisma';
import { BikeStatus, Bike } from '@prisma/client';
import { randomUUID } from 'crypto';
import GpsService from './GpsService';
//import GooglePlacesService from './GooglePlacesService';
import OpenStreetMapService from './OpenStreetMapService';
import { AppError } from '../middleware/errorHandler';
import { t } from '../locales';
import PricingTierService from './PricingTierService';

export interface CreateBikeDto {
  code: string;
  model: string;
  status?: BikeStatus;
  isActive?: boolean;
  batteryLevel?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  gpsDeviceId?: string;
  equipment?: string[];
  pricingPlanId?: string;
}

export interface UpdateBikeDto {
  code?: string;
  model?: string;
  status?: BikeStatus;
  isActive?: boolean;
  batteryLevel?: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  maintenanceReason?: string;
  maintenanceDetails?: string;
  gpsDeviceId?: string;
  equipment?: string[];
  pricingPlanId?: string;
}

export interface BikeFilter {
  status?: BikeStatus;
  minBatteryLevel?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  isActive?: boolean;
  hasPricingPlan?: boolean;
  syncGps?: boolean;
}

// Interface pour les zones/quartiers
export interface Area {
  key: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  country?: string;
  region?: string;
}

// Type étendu pour les vélos avec distance
export interface BikeWithDistance extends Bike {
  distance?: number | null;
}

export class BikeService {
  private gpsService: GpsService;
  //private placesService: GooglePlacesService;
  private osmService = OpenStreetMapService;

  constructor() {
    // Configuration GPS à récupérer depuis les variables d'environnement
    this.gpsService = new GpsService({
      baseUrl: process.env.GPS_API_URL || 'http://www.gpspos.net',
      username: process.env.GPS_USERNAME || '',
      password: process.env.GPS_PASSWORD || ''
    });

    /*this.placesService = new GooglePlacesService(
      process.env.GOOGLE_PLACES_API_KEY || ''
    );*/
  }

  /**
   * Create a new bike
   */
  async createBike(data: CreateBikeDto): Promise<Bike> {
    // Generate QR code
    const qrCode = `ECOMOBILE-${data.code}-${randomUUID()}`;

    const bike = await prisma.bike.create({
      data: {
        code: data.code,
        model: data.model,
        status: data.status || BikeStatus.AVAILABLE,
        isActive: data.isActive ?? true, // Ensure isActive is true by default
        batteryLevel: data.batteryLevel || 100,
        latitude: data.latitude,
        longitude: data.longitude,
        locationName: data.locationName,
        gpsDeviceId: data.gpsDeviceId,
        equipment: data.equipment,
        pricingPlanId: data.pricingPlanId || null,
        qrCode
      }
    });

    return bike;
  }

  /**
   * Get bike by ID
   */
  async getBikeById(id: string): Promise<any | null> {
    const bike = await prisma.bike.findUnique({
      where: { id },
      include: {
        maintenanceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        pricingPlan: {
          include: {
            pricingConfig: true,
            promotions: {
              where: {
                promotion: {
                  isActive: true,
                  startDate: { lte: new Date() },
                  endDate: { gte: new Date() }
                }
              },
              include: {
                promotion: true
              }
            }
          }
        }
      }
    });

    if (!bike) return null;

    // Synchroniser avec GPS
    const syncedBike = await this.syncBikeWithGps(bike);
    
    // Ajouter les informations de pricing
    const currentPricing = await this.calculateCurrentPricing(syncedBike);
    
    return {
      ...syncedBike,
      currentPricing
    };
  }

  /**
   * Get bike by code or QR code
   */
  async getBikeByCode(code: string): Promise<any | null> {
    const bike = await prisma.bike.findFirst({
      where: {
        OR: [
          { code },
          { qrCode: code }
        ]
      },
      include: {
        pricingPlan: {
          include: {
            pricingConfig: true,
            promotions: {
              where: {
                promotion: {
                  isActive: true,
                  startDate: { lte: new Date() },
                  endDate: { gte: new Date() }
                }
              },
              include: {
                promotion: true
              }
            }
          }
        }
      }
    });

    if (!bike) return null;

    // Synchroniser avec GPS
    const syncedBike = await this.syncBikeWithGps(bike);
    
    // Ajouter les informations de pricing
    const currentPricing = await this.calculateCurrentPricing(syncedBike);
    
    return {
      ...syncedBike,
      currentPricing
    };
  }

  /**
   * Get bike with current pricing
   */
  async getBikeWithPricing(id: string): Promise<any> {
    const bike = await prisma.bike.findUnique({
      where: { id },
      include: {
        pricingPlan: {
          include: {
            pricingConfig: true,
            promotions: {
              where: {
                promotion: {
                  isActive: true,
                  startDate: { lte: new Date() },
                  endDate: { gte: new Date() }
                }
              },
              include: {
                promotion: true
              }
            }
          }
        }
      }
    });

    if (!bike || !bike.pricingPlan) {
      return null; // Vélo non trouvé ou pas de plan tarifaire
    }

    // Calculer le prix actuel avec règles et promotions
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay();

    // Trouver les règles applicables
    const rules = await prisma.pricingRule.findMany({
      where: {
        pricingConfigId: bike.pricingPlan.pricingConfigId || '',
        isActive: true,
        OR: [
          { dayOfWeek: null },
          { dayOfWeek: dayOfWeek }
        ]
      },
      orderBy: { priority: 'desc' }
    });

    const applicableRule = rules.find(rule => {
      if (rule.startHour !== null && rule.endHour !== null) {
        if (rule.startHour <= rule.endHour) {
          return currentHour >= rule.startHour && currentHour < rule.endHour;
        } else {
          return currentHour >= rule.startHour || currentHour < rule.endHour;
        }
      }
      return true;
    });

    const multiplier = applicableRule?.multiplier || 1;
    let finalHourlyRate = Math.round(bike.pricingPlan.hourlyRate * multiplier);

    // Appliquer les promotions
    const activePromotions = bike.pricingPlan.promotions
      .map(pp => pp.promotion)
      .filter(p => p.isActive);

    let appliedPromotions: any[] = [];
    
    activePromotions.forEach(promotion => {
      if (promotion.usageLimit === null || promotion.usageCount < promotion.usageLimit) {
        if (promotion.discountType === 'PERCENTAGE') {
          const discountAmount = promotion.discountValue / 100;
          finalHourlyRate = Math.round(finalHourlyRate * (1 - discountAmount));
        } else {
          finalHourlyRate = Math.max(0, finalHourlyRate - promotion.discountValue);
        }
        appliedPromotions.push(promotion);
      }
    });

    return {
      ...bike,
      currentPricing: {
        hourlyRate: finalHourlyRate,
        originalHourlyRate: bike.pricingPlan.hourlyRate,
        unlockFee: bike.pricingPlan.pricingConfig?.unlockFee || 0,
        appliedRule: applicableRule,
        appliedPromotions,
        pricingPlan: bike.pricingPlan
      }
    };
  }

  /**
   * Get avaible bikes
   */
  async getAvailableBikes(filter?: BikeFilter, page: number = 1, limit: number = 20) {
    const where: any = {
      status: BikeStatus.AVAILABLE,
      isActive: true
    };

    // Exclure les vélos réservés
    const reservedBikeIds = await prisma.reservation.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: new Date(Date.now() + 15 * 60 * 1000) },
        endDate: { gte: new Date() }
      },
      select: { bikeId: true }
    });

    if (reservedBikeIds.length > 0) {
      where.id = { notIn: reservedBikeIds.map(r => r.bikeId) };
    }

    if (filter?.minBatteryLevel !== undefined) {
      where.batteryLevel = { gte: filter.minBatteryLevel };
    }
    
    const skip = (page - 1) * limit;

    try {
      const [bikes, total] = await Promise.all([
        prisma.bike.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            pricingPlan: {
              include: {
                pricingConfig: true,
                promotions: {
                  where: {
                    promotion: {
                      isActive: true,
                      startDate: { lte: new Date() },
                      endDate: { gte: new Date() }
                    }
                  },
                  include: {
                    promotion: true
                  }
                }
              }
            }
          }
        }),
        prisma.bike.count({ where })
      ]);

      const bikesWithPricing = await Promise.all(
        bikes.map(async (bike) => {
          const currentPricing = await this.calculateCurrentPricing(bike);
          return {
            ...bike,
            currentPricing,
            isGpsEnabled: !!bike.gpsDeviceId,
            isOnline: false
          };
        })
      );

      // Calculer les distances si coordonnées de référence fournies
      let finalBikes = bikesWithPricing.map(bike => {
        let distance: number | null = null;
        
        if (filter?.latitude && filter?.longitude && bike.latitude && bike.longitude) {
          distance = this.calculateDistance(filter.latitude, filter.longitude, bike.latitude, bike.longitude);
        }
        
        return {
          ...bike,
          distance
        };
      });

      // Filtrer par rayon si spécifié
      if (filter?.radiusKm && filter?.latitude && filter?.longitude) {
        finalBikes = finalBikes.filter(bike => 
          typeof bike.distance === 'number' && bike.distance <= filter.radiusKm!
        );
      }

      // Trier par distance si disponible
      if (filter?.latitude && filter?.longitude) {
        finalBikes.sort((a, b) => {
          const distanceA = a.distance ?? Number.POSITIVE_INFINITY;
          const distanceB = b.distance ?? Number.POSITIVE_INFINITY;
          return distanceA - distanceB;
        });
      }

      return {
        bikes: finalBikes,
        pagination: {
          page: page,
          limit: limit,
          total: filter?.radiusKm ? finalBikes.length : total,
          totalPages: Math.ceil((filter?.radiusKm ? finalBikes.length : total) / limit)
        }
      };
    } catch (error) {
      console.error('BikeService.getAvailableBikesLight error:', error);
      throw error;
    }
  }

  /**
   * Get all bikes with filters
   */
  async getAllBikes(filter?: BikeFilter & { isActive?: boolean; hasPricingPlan?: boolean }, page: number = 1, limit: number = 20) {
    const where: any = {};

    // Filtrage selon le contexte (admin vs public)
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.hasPricingPlan) {
      where.pricingPlanId = { not: null };
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const reservedBikeIds = await prisma.reservation.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          // Bloquer le vélo 15 minutes avant
          {
            startDate: { lte: new Date(Date.now() + 15 * 60 * 1000) },
            endDate: { gte: new Date() }
          },
          // Bloquer le vélo un jourb avant
          /*{
            startDate: { lte: tomorrow },
            endDate: { gte: new Date() }
          },*/
          // Bloquer le vélo pendant un mois
          /*{
            packageType: 'monthly',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() }
          }*/
        ]
      },
      select: { bikeId: true }
    });

    if (reservedBikeIds.length > 0) {
      where.id = { notIn: reservedBikeIds.map(r => r.bikeId) };
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.minBatteryLevel !== undefined) {
      where.batteryLevel = { gte: filter.minBatteryLevel };
    }
    
    const skip = (page - 1) * limit;

    try {
      const [bikes, total] = await Promise.all([
        prisma.bike.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            pricingPlan: {
              include: {
                pricingConfig: true,
                promotions: {
                  where: {
                    promotion: {
                      isActive: true,
                      startDate: { lte: new Date() },
                      endDate: { gte: new Date() }
                    }
                  },
                  include: {
                    promotion: true
                  }
                }
              }
            },
            rides: {
              where: {
                status: 'IN_PROGRESS'
              },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              },
              take: 1
            }
          }
        }),
        prisma.bike.count({ where })
      ]);

      // Synchroniser avec GPS seulement les vélos avec gpsDeviceId
      const syncedBikes = await Promise.all(
        bikes.map(async (bike) => {
          if (bike.gpsDeviceId) {
            try {
              return await this.syncBikeWithGps(bike);
            } catch (error) {
              console.warn(`Failed to sync GPS for bike ${bike.id}:`, error);
              return bike;
            }
          }
          return bike;
        })
      );

      // Ajouter le pricing et les métadonnées
      const bikesWithEnhancements = await Promise.all(
        syncedBikes.map(async (syncedBike, index) => {
          const originalBike = bikes[index] as any;
          const currentPricing = await this.calculateCurrentPricing(syncedBike);
          const currentUser = originalBike.rides && originalBike.rides.length > 0 ? {
            id: originalBike.rides[0].user.id,
            firstName: originalBike.rides[0].user.firstName,
            lastName: originalBike.rides[0].user.lastName,
            email: originalBike.rides[0].user.email
          } : null;
          return {
            ...syncedBike,
            currentPricing,
            currentUser,
            isGpsEnabled: !!syncedBike.gpsDeviceId,
            isOnline: syncedBike.gpsDeviceId ? await this.isDeviceOnline(syncedBike.gpsDeviceId) : false
          };
        })
      );

      // Définir le type étendu avec distance
      type BikeWithDistance = typeof bikesWithEnhancements[0] & { distance?: number | null };
      
      // Calculer les distances si coordonnées de référence fournies
      let finalBikes: BikeWithDistance[] = bikesWithEnhancements.map(bike => {
        let distance: number | null = null;
        
        if (filter?.latitude && filter?.longitude && bike.latitude && bike.longitude) {
          distance = this.calculateDistance(filter.latitude, filter.longitude, bike.latitude, bike.longitude);
        }
        
        return {
          ...bike,
          distance
        };
      });

      // Filtrer par rayon si spécifié
      if (filter?.radiusKm && filter?.latitude && filter?.longitude) {
        finalBikes = finalBikes.filter(bike => 
          typeof bike.distance === 'number' && bike.distance <= filter.radiusKm!
        );
      }

      // Trier par distance si disponible
      if (filter?.latitude && filter?.longitude) {
        finalBikes.sort((a, b) => {
          const distanceA = a.distance ?? Number.POSITIVE_INFINITY;
          const distanceB = b.distance ?? Number.POSITIVE_INFINITY;
          return distanceA - distanceB;
        });
      }

      return {
        bikes: finalBikes,
        pagination: {
          page: page,
          limit: limit,
          total: filter?.radiusKm ? finalBikes.length : total,
          totalPages: Math.ceil((filter?.radiusKm ? finalBikes.length : total) / limit)
        }
      };
    } catch (error) {
      console.error('BikeService.getAllBikes error:', error);
      throw error;
    }
  }

  /**
   * Get nearby bikes (within radius)
   */
  async getNearbyBikes(latitude: number, longitude: number, radiusKm: number = 2) {
    const result = await this.getAvailableBikes({
      latitude,
      longitude,
      radiusKm
    }, 1, 50);

    return result.bikes.filter(bike => bike.distance !== null && bike.distance <= radiusKm);
  }

  /**
   * Update bike
   */
  async updateBike(id: string, data: UpdateBikeDto): Promise<Bike> {
    const bike = await prisma.bike.findUnique({ where: { id } });
    if (!bike) {
      throw new AppError(t('error.bike.not_found', 'fr'), 404);
    }

    // Vérifier si le code ou gpsDeviceId existe déjà sur un autre vélo
    if (data.code && data.code !== bike.code) {
      const existingBike = await prisma.bike.findFirst({ where: { code: data.code } });
      if (existingBike && existingBike.id !== id) {
        throw new AppError(t('error.bike.code_exists', 'fr'), 400);
      }
    }
    if (data.gpsDeviceId && data.gpsDeviceId !== bike.gpsDeviceId) {
      const existingBike = await prisma.bike.findFirst({ where: { gpsDeviceId: data.gpsDeviceId } });
      if (existingBike && existingBike.id !== id) {
        throw new AppError(t('error.bike.gps_device_exists', 'fr'), 400);
      }
    }

    // Exclure maintenanceReason et maintenanceDetails car ils n'existent pas dans le modèle Bike
    const { maintenanceReason, maintenanceDetails, ...updateData } = data;

    // Mettre à jour le vélo
    const updatedBike = await prisma.bike.update({
      where: { id },
      data: updateData
    });

    // Si le statut passe à MAINTENANCE et qu'une raison est fournie, créer un log de maintenance
    if (data.status === BikeStatus.MAINTENANCE && bike.status !== BikeStatus.MAINTENANCE) {
      if (maintenanceReason || maintenanceDetails) {
        await prisma.maintenanceLog.create({
          data: {
            bikeId: id,
            type: 'MAINTENANCE_REQUESTED',
            description: maintenanceReason || maintenanceDetails || 'Maintenance demandée'
          }
        });
      }
    }

    return updatedBike;
  }

  /**
   * Update bike location
   */
  async updateBikeLocation(id: string, latitude: number, longitude: number): Promise<Bike> {
    return await prisma.bike.update({
      where: { id },
      data: { latitude, longitude }
    });
  }

  /**
   * Update bike status
   */
  async updateBikeStatus(id: string, status: BikeStatus): Promise<Bike> {
    return await prisma.bike.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * Update bike battery
   */
  async updateBikeBattery(id: string, batteryLevel: number): Promise<Bike> {
    return await prisma.bike.update({
      where: { id },
      data: { batteryLevel }
    });
  }

  /**
   * Delete bike
   */
  async deleteBike(id: string): Promise<void> {
    await prisma.bike.delete({
      where: { id }
    });
  }

  /**
   * Lock bike (set to available)
   */
  async lockBike(id: string): Promise<Bike> {
    const bike = await this.getBikeById(id);
    
    if (!bike) {
      throw new Error('Bike not found');
    }

    // Mettre à jour la position finale via GPS si le vélo a un code GPS
    if (bike.gpsDeviceId) {
      try {
        const lastPosition = await this.gpsService.getLastPosition(bike.gpsDeviceId);
        if (lastPosition) {
          await this.updateBikeLocation(id, lastPosition.dbLat, lastPosition.dbLon);
          await this.updateBikeBattery(id, this.gpsService.parseBatteryLevel(lastPosition.nFuel));
        }
      } catch (error) {
        console.warn(`Failed to update GPS data for bike ${id}:`, error);
      }
    }

    return await this.updateBikeStatus(id, BikeStatus.AVAILABLE);
  }

  /**
   * Unlock bike (set to in use)
   */
  async unlockBike(id: string): Promise<Bike> {
    const bike = await this.getBikeById(id);
    
    if (!bike) {
      throw new Error('Bike not found');
    }

    if (bike.status !== BikeStatus.AVAILABLE) {
      throw new Error('Bike is not available');
    }

    // Synchroniser avec GPS avant de déverrouiller
    if (bike.gpsDeviceId) {
      try {
        const lastPosition = await this.gpsService.getLastPosition(bike.gpsDeviceId);
        if (lastPosition) {
          await this.updateBikeLocation(id, lastPosition.dbLat, lastPosition.dbLon);
          await this.updateBikeBattery(id, this.gpsService.parseBatteryLevel(lastPosition.nFuel));
        }
      } catch (error) {
        console.warn(`Failed to sync GPS data for bike ${id}:`, error);
      }
    }

    return await this.updateBikeStatus(id, BikeStatus.IN_USE);
  }

  /**
   * Add maintenance log
   */
  async addMaintenanceLog(bikeId: string, data: {
    type: string;
    description: string;
    cost?: number;
    performedBy?: string;
  }) {
    return await prisma.maintenanceLog.create({
      data: {
        bikeId,
        ...data
      }
    });
  }

  /**
   * Get maintenance history
   */
  async getMaintenanceHistory(bikeId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.maintenanceLog.findMany({
        where: { bikeId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.maintenanceLog.count({
        where: { bikeId }
      })
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get bike statistics
   */
  async getBikeStats(bikeId: string) {
    const [bike, ridesCount, totalDistance, totalRevenue] = await Promise.all([
      prisma.bike.findUnique({ where: { id: bikeId } }),
      prisma.ride.count({
        where: { bikeId, status: 'COMPLETED' }
      }),
      prisma.ride.aggregate({
        where: { bikeId, status: 'COMPLETED' },
        _sum: { distance: true }
      }),
      prisma.ride.aggregate({
        where: { bikeId, status: 'COMPLETED' },
        _sum: { cost: true }
      })
    ]);

    return {
      bike,
      totalRides: ridesCount,
      totalDistance: totalDistance._sum.distance || 0,
      totalRevenue: totalRevenue._sum.cost || 0
    };
  }

  /**
   * Mettre un vélo en mode maintenance
   */
  async setMaintenanceMode(bikeId: string, reason: string): Promise<Bike> {
    const bike = await prisma.bike.update({
      where: { id: bikeId },
      data: { 
        status: BikeStatus.MAINTENANCE,
        updatedAt: new Date()
      }
    });

    // Créer un log de maintenance
    await prisma.maintenanceLog.create({
      data: {
        bikeId,
        type: 'SECURITY_MAINTENANCE',
        description: reason,
        performedBy: 'SYSTEM'
      }
    });

    return bike;
  }

  /**
   * Sortir un vélo du mode maintenance (admin seulement)
   */
  async removeMaintenanceMode(bikeId: string, adminId: string, note?: string): Promise<Bike> {
    const bike = await prisma.bike.update({
      where: { id: bikeId },
      data: { 
        status: BikeStatus.AVAILABLE,
        lastMaintenanceAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Créer un log de fin de maintenance
    await prisma.maintenanceLog.create({
      data: {
        bikeId,
        type: 'MAINTENANCE_COMPLETED',
        description: note || 'Vélo remis en service',
        performedBy: adminId
      }
    });

    return bike;
  }

  /**
   * Obtenir le vélo réservé par un utilisateur
   */
  async getUserReservedBike(userId: string): Promise<any | null> {
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        bike: true,
        plan: true
      }
    });

    return activeReservation?.bike || null;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
 * Synchroniser un vélo avec les données GPS
 */
  private async syncBikeWithGps(bike: Bike): Promise<Bike> {
    if (!bike.gpsDeviceId) return bike;

    try {
      const lastPosition = await this.gpsService.getLastPosition(bike.gpsDeviceId);
      
      if (lastPosition) {
        const newBatteryLevel = this.gpsService.parseBatteryLevel(lastPosition.nFuel);
        const gpsSignal = this.gpsService.parseGpsSignal(lastPosition.nGPSSignal);
        const gsmSignal = this.gpsService.parseGsmSignal(lastPosition.nGSMSignal);
        const speed = lastPosition.nSpeed;
        
        const needsUpdate = 
          bike.latitude !== lastPosition.dbLat ||
          bike.longitude !== lastPosition.dbLon ||
          bike.batteryLevel !== newBatteryLevel;

        if (needsUpdate) {
          const updatedBike = await prisma.bike.update({
            where: { id: bike.id },
            data: {
              latitude: lastPosition.dbLat,
              longitude: lastPosition.dbLon,
              batteryLevel: newBatteryLevel,
              updatedAt: new Date()
            }
          });
          
          return {
            ...updatedBike,
            gpsSignal,
            gsmSignal,
            speed,
            lastGpsUpdate: this.gpsService.convertUtcToLocalTime(lastPosition.nTime)
          } as Bike;
        }
        
        return {
          ...bike,
          gpsSignal,
          gsmSignal,
          speed,
          lastGpsUpdate: this.gpsService.convertUtcToLocalTime(lastPosition.nTime)
        } as Bike;
      }
    } catch (error) {
      console.warn(`Failed to sync GPS data for bike ${bike.id} (device ${bike.gpsDeviceId}):`, error);
    }

    return bike;
  }

  /**
   * Forcer la synchronisation de tous les vélos avec GPS et retourner les résultats
   */
  async syncAllBikesWithGps(): Promise<{
    synced: number;
    failed: number;
    bikes: any[];
  }> {
    const bikes = await prisma.bike.findMany({
      where: {
        gpsDeviceId: { not: null }
      }
    });

    const results = [];
    let synced = 0;
    let failed = 0;

    for (const bike of bikes) {
      try {
        const lastPosition = await this.gpsService.getLastPosition(bike.gpsDeviceId!);
        
        if (lastPosition) {
          const newBatteryLevel = this.gpsService.parseBatteryLevel(lastPosition.nFuel);
          const gpsSignal = this.gpsService.parseGpsSignal(lastPosition.nGPSSignal);
          const gsmSignal = this.gpsService.parseGsmSignal(lastPosition.nGSMSignal);
          
          let locationName = bike.locationName;
          try {
            if (lastPosition.dbLat && lastPosition.dbLon) {
              locationName = await this.osmService.reverseGeocode(lastPosition.dbLat, lastPosition.dbLon);
            }
          } catch (geoError) {
            locationName = `${lastPosition.dbLat.toFixed(4)}, ${lastPosition.dbLon.toFixed(4)}`;
          }
          
          const updatedBike = await prisma.bike.update({
            where: { id: bike.id },
            data: {
              latitude: lastPosition.dbLat,
              longitude: lastPosition.dbLon,
              batteryLevel: newBatteryLevel,
              locationName: locationName,
              updatedAt: new Date()
            }
          });

          const isOnline = await this.isDeviceOnline(bike.gpsDeviceId!);
          
          results.push({
            ...updatedBike,
            gpsSignal,
            gsmSignal,
            speed: lastPosition.nSpeed,
            direction: lastPosition.nDirection,
            isOnline,
            lastGpsUpdate: this.gpsService.convertUtcToLocalTime(lastPosition.nTime),
            deviceStatus: this.gpsService.parseDeviceStatus(lastPosition.nTEState),
            mileage: lastPosition.nMileage,
            temperature: lastPosition.nTemp,
            syncStatus: 'success'
          });
          
          synced++;
        } else {
          results.push({
            ...bike,
            isOnline: false,
            syncStatus: 'no_data',
            syncMessage: 'Device offline or no GPS data available'
          });
        }
      } catch (error) {
        results.push({
          ...bike,
          isOnline: false,
          syncStatus: 'failed',
          syncError: error instanceof Error ? error.message : 'Unknown GPS sync error'
        });
        failed++;
      }
    }

    return {
      synced,
      failed,
      bikes: results
    };
  }

  /**
   * Obtenir les positions en temps réel de tous les vélos GPS avec gestion d'erreur robuste
   */
  async getRealtimePositions(): Promise<any[]> {
    try {
      const bikes = await prisma.bike.findMany({
        where: {
          gpsDeviceId: { not: null }
        },
        include: {
          pricingPlan: true
        }
      });

      const positions = [];

      for (const bike of bikes) {
        try {
          const lastPosition = await this.gpsService.getLastPosition(bike.gpsDeviceId!);
          // Utiliser la position déjà récupérée pour éviter les appels redondants
          const isOnline = lastPosition ? await this.isDeviceOnline(bike.gpsDeviceId!, lastPosition) : false;
          
          if (lastPosition) {
            let locationName = bike.locationName;
            try {
              locationName = await this.osmService.reverseGeocode(lastPosition.dbLat, lastPosition.dbLon);
            } catch (geoError) {
              locationName = `${lastPosition.dbLat.toFixed(4)}, ${lastPosition.dbLon.toFixed(4)}`;
            }

            await prisma.bike.update({
              where: { id: bike.id },
              data: {
                latitude: lastPosition.dbLat,
                longitude: lastPosition.dbLon,
                batteryLevel: this.gpsService.parseBatteryLevel(lastPosition.nFuel),
                locationName: locationName,
                updatedAt: new Date()
              }
            });

            positions.push({
              id: bike.id,
              code: bike.code,
              model: bike.model,
              status: bike.status,
              isActive: bike.isActive || true,
              gpsDeviceId: bike.gpsDeviceId,
              latitude: lastPosition.dbLat,
              longitude: lastPosition.dbLon,
              batteryLevel: this.gpsService.parseBatteryLevel(lastPosition.nFuel),
              gpsSignal: this.gpsService.parseGpsSignal(lastPosition.nGPSSignal),
              gsmSignal: this.gpsService.parseGsmSignal(lastPosition.nGSMSignal),
              speed: lastPosition.nSpeed,
              direction: lastPosition.nDirection,
              isOnline,
              lastGpsUpdate: this.gpsService.convertUtcToLocalTime(lastPosition.nTime),
              locationName: locationName,
              equipment: bike.equipment,
              pricingPlan: bike.pricingPlan,
              deviceStatus: this.gpsService.parseDeviceStatus(lastPosition.nTEState),
              carState: this.gpsService.parseCarState(lastPosition.nCarState),
              alarmState: lastPosition.nAlarmState,
              mileage: lastPosition.nMileage,
              temperature: lastPosition.nTemp,
              syncStatus: 'success'
            });
          } else {
            positions.push({
              id: bike.id,
              code: bike.code,
              model: bike.model,
              status: bike.status,
              isActive: bike.isActive || true,
              gpsDeviceId: bike.gpsDeviceId,
              latitude: bike.latitude,
              longitude: bike.longitude,
              batteryLevel: bike.batteryLevel || 0,
              gpsSignal: 0,
              gsmSignal: 0,
              speed: 0,
              direction: 0,
              isOnline: false,
              lastGpsUpdate: null,
              locationName: bike.locationName || 'Location inconnue',
              equipment: bike.equipment,
              pricingPlan: bike.pricingPlan,
              deviceStatus: 'offline',
              syncMessage: 'No GPS data available - Device may be offline',
              syncStatus: 'no_data'
            });
          }
        } catch (error) {
          positions.push({
            id: bike.id,
            code: bike.code,
            model: bike.model,
            status: bike.status,
            isActive: bike.isActive || true,
            gpsDeviceId: bike.gpsDeviceId,
            latitude: bike.latitude,
            longitude: bike.longitude,
            batteryLevel: bike.batteryLevel || 0,
            gpsSignal: 0,
            gsmSignal: 0,
            speed: 0,
            direction: 0,
            isOnline: false,
            lastGpsUpdate: null,
            locationName: bike.locationName || 'Erreur GPS',
            equipment: bike.equipment,
            pricingPlan: bike.pricingPlan,
            deviceStatus: 'error',
            syncError: error instanceof Error ? error.message : 'GPS communication failed',
            syncStatus: 'failed'
          });
        }
      }

      return positions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Rechercher des zones/quartiers via Google Places
   */
  async searchAreas(query: string, _country: string = 'CM'): Promise<Area[]> {
    try {
      const areas = await this.osmService.searchPlaces(query);
      return areas.map(area => ({
        key: area.key,
        name: area.name,
        location: area.location,
        country: area.country,
        region: area.city
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtenir les zones par défaut (Cameroun)
   */
  async getDefaultAreas(): Promise<Area[]> {
    const areas = this.osmService.getDefaultCameroonAreas();
    return areas.map(area => ({
      key: area.key,
      name: area.name,
      location: area.location,
      country: area.country,
      region: area.city
    }));
  }

  /**
   * Géocoding inversé pour obtenir une adresse
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      return await this.osmService.reverseGeocode(latitude, longitude);
    } catch (error) {
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  }

  /**
   * Obtenir l'historique de trajet GPS d'un vélo
   */
  async getBikeTrack(bikeId: string, startTime: Date, endTime: Date): Promise<any[]> {
    const bike = await this.getBikeById(bikeId);
    
    if (!bike || !bike.code) {
      throw new Error('Bike not found or no GPS code');
    }

    try {
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);
      const endTimeUnix = Math.floor(endTime.getTime() / 1000);
      
      const track = await this.gpsService.getTrack(bike.code, startTimeUnix, endTimeUnix);
      
      return track.map(point => ({
        timestamp: this.gpsService.convertUtcToLocalTime(point.nTime),
        latitude: point.dbLat,
        longitude: point.dbLon,
        speed: point.nSpeed,
        direction: point.nDirection,
        batteryLevel: this.gpsService.parseBatteryLevel(point.nFuel)
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtenir le kilométrage d'un vélo sur une période
   */
  async getBikeMileage(bikeId: string, startTime: Date, endTime: Date): Promise<{
    startMileage: number;
    endMileage: number;
    totalMileage: number;
  } | null> {
    const bike = await this.getBikeById(bikeId);
    
    if (!bike || !bike.code) {
      throw new Error('Bike not found or no GPS code');
    }

    try {
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);
      const endTimeUnix = Math.floor(endTime.getTime() / 1000);
      
      const mileage = await this.gpsService.getMileage(bike.code, startTimeUnix, endTimeUnix);
      
      if (!mileage) return null;

      return {
        startMileage: mileage.nStartMileage,
        endMileage: mileage.nEndMileage,
        totalMileage: mileage.nMileage
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculer le pricing actuel pour un vélo.
   * Utilise le système PricingTier (paliers tarifaires) — aucun prix codé en dur.
   */
  private async calculateCurrentPricing(_bike: any): Promise<any> {
    const [display, pricingConfig] = await Promise.all([
      PricingTierService.getDisplayPrice(),
      prisma.pricingConfig.findFirst({ where: { isActive: true } })
    ]);

    return {
      displayPrice: display.price,
      durationHours: display.durationHours,
      isNight: display.isNight,
      isFallback: display.fallback,
      unlockFee: pricingConfig?.unlockFee ?? 0,
    };
  }

  /**
   * Vérifier si un dispositif GPS est en ligne
   * @param gpsDeviceId - ID du dispositif GPS
   * @param lastPosition - Position déjà récupérée (optionnel, pour éviter les appels redondants)
   */
  private async isDeviceOnline(gpsDeviceId: string, lastPosition?: any): Promise<boolean> {
    try {
      // Utiliser la position fournie si disponible, sinon la récupérer
      const position = lastPosition || await this.gpsService.getLastPosition(gpsDeviceId);
      if (!position) return false;

      const lastUpdate = this.gpsService.convertUtcToLocalTime(position.nTime);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      return lastUpdate > thirtyMinutesAgo;
    } catch (error) {
      return false;
    }
  }
}

export default new BikeService();