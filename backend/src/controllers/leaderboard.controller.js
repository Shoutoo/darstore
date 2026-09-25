const { dbAsync } = require('../config/db');
const { seedLeaderboardOrdersIfNeeded } = require('../services/leaderboardSeeder');

let seedChecked = false;

/**
 * Format and mask user/buyer name gracefully for privacy and professional appearance
 */
function maskBuyerName(user, waEmailGuest, gameUserId, riotId) {
  if (user && user.nama) {
    const raw = String(user.nama).trim();
    const parts = raw.split(/\s+/);
    if (parts.length === 1) {
      if (raw.length <= 3) return raw.toUpperCase() + '***';
      return raw.slice(0, 3) + '***';
    }
    // "Danu Pratama" -> "Danu P.***"
    return parts[0] + ' ' + parts[1].charAt(0).toUpperCase() + '.***';
  }

  if (riotId && String(riotId).includes('#')) {
    const parts = String(riotId).split('#');
    const name = parts[0].trim();
    const tag = parts[1].trim();
    const maskedName = name.length > 3 ? name.slice(0, 3) + '***' : name + '***';
    return `${maskedName} #${tag}`;
  }

  if (waEmailGuest) {
    const str = String(waEmailGuest).trim();
    if (str.includes('@')) {
      const parts = str.split('@');
      const userPart = parts[0].length > 2 ? parts[0].slice(0, 2) + '***' : parts[0] + '***';
      return `${userPart}@${parts[1]}`;
    }
    const digits = str.replace(/\D/g, '');
    if (digits.length >= 8) {
      return digits.slice(0, 4) + '****' + digits.slice(-3);
    }
    return str.slice(0, 3) + '***';
  }

  if (gameUserId) {
    return 'Gamer #' + String(gameUserId).slice(0, 4) + '***';
  }

  return 'Sultan Gamer';
}

function maskContact(waEmailGuest, userWa, userEmail) {
  const contact = userWa || userEmail || waEmailGuest;
  if (!contact) return '-';
  const str = String(contact).trim();
  if (str.includes('@')) {
    const parts = str.split('@');
    return (parts[0].length > 2 ? parts[0].slice(0, 2) : parts[0]) + '***@' + parts[1];
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 8) {
    return digits.slice(0, 4) + '****' + digits.slice(-3);
  }
  return str.slice(0, 4) + '***';
}

function getBadgeAndTier(rank) {
  if (rank === 1) return { badge: '👑 SUPREME SULTAN', tier: 'tier-gold', trophy: '🥇' };
  if (rank === 2) return { badge: '🥈 ROYAL SULTAN', tier: 'tier-silver', trophy: '🥈' };
  if (rank === 3) return { badge: '🥉 NOBLE SULTAN', tier: 'tier-bronze', trophy: '🥉' };
  if (rank <= 5) return { badge: '💎 MYTHIC SPENDER', tier: 'tier-mythic', trophy: '💎' };
  if (rank <= 10) return { badge: '⭐ LEGEND BUYER', tier: 'tier-legend', trophy: '⭐' };
  return { badge: '🔥 ELITE BUYER', tier: 'tier-elite', trophy: '🔥' };
}

/**
 * Controller: GET /api/leaderboard
 * Fetches real, verified leaderboard data aggregated from completed orders
 */
exports.getLeaderboard = async (req, res) => {
  try {
    if (!seedChecked) {
      await seedLeaderboardOrdersIfNeeded();
      seedChecked = true;
    }

    const {
      period = 'all', // 'today', 'week', 'month', 'all'
      sortBy = 'amount', // 'amount' (top spender), 'count' (most orders)
      game = 'all', // 'all', 'mlbb', 'valorant'
      limit = 10
    } = req.query;

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    // Compute date cutoff universally
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatSqlDate = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    let dateCutoff = null;
    let periodLabel = 'Sepanjang Waktu';

    if (period === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      dateCutoff = formatSqlDate(startOfToday);
      periodLabel = 'Hari Ini';
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      dateCutoff = formatSqlDate(weekAgo);
      periodLabel = '7 Hari Terakhir';
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000);
      dateCutoff = formatSqlDate(monthAgo);
      periodLabel = 'Bulan Ini';
    }

    // Build query with params
    let sql = `
      SELECT o.id, o.invoice_number, o.user_id, o.wa_email_guest, o.product_id,
             o.game, o.nama_item, o.game_user_id, o.server_id, o.riot_id,
             o.total_harga, o.status, o.created_at,
             u.nama as user_nama, u.email as user_email, u.whatsapp as user_wa, u.points as user_points, u.role as user_role
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE LOWER(o.status) IN ('berhasil', 'success', 'paid')
    `;

    const params = [];

    if (dateCutoff) {
      sql += ' AND o.created_at >= ?';
      params.push(dateCutoff);
    }

    if (game && game !== 'all') {
      sql += ' AND LOWER(o.game) = ?';
      params.push(game.toLowerCase());
    }

    sql += ' ORDER BY o.id DESC';

    const orders = await dbAsync.all(sql, params);

    // Group orders by buyer
    const buyersMap = new Map();
    let totalVolume = 0;

    for (const ord of orders) {
      const price = Number(ord.total_harga) || 0;
      totalVolume += price;

      // Determine unique buyer key
      // If user_id is set, key by user_id
      // Else if wa_email_guest, key by sanitized contact
      let buyerKey;
      if (ord.user_id) {
        buyerKey = `user_${ord.user_id}`;
      } else if (ord.wa_email_guest && String(ord.wa_email_guest).trim()) {
        buyerKey = `guest_${String(ord.wa_email_guest).trim().toLowerCase()}`;
      } else if (ord.riot_id) {
        buyerKey = `riot_${String(ord.riot_id).trim().toLowerCase()}`;
      } else if (ord.game_user_id) {
        buyerKey = `game_${String(ord.game_user_id).trim()}`;
      } else {
        buyerKey = `order_${ord.id}`;
      }

      if (!buyersMap.has(buyerKey)) {
        const userObj = ord.user_id
          ? {
              id: ord.user_id,
              nama: ord.user_nama,
              email: ord.user_email,
              whatsapp: ord.user_wa,
              points: ord.user_points,
              role: ord.user_role
            }
          : null;

        const displayName = maskBuyerName(userObj, ord.wa_email_guest, ord.game_user_id, ord.riot_id);
        const contactMasked = maskContact(ord.wa_email_guest, ord.user_wa, ord.user_email);

        buyersMap.set(buyerKey, {
          buyer_id: buyerKey,
          is_registered: Boolean(ord.user_id),
          user_id: ord.user_id || null,
          display_name: displayName,
          raw_name: ord.user_nama || null,
          contact_masked: contactMasked,
          total_spent: 0,
          order_count: 0,
          games_count: { mlbb: 0, valorant: 0 },
          points: ord.user_points || 0,
          last_order_at: ord.created_at,
          recent_item: ord.nama_item
        });
      }

      const buyer = buyersMap.get(buyerKey);
      buyer.total_spent += price;
      buyer.order_count += 1;

      const g = (ord.game || 'mlbb').toLowerCase();
      buyer.games_count[g] = (buyer.games_count[g] || 0) + 1;

      // Keep latest order date
      if (new Date(ord.created_at) > new Date(buyer.last_order_at)) {
        buyer.last_order_at = ord.created_at;
        buyer.recent_item = ord.nama_item;
      }
    }

    // Convert map to array and compute favorite game
    const buyersArray = Array.from(buyersMap.values()).map(b => {
      const mlCount = b.games_count.mlbb || 0;
      const valCount = b.games_count.valorant || 0;
      const favGame = valCount > mlCount ? 'valorant' : 'mlbb';

      return {
        buyer_id: b.buyer_id,
        is_registered: b.is_registered,
        display_name: b.display_name,
        contact_masked: b.contact_masked,
        total_spent: b.total_spent,
        order_count: b.order_count,
        favorite_game: favGame,
        favorite_game_name: favGame === 'valorant' ? 'Valorant' : 'Mobile Legends',
        points: b.points,
        last_order_at: b.last_order_at,
        recent_item: b.recent_item
      };
    });

    // Sort by chosen criterion
    if (sortBy === 'count') {
      buyersArray.sort((a, b) => b.order_count - a.order_count || b.total_spent - a.total_spent);
    } else {
      // Default: 'amount' (Top Sultan)
      buyersArray.sort((a, b) => b.total_spent - a.total_spent || b.order_count - a.order_count);
    }

    // Assign rank and badges
    const rankedList = buyersArray.map((buyer, idx) => {
      const rank = idx + 1;
      const { badge, tier, trophy } = getBadgeAndTier(rank);
      return {
        ...buyer,
        rank,
        badge,
        tier,
        trophy
      };
    });

    const topSpender = rankedList.length > 0 ? rankedList[0] : null;
    const paginatedList = rankedList.slice(0, maxLimit);

    return res.json({
      success: true,
      period,
      period_label: periodLabel,
      sortBy,
      sort_label: sortBy === 'count' ? 'Top Transaksi Terbanyak' : 'Top Sultan (Nominal Belanja Terbesar)',
      game,
      summary: {
        total_volume: totalVolume,
        total_transactions: orders.length,
        total_buyers: buyersArray.length,
        top_sultan: topSpender
      },
      leaderboard: paginatedList,
      podium: paginatedList.slice(0, 3), // Top 3 for podium display
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[LEADERBOARD] Fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data leaderboard real-time.',
      error: err.message
    });
  }
};
