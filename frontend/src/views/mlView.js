import { ML_NOMINALS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';
import { appState } from '../utils/state.js';
import { createOrder, checkMLAccount } from '../api/orders.js';
import { getProducts } from '../api/products.js';
import { renderPaymentAccordion, updatePaymentAccordionPrices } from '../components/paymentAccordion.js';
import { renderFAQs } from './homepage.js';
import { openModal } from '../components/modals.js';
import { showCyberToast } from '../utils/cyberPopup.js';
import { startQrisCountdown } from '../utils/countdown.js';

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let checkRequestSeq = 0;
let debounceTimer = null;
let lastCheckedKey = '';

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

export async function performMLAccountCheck(options = {}) {
  const showToast = options.showToastOnFailure !== false;
  const uidInput = document.getElementById('ml-userid');
  const srvInput = document.getElementById('ml-server');
  const resultContainer = document.getElementById('ml-account-check-result');
  const checkBtn = document.getElementById('ml-btn-check-account');

  if (!uidInput || !srvInput) return false;

  const uid = uidInput.value.trim();
  const srv = srvInput.value.trim();
  const state = appState.ml;

  if (!uid || !srv) {
    if (options.manualClick && showToast) {
      showCyberToast('Harap isi User ID dan Server / Zone ID Mobile Legends terlebih dahulu.', 'warning', 'DATA BELUM LENGKAP');
      if (!uid) uidInput.focus();
      else srvInput.focus();
    }
    return false;
  }

  if (!/^\d{6,10}$/.test(uid)) {
    if (options.manualClick && showToast) {
      showCyberToast('User ID tidak valid (harus 6-10 digit angka). Contoh: 123456789', 'warning', 'USER ID TIDAK VALID');
      uidInput.focus();
    }
    return false;
  }

  if (!/^\d{3,5}$/.test(srv)) {
    if (options.manualClick && showToast) {
      showCyberToast('Zone ID / Server tidak valid (harus 3-5 digit angka). Contoh: 2114', 'warning', 'SERVER ID TIDAK VALID');
      srvInput.focus();
    }
    return false;
  }

  const currentKey = `${uid}:${srv}`;

  // Jika akun ini sudah dicek sebelumnya dan valid, tidak perlu cek ulang
  if (lastCheckedKey === currentKey && state.accountVerified && state.nickname) {
    return true;
  }

  const seq = ++checkRequestSeq;

  // Tampilkan indikator loading
  if (checkBtn) {
    checkBtn.disabled = true;
    checkBtn.innerHTML = `
      <span class="account-spinner"></span>
      <span>Mengecek...</span>
    `;
  }

  if (resultContainer) {
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="account-status-card checking">
        <span class="account-spinner"></span>
        <span>Sedang memverifikasi User ID <strong>${escapeHTML(uid)}</strong> (${escapeHTML(srv)}) ke server game Mobile Legends...</span>
      </div>
    `;
  }

  try {
    const data = await checkMLAccount(uid, srv);

    // Abaikan jika ada request baru yang telah dieksekusi
    if (seq !== checkRequestSeq) return false;

    lastCheckedKey = currentKey;

    if (data && data.valid === true && data.nickname) {
      state.userId = uid;
      state.server = srv;
      state.nickname = data.nickname;
      state.accountVerified = true;
      state.accountStatus = 'valid';

      uidInput.style.borderColor = '#10b981';
      srvInput.style.borderColor = '#10b981';

      if (resultContainer) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
          <div class="account-status-card valid">
            <div class="account-status-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="account-status-details">
              <div class="account-status-title">AKUN TERVERIFIKASI</div>
              <div class="account-status-nickname">
                Nickname: <strong class="nickname-highlight">${escapeHTML(data.nickname)}</strong>
              </div>
              <div class="account-status-sub">ID: ${escapeHTML(uid)} (${escapeHTML(srv)}) • Terdaftar di database Mobile Legends</div>
            </div>
          </div>
        `;
      }

      updateMLSummary();
      return true;
    } else if (data && data.valid === false) {
      state.nickname = '';
      state.accountVerified = false;
      state.accountStatus = 'invalid';

      uidInput.style.borderColor = '#ef4444';
      srvInput.style.borderColor = '#ef4444';

      if (resultContainer) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
          <div class="account-status-card invalid">
            <div class="account-status-icon error-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <div class="account-status-details">
              <div class="account-status-title error-title">AKUN TIDAK DITEMUKAN / TIDAK TERDAFTAR</div>
              <div class="account-status-msg">
                Kombinasi User ID <strong>${escapeHTML(uid)}</strong> dan Server <strong>(${escapeHTML(srv)})</strong> tidak terdaftar. Mohon periksa kembali nomor ID dalam profil game Mobile Legends Anda.
              </div>
            </div>
          </div>
        `;
      }

      if (showToast) {
        showCyberToast(`Akun Mobile Legends (${uid} - ${srv}) tidak terdaftar! Periksa kembali User ID & Server Anda.`, 'error', 'AKUN TIDAK TERDAFTAR');
      }

      updateMLSummary();
      return false;
    } else {
      // Layanan pengecekan sementara tidak merespons / timeout
      state.accountStatus = 'unavailable';
      uidInput.style.borderColor = '';
      srvInput.style.borderColor = '';

      if (resultContainer) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
          <div class="account-status-card warning">
            <div class="account-status-icon warning-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div class="account-status-details">
              <div class="account-status-title warning-title">LAYANAN PENGECEKAN SIBUK</div>
              <div class="account-status-msg" style="color: #fef08a;">
                Layanan verifikasi nickname sementara sibuk. Pastikan User ID <strong>${escapeHTML(uid)}</strong> dan Server <strong>(${escapeHTML(srv)})</strong> sudah Anda periksa dengan teliti.
              </div>
            </div>
          </div>
        `;
      }
      return null;
    }
  } catch (err) {
    console.error('Account check error:', err);
    if (seq === checkRequestSeq && resultContainer) {
      resultContainer.style.display = 'block';
      resultContainer.innerHTML = `
        <div class="account-status-card warning">
          <div class="account-status-details">
            <div class="account-status-title warning-title">KONEKSI GAGAL</div>
            <div class="account-status-msg" style="color: #fef08a;">Gagal menghubungi server pengecekan. Silakan coba klik tombol cek akun lagi.</div>
          </div>
        </div>
      `;
    }
    return null;
  } finally {
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Cek Akun &amp; Nickname</span>
      `;
    }
  }
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

  const uidInput = document.getElementById('ml-userid');
  const srvInput = document.getElementById('ml-server');
  const resultContainer = document.getElementById('ml-account-check-result');
  const checkBtn = document.getElementById('ml-btn-check-account');

  restrictToNumeric(uidInput, 10);
  restrictToNumeric(srvInput, 5);

  function resetCheckState() {
    lastCheckedKey = '';
    appState.ml.nickname = '';
    appState.ml.accountVerified = false;
    appState.ml.accountStatus = null;
    if (uidInput) uidInput.style.borderColor = '';
    if (srvInput) srvInput.style.borderColor = '';
    if (resultContainer) {
      resultContainer.style.display = 'none';
      resultContainer.innerHTML = '';
    }
    updateMLSummary();
  }

  function handleAutoCheck() {
    const uid = uidInput?.value.trim() || '';
    const srv = srvInput?.value.trim() || '';
    const currentKey = `${uid}:${srv}`;

    if (lastCheckedKey && lastCheckedKey !== currentKey) {
      resetCheckState();
    }

    if (/^\d{6,10}$/.test(uid) && /^\d{3,5}$/.test(srv)) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performMLAccountCheck({ showToastOnFailure: true });
      }, 600);
    }
  }

  if (uidInput && !uidInput.dataset.checkListenerAttached) {
    uidInput.dataset.checkListenerAttached = 'true';
    uidInput.addEventListener('input', handleAutoCheck);
    uidInput.addEventListener('blur', () => {
      const uid = uidInput.value.trim();
      const srv = srvInput?.value.trim() || '';
      if (/^\d{6,10}$/.test(uid) && /^\d{3,5}$/.test(srv) && !appState.ml.accountVerified) {
        clearTimeout(debounceTimer);
        performMLAccountCheck({ showToastOnFailure: true });
      }
    });
  }

  if (srvInput && !srvInput.dataset.checkListenerAttached) {
    srvInput.dataset.checkListenerAttached = 'true';
    srvInput.addEventListener('input', handleAutoCheck);
    srvInput.addEventListener('blur', () => {
      const uid = uidInput?.value.trim() || '';
      const srv = srvInput.value.trim();
      if (/^\d{6,10}$/.test(uid) && /^\d{3,5}$/.test(srv) && !appState.ml.accountVerified) {
        clearTimeout(debounceTimer);
        performMLAccountCheck({ showToastOnFailure: true });
      }
    });
  }

  if (checkBtn && !checkBtn.dataset.listenerAttached) {
    checkBtn.dataset.listenerAttached = 'true';
    checkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearTimeout(debounceTimer);
      performMLAccountCheck({ manualClick: true, showToastOnFailure: true });
    });
  }

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
    updatePaymentAccordionPrices('ml-payments-container', 0);
    summaryBox.innerHTML = `<div class="summary-empty-state">Belum ada item produk yang dipilih.</div>`;
    orderBtn.disabled = false;
    return;
  }

  const qty = state.qty || 1;
  const basePrice = state.selectedNominal.price * qty;
  const fee = state.selectedPayment ? (state.selectedPayment.fee || 0) : 0;
  updatePaymentAccordionPrices('ml-payments-container', basePrice);

  // Anti-loss loyalty calculations:
  // 1 Poin = Rp 10
  // Max discount 20% of basePrice
  const user = appState.currentUser;
  const userPoints = user ? (user.points || 0) : 0;
  const maxDiscountRupiah = Math.floor(basePrice * 0.20);
  const maxPointsEligible = Math.floor(maxDiscountRupiah / 10);
  const pointsAvailableToUse = Math.min(userPoints, maxPointsEligible);

  let discountAmount = 0;
  let pointsUsed = 0;

  if (state.usePoints && pointsAvailableToUse > 0) {
    pointsUsed = pointsAvailableToUse;
    discountAmount = pointsUsed * 10;
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
            Potong harga s/d 20% (Hemat ${formatRupiah(pointsAvailableToUse * 10)} dengan ${pointsAvailableToUse} Poin)
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

  const targetAccount = (state.userId && state.server) ? `${state.userId} (${state.server})` : (state.userId || 'Belum diisi');

  summaryBox.innerHTML = `
    <div class="summary-details-list">
      <div class="summary-row">
        <span>Item</span>
        <strong style="color: var(--text-primary);">${state.selectedNominal.name}</strong>
      </div>
      <div class="summary-row">
        <span>Akun Tujuan</span>
        <strong>${targetAccount}</strong>
      </div>
      ${state.nickname ? `
        <div class="summary-row" style="background: rgba(56, 189, 248, 0.08); padding: 6px 10px; border-radius: 6px; margin: 4px 0 8px; border: 1px dashed rgba(56, 189, 248, 0.35);">
          <span style="color: #38bdf8; font-weight: 700;">Nickname MLBB:</span>
          <strong style="color: #38bdf8; font-size: 13.5px;">${escapeHTML(state.nickname)}</strong>
        </div>
      ` : ''}
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
          <span>Biaya Admin (${state.selectedPayment.name})</span>
          <span>${fee === 0 ? '<strong style="color: #34d399;">Gratis Admin</strong>' : `<strong style="color: #fbbf24;">Tambahan Admin +${formatRupiah(fee)}</strong>`}</span>
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

  // Jika akun sudah dicek dan terbukti TIDAK TERDAFTAR, blokir checkout!
  if (state.accountStatus === 'invalid') {
    showCyberToast(`Akun Mobile Legends (${uid} - ${srv}) tidak terdaftar! Harap periksa kembali User ID dan Server sebelum memesan.`, 'error', 'AKUN TIDAK VALID');
    uidInput?.focus();
    return;
  }

  // Jika belum terverifikasi, lakukan pengecekan akun sekarang
  if (!state.accountVerified) {
    const verified = await performMLAccountCheck({ showToastOnFailure: true });
    if (verified === false) {
      return;
    }
  }

  state.userId = uid;
  state.server = srv;

  if (!state.selectedPayment || state.selectedPayment.isDemo) {
    showCyberToast('Silakan pilih salah satu Bank Virtual Account untuk melakukan pembayaran!', 'warning', 'METODE PEMBAYARAN');
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
      payment_channel: state.selectedPayment.channel || null,
      fee: state.selectedPayment.fee !== undefined ? state.selectedPayment.fee : 0,
      qty: state.qty || 1,
      use_points: Boolean(state.usePoints),
      points_to_use: state.usePoints ? (state.computedPointsUsed || 0) : 0
    });

    if (!data.success || !data.order) {
      showCyberToast(data.message || 'Gagal membuat pesanan top-up.', 'error', 'PESANAN GAGAL');
      return;
    }

    const order = data.order || {};
    const expiredAt = data.expiredAt || order.expired_at || order.expiredAt;
    const invoiceNumber = data.invoiceNumber || order.invoice_number;
    const vaNumber = data.vaNumber || order.va_number;
    const billKey = data.billKey || order.bill_key;
    const billerCode = data.billerCode || order.biller_code;
    const bankName = data.bank || order.bank || 'Bank Transfer';
    const redirectUrl = data.redirectUrl || order.redirect_url;

    appState.currentInvoice = { ...order, invoice_number: invoiceNumber, expired_at: expiredAt, va_number: vaNumber, bank: bankName };

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

        <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
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
            <strong>${order.game_user_id || state.userId} (${order.server_id || state.server})${state.nickname ? ` — ${escapeHTML(state.nickname)}` : ''}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Metode Bayar:</span>
            <strong style="color: #38bdf8;">${order.payment_method || state.selectedPayment.name}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Harga Produk:</span>
            <strong>${formatRupiah(data.basePrice || ((state.selectedNominal.price || 0) * (state.qty || 1)))}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Biaya Admin:</span>
            <strong style="color: ${(data.fee ?? (state.selectedPayment?.fee || 0)) === 0 ? '#34d399' : '#fbbf24'};">${(data.fee ?? (state.selectedPayment?.fee || 0)) === 0 ? 'Gratis Admin' : `Tambahan Admin +${formatRupiah(data.fee ?? state.selectedPayment.fee)}`}</strong>
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

        <!-- Virtual Account Payment Box -->
        <div style="background: rgba(15, 23, 42, 0.9); border: 2px solid rgba(0, 112, 243, 0.5); border-radius: var(--radius-lg); padding: 18px; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 20px rgba(0, 112, 243, 0.2);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;">
            <span class="payment-status-badge badge-available" style="font-size: 11px;">VERIFIKASI OTOMATIS MIDTRANS</span>
          </div>

          ${vaNumber ? `
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
              Nomor Virtual Account (${bankName})
            </div>
            <div style="font-family: monospace; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin-bottom: 12px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2);">
              ${vaNumber}
            </div>
            <button onclick="navigator.clipboard.writeText('${vaNumber}').then(() => alert('Nomor Virtual Account disalin: ${vaNumber}'))" class="btn-order-now" style="margin: 0 auto 12px; padding: 7px 18px; font-size: 12.5px; width: auto; background: var(--accent-gold); color: #000; font-weight: 800; border-radius: 6px;">
              📋 Salin No. Virtual Account
            </button>
          ` : (billKey ? `
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
              Kode Perusahaan: <strong style="color: #fff;">${billerCode || '70012'}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
              Nomor Pembayaran (Bill Key):
            </div>
            <div style="font-family: monospace; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin-bottom: 12px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;">
              ${billKey}
            </div>
            <button onclick="navigator.clipboard.writeText('${billKey}').then(() => alert('Bill Key disalin: ${billKey}'))" class="btn-order-now" style="margin: 0 auto 12px; padding: 7px 18px; font-size: 12.5px; width: auto; background: var(--accent-gold); color: #000; font-weight: 800; border-radius: 6px;">
              📋 Salin Bill Key
            </button>
          ` : `
            <div style="font-size: 13.5px; color: var(--text-primary); margin-bottom: 10px;">
              Instruksi Virtual Account siap diakses melalui portal resmi Midtrans:
            </div>
          `)}

          ${redirectUrl ? `
            <div style="margin-top: 10px; margin-bottom: 10px;">
              <a href="${redirectUrl}" target="_blank" rel="noopener noreferrer" class="btn-order-now" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 12px; font-size: 13.5px; font-weight: 700; border-radius: var(--radius-md); background: linear-gradient(135deg, #0070f3, #0050d0); box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); color: #ffffff;">
                🚀 Buka Panduan & Halaman Transfer Midtrans
              </a>
            </div>
          ` : ''}

          <div style="font-size: 11.5px; color: var(--text-muted); text-align: left; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 6px; margin-top: 10px; line-height: 1.6;">
            💡 <strong>Panduan Transfer:</strong> Buka m-Banking/ATM &rarr; Pilih menu Bayar/Transfer Virtual Account &rarr; Masukkan nomor VA di atas &rarr; Pastikan total bayar tepat <strong>${formatRupiah(data.totalHarga || order.total_harga)}</strong>.<br/>
            💬 <strong>Bantuan CS WhatsApp:</strong> <a href="https://wa.me/6287729424233?text=Halo%20Dar'sstore,%20saya%20butuh%20bantuan%20terkait%20pesanan%20${invoiceNumber}" target="_blank" rel="noopener noreferrer" style="color: #22c55e; font-weight: 700; text-decoration: underline;">+62 877-2942-4233</a>
          </div>
        </div>

        <p style="font-size: 12.5px; color: var(--text-muted); text-align: center; line-height: 1.5;">
          Selesaikan transfer sebelum batas waktu: <strong id="ml-va-timer" style="color: var(--accent-gold); font-weight: 800; font-size: 14px;">23:59:59</strong>. Status transaksi diperbarui otomatis saat dana diterima.
        </p>
      `;

      startQrisCountdown('ml-va-timer', expiredAt);
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
