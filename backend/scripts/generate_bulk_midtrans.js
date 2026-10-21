const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { execSync } = require('child_process');
const { dbAsync } = require('../src/config/db');

async function main() {
  console.log('🔄 Mengambil data produk dari database...');

  const valoRows = await dbAsync.all("SELECT id, game, nama_item, nominal, harga FROM products WHERE game = 'valorant' ORDER BY harga ASC");
  console.log(`✅ Diambil ${valoRows.length} produk Valorant.`);

  const mlRows = await dbAsync.all("SELECT id, game, nama_item, nominal, harga FROM products WHERE game = 'mlbb' ORDER BY harga ASC");
  console.log(`✅ Diambil ${mlRows.length} produk Mobile Legends.`);

  const headers = [
    'payment_link_type',
    'order_id',
    'payment_link_id',
    'gross_amount',
    'first_name',
    'last_name',
    'phone',
    'email',
    'item_details_id',
    'item_details_name',
    'item_details_price',
    'item_details_quantity',
    'dynamic_amount_preset_amount',
    'dynamic_amount_min_amount',
    'dynamic_amount_max_amount',
    'custom_field1',
    'custom_bni_va_number',
    'custom_bca_va_number',
    'custom_bri_va_number',
    'custom_permata_va_number',
    'custom_cimb_va_number'
  ];

  const rows = [];

  // Helper untuk escape CSV string
  function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // 1. Process Valorant
  valoRows.forEach((item, idx) => {
    let cleanName = item.nama_item;
    if (!cleanName.toLowerCase().includes('valorant')) {
      cleanName = `Valorant ${cleanName}`;
    }
    cleanName = cleanName.substring(0, 50);
    const orderId = `DS-VALO-${item.nominal}VP-${idx + 1}`.substring(0, 36);
    const itemId = `VALO-${item.nominal}VP`.substring(0, 50);

    rows.push({
      payment_link_type: 'FIXED_AMOUNT',
      order_id: orderId,
      payment_link_id: '',
      gross_amount: String(item.harga),
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      item_details_id: itemId,
      item_details_name: cleanName,
      item_details_price: String(item.harga),
      item_details_quantity: '1',
      dynamic_amount_preset_amount: '',
      dynamic_amount_min_amount: '',
      dynamic_amount_max_amount: '',
      custom_field1: 'Darstore Top Up Valorant',
      custom_bni_va_number: '',
      custom_bca_va_number: '',
      custom_bri_va_number: '',
      custom_permata_va_number: '',
      custom_cimb_va_number: ''
    });
  });

  // 2. Process Mobile Legends
  mlRows.forEach((item, idx) => {
    let cleanName = item.nama_item.substring(0, 50);
    const orderId = `DS-MLBB-${idx + 1}-${item.harga}`.substring(0, 36);
    const itemId = `MLBB-${idx + 1}`.substring(0, 50);

    rows.push({
      payment_link_type: 'FIXED_AMOUNT',
      order_id: orderId,
      payment_link_id: '',
      gross_amount: String(item.harga),
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      item_details_id: itemId,
      item_details_name: cleanName,
      item_details_price: String(item.harga),
      item_details_quantity: '1',
      dynamic_amount_preset_amount: '',
      dynamic_amount_min_amount: '',
      dynamic_amount_max_amount: '',
      custom_field1: 'Darstore Top Up MLBB',
      custom_bni_va_number: '',
      custom_bca_va_number: '',
      custom_bri_va_number: '',
      custom_permata_va_number: '',
      custom_cimb_va_number: ''
    });
  });

  console.log(`📦 Total baris produk yang disusun: ${rows.length} baris.`);

  // 3. Tulis file CSV (Format yang diminta di halaman upload Midtrans)
  const csvLines = [headers.join(',')];
  rows.forEach(r => {
    const line = headers.map(h => escapeCsv(r[h])).join(',');
    csvLines.push(line);
  });

  const csvPath = path.join(__dirname, 'Midtrans_Bulk_Payment_Link.csv');
  fs.writeFileSync(csvPath, csvLines.join('\r\n'), 'utf8');
  console.log(`✅ File CSV siap upload berhasil dibuat: ${csvPath}`);
  console.log(`📊 Ukuran file: ${(fs.statSync(csvPath).size / 1024).toFixed(2)} KB (Batas maksimal Midtrans: 1024 KB)`);

  // 4. Update file Excel Template: Midtrans Bulk Payment Link Template.xlsx
  console.log('🔄 Memperbarui file Excel template...');
  const excelPath = path.join(__dirname, 'Midtrans Bulk Payment Link Template.xlsx').replace(/\\/g, '\\\\');
  const tempScriptPath = path.join(__dirname, 'temp_excel_sync.py');
  const pyScript = `
import openpyxl
import csv

wb = openpyxl.Workbook()
wb.remove(wb.active) # remove default sheet
ws = wb.create_sheet(title='template')

with open(r'${csvPath.replace(/\\/g, '\\\\')}', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        ws.append(row)

wb.save(r'${excelPath}')
print('Excel template successfully updated!')
`;
  fs.writeFileSync(tempScriptPath, pyScript, 'utf8');
  execSync(`python "${tempScriptPath}"`, { stdio: 'inherit' });
  if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);

  console.log('\n🎉 SEMUA FILE SUDAH SELESAI DISIAPKAN DENGAN LENGKAP!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
