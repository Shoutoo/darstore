require('dotenv').config();
const { dbAsync } = require('../src/config/db');
const paymentGateway = require('../src/services/paymentGateway');

async function main() {
  const searchTerm = process.argv.slice(2).join(' ').trim();
  
  if (!searchTerm) {
    console.log('📌 Cara Penggunaan:');
    console.log('node backend/scripts/create_payment_link.js "<nama atau nominal produk>"');
    console.log('Contoh:');
    console.log('node backend/scripts/create_payment_link.js "475"');
    console.log('node backend/scripts/create_payment_link.js "Weekly Diamond Pass"');
    console.log('node backend/scripts/create_payment_link.js "50 Diamond"');
    process.exit(0);
  }

  console.log(`🔍 Mencari produk dengan kata kunci: "${searchTerm}"...`);
  const products = await dbAsync.all(
    "SELECT * FROM products WHERE nama_item ILIKE ? OR id ILIKE ? ORDER BY harga ASC LIMIT 5",
    [`%${searchTerm}%`, `%${searchTerm}%`]
  );

  if (!products || products.length === 0) {
    console.log('❌ Produk tidak ditemukan di database.');
    process.exit(1);
  }

  const product = products[0];
  console.log(`✅ Produk ditemukan: ${product.nama_item} (${product.game}) - Rp ${product.harga.toLocaleString('id-ID')}`);

  const invoiceNumber = `PLINK-${Date.now()}`;
  console.log(`🚀 Menghubungi Midtrans Production API untuk membuat Payment Link...`);

  const linkData = await paymentGateway.createPaymentLink(
    {
      invoice_number: invoiceNumber,
      total_harga: product.harga,
      nama_item: product.nama_item,
      product_id: product.id
    },
    {
      name: 'Pelanggan Darstore',
      email: 'customer@darstore.com',
      phone: '081234567890'
    }
  );

  console.log('\n======================================================');
  console.log('🎉 MIDTRANS LIVE PAYMENT LINK BERHASIL DIBUAT:');
  console.log('======================================================');
  console.log(`- Item         : ${product.nama_item}`);
  console.log(`- Harga        : Rp ${product.harga.toLocaleString('id-ID')}`);
  console.log(`- Order ID     : ${linkData.order_id}`);
  console.log(`- URL Bayar    : ${linkData.payment_url}`);
  console.log('======================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
