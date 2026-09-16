// In-memory sliding window rate limiter
const requestsMap = new Map();

function rateLimit(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute
  const max = options.max || 30; // 30 requests per minute
  const message = options.message || 'Terlalu banyak permintaan dari IP ini, silakan coba lagi beberapa saat lagi.';

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestsMap.has(ip)) {
      requestsMap.set(ip, []);
    }

    const timestamps = requestsMap.get(ip);
    // Remove expired timestamps
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    validTimestamps.push(now);
    requestsMap.set(ip, validTimestamps);

    if (validTimestamps.length > max) {
      return res.status(429).json({
        success: false,
        message
      });
    }

    next();
  };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestsMap.entries()) {
    const valid = timestamps.filter(ts => now - ts < 60000);
    if (valid.length === 0) {
      requestsMap.delete(ip);
    } else {
      requestsMap.set(ip, valid);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  rateLimit
};
