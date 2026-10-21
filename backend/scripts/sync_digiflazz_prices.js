const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { dbAsync } = require('../src/config/db');

async function syncAll() {
  console.log('🔄 Memulai sinkronisasi harga Digiflazz ke Database dan Frontend...');

  // 1. Fetch Valorant (Umum) dari Digiflazz
  const resValo = await fetch('https://digiflazz.com/api/v1/product?search=' + encodeURIComponent('Valorant'));
  const jsonValo = await resValo.json();
  const valoDigi = (jsonValo.data || [])
    .filter(item => item.brand && item.brand.toLowerCase() === 'valorant' && (item.type === 'Umum' || item.name.includes('(Umum)')))
    .sort((a,b) => a.lowest_price - b.lowest_price);

  console.log(`✅ Didapatkan ${valoDigi.length} produk Valorant (Umum) dari Digiflazz.`);

  // 2. Fetch Mobile Legends (Umum) dari Digiflazz
  const resML = await fetch('https://digiflazz.com/api/v1/product?search=' + encodeURIComponent('MOBILE LEGENDS'));
  const jsonML = await resML.json();
  const mlDigi = (jsonML.data || [])
    .filter(item => item.brand && item.brand.toUpperCase() === 'MOBILE LEGENDS' && (item.type === 'Umum' || item.name.includes('(Umum)')));

  console.log(`✅ Didapatkan ${mlDigi.length} produk Mobile Legends (Umum) dari Digiflazz.`);

  // Mapping MLBB nominal -> lowest price
  const mlMap = {};
  mlDigi.forEach(m => {
    const match = m.name.match(/(\d+)\s*Diamond/i);
    if (match) {
      const nom = parseInt(match[1]);
      if (!mlMap[nom] || m.lowest_price < mlMap[nom]) {
        mlMap[nom] = m.lowest_price;
      }
    }
  });

  // 3. Susun data Valorant Nominals
  const valoItems = valoDigi.map((item, idx) => {
    const match = item.name.match(/[\d.,]+/);
    const nominal = match ? parseInt(match[0].replace(/[.,]/g, '')) : 0;
    return {
      id: `vp_id_${idx + 1}`,
      name: `${nominal} Points`,
      price: item.lowest_price,
      nominal: nominal,
      icon: '/assets/icons/vp_icon.png'
    };
  });

  // Update Database: Hapus produk valorant lama, masukkan 27 produk resmi sesuai Digiflazz
  await dbAsync.run("DELETE FROM products WHERE game = 'valorant'");
  for (const item of valoItems) {
    await dbAsync.run(
      `INSERT INTO products (id, game, nama_item, nominal, harga, icon, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [item.id, 'valorant', item.name, item.nominal, item.price, item.icon]
    );
  }
  console.log(`✅ Database: Berhasil memperbarui ${valoItems.length} produk Valorant.`);

  // 4. Update Database: Perbarui harga MLBB yang cocok dengan Digiflazz
  const currentML = await dbAsync.all("SELECT * FROM products WHERE game = 'mlbb'");
  let updatedMLCount = 0;
  for (const p of currentML) {
    if (mlMap[p.nominal]) {
      const newPrice = mlMap[p.nominal];
      await dbAsync.run("UPDATE products SET harga = ? WHERE id = ?", [newPrice, p.id]);
      updatedMLCount++;
    }
  }
  console.log(`✅ Database: Berhasil memperbarui harga ${updatedMLCount} produk Mobile Legends sesuai Digiflazz.`);

  // 5. Update frontend/src/data/valo-nominals.js
  const valoFileContent = `export const VALO_REGIONS = [
  { id: 'id', name: 'Region Indonesia' }
];

export const VALO_NOMINALS = {
  id: [\n${valoItems.map(v => `    { id: '${v.id}', name: '${v.name}', price: ${v.price}, icon: '${v.icon}' }`).join(',\n')}\n  ]
};\n`;

  fs.writeFileSync(path.join(__dirname, '../../frontend/src/data/valo-nominals.js'), valoFileContent, 'utf8');
  console.log('✅ Frontend: valo-nominals.js berhasil diselaraskan dengan daftar harga Digiflazz.');

  // 6. Update frontend/src/data/ml-nominals.js
  const mlNominalsRaw = fs.readFileSync(path.join(__dirname, '../../frontend/src/data/ml-nominals.js'), 'utf8');
  // Match each line with price: XXXX and update if nominal is found
  const updatedMlNominals = mlNominalsRaw.replace(/\{ id: '(ml_dm_\d+)', name: '(\d+) \([^']+\) Diamonds', price: (\d+), icon: '([^']+)' \}/g, (match, id, nomStr, oldPrice, icon) => {
    const nom = parseInt(nomStr);
    const newPrice = mlMap[nom] || parseInt(oldPrice);
    return `{ id: '${id}', name: '${match.split("name: '")[1].split("', price:")[0]}', price: ${newPrice}, icon: '${icon}' }`;
  });
  fs.writeFileSync(path.join(__dirname, '../../frontend/src/data/ml-nominals.js'), updatedMlNominals, 'utf8');
  console.log('✅ Frontend: ml-nominals.js berhasil diselaraskan dengan daftar harga Digiflazz.');

  console.log('\n🎉 SINKRONISASI SELESAI DENGAN SUKSES!');
  process.exit(0);
}

syncAll().catch(err => {
  console.error('❌ Sync error:', err);
  process.exit(1);
});
