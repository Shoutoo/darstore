const express = require('express');
const router = express.Router();
const requireAdmin = require('../middlewares/isAdmin.middleware');
const adminController = require('../controllers/admin.controller');

// Protect all admin endpoints with requireAdmin
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);

// Products
router.get('/products', adminController.getProducts);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.post('/orders/:id/complete', adminController.completeOrder);
router.post('/orders/:id/retry', adminController.retryOrder);
router.post('/orders/:id/cancel', adminController.cancelOrder);

// Users
router.get('/users', adminController.getUsers);
router.post('/users/:id/points/adjust', adminController.adjustUserPoints);
router.post('/users/:id/toggle-block', adminController.toggleBlockUser);

// Providers & Payment
router.get('/provider/balance', adminController.getProviderBalance);
router.get('/payment-settings', adminController.getPaymentSettings);

// Reports
router.get('/reports', adminController.getReports);
router.get('/reports/export', adminController.exportReportsCSV);

// Logs
router.get('/logs', adminController.getAdminLogs);

// Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;
