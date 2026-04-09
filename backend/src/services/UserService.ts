import { AppError } from '../middleware/errorHandler';
import { prisma } from '../config/prisma';
import { User, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { notificationSSEService } from './NotificationSSEService';


type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    wallet: true;
    roleRelation: true;
  }
}>;

export interface CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  roleId?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  roleId?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export class UserService {
  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserWithRelations | null> {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        roleRelation: true
      }
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  /**
   * Get all users (admin)
   */
  async getAllUsers(page: number = 1, limit: number = 20, role?: UserRole) {
    const where: any = {
      // Masquer le compte système Admin_Mask (SUPER_ADMIN caché)
      NOT: { firstName: 'Admin_Mask' }
    };

    if (role) {
      where.role = role;
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: true,
          roleRelation: true,
          _count: {
            select: {
              rides: true,
              incidents: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const { password, ...userWithoutPassword } = user;
        
        // Récupérer les statistiques réelles
        const [totalSpentResult, totalTripsResult, lastRide] = await Promise.all([
          prisma.transaction.aggregate({
            where: {
              wallet: { userId: user.id },
              type: 'RIDE_PAYMENT',
              status: 'COMPLETED'
            },
            _sum: { amount: true }
          }),
          prisma.ride.aggregate({
            where: { userId: user.id, status: 'COMPLETED' },
            _count: true
          }),
          prisma.ride.findFirst({
            where: { userId: user.id },
            orderBy: { startTime: 'desc' },
            select: { startTime: true }
          })
        ]);

        const totalSpent = totalSpentResult._sum.amount || 0;
        const totalTrips = totalTripsResult._count || 0;

        return {
          ...userWithoutPassword,
          role: user.role,
          roleId: user.roleId,
          accountBalance: user.wallet?.balance || 0,
          depositBalance: user.depositBalance || 0,
          totalSpent,
          totalTrips,
          reliabilityScore: this.calculateReliabilityScore(user.id, totalTrips),
          lastActivity: lastRide?.startTime || user.createdAt
        };
      })
    );

    return {
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create new user (admin)
   */
  async createUser(data: CreateUserDto): Promise<UserWithRelations> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        roleId: data.roleId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        wallet: {
          create: {
            balance: 0
          }
        }
      },
      include: {
        wallet: true,
        roleRelation: true
      }
    });

    return user;
  }

  /**
   * Update user (admin)
   */
  async updateUser(userId: string, data: UpdateUserDto): Promise<UserWithRelations> {
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        roleId: data.roleId,
        role: data.role,
        isActive: data.isActive
      },
      include: {
        wallet: true,
        roleRelation: true
      }
    });

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateUserDto): Promise<User> {
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data
    });

    return user;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, data: UpdatePasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
    
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, roleId: string): Promise<UserWithRelations> {
    const roleExists = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!roleExists) {
      throw new Error('Role not found');
    }

    return await prisma.user.update({
      where: { id: userId },
      data: { 
        roleId: roleId
      },
      include: {
        roleRelation: true,
        wallet: true,
        _count: {
          select: {
            rides: true
          }
        }
      }
    });
  }

  /**
   * Activate/Deactivate user (admin only)
   */
  async toggleUserStatus(userId: string, isActive: boolean, adminId?: string): Promise<User> {
    const data: any = { isActive, status: isActive ? 'active' : 'blocked' };
    
    if (isActive) {
      // Déblocage avec durée illimitée (100 ans dans le futur)
      const distantFutureDate = new Date();
      distantFutureDate.setFullYear(distantFutureDate.getFullYear() + 100);
      data.depositExemptionUntil = distantFutureDate;
      if (adminId) {
        data.depositExemptionGrantedBy = adminId;
      }
      data.depositExemptionGrantedAt = new Date();
    } else {
      // Annulation de l'exemption quand on bloque
      data.depositExemptionUntil = null;
      data.depositExemptionGrantedBy = null;
      data.depositExemptionGrantedAt = null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data
    });

    // Émettre un événement SSE pour informer le mobile immédiatement
    await notificationSSEService.sendNotificationToUser(userId, {
      type: 'USER_STATUS_CHANGED',
      status: data.status,
      isActive: data.isActive,
      message: isActive 
        ? 'Votre compte a été débloqué.' 
        : 'Votre compte a été bloqué. Veuillez contacter le support.'
    });

    return updatedUser;

  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string): Promise<void> {
    await prisma.user.delete({
      where: { id: userId }
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    const [user, ridesStats, walletStats] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true }
      }),
      prisma.ride.aggregate({
        where: { userId, status: 'COMPLETED' },
        _count: true,
        _sum: {
          distance: true,
          cost: true,
          duration: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          wallet: { userId },
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      })
    ]);

    return {
      user: user ? { ...user, password: undefined } : null,
      rides: {
        total: ridesStats._count,
        totalDistance: ridesStats._sum.distance || 0,
        totalCost: ridesStats._sum.cost || 0,
        totalDuration: ridesStats._sum.duration || 0
      },
      wallet: {
        balance: user?.wallet?.balance || 0,
        totalTransacted: walletStats._sum.amount || 0
      }
    };
  }

  /**
   * Search users (admin)
   */
  async searchUsers(query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = {
      OR: [
        { email: { contains: query, mode: 'insensitive' as const } },
        { firstName: { contains: query, mode: 'insensitive' as const } },
        { lastName: { contains: query, mode: 'insensitive' as const } },
        { phone: { contains: query } }
      ]
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: true,
          roleRelation: true
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users: users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          role: user.roleRelation?.name || user.role,
          roleId: user.roleId // Inclure l'ID du rôle
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where: { userId } })
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: { isRead: true }
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  /**
   * Get unread notifications count
   */
  async getUnreadNotificationsCount(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: { userId, isRead: false }
    });
  }

  /**
   * Archive user account (soft delete)
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Archive the account by changing email and status
    const archivedEmail = `deleted_${Date.now()}_${user.email}`;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: archivedEmail,
        isActive: false,
        status: 'deleted',
        // Keep other data for historical purposes
      }
    });

    // Deactivate all sessions
    await prisma.session.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    // Deactivate push tokens
    await prisma.pushToken.updateMany({
      where: { userId },
      data: { isActive: false }
    });
  }

  /**
   * Get user incidents (Admin only)
   */
  async getUserIncidents(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where: { userId },
        include: {
          bike: {
            select: {
              id: true,
              code: true,
              model: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.incident.count({ where: { userId } })
    ]);

    return {
      incidents: incidents.map(incident => ({
        ...incident,
        bikeName: incident.bike ? `${incident.bike.code} - ${incident.bike.model}` : 'N/A'
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user rides (Admin only)
   */
  async getUserRides(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where: { userId },
        include: {
          bike: {
            select: {
              id: true,
              code: true,
              model: true
            }
          },
          plan: {
            select: {
              name: true,
              type: true
            }
          }
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit
      }),
      prisma.ride.count({ where: { userId } })
    ]);

    return {
      rides: rides.map(ride => ({
        ...ride,
        bikeName: ride.bike ? `${ride.bike.code} - ${ride.bike.model}` : 'N/A',
        planName: ride.plan?.name || 'Standard'
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get user transactions (Admin only)
   */
  async getUserTransactions(userId: string, page: number = 1, limit: number = 20, filters?: { type?: string; status?: string }) {
    const skip = (page - 1) * limit;
    
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      return {
        transactions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      };
    }

    const where: any = { walletId: wallet.id };
    
    if (filters?.type) {
      where.type = filters.type;
    }
    
    if (filters?.status) {
      where.status = filters.status;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
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
   * Get user unlock/lock requests (Admin only)
   */
  async getUserRequests(userId: string, type?: string) {
    let requests: any[] = [];
    
    if (!type || type === 'unlock') {
      const unlockRequests = await prisma.unlockRequest.findMany({
        where: { userId },
        include: {
          bike: {
            select: {
              code: true,
              model: true
            }
          },
          reservation: {
            include: {
              plan: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      requests = [
        ...requests,
        ...unlockRequests.map(req => ({
          ...req,
          type: 'unlock',
          bikeName: req.bike ? `${req.bike.code} - ${req.bike.model}` : 'N/A'
        }))
      ];
    }
    
    if (!type || type === 'lock') {
      const lockRequests = await prisma.lockRequest.findMany({
        where: { userId },
        include: {
          bike: {
            select: {
              code: true,
              model: true
            }
          },
          ride: {
            include: {
              bike: true,
              plan: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      requests = [
        ...requests,
        ...lockRequests.map(req => ({
          ...req,
          type: 'lock',
          bikeName: req.bike ? `${req.bike.code} - ${req.bike.model}` : 'N/A'
        }))
      ];
    }
    
    // Trier par date
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return requests;
  }

  /**
   * Get user detailed statistics (Admin only)
   */
  async getUserDetailedStats(userId: string) {
    const [
      user,
      ridesStats,
      walletStats,
      incidentsStats,
      requestsStats,
      subscription,
      depositInfo
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallet: true,
          roleRelation: true
        }
      }),
      prisma.ride.aggregate({
        where: { userId },
        _count: true,
        _sum: {
          distance: true,
          cost: true,
          duration: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          wallet: { userId }
        },
        _count: true,
        _sum: {
          amount: true
        }
      }),
      prisma.incident.aggregate({
        where: { userId },
        _count: true,
        _sum: {
          refundAmount: true
        }
      }),
      prisma.$transaction([
        prisma.unlockRequest.count({ where: { userId } }),
        prisma.lockRequest.count({ where: { userId } }),
        prisma.unlockRequest.count({ where: { userId, status: 'PENDING' } }),
        prisma.lockRequest.count({ where: { userId, status: 'PENDING' } })
      ]),
      prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        },
        include: {
          plan: true
        }
      }),
      prisma.reservation.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        },
        include: {
          plan: true,
          bike: {
            select: {
              code: true
            }
          }
        }
      })
    ]);

    const [totalUnlockRequests, totalLockRequests, pendingUnlockRequests, pendingLockRequests] = requestsStats;

    return {
      user: user ? {
        ...user,
        password: undefined
      } : null,
      rides: {
        total: ridesStats._count || 0,
        totalDistance: ridesStats._sum.distance || 0,
        totalCost: ridesStats._sum.cost || 0,
        totalDuration: ridesStats._sum.duration || 0,
        averageCost: ridesStats._count > 0 ? (ridesStats._sum.cost || 0) / ridesStats._count : 0,
        averageDuration: ridesStats._count > 0 ? (ridesStats._sum.duration || 0) / ridesStats._count : 0
      },
      wallet: {
        balance: user?.wallet?.balance || 0,
        deposit: user?.depositBalance || 0,
        negativeBalance: user?.wallet?.negativeBalance || 0,
        totalTransactions: walletStats._count || 0,
        totalTransacted: walletStats._sum.amount || 0
      },
      incidents: {
        total: incidentsStats._count || 0,
        totalRefunded: incidentsStats._sum.refundAmount || 0,
        averageRefund: incidentsStats._count > 0 ? (incidentsStats._sum.refundAmount || 0) / incidentsStats._count : 0
      },
      requests: {
        totalUnlock: totalUnlockRequests,
        totalLock: totalLockRequests,
        pendingUnlock: pendingUnlockRequests,
        pendingLock: pendingLockRequests,
        total: totalUnlockRequests + totalLockRequests,
        pending: pendingUnlockRequests + pendingLockRequests
      },
      subscription: subscription ? {
        planName: subscription.plan?.name || 'Unknown',
        type: subscription.type,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        remainingDays: Math.ceil((subscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      } : null,
      activeReservation: depositInfo ? {
        planName: depositInfo.plan.name,
        packageType: depositInfo.packageType,
        bikeCode: depositInfo.bike?.code,
        startDate: depositInfo.startDate,
        endDate: depositInfo.endDate
      } : null
    };
  }

  /**
   * Get user active subscription (Admin only)
   */
  async getUserActiveSubscription(userId: string) {
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        plan: true,
        bike: {
          select: {
            code: true
          }
        }
      }
    });

    if (activeReservation) {
      return {
        type: 'RESERVATION',
        planName: activeReservation.plan.name,
        packageType: activeReservation.packageType,
        bikeCode: activeReservation.bike?.code,
        startDate: activeReservation.startDate,
        endDate: activeReservation.endDate,
        remainingDays: Math.ceil((activeReservation.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      };
    }

    // Check subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        plan: true
      }
    });

    if (!subscription) return null;

    return {
      type: 'SUBSCRIPTION',
      planName: subscription.plan?.name || 'Unknown',
      packageType: subscription.type,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      remainingDays: Math.ceil((subscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Calculate user reliability score
   */
  private async calculateReliabilityScore(userId: string, totalTrips: number): Promise<number> {
    if (totalTrips === 0) return 3.0; // Score par défaut

    const [completedRides, cancelledRides, incidentsCount, lateReturns] = await Promise.all([
      prisma.ride.count({
        where: {
          userId,
          status: 'COMPLETED'
        }
      }),
      prisma.ride.count({
        where: {
          userId,
          status: 'CANCELLED'
        }
      }),
      prisma.incident.count({
        where: {
          userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      }),
      prisma.lockRequest.count({
        where: {
          userId,
          status: 'REJECTED',
          rejectionReason: { contains: 'retard' }
        }
      })
    ]);

    let score = 5.0; // Score de départ
    
    // Pénalités
    if (cancelledRides > 0) {
      score -= (cancelledRides / totalTrips) * 2;
    }
    
    if (incidentsCount > 0) {
      score -= incidentsCount * 0.3;
    }
    
    if (lateReturns > 0) {
      score -= lateReturns * 0.5;
    }
    
    // Bonus pour les utilisateurs actifs
    if (completedRides > 10) {
      score += 0.5;
    }
    
    if (completedRides > 50) {
      score += 0.5;
    }

    // Limiter entre 1 et 5
    return Math.max(1.0, Math.min(5.0, score));
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string) {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId }
      });
    }

    return preferences;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, data: Partial<{
    rideNotifications: boolean;
    promotionalNotifications: boolean;
    securityNotifications: boolean;
    systemNotifications: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  }>) {
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data
      }
    });

    return preferences;
  }

  /**
   * Register push token
   */
  async registerPushToken(userId: string, tokenData: {
    token: string;
    device?: string;
    platform?: string;
  }) {
    // Deactivate existing tokens for this device/user if any
    await prisma.pushToken.updateMany({
      where: {
        userId,
        token: tokenData.token
      },
      data: { isActive: false }
    });

    // Create new token
    const pushToken = await prisma.pushToken.create({
      data: {
        userId,
        token: tokenData.token,
        device: tokenData.device,
        platform: tokenData.platform,
        isActive: true
      }
    });

    return pushToken;
  }

  /**
   * Unregister push token
   */
  async unregisterPushToken(userId: string, token?: string) {
    const whereCondition: any = { userId, isActive: true };
    
    if (token) {
      whereCondition.token = token;
    }

    await prisma.pushToken.updateMany({
      where: whereCondition,
      data: { isActive: false }
    });
  }

  /**
   * Get active push tokens for user
   */
  async getUserPushTokens(userId: string) {
    return await prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true
      }
    });
  }

  /**
   * Verify phone number manually (admin)
   */
  async verifyPhoneManually(userId: string, adminId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerifiedBy: adminId,
        phoneVerifiedAt: new Date(),
        phoneVerificationCode: null,
        phoneVerificationExpires: null
      }
    });
  }
}

export default new UserService();