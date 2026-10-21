const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

router.all('/payment', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'Midtrans Payment Webhook is active' });
  }
  next();
});
router.post('/payment', webhookController.handlePaymentWebhook);
router.post('/simulate-payment', webhookController.simulatePayment);
router.all('/digiflazz', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'Digiflazz Webhook is active' });
  }
  next();
});
router.post('/digiflazz', webhookController.handleDigiflazzWebhook);

module.exports = router;
