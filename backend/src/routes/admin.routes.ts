import express from 'express';
import subscriptionPackageAdminRoutes from './subscription-package.routes';
import AdminController from '../controllers/AdminController';
import ReservationController from '../controllers/ReservationController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administration endpoints
 */

/**
 * @route   GET /api/v1/admin/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private/Admin
 */
router.get('/dashboard/stats', requirePermission('admin', 'read'), AdminController.getDashboardStats);

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard data
 * @access  Private/Admin
 */
router.get('/dashboard', requirePermission('admin', 'read'), AdminController.getDashboardStats);

/**
 * @route   GET /api/v1/admin/dashboard/complete
 * @desc    Get complete dashboard data (stats, trips, incidents, GPS) in a single request
 * @access  Private/Admin
 */
router.get('/dashboard/complete', requirePermission('admin', 'read'), AdminController.getDashboardComplete);

/**
 * @route   GET /api/v1/admin/reservations
 * @desc    Get all reservations (Admin only)
 * @access  Private/Admin
 */
router.get('/reservations', authenticate, requirePermission('reservations', 'read'), ReservationController.getAllReservations);

/**
 * @route   GET /api/v1/admin/unlock-requests
 * @desc    Get unlock requests (Admin only)
 * @access  Private/Admin
 */
router.get('/unlock-requests', authenticate, requirePermission('bikes', 'manage'), ReservationController.getUnlockRequests);

/**
 * @route   PUT /api/v1/admin/unlock-requests/:id/validate
 * @desc    Validate unlock request (Admin only)
 * @access  Private/Admin
 */
router.put('/unlock-requests/:id/validate', authenticate, requirePermission('bikes', 'manage'), ReservationController.validateUnlockRequest);

/**
 * @route   GET /api/v1/admin/lock-requests
 * @desc    Get lock requests (Admin only)
 * @access  Private/Admin
 */
router.get('/lock-requests', authenticate, requirePermission('bikes', 'manage'), ReservationController.getLockRequests);

/**
 * @route   PUT /api/v1/admin/lock-requests/:id/validate
 * @desc    Validate lock request (Admin only)
 * @access  Private/Admin
 */
router.put('/lock-requests/:id/validate', authenticate, requirePermission('bikes', 'manage'), ReservationController.validateLockRequest);

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get application settings
 * @access  Private/Admin
 */
router.get('/settings', requirePermission('settings', 'read'), AdminController.getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update application settings
 * @access  Private/Admin
 */
router.put('/settings', requirePermission('settings', 'update'), AdminController.updateSettings);

/**
 * @route   GET /api/v1/admin/pricing
 * @desc    Get pricing configuration
 * @access  Private/Admin
 */
// Keep legacy pricing endpoints for compatibility (some frontend code still calls these)
router.get('/pricing', requirePermission('pricing', 'read'), AdminController.getPricing);
router.put('/pricing', requirePermission('pricing', 'update'), AdminController.updatePricing);

// PricingTier (tarification sans forfait)
router.get('/pricing/tiers', requirePermission('pricing', 'read'), AdminController.getPricingTiers);
router.post('/pricing/tiers', requirePermission('pricing', 'create'), AdminController.createPricingTier);
router.get('/pricing/tiers/conflicts', requirePermission('pricing', 'read'), AdminController.getPricingTierConflicts);
router.put('/pricing/tiers/:id', requirePermission('pricing', 'update'), AdminController.updatePricingTier);
router.delete('/pricing/tiers/:id', requirePermission('pricing', 'delete'), AdminController.deletePricingTier);
router.put('/pricing/tiers/:id/toggle', requirePermission('pricing', 'update'), AdminController.togglePricingTierActive);
router.put('/pricing/fallback', requirePermission('pricing', 'update'), AdminController.updateFallbackRate);

// Legacy promotions endpoints (kept for backward compatibility)
router.get('/promotions', requirePermission('pricing', 'read'), AdminController.getPromotions);
router.post('/promotions', requirePermission('pricing', 'create'), AdminController.createPromotion);
router.put('/promotions/:id', requirePermission('pricing', 'update'), AdminController.updatePromotion);
router.put('/promotions/:id/status', requirePermission('pricing', 'update'), AdminController.togglePromotionStatus);
router.delete('/promotions/:id', requirePermission('pricing', 'delete'), AdminController.deletePromotion);

// Mount new subscription package admin routes (CRUD for packages/formulas/promotions)
router.use('/pricing', subscriptionPackageAdminRoutes);

/**
 * @route   GET /api/v1/admin/financial/stats
 * @desc    Get financial statistics
 * @access  Private/Admin
 */
router.get('/financial/stats', requirePermission('wallet', 'read'), AdminController.getFinancialStats);

/**
 * @route   GET /api/v1/admin/financial/data
 * @desc    Get financial chart data
 * @access  Private/Admin
 */
router.get('/financial/data', requirePermission('wallet', 'read'), AdminController.getFinancialData);

/**
 * @route   GET /api/v1/admin/financial/transactions
 * @desc    Get transaction summary
 * @access  Private/Admin
 */
router.get('/financial/transactions', requirePermission('wallet', 'view_transactions'), AdminController.getFinancialTransactions);

/**
 * @route   GET /api/v1/admin/financial/export
 * @desc    Export financial data
 * @access  Private/Admin
 */
router.get('/financial/export', requirePermission('wallet', 'export'), AdminController.exportFinancialData);

/**
 * @route   GET /api/v1/admin/incidents
 * @desc    Get all incidents
 * @access  Private/Admin
 */
router.get('/incidents', requirePermission('incidents', 'read'), AdminController.getIncidents);

/**
 * @route   PUT /api/v1/admin/incidents/:id
 * @desc    Update incident status
 * @access  Private/Admin
 */
router.put('/incidents/:id', requirePermission('incidents', 'update'), AdminController.updateIncident);

/**
 * @route   GET /api/v1/admin/reviews
 * @desc    Get all reviews (Admin only)
 * @access  Private/Admin
 */
router.get('/reviews', requirePermission('reviews', 'read'), AdminController.getAllReviews);

/**
 * @route   POST /api/v1/admin/reviews
 * @desc    Create new review (Admin only)
 * @access  Private/Admin
 */
router.post('/reviews', requirePermission('reviews', 'create'), AdminController.createReview);

/**
 * @route   PUT /api/v1/admin/reviews/:id
 * @desc    Update review (Admin only)
 * @access  Private/Admin
 */
router.put('/reviews/:id', requirePermission('reviews', 'update'), AdminController.updateReview);

/**
 * @route   PUT /api/v1/admin/reviews/:id/moderate
 * @desc    Moderate review (Admin only)
 * @access  Private/Admin
 */
router.put('/reviews/:id/moderate', requirePermission('reviews', 'update'), AdminController.moderateReview);

/**
 * @route   DELETE /api/v1/admin/reviews/:id
 * @desc    Delete review (Admin only)
 * @access  Private/Admin
 */
router.delete('/reviews/:id', requirePermission('reviews', 'delete'), AdminController.deleteReview);

/**
 * @route   GET /api/v1/admin/activity-logs
 * @desc    Get system activity logs
 * @access  Private/Admin
 */
router.get('/activity-logs', requirePermission('logs', 'read'), AdminController.getActivityLogs);

/**
 * @route   GET /api/v1/admin/roles
 * @desc    Get all roles
 * @access  Private/Admin
 */
router.get('/roles', requirePermission('roles', 'read'), AdminController.getRoles);

/**
 * @route   POST /api/v1/admin/roles
 * @desc    Create new role
 * @access  Private/Admin
 */
router.post('/roles', requirePermission('roles', 'create'), AdminController.createRole);

/**
 * @route   PUT /api/v1/admin/roles/:id
 * @desc    Update role
 * @access  Private/Admin
 */
router.put('/roles/:id', requirePermission('roles', 'update'), AdminController.updateRole);

/**
 * @route   PUT /api/v1/admin/roles/:id/assign
 * @desc    Assign role to employees
 * @access  Private/Admin
 */
router.put('/roles/:id/assign', requirePermission('roles', 'update'), AdminController.assignRoleToEmployees);

/**
 * @route   DELETE /api/v1/admin/roles/:id
 * @desc    Delete role
 * @access  Private/Admin
 */
router.delete('/roles/:id', requirePermission('roles', 'delete'), AdminController.deleteRole);

/**
 * @route   GET /api/v1/admin/permissions
 * @desc    Get all permissions
 * @access  Private/Admin
 */
router.get('/permissions', requirePermission('permissions', 'read'), AdminController.getPermissions);

/**
 * @route   PUT /api/v1/admin/roles/:id/permissions
 * @desc    Update role permissions
 * @access  Private/Admin
 */
router.put('/roles/:id/permissions', requirePermission('roles', 'update'), AdminController.updateRolePermissions);

/**
 * @route   POST /api/v1/admin/users/:userId/reset-password
 * @desc    Reset user password
 * @access  Private/Admin
 */
router.post('/users/:userId/reset-password', requirePermission('users', 'update'), AdminController.resetUserPassword);

export default router;