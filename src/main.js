import {
  GAMES,
  ML_NOMINALS,
  VALO_REGIONS,
  VALO_NOMINALS,
  PAYMENT_GROUPS,
  FAQS
} from './data.js';

// Format currency helper
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('IDR', 'Rp');
}

// Token management
const TOKEN_KEY = 'darsstore_token';
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Application State
const appState = {
  activeView: 'home-view',
  currentUser: null,
  
  ml: {
    selectedNominal: null,
    qty: 1,
    selectedPayment: null,
    userId: '',
    server: '',
    email: '',
    wa: ''
  },
  
  valo: {
    selectedNominal: null,
    qty: 1, // Fixed 1 per instructions
    selectedPayment: null,
    riotId: '',
    email: '',
    wa: ''
  },
  
  currentInvoice: null
};

// ==========================================================
// ROUTER / VIEW SWITCHING
// ==========================================================
function navigateToRoute(route) {
  if (!route) return;
  
  let targetViewId = 'home-view';
  if (route === '#ml') targetViewId = 'ml-topup-view';
  else if (route === '#valo') targetViewId = 'valo-topup-view';
  else if (route === '#cek-transaksi') targetViewId = 'cek-transaksi-view';

  // Instant view transition
  switchView(targetViewId);

  // Sync hash without triggering broken or duplicate transitions
  if (window.location.hash !== route) {
    window.location.hash = route;
  }
}

function switchView(targetViewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => {
    v.style.display = (v.id === targetViewId) ? 'block' : 'none';
  });
  
  appState.activeView = targetViewId;
  
  // Instant scroll to top to prevent landing at bottom of page or cancelled smooth scroll
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Update header nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.target === targetViewId) {
      link.classList.add('active');
    }
  });

  if (targetViewId === 'cek-transaksi-view') {
    fetchRealtimeTable();
  } else if (targetViewId === 'ml-topup-view') {
    if (!appState.mlProducts || appState.mlProducts.length === 0) {
      renderMLView();
    }
  } else if (targetViewId === 'valo-topup-view') {
    if (!appState.valoProducts || appState.valoProducts.length === 0) {
      renderValoView();
    }
  }
}

function handleHashChange() {
  const hash = window.location.hash || '#home';
  if (hash === '#home' || hash === '') {
    switchView('home-view');
  } else if (hash === '#ml') {
    switchView('ml-topup-view');
  } else if (hash === '#valo') {
    switchView('valo-topup-view');
  } else if (hash === '#cek-transaksi') {
    switchView('cek-transaksi-view');
  }
}

// ==========================================================
// AUTHENTICATION & PROFILE
// ==========================================================
async function checkCurrentUser() {
  const token = getToken();
  const authContainer = document.getElementById('nav-auth-container');
  if (!authContainer) return;

  if (!token) {
    appState.currentUser = null;
    renderAuthButtons(authContainer);
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      appState.currentUser = data.user;
      renderUserProfile(authContainer, data.user);
    } else {
      clearToken();
      appState.currentUser = null;
      renderAuthButtons(authContainer);
    }
  } catch (err) {
    console.warn('Failed to verify user session with backend:', err);
    renderAuthButtons(authContainer);
  }
}

function renderAuthButtons(container) {
  container.innerHTML = `
    <button class="btn-auth" id="btn-login">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
      <span>Masuk</span>
    </button>
    <button class="btn-auth" id="btn-register">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
      <span>Daftar</span>
    </button>
  `;

  document.getElementById('btn-login')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-register')?.addEventListener('click', () => openAuthModal('register'));
}

function renderUserProfile(container, user) {
  const adminBadge = user.role === 'admin'
    ? `<a href="/admin.html" class="user-points-badge" style="background: var(--accent-gold); color: #fff; text-decoration: none; font-weight: 700;" title="Buka Dashboard Administrator">🛡️ Admin</a>`
    : '';

  container.innerHTML = `
    <div class="nav-user-badge">
      ${adminBadge}
      <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${user.nama}</span>
      <span class="user-points-badge" title="Poin Loyalitas Dar'sstore">⭐ ${user.points || 0} Poin</span>
      <button class="btn-logout" id="btn-logout" title="Keluar dari akun">Keluar</button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    appState.currentUser = null;
    alert('Anda telah keluar dari akun.');
    checkCurrentUser();
  });
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('btn-submit-auth');
  const switchLink = document.getElementById('auth-switch-link');
  const switchText = document.getElementById('auth-switch-text');
  const nameGroup = document.getElementById('auth-name-group');

  if (mode === 'register') {
    title.textContent = "Daftar Akun Baru Dar'sstore";
    submitBtn.textContent = 'Daftar Sekarang';
    switchText.textContent = 'Sudah punya akun?';
    switchLink.textContent = 'Masuk disini';
    nameGroup.style.display = 'block';
  } else {
    title.textContent = "Masuk ke Akun Dar'sstore";
    submitBtn.textContent = 'Masuk Sekarang';
    switchText.textContent = 'Belum punya akun?';
    switchLink.textContent = 'Daftar disini';
    nameGroup.style.display = 'none';
  }

  openModal('auth-modal');
}

// ==========================================================
// RENDER HOMEPAGE
// ==========================================================
function renderHomepage() {
  // Static HTML is already present in index.html for maximum stability and speed.
  // We re-hydrate only if the containers are unexpectedly empty.
  const popularContainer = document.getElementById('popular-grid-container');
  if (popularContainer && popularContainer.children.length === 0) {
    popularContainer.innerHTML = GAMES.map(game => `
      <a href="${game.route || '#home'}" class="popular-card" data-route="${game.route || '#home'}" data-game-id="${game.id}">
        <img src="${game.image}" alt="${game.name}" class="popular-avatar" />
        <div class="popular-info">
          <div class="popular-name">${game.shortName}</div>
          <div class="popular-pub">${game.publisher}</div>
        </div>
      </a>
    `).join('');
  }

  const gamesGrid = document.getElementById('games-grid-container');
  if (gamesGrid && gamesGrid.querySelectorAll('.game-card').length === 0) {
    renderGamesGrid();
  }
}

function renderGamesGrid() {
  const gamesGrid = document.getElementById('games-grid-container');
  if (!gamesGrid) return;

  gamesGrid.innerHTML = GAMES.map(game => `
    <a href="${game.route || '#home'}" class="game-card" data-route="${game.route || '#home'}" data-game-id="${game.id}">
      <div class="game-poster-wrap">
        <img src="${game.image}" alt="${game.name}" class="game-poster" loading="lazy" />
      </div>
      <div class="game-card-content">
        <div class="game-title">${game.name}</div>
        <div class="game-pub">${game.publisher}</div>
      </div>
    </a>
  `).join('') + `
    <div class="search-empty-state" id="games-search-empty" style="display: none; grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--text-secondary); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
      Tidak ada game yang cocok dengan pencarian
    </div>
  `;
}

// ==========================================================
// RENDER MOBILE LEGENDS VIEW (Database API)
// ==========================================================
async function renderMLView() {
  const container = document.getElementById('ml-nominals-container');
  if (!container) return;

  let items = ML_NOMINALS.topup_diamonds;

  try {
    const res = await fetch('/api/products?game=mlbb');
    const data = await res.json();
    if (res.ok && data.success && data.products.length > 0) {
      items = data.products.map(p => ({
        id: p.id.toString(),
        name: p.nama_item || p.namaItem,
        price: p.harga,
        icon: (p.icon && !p.icon.includes('diamond_small.png')) ? p.icon : '/assets/icons/diamond_single.png'
      }));
      appState.mlProducts = items;
    }
  } catch (err) {
    console.warn('Fetching MLBB products from database:', err);
  }

  container.innerHTML = `
    <div class="nominals-grid" id="ml-diamonds-grid">
      ${items.map(item => createNominalCardHTML(item, 'ml')).join('')}
    </div>
  `;

  container.querySelectorAll('.nominal-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.nominal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const itemId = card.dataset.id;
      appState.ml.selectedNominal = (appState.mlProducts || items).find(i => i.id === itemId);
      updateSummary('ml');
    });
  });

  renderPaymentAccordion('ml-payments-container', 'ml');
  renderFAQs('ml-faq-list');
}

// ==========================================================
// RENDER VALORANT VIEW (Database API)
// ==========================================================
async function renderValoView() {
  const container = document.getElementById('valo-nominals-container');
  if (!container) return;

  let items = VALO_NOMINALS['id'];

  try {
    const res = await fetch('/api/products?game=valorant');
    const data = await res.json();
    if (res.ok && data.success && data.products.length > 0) {
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
      ${items.map(item => createNominalCardHTML(item, 'valo')).join('')}
    </div>
  `;

  container.querySelectorAll('.nominal-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.nominal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const itemId = card.dataset.id;
      appState.valo.selectedNominal = (appState.valoProducts || items).find(i => i.id === itemId);
      updateSummary('valo');
    });
  });

  renderPaymentAccordion('valo-payments-container', 'valo');
  renderFAQs('valo-faq-list');
}

function createNominalCardHTML(item, gameKey) {
  return `
    <div class="nominal-card" data-id="${item.id}" data-game="${gameKey}">
      <div class="nominal-info">
        <div class="nominal-name">${item.name}</div>
        <div class="nominal-price">${formatRupiah(item.price)}</div>
      </div>
      <img src="${item.icon}" alt="" class="nominal-icon" />
      ${item.tag ? `<span class="nominal-tag-badge">${item.tag}</span>` : ''}
    </div>
  `;
}

// ==========================================================
// RENDER PAYMENT ACCORDION (QRIS Only)
// ==========================================================
function renderPaymentAccordion(containerId, gameKey) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = PAYMENT_GROUPS.map((group) => `
    <div class="payment-group expanded" data-group-id="${group.id}">
      <div class="payment-group-header">
        <div class="payment-group-title">
          <span>${group.title}</span>
          ${group.badge ? `<span class="ribbon-best-price">${group.badge}</span>` : ''}
        </div>
        <div class="payment-header-right">
          <div class="payment-header-preview">
            ${group.methods.slice(0, 5).map(m => `<img src="${m.image}" alt="${m.name}" />`).join('')}
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="payment-methods-grid">
        ${group.methods.map(method => `
          <div class="payment-method-card" data-method-id="${method.id}" data-group-id="${group.id}">
            <img src="${method.image}" alt="${method.name}" class="payment-method-logo" />
            <div class="payment-method-info">
              <span class="payment-method-name">${method.name}</span>
              <span class="payment-method-price" data-fee="${method.fee}">
                ${method.fee === 0 ? 'Gratis Biaya' : `+ ${formatRupiah(method.fee)}`}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Toggle accordion expand/collapse
  container.querySelectorAll('.payment-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.payment-group');
      group.classList.toggle('expanded');
    });
  });

  // Select payment method
  container.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      container.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const methodId = card.dataset.methodId;
      for (const grp of PAYMENT_GROUPS) {
        const found = grp.methods.find(m => m.id === methodId);
        if (found) {
          appState[gameKey].selectedPayment = found;
          break;
        }
      }
      updateSummary(gameKey);
    });
  });
}

// ==========================================================
// RENDER FAQS
// ==========================================================
function renderFAQs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = FAQS.map(faq => `
    <div class="faq-item">
      <div class="faq-question">
        <span>${faq.q}</span>
        <svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="faq-answer">
        ${faq.a}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

// ==========================================================
// REALTIME TRANSACTIONS TABLE & INVOICE CHECK (API)
// ==========================================================
async function fetchRealtimeTable() {
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

      return `
        <tr>
          <td>${dateFormatted}</td>
          <td><strong style="color: var(--accent-gold); cursor: pointer;" onclick="document.getElementById('invoice-search-input').value='${tx.invoice_number}'; searchInvoice('${tx.invoice_number}')">${tx.invoice_number}</strong></td>
          <td>${tx.masked_contact}</td>
          <td>${formatRupiah(tx.total_harga)}</td>
          <td>
            <span class="invoice-status-badge ${isSuccess ? 'success' : (isProcess ? 'processing' : 'pending')}">
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

async function searchInvoice(query) {
  const resultContainer = document.getElementById('invoice-result-container');
  if (!resultContainer) return;

  const cleaned = query.trim().toUpperCase();
  if (!cleaned) {
    alert('Silakan masukkan nomor Invoice Anda.');
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
          <span class="invoice-status-badge ${isSuccess ? 'success' : (isProcess ? 'processing' : 'pending')}">
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

        ${!isSuccess ? `
          <div style="margin-top: 20px; padding: 14px; background: rgba(0, 97, 153, 0.12); border: 1px solid var(--accent-gold); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 13px; color: var(--accent-gold-light); margin-bottom: 8px;">
              Pesanan menunggu pembayaran QRIS.
            </div>
            <button class="btn-order-now" style="margin: 0 auto; padding: 8px 18px; width: auto; font-size: 13px;" onclick="simulateInvoicePayment('${order.invoice_number}')">
              ⚡ Konfirmasi Bayar Sekarang (Simulasi)
            </button>
          </div>
        ` : ''}

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

// Global window helper for simulation from result card
window.simulateInvoicePayment = async function(inv) {
  try {
    const res = await fetch('/api/webhook/simulate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_number: inv })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      searchInvoice(inv);
      fetchRealtimeTable();
      checkCurrentUser();
    } else {
      alert(data.message || 'Gagal simulasi pembayaran');
    }
  } catch (err) {
    alert('Gagal menghubungi server.');
  }
};

// ==========================================================
// ORDER SUMMARY & CHECKOUT LOGIC (REAL BACKEND API)
// ==========================================================
function updateSummary(gameKey) {
  const state = appState[gameKey];
  const summaryBox = document.getElementById(`${gameKey}-summary-content`);
  const orderBtn = document.getElementById(`${gameKey}-btn-order`);
  if (!summaryBox || !orderBtn) return;

  if (!state.selectedNominal) {
    summaryBox.innerHTML = `<div class="summary-empty-state">Belum ada item produk yang dipilih.</div>`;
    orderBtn.disabled = true;
    return;
  }

  // Qty is 1 for Valorant always; MLBB can have qty
  const qty = gameKey === 'valo' ? 1 : state.qty;
  const basePrice = state.selectedNominal.price * qty;
  const fee = state.selectedPayment ? state.selectedPayment.fee : 800;
  const total = basePrice + fee;

  // Calculate potential loyalty points
  const pointsEst = Math.floor(total / 10000);

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

async function handleCheckout(gameKey) {
  const state = appState[gameKey];
  if (!state.selectedNominal) {
    alert('Silakan pilih nominal produk terlebih dahulu!');
    return;
  }

  if (gameKey === 'ml') {
    const uid = document.getElementById('ml-userid').value.trim();
    const srv = document.getElementById('ml-server').value.trim();
    if (!uid || !srv) {
      alert('Silakan masukkan User ID dan Server Mobile Legends Anda!');
      document.getElementById('ml-userid').focus();
      return;
    }
    state.userId = uid;
    state.server = srv;
  } else if (gameKey === 'valo') {
    const riotId = document.getElementById('valo-riotid').value.trim();
    if (!riotId || !riotId.includes('#')) {
      alert('Silakan masukkan Riot ID yang valid beserta Tagline! (Contoh: Player#1234)');
      document.getElementById('valo-riotid').focus();
      return;
    }
    state.riotId = riotId;
  }

  if (!state.selectedPayment) {
    alert('Silakan pilih metode pembayaran QRIS!');
    return;
  }

  const wa = document.getElementById(`${gameKey}-wa`).value.trim();
  if (!wa) {
    alert('Silakan masukkan No. WhatsApp Anda untuk menerima notifikasi pesanan!');
    document.getElementById(`${gameKey}-wa`).focus();
    return;
  }
  state.wa = '0' + wa.replace(/^0+/, '');

  const orderBtn = document.getElementById(`${gameKey}-btn-order`);
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.textContent = 'Membuat Pesanan...';
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        product_id: state.selectedNominal.id,
        game: gameKey === 'ml' ? 'mlbb' : 'valorant',
        game_user_id: state.userId || null,
        server_id: state.server || null,
        riot_id: state.riotId || null,
        wa_email_guest: state.wa,
        payment_method: state.selectedPayment.name,
        qty: gameKey === 'valo' ? 1 : state.qty
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.order) {
      alert(data.message || 'Gagal membuat pesanan.');
      return;
    }

    const order = data.order;
    appState.currentInvoice = order;

    // Render checkout modal with real QRIS
    const modalBody = document.getElementById('checkout-modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 13px; color: var(--text-muted);">NOMOR INVOICE</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
            ${order.invoice_number}
          </div>
        </div>

        <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Game:</span>
            <strong>${order.game === 'mlbb' ? 'Mobile Legends: Bang Bang' : 'Valorant'}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Item:</span>
            <strong>${order.nama_item}</strong>
          </div>
          <div class="summary-row" style="margin-bottom: 8px;">
            <span>Akun Tujuan:</span>
            <strong>${order.game === 'mlbb' ? `${order.game_user_id} (${order.server_id})` : order.riot_id}</strong>
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

        <!-- Real QRIS Display -->
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
    alert('Gagal menghubungi server. Pastikan backend server aktif.');
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

// ==========================================================
// MODAL CONTROLS
// ==========================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function setupModals() {
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.classList.remove('open');
    });
  });

  // Copy invoice code button in checkout modal
  const btnCopyInvoice = document.getElementById('btn-copy-invoice-code');
  if (btnCopyInvoice) {
    btnCopyInvoice.addEventListener('click', () => {
      if (appState.currentInvoice) {
        navigator.clipboard.writeText(appState.currentInvoice.invoice_number);
        btnCopyInvoice.textContent = '✓ Tersalin!';
        setTimeout(() => {
          btnCopyInvoice.textContent = 'Salin Invoice';
        }, 2000);
      }
    });
  }

  // Simulate payment button
  const btnSimulate = document.getElementById('btn-simulate-pay');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', async () => {
      if (!appState.currentInvoice) return;
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Memproses...';

      try {
        const res = await fetch('/api/webhook/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_number: appState.currentInvoice.invoice_number })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          alert('✓ Pembayaran QRIS Berhasil Dikonfirmasi!\nItem Diamond/Points telah otomatis masuk ke akun Anda.');
          closeModal('checkout-modal');
          window.location.hash = '#cek-transaksi';
          document.getElementById('invoice-search-input').value = appState.currentInvoice.invoice_number;
          searchInvoice(appState.currentInvoice.invoice_number);
          fetchRealtimeTable();
          checkCurrentUser();
        } else {
          alert(data.message || 'Gagal simulasi pembayaran');
        }
      } catch (err) {
        alert('Gagal menghubungi server.');
      } finally {
        btnSimulate.disabled = false;
        btnSimulate.textContent = '⚡ Simulasi Bayar QRIS (Demo)';
      }
    });
  }

  // Go to check transaction button
  const btnCheckStatus = document.getElementById('btn-goto-check-trans');
  if (btnCheckStatus) {
    btnCheckStatus.addEventListener('click', () => {
      closeModal('checkout-modal');
      window.location.hash = '#cek-transaksi';
      if (appState.currentInvoice) {
        const input = document.getElementById('invoice-search-input');
        if (input) {
          input.value = appState.currentInvoice.invoice_number;
          searchInvoice(appState.currentInvoice.invoice_number);
        }
      }
    });
  }

  // Auth modal switch mode (login <-> register)
  const authSwitch = document.getElementById('auth-switch-link');
  const authTitle = document.getElementById('auth-modal-title');
  const authSubmit = document.getElementById('btn-submit-auth');
  const authSwitchText = document.getElementById('auth-switch-text');
  const nameGroup = document.getElementById('auth-name-group');

  if (authSwitch) {
    authSwitch.addEventListener('click', (e) => {
      e.preventDefault();
      if (authTitle.textContent.includes('Masuk')) {
        authTitle.textContent = "Daftar Akun Baru Dar'sstore";
        authSubmit.textContent = 'Daftar Sekarang';
        authSwitchText.textContent = 'Sudah punya akun?';
        authSwitch.textContent = 'Masuk disini';
        nameGroup.style.display = 'block';
      } else {
        authTitle.textContent = "Masuk ke Akun Dar'sstore";
        authSubmit.textContent = 'Masuk Sekarang';
        authSwitchText.textContent = 'Belum punya akun?';
        authSwitch.textContent = 'Daftar disini';
        nameGroup.style.display = 'none';
      }
    });
  }

  // Submit Auth Form (Real API)
  if (authSubmit) {
    authSubmit.addEventListener('click', async () => {
      const isRegister = authTitle.textContent.includes('Daftar');
      const identifier = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-pass').value;
      const nama = document.getElementById('auth-name').value.trim();

      if (!identifier || !password) {
        alert('Silakan isi email/no. WhatsApp dan kata sandi.');
        return;
      }

      authSubmit.disabled = true;
      authSubmit.textContent = 'Memproses...';

      try {
        let endpoint = '/api/auth/login';
        let body = { identifier, password };

        if (isRegister) {
          endpoint = '/api/auth/register';
          const isEmail = identifier.includes('@');
          body = {
            nama: nama || (isEmail ? identifier.split('@')[0] : 'Member'),
            email: isEmail ? identifier : null,
            whatsapp: !isEmail ? identifier : null,
            password
          };
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setToken(data.token);
          alert(isRegister ? 'Registrasi berhasil! Selamat datang di Dar\'sstore.' : 'Login berhasil! Selamat datang kembali.');
          closeModal('auth-modal');
          checkCurrentUser();
        } else {
          alert(data.message || 'Gagal autentikasi.');
        }
      } catch (err) {
        alert('Gagal terhubung ke backend server.');
      } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = isRegister ? 'Daftar Sekarang' : 'Masuk Sekarang';
      }
    });
  }
}

// ==========================================================
// QUANTITY COUNTER CONTROLS (MLBB ONLY)
// ==========================================================
function setupCounters() {
  // ML Quantity
  const mlMinus = document.getElementById('ml-qty-minus');
  const mlPlus = document.getElementById('ml-qty-plus');
  const mlInput = document.getElementById('ml-qty-input');

  if (mlMinus && mlPlus && mlInput) {
    mlMinus.addEventListener('click', () => {
      if (appState.ml.qty > 1) {
        appState.ml.qty--;
        mlInput.value = appState.ml.qty;
        updateSummary('ml');
      }
    });
    mlPlus.addEventListener('click', () => {
      appState.ml.qty++;
      mlInput.value = appState.ml.qty;
      updateSummary('ml');
    });
  }

  // Order buttons
  document.getElementById('ml-btn-order')?.addEventListener('click', () => handleCheckout('ml'));
  document.getElementById('valo-btn-order')?.addEventListener('click', () => handleCheckout('valo'));
}

// ==========================================================
// CAROUSEL BANNER CONTROLLER
// ==========================================================
function setupCarousel() {
  const slides = [
    '/assets/banners/hanzo_starlight.png',
    '/assets/banners/ml_banner.png',
    '/assets/banners/valo_banner.jpg'
  ];
  let currentSlide = 0;
  const imgEl = document.getElementById('carousel-img');
  const dots = document.querySelectorAll('.carousel-dot');

  function showSlide(idx) {
    currentSlide = (idx + slides.length) % slides.length;
    if (imgEl) {
      imgEl.src = slides[currentSlide];
    }
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  document.getElementById('carousel-prev-btn')?.addEventListener('click', () => {
    showSlide(currentSlide - 1);
  });
  document.getElementById('carousel-next-btn')?.addEventListener('click', () => {
    showSlide(currentSlide + 1);
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.index, 10);
      showSlide(idx);
    });
  });

  // Auto rotate every 6 seconds
  setInterval(() => {
    showSlide(currentSlide + 1);
  }, 6000);
}

// ==========================================================
// SEARCH & INVOICE LOOKUP CONTROLS
// ==========================================================
function setupSearchAndInvoice() {
  // Global search input in header
  const globalSearch = document.getElementById('global-search-input');
  if (globalSearch) {
    globalSearch.value = ''; // Always ensure clean state on load
    globalSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('#games-grid-container .game-card');
      const emptyState = document.getElementById('games-search-empty');
      let visibleCount = 0;

      cards.forEach(card => {
        const title = card.querySelector('.game-title')?.textContent.toLowerCase() || '';
        const pub = card.querySelector('.game-pub')?.textContent.toLowerCase() || '';
        const match = !query || title.includes(query) || pub.includes(query);
        card.style.display = match ? 'flex' : 'none';
        if (match) visibleCount++;
      });

      if (emptyState) {
        emptyState.style.display = (visibleCount === 0 && query) ? 'block' : 'none';
      }
    });
  }

  // Cek Transaksi search
  const btnSearchInvoice = document.getElementById('btn-search-invoice');
  const invoiceInput = document.getElementById('invoice-search-input');
  const btnPaste = document.getElementById('btn-paste-invoice');

  if (btnSearchInvoice && invoiceInput) {
    btnSearchInvoice.addEventListener('click', () => {
      searchInvoice(invoiceInput.value);
    });
    invoiceInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchInvoice(invoiceInput.value);
    });
  }

  if (btnPaste && invoiceInput) {
    btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        invoiceInput.value = text;
      } catch {
        invoiceInput.focus();
      }
    });
  }
}

// ==========================================================
// THEME TOGGLE
// ==========================================================
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const html = document.documentElement;
  
  // Load saved theme
  const savedTheme = localStorage.getItem('darsstore_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  if (btn) {
    btn.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('darsstore_theme', next);
    });
  }
}

// ==========================================================
// INITIALIZATION
// ==========================================================
// Global delegated click listener for in-app routing
document.addEventListener('click', (e) => {
  const target = e.target.closest('.game-card, .popular-card, a[href^="#"]');
  if (!target) return;

  // Let middle clicks or modifier keys open naturally in new tab
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;

  const route = target.dataset.route || target.getAttribute('href');
  if (route && route.length > 1 && route !== '#') {
    e.preventDefault();
    navigateToRoute(route);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderHomepage();
  renderMLView();
  renderValoView();
  setupCarousel();
  setupCounters();
  setupModals();
  setupSearchAndInvoice();
  setupThemeToggle();
  checkCurrentUser();

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();

  console.log("Dar'sstore Web Application initialized successfully.");
});
