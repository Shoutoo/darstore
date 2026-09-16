const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/db');
const { dbService } = require('../config/prisma');
const { JWT_SECRET } = require('./auth.middleware');

module.exports = async function requireAdmin(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token otentikasi tidak ditemukan.'
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token otentikasi tidak valid atau sudah kedaluwarsa.'
      });
    }

    let user = null;
    if (dbService.isPostgres() && dbService.getPrisma()) {
      try {
        user = await dbService.getPrisma().user.findUnique({
          where: { id: decoded.id }
        });
      } catch (e) {
        console.warn('Prisma query failed in requireAdmin, falling back to SQLite:', e.message);
      }
    }

    if (!user) {
      user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan.'
      });
    }

    const isBlocked = user.is_blocked || user.isBlocked;
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda telah dinonaktifkan/diblokir oleh sistem.'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Fitur ini khusus untuk Administrator.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memverifikasi hak akses admin.'
    });
  }
};
