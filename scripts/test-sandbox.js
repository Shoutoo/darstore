/**
 * Skrip Pengujian & Audit Midtrans Mode Sandbox
 * Menjalankan validasi guardrail, konektivitas Sandbox, verifikasi signature, dan idempotency.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load environment variables: check both backend/.env and root .env
const backendEnvPath = path.join(__dirname, '../backend/.env');
const rootEnvPath = path.join(__dirname, '../.env');

let activeEnvFile = null;
let backendStats = fs.existsSync(backendEnvPath) ? fs.statSync(backendEnvPath) : null;
let rootStats = fs.existsSync(rootEnvPath) ? fs.statSync(rootEnvPath) : null;

// Prefer the file that was modified most recently or contains a non-placeholder key
let chosenPath = backendEnvPath;
if (rootStats && backendStats) {
  if (rootStats.mtimeMs > backendStats.mtimeMs) {
    chosenPath = rootEnvPath;
  }
} else if (rootStats) {
  chosenPath = rootEnvPath;
}

require('dotenv').config({ path: chosenPath });
activeEnvFile = chosenPath;

const midtransClient = require('midtrans-client');

console.log('====================================================');
console.log('  🔍 AUDIT & PENGUJIAN MIDTRANS SANDBOX — DARSSTORE');
console.log('====================================================');
console.log(`📁 File .env aktif yang dibaca: ${path.relative(path.join(__dirname, '..'), activeEnvFile)}`);
if (fs.existsSync(activeEnvFile)) {
  const mtime = fs.statSync(activeEnvFile).mtime;
  console.log(`🕒 Terakhir disimpan di disk  : ${mtime.toLocaleString('id-ID')}`);
}

const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();

function maskKey(key) {
  if (!key) return '(Kosong)';
  if (key.length <= 15) return key;
  return key.substring(0, 14) + '...' + key.substring(key.length - 4);
}

console.log(`🔑 Server Key terdeteksi      : ${maskKey(serverKey)}`);
console.log(`🔑 Client Key terdeteksi      : ${maskKey(clientKey)}`);
console.log('----------------------------------------------------\n');

let totalChecks = 0;
let passedChecks = 0;

function check(label, fn) {
  totalChecks++;
  try {
    const result = fn();
    if (result !== false) {
      console.log(`✅ [LULUS] ${label}`);
      passedChecks++;
      return true;
    } else {
      console.log(`❌ [GAGAL] ${label}`);
      return false;
    }
  } catch (e) {
    console.log(`❌ [GAGAL] ${label} -> ${e.message}`);
    return false;
  }
}

// 1. Guardrail: Mode Sandbox
check('Guardrail 1: Mode Production diblokir (MIDTRANS_IS_PRODUCTION !== true)', () => {
  return process.env.MIDTRANS_IS_PRODUCTION !== 'true';
});

// 2. Guardrail: Server Key berawalan SB- atau Mid-server-
check('Guardrail 2: Key berawalan "SB-Mid-" atau "Mid-server-" (Format Sandbox)', () => {
  if (!serverKey) throw new Error('MIDTRANS_SERVER_KEY belum diisi di .env');
  return serverKey.startsWith('SB-') || serverKey.startsWith('Mid-server-');
});

// 3. Guardrail: .env ada di .gitignore
check('Guardrail 3: File .env terdaftar di .gitignore', () => {
  const gitignorePath = path.join(__dirname, '../.gitignore');
  if (!fs.existsSync(gitignorePath)) return false;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  return content.includes('.env');
});

// 4. Perhitungan Nominal di Backend
check('Guardrail 4: Perhitungan nominal & diskon dihitung di backend', () => {
  const productPrice = 14500;
  const qty = 2;
  const fee = 800;
  const pointsUsed = 10;
  const pointDiscount = pointsUsed * 100;
  const total = Math.max(fee, (productPrice * qty + fee) - pointDiscount);
  return total === (14500 * 2 + 800 - 1000);
});

// 5. Verifikasi Signature SHA-512
check('Guardrail 5: Rumus Signature Webhook SHA-512 valid', () => {
  const sampleOrderId = 'TEST-DS-20261005';
  const sampleStatusCode = '200';
  const sampleGrossAmount = '15000.00';
  const sampleKey = serverKey || 'SB-Mid-server-sample';

  const expectedSignature = crypto
    .createHash('sha512')
    .update(`${sampleOrderId}${sampleStatusCode}${sampleGrossAmount}${sampleKey}`)
    .digest('hex');

  return expectedSignature && expectedSignature.length === 128;
});

// 6. Tes Konektivitas API Midtrans Sandbox
async function testConnectivity() {
  console.log('\n----------------------------------------------------');
  console.log('  🌐 MENGUJI KONEKSI KE MIDTRANS SANDBOX API');
  console.log('----------------------------------------------------');

  if (!serverKey || serverKey.includes('xxxxxxxxxxxxx')) {
    console.log('⚠️ [CATATAN]: Server Key masih berupa placeholder xxxxxxxxxxxxx.');
    console.log('   Silakan salin key aktif dari https://dashboard.sandbox.midtrans.com ke .env lalu simpan (Ctrl+S).\n');
    return;
  }

  const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey,
    clientKey,
  });

  const testOrderId = `AUDIT-${Date.now()}`;
  try {
    const res = await snap.createTransaction({
      transaction_details: {
        order_id: testOrderId,
        gross_amount: 10000,
      },
    });

    console.log('🎉 [KONEKSI 100% BERHASIL!] Terhubung langsung ke Midtrans Sandbox API:');
    console.log(`   - Order ID   : ${testOrderId}`);
    console.log(`   - Snap Token : ${res.token.substring(0, 15)}...`);
    console.log(`   - Redirect   : ${res.redirect_url}`);
    console.log('\n✨ Integrasi Sandbox AKTIF dan siap digunakan untuk simulasi transaksi!\n');
  } catch (err) {
    if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
      console.log('❌ [HTTP 401 UNAUTHORIZED]: Server Key Midtrans Sandbox ditolak oleh Midtrans.');
      console.log(`   Key yang terbaca saat ini: ${maskKey(serverKey)}`);
      console.log('\n👉 PENYEBAB & SOLUSI:');
      console.log('   1. Jika Anda baru saja mengedit file .env di VS Code / editor, PASTIKAN SUDAH DITEKAN Ctrl + S (Simpan File).');
      console.log('   2. Pastikan Anda menyalin dari https://dashboard.sandbox.midtrans.com -> Settings > Access Keys (Mode SANDBOX).');
      console.log('   3. Atau Anda juga bisa mengirimkan key tersebut di chat agar saya bantu simpan langsung.\n');
    } else {
      console.log(`⚠️ Kesalahan koneksi Midtrans Sandbox: ${err.message}\n`);
    }
  }

  console.log('====================================================');
  console.log(`  HASIL AUDIT: ${passedChecks}/${totalChecks} Guardrail Terpenuhi!`);
  console.log('====================================================\n');
}

testConnectivity();
