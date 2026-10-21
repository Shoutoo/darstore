const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { dbAsync } = require('../src/config/db');

async function main() {
  console.log('🚀 Memulai penarikan SEMUA daftar harga dari Digiflazz...');

  // 1. VALORANT (Khusus Region Indonesia / Type: Umum)
  const resValo = await fetch('https://digiflazz.com/api/v1/product?search=' + encodeURIComponent('Valorant'));
  const jsonValo = await resValo.json();
  const valoAll = jsonValo.data || [];

  // Filter khusus region Indonesia (Type: Umum di Digiflazz)
  const valoIndo = valoAll
    .filter(item => item.brand && item.brand.toLowerCase() === 'valorant' && (item.type === 'Umum' || item.name.includes('(Umum)')))
    .sort((a,b) => a.lowest_price - b.lowest_price);

  console.log(`✅ Valorant Region Indonesia: ${valoIndo.length} produk.`);

  const valoProducts = valoIndo.map((item, idx) => {
    const m = item.name.match(/[\d.,]+/);
    const nominal = m ? parseInt(m[0].replace(/[.,]/g, '')) : 0;
    return {
      id: `vp_id_${idx + 1}`,
      game: 'valorant',
      name: `${nominal.toLocaleString('id-ID')} Points`,
      nominal: nominal,
      price: item.lowest_price,
      icon: '/assets/icons/vp_icon.png'
    };
  });

  // 2. MOBILE LEGENDS (SEMUA DAFTAR HARGA: Umum, Indonesia, Membership)
  const resML = await fetch('https://digiflazz.com/api/v1/product?search=' + encodeURIComponent('MOBILE LEGENDS'));
  const jsonML = await resML.json();
  const mlAll = jsonML.data || [];

  const targetTypes = ['Umum', 'Indonesia', 'Membership'];
  const mlFiltered = mlAll.filter(item => 
    item.brand && item.brand.toUpperCase() === 'MOBILE LEGENDS' &&
    targetTypes.includes(item.type) &&
    !item.name.toLowerCase().includes('cek username')
  );

  console.log(`✅ Mobile Legends mentah (Umum/Indonesia/Membership): ${mlFiltered.length} produk.`);

  // Grouping dan eliminasi duplikasi nama identik (ambil harga terendah seller)
  const mlMap = new Map();
  mlFiltered.forEach(p => {
    // Normalisasi nama
    let clean = p.name.replace(/\(Umum\)|\(Indonesia\)/gi, '').trim().replace(/\s+/g, ' ');

    // Pastikan awalan rapi
    if (!clean.toUpperCase().startsWith('MOBILE LEGENDS') && !clean.toLowerCase().includes('pass') && !clean.toLowerCase().includes('member')) {
      clean = `MOBILE LEGENDS ${clean}`;
    }

    // Ambil harga terendah jika ada duplikasi nama
    if (!mlMap.has(clean) || p.lowest_price < mlMap.get(clean).price) {
      // Tentukan nominal angka
      const dMatch = clean.match(/(\d+)/);
      const nominal = dMatch ? parseInt(dMatch[1]) : 0;

      // Tentukan icon dinamis yang menarik
      let icon = '/assets/icons/diamond_single.png';
      if (clean.toLowerCase().includes('pass') || clean.toLowerCase().includes('twilight')) {
        icon = '/assets/icons/diamond_pack_1.png';
      } else if (clean.toLowerCase().includes('starlight')) {
        icon = '/assets/icons/diamond_pack_2.png';
      } else if (nominal >= 2000) {
        icon = '/assets/icons/diamond_pack_5.png';
      } else if (nominal >= 500) {
        icon = '/assets/icons/diamond_pack_3.png';
      } else if (nominal >= 100) {
        icon = '/assets/icons/diamond_large.png';
      } else if (nominal >= 50) {
        icon = '/assets/icons/diamond_medium.png';
      }

      mlMap.set(clean, {
        name: clean,
        nominal: nominal,
        price: p.lowest_price,
        icon: icon,
        type: p.type
      });
    }
  });

  const mlProducts = Array.from(mlMap.values())
    .sort((a,b) => a.price - b.price)
    .map((item, idx) => ({
      id: `ml_dm_${idx + 1}`,
      game: 'mlbb',
      name: item.name,
      nominal: item.nominal,
      price: item.price,
      icon: item.icon
    }));

  console.log(`✅ Mobile Legends unik dan lengkap: ${mlProducts.length} produk.`);

  // 3. Simpan SEMUA ke Supabase PostgreSQL
  console.log('📦 Memperbarui tabel products di Database Supabase PostgreSQL...');
  await dbAsync.run("DELETE FROM products WHERE game IN ('valorant', 'mlbb')");

  // Insert Valorant
  for (const v of valoProducts) {
    await dbAsync.run(
      `INSERT INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [v.id, v.game, v.name, v.nominal, v.price, v.icon]
    );
  }

  // Insert MLBB in chunks
  for (const m of mlProducts) {
    await dbAsync.run(
      `INSERT INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [m.id, m.game, m.name, m.nominal, m.price, m.icon]
    );
  }
  console.log(`✅ Database: Berhasil memasukkan ${valoProducts.length} produk Valorant dan ${mlProducts.length} produk Mobile Legends!`);

  // 4. Update frontend/src/data/valo-nominals.js
  const valoFileContent = `export const VALO_REGIONS = [
  { id: 'id', name: 'Region Indonesia' }
];

export const VALO_NOMINALS = {
  id: [\n${valoProducts.map(v => `    { id: '${v.id}', name: '${v.name}', price: ${v.price}, icon: '${v.icon}' }`).join(',\n')}\n  ]
};\n`;
  fs.writeFileSync(path.join(__dirname, '../../frontend/src/data/valo-nominals.js'), valoFileContent, 'utf8');

  // 5. Update frontend/src/data/ml-nominals.js
  const mlFileContent = `export const ML_NOMINALS = {
  topup_diamonds: [\n${mlProducts.map(m => `    { id: '${m.id}', name: '${m.name.replace(/'/g, "\\'")}', price: ${m.price}, icon: '${m.icon}' }`).join(',\n')}\n  ]
};\n`;
  fs.writeFileSync(path.join(__dirname, '../../frontend/src/data/ml-nominals.js'), mlFileContent, 'utf8');
  console.log('✅ Frontend: File data lokal berhasil diselaraskan lengkap!');

  console.log('\n🎉 PROSES SELESAI DENGAN SEMPURNA!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
