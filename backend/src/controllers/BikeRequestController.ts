import express from 'express';
import { prisma } from '../config/prisma';
import BikeRequestService from '../services/BikeRequestService';
import { AuthRequest, logActivity } from '../middleware/auth';

export class BikeRequestController {
  /**
   * @swagger
   * /bike-requests/unlock:
   *   post:
   *     summary: Créer une demande de déverrouillage
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - bikeId
   *             properties:
   *               bikeId:
   *                 type: string
   *               metadata:
   *                 type: object
   *     responses:
   *       200:
   *         description: Demande de déverrouillage créée
   */
  async createUnlockRequest(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const { bikeId, metadata } = req.body;

      if (!bikeId) {
        return res.status(400).json({
          success: false,
          message: 'bikeId est requis'
        });
      }

      const request = await BikeRequestService.createUnlockRequest(userId, bikeId, metadata, req);

      await logActivity(
        userId,
        'CREATE',
        'UNLOCK_REQUEST',
        request.id,
        `Requested unlock for bike ${bikeId}`,
        { bikeId, hasInspectionData: !!metadata },
        req
      );

      return res.json({
        success: true,
        message: 'Demande de déverrouillage envoyée',
        data: request
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /bike-requests/lock:
   *   post:
   *     summary: Créer une demande de verrouillage
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - bikeId
   *             properties:
   *               bikeId:
   *                 type: string
   *               rideId:
   *                 type: string
   *               location:
   *                 type: object
   *               metadata:
   *                 type: object
   *     responses:
   *       200:
   *         description: Demande de verrouillage créée
   */
  async createLockRequest(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const { bikeId, rideId, location, metadata } = req.body;

      const request = await BikeRequestService.createLockRequest(userId, bikeId, rideId, location, metadata, req);

      await logActivity(
        userId,
        'CREATE',
        'LOCK_REQUEST',
        request.id,
        `Requested lock for bike ${bikeId}`,
        { bikeId, rideId },
        req
      );

      res.json({
        success: true,
        message: 'Demande de verrouillage envoyée',
        data: request
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /bike-requests/unlock/{id}:
   *   delete:
   *     summary: Supprimer une demande de déverrouillage
   *     tags: [BikeRequests]
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
   *         description: Demande supprimée
   */
  async deleteUnlockRequest(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const request = await prisma.unlockRequest.findFirst({
        where: {
          id,
          userId,
          status: 'PENDING'
        }
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée ou ne peut être supprimée'
        });
      }

      await prisma.unlockRequest.delete({
        where: { id }
      });

      await logActivity(
        userId,
        'DELETE',
        'UNLOCK_REQUEST',
        id,
        'User deleted their unlock request',
        { requestId: id },
        req
      );

      return res.json({
        success: true,
        message: 'Demande de déverrouillage supprimée'
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
   * /bike-requests/lock/{id}:
   *   delete:
   *     summary: Supprimer une demande de verrouillage
   *     tags: [BikeRequests]
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
   *         description: Demande supprimée
   */
  async deleteLockRequest(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const request = await prisma.lockRequest.findFirst({
        where: {
          id,
          userId,
          status: 'PENDING'
        }
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée ou ne peut être supprimée'
        });
      }

      await prisma.lockRequest.delete({
        where: { id }
      });

      await logActivity(
        userId,
        'DELETE',
        'LOCK_REQUEST',
        id,
        'User deleted their lock request',
        { requestId: id },
        req
      );

      return res.json({
        success: true,
        message: 'Demande de verrouillage supprimée'
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
   * /bike-requests/unlock:
   *   get:
   *     summary: Obtenir les demandes de déverrouillage de l'utilisateur
   *     tags: [BikeRequests]
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
   *     responses:
   *       200:
   *         description: Liste des demandes de déverrouillage
   */
  async getUserUnlockRequests(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        prisma.unlockRequest.findMany({
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
        prisma.unlockRequest.count({ where: { userId } })
      ]);

      const validatedByUserIds = requests
        .filter(req => req.validatedBy)
        .map(req => req.validatedBy) as string[];

      let validators: any[] = [];
      if (validatedByUserIds.length > 0) {
        validators = await prisma.user.findMany({
          where: { id: { in: validatedByUserIds } },
          select: { id: true, firstName: true, lastName: true }
        });
      }

      const validatorMap = validators.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);

      const enrichedRequests = requests.map(request => ({
        ...request,
        validatedByUser: request.validatedBy ? validatorMap[request.validatedBy] : null
      }));

      await logActivity(
        userId,
        'VIEW',
        'USER_UNLOCK_REQUESTS',
        '',
        'Viewed unlock requests history',
        { page, limit, total },
        req
      );

      res.json({
        success: true,
        data: enrichedRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
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
   * /bike-requests/lock:
   *   get:
   *     summary: Obtenir les demandes de verrouillage de l'utilisateur
   *     tags: [BikeRequests]
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
   *     responses:
   *       200:
   *         description: Liste des demandes de verrouillage
   */
  async getUserLockRequests(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [requests, total] = await Promise.all([
        prisma.lockRequest.findMany({
          where: { userId },
          include: {
            bike: {
              select: {
                id: true,
                code: true,
                model: true
              }
            },
            ride: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                cost: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.lockRequest.count({ where: { userId } })
      ]);

      const validatedByUserIds = requests
        .filter(req => req.validatedBy)
        .map(req => req.validatedBy) as string[];

      let validators: any[] = [];
      if (validatedByUserIds.length > 0) {
        validators = await prisma.user.findMany({
          where: { id: { in: validatedByUserIds } },
          select: { id: true, firstName: true, lastName: true }
        });
      }

      const validatorMap = validators.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);

      const enrichedRequests = requests.map(request => ({
        ...request,
        validatedByUser: request.validatedBy ? validatorMap[request.validatedBy] : null
      }));

      await logActivity(
        userId,
        'VIEW',
        'USER_LOCK_REQUESTS',
        '',
        'Viewed lock requests history',
        { page, limit, total },
        req
      );

      res.json({
        success: true,
        data: enrichedRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
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
   * /bike-requests/all:
   *   get:
   *     summary: Obtenir toutes les demandes de l'utilisateur (déverrouillage + verrouillage)
   *     tags: [BikeRequests]
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
   *     responses:
   *       200:
   *         description: Liste de toutes les demandes
   */
  async getAllUserRequests(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [unlockRequests, lockRequests, unlockTotal, lockTotal] = await Promise.all([
        prisma.unlockRequest.findMany({
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
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.lockRequest.findMany({
          where: { userId },
          include: {
            bike: {
              select: {
                id: true,
                code: true,
                model: true
              }
            },
            ride: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                cost: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.unlockRequest.count({ where: { userId } }),
        prisma.lockRequest.count({ where: { userId } })
      ]);

      const allValidatedByIds = [
        ...unlockRequests.filter(req => req.validatedBy).map(req => req.validatedBy),
        ...lockRequests.filter(req => req.validatedBy).map(req => req.validatedBy)
      ].filter(Boolean) as string[];

      let validators: any[] = [];
      if (allValidatedByIds.length > 0) {
        validators = await prisma.user.findMany({
          where: { id: { in: allValidatedByIds } },
          select: { id: true, firstName: true, lastName: true }
        });
      }

      const validatorMap = validators.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);

      const allRequests = [
        ...unlockRequests.map(req => ({ 
          ...req, 
          type: 'unlock' as const,
          validatedByUser: req.validatedBy ? validatorMap[req.validatedBy] : null
        })),
        ...lockRequests.map(req => ({ 
          ...req, 
          type: 'lock' as const,
          validatedByUser: req.validatedBy ? validatorMap[req.validatedBy] : null
        }))
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
       .slice(0, limit);

      const total = unlockTotal + lockTotal;

      await logActivity(
        userId,
        'VIEW',
        'USER_ALL_REQUESTS',
        '',
        'Viewed all requests history',
        { page, limit, total },
        req
      );

      res.json({
        success: true,
        data: allRequests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
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
   * /bike-requests/{type}/pending:
   *   get:
   *     summary: Obtenir demandes en attente (admin)
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [unlock, lock]
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
   *         description: Liste des demandes en attente
   */
  async getPendingRequests(req: AuthRequest, res: express.Response) {
    try {
      const type = req.params.type as 'unlock' | 'lock';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await BikeRequestService.getPendingRequests(type, page, limit, req);

      res.json({
        success: true,
        data: result
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
   * /bike-requests/{type}/{id}:
   *   get:
   *     summary: Obtenir une demande spécifique par ID
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [unlock, lock]
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Détails de la demande
   */
  async getRequestById(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;
      const { id, type } = req.params;

      let request;
      if (type === 'unlock') {
        request = await prisma.unlockRequest.findFirst({
          where: { 
            id,
            userId 
          },
          include: {
            bike: {
              select: {
                id: true,
                code: true,
                model: true,
                status: true
              }
            }
          }
        });
      } else if (type === 'lock') {
        request = await prisma.lockRequest.findFirst({
          where: { 
            id,
            userId 
          },
          include: {
            bike: {
              select: {
                id: true,
                code: true,
                model: true,
                status: true
              }
            },
            ride: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                cost: true,
                duration: true
              }
            }
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Type de demande invalide'
        });
      }

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Demande non trouvée'
        });
      }

      if (request.validatedBy) {
        const validator = await prisma.user.findUnique({
          where: { id: request.validatedBy },
          select: { id: true, firstName: true, lastName: true }
        });
        
        request = {
          ...request,
          validatedByUser: validator
        };
      }

      await logActivity(
        userId,
        'VIEW',
        `${type.toUpperCase()}_REQUEST`,
        id,
        `Viewed ${type} request details`,
        null,
        req
      );

      return res.json({
        success: true,
        data: { ...request, type }
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
   * /bike-requests/approve/{type}/{id}:
   *   post:
   *     summary: Approuver une demande (admin)
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [unlock, lock]
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Demande approuvée
   */
  async approveRequest(req: AuthRequest, res: express.Response) {
    try {
      const adminId = req.user!.id;
      const { type, id } = req.params;

      let result;
      if (type === 'unlock') {
        result = await BikeRequestService.approveUnlockRequest(id, adminId);
      } else {
        result = await BikeRequestService.approveLockRequest(id, adminId);
      }

      await logActivity(
        adminId,
        'UPDATE',
        `${type.toUpperCase()}_REQUEST`,
        id,
        `Approved ${type} request`,
        { requestId: id },
        req
      );

      res.json({
        success: true,
        message: `Demande de ${type === 'unlock' ? 'déverrouillage' : 'verrouillage'} approuvée`,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /bike-requests/reject/{type}/{id}:
   *   post:
   *     summary: Rejeter une demande (admin)
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [unlock, lock]
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
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Demande rejetée
   */
  async rejectRequest(req: AuthRequest, res: express.Response) {
    try {
      const adminId = req.user!.id;
      const { type, id } = req.params;
      const { reason } = req.body;

      let result;
      if (type === 'unlock') {
        result = await BikeRequestService.rejectUnlockRequest(id, adminId, reason);
      } else {
        result = await BikeRequestService.rejectLockRequest(id, adminId, reason);
      }

      await logActivity(
        adminId,
        'UPDATE',
        `${type.toUpperCase()}_REQUEST`,
        id,
        `Rejected ${type} request`,
        { requestId: id, reason },
        req
      );

      res.json({
        success: true,
        message: `Demande de ${type === 'unlock' ? 'déverrouillage' : 'verrouillage'} rejetée`,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * @swagger
   * /bike-requests/stats:
   *   get:
   *     summary: Obtenir les statistiques des demandes pour l'utilisateur
   *     tags: [BikeRequests]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Statistiques des demandes
   */
  async getUserRequestStats(req: AuthRequest, res: express.Response) {
    try {
      const userId = req.user!.id;

      const [
        totalUnlockRequests,
        pendingUnlockRequests,
        approvedUnlockRequests,
        totalLockRequests,
        pendingLockRequests,
        approvedLockRequests
      ] = await Promise.all([
        prisma.unlockRequest.count({ where: { userId } }),
        prisma.unlockRequest.count({ where: { userId, status: 'PENDING' } }),
        prisma.unlockRequest.count({ where: { userId, status: 'APPROVED' } }),
        prisma.lockRequest.count({ where: { userId } }),
        prisma.lockRequest.count({ where: { userId, status: 'PENDING' } }),
        prisma.lockRequest.count({ where: { userId, status: 'APPROVED' } })
      ]);

      const stats = {
        unlock: {
          total: totalUnlockRequests,
          pending: pendingUnlockRequests,
          approved: approvedUnlockRequests,
          rejected: totalUnlockRequests - pendingUnlockRequests - approvedUnlockRequests
        },
        lock: {
          total: totalLockRequests,
          pending: pendingLockRequests,
          approved: approvedLockRequests,
          rejected: totalLockRequests - pendingLockRequests - approvedLockRequests
        },
        total: totalUnlockRequests + totalLockRequests
      };

      await logActivity(
        userId,
        'VIEW',
        'USER_REQUEST_STATS',
        '',
        'Viewed request statistics',
        { stats },
        req
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new BikeRequestController();