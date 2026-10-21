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
        </div>

        ${isFailed ? `
          <div style="margin-top: 20px; padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: #f87171; margin-bottom: 6px;">
              ⚠️ Transaksi Gagal Diproses Provider
            </div>
            <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 6px;">
              <strong>Keterangan:</strong> ${order.failure_reason || 'Transaksi ditolak oleh provider game. Pastikan format ID Akun atau Region server akun sudah sesuai (Khusus Valorant wajib region Indonesia).'}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              Jangan khawatir, dana Anda tetap aman. Silakan hubungi CS kami via WhatsApp di bawah untuk pengecekan atau permohonan bantuan/refund.
            </div>
          </div>
        ` : (isProcess ? `
          <div style="margin-top: 20px; padding: 14px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 13px; color: #60a5fa;">
              ⏳ Pesanan sedang diproses otomatis ke akun game Anda. Mohon tunggu beberapa saat.
            </div>
          </div>
        ` : (!isSuccess ? `
          <div style="margin-top: 20px; padding: 16px; background: rgba(0, 97, 153, 0.12); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-md); text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; margin-bottom: 12px; background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(2, 132, 199, 0.35); border-radius: 20px; font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>
              LINGKUNGAN SANDBOX MIDTRANS
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px;">
              Pesanan menunggu pembayaran QRIS.
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.45;">
              Gunakan simulator resmi Midtrans untuk mensimulasikan scan QRIS Sandbox, atau gunakan tombol simulasi instan:
            </p>

            ${(order.redirect_url || (order.qris_string && order.qris_string.startsWith('http'))) ? `
              <div style="margin-bottom: 12px;">
                <a href="${order.redirect_url || order.qris_string}" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px; font-size: 13.5px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0070f3, #0050d0); box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); color: #ffffff;">
                  🚀 Buka Halaman Pembayaran Midtrans (Payment Link)
                </a>
              </div>
            ` : ''}

            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <a href="https://simulator.sandbox.midtrans.com/qris/index" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 3px 12px rgba(2, 132, 199, 0.35); color: #ffffff;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                <span>Buka Payment Simulator Midtrans</span>
              </a>
              <button class="btn-order-now" style="margin: 0; padding: 9px 18px; width: auto; font-size: 13px; background: var(--accent-gold);" onclick="window.simulateInvoicePayment('${order.invoice_number}')">
                ⚡ Simulasi Bayar Instan (Demo)
              </button>
            </div>
          </div>
        ` : ''))}

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; gap: 12px;">
          <a href="https://wa.me/6281234567890?text=Halo%20Dar'sstore,%20saya%20ingin%20cek%20invoice%20${order.invoice_number}" target="_blank" rel="noreferrer" class="btn-order-now" style="flex: 1; text-align: center; text-decoration: none; justify-content: center;">
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
