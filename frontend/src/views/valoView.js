import { VALO_NOMINALS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';
import { appState } from '../utils/state.js';
import { createOrder } from '../api/orders.js';
import { getProducts } from '../api/products.js';
import { renderPaymentAccordion } from '../components/paymentAccordion.js';
import { renderFAQs } from './homepage.js';
import { openModal } from '../components/modals.js';
import { showCyberToast } from '../utils/cyberPopup.js';
import { startQrisCountdown } from '../utils/countdown.js';

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
    <div style="margin-bottom: 16px; position: relative;">
      <input 
        type="text" 
        id="valo-nominal-search" 
        placeholder="🔍 Cari nominal VP (contoh: 475, 1000, 2050, 5350...)" 
        style="width: 100%; padding: 12px 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); color: #fff; font-size: 13.5px; outline: none; box-sizing: border-box;"
      />
    </div>
    <div class="nominals-grid">
      ${items.map(item => createNominalCardHTML(item)).join('')}
    </div>
  `;

  const searchInput = document.getElementById('valo-nominal-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      container.querySelectorAll('.nominal-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

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
  setupValoInputValidation();
}

export function setupValoInputValidation() {
  const riotIdInput = document.getElementById('valo-riotid');
  if (!riotIdInput) return;
  if (riotIdInput.dataset.listenerAttached === 'true') return;
  riotIdInput.dataset.listenerAttached = 'true';

  const validateVisual = () => {
    const value = riotIdInput.value.trim();
    if (!value) {
      riotIdInput.style.borderColor = '';
      return;
    }
    const isValid = /^.{3,16}#\d{3,5}$/.test(value);
    riotIdInput.style.borderColor = isValid ? '#10b981' : '#ef4444';
  };

  riotIdInput.addEventListener('blur', validateVisual);
  riotIdInput.addEventListener('input', () => {
    if (riotIdInput.style.borderColor) {
      validateVisual();
    }
  });

  const emailEl = document.getElementById('valo-email');
  if (emailEl && appState.currentUser?.email && !emailEl.value) {
    emailEl.value = appState.currentUser.email;
  }
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

  // Anti-loss loyalty calculations:
  // 1 Poin = Rp 100
  // Max discount 20% of basePrice
  const user = appState.currentUser;
  const userPoints = user ? (user.points || 0) : 0;
  const maxDiscountRupiah = Math.floor(basePrice * 0.20);
  const maxPointsEligible = Math.floor(maxDiscountRupiah / 100);
  const pointsAvailableToUse = Math.min(userPoints, maxPointsEligible);

  let discountAmount = 0;
  let pointsUsed = 0;

  if (state.usePoints && pointsAvailableToUse > 0) {
    pointsUsed = pointsAvailableToUse;
    discountAmount = pointsUsed * 100;
  }

  const total = Math.max(fee, (basePrice + fee) - discountAmount);
  const pointsEst = Math.floor(total / 10000);

  // Store computed values in state for checkout
  state.computedPointsUsed = pointsUsed;
  state.computedDiscountAmount = discountAmount;
  state.computedTotal = total;

  let loyaltySection = '';
  if (user) {
    if (userPoints > 0) {
      loyaltySection = `
        <div class="summary-loyalty-box ${state.usePoints ? 'active' : ''}" id="valo-loyalty-box">
          <div class="summary-loyalty-header">
            <label class="summary-loyalty-checkbox-label">
              <input type="checkbox" id="valo-toggle-points" ${state.usePoints ? 'checked' : ''} />
              <span class="summary-loyalty-title">⭐ Tukar Poin Loyalitas</span>
            </label>
            <span class="summary-loyalty-badge">${userPoints} Poin Tersedia</span>
          </div>
          <div class="summary-loyalty-hint">
            Potong harga s/d 20% (Hemat ${formatRupiah(pointsAvailableToUse * 100)} dengan ${pointsAvailableToUse} Poin)
          </div>
        </div>
      `;
    } else {
      loyaltySection = `
        <div class="summary-row" style="margin-top: 6px; font-size: 12px; color: var(--accent-gold-light);">
          <span>⭐ Estimasi Poin Didapat:</span>
          <strong>+${pointsEst} Poin</strong>
        </div>
      `;
    }
  } else {
    loyaltySection = `
      <div class="summary-guest-loyalty">
        💡 <a href="#" id="valo-login-promo" style="color: var(--accent-gold-light); font-weight: 700; text-decoration: underline;">Masuk Akun</a> untuk mendapatkan poin loyalty (+${pointsEst} poin) dan gunakan poin untuk potong harga!
      </div>
    `;
  }

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
      ${loyaltySection}
      ${state.usePoints && discountAmount > 0 ? `
        <div class="summary-row" style="color: #fde047;">
          <span>Potongan Poin (${pointsUsed} Poin)</span>
          <strong class="text-gold-discount">-${formatRupiah(discountAmount)}</strong>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total Bayar</span>
        <span>${formatRupiah(total)}</span>
      </div>
      ${user && userPoints > 0 ? `
        <div class="summary-row" style="margin-top: 6px; font-size: 12px; color: var(--accent-gold-light);">
          <span>⭐ Estimasi Poin Didapat:</span>
          <strong>+${pointsEst} Poin</strong>
        </div>
      ` : ''}
    </div>
  `;

  // Bind toggle points event
  document.getElementById('valo-toggle-points')?.addEventListener('change', (e) => {
    state.usePoints = e.target.checked;
    updateValoSummary();
  });

  document.getElementById('valo-login-promo')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('btn-login')?.click();
  });

  orderBtn.disabled = false;
}

export async function handleValoCheckout() {
  const state = appState.valo;
  if (!state.selectedNominal) {
    showCyberToast('Silakan pilih nominal Valorant Points terlebih dahulu!', 'warning', 'PILIHAN NOMINAL');
    return;
  }

  const riotIdInput = document.getElementById('valo-riotid');
  const riotId = riotIdInput?.value.trim() || '';

  if (!riotId || !riotId.includes('#')) {
    showCyberToast('Silakan masukkan Riot ID yang valid dengan Tagline! (Contoh: Player#1234)', 'warning', 'DATA AKUN GAME');
    riotIdInput?.focus();
    return;
  }

  const parts = riotId.split('#');
  if (parts.length !== 2) {
    showCyberToast('Format Riot ID salah! Pastikan hanya ada satu tanda # . Contoh: Player#1234', 'warning', 'FORMAT RIOT ID');
    riotIdInput?.focus();
    return;
  }

  const [namaPart, tagPart] = parts;
  const namaRegex = /^.{3,16}$/;
  const tagRegex = /^\d{3,5}$/;

  if (!namaRegex.test(namaPart.trim())) {
    showCyberToast('Nama pada Riot ID harus 3-16 karakter! Contoh: Player#1234', 'warning', 'NAMA RIOT ID');
    riotIdInput?.focus();
    return;
  }

  if (!tagRegex.test(tagPart.trim())) {
    showCyberToast('Tagline Riot ID harus berupa angka saja (3-5 digit) untuk Region Indonesia! Contoh: Player#1234', 'warning', 'TAGLINE RIOT ID');
    riotIdInput?.focus();
    return;
  }

  state.riotId = `${namaPart.trim()}#${tagPart.trim()}`;

  if (!state.selectedPayment) {
    showCyberToast('Silakan pilih metode pembayaran QRIS Instant!', 'warning', 'METODE PEMBAYARAN');
    return;
  }

  const emailInput = document.getElementById('valo-email');
  const email = emailInput?.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showCyberToast('Silakan masukkan alamat email yang valid untuk menerima bukti transaksi & nomor seri pesanan!', 'warning', 'EMAIL NOTIFIKASI');
    emailInput?.focus();
    return;
  }
  state.email = email;

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
      wa_email_guest: state.email,
      payment_method: state.selectedPayment.name,
      qty: 1,
      use_points: Boolean(state.usePoints),
      points_to_use: state.usePoints ? (state.computedPointsUsed || 0) : 0
    });

    if (!data.success || !data.order) {
      showCyberToast(data.message || 'Gagal membuat pesanan top-up.', 'error', 'PESANAN GAGAL');
      return;
    }

    const order = data.order || {};
    const qrCodeUrl = data.qrCodeUrl || order.qris_url || order.qrCodeUrl;
    const expiredAt = data.expiredAt || order.expired_at || order.expiredAt;
    const invoiceNumber = data.invoiceNumber || order.invoice_number;
    appState.currentInvoice = { ...order, invoice_number: invoiceNumber, qris_url: qrCodeUrl, expired_at: expiredAt };

    // If points used, update user local points balance and header
    if (data.pointsUsed > 0 && appState.currentUser) {
      appState.currentUser.points = Math.max(0, (appState.currentUser.points || 0) - data.pointsUsed);
      const pointsBadge = document.querySelector('.user-points-badge');
      if (pointsBadge && !pointsBadge.innerText.includes('Admin')) {
        pointsBadge.innerText = `⭐ ${appState.currentUser.points} Poin`;
      }
      state.usePoints = false;
      updateValoSummary();
    }

    const modalBody = document.getElementById('checkout-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 10px;">
            <img src="/assets/logo/darsstore_emblem.svg" alt="Dar'sstore" style="height: 48px; width: 48px; filter: drop-shadow(0 0 12px rgba(0, 97, 153, 0.4));" />
          </div>
          <div style="font-size: 13px; color: var(--text-muted);">NOMOR INVOICE</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
            ${invoiceNumber}
          </div>
        </div>

        <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Game:</span>
            <strong>Valorant (Riot Games)</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Item:</span>
            <strong>${order.nama_item || state.selectedNominal.name}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Akun Tujuan:</span>
            <strong>${order.riot_id || state.riotId}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Metode Bayar:</span>
            <strong>${order.payment_method || state.selectedPayment.name} (Midtrans QRIS)</strong>
          </div>
          ${order.discount_amount > 0 ? `
            <div class="summary-row" style="margin-bottom: 8px; color: #fde047;">
              <span>Diskon Poin (${order.points_used} Poin):</span>
              <strong style="color: #fde047;">-${formatRupiah(order.discount_amount)}</strong>
            </div>
          ` : ''}
          <div class="summary-row total" style="padding-top: 10px;">
            <span>Total Tagihan:</span>
            <strong style="color: var(--accent-gold-light); font-size: 18px;">${formatRupiah(data.totalHarga || order.total_harga)}</strong>
          </div>
        </div>

        <div class="qr-code-wrap" style="background: #ffffff; padding: 18px; border-radius: var(--radius-lg); text-align: center; margin-bottom: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
          <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; margin-bottom: 10px; background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(2, 132, 199, 0.35); border-radius: 20px; font-size: 11px; font-weight: 800; color: #0284c7; letter-spacing: 0.5px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #0284c7; display: inline-block;"></span>
            LINGKUNGAN SANDBOX MIDTRANS
          </div>
          <div style="font-size: 13px; color: #16212c; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
            SCAN QRIS UNTUK MEMBAYAR
          </div>
          ${qrCodeUrl ? `
            <img src="${qrCodeUrl}" onerror="this.onerror=null; this.src='/assets/payments/qris_sample.svg';" alt="QRIS Midtrans" class="qr-code-img" style="margin: 0 auto; width: 195px; height: 195px; border-radius: 8px; object-fit: contain; display: block;" />
          ` : `
            <img src="/assets/payments/qris_sample.svg" alt="QRIS Midtrans" class="qr-code-img" style="margin: 0 auto; width: 195px; height: 195px; border-radius: 8px; object-fit: contain; display: block;" />
          `}
          <div style="font-size: 11.5px; color: #475569; margin-top: 10px; font-weight: 600;">
            Mendukung GoPay, DANA, OVO, ShopeePay, LinkAja & Seluruh Mobile Banking (Sandbox)
          </div>
        </div>

        <!-- Midtrans Sandbox Simulator Action Box -->
        <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 13px 15px; margin-bottom: 16px; text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
            <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
              <span>🧪</span> Simulator Pembayaran QRIS Midtrans (Sandbox)
            </div>
            <span style="font-size: 10px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #7dd3fc; padding: 2px 8px; border-radius: 4px; font-family: monospace;">SANDBOX MODE</span>
          </div>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.45; margin-bottom: 10px;">
            Untuk uji coba scan QRIS Sandbox, buka Payment Simulator Midtrans resmi lalu tempel URL Gambar QR atau gunakan tombol simulasi instan di bawah:
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="https://simulator.sandbox.midtrans.com/qris/index" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; text-decoration: none; border-radius: 7px; font-size: 11.5px; font-weight: 700; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              <span>Buka Midtrans Payment Simulator</span>
            </a>
            <button type="button" style="padding: 7px 11px; background: var(--bg-card); border: 1px solid var(--border-card); color: var(--text-primary); border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer;" onclick="window.copyQrCodeUrl('${qrCodeUrl}')">
              📋 Salin URL Gambar QR
            </button>
            ${(order.qris_string || data.qrisString) ? `
              <button type="button" style="padding: 7px 11px; background: var(--bg-card); border: 1px solid var(--border-card); color: var(--text-primary); border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer;" onclick="window.copyQrCodeString('${order.qris_string || data.qrisString}')">
                📋 Salin QR String
              </button>
            ` : ''}
          </div>
        </div>

        ${(data.redirectUrl || order.redirect_url) ? `
          <div style="margin-bottom: 16px;">
            <a href="${data.redirectUrl || order.redirect_url}" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 13px; font-size: 14px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0070f3, #0050d0); box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); color: #ffffff;">
              🚀 Buka Halaman Pembayaran Midtrans (Payment Link)
            </a>
          </div>
        ` : ''}

        <p style="font-size: 12.5px; color: var(--text-muted); text-align: center; line-height: 1.5;">
          Selesaikan pembayaran dalam waktu <strong id="valo-qris-timer" style="color: var(--accent-gold); font-weight: 800; font-size: 14px;">15:00</strong>. Pesanan diproses otomatis dalam 1-3 detik setelah scan QRIS berhasil.
        </p>
      `;

      startQrisCountdown('valo-qris-timer', expiredAt);
    }

    openModal('checkout-modal');
    if (window.startCheckoutPoller) {
      window.startCheckoutPoller(invoiceNumber);
    }
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
