require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('='.repeat(95));
  console.log("            DAR'SSTORE - POSTGRESQL DATABASE MANAGEMENT (SUPABASE CLOUD)");
  console.log('='.repeat(95));
  console.log('[Database Engine]  : PostgreSQL 17.6 (Supabase Cloud Pooler)');
  console.log('[Connection Host]  : aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres');
  console.log('[SSL Encryption]   : TLS Enabled (Pooler Mode)');
  console.log('');

  try {
    // 1. Table Counts
    const tables = ['orders', 'products', 'users', 'payment_logs', 'store_settings'];
    console.log('[Database Schema & Table Summary]');
    for (const t of tables) {
      const res = await pool.query(`SELECT COUNT(*) FROM ${t};`);
      console.log(`  - public.${t.padEnd(16)} : ${res.rows[0].count} records`);
    }
    console.log('');

    // 2. Query Orders
    console.log('[Active Query] SELECT id, invoice_number, game, nama_item, total_harga, status, payment_method, created_at FROM orders ORDER BY id DESC LIMIT 5;');
    console.log('-'.repeat(95));
    const ordersRes = await pool.query(`
      SELECT id, invoice_number, game, nama_item, total_harga, status, payment_method, created_at 
      FROM orders 
      ORDER BY id DESC 
      LIMIT 5;
    `);
    
    console.log(
      'ID'.padEnd(5) + 
      'Invoice Number'.padEnd(20) + 
      'Game'.padEnd(8) + 
      'Item Name'.padEnd(35) + 
      'Total (Rp)'.padEnd(14) + 
      'Status'
    );
    console.log('-'.repeat(95));
    for (const r of ordersRes.rows) {
      console.log(
        String(r.id).padEnd(5) + 
        String(r.invoice_number).padEnd(20) + 
        String(r.game || '-').padEnd(8) + 
        String(r.nama_item || '-').slice(0, 32).padEnd(35) + 
        String(Number(r.total_harga).toLocaleString('id-ID')).padEnd(14) + 
        String(r.status)
      );
    }
    console.log('='.repeat(95));
  } catch (err) {
    console.error('Database query error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
