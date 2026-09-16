const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

router.post('/payment', webhookController.handlePaymentWebhook);
router.post('/simulate-payment', webhookController.simulatePayment);

module.exports = router;
