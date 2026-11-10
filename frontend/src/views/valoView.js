import { VALO_NOMINALS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';
import { appState } from '../utils/state.js';
import { createOrder } from '../api/orders.js';
import { getProducts } from '../api/products.js';
import { renderPaymentAccordion, updatePaymentAccordionPrices } from '../components/paymentAccordion.js';
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

  let items = VALO_NOMINALS['id'].map(item => ({
    ...item,
    nominal: Number(item.nominal) || parseInt(String(item.name || '').replace(/\D/g, ''), 10) || 0
  }));

  try {
    const data = await getProducts('valorant');
    if (data && data.success && data.products && data.products.length > 0) {
      items = data.products.map(p => {
        const itemName = p.nama_item || p.namaItem || '';
        return {
          id: p.id.toString(),
          name: itemName,
          nominal: Number(p.nominal) || parseInt(String(itemName).replace(/\D/g, ''), 10) || 0,
          price: Number(p.harga),
          icon: p.icon || '/assets/icons/vp_icon.png'
        };
      });
    }
  } catch (err) {
    console.warn('Fetching Valorant products from database:', err);
  }

  // Urutkan berdasarkan nominal VP terkecil ke terbesar, lalu harga termurah
  items.sort((a, b) => (Number(a.nominal) || 0) - (Number(b.nominal) || 0) || (Number(a.price) || 0) - (Number(b.price) || 0));
  appState.valoProducts = items;

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
    const parts = value.split('#');
    const isValid = parts.length === 2 && /^.{3,16}$/.test(parts[0].trim()) && /^[a-zA-Z0-9]{3,5}$/.test(parts[1].trim());
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
    updatePaymentAccordionPrices('valo-payments-container', 0);
    summaryBox.innerHTML = `<div class="summary-empty-state">Belum ada item produk yang dipilih.</div>`;
    orderBtn.disabled = false;
    return;
  }

  const basePrice = state.selectedNominal.price;
  const fee = state.selectedPayment ? (state.selectedPayment.fee || 0) : 0;
  updatePaymentAccordionPrices('valo-payments-container', basePrice);

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
        <div class="summary-loyalty-box ${state.usePoints ? 'active' : ''}" id="valo-loyalty-box">
          <div class="summary-loyalty-header">
            <label class="summary-loyalty-checkbox-label">
              <input type="checkbox" id="valo-toggle-points" ${state.usePoints ? 'checked' : ''} />
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
  const tagRegex = /^[a-zA-Z0-9]{3,5}$/;

  if (!namaRegex.test(namaPart.trim())) {
    showCyberToast('Nama pada Riot ID harus 3-16 karakter! Contoh: Player#1234 atau Player#IDN', 'warning', 'NAMA RIOT ID');
    riotIdInput?.focus();
    return;
  }

  if (!tagRegex.test(tagPart.trim())) {
    showCyberToast('Tagline Riot ID harus berupa 3-5 karakter huruf/angka! Contoh: Player#1234 atau Player#IDN', 'warning', 'TAGLINE RIOT ID');
    riotIdInput?.focus();
    return;
  }

  state.riotId = `${namaPart.trim()}#${tagPart.trim()}`;

  if (!state.selectedPayment || state.selectedPayment.isDemo) {
    showCyberToast('Silakan pilih salah satu Bank Virtual Account untuk melakukan pembayaran!', 'warning', 'METODE PEMBAYARAN');
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
      payment_channel: state.selectedPayment.channel || null,
      fee: state.selectedPayment.fee !== undefined ? state.selectedPayment.fee : 0,
      qty: 1,
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

        <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
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
            <strong style="color: #38bdf8;">${order.payment_method || state.selectedPayment.name}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Harga Produk:</span>
            <strong>${formatRupiah(data.basePrice || (state.selectedNominal.price || 0))}</strong>
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
          Selesaikan transfer sebelum batas waktu: <strong id="valo-va-timer" style="color: var(--accent-gold); font-weight: 800; font-size: 14px;">23:59:59</strong>. Status transaksi diperbarui otomatis saat dana diterima.
        </p>
      `;

      startQrisCountdown('valo-va-timer', expiredAt);
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
