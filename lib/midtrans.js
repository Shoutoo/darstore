const midtransClient = require('midtrans-client');

const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-xxxxxxxxxxxxx',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-xxxxxxxxxxxxx',
});

module.exports = {
  coreApi,
  midtransClient,
};
module.exports.default = coreApi;
