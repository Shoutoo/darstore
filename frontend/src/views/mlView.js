import { ML_NOMINALS } from '../data/index.js';
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
    <div class="nominal-card" data-id="${item.id}" data-game="ml">
      <div class="nominal-info">
        <div class="nominal-name">${item.name}</div>
        <div class="nominal-price">${formatRupiah(item.price)}</div>
      </div>
      <img src="${item.icon}" alt="" class="nominal-icon" />
      ${item.tag ? `<span class="nominal-tag-badge">${item.tag}</span>` : ''}
    </div>
  `;
}

export async function renderMLView() {
  const container = document.getElementById('ml-nominals-container');
  if (!container) return;

  let items = [...ML_NOMINALS.topup_diamonds];

  try {
    const data = await getProducts('mlbb');
    if (data && data.success && data.products && data.products.length > 0) {
      items = data.products.map(p => ({
        id: p.id.toString(),
        name: p.nama_item || p.namaItem,
        price: Number(p.harga),
        icon: (p.icon && !p.icon.includes('diamond_small.png')) ? p.icon : '/assets/icons/diamond_single.png'
      }));
    }
  } catch (err) {
    console.warn('Fetching MLBB products from database:', err);
  }

  // Urutkan dari harga termurah ke termahal
  items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  appState.mlProducts = items;

  container.innerHTML = `
    <div style="margin-bottom: 16px; position: relative;">
      <input 
        type="text" 
        id="ml-nominal-search" 
        placeholder="🔍 Cari nominal (contoh: 50, Weekly Pass, Twilight, 1000...)" 
        style="width: 100%; padding: 12px 16px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); color: #fff; font-size: 13.5px; outline: none; box-sizing: border-box;"
      />
    </div>
    <div class="nominals-grid" id="ml-diamonds-grid">
      ${items.map(item => createNominalCardHTML(item)).join('')}
    </div>
  `;

  const searchInput = document.getElementById('ml-nominal-search');
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
      appState.ml.selectedNominal = (appState.mlProducts || items).find(i => i.id === itemId);
      updateMLSummary();
    });
  });

  renderPaymentAccordion('ml-payments-container', 'ml', appState, () => updateMLSummary());
  renderFAQs('ml-faq-list');
  setupMLInputValidation();
}

export function setupMLInputValidation() {
  function restrictToNumeric(inputEl, maxLength) {
    if (!inputEl) return;
    if (inputEl.dataset.numericRestricted === 'true') return;
    inputEl.dataset.numericRestricted = 'true';
    inputEl.addEventListener('input', () => {
      inputEl.value = inputEl.value.replace(/\D/g, '').slice(0, maxLength);
    });
  }

  restrictToNumeric(document.getElementById('ml-userid'), 10);
  restrictToNumeric(document.getElementById('ml-server'), 5);

  const emailEl = document.getElementById('ml-email');
  if (emailEl && appState.currentUser?.email && !emailEl.value) {
    emailEl.value = appState.currentUser.email;
  }
}

export function updateMLSummary() {
  const state = appState.ml;
  const summaryBox = document.getElementById('ml-summary-content');
  const orderBtn = document.getElementById('ml-btn-order');
  if (!summaryBox || !orderBtn) return;

  if (!state.selectedNominal) {
    summaryBox.innerHTML = `<div class="summary-empty-state">Belum ada item produk yang dipilih.</div>`;
    orderBtn.disabled = false;
    return;
  }

  const qty = state.qty || 1;
  const basePrice = state.selectedNominal.price * qty;
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
        <div class="summary-loyalty-box ${state.usePoints ? 'active' : ''}" id="ml-loyalty-box">
          <div class="summary-loyalty-header">
            <label class="summary-loyalty-checkbox-label">
              <input type="checkbox" id="ml-toggle-points" ${state.usePoints ? 'checked' : ''} />
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
        💡 <a href="#" id="ml-login-promo" style="color: var(--accent-gold-light); font-weight: 700; text-decoration: underline;">Masuk Akun</a> untuk mendapatkan poin loyalty (+${pointsEst} poin) dan gunakan poin untuk potong harga!
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
        <strong>x${qty}</strong>
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
  document.getElementById('ml-toggle-points')?.addEventListener('change', (e) => {
    state.usePoints = e.target.checked;
    updateMLSummary();
  });

  document.getElementById('ml-login-promo')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('btn-login')?.click();
  });

  orderBtn.disabled = false;
}

export async function handleMLCheckout() {
  const state = appState.ml;
  if (!state.selectedNominal) {
    showCyberToast('Silakan pilih nominal Diamond / Pass terlebih dahulu!', 'warning', 'PILIHAN NOMINAL');
    return;
  }

  const uidInput = document.getElementById('ml-userid');
  const srvInput = document.getElementById('ml-server');
  const uid = uidInput?.value.trim() || '';
  const srv = srvInput?.value.trim() || '';

  const uidRegex = /^\d{6,10}$/;
  const srvRegex = /^\d{3,5}$/;

  if (!uid || !srv) {
    showCyberToast('Silakan masukkan User ID dan Server Mobile Legends Anda!', 'warning', 'DATA AKUN GAME');
    if (!uid) {
      uidInput?.focus();
    } else {
      srvInput?.focus();
    }
    return;
  }

  if (!uidRegex.test(uid)) {
    showCyberToast('User ID tidak valid! User ID Mobile Legends hanya berupa angka (6-10 digit). Contoh: 123456789', 'warning', 'USER ID TIDAK VALID');
    uidInput?.focus();
    return;
  }

  if (!srvRegex.test(srv)) {
    showCyberToast('Zone ID/Server tidak valid! Zone ID hanya berupa angka (3-5 digit), lihat angka di dalam kurung pada profil ML Anda. Contoh: 2114', 'warning', 'ZONE ID TIDAK VALID');
    srvInput?.focus();
    return;
  }

  state.userId = uid;
  state.server = srv;

  if (!state.selectedPayment) {
    showCyberToast('Silakan pilih metode pembayaran QRIS Instant!', 'warning', 'METODE PEMBAYARAN');
    return;
  }

  const emailInput = document.getElementById('ml-email');
  const email = emailInput?.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showCyberToast('Silakan masukkan alamat email yang valid untuk menerima bukti transaksi & nomor seri pesanan!', 'warning', 'EMAIL NOTIFIKASI');
    emailInput?.focus();
    return;
  }
  state.email = email;

  const orderBtn = document.getElementById('ml-btn-order');
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.textContent = 'Membuat Pesanan...';
  }

  try {
    const data = await createOrder({
      product_id: state.selectedNominal.id,
      game: 'mlbb',
      game_user_id: state.userId,
      server_id: state.server,
      wa_email_guest: state.email,
      payment_method: state.selectedPayment.name,
      qty: state.qty || 1,
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
      updateMLSummary();
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
            <strong>Mobile Legends: Bang Bang</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Item:</span>
            <strong>${order.nama_item || state.selectedNominal.name}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Akun Tujuan:</span>
            <strong>${order.game_user_id || state.userId} (${order.server_id || state.server})</strong>
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

        <div class="qr-code-wrap" style="background: #ffffff; padding: 18px; border-radius: var(--radius-lg); text-align: center; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
          <div style="font-size: 13px; color: #16212c; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
            SCAN QRIS UNTUK MEMBAYAR
          </div>
          ${qrCodeUrl ? `
            <img src="${qrCodeUrl}" onerror="this.onerror=null; this.src='/assets/payments/qris_sample.svg';" alt="QRIS Midtrans" class="qr-code-img" style="margin: 0 auto; width: 195px; height: 195px; border-radius: 8px; object-fit: contain; display: block;" />
          ` : `
            <img src="/assets/payments/qris_sample.svg" alt="QRIS Midtrans" class="qr-code-img" style="margin: 0 auto; width: 195px; height: 195px; border-radius: 8px; object-fit: contain; display: block;" />
          `}
          <div style="font-size: 11.5px; color: #475569; margin-top: 10px; font-weight: 600;">
            Mendukung GoPay, DANA, OVO, ShopeePay, LinkAja & Seluruh Mobile Banking
          </div>
        </div>

        ${(data.redirectUrl || order.redirect_url) ? `
          <div style="margin-bottom: 16px;">
            <a href="${data.redirectUrl || order.redirect_url}" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px; font-size: 13.5px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0070f3, #0050d0); box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); color: #ffffff;">
              🚀 Buka Halaman Pembayaran Midtrans Live
            </a>
          </div>
        ` : ''}

        <p style="font-size: 12.5px; color: var(--text-muted); text-align: center; line-height: 1.5;">
          Selesaikan pembayaran dalam waktu <strong id="ml-qris-timer" style="color: var(--accent-gold); font-weight: 800; font-size: 14px;">15:00</strong>. Pesanan diproses otomatis dalam 1-3 detik setelah scan QRIS berhasil.
        </p>
      `;

      startQrisCountdown('ml-qris-timer', expiredAt);
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
