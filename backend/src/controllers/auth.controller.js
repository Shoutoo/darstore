const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../config/db');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nama: user.nama,
      email: user.email,
      whatsapp: user.whatsapp,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { nama, email, whatsapp, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    if (!email && !whatsapp) {
      return res.status(400).json({ success: false, message: 'Email atau nomor WhatsApp wajib diisi.' });
    }

    const displayName = nama ? nama.trim() : (email ? email.split('@')[0] : 'User');
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanWA = whatsapp ? whatsapp.trim().replace(/[^0-9]/g, '') : null;

    // Check existing
    if (cleanEmail) {
      const existingEmail = await dbAsync.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
      }
    }

    if (cleanWA) {
      const existingWA = await dbAsync.get('SELECT id FROM users WHERE whatsapp = ?', [cleanWA]);
      if (existingWA) {
        return res.status(400).json({ success: false, message: 'Nomor WhatsApp sudah terdaftar.' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await dbAsync.run(
      `INSERT INTO users (nama, email, whatsapp, password_hash, points, role, is_blocked) VALUES (?, ?, ?, ?, 0, 'user', 0)`,
      [displayName, cleanEmail, cleanWA, password_hash]
    );

    const newUser = await dbAsync.get(
      'SELECT id, nama, email, whatsapp, points, role, created_at FROM users WHERE id = ?',
      [result.id]
    );

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registrasi berhasil!',
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat registrasi.' });
  }
};

exports.login = async (req, res) => {
  try {
    const rawIdentifier = req.body.identifier || req.body.username || req.body.email;
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Silakan isi email/WhatsApp dan kata sandi.' });
    }

    const clean = String(rawIdentifier).trim();
    // Check by email or whatsapp
    const user = await dbAsync.get(
      'SELECT * FROM users WHERE email = ? OR whatsapp = ?',
      [clean.toLowerCase(), clean.replace(/[^0-9]/g, '')]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan. Silakan periksa kembali email atau no. WhatsApp Anda.' });
    }

    if (user.is_blocked || user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda telah dinonaktifkan/diblokir oleh Administrator.'
      });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      return res.status(401).json({ success: false, message: 'Kata sandi salah.' });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        whatsapp: user.whatsapp,
        points: user.points,
        role: user.role || 'user'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await dbAsync.get(
      'SELECT id, nama, email, whatsapp, points, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    return res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat profil user.' });
  }
};

exports.getPointHistory = async (req, res) => {
  try {
    const history = await dbAsync.all(
      'SELECT * FROM point_history WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({ success: true, history });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat poin.' });
  }
};
