const { dbAsync } = require('../config/db');

/**
 * Get active reward items catalog
 * GET /api/rewards
 */
exports.getRewards = async (req, res) => {
  try {
    const rewards = await dbAsync.all(
      'SELECT * FROM reward_items WHERE is_active = 1 ORDER BY points_required ASC'
    );
    return res.json({
      success: true,
      rewards: rewards || []
    });
  } catch (err) {
    console.error('Get rewards error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat katalog reward.' });
  }
};

/**
 * Redeem loyalty points for a micro game item
 * POST /api/rewards/:id/redeem
 */
exports.redeemReward = async (req, res) => {
  try {
    const { id } = req.params;
    const { game_user_id, server_id, contact_wa } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Silakan login terlebih dahulu untuk menukarkan poin loyalitas.'
      });
    }

    const reward = await dbAsync.get('SELECT * FROM reward_items WHERE id = ? AND is_active = 1', [id]);
    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Item hadiah tidak ditemukan atau kuota penukaran sudah habis.'
      });
    }

    const targetUid = String(game_user_id || '').trim();
    const targetSrv = String(server_id || '').trim();

    if (!targetUid) {
      return res.status(400).json({
        success: false,
        message: reward.game === 'mlbb'
          ? 'User ID Mobile Legends wajib diisi.'
          : 'Riot ID Valorant wajib diisi.'
      });
    }

    if (reward.game === 'mlbb') {
      if (!targetSrv) {
        return res.status(400).json({
          success: false,
          message: 'Zone ID / Server Mobile Legends wajib diisi (Contoh: 2114).'
        });
      }
      if (!/^\d{6,10}$/.test(targetUid)) {
        return res.status(400).json({
          success: false,
          message: 'User ID Mobile Legends harus berupa 6-10 digit angka.'
        });
      }
    }

    if (reward.game === 'valorant') {
      if (!targetUid.includes('#')) {
        return res.status(400).json({
          success: false,
          message: 'Riot ID Valorant wajib menyertakan tagline (Contoh: Player#1234).'
        });
      }
    }

    // Verify current user balance
    const user = await dbAsync.get('SELECT id, nama, points FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun pengguna tidak ditemukan.' });
    }

    const currentPoints = user.points || 0;
    if (currentPoints < reward.points_required) {
      return res.status(400).json({
        success: false,
        message: `Poin Anda tidak mencukupi. Butuh ${reward.points_required} Poin, saldo poin Anda saat ini ${currentPoints} Poin.`
      });
    }

    // Generate unique claim ticket
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const claimCode = `RW-${reward.game.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${randSuffix}`;

    // Deduct points from user
    const newPoints = currentPoints - reward.points_required;
    await dbAsync.run('UPDATE users SET points = ? WHERE id = ?', [newPoints, user.id]);

    // Record point history
    const targetDesc = reward.game === 'mlbb' ? `${targetUid} (${targetSrv})` : targetUid;
    await dbAsync.run(
      'INSERT INTO point_history (user_id, order_id, points_earned, description) VALUES (?, ?, ?, ?)',
      [
        user.id,
        null,
        -reward.points_required,
        `Tukar Hadiah: ${reward.title} ke akun ${targetDesc} [${claimCode}]`
      ]
    );

    // Record redemption
    const insertRes = await dbAsync.run(
      `INSERT INTO reward_redemptions (user_id, reward_id, title, points_spent, game_user_id, server_id, claim_code, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success')`,
      [
        user.id,
        reward.id,
        reward.title,
        reward.points_required,
        targetUid,
        reward.game === 'mlbb' ? targetSrv : null,
        claimCode
      ]
    );

    const redemption = await dbAsync.get('SELECT * FROM reward_redemptions WHERE id = ?', [insertRes.id]);

    return res.status(201).json({
      success: true,
      message: `Selamat! Penukaran ${reward.title} berhasil. Item dikirimkan ke akun ${targetDesc}!`,
      claimCode,
      remainingPoints: newPoints,
      redemption
    });
  } catch (err) {
    console.error('Redeem reward error:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat menukarkan poin.'
    });
  }
};

/**
 * Get user's redeemed rewards history
 * GET /api/rewards/my-claims
 */
exports.getMyRedemptions = async (req, res) => {
  try {
    const redemptions = await dbAsync.all(
      'SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({
      success: true,
      redemptions: redemptions || []
    });
  } catch (err) {
    console.error('Get my redemptions error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat penukaran hadiah.' });
  }
};
