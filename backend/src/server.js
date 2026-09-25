const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const productRoutes = require('./routes/product.routes');
const webhookRoutes = require('./routes/webhook.routes');
const adminRoutes = require('./routes/admin.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const { supabase } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Public contact settings for storefront footer and contact modal
app.get('/api/settings/contact', async (req, res) => {
  try {
    const { dbAsync } = require('./config/db');
    const rows = await dbAsync.all("SELECT key, value FROM store_settings WHERE key IN ('cs_whatsapp', 'cs_email', 'store_name')");
    const settings = {
      cs_whatsapp: '081234567890',
      cs_email: 'support@darstore.com',
      store_name: "Dar'sstore"
    };
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (e) {
    res.json({
      success: true,
      settings: { cs_whatsapp: '081234567890', cs_email: 'support@darstore.com', store_name: "Dar'sstore" }
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: "Dar'sstore Backend API", version: '1.0.0', time: new Date() });
});

// Start server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`  DAR'SSTORE BACKEND SERVER RUNNING       `);
      console.log(`  URL: http://localhost:${PORT}           `);
      console.log(`  Health: http://localhost:${PORT}/api/health`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
} else {
  initDatabase().catch(err => console.error('[DB] Init error in serverless:', err));
}

module.exports = app;

