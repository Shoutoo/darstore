const app = require('../backend/src/server');

// Vercel Serverless Catch-All Handler for all /api/* routes
module.exports = (req, res) => {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
