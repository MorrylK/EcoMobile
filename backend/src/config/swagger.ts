import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoMobile API',
      version: '1.0.0',
      description: 'API REST complète pour l\'application EcoMobile avec support multi-base de données, authentification JWT, paiements My-CoolPay et internationalisation français/anglais',
      contact: {
        name: 'Xybronix Support',
        email: 'support@xybronix.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/license/MIT'
      }
    },
    servers: [
      {
        url: `${process.env.API_URL || 'http://localhost:8080'}/api/${config.apiVersion}`,
        description: 'Production server (VPS)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            firstName: {
              type: 'string'
            },
            lastName: {
              type: 'string'
            },
            phone: {
              type: 'string',
              nullable: true
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN', 'SUPER_ADMIN', 'EMPLOYEE']
            },
            isActive: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Wallet: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            balance: {
              type: 'number',
              format: 'float'
            },
            deposit: {
              type: 'number',
              format: 'float'
            },
            negativeBalance: {
              type: 'number',
              format: 'float'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            walletId: {
              type: 'string',
              format: 'uuid'
            },
            type: {
              type: 'string',
              enum: ['DEPOSIT', 'WITHDRAWAL', 'RIDE_PAYMENT', 'REFUND', 'DEPOSIT_RECHARGE', 'DAMAGE_CHARGE', 'SUBSCRIPTION_PAYMENT']
            },
            amount: {
              type: 'number',
              format: 'float'
            },
            fees: {
              type: 'number',
              format: 'float'
            },
            totalAmount: {
              type: 'number',
              format: 'float'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']
            },
            paymentMethod: {
              type: 'string',
              nullable: true
            },
            paymentProvider: {
              type: 'string',
              nullable: true
            },
            externalId: {
              type: 'string',
              nullable: true
            },
            requestedBy: {
              type: 'string',
              nullable: true
            },
            validatedBy: {
              type: 'string',
              nullable: true
            },
            validatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            rejectionReason: {
              type: 'string',
              nullable: true
            },
            canModify: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Bike: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            code: {
              type: 'string'
            },
            model: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE']
            },
            batteryLevel: {
              type: 'integer'
            },
            latitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            longitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            locationName: {
              type: 'string',
              nullable: true
            },
            equipment: {
              type: 'object',
              nullable: true
            },
            lastMaintenanceAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            qrCode: {
              type: 'string'
            },
            gpsDeviceId: {
              type: 'string',
              nullable: true
            },
            isActive: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Ride: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            bikeId: {
              type: 'string',
              format: 'uuid'
            },
            planId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            startTime: {
              type: 'string',
              format: 'date-time'
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            startLatitude: {
              type: 'number',
              format: 'float'
            },
            startLongitude: {
              type: 'number',
              format: 'float'
            },
            endLatitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            endLongitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            distance: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            duration: {
              type: 'integer',
              nullable: true
            },
            cost: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            status: {
              type: 'string',
              enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Incident: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            bikeId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            type: {
              type: 'string',
              enum: ['brakes', 'battery', 'tire', 'chain', 'lights', 'lock', 'electronics', 'physical_damage', 'other']
            },
            description: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH']
            },
            resolvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            refundAmount: {
              type: 'number',
              nullable: true
            },
            adminNote: {
              type: 'string',
              nullable: true
            },
            resolvedBy: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            },
            bike: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                code: {
                  type: 'string'
                },
                model: {
                  type: 'string'
                }
              }
            }
          }
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            message: {
              type: 'string'
            },
            isAdmin: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string'
            },
            message: {
              type: 'string'
            },
            type: {
              type: 'string'
            },
            isRead: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Reservation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            bikeId: {
              type: 'string',
              format: 'uuid'
            },
            planId: {
              type: 'string',
              format: 'uuid'
            },
            packageType: {
              type: 'string'
            },
            startDate: {
              type: 'string',
              format: 'date-time'
            },
            endDate: {
              type: 'string',
              format: 'date-time'
            },
            status: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        UnlockRequest: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            bikeId: {
              type: 'string',
              format: 'uuid'
            },
            reservationId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED']
            },
            requestedAt: {
              type: 'string',
              format: 'date-time'
            },
            validatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            rejectedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            validatedBy: {
              type: 'string',
              nullable: true
            },
            adminNote: {
              type: 'string',
              nullable: true
            },
            rejectionReason: {
              type: 'string',
              nullable: true
            },
            metadata: {
              type: 'object',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            bike: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                code: {
                  type: 'string'
                },
                model: {
                  type: 'string'
                }
              }
            }
          }
        },
        LockRequest: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            bikeId: {
              type: 'string',
              format: 'uuid'
            },
            rideId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            latitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            longitude: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            returnLocation: {
              type: 'object',
              nullable: true
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED']
            },
            requestedAt: {
              type: 'string',
              format: 'date-time'
            },
            validatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            rejectedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            validatedBy: {
              type: 'string',
              nullable: true
            },
            adminNote: {
              type: 'string',
              nullable: true
            },
            rejectionReason: {
              type: 'string',
              nullable: true
            },
            metadata: {
              type: 'object',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            bike: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                code: {
                  type: 'string'
                },
                model: {
                  type: 'string'
                }
              }
            },
            ride: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                startTime: {
                  type: 'string',
                  format: 'date-time'
                },
                endTime: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true
                },
                cost: {
                  type: 'number',
                  format: 'float',
                  nullable: true
                }
              }
            }
          }
        },
        PricingPlan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            type: {
              type: 'string',
              enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']
            },
            hourlyRate: {
              type: 'number',
              format: 'float'
            },
            dailyRate: {
              type: 'number',
              format: 'float'
            },
            weeklyRate: {
              type: 'number',
              format: 'float'
            },
            monthlyRate: {
              type: 'number',
              format: 'float'
            },
            minimumHours: {
              type: 'integer'
            },
            discount: {
              type: 'number',
              format: 'float'
            },
            isActive: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            firstName: {
              type: 'string'
            },
            lastName: {
              type: 'string'
            },
            socialStatus: {
              type: 'string'
            },
            photo: {
              type: 'string',
              nullable: true
            },
            rating: {
              type: 'integer'
            },
            comment: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED']
            },
            reviewedBy: {
              type: 'string',
              nullable: true
            },
            reviewedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            moderatorComment: {
              type: 'string',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            planId: {
              type: 'string',
              format: 'uuid'
            },
            type: {
              type: 'string',
              enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']
            },
            isActive: {
              type: 'boolean'
            },
            startDate: {
              type: 'string',
              format: 'date-time'
            },
            endDate: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            token: {
              type: 'string'
            },
            device: {
              type: 'string',
              nullable: true
            },
            location: {
              type: 'string',
              nullable: true
            },
            ipAddress: {
              type: 'string',
              nullable: true
            },
            userAgent: {
              type: 'string',
              nullable: true
            },
            isActive: {
              type: 'boolean'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        UserPreferences: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            rideNotifications: {
              type: 'boolean'
            },
            promotionalNotifications: {
              type: 'boolean'
            },
            securityNotifications: {
              type: 'boolean'
            },
            systemNotifications: {
              type: 'boolean'
            },
            emailNotifications: {
              type: 'boolean'
            },
            pushNotifications: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        SubscriptionPackage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            isActive: {
              type: 'boolean'
            },
            formulas: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SubscriptionFormula'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        SubscriptionFormula: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            packageId: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            numberOfDays: {
              type: 'integer'
            },
            price: {
              type: 'number',
              format: 'float'
            },
            dayStartHour: {
              type: 'integer'
            },
            dayEndHour: {
              type: 'integer'
            },
            chargeAfterHours: {
              type: 'boolean'
            },
            afterHoursPrice: {
              type: 'number',
              format: 'float',
              nullable: true
            },
            afterHoursType: {
              type: 'string',
              nullable: true
            },
            isActive: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        FreeDaysRule: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            numberOfDays: {
              type: 'integer',
              description: 'Nombre de jours gratuits accordés'
            },
            startType: {
              type: 'string',
              enum: ['IMMEDIATE', 'ON_USE'],
              description: "IMMEDIATE = commence tout de suite, ON_USE = commence à l'utilisation"
            },
            targetType: {
              type: 'string',
              enum: ['NEW_USERS', 'EXISTING_BY_DAYS', 'EXISTING_BY_SPEND', 'MANUAL'],
              description: 'Type de cible pour la règle'
            },
            targetDaysSinceRegistration: {
              type: 'integer',
              nullable: true,
              description: "Nombre de jours depuis l'inscription (pour EXISTING_BY_DAYS)"
            },
            targetMinSpend: {
              type: 'number',
              format: 'float',
              nullable: true,
              description: 'Montant minimum dépensé (pour EXISTING_BY_SPEND)'
            },
            applyAfterSubscription: {
              type: 'boolean',
              description: "Appliquer après l'abonnement en cours ou mettre en pause"
            },
            isActive: {
              type: 'boolean'
            },
            validFrom: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            maxBeneficiaries: {
              type: 'integer',
              nullable: true,
              description: 'Nombre maximum de bénéficiaires (null = illimité)'
            },
            currentBeneficiaries: {
              type: 'integer'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        FreeDaysBeneficiary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            ruleId: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            daysGranted: {
              type: 'integer'
            },
            daysRemaining: {
              type: 'integer'
            },
            startDate: {
              type: 'string',
              format: 'date-time'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time'
            },
            isActive: {
              type: 'boolean'
            },
            appliedAt: {
              type: 'string',
              format: 'date-time'
            },
            subscriptionPausedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            subscriptionResumedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Endpoints d\'authentification et d\'autorisation'
      },
      {
        name: 'Users',
        description: 'Gestion des utilisateurs'
      },
      {
        name: 'Reservations',
        description: 'Gestion des réservations de vélos'
      },
      {
        name: 'Bikes',
        description: 'Gestion des vélos'
      },
      {
        name: 'BikeRequests',
        description: 'Gestion des demandes de déverrouillage et verrouillage de vélos'
      },
      {
        name: 'Rides',
        description: 'Gestion des trajets'
      },
      {
        name: 'Incidents',
        description: 'Gestion des incidents et réclamations'
      },
      {
        name: 'Maintenance',
        description: 'Gestion de la maintenance des vélos'
      },
      {
        name: 'Pricing',
        description: 'Gestion des tarifs et abonnements'
      },
      {
        name: 'Wallet',
        description: 'Gestion du portefeuille et des transactions'
      },
      {
        name: 'Admin',
        description: 'Endpoints d\'administration'
      },
      {
        name: 'Reviews',
        description: 'Gestion des avis et évaluations'
      },
      {
        name: 'Chat',
        description: 'Messagerie utilisateur-admin'
      },
      {
        name: 'Notifications',
        description: 'Gestion des notifications'
      },
      {
        name: 'FreeDaysRules',
        description: 'Gestion des règles de jours gratuits'
      },
      {
        name: 'Subscriptions',
        description: 'Gestion des abonnements et forfaits'
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);