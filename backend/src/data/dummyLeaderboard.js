/**
 * Realistic dummy data for Dar'sstore Leaderboard (Backend fallback)
 * Ensures API /api/leaderboard always returns authentic Sultan & Top Buyer records
 */

const DUMMY_BUYERS_RAW = [
  {
    buyer_id: 'dummy_1',
    is_registered: true,
    display_name: 'Danu P.***',
    raw_name: 'Danu Pratama',
    contact_masked: '0813****211',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '1050 (933+117) Diamonds',
    points: 385,
    spent_all: 3850000,
    orders_all: 18,
    spent_month: 1650000,
    orders_month: 8,
    spent_week: 850000,
    orders_week: 4,
    spent_today: 308886,
    orders_today: 2
  },
  {
    buyer_id: 'dummy_2',
    is_registered: true,
    display_name: 'Kevin G.***',
    raw_name: 'Kevin Gunawan',
    contact_masked: '0852****122',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '4125 Points (Riot VP)',
    points: 294,
    spent_all: 2940000,
    orders_all: 14,
    spent_month: 1850000,
    orders_month: 9,
    spent_week: 640000,
    orders_week: 3,
    spent_today: 431961,
    orders_today: 2
  },
  {
    buyer_id: 'dummy_3',
    is_registered: true,
    display_name: 'Bima S.***',
    raw_name: 'Bima Sakti',
    contact_masked: '0896****900',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '7300 Points (x1)',
    points: 215,
    spent_all: 2150000,
    orders_all: 11,
    spent_month: 1200000,
    orders_month: 6,
    spent_week: 750000,
    orders_week: 3,
    spent_today: 185000,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_4',
    is_registered: true,
    display_name: 'M. Rizky***',
    raw_name: 'Muhammad Rizky',
    contact_masked: '0819****781',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '512 (461+51) Diamonds',
    points: 162,
    spent_all: 1620000,
    orders_all: 9,
    spent_month: 950000,
    orders_month: 5,
    spent_week: 480000,
    orders_week: 2,
    spent_today: 137300,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_5',
    is_registered: true,
    display_name: 'Siti R.***',
    raw_name: 'Siti Rahmawati',
    contact_masked: '0878****344',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '324 (291+33) Diamonds',
    points: 125,
    spent_all: 1250000,
    orders_all: 8,
    spent_month: 780000,
    orders_month: 4,
    spent_week: 390000,
    orders_week: 2,
    spent_today: 206408,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_6',
    is_registered: false,
    display_name: 'FannyGod #Indo',
    raw_name: null,
    contact_masked: '0812****889',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '712 (634+78) Diamonds',
    points: 98,
    spent_all: 980000,
    orders_all: 7,
    spent_month: 620000,
    orders_month: 4,
    spent_week: 280000,
    orders_week: 2,
    spent_today: 98365,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_7',
    is_registered: false,
    display_name: 'ViperKing #ID1',
    raw_name: null,
    contact_masked: '0821****554',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '3650 Points (x1)',
    points: 87,
    spent_all: 870000,
    orders_all: 6,
    spent_month: 550000,
    orders_month: 3,
    spent_week: 320000,
    orders_week: 2,
    spent_today: 84015,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_8',
    is_registered: false,
    display_name: 'TenZ_Clone #777',
    raw_name: null,
    contact_masked: '0857****112',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '2050 Points (x1)',
    points: 74,
    spent_all: 740000,
    orders_all: 5,
    spent_month: 430000,
    orders_month: 3,
    spent_week: 210000,
    orders_week: 1,
    spent_today: 0,
    orders_today: 0
  },
  {
    buyer_id: 'dummy_9',
    is_registered: true,
    display_name: 'AlucardKing***',
    raw_name: 'AlucardKing',
    contact_masked: '0812****566',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '345 (301+44) Diamonds',
    points: 62,
    spent_all: 620000,
    orders_all: 5,
    spent_month: 380000,
    orders_month: 2,
    spent_week: 190000,
    orders_week: 1,
    spent_today: 44400,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_10',
    is_registered: false,
    display_name: 'SultanBekasi***',
    raw_name: null,
    contact_masked: '0813****901',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '278 (251+27) Diamonds',
    points: 54,
    spent_all: 540000,
    orders_all: 4,
    spent_month: 310000,
    orders_month: 2,
    spent_week: 160000,
    orders_week: 1,
    spent_today: 0,
    orders_today: 0
  },
  {
    buyer_id: 'dummy_11',
    is_registered: false,
    display_name: 'GusionFastHand',
    raw_name: null,
    contact_masked: '0877****432',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '222 (201+21) Diamonds',
    points: 48,
    spent_all: 480000,
    orders_all: 4,
    spent_month: 260000,
    orders_month: 2,
    spent_week: 120000,
    orders_week: 1,
    spent_today: 0,
    orders_today: 0
  },
  {
    buyer_id: 'dummy_12',
    is_registered: false,
    display_name: 'PhantomAce #666',
    raw_name: null,
    contact_masked: '0822****778',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '1475 Points (x1)',
    points: 41,
    spent_all: 410000,
    orders_all: 3,
    spent_month: 230000,
    orders_month: 2,
    spent_week: 0,
    orders_week: 0,
    spent_today: 0,
    orders_today: 0
  },
  {
    buyer_id: 'dummy_13',
    is_registered: false,
    display_name: 'JettSmurf #999',
    raw_name: null,
    contact_masked: '0856****234',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '1000 Points (x1)',
    points: 35,
    spent_all: 350000,
    orders_all: 3,
    spent_month: 190000,
    orders_month: 1,
    spent_week: 0,
    orders_week: 0,
    spent_today: 0,
    orders_today: 0
  },
  {
    buyer_id: 'dummy_14',
    is_registered: true,
    display_name: 'Dimas P.***',
    raw_name: 'Dimas Pratama',
    contact_masked: '0812****432',
    favorite_game: 'mlbb',
    favorite_game_name: 'Mobile Legends',
    recent_item: '88 (80+8) Diamonds',
    points: 29,
    spent_all: 290000,
    orders_all: 2,
    spent_month: 150000,
    orders_month: 1,
    spent_week: 0,
    orders_week: 0,
    spent_today: 28435,
    orders_today: 1
  },
  {
    buyer_id: 'dummy_15',
    is_registered: false,
    display_name: 'Reyhan Valo #ID',
    raw_name: null,
    contact_masked: '0895****654',
    favorite_game: 'valorant',
    favorite_game_name: 'Valorant',
    recent_item: '475 Points (x1)',
    points: 24,
    spent_all: 240000,
    orders_all: 2,
    spent_month: 120000,
    orders_month: 1,
    spent_week: 0,
    orders_week: 0,
    spent_today: 54259,
    orders_today: 1
  }
];

function getBadgeAndTier(rank) {
  if (rank === 1) return { badge: '👑 SUPREME SULTAN', tier: 'tier-gold', trophy: '🥇' };
  if (rank === 2) return { badge: '🥈 ROYAL SULTAN', tier: 'tier-silver', trophy: '🥈' };
  if (rank === 3) return { badge: '🥉 NOBLE SULTAN', tier: 'tier-bronze', trophy: '🥉' };
  if (rank <= 5) return { badge: '💎 MYTHIC SPENDER', tier: 'tier-mythic', trophy: '💎' };
  if (rank <= 10) return { badge: '⭐ LEGEND BUYER', tier: 'tier-legend', trophy: '⭐' };
  return { badge: '🔥 ELITE BUYER', tier: 'tier-elite', trophy: '🔥' };
}

function generateDummyLeaderboardResponse({
  period = 'all',
  sortBy = 'amount',
  game = 'all',
  limit = 10
} = {}) {
  let periodLabel = 'Sepanjang Waktu';
  if (period === 'today') periodLabel = 'Hari Ini';
  else if (period === 'week') periodLabel = '7 Hari Terakhir';
  else if (period === 'month') periodLabel = 'Bulan Ini';

  // Filter items by game
  let filtered = DUMMY_BUYERS_RAW.filter(b => {
    if (game === 'all') return true;
    return b.favorite_game === game;
  });

  // Map to period values
  let mapped = filtered.map(b => {
    let spent = b.spent_all;
    let orders = b.orders_all;

    if (period === 'today') {
      spent = b.spent_today;
      orders = b.orders_today;
    } else if (period === 'week') {
      spent = b.spent_week;
      orders = b.orders_week;
    } else if (period === 'month') {
      spent = b.spent_month;
      orders = b.orders_month;
    }

    return {
      buyer_id: b.buyer_id,
      is_registered: b.is_registered,
      display_name: b.display_name,
      contact_masked: b.contact_masked,
      total_spent: spent,
      order_count: orders,
      favorite_game: b.favorite_game,
      favorite_game_name: b.favorite_game_name,
      points: b.points,
      last_order_at: new Date().toISOString(),
      recent_item: b.recent_item
    };
  });

  // Ensure items have realistic values if 0
  mapped.forEach((item, idx) => {
    if (item.total_spent <= 0) {
      if (period === 'today') {
        item.total_spent = Math.max(15000, 80000 - (idx * 5000));
        item.order_count = 1;
      } else if (period === 'week') {
        item.total_spent = Math.max(30000, 150000 - (idx * 10000));
        item.order_count = 1;
      }
    }
  });

  // Sort by criterion
  if (sortBy === 'count') {
    mapped.sort((a, b) => b.order_count - a.order_count || b.total_spent - a.total_spent);
  } else {
    mapped.sort((a, b) => b.total_spent - a.total_spent || b.order_count - a.order_count);
  }

  // Assign ranks
  const ranked = mapped.map((item, idx) => {
    const rank = idx + 1;
    const { badge, tier, trophy } = getBadgeAndTier(rank);
    return {
      ...item,
      rank,
      badge,
      tier,
      trophy
    };
  });

  const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
  const paginated = ranked.slice(0, maxLimit);
  const totalVolume = ranked.reduce((acc, curr) => acc + curr.total_spent, 0);
  const totalTransactions = ranked.reduce((acc, curr) => acc + curr.order_count, 0);

  return {
    success: true,
    is_dummy: true,
    period,
    period_label: periodLabel,
    sortBy,
    sort_label: sortBy === 'count' ? 'Top Transaksi Terbanyak' : 'Top Sultan (Nominal Belanja Terbesar)',
    game,
    summary: {
      total_volume: totalVolume,
      total_transactions: totalTransactions,
      total_buyers: ranked.length,
      top_sultan: paginated.length > 0 ? paginated[0] : null
    },
    leaderboard: paginated,
    podium: paginated.slice(0, 3),
    generated_at: new Date().toISOString()
  };
}

module.exports = {
  DUMMY_BUYERS_RAW,
  generateDummyLeaderboardResponse
};
