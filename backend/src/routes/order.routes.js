const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { optionalToken } = require('../middlewares/auth.middleware');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

router.post('/', rateLimit({ max: 30 }), optionalToken, orderController.createOrder);
router.get('/', optionalToken, orderController.getOrder);
router.get('/track/:invoice', optionalToken, (req, res) => {
  req.query.invoice = req.params.invoice;
  return orderController.getOrder(req, res);
});
router.get('/history', orderController.getOrderHistory);
router.get('/public/recent', orderController.getOrderHistory);
router.get('/products', orderController.getProducts);
router.get('/leaderboard', require('../controllers/leaderboard.controller').getLeaderboard);

module.exports = router;
