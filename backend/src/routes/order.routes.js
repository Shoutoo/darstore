const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { optionalToken } = require('../middlewares/auth.middleware');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

router.post('/', rateLimit({ max: 30 }), optionalToken, orderController.createOrder);
router.get('/', orderController.getOrder);
router.get('/history', orderController.getOrderHistory);
router.get('/products', orderController.getProducts);

module.exports = router;
