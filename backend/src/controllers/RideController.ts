import express from 'express';
import { AuthRequest, logActivity } from '../middleware/auth';
import { RideService } from '../services';
import { asyncHandler } from '../middleware/errorHandler';
import { t } from '../locales';
import { prisma } from '../config/prisma';

export class RideController {
  private rideService: RideService;

  constructor() {
    this.rideService = new RideService();
  }

  /**
   * @swagger
   * /rides/start:
   *   post:
   *     summary: Démarrer un nouveau trajet
   *     tags: [Rides]
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
   *               - startLocation
   *             properties:
   *               bikeId:
   *                 type: string
   *                 description: ID du vélo pour démarrer le trajet
   *                 example: "bike_123456"
   *               startLocation:
   *                 type: object
   *                 required:
   *                   - latitude
   *                   - longitude
   *                   - address
   *                 properties:
   *                   latitude:
   *                     type: number
   *                     format: float
   *                     example: 4.0511
   *                   longitude:
   *                     type: number
   *                     format: float
   *                     example: 9.7679
   *                   address:
   *                     type: string
   *                     example: "Carrefour Etoa Meki, Yaoundé, Cameroun"
   *     responses:
   *       201:
   *         description: Trajet démarré avec succès
   */
  startRide = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const language = req.language || 'fr';
    const userId = req.user!.id;
    const { bikeId, startLocation } = req.body;

    const ride = await this.rideService.startRide(userId, bikeId, startLocation, language);

    await logActivity(
      userId,
      'CREATE',
      'RIDE',
      ride.id,
      `Started ride with bike ${bikeId}`,
      { rideId: ride.id, bikeId, startLocation },
      req
    );

    res.status(201).json({
      success: true,
      message: t('ride.started', language),
      data: ride
    });
  });

  /**
   * @swagger
   * /rides/{id}/end:
   *   put:
   *     summary: Terminer un trajet actif
   *     tags: [Rides]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID du trajet
   *         example: "ride_123456"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - endLocation
   *             properties:
   *               endLocation:
   *                 type: object
   *                 required:
   *                   - latitude
   *                   - longitude
   *                   - address
   *                 properties:
   *                   latitude:
   *                     type: number
   *                     format: float
   *                     example: 4.0611
   *                   longitude:
   *                     type: number
   *                     format: float
   *                     example: 9.7779
   *                   address:
   *                     type: string
   *                     example: "Marché Central, Yaoundé, Cameroun"
   *     responses:
   *       200:
   *         description: Trajet terminé avec succès
   */
  endRide = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const language = req.language || 'fr';
    const { id } = req.params;
    const { endLocation } = req.body;

    const ride = await this.rideService.endRide(id, endLocation, language);

    await logActivity(
      req.user!.id,
      'UPDATE',
      'RIDE',
      id,
      `Ended ride with cost: ${ride.cost} FCFA`,
      { rideId: id, endLocation, cost: ride.cost, duration: ride.duration },
      req
    );

    res.status(200).json({
      success: true,
      message: t('ride.ended', language),
      data: ride
    });
  });

  /**
   * @swagger
   * /rides/{id}/cancel:
   *   post:
   *     summary: Cancel an active ride
   *     tags: [Rides]
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
   *         description: Ride cancelled successfully
   */
  cancelRide = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const language = req.language || 'fr';
    const userId = req.user!.id;
    const { id } = req.params;

    const ride = await this.rideService.cancelRide(id, userId, language);

    await logActivity(
      userId,
      'UPDATE',
      'RIDE',
      id,
      'Cancelled ride',
      { rideId: id, previousStatus: 'IN_PROGRESS', newStatus: 'CANCELLED' },
      req
    );

    res.status(200).json({
      success: true,
      message: t('ride.cancelled', language),
      data: ride
    });
  });

  /**
   * @swagger
   * /rides/{id}/details:
   *   get:
   *     summary: Get detailed ride information with GPS track
   *     tags: [Rides]
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
   *         description: Ride details retrieved successfully
   */
  getRideDetails = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const { id } = req.params;
    
    const ride = await this.rideService.getRideById(id);
    
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    await logActivity(
      req.user!.id,
      'VIEW',
      'RIDE',
      id,
      'Viewed ride details',
      { rideId: id, status: ride.status },
      req
    );

    return res.status(200).json({
      success: true,
      data: ride
    });
  });

  /**
   * @swagger
   * /rides/stats:
   *   get:
   *     summary: Get user's ride statistics
   *     tags: [Rides]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Ride statistics retrieved successfully
   */
  getRideStats = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const userId = req.user!.id;
    
    const stats = await this.rideService.getRideStats(userId);

    await logActivity(
      userId,
      'VIEW',
      'RIDE_STATS',
      '',
      'Viewed ride statistics',
      { totalRides: stats.totalRides, totalDistance: stats.totalDistance },
      req
    );

    res.status(200).json({
      success: true,
      data: stats
    });
  });

  /**
   * @swagger
   * /rides/history:
   *   get:
   *     summary: Obtenir l'historique des trajets de l'utilisateur
   *     tags: [Rides]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Numéro de page pour la pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *         description: Nombre de trajets par page
   *     responses:
   *       200:
   *         description: Historique des trajets récupéré avec succès
   */
  getUserRides = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const rides = await this.rideService.getUserRides(userId, page, limit);

    await logActivity(
      userId,
      'VIEW',
      'RIDE_HISTORY',
      '',
      `Viewed ride history (page ${page})`,
      { page, limit, total: rides.rides.length },
      req
    );

    res.status(200).json({
      success: true,
      data: rides
    });
  });

  /**
   * @swagger
   * /rides/active:
   *   get:
   *     summary: Obtenir le trajet actif de l'utilisateur
   *     tags: [Rides]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Trajet actif récupéré avec succès
   */
  getActiveRide = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const language = req.language || 'fr';
    const userId = req.user!.id;

    const ride = await this.rideService.getActiveRide(userId, language);

    await logActivity(
      userId,
      'VIEW',
      'ACTIVE_RIDE',
      ride?.id || '',
      ride ? 'Viewed active ride' : 'No active ride found',
      { hasActiveRide: !!ride },
      req
    );

    res.status(200).json({
      success: true,
      data: ride
    });
  });

  reportIssue = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const language = req.language || 'fr';
    const userId = req.user!.id;
    const { id } = req.params;
    const { type, description } = req.body;

    const ride = await prisma.ride.findFirst({ where: { id, userId } });

    if (!ride) {
      return res.status(404).json({ success: false, message: t('ride.not_found', language) });
    }

    const incident = await prisma.incident.create({
      data: {
        type: type || 'OTHER',
        description: description || '',
        bikeId: ride.bikeId,
        userId,
        status: 'OPEN'
      }
    });

    await logActivity(userId, 'CREATE', 'INCIDENT', incident.id, `Issue reported for ride ${id}`, { rideId: id, type }, req);

    return res.status(201).json({ success: true, message: t('incidents.created_success', language), data: incident });
  });

  getRideEstimate = asyncHandler(async (req: AuthRequest, res: express.Response) => {
    const duration = parseFloat(req.query.duration as string) || 0;
    const distance = parseFloat(req.query.distance as string) || 0;

    const pricingConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
    const hourlyRate = pricingConfig?.baseHourlyRate ?? 200;
    const unlockFee = pricingConfig?.unlockFee ?? 0;

    const durationHours = duration / 60;
    const cost = Math.ceil(unlockFee + durationHours * hourlyRate);

    res.status(200).json({ success: true, data: { cost, hourlyRate, unlockFee, duration, distance } });
  });
}