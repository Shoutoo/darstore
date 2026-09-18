const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const orderController = require('../../backend/src/controllers/order.controller');
const { initDatabase } = require('../../backend/src/config/db');

let dbInitialized = false;

module.exports = async function handler(req, res) {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (e) {
      console.error('[DB] Serverless init error:', e.message);
    }
  }

  if (req.method === 'POST') {
    return orderController.createOrder(req, res);
  } else if (req.method === 'GET') {
    if (req.query.history) {
      return orderController.getOrderHistory(req, res);
    }
    return orderController.getOrder(req, res);
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
};
