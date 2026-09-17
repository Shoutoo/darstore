const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
let pgPool = null;

if (DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://'))) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('[DATABASE] Connected to PostgreSQL (Supabase Cloud Pooler)');
  } catch (err) {
    console.warn('[DATABASE] Failed to initialize PostgreSQL pool, falling back to SQLite:', err.message);
    pgPool = null;
  }
}

// Fallback SQLite instance (lazy-loaded for local dev only)
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
let db = null;
if (!pgPool) {
  try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to connect to SQLite database:', err);
      } else {
        console.log(`Connected to SQLite database at ${dbPath}`);
      }
    });
  } catch (err) {
    console.warn('[DATABASE] SQLite native driver not available, running in cloud-only mode:', err.message);
  }
}


function toPgSql(sql) {
  let paramIndex = 1;
  let converted = sql.replace(/\?/g, () => '$' + (paramIndex++));
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)) {
    converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON CONFLICT/i.test(converted)) {
      converted += ' ON CONFLICT DO NOTHING';
    }
  }
  if (/^\s*INSERT\s+INTO/i.test(converted) && !/RETURNING/i.test(converted)) {
    converted += ' RETURNING id';
  }
  return converted;
}

// Helper for promise-based queries (dual-mode: Postgres / SQLite)
const dbAsync = {
  async run(sql, params = []) {
    if (pgPool) {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      const returnedId = res.rows && res.rows.length > 0 ? res.rows[0].id : null;
      return { id: returnedId || res.rowCount, changes: res.rowCount };
    }
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  async get(sql, params = []) {
    if (pgPool) {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    }
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  async all(sql, params = []) {
    if (pgPool) {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows || [];
    }
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  async exec(sql) {
    if (pgPool) {
      await pgPool.query(sql);
      return;
    }
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

async function initDatabase() {
  if (pgPool) {
    console.log('[DATABASE] PostgreSQL (Supabase Cloud) mode active.');
    const count = await dbAsync.get('SELECT COUNT(*) as count FROM products');
    console.log(`[DATABASE] Verified Supabase PostgreSQL. Total products in catalog: ${count ? count.count : 0}`);
    return;
  }

  await dbAsync.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      email TEXT UNIQUE,
      whatsapp TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      nama_item TEXT NOT NULL,
      nominal INTEGER NOT NULL,
      harga INTEGER NOT NULL,
      icon TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NULL,
      product_id TEXT NOT NULL,
      game TEXT NOT NULL,
      nama_item TEXT NOT NULL,
      game_user_id TEXT NULL,
      server_id TEXT NULL,
      riot_id TEXT NULL,
      wa_email_guest TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Menunggu Pembayaran',
      payment_method TEXT NOT NULL,
      payment_ref TEXT NULL,
      qris_string TEXT NULL,
      qris_url TEXT NULL,
      total_harga INTEGER NOT NULL,
      failure_reason TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS payment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      gateway_ref TEXT,
      status TEXT NOT NULL,
      raw_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    );

    CREATE TABLE IF NOT EXISTS point_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER NULL,
      points_earned INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (order_id) REFERENCES orders (id)
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate existing users table if role / is_blocked columns missing
  try {
    await dbAsync.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbAsync.run("ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await dbAsync.run("ALTER TABLE orders ADD COLUMN failure_reason TEXT NULL");
  } catch (e) {
    // Column already exists, ignore
  }

  console.log('Database tables verified/created successfully.');

  // Seed products if empty
  const count = await dbAsync.get('SELECT COUNT(*) as count FROM products');
  if (count && count.count === 0) {
    console.log('Seeding initial products into database...');
    await seedProducts();
  }

  // Ensure MLBB products point to diamond_single.png icon
  try {
    await dbAsync.run(
      "UPDATE products SET icon = '/assets/icons/diamond_single.png' WHERE game = 'mlbb' AND (icon = '/assets/icons/diamond_small.png' OR icon IS NULL)"
    );
  } catch (e) {
    // Ignore migration error
  }

  // Ensure default admin user exists and has admin role
  const bcrypt = require('bcryptjs');
  const adminHash = await bcrypt.hash('admin123', 10);
  const adminUser = await dbAsync.get('SELECT id, role FROM users WHERE email = ?', ['admin@darstore.com']);
  if (!adminUser) {
    await dbAsync.run(
      'INSERT INTO users (nama, email, whatsapp, password_hash, points, role, is_blocked) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['Admin Dar\'sstore', 'admin@darstore.com', '081234567899', adminHash, 100, 'admin', 0]
    );
    console.log('Default Admin user initialized: admin@darstore.com / admin123 (role: admin)');
  } else if (adminUser.role !== 'admin') {
    await dbAsync.run("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?", [adminHash, adminUser.id]);
    console.log('Updated admin user role to admin');
  }

  // Seed default store settings if empty
  const settingsCount = await dbAsync.get('SELECT COUNT(*) as count FROM store_settings');
  if (settingsCount && settingsCount.count === 0) {
    await dbAsync.run("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", ['cs_whatsapp', '081234567890']);
    await dbAsync.run("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", ['cs_email', 'support@darstore.com']);
    await dbAsync.run("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", ['store_name', "Dar'sstore"]);
    await dbAsync.run("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", ['tripay_mode', 'sandbox']);
    await dbAsync.run("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)", ['digiflazz_mode', 'development']);
  }
}

async function seedProducts() {
  // Mobile Legends products (Top Up Diamonds)
  const mlDiamonds = [
    { id: 'ml_dm_1', name: '5 (5+0) Diamonds', price: 1694, nominal: 5 },
    { id: 'ml_dm_2', name: '10 (9+1) Diamonds', price: 3387, nominal: 10 },
    { id: 'ml_dm_3', name: '12 (11+1) Diamonds', price: 3993, nominal: 12 },
    { id: 'ml_dm_4', name: '14 (13+1) Diamonds', price: 4381, nominal: 14 },
    { id: 'ml_dm_5', name: '19 (17+2) Diamonds', price: 6208, nominal: 19 },
    { id: 'ml_dm_6', name: '21 (19+2) Diamonds', price: 6773, nominal: 21 },
    { id: 'ml_dm_7', name: '22 (20+2) Diamonds', price: 7379, nominal: 22 },
    { id: 'ml_dm_8', name: '28 (25+3) Diamonds', price: 9103, nominal: 28 },
    { id: 'ml_dm_9', name: '36 (32+4) Diamonds', price: 10159, nominal: 36 },
    { id: 'ml_dm_10', name: '38 (34+4) Diamonds', price: 11372, nominal: 38 },
    { id: 'ml_dm_11', name: '39 (35+4) Diamonds', price: 11878, nominal: 39 },
    { id: 'ml_dm_12', name: '44 (40+4) Diamonds', price: 12161, nominal: 44 },
    { id: 'ml_dm_13', name: '44 (40+4) Diamonds', price: 13818, nominal: 44 },
    { id: 'ml_dm_14', name: '45 (41+4) Diamonds', price: 14804, nominal: 45 },
    { id: 'ml_dm_15', name: '48 (42+6) Diamonds', price: 15364, nominal: 48 },
    { id: 'ml_dm_16', name: '54 (48+6) Diamonds', price: 17303, nominal: 54 },
    { id: 'ml_dm_17', name: '56 (50+6) Diamonds', price: 17609, nominal: 56 },
    { id: 'ml_dm_18', name: '59 (53+6) Diamonds', price: 18921, nominal: 59 },
    { id: 'ml_dm_19', name: '64 (58+6) Diamonds', price: 19714, nominal: 64 },
    { id: 'ml_dm_20', name: '70 (63+7) Diamonds', price: 21698, nominal: 70 },
    { id: 'ml_dm_21', name: '71 (64+7) Diamonds', price: 22013, nominal: 71 },
    { id: 'ml_dm_22', name: '72 (65+7) Diamonds', price: 22225, nominal: 72 },
    { id: 'ml_dm_23', name: '74 (67+7) Diamonds', price: 23198, nominal: 74 },
    { id: 'ml_dm_24', name: '75 (68+7) Diamonds', price: 23816, nominal: 75 },
    { id: 'ml_dm_25', name: '79 (70+9) Diamonds', price: 24343, nominal: 79 },
    { id: 'ml_dm_26', name: '80 (73+7) Diamonds', price: 25057, nominal: 80 },
    { id: 'ml_dm_27', name: '85 (77+8) Diamonds', price: 25678, nominal: 85 },
    { id: 'ml_dm_28', name: '86 (78+8) Diamonds', price: 27232, nominal: 86 },
    { id: 'ml_dm_29', name: '88 (80+8) Diamonds', price: 28435, nominal: 88 },
    { id: 'ml_dm_30', name: '92 (84+8) Diamonds', price: 28832, nominal: 92 },
    { id: 'ml_dm_31', name: '100 (90+10) Diamonds', price: 30295, nominal: 100 },
    { id: 'ml_dm_32', name: '110 (99+11) Diamonds', price: 33616, nominal: 110 },
    { id: 'ml_dm_33', name: '113 (102+11) Diamonds', price: 34765, nominal: 113 },
    { id: 'ml_dm_34', name: '118 (107+11) Diamonds', price: 36229, nominal: 118 },
    { id: 'ml_dm_35', name: '129 (117+12) Diamonds', price: 38901, nominal: 129 },
    { id: 'ml_dm_36', name: '144 (130+14) Diamonds', price: 43600, nominal: 144 },
    { id: 'ml_dm_37', name: '148 (134+14) Diamonds', price: 45862, nominal: 148 },
    { id: 'ml_dm_38', name: '170 (154+16) Diamonds', price: 51061, nominal: 170 },
    { id: 'ml_dm_39', name: '176 (160+16) Diamonds', price: 54464, nominal: 176 },
    { id: 'ml_dm_40', name: '182 (165+17) Diamonds', price: 55374, nominal: 182 },
    { id: 'ml_dm_41', name: '222 (201+21) Diamonds', price: 68250, nominal: 222 },
    { id: 'ml_dm_42', name: '229 (207+22) Diamonds', price: 69353, nominal: 229 },
    { id: 'ml_dm_43', name: '240 (217+23) Diamonds', price: 71862, nominal: 240 },
    { id: 'ml_dm_44', name: '241 (218+23) Diamonds', price: 73615, nominal: 241 },
    { id: 'ml_dm_45', name: '257 (231+26) Diamonds', price: 77388, nominal: 257 },
    { id: 'ml_dm_46', name: '278 (251+27) Diamonds', price: 83215, nominal: 278 },
    { id: 'ml_dm_47', name: '294 (267+27) Diamonds', price: 86268, nominal: 294 },
    { id: 'ml_dm_48', name: '296 (256+40) Diamonds', price: 88768, nominal: 296 },
    { id: 'ml_dm_49', name: '301 (261+40) Diamonds', price: 90195, nominal: 301 },
    { id: 'ml_dm_50', name: '313 (282+31) Diamonds', price: 93332, nominal: 313 },
    { id: 'ml_dm_51', name: '324 (291+33) Diamonds', price: 97565, nominal: 324 },
    { id: 'ml_dm_52', name: '345 (301+44) Diamonds', price: 103400, nominal: 345 },
    { id: 'ml_dm_53', name: '355 (308+47) Diamonds', price: 106398, nominal: 355 },
    { id: 'ml_dm_54', name: '371 (324+47) Diamonds', price: 111704, nominal: 371 },
    { id: 'ml_dm_55', name: '374 (328+46) Diamonds', price: 112678, nominal: 374 },
    { id: 'ml_dm_56', name: '385 (342+43) Diamonds', price: 114275, nominal: 385 },
    { id: 'ml_dm_57', name: '384 (348+36) Diamonds', price: 115827, nominal: 384 },
    { id: 'ml_dm_58', name: '408 (367+41) Diamonds', price: 123361, nominal: 408 },
    { id: 'ml_dm_59', name: '426 (373+53) Diamonds', price: 127496, nominal: 426 },
    { id: 'ml_dm_60', name: '437 (384+53) Diamonds', price: 129772, nominal: 437 },
    { id: 'ml_dm_61', name: '459 (406+53) Diamonds', price: 137537, nominal: 459 },
    { id: 'ml_dm_62', name: '512 (461+51) Diamonds', price: 155518, nominal: 512 },
    { id: 'ml_dm_63', name: '518 (467+51) Diamonds', price: 158256, nominal: 518 },
    { id: 'ml_dm_64', name: '523 (471+52) Diamonds', price: 159837, nominal: 523 },
    { id: 'ml_dm_65', name: '568 (503+65) Diamonds', price: 165838, nominal: 568 },
    { id: 'ml_dm_66', name: '601 (535+66) Diamonds', price: 176740, nominal: 601 },
    { id: 'ml_dm_67', name: '712 (634+78) Diamonds', price: 205608, nominal: 712 },
    { id: 'ml_dm_68', name: '717 (639+78) Diamonds', price: 211328, nominal: 717 },
    { id: 'ml_dm_69', name: '719 (639+80) Diamonds', price: 211328, nominal: 719 },
    { id: 'ml_dm_70', name: '723 (647+76) Diamonds', price: 212988, nominal: 723 },
    { id: 'ml_dm_71', name: '750 (668+82) Diamonds', price: 221433, nominal: 750 },
    { id: 'ml_dm_72', name: '762 (682+80) Diamonds', price: 228559, nominal: 762 },
    { id: 'ml_dm_73', name: '790 (703+87) Diamonds', price: 236104, nominal: 790 },
    { id: 'ml_dm_74', name: '808 (720+88) Diamonds', price: 239135, nominal: 808 },
    { id: 'ml_dm_75', name: '875 (774+101) Diamonds', price: 254253, nominal: 875 },
    { id: 'ml_dm_76', name: '963 (857+106) Diamonds', price: 285341, nominal: 963 },
    { id: 'ml_dm_77', name: '969 (863+106) Diamonds', price: 285884, nominal: 969 },
    { id: 'ml_dm_78', name: '977 (867+110) Diamonds', price: 288325, nominal: 977 },
    { id: 'ml_dm_79', name: '1050 (933+117) Diamonds', price: 308086, nominal: 1050 },
    { id: 'ml_dm_80', name: '1067 (953+114) Diamonds', price: 318650, nominal: 1067 },
    { id: 'ml_dm_81', name: '1136 (1006+130) Diamonds', price: 332121, nominal: 1136 },
    { id: 'ml_dm_82', name: '1138 (1014+124) Diamonds', price: 334731, nominal: 1138 },
    { id: 'ml_dm_83', name: '1159 (1019+140) Diamonds', price: 340196, nominal: 1159 },
    { id: 'ml_dm_84', name: '1164 (1036+128) Diamonds', price: 341856, nominal: 1164 },
    { id: 'ml_dm_85', name: '1220 (1085+135) Diamonds', price: 358354, nominal: 1220 },
    { id: 'ml_dm_86', name: '1229 (1079+150) Diamonds', price: 360216, nominal: 1229 },
    { id: 'ml_dm_87', name: '1232 (1085+147) Diamonds', price: 361324, nominal: 1232 },
    { id: 'ml_dm_88', name: '1368 (1220+148) Diamonds', price: 404372, nominal: 1368 },
    { id: 'ml_dm_89', name: '1398 (1248+150) Diamonds', price: 410678, nominal: 1398 },
    { id: 'ml_dm_90', name: '1412 (1256+156) Diamonds', price: 417878, nominal: 1412 },
    { id: 'ml_dm_91', name: '1443 (1277+166) Diamonds', price: 429306, nominal: 1443 },
    { id: 'ml_dm_92', name: '1453 (1285+168) Diamonds', price: 430117, nominal: 1453 },
    { id: 'ml_dm_93', name: '1507 (1335+172) Diamonds', price: 440519, nominal: 1507 },
    { id: 'ml_dm_94', name: '1672 (1486+186) Diamonds', price: 494348, nominal: 1672 },
    { id: 'ml_dm_95', name: '1704 (1509+195) Diamonds', price: 504060, nominal: 1704 },
    { id: 'ml_dm_96', name: '1708 (1508+200) Diamonds', price: 509371, nominal: 1708 },
    { id: 'ml_dm_97', name: '1835 (1630+205) Diamonds', price: 535616, nominal: 1835 },
    { id: 'ml_dm_98', name: '1919 (1708+211) Diamonds', price: 564425, nominal: 1919 },
    { id: 'ml_dm_99', name: '2046 (1791+255) Diamonds', price: 584840, nominal: 2046 },
    { id: 'ml_dm_100', name: '2180 (1942+238) Diamonds', price: 634706, nominal: 2180 },
    { id: 'ml_dm_101', name: '2195 (1975+220) Diamonds', price: 670788, nominal: 2195 },
    { id: 'ml_dm_102', name: '2280 (2017+263) Diamonds', price: 675996, nominal: 2280 },
    { id: 'ml_dm_103', name: '2388 (2123+265) Diamonds', price: 697000, nominal: 2388 },
    { id: 'ml_dm_104', name: '2392 (2123+269) Diamonds', price: 701025, nominal: 2392 },
    { id: 'ml_dm_105', name: '2528 (2244+284) Diamonds', price: 733132, nominal: 2528 },
    { id: 'ml_dm_106', name: '2570 (2283+287) Diamonds', price: 733809, nominal: 2570 },
    { id: 'ml_dm_107', name: '2800 (2481+319) Diamonds', price: 822282, nominal: 2800 },
    { id: 'ml_dm_108', name: '2860 (2539+321) Diamonds', price: 828151, nominal: 2860 },
    { id: 'ml_dm_109', name: '2904 (2499+405) Diamonds', price: 854232, nominal: 2904 },
    { id: 'ml_dm_110', name: '2977 (2565+412) Diamonds', price: 856695, nominal: 2977 },
    { id: 'ml_dm_111', name: '3146 (2734+412) Diamonds', price: 903194, nominal: 3146 },
    { id: 'ml_dm_112', name: '3453 (2993+460) Diamonds', price: 1004212, nominal: 3453 },
    { id: 'ml_dm_113', name: '3481 (3010+471) Diamonds', price: 1045293, nominal: 3481 },
    { id: 'ml_dm_114', name: '3683 (3202+481) Diamonds', price: 1098368, nominal: 3683 },
    { id: 'ml_dm_115', name: '3738 (3247+491) Diamonds', price: 1083764, nominal: 3738 },
    { id: 'ml_dm_116', name: '4028 (3493+535) Diamonds', price: 1128849, nominal: 4028 },
    { id: 'ml_dm_117', name: '4036 (3432+604) Diamonds', price: 1149753, nominal: 4036 },
    { id: 'ml_dm_118', name: '4404 (3762+642) Diamonds', price: 1282695, nominal: 4404 },
    { id: 'ml_dm_119', name: '4830 (4052+778) Diamonds', price: 1325655, nominal: 4830 },
    { id: 'ml_dm_120', name: '4994 (4367+627) Diamonds', price: 1390273, nominal: 4994 },
    { id: 'ml_dm_121', name: '4958 (4252+706) Diamonds', price: 1394660, nominal: 4958 },
    { id: 'ml_dm_122', name: '5052 (4269+783) Diamonds', price: 1423174, nominal: 5052 },
    { id: 'ml_dm_123', name: '5266 (4608+658) Diamonds', price: 1495278, nominal: 5266 },
    { id: 'ml_dm_124', name: '5568 (4869+699) Diamonds', price: 1549769, nominal: 5568 },
    { id: 'ml_dm_125', name: '6001 (5219+782) Diamonds', price: 1672885, nominal: 6001 },
    { id: 'ml_dm_126', name: '6088 (5124+964) Diamonds', price: 1689274, nominal: 6088 },
    { id: 'ml_dm_127', name: '6257 (5274+983) Diamonds', price: 1751451, nominal: 6257 },
    { id: 'ml_dm_128', name: '6849 (5723+1126) Diamonds', price: 1902431, nominal: 6849 },
    { id: 'ml_dm_129', name: '7188 (6019+1179) Diamonds', price: 2008829, nominal: 7188 },
    { id: 'ml_dm_130', name: '7210 (6044+1166) Diamonds', price: 2045659, nominal: 7210 },
    { id: 'ml_dm_131', name: '7668 (6442+1226) Diamonds', price: 2144630, nominal: 7668 },
    { id: 'ml_dm_132', name: '7753 (6497+1256) Diamonds', price: 2163106, nominal: 7753 },
    { id: 'ml_dm_133', name: '8040 (6832+1208) Diamonds', price: 2237880, nominal: 8040 },
    { id: 'ml_dm_134', name: '8302 (7009+1293) Diamonds', price: 2325816, nominal: 8302 },
    { id: 'ml_dm_135', name: '8865 (7425+1440) Diamonds', price: 2475648, nominal: 8865 },
    { id: 'ml_dm_136', name: '9302 (7826+1476) Diamonds', price: 2605584, nominal: 9302 },
    { id: 'ml_dm_137', name: '9660 (8006+1654) Diamonds', price: 2688415, nominal: 9660 },
    { id: 'ml_dm_138', name: '10440 (8924+1516) Diamonds', price: 2959321, nominal: 10440 },
    { id: 'ml_dm_139', name: '11670 (9714+1956) Diamonds', price: 3231647, nominal: 11670 },
    { id: 'ml_dm_140', name: '12380 (10438+1942) Diamonds', price: 3439296, nominal: 12380 },
    { id: 'ml_dm_141', name: '12965 (10869+2096) Diamonds', price: 3610274, nominal: 12965 },
    { id: 'ml_dm_142', name: '13660 (11410+2250) Diamonds', price: 3804860, nominal: 13660 },
    { id: 'ml_dm_143', name: '14488 (11964+2524) Diamonds', price: 4005390, nominal: 14488 },
    { id: 'ml_dm_144', name: '14814 (12290+2524) Diamonds', price: 4105390, nominal: 14814 },
    { id: 'ml_dm_145', name: '16390 (13604+2816) Diamonds', price: 4515356, nominal: 16390 },
    { id: 'ml_dm_146', name: '16599 (13773+2796) Diamonds', price: 4560862, nominal: 16599 },
    { id: 'ml_dm_147', name: '18510 (15451+3059) Diamonds', price: 5134078, nominal: 18510 },
    { id: 'ml_dm_148', name: '19320 (16012+3308) Diamonds', price: 5316981, nominal: 19320 },
    { id: 'ml_dm_149', name: '20136 (16708+3428) Diamonds', price: 5571780, nominal: 20136 },
    { id: 'ml_dm_150', name: '21338 (17719+3619) Diamonds', price: 5890077, nominal: 21338 },
    { id: 'ml_dm_151', name: '24339 (20019+4320) Diamonds', price: 6698075, nominal: 24339 },
    { id: 'ml_dm_152', name: '28900 (24016+4882) Diamonds', price: 7979326, nominal: 28900 }
  ];

  // Valorant Points (Region Indonesia)
  const valoPoints = [
    { id: 'vp_id_1', name: '475 Points', price: 54259, nominal: 475 },
    { id: 'vp_id_2', name: '950 Points', price: 108518, nominal: 950 },
    { id: 'vp_id_3', name: '1000 Points', price: 108518, nominal: 1000 },
    { id: 'vp_id_4', name: '1475 Points', price: 162777, nominal: 1475 },
    { id: 'vp_id_5', name: '2050 Points', price: 217034, nominal: 2050 },
    { id: 'vp_id_6', name: '2000 Points', price: 217035, nominal: 2000 },
    { id: 'vp_id_7', name: '2525 Points', price: 271293, nominal: 2525 },
    { id: 'vp_id_8', name: '3050 Points', price: 325552, nominal: 3050 },
    { id: 'vp_id_9', name: '3650 Points', price: 376902, nominal: 3650 },
    { id: 'vp_id_10', name: '4125 Points', price: 431161, nominal: 4125 },
    { id: 'vp_id_11', name: '4100 Points', price: 434068, nominal: 4100 },
    { id: 'vp_id_12', name: '4650 Points', price: 485420, nominal: 4650 },
    { id: 'vp_id_13', name: '5350 Points', price: 541615, nominal: 5350 },
    { id: 'vp_id_14', name: '5700 Points', price: 593936, nominal: 5700 },
    { id: 'vp_id_15', name: '5825 Points', price: 595873, nominal: 5825 },
    { id: 'vp_id_16', name: '6350 Points', price: 650132, nominal: 6350 },
    { id: 'vp_id_17', name: '7300 Points', price: 753804, nominal: 7300 },
    { id: 'vp_id_18', name: '7400 Points', price: 758649, nominal: 7400 },
    { id: 'vp_id_19', name: '8400 Points', price: 867166, nominal: 8400 },
    { id: 'vp_id_20', name: '9000 Points', price: 918516, nominal: 9000 },
    { id: 'vp_id_21', name: '8990 Points', price: 918516, nominal: 8990 },
    { id: 'vp_id_22', name: '10000 Points', price: 1027034, nominal: 10000 },
    { id: 'vp_id_23', name: '11000 Points', price: 1064820, nominal: 11000 },
    { id: 'vp_id_24', name: '10700 Points', price: 1083229, nominal: 10700 },
    { id: 'vp_id_25', name: '11475 Points', price: 1119079, nominal: 11475 },
    { id: 'vp_id_26', name: '12000 Points', price: 1173338, nominal: 12000 },
    { id: 'vp_id_27', name: '13050 Points', price: 1281854, nominal: 13050 },
    { id: 'vp_id_28', name: '14650 Points', price: 1441722, nominal: 14650 },
    { id: 'vp_id_29', name: '16700 Points', price: 1658756, nominal: 16700 },
    { id: 'vp_id_30', name: '18400 Points', price: 1823468, nominal: 18400 },
    { id: 'vp_id_31', name: '20000 Points', price: 1983336, nominal: 20000 },
    { id: 'vp_id_32', name: '22000 Points', price: 2129640, nominal: 22000 }
  ];

  for (const item of mlDiamonds) {
    await dbAsync.run(
      `INSERT OR IGNORE INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, 'mlbb', item.name, item.nominal, item.price, '/assets/icons/diamond_single.png', 1]
    );
  }

  for (const item of valoPoints) {
    await dbAsync.run(
      `INSERT OR IGNORE INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, 'valorant', item.name, item.nominal, item.price, '/assets/icons/vp_icon.png', 1]
    );
  }

  console.log(`Seeded ${mlDiamonds.length} MLBB products and ${valoPoints.length} Valorant products.`);
}

module.exports = {
  db,
  dbAsync,
  initDatabase
};
