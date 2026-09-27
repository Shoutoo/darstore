import { appState } from '../utils/state.js';
import { formatRupiah } from '../utils/format.js';
import { openModal, closeModal } from './modals.js';
import { getRewardsList, redeemRewardItem, getMyRedemptions } from '../api/rewards.js';
import { getPointsHistory } from '../api/auth.js';
import { showCyberToast } from '../utils/cyberPopup.js';

let activeRewardsTab = 'catalog';
let selectedRewardForRedeem = null;

export function initRewardsModal() {
  // Bind navbar button
  document.getElementById('nav-rewards')?.addEventListener('click', (e) => {
    e.preventDefault();
    openRewardsModal();
  });

  // Bind modal close buttons
  document.getElementById('btn-close-rewards')?.addEventListener('click', () => {
    closeModal('rewards-modal');
  });

  // Bind modal tabs
  document.querySelectorAll('.rewards-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.dataset.tab;
      switchRewardsTab(targetTab);
    });
  });

  // Bind redeem form submission
  document.getElementById('form-redeem-reward')?.addEventListener('submit', handleRedeemSubmit);
  document.getElementById('btn-cancel-redeem')?.addEventListener('click', () => {
    document.getElementById('redeem-confirm-box').style.display = 'none';
    selectedRewardForRedeem = null;
  });
}

export async function openRewardsModal() {
  openModal('rewards-modal');
  renderRewardsHeader();
  await loadActiveTabContent();
}

export function renderRewardsHeader() {
  const user = appState.currentUser;
  const balanceEl = document.getElementById('rewards-user-balance');
  const rupiahEl = document.getElementById('rewards-user-rupiah');
  const guestPrompt = document.getElementById('rewards-guest-prompt');

  if (user) {
    const points = user.points || 0;
    if (balanceEl) balanceEl.innerText = `${points} Poin`;
    if (rupiahEl) rupiahEl.innerText = `Setara potongan ${formatRupiah(points * 100)}`;
    if (guestPrompt) guestPrompt.style.display = 'none';
  } else {
    if (balanceEl) balanceEl.innerText = '0 Poin';
    if (rupiahEl) rupiahEl.innerText = 'Setara potongan Rp 0';
    if (guestPrompt) {
      guestPrompt.style.display = 'block';
      guestPrompt.innerHTML = `
        <div class="rewards-guest-alert">
          <span>💡 Masuk atau daftar akun untuk melihat saldo poin dan menukarkan hadiah!</span>
          <button class="btn-auth-sm" id="btn-rewards-guest-login">Masuk Akun</button>
        </div>
      `;
      document.getElementById('btn-rewards-guest-login')?.addEventListener('click', () => {
        closeModal('rewards-modal');
        document.getElementById('btn-login')?.click();
      });
    }
  }
}

export async function switchRewardsTab(tabName) {
  activeRewardsTab = tabName;
  document.querySelectorAll('.rewards-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Hide redeem form if active
  const formBox = document.getElementById('redeem-confirm-box');
  if (formBox) formBox.style.display = 'none';
  selectedRewardForRedeem = null;

  await loadActiveTabContent();
}

async function loadActiveTabContent() {
  const container = document.getElementById('rewards-tab-content');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
      <div class="spinner-small" style="margin: 0 auto 12px auto;"></div>
      <div>Memuat data reward...</div>
    </div>
  `;

  if (activeRewardsTab === 'catalog') {
    await renderRewardsCatalog(container);
  } else if (activeRewardsTab === 'history') {
    await renderPointsHistory(container);
  } else if (activeRewardsTab === 'claims') {
    await renderMyClaims(container);
  } else if (activeRewardsTab === 'rules') {
    renderRules(container);
  }
}

async function renderRewardsCatalog(container) {
  try {
    const data = await getRewardsList();
    const rewards = data.rewards || [];

    if (rewards.length === 0) {
      container.innerHTML = `
        <div class="rewards-empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">🎁</div>
          <div style="font-weight: 700; color: var(--text-primary);">Belum Ada Hadiah Tersedia</div>
          <p style="font-size: 13px; color: var(--text-secondary);">Katalog hadiah sedang diperbarui oleh administrator.</p>
        </div>
      `;
      return;
    }

    const user = appState.currentUser;
    const userPoints = user ? (user.points || 0) : 0;

    let cardsHtml = rewards.map(item => {
      const isEligible = user && userPoints >= item.points_required;
      const progressPercent = user ? Math.min(100, Math.round((userPoints / item.points_required) * 100)) : 0;
      const gameLabel = item.game === 'mlbb' ? 'Mobile Legends' : 'Valorant';
      const badgeText = item.badge || (item.game === 'mlbb' ? 'MLBB' : 'VALO');

      return `
        <div class="reward-card ${isEligible ? 'eligible' : ''}">
          <div class="reward-card-top">
            <span class="reward-badge">${badgeText}</span>
            <span class="reward-cost">⭐ ${item.points_required} Poin</span>
          </div>
          <div class="reward-card-center">
            <img src="${item.icon || '/assets/icons/diamond_single.png'}" alt="${item.title}" class="reward-icon" />
            <h4 class="reward-title">${item.title}</h4>
            <div class="reward-detail">${item.item_detail}</div>
            <p class="reward-desc">${item.description || ''}</p>
          </div>
          <div class="reward-card-bottom">
            ${user ? `
              <div class="reward-progress-wrap">
                <div class="reward-progress-bar">
                  <div class="reward-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="reward-progress-text">
                  ${isEligible ? '✅ Poin Anda Cukup' : `Kurang ${item.points_required - userPoints} Poin lagi`}
                </div>
              </div>
            ` : ''}
            <button class="btn-redeem-reward" data-id="${item.id}" ${!isEligible && user ? 'disabled' : ''}>
              ${!user ? 'Masuk untuk Klaim' : (isEligible ? 'Tukarkan Hadiah' : 'Poin Belum Cukup')}
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rewards-grid">
        ${cardsHtml}
      </div>
    `;

    // Bind redeem buttons
    container.querySelectorAll('.btn-redeem-reward').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const reward = rewards.find(r => r.id === id);
        if (!reward) return;

        if (!appState.currentUser) {
          closeModal('rewards-modal');
          document.getElementById('btn-login')?.click();
          return;
        }

        openRedeemForm(reward);
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div class="rewards-error-state">
        <p>Gagal memuat katalog reward. Silakan coba kembali nanti.</p>
      </div>
    `;
  }
}

function openRedeemForm(reward) {
  selectedRewardForRedeem = reward;
  const formBox = document.getElementById('redeem-confirm-box');
  if (!formBox) return;

  const titleEl = document.getElementById('redeem-reward-title');
  const costEl = document.getElementById('redeem-reward-cost');
  const serverGroup = document.getElementById('redeem-group-server');
  const uidLabel = document.getElementById('redeem-uid-label');
  const uidInput = document.getElementById('redeem-uid-input');
  const srvInput = document.getElementById('redeem-srv-input');

  if (titleEl) titleEl.innerText = reward.title;
  if (costEl) costEl.innerText = `⭐ ${reward.points_required} Poin (Saldo Anda: ${appState.currentUser?.points || 0} Poin)`;

  if (reward.game === 'mlbb') {
    if (serverGroup) serverGroup.style.display = 'block';
    if (uidLabel) uidLabel.innerText = 'User ID Mobile Legends (6-10 digit)';
    if (uidInput) uidInput.placeholder = 'Contoh: 123456789';
    if (srvInput) srvInput.placeholder = 'Contoh: 2114';
  } else {
    if (serverGroup) serverGroup.style.display = 'none';
    if (uidLabel) uidLabel.innerText = 'Riot ID Valorant (Nama#Tagline)';
    if (uidInput) uidInput.placeholder = 'Contoh: Player#1234';
  }

  formBox.style.display = 'block';
  formBox.scrollIntoView({ behavior: 'smooth' });
}

async function handleRedeemSubmit(e) {
  e.preventDefault();
  if (!selectedRewardForRedeem) return;

  const reward = selectedRewardForRedeem;
  const uidInput = document.getElementById('redeem-uid-input');
  const srvInput = document.getElementById('redeem-srv-input');
  const submitBtn = document.getElementById('btn-confirm-redeem');

  const uid = uidInput?.value.trim() || '';
  const srv = srvInput?.value.trim() || '';

  if (!uid) {
    showCyberToast(reward.game === 'mlbb' ? 'User ID MLBB wajib diisi!' : 'Riot ID Valorant wajib diisi!', 'warning', 'DATA GAME');
    uidInput?.focus();
    return;
  }

  if (reward.game === 'mlbb') {
    if (!srv) {
      showCyberToast('Zone ID / Server MLBB wajib diisi!', 'warning', 'ZONE ID');
      srvInput?.focus();
      return;
    }
    if (!/^\d{6,10}$/.test(uid)) {
      showCyberToast('User ID MLBB harus 6-10 digit angka!', 'warning', 'USER ID');
      uidInput?.focus();
      return;
    }
    if (!/^\d{3,5}$/.test(srv)) {
      showCyberToast('Zone ID MLBB harus 3-5 digit angka!', 'warning', 'ZONE ID');
      srvInput?.focus();
      return;
    }
  }

  if (reward.game === 'valorant') {
    if (!uid.includes('#')) {
      showCyberToast('Riot ID wajib menyertakan tanda # (Contoh: Player#1234)', 'warning', 'RIOT ID');
      uidInput?.focus();
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Memproses Klaim...';
  }

  try {
    const res = await redeemRewardItem(reward.id, {
      game_user_id: uid,
      server_id: srv
    });

    if (!res.success) {
      showCyberToast(res.message || 'Gagal menukarkan hadiah.', 'error', 'PENUKARAN GAGAL');
      return;
    }

    // Success! Update local user points
    if (appState.currentUser && typeof res.remainingPoints === 'number') {
      appState.currentUser.points = res.remainingPoints;
      renderRewardsHeader();
      updateNavbarPointsBadge(res.remainingPoints);
    }

    // Hide redeem form
    document.getElementById('redeem-confirm-box').style.display = 'none';
    selectedRewardForRedeem = null;

    // Show success dialog
    showCelebrationPopup({
      title: 'Klaim Hadiah Berhasil! 🎉',
      rewardTitle: reward.title,
      claimCode: res.claimCode,
      targetAccount: reward.game === 'mlbb' ? `${uid} (${srv})` : uid,
      remainingPoints: res.remainingPoints
    });

    // Refresh active tab
    await loadActiveTabContent();
  } catch (err) {
    console.error('Redeem error:', err);
    showCyberToast('Terjadi kesalahan saat menukarkan hadiah.', 'error', 'GAGAL');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Konfirmasi Penukaran';
    }
  }
}

function showCelebrationPopup({ title, rewardTitle, claimCode, targetAccount, remainingPoints }) {
  showCyberToast(`Selamat! Hadiah ${rewardTitle} berhasil diklaim untuk akun ${targetAccount}. Kode Tiket: ${claimCode}`, 'success', 'HADIAH DITUKARKAN');
}

async function renderPointsHistory(container) {
  if (!appState.currentUser) {
    container.innerHTML = `
      <div class="rewards-guest-alert" style="margin: 20px 0;">
        <span>Silakan masuk ke akun Anda untuk melihat riwayat perolehan & pemakaian poin.</span>
        <button class="btn-auth-sm" id="btn-hist-login">Masuk Sekarang</button>
      </div>
    `;
    document.getElementById('btn-hist-login')?.addEventListener('click', () => {
      closeModal('rewards-modal');
      document.getElementById('btn-login')?.click();
    });
    return;
  }

  try {
    const data = await getPointsHistory();
    const history = data.history || [];

    if (history.length === 0) {
      container.innerHTML = `
        <div class="rewards-empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">📜</div>
          <div style="font-weight: 700; color: var(--text-primary);">Belum Ada Riwayat Poin</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
            Lakukan transaksi top up atau tukarkan poin Anda untuk melihat catatan riwayat di sini.
          </p>
        </div>
      `;
      return;
    }

    const rowsHtml = history.map(item => {
      const isPositive = item.points_earned > 0;
      const dateFormatted = new Date(item.created_at).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="history-item-row">
          <div class="history-item-left">
            <span class="history-badge ${isPositive ? 'plus' : 'minus'}">
              ${isPositive ? `+${item.points_earned} Poin` : `${item.points_earned} Poin`}
            </span>
            <div class="history-item-info">
              <div class="history-desc">${item.description || 'Penyesuaian poin'}</div>
              <div class="history-date">${dateFormatted}</div>
            </div>
          </div>
          <div class="history-item-right">
            <span class="history-status-tag ${isPositive ? 'tag-earn' : 'tag-spend'}">
              ${isPositive ? 'Didapat' : 'Digunakan'}
            </span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="history-list-wrap">
        ${rowsHtml}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="rewards-error-state"><p>Gagal memuat riwayat poin.</p></div>
    `;
  }
}

async function renderMyClaims(container) {
  if (!appState.currentUser) {
    container.innerHTML = `
      <div class="rewards-guest-alert" style="margin: 20px 0;">
        <span>Silakan masuk ke akun Anda untuk melihat koleksi hadiah yang pernah Anda klaim.</span>
        <button class="btn-auth-sm" id="btn-claim-login">Masuk Sekarang</button>
      </div>
    `;
    document.getElementById('btn-claim-login')?.addEventListener('click', () => {
      closeModal('rewards-modal');
      document.getElementById('btn-login')?.click();
    });
    return;
  }

  try {
    const data = await getMyRedemptions();
    const claims = data.redemptions || [];

    if (claims.length === 0) {
      container.innerHTML = `
        <div class="rewards-empty-state">
          <div style="font-size: 36px; margin-bottom: 8px;">🎁</div>
          <div style="font-weight: 700; color: var(--text-primary);">Belum Ada Hadiah Diklaim</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
            Kumpulkan poin loyalitas dari pembelian Anda dan tukarkan dengan paket Diamond MLBB atau Valorant Points!
          </p>
        </div>
      `;
      return;
    }

    const cardsHtml = claims.map(c => {
      const dateFormatted = new Date(c.created_at).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const targetStr = c.server_id ? `${c.game_user_id} (${c.server_id})` : c.game_user_id;

      return `
        <div class="claim-card">
          <div class="claim-card-header">
            <span class="claim-title">${c.title}</span>
            <span class="claim-status-badge">Berhasil</span>
          </div>
          <div class="claim-card-body">
            <div class="claim-field">
              <span>Akun Penerima:</span>
              <strong>${targetStr}</strong>
            </div>
            <div class="claim-field">
              <span>Biaya Poin:</span>
              <strong style="color: var(--accent-gold-light);">⭐ ${c.points_spent} Poin</strong>
            </div>
            <div class="claim-field">
              <span>Kode Tiket Klaim:</span>
              <strong class="claim-code-text">${c.claim_code}</strong>
            </div>
            <div class="claim-field">
              <span>Tanggal:</span>
              <span>${dateFormatted}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="claims-grid">
        ${cardsHtml}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="rewards-error-state"><p>Gagal memuat hadiah Anda.</p></div>
    `;
  }
}

function renderRules(container) {
  container.innerHTML = `
    <div class="rules-container">
      <div class="rule-card">
        <div class="rule-icon">💎</div>
        <div class="rule-content">
          <h4>1. Cara Mendapatkan Poin</h4>
          <p>
            Khusus pengguna yang mendaftar akun di Dar'sstore, setiap transaksi top up akan mendapatkan <strong>1 Poin Loyalitas setiap kelipatan Rp 10.000</strong> dari total pembayaran tunai Anda.
          </p>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">🏷️</div>
        <div class="rule-content">
          <h4>2. Potong Harga Langsung Saat Beli Lagi</h4>
          <p>
            Poin yang telah dikumpulkan dapat digunakan sebagai <strong>potongan diskon harga langsung saat checkout berikutnya</strong> (1 Poin = Potongan Rp 100).
            Untuk menjaga stabilitas harga, maksimal potongan dibatasi hingga <strong>20% dari harga produk</strong> per pesanan.
          </p>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">🎁</div>
        <div class="rule-content">
          <h4>3. Tukar Hadiah Mikro Game</h4>
          <p>
            Selain potong harga, Anda juga bisa menukarkan poin dengan <strong>Paket Diamond Mobile Legends (3 DM, 5 DM, 12 DM)</strong> atau <strong>Valorant Points (125 VP, 300 VP)</strong> gratis di tab Katalog Hadiah!
          </p>
        </div>
      </div>

      <div class="rule-card">
        <div class="rule-icon">🛡️</div>
        <div class="rule-content">
          <h4>4. Poin Aman & Tanpa Hangus</h4>
          <p>
            Poin Anda tidak akan pernah kedaluwarsa. Jika transaksi pembayaran Anda di Midtrans expired atau dibatalkan, poin loyalitas yang Anda gunakan otomatis kami kembalikan utuh ke saldo akun Anda.
          </p>
        </div>
      </div>
    </div>
  `;
}

function updateNavbarPointsBadge(newPoints) {
  const badge = document.querySelector('.user-points-badge');
  if (badge && !badge.innerText.includes('Admin')) {
    badge.innerText = `⭐ ${newPoints} Poin`;
  }
}
