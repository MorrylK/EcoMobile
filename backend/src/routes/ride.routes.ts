import express from 'express';
import { RideController } from '../controllers/RideController';
import { authenticate } from '../middleware/auth';
import { startRideValidator, endRideValidator, idValidator, validate } from '../middleware/validator';

const router = express.Router();
const rideController = new RideController();

/**
 * @route   POST /api/v1/rides/start
 * @desc    Start a ride
 * @access  Private
 */
router.post('/start', authenticate, startRideValidator, validate, rideController.startRide);

/**
 * @route   POST /api/v1/rides/:id/end
 * @desc    End a ride
 * @access  Private
 */
router.post('/:id/end', authenticate, idValidator, endRideValidator, validate, rideController.endRide);

/**
 * @route   POST /api/v1/rides/:id/cancel
 * @desc    Cancel a ride
 * @access  Private
 */
router.post('/:id/cancel', authenticate, idValidator, validate, rideController.cancelRide);

/**
 * @route   GET /api/v1/rides/:id/details
 * @desc    Get ride details with GPS track
 * @access  Private
 */
router.get('/:id/details', authenticate, idValidator, validate, rideController.getRideDetails);

/**
 * @route   POST /api/v1/rides/:id/report-issue
 * @desc    Report an issue for a ride
 * @access  Private
 */
router.post('/:id/report-issue', authenticate, idValidator, validate, rideController.reportIssue);

/**
 * @route   GET /api/v1/rides/estimate
 * @desc    Get ride cost estimate
 * @access  Private
 */
router.get('/estimate', authenticate, rideController.getRideEstimate);

/**
 * @route   GET /api/v1/rides/stats
 * @desc    Get user's ride statistics
 * @access  Private
 */
router.get('/stats', authenticate, rideController.getRideStats);

/**
 * @route   GET /api/v1/rides
 * @desc    Get user's rides
 * @access  Private
 */
router.get('/', authenticate, rideController.getUserRides);

/**
 * @route   GET /api/v1/rides/active
 * @desc    Get active ride
 * @access  Private
 */
router.get('/active', authenticate, rideController.getActiveRide);

export default router;