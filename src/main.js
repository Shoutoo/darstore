import {
  GAMES,
  CATEGORIES,
  NEWS_ARTICLES,
  ML_NOMINALS,
  VALO_REGIONS,
  VALO_NOMINALS,
  PAYMENT_GROUPS,
  LEADERBOARD_DATA,
  FAQS,
  PROMOS
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

// LocalStorage key for transactions
const STORAGE_TX_KEY = 'ourastore_transactions';

function getStoredTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_TX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredTransaction(tx) {
  const list = getStoredTransactions();
  list.unshift(tx);
  localStorage.setItem(STORAGE_TX_KEY, JSON.stringify(list));
}

// Application State
const appState = {
  activeView: 'home-view',
  activeCategory: 'Top Up Games',
  activeValoRegion: 'id',
  
  ml: {
    selectedNominal: null,
    qty: 1,
    selectedPayment: null,
    appliedPromo: null,
    userId: '',
    server: '',
    email: '',
    wa: ''
  },
  
  valo: {
    selectedNominal: null,
    qty: 1,
    selectedPayment: null,
    appliedPromo: null,
    riotId: '',
    email: '',
    wa: ''
  },
  
  currentInvoice: null
};

// ==========================================================
// ROUTER / VIEW SWITCHING
// ==========================================================
function switchView(targetViewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach(v => {
    v.style.display = (v.id === targetViewId) ? 'block' : 'none';
  });
  
  appState.activeView = targetViewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update header nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.target === targetViewId) {
      link.classList.add('active');
    }
  });

  if (targetViewId === 'cek-transaksi-view') {
    renderRealtimeTable();
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
  } else if (hash === '#leaderboard') {
    switchView('leaderboard-view');
  } else if (hash === '#kalkulator') {
    openModal('calc-modal');
  }
}

// ==========================================================
// RENDER HOMEPAGE
// ==========================================================
function renderHomepage() {
  // 1. Popular cards
  const popularContainer = document.getElementById('popular-grid-container');
  if (popularContainer) {
    const popularGames = GAMES.filter(g => g.popular);
    popularContainer.innerHTML = popularGames.map(game => `
      <div class="popular-card" data-route="${game.route || '#home'}" data-game-id="${game.id}">
        <img src="${game.image}" alt="${game.name}" class="popular-avatar" />
        <div class="popular-info">
          <div class="popular-name">${game.shortName}</div>
          <div class="popular-pub">${game.publisher}</div>
        </div>
      </div>
    `).join('');

    popularContainer.querySelectorAll('.popular-card').forEach(card => {
      card.addEventListener('click', () => {
        const route = card.dataset.route;
        if (route && route !== '#home') {
          window.location.hash = route;
        } else {
          alert(`Top up ${card.querySelector('.popular-name').textContent} akan segera tersedia!`);
        }
      });
    });
  }

  // 2. Category tabs
  const categoryContainer = document.getElementById('category-tabs-container');
  if (categoryContainer) {
    categoryContainer.innerHTML = CATEGORIES.map(cat => `
      <button class="category-tab ${cat === appState.activeCategory ? 'active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join('');

    categoryContainer.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        categoryContainer.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.activeCategory = btn.dataset.cat;
        renderGamesGrid();
      });
    });
  }

  // 3. Games Grid
  renderGamesGrid();

  // 4. News Grid
  const newsContainer = document.getElementById('news-grid-container');
  if (newsContainer) {
    newsContainer.innerHTML = NEWS_ARTICLES.map(article => `
      <article class="news-card" data-id="${article.id}">
        <div class="news-thumbnail-wrap">
          <img src="${article.image}" alt="${article.title}" class="news-thumbnail" />
        </div>
        <div class="news-card-content">
          <h3 class="news-title">${article.title}</h3>
          <div class="news-meta">
            <span class="news-author">${article.author}</span>
            <span class="news-subtitle">${article.subtitle}</span>
          </div>
        </div>
      </article>
    `).join('');
  }
}

function renderGamesGrid() {
  const gamesGrid = document.getElementById('games-grid-container');
  if (!gamesGrid) return;

  const filteredGames = appState.activeCategory === 'Top Up Games'
    ? GAMES
    : GAMES.filter(g => g.category === appState.activeCategory);

  gamesGrid.innerHTML = filteredGames.map(game => `
    <div class="game-card" data-route="${game.route || '#home'}" data-game-id="${game.id}">
      <div class="game-poster-wrap">
        <img src="${game.image}" alt="${game.name}" class="game-poster" loading="lazy" />
        ${game.badge ? `<span class="game-badge-top">${game.badge}</span>` : ''}
      </div>
      <div class="game-card-content">
        <div class="game-title">${game.name}</div>
        <div class="game-pub">${game.publisher}</div>
      </div>
    </div>
  `).join('');

  gamesGrid.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      const route = card.dataset.route;
      if (route && route !== '#home') {
        window.location.hash = route;
      } else {
        const title = card.querySelector('.game-title').textContent;
        alert(`Layanan top up untuk ${title} sedang dipersiapkan. Coba Mobile Legends atau Valorant!`);
      }
    });
  });
}

// ==========================================================
// RENDER MOBILE LEGENDS VIEW
// ==========================================================
function renderMLView() {
  const container = document.getElementById('ml-nominals-container');
  if (!container) return;

  let html = '';

  // 1. Special Item
  html += `<div class="nominal-category-title">🎁 Special Item</div>`;
  html += `<div class="nominals-grid">` + ML_NOMINALS.special.map(item => createNominalCardHTML(item, 'ml')).join('') + `</div>`;

  // 2. First Top Up
  html += `<div class="nominal-category-title">🎁 First Top Up (Double Diamonds)</div>`;
  html += `<div class="nominals-grid">` + ML_NOMINALS.first_topup.map(item => createNominalCardHTML(item, 'ml')).join('') + `</div>`;

  // 3. Weekly / Monthly Pack
  html += `<div class="nominal-category-title">🎁 Weekly/Monthly Pack</div>`;
  html += `<div class="nominals-grid">` + ML_NOMINALS.weekly_monthly.map(item => createNominalCardHTML(item, 'ml')).join('') + `</div>`;

  // 4. Promo
  html += `<div class="nominal-category-title">🎁 Promo (Limited Stock Only)</div>`;
  html += `<div class="nominals-grid">` + ML_NOMINALS.promo.map(item => createNominalCardHTML(item, 'ml')).join('') + `</div>`;

  // 5. Top Up Diamonds (shown first 24 items with view all toggle)
  html += `<div class="nominal-category-title">💎 Top Up Diamonds</div>`;
  html += `<div class="nominals-grid" id="ml-diamonds-grid">` + ML_NOMINALS.topup_diamonds.map(item => createNominalCardHTML(item, 'ml')).join('') + `</div>`;

  container.innerHTML = html;

  // Bind click on nominal cards
  container.querySelectorAll('.nominal-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.nominal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const itemId = card.dataset.id;
      
      // Find item in all ML categories
      const allML = [
        ...ML_NOMINALS.special,
        ...ML_NOMINALS.first_topup,
        ...ML_NOMINALS.weekly_monthly,
        ...ML_NOMINALS.promo,
        ...ML_NOMINALS.topup_diamonds
      ];
      appState.ml.selectedNominal = allML.find(i => i.id === itemId);
      updateSummary('ml');
    });
  });

  // Render Payments Accordion for ML
  renderPaymentAccordion('ml-payments-container', 'ml');

  // Render FAQs
  renderFAQs('ml-faq-list');
}

// ==========================================================
// RENDER VALORANT VIEW
// ==========================================================
function renderValoView() {
  // Region tabs
  const regionTabs = document.getElementById('valo-region-tabs');
  if (regionTabs) {
    regionTabs.innerHTML = VALO_REGIONS.map(reg => `
      <button class="region-tab ${reg.id === appState.activeValoRegion ? 'active' : ''}" data-reg="${reg.id}">
        ${reg.name}
      </button>
    `).join('');

    regionTabs.querySelectorAll('.region-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        regionTabs.querySelectorAll('.region-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.activeValoRegion = btn.dataset.reg;
        renderValoNominals();
      });
    });
  }

  renderValoNominals();
  renderPaymentAccordion('valo-payments-container', 'valo');
  renderFAQs('valo-faq-list');
}

function renderValoNominals() {
  const container = document.getElementById('valo-nominals-container');
  if (!container) return;

  const items = VALO_NOMINALS[appState.activeValoRegion] || VALO_NOMINALS['id'];
  container.innerHTML = `<div class="nominals-grid">` + items.map(item => createNominalCardHTML(item, 'valo')).join('') + `</div>`;

  container.querySelectorAll('.nominal-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.nominal-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const itemId = card.dataset.id;
      appState.valo.selectedNominal = items.find(i => i.id === itemId);
      updateSummary('valo');
    });
  });
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
// RENDER PAYMENT ACCORDION
// ==========================================================
function renderPaymentAccordion(containerId, gameKey) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = PAYMENT_GROUPS.map((group, idx) => `
    <div class="payment-group ${idx === 1 ? 'expanded' : ''}" data-group-id="${group.id}">
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
                ${method.feeText || (method.fee === 0 ? 'Gratis Biaya' : `+ ${formatRupiah(method.fee)}`)}
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
// RENDER FAQS & LEADERBOARD
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

function renderLeaderboard() {
  const dailyList = document.getElementById('leaderboard-daily-list');
  const weeklyList = document.getElementById('leaderboard-weekly-list');
  const monthlyList = document.getElementById('leaderboard-monthly-list');

  if (dailyList) {
    dailyList.innerHTML = LEADERBOARD_DATA.daily.map(row => createLeaderboardRowHTML(row)).join('');
  }
  if (weeklyList) {
    weeklyList.innerHTML = LEADERBOARD_DATA.weekly.map(row => createLeaderboardRowHTML(row)).join('');
  }
  if (monthlyList) {
    monthlyList.innerHTML = LEADERBOARD_DATA.monthly.map(row => createLeaderboardRowHTML(row)).join('');
  }
}

function createLeaderboardRowHTML(row) {
  return `
    <div class="leaderboard-row">
      <div class="leaderboard-user-info">
        <span class="leaderboard-rank">${row.rank}.</span>
        <span class="leaderboard-name">${row.name}</span>
        <span>${row.flag}</span>
      </div>
      <div class="leaderboard-amount">${row.amount}</div>
    </div>
  `;
}

// ==========================================================
// REALTIME TRANSACTIONS TABLE & INVOICE CHECK
// ==========================================================
function renderRealtimeTable() {
  const tbody = document.getElementById('realtime-transactions-tbody');
  if (!tbody) return;

  const transactions = getStoredTransactions();
  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="table-empty-state">
            <div class="table-empty-icon">📊</div>
            <div class="table-empty-title">Data tidak ditemukan!</div>
            <div class="table-empty-sub">Tidak ada aktifitasi data.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(tx => {
    const maskedPhone = tx.wa ? tx.wa.slice(0, 4) + '****' + tx.wa.slice(-3) : '0812****890';
    return `
      <tr>
        <td>${tx.date}</td>
        <td><strong style="color: var(--accent-gold);">${tx.invoiceNumber}</strong></td>
        <td>${maskedPhone}</td>
        <td>${formatRupiah(tx.total)}</td>
        <td>
          <span class="invoice-status-badge ${tx.status === 'Berhasil' ? 'success' : 'pending'}">
            ${tx.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function searchInvoice(query) {
  const resultContainer = document.getElementById('invoice-result-container');
  if (!resultContainer) return;

  const cleaned = query.trim().toUpperCase();
  if (!cleaned) {
    alert('Silakan masukkan nomor Invoice Anda.');
    return;
  }

  const allTx = getStoredTransactions();
  // If not found in stored, provide an authentic demo result matching the sample format
  let match = allTx.find(t => t.invoiceNumber.toUpperCase() === cleaned);

  if (!match) {
    if (cleaned.startsWith('OS')) {
      match = {
        invoiceNumber: cleaned,
        date: new Date().toLocaleString('id-ID'),
        gameName: 'Mobile Legends',
        item: 'Weekly Diamond Pass',
        targetAccount: '12345678 (2024)',
        paymentMethod: 'QRIS (All Payment)',
        total: 28882,
        status: 'Berhasil'
      };
    } else {
      resultContainer.innerHTML = `
        <div class="invoice-result-card" style="border-color: #ef4444; text-align: center; padding: 32px;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <h3 style="color: #ef4444; margin-bottom: 8px;">Nomor Invoice Tidak Ditemukan!</h3>
          <p style="color: var(--text-secondary); font-size: 13.5px;">
            Pastikan nomor invoice yang Anda masukkan sudah benar (Contoh: OSXXXXXXXXXXXXXXXX).
          </p>
        </div>
      `;
      return;
    }
  }

  resultContainer.innerHTML = `
    <div class="invoice-result-card">
      <div class="invoice-result-header">
        <div>
          <div style="font-size: 12px; color: var(--text-muted);">Nomor Invoice</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--accent-gold);">${match.invoiceNumber}</div>
        </div>
        <span class="invoice-status-badge ${match.status === 'Berhasil' ? 'success' : 'pending'}">
          ${match.status}
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13.5px;">
        <div class="summary-row">
          <span>Game</span>
          <strong>${match.gameName}</strong>
        </div>
        <div class="summary-row">
          <span>Item Produk</span>
          <strong>${match.item}</strong>
        </div>
        <div class="summary-row">
          <span>ID Akun Target</span>
          <strong>${match.targetAccount}</strong>
        </div>
        <div class="summary-row">
          <span>Metode Pembayaran</span>
          <strong>${match.paymentMethod}</strong>
        </div>
        <div class="summary-row">
          <span>Waktu Transaksi</span>
          <span>${match.date}</span>
        </div>
        <div class="summary-row total">
          <span>Total Pembayaran</span>
          <span>${formatRupiah(match.total)}</span>
        </div>
      </div>

      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; gap: 12px;">
        <button class="btn-order-now" style="flex: 1;" onclick="alert('Pesanan telah terkirim otomatis ke akun game Anda!')">
          ✓ Pesanan Selesai
        </button>
        <a href="https://wa.me/628123456789" target="_blank" rel="noreferrer" class="btn-load-more" style="display: inline-flex; align-items: center; gap: 6px;">
          Bantuan CS
        </a>
      </div>
    </div>
  `;
}

// ==========================================================
// ORDER SUMMARY & CHECKOUT LOGIC
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

  const basePrice = state.selectedNominal.price * state.qty;
  const fee = state.selectedPayment ? state.selectedPayment.fee : 0;
  const discount = state.appliedPromo ? state.appliedPromo.discount : 0;
  const total = Math.max(0, basePrice + fee - discount);

  summaryBox.innerHTML = `
    <div class="summary-details-list">
      <div class="summary-row">
        <span>Item</span>
        <strong style="color: var(--text-primary);">${state.selectedNominal.name}</strong>
      </div>
      <div class="summary-row">
        <span>Jumlah</span>
        <strong>x${state.qty}</strong>
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
      ${state.appliedPromo ? `
        <div class="summary-row" style="color: #34d399;">
          <span>Voucher (${state.appliedPromo.code})</span>
          <span>- ${formatRupiah(discount)}</span>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>Total Bayar</span>
        <span>${formatRupiah(total)}</span>
      </div>
    </div>
  `;

  orderBtn.disabled = false;
}

function handleCheckout(gameKey) {
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
      alert('Silakan masukkan Riot ID yang valid dengan Tagline! (Contoh: Player#1234)');
      document.getElementById('valo-riotid').focus();
      return;
    }
    state.riotId = riotId;
  }

  if (!state.selectedPayment) {
    alert('Silakan pilih metode pembayaran pada Step 4!');
    return;
  }

  const wa = document.getElementById(`${gameKey}-wa`).value.trim();
  if (!wa) {
    alert('Silakan masukkan No. WhatsApp Anda untuk menerima notifikasi pesanan!');
    document.getElementById(`${gameKey}-wa`).focus();
    return;
  }
  state.wa = '0' + wa.replace(/^0+/, '');

  // Generate unique invoice number: OS + YearMonthDay + Random 6 hex chars
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const invoiceCode = `OS${dateStr}${rand}`;

  const basePrice = state.selectedNominal.price * state.qty;
  const fee = state.selectedPayment.fee;
  const discount = state.appliedPromo ? state.appliedPromo.discount : 0;
  const total = Math.max(0, basePrice + fee - discount);

  const txData = {
    invoiceNumber: invoiceCode,
    date: now.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
    gameName: gameKey === 'ml' ? 'Mobile Legends' : 'Valorant',
    item: `${state.selectedNominal.name} (x${state.qty})`,
    targetAccount: gameKey === 'ml' ? `${state.userId} (${state.server})` : state.riotId,
    paymentMethod: state.selectedPayment.name,
    total: total,
    wa: state.wa,
    status: 'Menunggu Pembayaran'
  };

  saveStoredTransaction(txData);
  appState.currentInvoice = txData;

  // Show checkout modal
  const modalBody = document.getElementById('checkout-modal-body');
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 13px; color: var(--text-muted);">NOMOR INVOICE</div>
        <div style="font-size: 22px; font-weight: 800; color: var(--accent-gold); letter-spacing: 1px;">
          ${txData.invoiceNumber}
        </div>
      </div>

      <div style="background: #373b3f; border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
        <div class="summary-row" style="margin-bottom: 8px;">
          <span>Game:</span>
          <strong>${txData.gameName}</strong>
        </div>
        <div class="summary-row" style="margin-bottom: 8px;">
          <span>Item:</span>
          <strong>${txData.item}</strong>
        </div>
        <div class="summary-row" style="margin-bottom: 8px;">
          <span>Akun Game:</span>
          <strong>${txData.targetAccount}</strong>
        </div>
        <div class="summary-row" style="margin-bottom: 8px;">
          <span>Pembayaran:</span>
          <strong>${txData.paymentMethod}</strong>
        </div>
        <div class="summary-row total" style="padding-top: 10px;">
          <span>Total Tagihan:</span>
          <strong style="color: var(--accent-gold-light); font-size: 18px;">${formatRupiah(txData.total)}</strong>
        </div>
      </div>

      <!-- Payment QR / VA instruction -->
      <div class="qr-code-wrap">
        <div style="font-size: 12px; color: #1a1a1a; font-weight: 700; margin-bottom: 8px;">
          SCAN KODE QR UNTUK MEMBAYAR
        </div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(txData.invoiceNumber)}" alt="QR Pembayaran" class="qr-code-img" />
        <div style="font-size: 11px; color: #555; margin-top: 8px;">
          Berlaku untuk semua aplikasi e-wallet & mobile banking
        </div>
      </div>

      <p style="font-size: 12px; color: var(--text-muted); text-align: center;">
        Silakan lakukan pembayaran dalam waktu <strong>15:00 menit</strong>. Pesanan Anda akan diproses secara instan (1-3 detik) setelah pembayaran berhasil.
      </p>
    `;
  }

  openModal('checkout-modal');
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
        navigator.clipboard.writeText(appState.currentInvoice.invoiceNumber);
        btnCopyInvoice.textContent = '✓ Tersalin!';
        setTimeout(() => {
          btnCopyInvoice.textContent = 'Salin Invoice';
        }, 2000);
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
          input.value = appState.currentInvoice.invoiceNumber;
          searchInvoice(appState.currentInvoice.invoiceNumber);
        }
      }
    });
  }

  // Kalkulator MLBB logic
  const btnCalc = document.getElementById('btn-calculate-wr');
  if (btnCalc) {
    btnCalc.addEventListener('click', () => {
      const totalMatch = parseInt(document.getElementById('calc-total-match').value);
      const currentWR = parseFloat(document.getElementById('calc-current-wr').value);
      const targetWR = parseFloat(document.getElementById('calc-target-wr').value);
      const resultBox = document.getElementById('calc-result');

      if (isNaN(totalMatch) || isNaN(currentWR) || isNaN(targetWR)) {
        alert('Mohon isi semua data dengan angka yang valid!');
        return;
      }

      if (targetWR <= currentWR) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div style="color: #34d399; font-weight: 700; font-size: 14px;">
            🎉 Target win rate Anda (${targetWR}%) sudah tercapai atau lebih rendah dari win rate saat ini (${currentWR}%)!
          </div>
        `;
        return;
      }

      if (targetWR >= 100) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div style="color: #ef4444; font-weight: 700; font-size: 14px;">
            Target win rate 100% mustahil dicapai jika pernah mengalami kekalahan!
          </div>
        `;
        return;
      }

      // Formula: matches_needed = (totalMatch * (targetWR - currentWR)) / (100 - targetWR)
      const matchesNeeded = Math.ceil((totalMatch * (targetWR - currentWR)) / (100 - targetWR));

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <div style="font-size: 14px; line-height: 1.6;">
          Anda memerlukan sekitar <strong style="color: var(--accent-gold); font-size: 18px;">${matchesNeeded}</strong> kemenangan beruntun (win streak) tanpa kalah untuk mencapai <strong>${targetWR}%</strong> win rate! 🔥
        </div>
      `;
    });
  }

  // Auth modal buttons
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');
  const authTitle = document.getElementById('auth-modal-title');
  const authSubmit = document.getElementById('btn-submit-auth');
  const authSwitch = document.getElementById('auth-switch-link');

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      if (authTitle) authTitle.textContent = 'Masuk ke Akun OURASTORE';
      if (authSubmit) authSubmit.textContent = 'Masuk Sekarang';
      openModal('auth-modal');
    });
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      if (authTitle) authTitle.textContent = 'Daftar Akun Baru OURASTORE';
      if (authSubmit) authSubmit.textContent = 'Daftar Sekarang';
      openModal('auth-modal');
    });
  }

  if (authSwitch) {
    authSwitch.addEventListener('click', (e) => {
      e.preventDefault();
      if (authTitle.textContent.includes('Masuk')) {
        authTitle.textContent = 'Daftar Akun Baru OURASTORE';
        authSubmit.textContent = 'Daftar Sekarang';
        authSwitch.textContent = 'Masuk disini';
      } else {
        authTitle.textContent = 'Masuk ke Akun OURASTORE';
        authSubmit.textContent = 'Masuk Sekarang';
        authSwitch.textContent = 'Daftar disini';
      }
    });
  }

  if (authSubmit) {
    authSubmit.addEventListener('click', () => {
      const email = document.getElementById('auth-email').value;
      if (!email) {
        alert('Silakan masukkan email atau no WhatsApp!');
        return;
      }
      alert('Selamat datang di OURASTORE! Anda telah berhasil masuk.');
      closeModal('auth-modal');
    });
  }

  // Available promos modal
  const promosList = document.getElementById('promos-modal-list');
  if (promosList) {
    promosList.innerHTML = PROMOS.map(p => `
      <div style="padding: 14px; background: #373b3f; border: 1px solid var(--border-card); border-radius: var(--radius-md); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 800; color: var(--accent-gold);">${p.code}</div>
          <div style="font-size: 12.5px; color: var(--text-secondary);">${p.desc}</div>
        </div>
        <button class="btn-order-now select-promo-btn" data-code="${p.code}" style="padding: 8px 16px; font-size: 12px; width: auto;">
          Pakai
        </button>
      </div>
    `).join('');

    promosList.querySelectorAll('.select-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        const activeGame = appState.activeView === 'ml-topup-view' ? 'ml' : 'valo';
        const input = document.getElementById(`${activeGame}-promo-input`);
        if (input) input.value = code;
        applyPromo(code, activeGame);
        closeModal('promos-modal');
      });
    });
  }

  document.getElementById('ml-btn-available-promos')?.addEventListener('click', () => openModal('promos-modal'));
  document.getElementById('valo-btn-available-promos')?.addEventListener('click', () => openModal('promos-modal'));

  // CS Chat modal
  const floatingCs = document.getElementById('floating-cs-btn');
  const summaryHelpML = document.getElementById('summary-help-btn-ml');
  const summaryHelpValo = document.getElementById('summary-help-btn-valo');

  [floatingCs, summaryHelpML, summaryHelpValo].forEach(el => {
    if (el) el.addEventListener('click', () => openModal('cs-chat-modal'));
  });

  const btnSendCS = document.getElementById('btn-send-cs-msg');
  const csInput = document.getElementById('cs-chat-input');
  const csMsgBox = document.getElementById('cs-chat-messages');

  if (btnSendCS && csInput && csMsgBox) {
    const sendMsg = () => {
      const text = csInput.value.trim();
      if (!text) return;
      csInput.value = '';

      // Append user msg
      const userBubble = document.createElement('div');
      userBubble.style.cssText = 'background: var(--accent-gold); color: #17181a; font-weight: 600; padding: 10px 14px; border-radius: 12px 12px 2px 12px; max-width: 85%; align-self: flex-end; font-size: 13px; line-height: 1.5;';
      userBubble.textContent = text;
      csMsgBox.appendChild(userBubble);
      csMsgBox.scrollTop = csMsgBox.scrollHeight;

      // Automated reply after 600ms
      setTimeout(() => {
        const reply = document.createElement('div');
        reply.style.cssText = 'background: #373b3f; padding: 12px 14px; border-radius: 12px 12px 12px 2px; max-width: 85%; font-size: 13px; color: var(--text-primary); line-height: 1.5;';
        reply.innerHTML = `Terima kasih telah menghubungi kami! Pesan Anda telah diterima oleh tim CS OURASTORE. Anda juga bisa langsung chat kami via WhatsApp di <a href="https://wa.me/628123456789" target="_blank" style="color:var(--accent-gold); font-weight:700;">WhatsApp CS 24 Jam</a> untuk respon kilat. ⚡`;
        csMsgBox.appendChild(reply);
        csMsgBox.scrollTop = csMsgBox.scrollHeight;
      }, 600);
    };

    btnSendCS.addEventListener('click', sendMsg);
    csInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMsg();
    });
  }
}

// Promo application helper
function applyPromo(code, gameKey) {
  const found = PROMOS.find(p => p.code.toUpperCase() === code.trim().toUpperCase());
  if (found) {
    appState[gameKey].appliedPromo = found;
    alert(`Voucher ${found.code} berhasil dipasang! Anda hemat ${formatRupiah(found.discount)}.`);
  } else {
    appState[gameKey].appliedPromo = null;
    alert('Kode promo tidak valid atau telah kedaluwarsa.');
  }
  updateSummary(gameKey);
}

// ==========================================================
// QUANTITY COUNTER CONTROLS
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

  // Valorant Quantity
  const valoMinus = document.getElementById('valo-qty-minus');
  const valoPlus = document.getElementById('valo-qty-plus');
  const valoInput = document.getElementById('valo-qty-input');

  if (valoMinus && valoPlus && valoInput) {
    valoMinus.addEventListener('click', () => {
      if (appState.valo.qty > 1) {
        appState.valo.qty--;
        valoInput.value = appState.valo.qty;
        updateSummary('valo');
      }
    });
    valoPlus.addEventListener('click', () => {
      appState.valo.qty++;
      valoInput.value = appState.valo.qty;
      updateSummary('valo');
    });
  }

  // Order buttons
  document.getElementById('ml-btn-order')?.addEventListener('click', () => handleCheckout('ml'));
  document.getElementById('valo-btn-order')?.addEventListener('click', () => handleCheckout('valo'));

  // Promo apply buttons
  document.getElementById('ml-btn-apply-promo')?.addEventListener('click', () => {
    const code = document.getElementById('ml-promo-input').value;
    applyPromo(code, 'ml');
  });
  document.getElementById('valo-btn-apply-promo')?.addEventListener('click', () => {
    const code = document.getElementById('valo-promo-input').value;
    applyPromo(code, 'valo');
  });
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
      const idx = parseInt(dot.dataset.index);
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
    globalSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (appState.activeView !== 'home-view') {
        window.location.hash = '#home';
      }
      const gamesGrid = document.getElementById('games-grid-container');
      if (gamesGrid) {
        const matched = GAMES.filter(g => g.name.toLowerCase().includes(query) || g.publisher.toLowerCase().includes(query));
        gamesGrid.innerHTML = matched.map(game => `
          <div class="game-card" data-route="${game.route || '#home'}" data-game-id="${game.id}">
            <div class="game-poster-wrap">
              <img src="${game.image}" alt="${game.name}" class="game-poster" />
              ${game.badge ? `<span class="game-badge-top">${game.badge}</span>` : ''}
            </div>
            <div class="game-card-content">
              <div class="game-title">${game.name}</div>
              <div class="game-pub">${game.publisher}</div>
            </div>
          </div>
        `).join('');

        gamesGrid.querySelectorAll('.game-card').forEach(card => {
          card.addEventListener('click', () => {
            const route = card.dataset.route;
            if (route && route !== '#home') window.location.hash = route;
          });
        });
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
  const savedTheme = localStorage.getItem('ourastore_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  if (btn) {
    btn.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('ourastore_theme', next);
    });
  }
}

// ==========================================================
// INITIALIZATION
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
  renderHomepage();
  renderMLView();
  renderValoView();
  renderLeaderboard();
  setupCarousel();
  setupCounters();
  setupModals();
  setupSearchAndInvoice();
  setupThemeToggle();

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();

  // Kalkulator nav link click
  document.getElementById('nav-kalkulator')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('calc-modal');
  });

  // Artikel nav link click
  document.getElementById('nav-artikel')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#home';
    setTimeout(() => {
      document.getElementById('section-news')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  });

  console.log('OURASTORE Web App initialized successfully.');
});
