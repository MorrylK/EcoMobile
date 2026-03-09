import express from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest, logActivity } from '../middleware/auth';
import { t } from '../locales';
import PricingTierService from '../services/PricingTierService';

export class AdminController {

  /**
   * @swagger
   * /admin/dashboard:
   *   get:
   *     summary: Get dashboard statistics (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard statistics retrieved
   */
  /**
   * OPTIMISATION: Endpoint groupé pour récupérer toutes les données du dashboard en une seule requête
   * Inclut les stats, les courses récentes, les incidents et les positions GPS
   */
  async getDashboardComplete(req: AuthRequest, res: express.Response) {
    try {
      const [
        dashboardStats,
        recentTrips,
        recentIncidents,
        realtimePositions
      ] = await Promise.all([
        // Stats du dashboard (requête groupée)
        Promise.all([
          prisma.user.count(),
          prisma.bike.count(),
          prisma.ride.count(),
          prisma.ride.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.ride.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { cost: true }
          }),
          prisma.user.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              }
            }
          }),
          prisma.ride.count({
            where: {
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          }),
          prisma.bike.groupBy({
            by: ['status'],
            _count: true
          })
        ]),
        // Courses récentes (limitées à 10)
        prisma.ride.findMany({
          where: { status: 'IN_PROGRESS' },
          take: 10,
          orderBy: { startTime: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            bike: {
              select: {
                id: true,
                code: true,
                model: true
              }
            }
          }
        }),
        // Incidents récents (limités à 5)
        prisma.incident.findMany({
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            bike: {
              select: {
                id: true,
                code: true
              }
            }
          }
        }),
        // Positions GPS en temps réel (limitées aux vélos actifs)
        prisma.bike.findMany({
          where: {
            status: { in: ['AVAILABLE', 'IN_USE', 'MAINTENANCE'] }
          },
          select: {
            id: true,
            code: true,
            latitude: true,
            longitude: true,
            status: true,
            batteryLevel: true,
            lastSeenAt: true
          }
        })
      ]);

      const [
        totalUsers,
        totalBikes,
        totalRides,
        activeRides,
        revenueResult,
        recentUsers,
        recentRidesCount,
        bikesByStatus
      ] = dashboardStats;

      const totalRevenue = revenueResult._sum?.cost || 0;

      // Calculer les stats GPS
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const gpsData = {
        total: realtimePositions.length,
        online: realtimePositions.filter(bike => 
          bike.lastSeenAt && new Date(bike.lastSeenAt) > fiveMinutesAgo
        ).length,
        offline: realtimePositions.filter(bike => 
          !bike.lastSeenAt || new Date(bike.lastSeenAt) <= fiveMinutesAgo
        ).length
      };

      await logActivity(
        req.user!.id,
        'VIEW',
        'DASHBOARD',
        '',
        'Viewed complete dashboard',
        { totalUsers, totalBikes, totalRides },
        req
      );

      res.json({
        success: true,
        message: t('admin.dashboard_retrieved', req.language || 'fr'),
        data: {
          stats: {
            totalUsers,
            totalBikes,
            totalRides,
            activeRides,
            totalRevenue,
            recentUsers,
            recentRides: recentRidesCount,
            bikesByStatus
          },
          recentTrips,
          recentIncidents,
          gpsData,
          realtimePositions: realtimePositions.map(bike => ({
            ...bike,
            isOnline: bike.lastSeenAt && new Date(bike.lastSeenAt) > fiveMinutesAgo
          }))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getDashboardStats(req: AuthRequest, res: express.Response) {
    try {
      const [
        totalUsers,
        totalBikes,
        totalRides,
        activeRides,
        totalRevenue,
        recentUsers,
        recentRides,
        bikesByStatus
      ] = await Promise.all([
        // Total users
        prisma.user.count(),
        
        // Total bikes
        prisma.bike.count(),
        
        // Total rides
        prisma.ride.count(),
        
        // Active rides
        prisma.ride.count({
          where: { status: 'IN_PROGRESS' }
        }),
        
        // Total revenue
        prisma.ride.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { cost: true }
        }),
        
        // Recent users (last 7 days)
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        
        // Recent rides (today)
        prisma.ride.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        
        // Bikes by status
        prisma.bike.groupBy({
          by: ['status'],
          _count: true
        })
      ]);

      // Logger l'accès au dashboard
      await logActivity(
        req.user?.id || null,
        'VIEW',
        'DASHBOARD',
        '',
        'Viewed admin dashboard stats',
        null,
        req
      );

      res.json({
        success: true,
        message: t('admin.stats_retrieved', req.language),
        data: {
          users: {
            total: totalUsers,
            recent: recentUsers
          },
          bikes: {
            total: totalBikes,
            byStatus: bikesByStatus.reduce((acc: { [x: string]: any; }, item: { status: string | number; _count: any; }) => {
              acc[item.status] = item._count;
              return acc;
            }, {} as Record<string, number>)
          },
          rides: {
            total: totalRides,
            active: activeRides,
            today: recentRides
          },
          revenue: {
            total: totalRevenue._sum.cost || 0
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/settings:
   *   get:
   *     summary: Get app settings (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Settings retrieved
   */
  async getSettings(req: AuthRequest, res: express.Response) {
    try {
      const settings = await prisma.settings.findMany();
      
      const settingsMap = settings.reduce((acc: { [x: string]: any; }, setting: { key: string | number; value: any; }) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'SETTINGS',
        '',
        'Viewed application settings',
        null,
        req
      );

      res.json({
        success: true,
        data: settingsMap
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/settings:
   *   put:
   *     summary: Update app settings (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties:
   *               type: string
   *     responses:
   *       200:
   *         description: Settings updated
   */
  async updateSettings(req: AuthRequest, res: express.Response) {
    try {
      const settings = req.body;
      const oldSettings = await prisma.settings.findMany();

      for (const [key, value] of Object.entries(settings)) {
        await prisma.settings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'SETTINGS',
        '',
        'Updated application settings',
        { oldSettings, newSettings: settings },
        req
      );

      res.json({
        success: true,
        message: t('admin.settings_updated', req.language)
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/pricing:
   *   get:
   *     summary: Get pricing configuration (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Pricing retrieved
   */
  async getPricing(req: AuthRequest, res: express.Response) {
    try {
      const pricing = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        include: {
          plans: {
            where: { isActive: true },
            orderBy: { name: 'asc' },
            include: {
              overrides: true
            }
          },
          rules: {
            where: { isActive: true },
            orderBy: { priority: 'desc' }
          },
          promotions: {
            where: { isActive: true },
            include: {
              plans: {
                include: {
                  plan: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (pricing?.plans) {
        type TransformedPlan = Omit<typeof pricing.plans[0], 'overrides'> & {
          override: typeof pricing.plans[0]['overrides'][0] | null;
        };

        pricing.plans = pricing.plans.map(plan => {
          const { overrides, ...planData } = plan;
          return {
            ...planData,
            override: overrides && overrides.length > 0 ? overrides[0] : null
          } as TransformedPlan;
        }) as any;
      }

      if (pricing?.promotions) {
        pricing.promotions = pricing.promotions.filter(promotion => 
          promotion.plans.every(pp => pp.plan !== null)
        );
      }

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'PRICING',
        pricing?.id || '',
        'Viewed pricing configuration',
        null,
        req
      );

      res.json({
        success: true,
        data: pricing || {
          unlockFee: 100,
          baseHourlyRate: 200,
          plans: [],
          rules: [],
          promotions: []
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/pricing:
   *   put:
   *     summary: Update pricing configuration (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               unlockFee:
   *                 type: number
   *               baseHourlyRate:
   *                 type: number
   *               plans:
   *                 type: array
   *                 items:
   *                   type: object
   *               rules:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Pricing updated
   */
  async updatePricing(req: AuthRequest, res: express.Response) {
    try {
      const { unlockFee, baseHourlyRate, plans, rules } = req.body;
      
      // Get current pricing config
      let pricingConfig = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        include: { 
          plans: true, 
          rules: true,
          promotions: true
        }
      });

      if (!pricingConfig) {
        // Create new pricing config if none exists
        pricingConfig = await prisma.pricingConfig.create({
          data: {
            unlockFee: unlockFee || 100,
            baseHourlyRate: baseHourlyRate || 200,
            isActive: true
          },
          include: { 
            plans: true, 
            rules: true,
            promotions: true
          }
        });
      } else {
        // Update existing pricing config
        pricingConfig = await prisma.pricingConfig.update({
          where: { id: pricingConfig.id },
          data: {
            unlockFee: unlockFee ?? pricingConfig.unlockFee,
            baseHourlyRate: baseHourlyRate ?? pricingConfig.baseHourlyRate
          },
          include: { 
            plans: true, 
            rules: true,
            promotions: true
          }
        });
      }

      // Update plans if provided
      if (plans && Array.isArray(plans)) {
        // Nettoyer d'abord les relations promotions pour les anciens plans
        const existingPlanIds = await prisma.pricingPlan.findMany({
          where: { pricingConfigId: pricingConfig.id },
          select: { id: true }
        });

        // Supprimer les références promotions pour les plans qui vont être supprimés
        await prisma.promotionPlan.deleteMany({
          where: {
            planId: {
              in: existingPlanIds.map(p => p.id)
            }
          }
        });

        // Delete existing plans
        await prisma.pricingPlan.deleteMany({
          where: { pricingConfigId: pricingConfig.id }
        });

        // Create new plans
        if (plans.length > 0) {
          await prisma.pricingPlan.createMany({
            data: plans.map((plan: any) => ({
              pricingConfigId: pricingConfig.id,
              name: plan.name,
              hourlyRate: plan.hourlyRate,
              dailyRate: plan.dailyRate,
              weeklyRate: plan.weeklyRate,
              monthlyRate: plan.monthlyRate,
              minimumHours: plan.minimumHours || 1,
              discount: plan.discount || 0,
              isActive: plan.isActive ?? true,
              conditions: plan.conditions || {}
            }))
          });
        }
      }

      // Update rules if provided
      if (rules && Array.isArray(rules)) {
        // Delete existing rules
        await prisma.pricingRule.deleteMany({
          where: { pricingConfigId: pricingConfig.id }
        });

        // Create new rules
        if (rules.length > 0) {
          await prisma.pricingRule.createMany({
            data: rules.map((rule: any) => ({
              pricingConfigId: pricingConfig.id,
              name: rule.name,
              dayOfWeek: rule.dayOfWeek,
              startHour: rule.startHour,
              endHour: rule.endHour,
              multiplier: rule.multiplier || 1,
              isActive: rule.isActive ?? true,
              priority: rule.priority || 0
            }))
          });
        }
      }

      // Get updated pricing config
      const updatedPricing = await prisma.pricingConfig.findUnique({
        where: { id: pricingConfig.id },
        include: {
          plans: { where: { isActive: true } },
          rules: { where: { isActive: true } },
          promotions: { 
            where: { isActive: true },
            include: {
              plans: {
                include: {
                  plan: true
                }
              }
            }
          }
        }
      });

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'PRICING',
        pricingConfig.id,
        'Updated pricing configuration with hourly rates',
        { unlockFee, baseHourlyRate, plansCount: plans?.length || 0, rulesCount: rules?.length || 0 },
        req
      );

      res.json({
        success: true,
        message: t('admin.pricing_updated', req.language),
        data: updatedPricing
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/pricing/current:
   *   get:
   *     summary: Get current pricing with applied rules and promotions
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *         description: Target date
   *       - in: query
   *         name: hour
   *         schema:
   *           type: integer
   *           minimum: 0
   *           maximum: 23
   *         description: Target hour
   *     responses:
   *       200:
   *         description: Current pricing retrieved successfully
   */
  async getCurrentPricing(req: AuthRequest, res: express.Response) {
    try {
      const { date, hour } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const targetHour = hour ? parseInt(hour as string) : new Date().getHours();
      const dayOfWeek = targetDate.getDay();

      const pricing = await prisma.pricingConfig.findFirst({
        where: { isActive: true },
        include: {
          plans: { 
            where: { isActive: true },
            include: {
              promotions: {
                include: {
                  promotion: true 
                },
                where: { 
                  promotion: {
                    isActive: true,
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() }
                  }
                }
              }
            }
          },
          rules: { 
            where: { 
              isActive: true,
              OR: [
                { dayOfWeek: null },
                { dayOfWeek: dayOfWeek }
              ]
            },
            orderBy: { priority: 'desc' }
          },
          promotions: {
            where: {
              isActive: true,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() }
            },
            include: {
              plans: {
                include: {
                  plan: true
                }
              }
            }
          }
        }
      });

      if (!pricing) {
        return res.status(404).json({
          success: false,
          message: 'No pricing configuration found'
        });
      }

      // Filtrer les promotions qui ont des plans valides
      if (pricing.promotions) {
        pricing.promotions = pricing.promotions.filter(promotion => 
          promotion.plans.every(pp => pp.plan !== null)
        );
      }

      // Trouver la règle applicable pour cette heure
      const applicableRule = pricing.rules.find(rule => {
        if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) {
          return false;
        }
        
        if (rule.startHour !== null && rule.endHour !== null) {
          if (rule.startHour <= rule.endHour) {
            // Même jour (ex: 9h - 17h)
            return targetHour >= rule.startHour && targetHour < rule.endHour;
          } else {
            // Traverse minuit (ex: 22h - 6h)
            return targetHour >= rule.startHour || targetHour < rule.endHour;
          }
        }
        
        return true;
      });

      const multiplier = applicableRule?.multiplier || 1;
      
      // Appliquer le multiplicateur et les promotions aux plans
      const adjustedPlans = pricing.plans.map(plan => {
        let finalHourlyRate = Math.round(plan.hourlyRate * multiplier);
        let finalDailyRate = Math.round(plan.dailyRate * multiplier);
        let finalWeeklyRate = Math.round(plan.weeklyRate * multiplier);
        let finalMonthlyRate = Math.round(plan.monthlyRate * multiplier);

        // Appliquer les promotions actives
        const activePromotions = plan.promotions
          .filter(pp => pp.promotion.isActive)
          .map(pp => pp.promotion);

        let appliedPromotions: any[] = [];
        
        activePromotions.forEach(promotion => {
          if (promotion.usageLimit === null || promotion.usageCount < promotion.usageLimit) {
            if (promotion.discountType === 'PERCENTAGE') {
              const discountAmount = promotion.discountValue / 100;
              finalHourlyRate = Math.round(finalHourlyRate * (1 - discountAmount));
              finalDailyRate = Math.round(finalDailyRate * (1 - discountAmount));
              finalWeeklyRate = Math.round(finalWeeklyRate * (1 - discountAmount));
              finalMonthlyRate = Math.round(finalMonthlyRate * (1 - discountAmount));
            } else {
              finalHourlyRate = Math.max(0, finalHourlyRate - promotion.discountValue);
              finalDailyRate = Math.max(0, finalDailyRate - promotion.discountValue * 24);
              finalWeeklyRate = Math.max(0, finalWeeklyRate - promotion.discountValue * 24 * 7);
              finalMonthlyRate = Math.max(0, finalMonthlyRate - promotion.discountValue * 24 * 30);
            }
            appliedPromotions.push(promotion);
          }
        });

        return {
          ...plan,
          hourlyRate: finalHourlyRate,
          dailyRate: finalDailyRate,
          weeklyRate: finalWeeklyRate,
          monthlyRate: finalMonthlyRate,
          originalHourlyRate: plan.hourlyRate,
          appliedRule: applicableRule?.name,
          appliedPromotions,
          promotions: undefined
        };
      });

      const nextHour = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), targetHour + 1, 0, 0);

      return res.json({
        success: true,
        data: {
          ...pricing,
          plans: adjustedPlans,
          appliedRule: applicableRule,
          multiplier,
          targetDate: targetDate.toISOString(),
          targetHour,
          nextUpdate: nextHour.toISOString()
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/promotions:
   *   get:
   *     summary: Get all promotions (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Promotions retrieved successfully
   */
  async getPromotions(req: AuthRequest, res: express.Response) {
    try {
      const promotions = await prisma.promotion.findMany({
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'PROMOTIONS',
        '',
        'Viewed promotions list',
        null,
        req
      );

      res.json({
        success: true,
        data: promotions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/promotions:
   *   post:
   *     summary: Create new promotion (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - discountType
   *               - discountValue
   *               - startDate
   *               - endDate
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               discountType:
   *                 type: string
   *                 enum: [PERCENTAGE, FIXED_AMOUNT]
   *               discountValue:
   *                 type: number
   *               startDate:
   *                 type: string
   *                 format: date-time
   *               endDate:
   *                 type: string
   *                 format: date-time
   *               usageLimit:
   *                 type: number
   *               planIds:
   *                 type: array
   *                 items:
   *                   type: string
   *               conditions:
   *                 type: object
   *     responses:
   *       200:
   *         description: Promotion created successfully
   */
  async createPromotion(req: AuthRequest, res: express.Response) {
    try {
      const { 
        name, 
        description, 
        discountType, 
        discountValue, 
        startDate, 
        endDate,
        usageLimit,
        planIds,
        conditions
      } = req.body;

      const pricingConfig = await prisma.pricingConfig.findFirst({
        where: { isActive: true }
      });

      if (!pricingConfig) {
        return res.status(404).json({
          success: false,
          message: 'No active pricing configuration found'
        });
      }

      const promotion = await prisma.promotion.create({
        data: {
          pricingConfigId: pricingConfig.id,
          name,
          description,
          discountType,
          discountValue,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          usageLimit,
          conditions,
          plans: {
            create: planIds?.map((planId: string) => ({
              planId
            })) || []
          }
        },
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        }
      });

      await logActivity(
        req.user?.id || null,
        'CREATE',
        'PROMOTION',
        promotion.id,
        `Created promotion: ${name}`,
        { promotion, planIds },
        req
      );

      return res.json({
        success: true,
        message: 'Promotion created successfully',
        data: promotion
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/promotions/{id}:
   *   put:
   *     summary: Update promotion (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               discountType:
   *                 type: string
   *                 enum: [PERCENTAGE, FIXED_AMOUNT]
   *               discountValue:
   *                 type: number
   *               startDate:
   *                 type: string
   *                 format: date-time
   *               endDate:
   *                 type: string
   *                 format: date-time
   *               usageLimit:
   *                 type: number
   *               planIds:
   *                 type: array
   *                 items:
   *                   type: string
   *               conditions:
   *                 type: object
   *     responses:
   *       200:
   *         description: Promotion updated successfully
   */
  async updatePromotion(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { 
        name, 
        description, 
        discountType, 
        discountValue, 
        startDate, 
        endDate,
        usageLimit,
        planIds,
        conditions
      } = req.body;

      const oldPromotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        }
      });

      if (!oldPromotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion non trouvée'
        });
      }

      // Mettre à jour la promotion
      await prisma.promotion.update({
        where: { id },
        data: {
          name,
          description,
          discountType,
          discountValue,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          usageLimit,
          conditions
        },
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        }
      });

      // Mettre à jour les plans si fournis
      if (planIds && Array.isArray(planIds)) {
        // Supprimer les anciennes relations
        await prisma.promotionPlan.deleteMany({
          where: { promotionId: id }
        });

        // Créer les nouvelles relations
        if (planIds.length > 0) {
          await prisma.promotionPlan.createMany({
            data: planIds.map((planId: string) => ({
              promotionId: id,
              planId
            }))
          });
        }
      }

      const updatedPromotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        }
      });

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'PROMOTION',
        id,
        `Updated promotion: ${name}`,
        { oldPromotion, newPromotion: updatedPromotion },
        req
      );

      return res.json({
        success: true,
        message: 'Promotion mise à jour avec succès',
        data: updatedPromotion
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/promotions/{id}/status:
   *   patch:
   *     summary: Toggle promotion status (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - isActive
   *             properties:
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Promotion status updated
   */
  async togglePromotionStatus(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const oldPromotion = await prisma.promotion.findUnique({
        where: { id }
      });

      if (!oldPromotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion non trouvée'
        });
      }

      const promotion = await prisma.promotion.update({
        where: { id },
        data: { isActive },
        include: {
          plans: {
            include: {
              plan: true
            }
          }
        }
      });

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'PROMOTION_STATUS',
        id,
        `${isActive ? 'Activated' : 'Deactivated'} promotion: ${promotion.name}`,
        { oldStatus: oldPromotion.isActive, newStatus: isActive },
        req
      );

      return res.json({
        success: true,
        message: `Promotion ${isActive ? 'activée' : 'désactivée'} avec succès`,
        data: promotion
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/plans:
   *   post:
   *     summary: Create new pricing plan (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - hourlyRate
   *               - dailyRate
   *               - weeklyRate
   *               - monthlyRate
   *             properties:
   *               name:
   *                 type: string
   *               hourlyRate:
   *                 type: number
   *               dailyRate:
   *                 type: number
   *               weeklyRate:
   *                 type: number
   *               monthlyRate:
   *                 type: number
   *               minimumHours:
   *                 type: number
   *               discount:
   *                 type: number
   *               isActive:
   *                 type: boolean
   *               conditions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Plan created successfully
   */
  async createPlan(req: AuthRequest, res: express.Response) {
    try {
      const { 
        name, 
        hourlyRate, 
        dailyRate, 
        weeklyRate, 
        monthlyRate, 
        minimumHours, 
        discount, 
        isActive, 
        conditions 
      } = req.body;

      if (!name || hourlyRate === undefined || dailyRate === undefined || 
          weeklyRate === undefined || monthlyRate === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires doivent être remplis'
        });
      }

      const pricingConfig = await prisma.pricingConfig.findFirst({
        where: { isActive: true }
      });

      if (!pricingConfig) {
        return res.status(404).json({
          success: false,
          message: 'Aucune configuration de prix active trouvée'
        });
      }

      const plan = await prisma.pricingPlan.create({
        data: {
          pricingConfigId: pricingConfig.id,
          name,
          hourlyRate: parseFloat(hourlyRate),
          dailyRate: parseFloat(dailyRate),
          weeklyRate: parseFloat(weeklyRate),
          monthlyRate: parseFloat(monthlyRate),
          minimumHours: minimumHours || 1,
          discount: discount || 0,
          isActive: isActive !== undefined ? isActive : true,
          conditions: conditions || {}
        }
      });

      await logActivity(
        req.user?.id || null,
        'CREATE',
        'PRICING_PLAN',
        plan.id,
        `Created pricing plan: ${name}`,
        { plan },
        req
      );

      return res.json({
        success: true,
        message: 'Plan créé avec succès',
        data: plan
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/plans/{id}/override:
   *   post:
   *     summary: Create or update plan override (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - overTimeType
   *               - overTimeValue
   *             properties:
   *               overTimeType:
   *                 type: string
   *                 enum: [FIXED_PRICE, PERCENTAGE_REDUCTION]
   *               overTimeValue:
   *                 type: number
   *     responses:
   *       200:
   *         description: Plan override created/updated successfully
   */
  async createOrUpdatePlanOverride(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { 
        overTimeType, 
        overTimeValue,
        hourlyStartHour,
        hourlyEndHour,
        dailyStartHour,
        dailyEndHour,
        weeklyStartHour,
        weeklyEndHour,
        monthlyStartHour,
        monthlyEndHour
      } = req.body;

      if (!overTimeType || overTimeValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Le type et la valeur de l\'override sont obligatoires'
        });
      }

      if (!['FIXED_PRICE', 'PERCENTAGE_REDUCTION'].includes(overTimeType)) {
        return res.status(400).json({
          success: false,
          message: 'Type d\'override invalide. Utilisez "FIXED_PRICE" ou "PERCENTAGE_REDUCTION"'
        });
      }

      const plan = await prisma.pricingPlan.findUnique({
        where: { id },
        include: {
          overrides: true
        }
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan non trouvé'
        });
      }

      const overrideData: any = {
        overTimeType,
        overTimeValue: parseFloat(overTimeValue)
      };

      // Ajouter les plages horaires si fournies
      if (hourlyStartHour !== undefined) overrideData.hourlyStartHour = hourlyStartHour ? parseInt(hourlyStartHour) : null;
      if (hourlyEndHour !== undefined) overrideData.hourlyEndHour = hourlyEndHour ? parseInt(hourlyEndHour) : null;
      if (dailyStartHour !== undefined) overrideData.dailyStartHour = dailyStartHour ? parseInt(dailyStartHour) : null;
      if (dailyEndHour !== undefined) overrideData.dailyEndHour = dailyEndHour ? parseInt(dailyEndHour) : null;
      if (weeklyStartHour !== undefined) overrideData.weeklyStartHour = weeklyStartHour ? parseInt(weeklyStartHour) : null;
      if (weeklyEndHour !== undefined) overrideData.weeklyEndHour = weeklyEndHour ? parseInt(weeklyEndHour) : null;
      if (monthlyStartHour !== undefined) overrideData.monthlyStartHour = monthlyStartHour ? parseInt(monthlyStartHour) : null;
      if (monthlyEndHour !== undefined) overrideData.monthlyEndHour = monthlyEndHour ? parseInt(monthlyEndHour) : null;

      let planOverride;

      if (plan.overrides && plan.overrides.length > 0) {
        planOverride = await prisma.planOverride.update({
          where: { id: plan.overrides[0].id },
          data: overrideData
        });
      } else {
        planOverride = await prisma.planOverride.create({
          data: {
            planId: id,
            ...overrideData
          }
        });
      }

      await logActivity(
        req.user?.id || null,
        plan.overrides && plan.overrides.length > 0 ? 'UPDATE' : 'CREATE',
        'PLAN_OVERRIDE',
        planOverride.id,
        `${plan.overrides && plan.overrides.length > 0 ? 'Updated' : 'Created'} override for plan: ${plan.name}`,
        { 
          planId: id,
          planName: plan.name,
          overTimeType,
          overTimeValue 
        },
        req
      );

      return res.json({
        success: true,
        message: `Override ${plan.overrides && plan.overrides.length > 0 ? 'mis à jour' : 'créé'} avec succès`,
        data: planOverride
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/plans/{id}:
   *   delete:
   *     summary: Delete pricing plan (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Plan deleted successfully
   */
  async deletePlan(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;

      // Vérifier si le plan est lié à des promotions
      const promotionPlan = await prisma.promotionPlan.findFirst({
        where: { planId: id }
      });

      if (promotionPlan) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer ce plan car il est lié à des promotions'
        });
      }

      await prisma.pricingPlan.delete({
        where: { id }
      });

      await logActivity(
        req.user?.id || null,
        'DELETE',
        'PRICING_PLAN',
        id,
        'Deleted pricing plan',
        null,
        req
      );

      return res.json({
        success: true,
        message: 'Plan supprimé avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/rules/{id}:
   *   delete:
   *     summary: Delete pricing rule (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Rule deleted successfully
   */
  async deleteRule(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;

      // Vérifier si la règle est utilisée dans des calculs de prix
      const ruleInUse = await prisma.pricingConfig.findFirst({
        where: { 
          rules: {
            some: { id }
          }
        },
        include: {
          plans: {
            where: {
              OR: [
                { hourlyRate: { gt: 0 } },
                { dailyRate: { gt: 0 } }
              ]
            }
          }
        }
      });

      if (ruleInUse && ruleInUse.plans.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer cette règle car elle est utilisée dans la configuration tarifaire active'
        });
      }

      await prisma.pricingRule.delete({
        where: { id }
      });

      await logActivity(
        req.user?.id || null,
        'DELETE',
        'PRICING_RULE',
        id,
        'Deleted pricing rule',
        null,
        req
      );

      return res.json({
        success: true,
        message: 'Règle supprimée avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/promotions/{id}:
   *   delete:
   *     summary: Delete promotion (Admin only)
   *     tags: [Pricing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Promotion deleted successfully
   */
  async deletePromotion(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;

      // Vérifier si la promotion a été utilisée
      const promotion = await prisma.promotion.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              plans: true,
            }
          }
        }
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion non trouvée'
        });
      }

      if (promotion.usageCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible de supprimer cette promotion car elle a déjà été utilisée'
        });
      }

      // Supprimer d'abord les relations
      await prisma.promotionPlan.deleteMany({
        where: { promotionId: id }
      });

      // Puis supprimer la promotion
      await prisma.promotion.delete({
        where: { id }
      });

      await logActivity(
        req.user?.id || null,
        'DELETE',
        'PROMOTION',
        id,
        'Deleted promotion',
        { promotionName: promotion.name },
        req
      );

      return res.json({
        success: true,
        message: 'Promotion supprimée avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/financial/stats:
   *   get:
   *     summary: Get financial statistics
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [both, revenue, expenses]
   *     responses:
   *       200:
   *         description: Financial statistics retrieved
   */
  async getFinancialStats(req: AuthRequest, res: express.Response) {
    try {
      const { startDate, endDate, type } = req.query;
      
      const dateFilter = {
        createdAt: {
          gte: new Date(startDate as string),
          lte: new Date((endDate as string) + 'T23:59:59.999Z')
        }
      };

      //const [rides, transactions, wallets] = await Promise.all([
      const [rides] = await Promise.all([
        prisma.ride.findMany({
          where: {
            status: 'COMPLETED',
            ...dateFilter
          }
        }),
        prisma.transaction.findMany({
          where: {
            status: 'COMPLETED',
            ...dateFilter
          }
        }),
        prisma.wallet.aggregate({
          _sum: { balance: true }
        })
      ]);

      // Calculer les statistiques par période
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - 1);

      const todayRevenue = rides.filter(r => new Date(r.createdAt) >= todayStart)
        .reduce((sum, r) => sum + (r.cost || 0), 0);
      const weekRevenue = rides.filter(r => new Date(r.createdAt) >= weekStart)
        .reduce((sum, r) => sum + (r.cost || 0), 0);
      const monthRevenue = rides.filter(r => new Date(r.createdAt) >= monthStart)
        .reduce((sum, r) => sum + (r.cost || 0), 0);
      
      const totalRevenue = rides.reduce((sum, r) => sum + (r.cost || 0), 0);
      const avgRevenuePerTrip = rides.length > 0 ? totalRevenue / rides.length : 0;

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'FINANCIAL_STATS',
        '',
        'Viewed financial statistics',
        { startDate, endDate, type },
        req
      );

      res.json({
        success: true,
        data: {
          todayRevenue,
          weekRevenue,
          monthRevenue,
          avgRevenuePerTrip,
          totalTrips: rides.length,
          totalUsers: await prisma.user.count()
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/financial/data:
   *   get:
   *     summary: Get financial chart data
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Financial chart data retrieved
   */
  async getFinancialData(req: AuthRequest, res: express.Response) {
    try {
      const { startDate, endDate, type } = req.query;
      
      // Générer données pour graphiques basées sur les vraies données
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      const shortTermData = [];
      const longTermData = [];

      for (let i = 0; i <= days; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const [dayRides, dayTransactions] = await Promise.all([
          prisma.ride.findMany({
            where: {
              status: 'COMPLETED',
              createdAt: { gte: dayStart, lte: dayEnd }
            }
          }),
          prisma.transaction.findMany({
            where: {
              type: { in: ['WITHDRAWAL', 'REFUND'] },
              status: 'COMPLETED',
              createdAt: { gte: dayStart, lte: dayEnd }
            }
          })
        ]);

        const revenue = dayRides.reduce((sum, r) => sum + (r.cost || 0), 0);
        const expenses = dayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const dataPoint = {
          period: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
          revenue,
          expenses,
          trips: dayRides.length
        };

        shortTermData.push(dataPoint);
        longTermData.push(dataPoint);
      }

      // Répartition des forfaits (données simulées basées sur la base)
      const planDistribution = [
        { name: 'Standard', value: 45, color: '#10b981' },
        { name: 'Heures de Pointe', value: 25, color: '#f59e0b' },
        { name: 'Weekend', value: 20, color: '#3b82f6' },
        { name: 'Étudiant', value: 10, color: '#8b5cf6' }
      ];

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'FINANCIAL_DATA',
        '',
        'Viewed financial chart data',
        { startDate, endDate, type },
        req
      );

      res.json({
        success: true,
        data: {
          shortTerm: shortTermData,
          longTerm: longTermData,
          planDistribution
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/financial/transactions:
   *   get:
   *     summary: Get transaction summary
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Transaction summary retrieved
   */
  async getFinancialTransactions(req: AuthRequest, res: express.Response) {
    try {
      const { startDate, endDate } = req.query;
      
      const dateFilter = {
        createdAt: {
          gte: new Date(startDate as string),
          lte: new Date((endDate as string) + 'T23:59:59.999Z')
        }
      };

      const [topUps, payments, maintenance, refunds, userBalances] = await Promise.all([
        prisma.transaction.aggregate({
          where: { type: 'DEPOSIT', status: 'COMPLETED', ...dateFilter },
          _sum: { amount: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: { type: 'RIDE_PAYMENT', status: 'COMPLETED', ...dateFilter },
          _sum: { amount: true },
          _count: true
        }),
        prisma.maintenanceLog.aggregate({
          where: { createdAt: dateFilter.createdAt },
          _sum: { cost: true },
          _count: true
        }),
        prisma.transaction.aggregate({
          where: { type: 'REFUND', status: 'COMPLETED', ...dateFilter },
          _sum: { amount: true },
          _count: true
        }),
        prisma.wallet.aggregate({
          _sum: { balance: true }
        })
      ]);

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'FINANCIAL_TRANSACTIONS',
        '',
        'Viewed transaction summary',
        { startDate, endDate },
        req
      );

      res.json({
        success: true,
        data: {
          topUps: { total: topUps._sum.amount || 0, count: topUps._count },
          payments: { total: payments._sum.amount || 0, count: payments._count },
          maintenance: { total: maintenance._sum.cost || 0, count: maintenance._count },
          refunds: { total: refunds._sum.amount || 0, count: refunds._count },
          userBalances: userBalances._sum.balance || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/financial/export:
   *   get:
   *     summary: Export financial data
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: format
   *         schema:
   *           type: string
   *           enum: [csv, json]
   *           default: csv
   *     responses:
   *       200:
   *         description: Financial data exported
   */
  async exportFinancialData(req: AuthRequest, res: express.Response) {
    try {
      const { startDate, endDate, type, format = 'csv' } = req.query;
      
      // Récupérer toutes les données pour export
      const rides = await prisma.ride.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date((endDate as string) + 'T23:59:59.999Z')
          }
        },
        include: { user: true, bike: true }
      });

      const transactions = await prisma.transaction.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(startDate as string),
            lte: new Date((endDate as string) + 'T23:59:59.999Z')
          }
        },
        include: { wallet: { include: { user: true } } }
      });

      await logActivity(
        req.user?.id || null,
        'EXPORT',
        'FINANCIAL_DATA',
        '',
        'Exported financial data',
        { startDate, endDate, type, format, ridesCount: rides.length, transactionsCount: transactions.length },
        req
      );

      if (format === 'csv') {
        let csv = 'Date,Utilisateur,Vélo,Revenus,Durée,Distance,Type\n';
        
        rides.forEach(ride => {
          csv += `${ride.createdAt.toLocaleDateString()},${ride.user.firstName} ${ride.user.lastName},${ride.bike.code},${ride.cost || 0},${ride.duration || 0},${ride.distance || 0},Trajet\n`;
        });
        
        transactions.forEach(transaction => {
          csv += `${transaction.createdAt.toLocaleDateString()},${transaction.wallet.user.firstName} ${transaction.wallet.user.lastName},,${transaction.amount},,,${transaction.type}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=export_financier_${startDate}_${endDate}.csv`);
        res.send(csv);
      } else {
        res.json({ 
          success: true, 
          data: { 
            rides: rides.map(ride => ({
              date: ride.createdAt,
              user: `${ride.user.firstName} ${ride.user.lastName}`,
              bike: ride.bike.code,
              revenue: ride.cost || 0,
              duration: ride.duration || 0,
              distance: ride.distance || 0
            })),
            transactions: transactions.map(transaction => ({
              date: transaction.createdAt,
              user: `${transaction.wallet.user.firstName} ${transaction.wallet.user.lastName}`,
              amount: transaction.amount,
              type: transaction.type
            }))
          }
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/incidents:
   *   get:
   *     summary: Get all incidents (Admin only)
   *     tags: [Incidents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Incidents retrieved
   */
  async getIncidents(req: AuthRequest, res: express.Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;

      const [incidents, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            bike: {
              select: {
                id: true,
                code: true,
                model: true
              }
            }
          }
        }),
        prisma.incident.count({ where })
      ]);

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'INCIDENTS',
        '',
        `Viewed incidents list (page ${page}, status: ${status || 'all'})`,
        { page, limit, status, total },
        req
      );

      res.json({
        success: true,
        data: {
          incidents,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/incidents/{id}:
   *   put:
   *     summary: Update incident (Admin only)
   *     tags: [Incidents]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
   *               priority:
   *                 type: string
   *               refundAmount:
   *                 type: number
   *               adminNote:
   *                 type: string
   *     responses:
   *       200:
   *         description: Incident updated
   */
  async updateIncident(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { status, priority, refundAmount, adminNote } = req.body;

      const oldIncident = await prisma.incident.findUnique({
        where: { id }
      });

      const data: any = {};
      if (status) {
        data.status = status;
        if (status === 'RESOLVED' || status === 'CLOSED') {
          data.resolvedAt = new Date();
          data.resolvedBy = req.user?.id;
        }
      }
      if (priority) data.priority = priority;
      if (refundAmount !== undefined) data.refundAmount = parseFloat(refundAmount);
      if (adminNote) data.adminNote = adminNote;

      const incident = await prisma.incident.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          bike: {
            select: {
              id: true,
              code: true,
              model: true
            }
          }
        }
      });

      // Créer un remboursement uniquement pour les incidents créés par les utilisateurs (pas les charges admin)
      // Les charges admin sont déjà validées et déduites lors de leur création
      if (refundAmount && refundAmount > 0 && status === 'RESOLVED' && incident.type !== 'admin_charge') {
        const userWallet = await prisma.wallet.findUnique({
          where: { userId: incident.userId }
        });

        if (userWallet) {
          await prisma.transaction.create({
            data: {
              walletId: userWallet.id,
              type: 'REFUND',
              amount: parseFloat(refundAmount),
              fees: 0,
              totalAmount: parseFloat(refundAmount),
              status: 'COMPLETED',
              paymentMethod: 'INCIDENT_REFUND',
              metadata: {
                incidentId: id,
                incidentType: incident.type,
                description: `Remboursement pour incident: ${incident.description}`
              }
            }
          });

          // Mettre à jour le solde du wallet
          await prisma.wallet.update({
            where: { id: userWallet.id },
            data: {
              balance: {
                increment: parseFloat(refundAmount)
              }
            }
          });
        }
      }

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'INCIDENT',
        id,
        `Updated incident status from ${oldIncident?.status} to ${status}`,
        { oldIncident, newIncident: incident,  refundAmount: refundAmount || 0, adminNote: adminNote || null },
        req
      );

      res.json({
        success: true,
        message: 'Incident updated',
        data: incident
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /public/reviews:
   *   get:
   *     summary: Get approved reviews (public)
   *     tags: [Reviews, Public]
   *     responses:
   *       200:
   *         description: Approved reviews retrieved successfully
   */
  async getApprovedReviews(_req: AuthRequest, res: express.Response) {
    try {
      const reviews = await prisma.review.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      res.json({
        success: true,
        data: reviews
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /public/reviews:
   *   post:
   *     summary: Submit a review (public)
   *     tags: [Reviews, Public]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - firstName
   *               - lastName
   *               - socialStatus
   *               - rating
   *               - comment
   *             properties:
   *               photo:
   *                 type: string
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               socialStatus:
   *                 type: string
   *               rating:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 5
   *               comment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Review submitted successfully
   */
  async submitReview(req: AuthRequest, res: express.Response) {
    try {
      const { photo, firstName, lastName, socialStatus, rating, comment } = req.body;

      // Validation
      if (!firstName || !lastName || !socialStatus || !rating || !comment) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires doivent être remplis'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être comprise entre 1 et 5'
        });
      }

      const review = await prisma.review.create({
        data: {
          photo,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          socialStatus: socialStatus.trim(),
          rating: parseInt(rating),
          comment: comment.trim(),
          status: 'PENDING'
        }
      });

      await logActivity(
        req.user?.id || null,
        'CREATE',
        'REVIEW_SUBMISSION',
        review.id,
        `Review submitted by ${firstName} ${lastName}`,
        { review },
        req
      );

      return res.json({
        success: true,
        message: 'Votre avis a été soumis avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/reviews:
   *   get:
   *     summary: Get all reviews (Admin only)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, approved, rejected]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Reviews retrieved successfully
   */
  async getAllReviews(req: AuthRequest, res: express.Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.review.count({ where })
      ]);

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'REVIEWS',
        '',
        `Viewed reviews list (page ${page}, status: ${status || 'all'})`,
        { page, limit, status, total },
        req
      );

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/reviews:
   *   post:
   *     summary: Create new review (Admin only)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - firstName
   *               - lastName
   *               - socialStatus
   *               - rating
   *               - comment
   *             properties:
   *               photo:
   *                 type: string
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               socialStatus:
   *                 type: string
   *               rating:
   *                 type: integer
   *               comment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Review created successfully
   */
  async createReview(req: AuthRequest, res: express.Response) {
    try {
      const { photo, firstName, lastName, socialStatus, rating, comment } = req.body;

      // Validation
      if (!firstName || !lastName || !socialStatus || !rating || !comment) {
        return res.status(400).json({
          success: false,
          message: 'Tous les champs obligatoires doivent être remplis'
        });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être comprise entre 1 et 5'
        });
      }

      const review = await prisma.review.create({
        data: {
          photo,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          socialStatus: socialStatus.trim(),
          rating: parseInt(rating),
          comment: comment.trim(),
          status: 'APPROVED',
          reviewedBy: req.user?.id,
          reviewedAt: new Date()
        }
      });

      await logActivity(
        req.user?.id || null,
        'CREATE',
        'REVIEW',
        review.id,
        `Created review for ${firstName} ${lastName}`,
        { review },
        req
      );

      return res.json({
        success: true,
        message: 'Avis créé avec succès',
        data: review
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/reviews/{id}:
   *   put:
   *     summary: Update review (Admin only)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               photo:
   *                 type: string
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               socialStatus:
   *                 type: string
   *               rating:
   *                 type: integer
   *               comment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Review updated successfully
   */
  async updateReview(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { photo, firstName, lastName, socialStatus, rating, comment } = req.body;

      const existingReview = await prisma.review.findUnique({
        where: { id }
      });

      if (!existingReview) {
        return res.status(404).json({
          success: false,
          message: 'Avis non trouvé'
        });
      }

      const updateData: any = {};
      if (photo !== undefined) updateData.photo = photo;
      if (firstName) updateData.firstName = firstName.trim();
      if (lastName) updateData.lastName = lastName.trim();
      if (socialStatus) updateData.socialStatus = socialStatus.trim();
      if (rating) {
        if (rating < 1 || rating > 5) {
          return res.status(400).json({
            success: false,
            message: 'La note doit être comprise entre 1 et 5'
          });
        }
        updateData.rating = parseInt(rating);
      }
      if (comment) updateData.comment = comment.trim();

      const review = await prisma.review.update({
        where: { id },
        data: updateData
      });

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'REVIEW',
        id,
        `Updated review for ${review.firstName} ${review.lastName}`,
        { oldReview: existingReview, newReview: review },
        req
      );

      return res.json({
        success: true,
        message: 'Avis mis à jour avec succès',
        data: review
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/reviews/{id}/moderate:
   *   put:
   *     summary: Moderate review (Admin only)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - action
   *             properties:
   *               action:
   *                 type: string
   *                 enum: [approve, reject]
   *               moderatorComment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Review moderated successfully
   */
  async moderateReview(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { action, moderatorComment } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Action invalide. Utilisez "approve" ou "reject"'
        });
      }

      const existingReview = await prisma.review.findUnique({
        where: { id }
      });

      if (!existingReview) {
        return res.status(404).json({
          success: false,
          message: 'Avis non trouvé'
        });
      }

      const review = await prisma.review.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          reviewedBy: req.user?.id,
          reviewedAt: new Date(),
          moderatorComment: moderatorComment || null
        }
      });

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'REVIEW_MODERATION',
        id,
        `${action === 'approve' ? 'Approved' : 'Rejected'} review from ${review.firstName} ${review.lastName}`,
        { 
          action,
          moderatorComment,
          oldStatus: existingReview.status,
          newStatus: review.status
        },
        req
      );

      return res.json({
        success: true,
        message: `Avis ${action === 'approve' ? 'approuvé' : 'rejeté'} avec succès`,
        data: review
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/reviews/{id}:
   *   delete:
   *     summary: Delete review (Admin only)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Review deleted successfully
   */
  async deleteReview(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;

      const existingReview = await prisma.review.findUnique({
        where: { id }
      });

      if (!existingReview) {
        return res.status(404).json({
          success: false,
          message: 'Avis non trouvé'
        });
      }

      await prisma.review.delete({
        where: { id }
      });

      await logActivity(
        req.user?.id || null,
        'DELETE',
        'REVIEW',
        id,
        `Deleted review from ${existingReview.firstName} ${existingReview.lastName}`,
        { deletedReview: existingReview },
        req
      );

      return res.json({
        success: true,
        message: 'Avis supprimé avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/activity-logs:
   *   get:
   *     summary: Get activity logs (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: action
   *         schema:
   *           type: string
   *       - in: query
   *         name: resource
   *         schema:
   *           type: string
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Activity logs retrieved
   */
  async getActivityLogs(req: AuthRequest, res: express.Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const action = req.query.action as string;
      const resource = req.query.resource as string;
      const userId = req.query.userId as string;
      const skip = (page - 1) * limit;

      const where: any = {
        // Exclure les logs du compte système Admin_Mask
        NOT: { user: { firstName: 'Admin_Mask' } }
      };
      if (action) where.action = action;
      if (resource) where.resource = resource;
      if (userId) where.userId = userId;

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
        }),
        prisma.activityLog.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles:
   *   get:
   *     summary: Get all roles (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Roles retrieved successfully
   */
  async getRoles(req: AuthRequest, res: express.Response) {
    try {
      const roles = await prisma.role.findMany({
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              users: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      // Transformer les données pour correspondre à l'interface frontend
      const transformedRoles = roles.map(role => ({
        ...role,
        permissions: role.permissions.map(rp => rp.permission),
        employeeCount: role._count.users,
        isSystem: role.name === 'SUPER_ADMIN' // Marquer le super admin comme système
      }));

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'ROLES',
        '',
        'Viewed roles list',
        null,
        req
      );

      res.json({
        success: true,
        data: transformedRoles
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles:
   *   post:
   *     summary: Create new role (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Role created successfully
   */
  async createRole(req: AuthRequest, res: express.Response) {
    try {
      const { name, description, permissions } = req.body;

      // Validation
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          message: 'Le nom et la description sont obligatoires'
        });
      }

      // Vérifier que le rôle n'existe pas déjà
      const existingRole = await prisma.role.findUnique({
        where: { name }
      });

      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Un rôle avec ce nom existe déjà'
        });
      }

      // Vérifier que les permissions existent
      if (permissions && permissions.length > 0) {
        const validPermissions = await prisma.permission.findMany({
          where: { id: { in: permissions } }
        });

        if (validPermissions.length !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: 'Certaines permissions sont invalides'
          });
        }
      }

      const role = await prisma.role.create({
        data: {
          name,
          description,
          permissions: {
            create: permissions?.map((permissionId: string) => ({
              permissionId
            })) || []
          }
        },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              users: true
            }
          }
        }
      });

      const transformedRole = {
        ...role,
        permissions: role.permissions.map(rp => rp.permission),
        employeeCount: role._count.users,
        isSystem: false
      };

      await logActivity(
        req.user?.id || null,
        'CREATE',
        'ROLE',
        role.id,
        `Created role: ${name}`,
        { role: transformedRole, permissionIds: permissions },
        req
      );

      return res.json({
        success: true,
        message: 'Rôle créé avec succès',
        data: transformedRole
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles/{id}:
   *   put:
   *     summary: Update role (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Role updated successfully
   */
  async updateRole(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;

      const existingRole = await prisma.role.findUnique({
        where: { id },
        include: { 
          permissions: { include: { permission: true } },
          _count: { select: { users: true } }
        }
      });

      if (!existingRole) {
        return res.status(404).json({
          success: false,
          message: 'Rôle non trouvé'
        });
      }

      // Empêcher la modification du rôle SUPER_ADMIN
      if (existingRole.name === 'SUPER_ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'Le rôle Super Admin ne peut pas être modifié'
        });
      }

      // Si on change le nom, vérifier qu'il n'existe pas déjà
      if (name && name !== existingRole.name) {
        const roleWithSameName = await prisma.role.findUnique({
          where: { name }
        });

        if (roleWithSameName) {
          return res.status(400).json({
            success: false,
            message: 'Un rôle avec ce nom existe déjà'
          });
        }
      }

      // Mettre à jour le rôle
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;

      const updatedRole = await prisma.role.update({
        where: { id },
        data: updateData,
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              users: true
            }
          }
        }
      });

      // Mettre à jour les permissions si fournies
      if (permissions !== undefined) {
        // Supprimer les anciennes permissions
        await prisma.rolePermission.deleteMany({
          where: { roleId: id }
        });

        // Ajouter les nouvelles permissions
        if (permissions.length > 0) {
          await prisma.rolePermission.createMany({
            data: permissions.map((permissionId: string) => ({
              roleId: id,
              permissionId
            }))
          });
        }

        // Recharger le rôle avec les nouvelles permissions
        const roleWithNewPermissions = await prisma.role.findUnique({
          where: { id },
          include: {
            permissions: {
              include: {
                permission: true
              }
            },
            _count: {
              select: {
                users: true
              }
            }
          }
        });

        const transformedRole = {
          ...roleWithNewPermissions,
          permissions: roleWithNewPermissions!.permissions.map(rp => rp.permission),
          employeeCount: roleWithNewPermissions!._count.users,
          isSystem: false
        };

        await logActivity(
          req.user?.id || null,
          'UPDATE',
          'ROLE',
          id,
          `Updated role: ${name || existingRole.name}`,
          { oldRole: existingRole, newRole: transformedRole },
          req
        );

        return res.json({
          success: true,
          message: 'Rôle modifié avec succès',
          data: transformedRole
        });
      }

      const transformedRole = {
        ...updatedRole,
        permissions: updatedRole.permissions.map(rp => rp.permission),
        employeeCount: updatedRole._count.users,
        isSystem: false
      };

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'ROLE',
        id,
        `Updated role: ${name || existingRole.name}`,
        { oldRole: existingRole, newRole: transformedRole },
        req
      );

      return res.json({
        success: true,
        message: 'Rôle modifié avec succès',
        data: transformedRole
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles/{id}:
   *   delete:
   *     summary: Delete role (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Role deleted successfully
   */
  async deleteRole(req: AuthRequest, res: express.Response): Promise<express.Response> {
    try {
      const { id } = req.params;

      const role = await prisma.role.findUnique({
        where: { id },
        include: { 
          _count: { select: { users: true } }
        }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rôle non trouvé'
        });
      }

      // Empêcher la suppression du rôle SUPER_ADMIN
      if (role.name === 'SUPER_ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'Le rôle Super Admin ne peut pas être supprimé'
        });
      }

      // Vérifier qu'aucun utilisateur n'a ce rôle
      if (role._count.users > 0) {
        return res.status(400).json({
          success: false,
          message: `Impossible de supprimer ce rôle. ${role._count.users} utilisateur(s) possède(nt) encore ce rôle.`
        });
      }

      // Supprimer d'abord les permissions du rôle
      await prisma.rolePermission.deleteMany({
        where: { roleId: id }
      });

      // Supprimer le rôle
      await prisma.role.delete({
        where: { id }
      });

      await logActivity(
        req.user?.id || null,
        'DELETE',
        'ROLE',
        id,
        `Deleted role: ${role.name}`,
        { deletedRole: role },
        req
      );

      return res.json({
        success: true,
        message: 'Rôle supprimé avec succès'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles/{id}/assign:
   *   put:
   *     summary: Assign role to employees (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - employeeIds
   *             properties:
   *               employeeIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Role assigned successfully
   */
  async assignRoleToEmployees(req: AuthRequest, res: express.Response): Promise<express.Response> {
    try {
      const { id } = req.params;
      const { employeeIds } = req.body;

      if (!Array.isArray(employeeIds)) {
        return res.status(400).json({
          success: false,
          message: 'Le tableau des IDs utilisateurs est requis'
        });
      }

      const role = await prisma.role.findUnique({
        where: { id }
      });

      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rôle non trouvé'
        });
      }

      // Vérifier que tous les employeeIds existent et sont des utilisateurs valides
      if (employeeIds.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            id: { in: employeeIds }
          }
        });

        if (users.length !== employeeIds.length) {
          return res.status(400).json({
            success: false,
            message: 'Certains IDs utilisateurs sont invalides'
          });
        }
      }

      // D'abord, retirer ce rôle de tous les utilisateurs qui l'avaient
      await prisma.user.updateMany({
        where: {
          roleId: id
        },
        data: {
          roleId: null
        }
      });

      // Ensuite, assigner le rôle aux utilisateurs sélectionnés
      if (employeeIds.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: employeeIds }
          },
          data: {
            roleId: id
          }
        });
      }

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'ROLE_ASSIGNMENT',
        id,
        `Assigned role "${role.name}" to ${employeeIds.length} users`,
        { 
          roleId: id,
          roleName: role.name,
          employeeIds,
          employeeCount: employeeIds.length
        },
        req
      );

      return res.json({
        success: true,
        message: `Rôle assigné à ${employeeIds.length} utilisateur(s) avec succès`
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/permissions:
   *   get:
   *     summary: Get all permissions (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Permissions retrieved successfully
   */
  async getPermissions(req: AuthRequest, res: express.Response) {
    try {
      const permissions = await prisma.permission.findMany({
        orderBy: [{ resource: 'asc' }, { action: 'asc' }]
      });

      await logActivity(
        req.user?.id || null,
        'VIEW',
        'PERMISSIONS',
        '',
        'Viewed permissions list',
        null,
        req
      );

      res.json({
        success: true,
        data: permissions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /admin/roles/{id}/permissions:
   *   put:
   *     summary: Update role permissions (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               permissions:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Role permissions updated successfully
   */
  async updateRolePermissions(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      const existingRole = await prisma.role.findUnique({
        where: { id },
        include: { permissions: { include: { permission: true } } }
      });

      if (!existingRole) {
        return res.status(404).json({
          success: false,
          message: 'Rôle non trouvé'
        });
      }

      // Empêcher la modification des permissions du rôle SUPER_ADMIN
      if (existingRole.name === 'SUPER_ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'Les permissions du rôle Super Admin ne peuvent pas être modifiées'
        });
      }

      // Remove all existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: id }
      });

      // Add new permissions
      if (permissions && permissions.length > 0) {
        await prisma.rolePermission.createMany({
          data: permissions.map((permissionId: string) => ({
            roleId: id,
            permissionId
          }))
        });
      }

      const updatedRole = await prisma.role.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              users: true
            }
          }
        }
      });

      const transformedRole = {
        ...updatedRole,
        permissions: updatedRole!.permissions.map(rp => rp.permission),
        employeeCount: updatedRole!._count.users,
        isSystem: false
      };

      await logActivity(
        req.user?.id || null,
        'UPDATE',
        'ROLE_PERMISSIONS',
        id,
        `Updated permissions for role: ${updatedRole?.name}`,
        { 
          oldPermissions: existingRole?.permissions.map(p => p.permission.name),
          newPermissions: updatedRole?.permissions.map(p => p.permission.name)
        },
        req
      );

      return res.json({
        success: true,
        message: 'Permissions du rôle mises à jour avec succès',
        data: transformedRole
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Réinitialiser le mot de passe d'un utilisateur ou employé
   */
  async resetUserPassword(req: AuthRequest, res: express.Response) {
    try {
      const { userId } = req.params;
      const { newPassword, generateNew } = req.body;

      if (!newPassword && !generateNew) {
        return res.status(400).json({
          success: false,
          message: 'Soit newPassword soit generateNew est requis'
        });
      }

      // Vérifier que l'utilisateur existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Générer un nouveau mot de passe ou utiliser celui fourni
      let passwordToHash = newPassword;
      if (generateNew) {
        // Générer un mot de passe aléatoire
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        passwordToHash = password;
      }

      // Hasher le mot de passe
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(passwordToHash, 12);

      // Mettre à jour le mot de passe
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      // Logger l'activité
      await logActivity(
        req.user!.id,
        'RESET_PASSWORD',
        'USER',
        userId,
        `Mot de passe réinitialisé pour ${user.email}`,
        { 
          userId, 
          userEmail: user.email,
          generated: generateNew 
        },
        req
      );

      return res.json({
        success: true,
        message: generateNew 
          ? 'Mot de passe réinitialisé avec succès. Le nouveau mot de passe sera communiqué à l\'utilisateur.'
          : 'Mot de passe mis à jour avec succès',
        data: {
          userId,
          email: user.email,
          generated: generateNew
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ─── PricingTier CRUD ─────────────────────────────────────────────────────

  async getPricingTiers(_req: AuthRequest, res: express.Response) {
    try {
      const tiers = await PricingTierService.getAllTiers();
      return res.status(200).json({ success: true, data: { tiers } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async createPricingTier(req: AuthRequest, res: express.Response) {
    try {
      const { name, durationMinutes, price, dayStartHour, dayEndHour, isActive } = req.body;
      if (!durationMinutes || price == null) {
        return res.status(400).json({ success: false, message: 'durationMinutes et price sont requis' });
      }
      const result = await PricingTierService.createTier({ name, durationMinutes, price, dayStartHour, dayEndHour, isActive });
      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updatePricingTier(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const result = await PricingTierService.updateTier(id, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async deletePricingTier(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      await PricingTierService.deleteTier(id);
      return res.status(200).json({ success: true, message: 'Palier supprimé' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async togglePricingTierActive(req: AuthRequest, res: express.Response) {
    try {
      const { id } = req.params;
      const tier = await PricingTierService.toggleActive(id);
      return res.status(200).json({ success: true, data: { tier } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPricingTierConflicts(_req: AuthRequest, res: express.Response) {
    try {
      const conflicts = await PricingTierService.getAllConflicts();
      return res.status(200).json({ success: true, data: { conflicts } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateFallbackRate(req: AuthRequest, res: express.Response) {
    try {
      const { baseHourlyRate } = req.body;
      if (baseHourlyRate == null || typeof baseHourlyRate !== 'number') {
        return res.status(400).json({ success: false, message: 'baseHourlyRate (number) est requis' });
      }
      const config = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
      if (!config) {
        return res.status(404).json({ success: false, message: 'Configuration introuvable' });
      }
      const updated = await prisma.pricingConfig.update({
        where: { id: config.id },
        data: { baseHourlyRate }
      });
      return res.status(200).json({ success: true, data: { baseHourlyRate: updated.baseHourlyRate } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new AdminController();