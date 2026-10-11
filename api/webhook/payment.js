const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const webhookController = require('../../backend/src/controllers/webhook.controller');
const { initDatabase } = require('../../backend/src/config/db');

let dbInitialized = false;

module.exports = async function handler(req, res) {
  // CORS & Health check support for ping tests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-signature');

  if (req.method === 'OPTIONS' || req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      status: 'ok',
      message: 'Midtrans Payment Webhook Endpoint is live and operational'
    });
  }

  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (e) {
      console.error('[DB] Serverless webhook init error:', e.message);
    }
  }

  // Parse body if delivered as string
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      try {
        req.body = Object.fromEntries(new URLSearchParams(req.body));
      } catch (_) {}
    }
  }

  if (req.method === 'POST') {
    return webhookController.handlePaymentWebhook(req, res);
  } else {
    res.setHeader('Allow', ['POST', 'GET', 'HEAD', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
};
