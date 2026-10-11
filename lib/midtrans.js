const midtransClient = require('midtrans-client');

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim() || 'SB-Mid-server-xxxxxxxxxxxxx';
const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim() || 'SB-Mid-client-xxxxxxxxxxxxx';

if (isProduction && serverKey.startsWith('SB-')) {
  console.warn('[MIDTRANS WARNING]: Server key diawali "SB-", pastikan menggunakan Server Key Production di mode Production.');
}

const coreApi = new midtransClient.CoreApi({
  isProduction,
  serverKey,
  clientKey,
});

const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey,
});

module.exports = {
  coreApi,
  snap,
  midtransClient,
};
module.exports.default = coreApi;
