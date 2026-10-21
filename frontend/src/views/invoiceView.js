import { formatRupiah } from '../utils/format.js';
import { searchInvoice as searchInvoiceApi, simulatePayment } from '../api/orders.js';
import { showCyberToast } from '../utils/cyberPopup.js';

export async function fetchRealtimeTable() {
  const tbody = document.getElementById('realtime-transactions-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/orders/history');
    const data = await res.json();

    if (!res.ok || !data.success || data.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="table-empty-state">
              <div class="table-empty-icon">📊</div>
              <div class="table-empty-title">Data tidak ditemukan!</div>
              <div class="table-empty-sub">Belum ada transaksi di sistem.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.orders.map(tx => {
      const dateFormatted = new Date(tx.created_at).toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      const isSuccess = tx.status === 'Berhasil';
      const isProcess = tx.status === 'Diproses';
      const isFailed = tx.status === 'Gagal';
      const badgeClass = isSuccess ? 'success' : (isProcess ? 'processing' : (isFailed ? 'failed' : 'pending'));

      return `
        <tr>
          <td>${dateFormatted}</td>
          <td><strong style="color: var(--accent-gold); cursor: pointer;" onclick="document.getElementById('invoice-search-input').value='${tx.invoice_number}'; window.searchInvoice('${tx.invoice_number}')">${tx.invoice_number}</strong></td>
          <td>${tx.masked_contact}</td>
          <td>${formatRupiah(tx.total_harga)}</td>
          <td>
            <span class="invoice-status-badge ${badgeClass}">
              ${tx.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to fetch realtime transactions:', err);
  }
}

export async function searchInvoice(query, onPaymentSuccess) {
  const resultContainer = document.getElementById('invoice-result-container');
  if (!resultContainer) return;

  const cleaned = query.trim().toUpperCase();
  if (!cleaned) {
    showCyberToast('Silakan masukkan nomor Invoice pesanan Anda.', 'warning', 'LACAK TRANSAKSI');
    return;
  }

  resultContainer.innerHTML = `
    <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
      Mencari invoice ${cleaned}...
    </div>
  `;

  try {
    const res = await fetch(`/api/orders?invoice=${encodeURIComponent(cleaned)}`);
    const data = await res.json();

    if (!res.ok || !data.success || !data.order) {
      resultContainer.innerHTML = `
        <div class="invoice-result-card" style="border-color: #ef4444; text-align: center; padding: 32px;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <h3 style="color: #ef4444; margin-bottom: 8px;">Nomor Invoice Tidak Ditemukan!</h3>
          <p style="color: var(--text-secondary); font-size: 13.5px;">
            Pastikan nomor invoice yang Anda masukkan sudah benar (Contoh: DSXXXXXXXXXXXXXXXX).
          </p>
        </div>
      `;
      return;
    }

    const order = data.order;
    const isSuccess = order.status === 'Berhasil';
    const isProcess = order.status === 'Diproses';
    const isFailed = order.status === 'Gagal';
    const badgeClass = isSuccess ? 'success' : (isProcess ? 'processing' : (isFailed ? 'failed' : 'pending'));
    const targetAccount = order.game === 'mlbb'
      ? `${order.game_user_id} (${order.server_id})`
      : order.riot_id;
    const dateFormatted = new Date(order.created_at).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    resultContainer.innerHTML = `
      <div class="invoice-result-card">
        <div class="invoice-result-header">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">Nomor Invoice</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--accent-gold); letter-spacing: 0.5px;">${order.invoice_number}</div>
          </div>
          <span class="invoice-status-badge ${badgeClass}">
            ${order.status}
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13.5px;">
          <div class="summary-row">
            <span>Game</span>
            <strong>${order.game === 'mlbb' ? 'Mobile Legends: Bang Bang' : 'Valorant'}</strong>
          </div>
          <div class="summary-row">
            <span>Item Produk</span>
            <strong>${order.nama_item}</strong>
          </div>
          <div class="summary-row">
            <span>ID Akun Target</span>
            <strong>${targetAccount}</strong>
          </div>
          <div class="summary-row">
            <span>Metode Pembayaran</span>
            <strong>${order.payment_method}</strong>
          </div>
          <div class="summary-row">
            <span>Waktu Transaksi</span>
            <span>${dateFormatted}</span>
          </div>
          <div class="summary-row total">
            <span>Total Pembayaran</span>
            <span>${formatRupiah(order.total_harga)}</span>
          </div>

          ${order.sn ? `
          <div class="summary-row" style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: var(--radius-sm); padding: 10px 14px; margin-top: 6px;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 11px; color: #4ade80; font-weight: 700; text-transform: uppercase;">Serial Number (SN) / Bukti Top Up:</span>
              <strong style="font-family: monospace; font-size: 14px; color: #ffffff; letter-spacing: 0.5px; margin-top: 2px;">${order.sn}</strong>
            </div>
            <button onclick="navigator.clipboard.writeText('${order.sn}').then(() => alert('SN berhasil disalin!'))" style="background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4); color: #4ade80; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              Salin
            </button>
          </div>
          ` : ''}
        </div>

        ${isFailed ? `
          <div style="margin-top: 20px; padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-md); text-align: left;">
            <div style="font-size: 14px; font-weight: 700; color: #f87171; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>⚠️</span> Transaksi Gagal Diproses Provider
            </div>
            <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 8px; line-height: 1.5;">
              <strong>Penyebab:</strong> <span style="color: #fca5a5;">${order.failure_reason || 'ID Game atau Server tidak ditemukan / tidak terdaftar di publisher game.'}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
              🛡️ <strong>Dana & Poin Aman:</strong> Poin reward yang digunakan otomatis di-refund ke akun Anda. Jika dana pembayaran sudah terpotong melalui QRIS, silakan hubungi CS melalui WhatsApp di bawah untuk penggantian ID yang benar atau permohonan refund dana.
            </div>
          </div>
        ` : (isProcess ? `
          <div style="margin-top: 20px; padding: 14px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 13px; color: #60a5fa;">
              ⏳ Pesanan sedang diproses otomatis ke akun game Anda. Mohon tunggu beberapa saat.
            </div>
          </div>
        ` : (!isSuccess ? `
          <div style="margin-top: 20px; padding: 14px; background: rgba(0, 97, 153, 0.12); border: 1px solid var(--accent-gold); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 13px; color: var(--accent-gold-light); margin-bottom: 8px;">
              Pesanan menunggu pembayaran QRIS.
            </div>
            ${(order.redirect_url || (order.qris_string && order.qris_string.startsWith('http'))) ? `
              <div style="margin-bottom: 12px;">
                <a href="${order.redirect_url || order.qris_string}" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px; font-size: 13.5px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0070f3, #0050d0); box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); color: #ffffff;">
                  🚀 Buka Halaman Pembayaran Midtrans Live
                </a>
              </div>
            ` : ''}
            <button class="btn-order-now" style="margin: 0 auto; padding: 8px 18px; width: auto; font-size: 13px;" onclick="window.simulateInvoicePayment('${order.invoice_number}')">
              ⚡ Konfirmasi Bayar Sekarang (Demo)
            </button>
          </div>
        ` : ''))}

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; gap: 12px;">
          <a href="https://wa.me/6281234567890?text=Halo%20Dar'sstore,%20saya%20ingin%20cek%20invoice%20${order.invoice_number}%20(Akun%20Game:%20${encodeURIComponent(targetAccount)})" target="_blank" rel="noreferrer" class="btn-order-now" style="flex: 1; text-align: center; text-decoration: none; justify-content: center;">
            Bantuan CS via WhatsApp
          </a>
        </div>
      </div>
    `;
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="color: #ef4444; padding: 20px; text-align: center;">
        Gagal menghubungi server. Pastikan backend server aktif.
      </div>
    `;
  }
}

export function setupInvoiceSearch(onPaymentSuccess) {
  window.searchInvoice = (query) => searchInvoice(query, onPaymentSuccess);

  window.simulateInvoicePayment = async function(inv) {
    try {
      const data = await simulatePayment(inv);
      if (data.success) {
        showCyberToast(data.message || 'Pembayaran berhasil dikonfirmasi!', 'success', 'PEMBAYARAN DITERIMA');
        searchInvoice(inv, onPaymentSuccess);
        fetchRealtimeTable();
        if (typeof onPaymentSuccess === 'function') {
          onPaymentSuccess();
        }
      } else {
        showCyberToast(data.message || 'Gagal simulasi pembayaran.', 'error', 'SIMULASI GAGAL');
      }
    } catch (err) {
      showCyberToast('Gagal menghubungi server backend.', 'error', 'KONEKSI SERVER');
    }
  };

  const btnSearch = document.getElementById('btn-search-invoice');
  const inputSearch = document.getElementById('invoice-search-input');
  const btnPaste = document.getElementById('btn-paste-invoice');

  btnSearch?.addEventListener('click', () => {
    if (inputSearch) searchInvoice(inputSearch.value);
  });

  inputSearch?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchInvoice(inputSearch.value);
    }
  });

  btnPaste?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && inputSearch) {
        inputSearch.value = text.trim();
        searchInvoice(text.trim());
      }
    } catch (err) {
      showCyberToast('Tidak dapat membaca clipboard browser.', 'warning', 'AKSES CLIPBOARD');
    }
  });
}
