import { VALO_NOMINALS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';
import { appState } from '../utils/state.js';
import { createOrder } from '../api/orders.js';
import { getProducts } from '../api/products.js';
import { renderPaymentAccordion } from '../components/paymentAccordion.js';
import { renderFAQs } from './homepage.js';
import { openModal } from '../components/modals.js';
import { showCyberToast } from '../utils/cyberPopup.js';

function createNominalCardHTML(item) {
  return `
    <div class="nominal-card" data-id="${item.id}" data-game="valo">
      <div class="nominal-info">
        <div class="nominal-name">${item.name}</div>
        <div class="nominal-price">${formatRupiah(item.price)}</div>
      </div>
      <img src="${item.icon}" alt="" class="nominal-icon" />
      ${item.tag ? `<span class="nominal-tag-badge">${item.tag}</span>` : ''}
    </div>
  `;
}

export async function renderValoView() {
  const container = document.getElementById('valo-nominals-container');
  if (!container) return;

  let items = VALO_NOMINALS['id'];

  try {
    const data = await getProducts('valorant');
    if (data && data.success && data.products && data.products.length > 0) {
      items = data.products.map(p => ({
        id: p.id.toString(),
        name: p.nama_item || p.namaItem,
        price: p.harga,
        icon: p.icon || '/assets/icons/vp_icon.png'
      }));
      appState.valoProducts = items;
    }
  } catch (err) {
    console.warn('Fetching Valorant products from database:', err);
  }

  container.innerHTML = `
    <div class="nominals-grid">
      ${items.map(item => createNominalCardHTML(item)).join('')}
    </div>
  `;

  container.querySelectorAll('.nominal-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.nominal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const itemId = card.dataset.id;
      appState.valo.selectedNominal = (appState.valoProducts || items).find(i => i.id === itemId);
      updateValoSummary();
    });
  });

  renderPaymentAccordion('valo-payments-container', 'valo', appState, () => updateValoSummary());
  renderFAQs('valo-faq-list');
}

export function updateValoSummary() {
  const state = appState.valo;
  const summaryBox = document.getElementById('valo-summary-content');
  const orderBtn = document.getElementById('valo-btn-order');
  if (!summaryBox || !orderBtn) return;

  if (!state.selectedNominal) {
    summaryBox.innerHTML = `<div class="summary-empty-state">Belum ada item produk yang dipilih.</div>`;
    orderBtn.disabled = false;
    return;
  }

  const basePrice = state.selectedNominal.price;
  const fee = state.selectedPayment ? state.selectedPayment.fee : 800;
  const total = basePrice + fee;
  const pointsEst = Math.floor(total / 10000);

  summaryBox.innerHTML = `
    <div class="summary-details-list">
      <div class="summary-row">
        <span>Item</span>
        <strong style="color: var(--text-primary);">${state.selectedNominal.name}</strong>
      </div>
      <div class="summary-row">
        <span>Jumlah</span>
        <strong>x1</strong>
      </div>
      <div class="summary-row">
        <span>Harga Produk</span>
        <span>${formatRupiah(basePrice)}</span>
      </div>
      ${state.selectedPayment ? `
        <div class="summary-row">
          <span>Biaya Layanan (${state.selectedPayment.name})</span>
          <span>${fee === 0 ? 'Gratis' : formatRupiah(fee)}</span>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total Bayar</span>
        <span>${formatRupiah(total)}</span>
      </div>
      ${appState.currentUser ? `
        <div class="summary-row" style="margin-top: 6px; font-size: 12px; color: var(--accent-gold-light);">
          <span>⭐ Estimasi Poin Didapat:</span>
          <strong>+${pointsEst} Poin</strong>
        </div>
      ` : `
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px;">
          💡 Masuk ke akun Anda untuk mendapatkan poin loyalty (+${pointsEst} poin).
        </div>
      `}
    </div>
  `;

  orderBtn.disabled = false;
}

export async function handleValoCheckout() {
  const state = appState.valo;
  if (!state.selectedNominal) {
    showCyberToast('Silakan pilih nominal Valorant Points terlebih dahulu!', 'warning', 'PILIHAN NOMINAL');
    return;
  }

  const riotId = document.getElementById('valo-riotid')?.value.trim();
  if (!riotId || !riotId.includes('#')) {
    showCyberToast('Silakan masukkan Riot ID yang valid beserta Tagline! (Contoh: Player#1234)', 'warning', 'DATA AKUN GAME');
    document.getElementById('valo-riotid')?.focus();
    return;
  }
  state.riotId = riotId;

  if (!state.selectedPayment) {
    showCyberToast('Silakan pilih metode pembayaran QRIS Instant!', 'warning', 'METODE PEMBAYARAN');
    return;
  }

  const wa = document.getElementById('valo-wa')?.value.trim();
  if (!wa) {
    showCyberToast('Silakan masukkan No. WhatsApp Anda untuk menerima bukti transaksi!', 'warning', 'KONTAK NOTIFIKASI');
    document.getElementById('valo-wa')?.focus();
    return;
  }
  state.wa = '0' + wa.replace(/^0+/, '');

  const orderBtn = document.getElementById('valo-btn-order');
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.textContent = 'Membuat Pesanan...';
  }

  try {
    const data = await createOrder({
      product_id: state.selectedNominal.id,
      game: 'valorant',
      riot_id: state.riotId,
      wa_email_guest: state.wa,
      payment_method: state.selectedPayment.name,
      qty: 1
    });

    if (!data.success || !data.order) {
      showCyberToast(data.message || 'Gagal membuat pesanan top-up.', 'error', 'PESANAN GAGAL');
      return;
    }

    const order = data.order;
    appState.currentInvoice = order;

    const modalBody = document.getElementById('checkout-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 10px;">
            <img src="/assets/logo/darsstore_emblem.svg" alt="Dar'sstore" style="height: 48px; width: 48px; filter: drop-shadow(0 0 12px rgba(0, 97, 153, 0.4));" />
          </div>
          <div style="font-size: 13px; color: var(--text-muted);">NOMOR INVOICE</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
            ${order.invoice_number}
          </div>
        </div>

        <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Game:</span>
            <strong>Valorant</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Item:</span>
            <strong>${order.nama_item}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Akun Tujuan:</span>
            <strong>${order.riot_id}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Metode Bayar:</span>
            <strong>${order.payment_method}</strong>
          </div>
          <div class="summary-row total" style="padding-top: 10px;">
            <span>Total Tagihan:</span>
            <strong style="color: var(--accent-gold-light); font-size: 18px;">${formatRupiah(order.total_harga)}</strong>
          </div>
        </div>

        <div class="qr-code-wrap" style="background: #ffffff; padding: 18px; border-radius: var(--radius-lg); text-align: center; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
          <div style="font-size: 13px; color: #16212c; font-weight: 800; margin-bottom: 10px; text-transform: uppercase;">
            SCAN QRIS UNTUK MEMBAYAR
          </div>
          <img src="${order.qris_url || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(order.invoice_number)}`}" alt="QRIS Pembayaran" class="qr-code-img" style="margin: 0 auto; width: 190px; height: 190px; border-radius: 8px;" />
          <div style="font-size: 11.5px; color: #475569; margin-top: 10px; font-weight: 600;">
            Mendukung GoPay, DANA, OVO, ShopeePay, LinkAja & Seluruh Mobile Banking
          </div>
        </div>

        <p style="font-size: 12px; color: var(--text-muted); text-align: center; line-height: 1.5;">
          Silakan lakukan pembayaran dalam waktu <strong>15:00 menit</strong>. Pesanan diproses otomatis dalam 1-3 detik setelah scan QRIS berhasil.
        </p>
      `;
    }

    openModal('checkout-modal');
  } catch (err) {
    console.error('Checkout error:', err);
    showCyberToast('Gagal menghubungi server backend. Pastikan server aktif.', 'error', 'KONEKSI SERVER');
  } finally {
    if (orderBtn) {
      orderBtn.disabled = false;
      orderBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
        <span>Pesan Sekarang!</span>
      `;
    }
  }
}
