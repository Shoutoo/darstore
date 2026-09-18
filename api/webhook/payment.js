const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const webhookController = require('../../backend/src/controllers/webhook.controller');
const { initDatabase } = require('../../backend/src/config/db');

let dbInitialized = false;

module.exports = async function handler(req, res) {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (e) {
      console.error('[DB] Serverless webhook init error:', e.message);
    }
  }

  if (req.method === 'POST') {
    return webhookController.handlePaymentWebhook(req, res);
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
};
