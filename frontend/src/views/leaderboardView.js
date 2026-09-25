import { getLeaderboard } from '../api/leaderboard.js';
import { formatRupiah } from '../utils/format.js';
import { showCyberToast } from '../utils/cyberPopup.js';

// Local state for the Leaderboard view
const leaderboardState = {
  period: 'all',
  sortBy: 'amount',
  game: 'all',
  limit: 20,
  isLoading: false,
  data: null
};

/**
 * Initialize and render Leaderboard View
 */
export async function renderLeaderboardView() {
  const container = document.getElementById('leaderboard-view');
  if (!container) return;

  // Build the static shell if not already built
  if (!document.getElementById('leaderboard-podium-container')) {
    container.innerHTML = `
      <div class="container leaderboard-page">
        <!-- Hero Header -->
        <div class="leaderboard-header-section">
          <div class="leaderboard-tag">
            <span class="live-dot-pulse"></span>
            <span>DATA REAL-TIME DATABASE TERVERIFIKASI</span>
          </div>
          <h1 class="leaderboard-main-title">
            <span class="trophy-emoji">🏆</span> LEADERBOARD SULTAN & TOP PEMBELI
          </h1>
          <p class="leaderboard-subtitle">
            Daftar peringkat pembeli terbanyak dan sultan game di Dar'sstore. Seluruh data dihitung secara riil dari transaksi sukses di database.
          </p>
        </div>

        <!-- Metric Summary Cards -->
        <div class="leaderboard-stats-grid" id="leaderboard-stats-cards">
          <div class="stat-card">
            <div class="stat-icon-wrap gold">👑</div>
            <div class="stat-info">
              <span class="stat-label">SULTAN TERTINGGI</span>
              <strong class="stat-val" id="stat-top-sultan">-</strong>
              <span class="stat-sub" id="stat-top-sultan-sub">Memuat...</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrap blue">💰</div>
            <div class="stat-info">
              <span class="stat-label">TOTAL BELANJA PERIODE</span>
              <strong class="stat-val" id="stat-total-volume">Rp 0</strong>
              <span class="stat-sub" id="stat-total-buyers">0 Pembeli Unik</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-wrap green">⚡</div>
            <div class="stat-info">
              <span class="stat-label">TRANSAKSI SUKSES</span>
              <strong class="stat-val" id="stat-total-tx">0</strong>
              <span class="stat-sub">Pesanan Terverifikasi</span>
            </div>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="leaderboard-toolbar">
          <div class="toolbar-left">
            <div class="period-tabs-group" id="leaderboard-period-tabs">
              <button class="period-tab active" data-period="all">Sepanjang Waktu</button>
              <button class="period-tab" data-period="month">Bulan Ini</button>
              <button class="period-tab" data-period="week">7 Hari Terakhir</button>
              <button class="period-tab" data-period="today">Hari Ini</button>
            </div>
          </div>

          <div class="toolbar-right">
            <div class="sort-toggle-group" id="leaderboard-sort-group">
              <button class="sort-tab active" data-sort="amount" title="Urutkan dari nominal belanja terbesar">
                💰 Top Sultan
              </button>
              <button class="sort-tab" data-sort="count" title="Urutkan dari jumlah transaksi terbanyak">
                🛒 Top Transaksi
              </button>
            </div>

            <select id="leaderboard-game-filter" class="leaderboard-select">
              <option value="all">Semua Game</option>
              <option value="mlbb">Mobile Legends</option>
              <option value="valorant">Valorant</option>
            </select>

            <button class="btn-refresh-leaderboard" id="btn-refresh-leaderboard" title="Muat Ulang Data">
              <svg id="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Top 3 Podium Area -->
        <div class="leaderboard-podium-wrap">
          <div class="podium-section-title">
            <span>TOP 3 PODIUM SULTAN</span>
          </div>
          <div class="podium-grid" id="leaderboard-podium-container">
            <!-- Dynamic Podium items -->
          </div>
        </div>

        <!-- Rankings Table (Rank 4+) -->
        <div class="leaderboard-table-card">
          <div class="table-card-header">
            <div>
              <h2 class="table-card-title">Peringkat Lengkap Pembeli</h2>
              <p class="table-card-sub" id="table-card-filter-desc">Menampilkan pembeli teratas berdasarkan data database</p>
            </div>
            <div class="table-legend">
              <span class="legend-badge">✓ Data Otomatis Diperbarui</span>
            </div>
          </div>

          <div class="table-responsive">
            <table class="leaderboard-main-table">
              <thead>
                <tr>
                  <th style="width: 70px;">Rank</th>
                  <th>Gamer / Pembeli</th>
                  <th>Game Favorit</th>
                  <th>Total Transaksi</th>
                  <th>Total Belanja</th>
                  <th>Gelar Sultan</th>
                </tr>
              </thead>
              <tbody id="leaderboard-table-body">
                <!-- Rendered dynamically -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Call to Action Banner -->
        <div class="leaderboard-cta-card">
          <div class="cta-inner">
            <div class="cta-badge">⭐ TANTANGAN SULTAN</div>
            <h3 class="cta-title">Ingin Namamu Masuk ke Peringkat Teratas?</h3>
            <p class="cta-desc">
              Top up game favoritmu sekarang, kumpulkan poin reward pelanggan setia, dan jadilah Sultan #1 di Hall of Fame Dar'sstore!
            </p>
            <div class="cta-buttons">
              <a href="/ml" class="btn-cta-gold" data-route="/ml">Top Up Mobile Legends</a>
              <a href="/valo" class="btn-cta-blue" data-route="/valo">Top Up Valorant</a>
            </div>
          </div>
        </div>
      </div>
    `;

    setupControls();
  }

  // Load and render data
  await loadLeaderboardData();
}

/**
 * Fetch data from backend and render components
 */
async function loadLeaderboardData(isManualRefresh = false) {
  const podiumContainer = document.getElementById('leaderboard-podium-container');
  const tbody = document.getElementById('leaderboard-table-body');
  const refreshBtn = document.getElementById('btn-refresh-leaderboard');
  const refreshIcon = document.getElementById('refresh-icon');

  if (refreshBtn && refreshIcon) {
    refreshIcon.classList.add('spinning');
  }

  if (podiumContainer && !leaderboardState.data) {
    podiumContainer.innerHTML = `
      <div class="leaderboard-loading-placeholder" style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
        <div class="spinner-simple" style="margin: 0 auto 14px;"></div>
        <div>Memuat data leaderboard real-time dari database...</div>
      </div>
    `;
  }

  try {
    leaderboardState.isLoading = true;
    const res = await getLeaderboard({
      period: leaderboardState.period,
      sortBy: leaderboardState.sortBy,
      game: leaderboardState.game,
      limit: leaderboardState.limit
    });

    if (res && res.success) {
      leaderboardState.data = res;
      renderStats(res.summary, res.period_label, res.sort_label);
      renderPodium(res.podium || []);
      renderTable(res.leaderboard || []);

      const filterDesc = document.getElementById('table-card-filter-desc');
      if (filterDesc) {
        filterDesc.textContent = `Periode: ${res.period_label} • Urutan: ${res.sort_label} • Game: ${res.game === 'all' ? 'Semua' : res.game.toUpperCase()}`;
      }

      if (isManualRefresh) {
        showCyberToast('Data Leaderboard berhasil disinkronkan dengan database.', 'success', 'SINKRONISASI REALTIME');
      }
    } else {
      showErrorState(res.message || 'Gagal mengambil data dari server.');
    }
  } catch (err) {
    console.error('[LEADERBOARD_VIEW] Load error:', err);
    showErrorState('Gagal terhubung ke backend server.');
  } finally {
    leaderboardState.isLoading = false;
    if (refreshIcon) {
      refreshIcon.classList.remove('spinning');
    }
  }
}

/**
 * Render Header Stats Cards
 */
function renderStats(summary, periodLabel, sortLabel) {
  if (!summary) return;

  const topSultanEl = document.getElementById('stat-top-sultan');
  const topSultanSubEl = document.getElementById('stat-top-sultan-sub');
  const totalVolumeEl = document.getElementById('stat-total-volume');
  const totalBuyersEl = document.getElementById('stat-total-buyers');
  const totalTxEl = document.getElementById('stat-total-tx');

  if (topSultanEl && topSultanSubEl) {
    if (summary.top_sultan) {
      topSultanEl.textContent = summary.top_sultan.display_name;
      topSultanSubEl.textContent = `${formatRupiah(summary.top_sultan.total_spent)} (${summary.top_sultan.order_count} Transaksi)`;
    } else {
      topSultanEl.textContent = 'Belum Ada';
      topSultanSubEl.textContent = 'Jadilah yang pertama!';
    }
  }

  if (totalVolumeEl) totalVolumeEl.textContent = formatRupiah(summary.total_volume || 0);
  if (totalBuyersEl) totalBuyersEl.textContent = `${summary.total_buyers || 0} Pembeli Unik (${periodLabel})`;
  if (totalTxEl) totalTxEl.textContent = `${summary.total_transactions || 0} Transaksi`;
}

/**
 * Render Olympic/Gaming Top 3 Podium
 * Layout on desktop: [ Rank 2 (Silver) | Rank 1 (Gold) | Rank 3 (Bronze) ]
 */
function renderPodium(top3) {
  const container = document.getElementById('leaderboard-podium-container');
  if (!container) return;

  if (!top3 || top3.length === 0) {
    container.innerHTML = `
      <div class="podium-empty-box">
        <div style="font-size: 36px; margin-bottom: 8px;">🎮</div>
        <h4>Belum ada transaksi di periode ini</h4>
        <p>Lakukan top up game sekarang untuk menjadi juara di posisi #1!</p>
      </div>
    `;
    return;
  }

  // Create slot mapping for championship podium: Rank 2 on left, Rank 1 in center, Rank 3 on right
  const rank1 = top3.find(b => b.rank === 1);
  const rank2 = top3.find(b => b.rank === 2);
  const rank3 = top3.find(b => b.rank === 3);

  const podiumSlots = [
    { rank: 2, data: rank2, medal: '🥈', title: 'RUNNER UP', pedestalClass: 'pedestal-silver', heightClass: 'h-silver' },
    { rank: 1, data: rank1, medal: '👑', title: 'CHAMPION', pedestalClass: 'pedestal-gold', heightClass: 'h-gold' },
    { rank: 3, data: rank3, medal: '🥉', title: '3RD PLACE', pedestalClass: 'pedestal-bronze', heightClass: 'h-bronze' }
  ];

  container.innerHTML = podiumSlots.map(slot => {
    const b = slot.data;
    if (!b) {
      return `
        <div class="podium-column ${slot.pedestalClass}">
          <div class="podium-avatar-card empty">
            <div class="avatar-ring empty-ring">
              <span class="slot-empty-medal">${slot.medal}</span>
            </div>
            <div class="podium-player-name empty-text">Posisi Terbuka</div>
            <div class="podium-metric-val empty-text">-</div>
            <div class="podium-rank-tag">#${slot.rank} ${slot.title}</div>
          </div>
          <div class="pedestal-block ${slot.heightClass}">
            <span class="pedestal-number">#${slot.rank}</span>
          </div>
        </div>
      `;
    }

    const gameTag = b.favorite_game === 'valorant'
      ? `<span class="game-tag valo">VALORANT</span>`
      : `<span class="game-tag mlbb">MLBB</span>`;

    const mainMetric = leaderboardState.sortBy === 'count'
      ? `${b.order_count} Transaksi`
      : formatRupiah(b.total_spent);

    const subMetric = leaderboardState.sortBy === 'count'
      ? `Total ${formatRupiah(b.total_spent)}`
      : `${b.order_count} Transaksi`;

    const isChampion = slot.rank === 1;

    return `
      <div class="podium-column ${slot.pedestalClass} ${isChampion ? 'is-champion' : ''}">
        <div class="podium-avatar-card">
          ${isChampion ? `<div class="podium-crown-badge">👑 SULTAN #1</div>` : ''}
          <div class="avatar-ring ${slot.pedestalClass}">
            <div class="avatar-inner">
              ${b.display_name.charAt(0).toUpperCase()}
            </div>
            <span class="avatar-medal-chip">${slot.medal}</span>
          </div>

          <div class="podium-player-name" title="${b.display_name}">${b.display_name}</div>
          <div class="podium-metric-val">${mainMetric}</div>
          <div class="podium-metric-sub">${subMetric}</div>

          <div class="podium-tags-row">
            ${gameTag}
            <span class="points-tag">⭐ ${b.points || 0} Poin</span>
          </div>

          <div class="podium-rank-tag">${b.badge}</div>
        </div>

        <div class="pedestal-block ${slot.heightClass}">
          <span class="pedestal-number">#${slot.rank}</span>
          <span class="pedestal-rank-title">${slot.title}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Rankings Table
 */
function renderTable(leaderboard) {
  const tbody = document.getElementById('leaderboard-table-body');
  if (!tbody) return;

  if (!leaderboard || leaderboard.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="table-empty-state" style="padding: 40px 16px;">
            <div class="table-empty-icon">🏆</div>
            <div class="table-empty-title">Belum ada riwayat transaksi pada filter ini.</div>
            <div class="table-empty-sub">Jadilah pelanggan pertama yang tercatat di papan peringkat!</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leaderboard.map(b => {
    let rankBadgeClass = 'rank-default';
    let trophyIcon = '';
    if (b.rank === 1) { rankBadgeClass = 'rank-gold'; trophyIcon = '🥇 '; }
    else if (b.rank === 2) { rankBadgeClass = 'rank-silver'; trophyIcon = '🥈 '; }
    else if (b.rank === 3) { rankBadgeClass = 'rank-bronze'; trophyIcon = '🥉 '; }

    const gameBadge = b.favorite_game === 'valorant'
      ? `<span class="table-game-badge valo"><span class="badge-dot valo"></span> Valorant</span>`
      : `<span class="table-game-badge mlbb"><span class="badge-dot mlbb"></span> Mobile Legends</span>`;

    const formattedDate = b.last_order_at
      ? new Date(b.last_order_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
      : '-';

    return `
      <tr class="leaderboard-table-row ${b.rank <= 3 ? 'top-three-row' : ''}">
        <td>
          <div class="rank-badge-wrap ${rankBadgeClass}">
            ${trophyIcon}#${b.rank}
          </div>
        </td>
        <td>
          <div class="buyer-profile-cell">
            <div class="buyer-avatar ${rankBadgeClass}">
              ${b.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="buyer-name-row">
                <span class="buyer-display-name">${b.display_name}</span>
                <span class="verified-order-badge" title="Transaksi Terverifikasi Database">✓ Riil</span>
              </div>
              <div class="buyer-meta-info">
                <span>Kontak: ${b.contact_masked}</span>
                <span>•</span>
                <span>Terakhir: ${formattedDate}</span>
              </div>
            </div>
          </div>
        </td>
        <td>
          ${gameBadge}
        </td>
        <td>
          <div class="tx-count-cell">
            <strong>${b.order_count}x</strong>
            <span class="tx-sub-label">Transaksi Sukses</span>
          </div>
        </td>
        <td>
          <div class="total-spent-cell">
            ${formatRupiah(b.total_spent)}
          </div>
        </td>
        <td>
          <span class="tier-pill ${b.tier}">
            ${b.badge}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Setup event listeners for toolbar tabs, toggles, filters
 */
function setupControls() {
  // Period Tabs
  const periodTabs = document.querySelectorAll('#leaderboard-period-tabs .period-tab');
  periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      periodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      leaderboardState.period = tab.dataset.period || 'all';
      loadLeaderboardData();
    });
  });

  // Sort Toggle
  const sortTabs = document.querySelectorAll('#leaderboard-sort-group .sort-tab');
  sortTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sortTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      leaderboardState.sortBy = tab.dataset.sort || 'amount';
      loadLeaderboardData();
    });
  });

  // Game Filter Select
  const gameSelect = document.getElementById('leaderboard-game-filter');
  if (gameSelect) {
    gameSelect.addEventListener('change', (e) => {
      leaderboardState.game = e.target.value;
      loadLeaderboardData();
    });
  }

  // Refresh Button
  const refreshBtn = document.getElementById('btn-refresh-leaderboard');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadLeaderboardData(true);
    });
  }
}

function showErrorState(msg) {
  const tbody = document.getElementById('leaderboard-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="table-empty-state" style="padding: 40px 16px;">
            <div class="table-empty-icon" style="color: #ef4444;">⚠️</div>
            <div class="table-empty-title" style="color: #ef4444;">Gagal Memuat Data</div>
            <div class="table-empty-sub">${msg}</div>
          </div>
        </td>
      </tr>
    `;
  }
}

/**
 * Helper to render Homepage Leaderboard Teaser
 */
export async function renderHomepageLeaderboardTeaser() {
  const container = document.getElementById('home-leaderboard-teaser');
  if (!container) return;

  try {
    const res = await getLeaderboard({ period: 'all', sortBy: 'amount', limit: 3 });
    if (!res || !res.success || !res.podium || res.podium.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const top3 = res.podium;

    container.innerHTML = `
      <div class="home-leaderboard-card">
        <div class="hl-header">
          <div class="hl-title-wrap">
            <span class="section-badge-sq"></span>
            <div>
              <h3 class="hl-title">🏆 TOP SULTAN TERBANYAK DAR'SSTORE</h3>
              <p class="hl-subtitle">Peringkat pembeli dengan total belanja terbanyak berdasarkan data transaksi riil.</p>
            </div>
          </div>
          <a href="/leaderboard" class="btn-view-all-leaderboard" data-route="/leaderboard">
            <span>Buka Leaderboard Lengkap</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>

        <div class="hl-podium-preview">
          ${top3.map(b => {
            const medal = b.rank === 1 ? '👑' : (b.rank === 2 ? '🥈' : '🥉');
            const medalClass = b.rank === 1 ? 'gold' : (b.rank === 2 ? 'silver' : 'bronze');
            return `
              <div class="hl-winner-card ${medalClass}">
                <div class="hl-medal-corner">${medal} #${b.rank}</div>
                <div class="hl-avatar-wrap">
                  <div class="hl-avatar ${medalClass}">
                    ${b.display_name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div class="hl-player-info">
                  <div class="hl-name">${b.display_name}</div>
                  <div class="hl-amount">${formatRupiah(b.total_spent)}</div>
                  <div class="hl-meta">${b.order_count} Transaksi Sukses • ${b.favorite_game === 'valorant' ? 'Valorant' : 'MLBB'}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (e) {
    console.warn('[HOME_LEADERBOARD] Teaser load note:', e.message);
  }
}
