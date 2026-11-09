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
      console.error('[DB] Serverless products init error:', e.message);
    }
  }

  if (req.method === 'GET') {
    return orderController.getProducts(req, res);
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
};

