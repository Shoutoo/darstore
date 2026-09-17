// ==========================================================
// DAR'SSTORE — MAIN APPLICATION ENTRY POINT
// ==========================================================

import { appState } from './utils/state.js';
import { getToken, setToken, clearToken } from './utils/token.js';
import { renderHomepage, setupCarousel } from './views/homepage.js';
import { renderMLView, handleMLCheckout, updateMLSummary, setupMLInputValidation } from './views/mlView.js';
import { renderValoView, handleValoCheckout, updateValoSummary, setupValoInputValidation } from './views/valoView.js';
import { fetchRealtimeTable, searchInvoice, setupInvoiceSearch } from './views/invoiceView.js';
import { setupModals, openModal, closeModal } from './components/modals.js';
import { getUserProfile, loginUser, registerUser } from './api/auth.js';
import { simulatePayment } from './api/orders.js';
import { showCyberToast, showCyberConfirm } from './utils/cyberPopup.js';

// ==========================================================
// ROUTER / VIEW SWITCHING (CLEAN URL HISTORY API)
// ==========================================================
export function navigateTo(path) {
  if (!path) return;

  // Backward compatibility: Convert legacy hash e.g. '#ml' -> '/ml'
  let targetPath = path;
  if (targetPath.startsWith('#')) {
    if (targetPath === '#home' || targetPath === '#') targetPath = '/';
    else if (targetPath === '#ml') targetPath = '/ml';
    else if (targetPath === '#valo') targetPath = '/valo';
    else if (targetPath === '#cek-transaksi') targetPath = '/cek-transaksi';
  }

  // Ensure clean pathname without trailing slash (except root)
  if (targetPath.length > 1 && targetPath.endsWith('/')) {
    targetPath = targetPath.slice(0, -1);
  }

  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath);
  }

  handleRouteChange();
}

// Alias for backwards compatibility
export const navigateToRoute = navigateTo;

export function handleRouteChange() {
  let path = window.location.pathname || '/';

  // Support legacy hash if user accesses via old link e.g. localhost:5173/#ml
  const hash = window.location.hash;
  if (hash) {
    if (hash === '#ml') {
      window.history.replaceState({}, '', '/ml');
      path = '/ml';
    } else if (hash === '#valo') {
      window.history.replaceState({}, '', '/valo');
      path = '/valo';
    } else if (hash === '#cek-transaksi') {
      window.history.replaceState({}, '', '/cek-transaksi');
      path = '/cek-transaksi';
    } else if (hash === '#home' || hash === '#') {
      window.history.replaceState({}, '', '/');
      path = '/';
    }
  }

  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  let targetViewId = 'home-view';
  if (path === '/ml') {
    targetViewId = 'ml-topup-view';
  } else if (path === '/valo') {
    targetViewId = 'valo-topup-view';
  } else if (path === '/cek-transaksi') {
    targetViewId = 'cek-transaksi-view';
  } else {
    targetViewId = 'home-view';
  }

  switchView(targetViewId, path);
}

export function switchView(targetViewId, currentPath = window.location.pathname) {
  const views = ['home-view', 'ml-topup-view', 'valo-topup-view', 'cek-transaksi-view'];
  
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = (id === targetViewId) ? 'block' : 'none';
    }
  });

  appState.activeView = targetViewId;
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.body.scrollTop = 0;

  // Update header nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    const linkPath = link.getAttribute('data-route') || link.getAttribute('href');
    if (link.dataset.target === targetViewId || (linkPath && (linkPath === currentPath || (linkPath === '/' && (currentPath === '/' || currentPath === ''))))) {
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
    const data = await getUserProfile();
    if (data && data.success && data.user) {
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

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const ok = await showCyberConfirm({
      title: 'Konfirmasi Keluar',
      message: 'Apakah Anda yakin ingin keluar dari akun Dar\'sstore Anda?',
      confirmText: 'Keluar Sekarang',
      cancelText: 'Batal',
      variant: 'danger'
    });
    if (!ok) return;

    clearToken();
    appState.currentUser = null;
    showCyberToast('Anda telah keluar dari sesi akun.', 'info', 'SESI SELESAI');
    checkCurrentUser();
  });
}

function openAuthModal(mode = 'login') {
  const title = document.getElementById('auth-modal-title');
  const submitBtn = document.getElementById('btn-submit-auth');
  const switchLink = document.getElementById('auth-switch-link');
  const switchText = document.getElementById('auth-switch-text');
  const nameGroup = document.getElementById('auth-name-group');
  const errEl = document.getElementById('auth-error-msg');
  if (errEl) {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }

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

function setupAuthHandlers() {
  const authSwitch = document.getElementById('auth-switch-link');
  const authTitle = document.getElementById('auth-modal-title');
  const authSubmit = document.getElementById('btn-submit-auth');
  const authSwitchText = document.getElementById('auth-switch-text');
  const nameGroup = document.getElementById('auth-name-group');

  if (authSwitch) {
    authSwitch.addEventListener('click', (e) => {
      e.preventDefault();
      const errEl = document.getElementById('auth-error-msg');
      if (errEl) errEl.style.display = 'none';

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

  if (authSubmit) {
    authSubmit.addEventListener('click', async () => {
      const isRegister = authTitle.textContent.includes('Daftar');
      const identifier = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-pass').value;
      const nama = document.getElementById('auth-name')?.value.trim();
      const errEl = document.getElementById('auth-error-msg');

      if (!identifier || !password) {
        showCyberToast('Silakan isi email/WhatsApp dan kata sandi.', 'warning', 'VALIDASI FORM');
        if (errEl) {
          errEl.textContent = 'Silakan isi email/WhatsApp dan kata sandi.';
          errEl.style.display = 'block';
        }
        return;
      }

      authSubmit.disabled = true;
      authSubmit.textContent = 'Memproses...';
      if (errEl) errEl.style.display = 'none';

      try {
        let data;
        if (isRegister) {
          data = await registerUser(nama || 'Member', identifier, password);
        } else {
          data = await loginUser(identifier, password);
        }

        if (data && data.success) {
          if (data.token) setToken(data.token);
          showCyberToast(
            isRegister ? 'Registrasi berhasil! Selamat datang di Dar\'sstore.' : 'Login berhasil! Selamat datang kembali.',
            'success',
            'AUTENTIKASI BERHASIL'
          );
          closeModal('auth-modal');
          checkCurrentUser();
        } else {
          const msg = data?.message || 'Kredensial salah. Silakan periksa kembali.';
          showCyberToast(msg, 'error', 'LOGIN GAGAL');
          if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
          }
        }
      } catch (err) {
        console.error('Auth error:', err);
        showCyberToast('Gagal terhubung ke backend server.', 'error', 'KONEKSI GAGAL');
        if (errEl) {
          errEl.textContent = 'Gagal menghubungi server backend.';
          errEl.style.display = 'block';
        }
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
  const mlMinus = document.getElementById('ml-qty-minus');
  const mlPlus = document.getElementById('ml-qty-plus');
  const mlInput = document.getElementById('ml-qty-input');

  if (mlMinus && mlPlus && mlInput) {
    mlMinus.addEventListener('click', () => {
      if (appState.ml.qty > 1) {
        appState.ml.qty--;
        mlInput.value = appState.ml.qty;
        updateMLSummary();
      }
    });
    mlPlus.addEventListener('click', () => {
      appState.ml.qty++;
      mlInput.value = appState.ml.qty;
      updateMLSummary();
    });
  }

  document.getElementById('ml-btn-order')?.addEventListener('click', handleMLCheckout);
  document.getElementById('valo-btn-order')?.addEventListener('click', handleValoCheckout);
}

// ==========================================================
// MODAL CONTROLS & CHECKOUT ACTIONS
// ==========================================================
function setupCheckoutModalButtons() {
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

  const btnSimulate = document.getElementById('btn-simulate-pay');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', async () => {
      if (!appState.currentInvoice) return;
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Memproses...';

      try {
        const data = await simulatePayment(appState.currentInvoice.invoice_number);
        if (data.success) {
          showCyberToast('Pembayaran QRIS Berhasil Dikonfirmasi! Item top up telah dikirim otomatis.', 'success', 'TRANSAKSI SUKSES');
          closeModal('checkout-modal');
          navigateTo('/cek-transaksi');
          const input = document.getElementById('invoice-search-input');
          if (input) input.value = appState.currentInvoice.invoice_number;
          searchInvoice(appState.currentInvoice.invoice_number);
          fetchRealtimeTable();
          checkCurrentUser();
        } else {
          showCyberToast(data.message || 'Gagal simulasi pembayaran.', 'error', 'SIMULASI GAGAL');
        }
      } catch (err) {
        showCyberToast('Gagal menghubungi server backend.', 'error', 'KONEKSI SERVER');
      } finally {
        btnSimulate.disabled = false;
        btnSimulate.textContent = '⚡ Simulasi Bayar QRIS (Demo)';
      }
    });
  }

  const btnCheckStatus = document.getElementById('btn-goto-check-trans');
  if (btnCheckStatus) {
    btnCheckStatus.addEventListener('click', () => {
      closeModal('checkout-modal');
      navigateTo('/cek-transaksi');
      if (appState.currentInvoice) {
        const input = document.getElementById('invoice-search-input');
        if (input) {
          input.value = appState.currentInvoice.invoice_number;
          searchInvoice(appState.currentInvoice.invoice_number);
        }
      }
    });
  }
}

// ==========================================================
// GLOBAL SEARCH IN HEADER
// ==========================================================
function setupGlobalSearch() {
  const globalSearch = document.getElementById('global-search-input');
  if (globalSearch) {
    globalSearch.value = '';
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
}

// ==========================================================
// THEME TOGGLE
// ==========================================================
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const html = document.documentElement;
  
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
// INITIALIZATION & GLOBAL CLICK INTERCEPTOR
// ==========================================================
document.addEventListener('click', (e) => {
  const target = e.target.closest('a, .game-card, .popular-card');
  if (!target) return;

  // Ignore modified clicks (Ctrl, Shift, Meta, middle-click)
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

  const href = target.getAttribute('href');
  const route = target.dataset.route || href;

  if (!route) return;

  // Don't intercept external links, special protocols, or admin.html
  if (
    route.startsWith('http://') ||
    route.startsWith('https://') ||
    route.startsWith('//') ||
    route.startsWith('mailto:') ||
    route.startsWith('tel:') ||
    route.startsWith('javascript:') ||
    target.getAttribute('target') === '_blank' ||
    route.includes('admin.html')
  ) {
    return;
  }

  // Intercept internal SPA navigation
  e.preventDefault();
  navigateTo(route);
});

document.addEventListener('DOMContentLoaded', () => {
  renderHomepage();
  renderMLView();
  renderValoView();
  setupCarousel();
  setupCounters();
  setupMLInputValidation();
  setupValoInputValidation();
  setupModals();
  setupAuthHandlers();
  setupCheckoutModalButtons();
  setupGlobalSearch();
  setupInvoiceSearch(() => checkCurrentUser());
  setupThemeToggle();
  checkCurrentUser();

  window.addEventListener('popstate', handleRouteChange);
  handleRouteChange();

  console.log("Dar'sstore Web Application initialized successfully with Clean URL routing.");
});
