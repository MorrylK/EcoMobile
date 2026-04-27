import express from 'express';
import AdminController from '../controllers/AdminController';

const router = express.Router();

/**
 * @route   GET /api/v1/public/pricing
 * @desc    Get current pricing (public)
 * @access  Public
 */
router.get('/pricing', AdminController.getCurrentPricing);

/**
 * @route   GET /api/v1/public/app-version
 * @desc    Get app version manifest (native version + APK URL)
 * @access  Public
 */
router.get('/app-version', AdminController.getAppVersion);
router.get('/download', AdminController.downloadApp);

/**
 * @route   GET /api/v1/public/company
 * @desc    Get company information (public)
 * @access  Public
 */
router.get('/company', AdminController.getSettings);

/**
 * @route   GET /api/v1/public/reviews
 * @desc    Get approved reviews (public)
 * @access  Public
 */
router.get('/reviews', AdminController.getApprovedReviews);

/**
 * @route   POST /api/v1/public/reviews
 * @desc    Submit a review (public)
 * @access  Public
 */
router.post('/reviews', AdminController.submitReview);

export default router;