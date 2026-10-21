/**
 * Digiflazz Transaction Test Script
 * Sesuai dokumentasi: https://developer.digiflazz.com/api/buyer/topup/
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const crypto = require('crypto');

async function testDigiflazzTransaction() {
  const username = process.env.DIGIFLAZZ_USERNAME;
  const apiKey = process.env.DIGIFLAZZ_KEY;
  if (!username || !apiKey) {
    console.error('Error: DIGIFLAZZ_USERNAME dan DIGIFLAZZ_KEY harus diatur di .env');
    return;
  }
  const customerNo = '087800001232'; // Nomor tujuan test
  const buyerSkuCode = 'xld10';       // Kode produk test
  const refId = `test_${Date.now()}`;  // Unique Ref ID

  // Formula signature: md5(username + apiKey + ref_id)
  const sign = crypto.createHash('md5').update(`${username}${apiKey}${refId}`).digest('hex');

  const requestPayload = {
    username: username,
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    sign: sign,
    testing: true
  };

  console.log('====================================================');
  console.log('🚀 DIGIFLAZZ TRANSACTION API REQUEST TEST');
  console.log('====================================================');
  console.log('Endpoint : https://api.digiflazz.com/v1/transaction');
  console.log('Method   : POST');
  console.log('Header   : Content-Type: application/json\n');
  console.log('--- REQUEST BODY ---');
  console.log(JSON.stringify(requestPayload, null, 2));
  console.log('--------------------\n');

  try {
    const startTime = Date.now();
    const response = await fetch('https://api.digiflazz.com/v1/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    const elapsed = Date.now() - startTime;
    const resData = await response.json();

    console.log(`--- RESPONSE STATUS (HTTP ${response.status}) [${elapsed}ms] ---`);
    console.log(JSON.stringify(resData, null, 2));
    console.log('====================================================\n');

    if (resData.data) {
      console.log('📌 RINGKASAN RESPONSE:');
      console.log(`- Ref ID      : ${resData.data.ref_id}`);
      console.log(`- Status      : ${resData.data.status}`);
      console.log(`- RC (Code)   : ${resData.data.rc}`);
      console.log(`- Message     : ${resData.data.message}`);
      console.log(`- Customer No : ${resData.data.customer_no}`);
      console.log(`- Buyer SKU   : ${resData.data.buyer_sku_code}`);
    }

    return resData;
  } catch (error) {
    console.error('❌ Request error:', error.message);
    throw error;
  }
}

testDigiflazzTransaction();
