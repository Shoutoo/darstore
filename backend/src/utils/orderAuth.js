const crypto = require('crypto');

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts client access token from request body, headers, or query parameters.
 */
function extractClientToken(req) {
  if (!req) return null;
  const bodyToken = req.body && (req.body.access_token || req.body.token);
  const headerToken = req.headers && (
    req.headers['x-order-token'] ||
    req.headers['x-access-token'] ||
    req.headers['access-token']
  );
  const queryToken = req.query && (req.query.access_token || req.query.token);
  return bodyToken || headerToken || queryToken || null;
}

/**
 * Masks contact string (phone or email) for privacy in public tracking views.
 */
function maskContact(contact) {
  if (!contact || typeof contact !== 'string') return '0812****890';
  const str = contact.trim();
  if (str.includes('@')) {
    const parts = str.split('@');
    const userPart = parts[0];
    const maskedUser = userPart.length <= 2
      ? userPart[0] + '***'
      : userPart.slice(0, 2) + '***' + (userPart.length > 4 ? userPart.slice(-1) : '');
    return `${maskedUser}@${parts[1]}`;
  }
  if (str.length >= 8) {
    return str.slice(0, 4) + '****' + str.slice(-3);
  }
  return str.slice(0, 2) + '****';
}

/**
 * Centralized authorization validator for order operations.
 * Implements strict DENY BY DEFAULT policy:
 * - Registered orders: caller must be authenticated and own the order (or be admin)
 * - New guest orders: caller must provide a matching access token
 * - Legacy guest orders: NO bypass allowed; directed to customer service verification
 *
 * @param {Object} order - Order row from database
 * @param {Object} req - Express request
 * @returns {Object} { authorized: boolean, isOwner: boolean, isAdmin: boolean, isLegacy: boolean, reason?: string, status?: number }
 */
function evaluateOrderAuthorization(order, req) {
  if (!order) {
    return {
      authorized: false,
      status: 404,
      reason: 'Pesanan tidak ditemukan.'
    };
  }

  const authenticatedUser = req && req.user ? req.user : null;
  const isAdmin = Boolean(authenticatedUser && authenticatedUser.role === 'admin');

  // 1. Administrator always authorized via verified admin credentials
  if (isAdmin) {
    return {
      authorized: true,
      isAdmin: true,
      isOwner: false,
      isLegacy: !order.user_id && !order.access_token
    };
  }

  // 2. Registered User Order (order.user_id != null)
  if (order.user_id != null) {
    if (authenticatedUser && Number(authenticatedUser.id) === Number(order.user_id)) {
      return {
        authorized: true,
        isOwner: true,
        isAdmin: false,
        isLegacy: false
      };
    }
    return {
      authorized: false,
      status: 403,
      reason: 'Akses ditolak: Anda tidak memiliki otorisasi untuk pesanan ini.'
    };
  }

  // 3. New Guest Order with access_token (order.user_id == null && order.access_token != null)
  if (order.access_token) {
    const clientToken = extractClientToken(req);
    if (clientToken && timingSafeEqualStr(clientToken, order.access_token)) {
      return {
        authorized: true,
        isOwner: true,
        isAdmin: false,
        isLegacy: false
      };
    }
    return {
      authorized: false,
      status: 403,
      reason: 'Akses ditolak: Token otorisasi pesanan tamu tidak valid atau tidak disertakan.'
    };
  }

  // 4. Legacy Guest Order (order.user_id == null && order.access_token == null)
  // DENY BY DEFAULT: invoice number alone is NEVER proof of ownership!
  return {
    authorized: false,
    status: 403,
    isLegacy: true,
    reason: 'Transaksi ini dibuat menggunakan sistem sebelumnya. Untuk menjaga keamanan data dan pembayaran, silakan hubungi customer service dengan menyertakan nomor invoice untuk proses verifikasi.'
  };
}

/**
 * Strips sensitive fields and masks personal contact info for public view.
 */
function sanitizeOrderForPublic(order, isLegacy = false) {
  if (!order) return order;
  const sanitized = { ...order };

  // Never leak access tokens or payment credentials
  delete sanitized.access_token;
  delete sanitized.redirect_url;
  delete sanitized.payment_ref;

  // Mask contact info for privacy
  if (sanitized.wa_email_guest) {
    sanitized.wa_email_guest = maskContact(sanitized.wa_email_guest);
  }

  sanitized.is_public_view = true;

  if (isLegacy) {
    sanitized.legacy_notice = 'Transaksi ini dibuat menggunakan sistem sebelumnya. Untuk menjaga keamanan data dan pembayaran, silakan hubungi customer service dengan menyertakan nomor invoice untuk proses verifikasi.';
  }

  return sanitized;
}

module.exports = {
  timingSafeEqualStr,
  extractClientToken,
  maskContact,
  evaluateOrderAuthorization,
  sanitizeOrderForPublic
};
