const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

function isProduction() {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase().trim();
  const midtransProd = (process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase().trim();
  return nodeEnv === 'production' || vercelEnv === 'production' || midtransProd === 'true';
}

router.all('/payment', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'Midtrans Payment Webhook is active' });
  }
  next();
});
router.post('/payment', webhookController.handlePaymentWebhook);

// Simulation endpoint: strictly unavailable in production (returns HTTP 404)
router.all('/simulate-payment', (req, res, next) => {
  if (isProduction()) {
    return res.status(404).json({ error: 'Endpoint simulasi tidak tersedia pada environment production.' });
  }
  if (req.method === 'POST') {
    return webhookController.simulatePayment(req, res);
  }
  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ error: 'Method not allowed' });
});

router.all('/digiflazz', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'Digiflazz Webhook is active' });
  }
  next();
});
router.post('/digiflazz', webhookController.handleDigiflazzWebhook);

module.exports = router;

