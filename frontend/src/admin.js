// ==========================================================
// DAR'SSTORE ADMIN DASHBOARD CLIENT
// ==========================================================

const ADMIN_TOKEN_KEY = 'darsstore_token';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0).replace('IDR', 'Rp');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'berhasil' || s === 'success' || s === 'paid') {
    return `<span class="badge-status badge-success">Berhasil</span>`;
  } else if (s === 'diproses' || s === 'processing') {
    return `<span class="badge-status badge-processing">Diproses</span>`;
  } else if (s === 'menunggu pembayaran' || s === 'pending') {
    return `<span class="badge-status badge-pending">Menunggu</span>`;
  } else if (s === 'refunded') {
    return `<span class="badge-status badge-refunded">Refund</span>`;
  } else {
    return `<span class="badge-status badge-failed">Gagal</span>`;
  }
}

// ==========================================================
// CYBER NOTIFICATIONS & CUSTOM POPUP DIALOGS
// ==========================================================

function getCyberSvgIcon(name, size = 20) {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const n = (name || '').toLowerCase();
  if (n.includes('check') || n.includes('success') || n.includes('verified')) {
    return `<svg ${s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  }
  if (n.includes('trash') || n.includes('delete')) {
    return `<svg ${s}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  }
  if (n.includes('warn') || n.includes('alert-triangle')) {
    return `<svg ${s}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  }
  if (n.includes('error') || n.includes('cancel') || n.includes('close')) {
    return `<svg ${s}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  }
  if (n.includes('logout')) {
    return `<svg ${s}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;
  }
  if (n.includes('lock_open')) {
    return `<svg ${s}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
  }
  if (n.includes('lock') || n.includes('block')) {
    return `<svg ${s}><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
  }
  if (n.includes('edit') || n.includes('prompt') || n.includes('note')) {
    return `<svg ${s}><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;
  }
  return `<svg ${s}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
}

function showCyberToast(message, type = 'info', title = '', duration = 3800) {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const typeConfig = {
    success: {
      tag: 'SUCCESS // OK',
      defaultTitle: 'Operasi Berhasil',
      icon: 'check',
      className: 'toast-success'
    },
    error: {
      tag: 'ERROR // ALERT',
      defaultTitle: 'Gagal Memproses',
      icon: 'error',
      className: 'toast-error'
    },
    warning: {
      tag: 'WARNING // WARN',
      defaultTitle: 'Peringatan Sistem',
      icon: 'warning',
      className: 'toast-warning'
    },
    info: {
      tag: 'CONSOLE // NOTICE',
      defaultTitle: "Dar'sstore Console",
      icon: 'info',
      className: 'toast-info'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  const finalTitle = title || config.defaultTitle;

  const toast = document.createElement('div');
  toast.className = `cyber-toast ${config.className}`;
  toast.innerHTML = `
    <div class="cyber-toast-header">
      <span class="cyber-toast-tag">${config.tag}</span>
      <button type="button" class="cyber-toast-close" title="Tutup">&times;</button>
    </div>
    <div class="cyber-toast-body">
      <div class="cyber-toast-icon">
        ${getCyberSvgIcon(config.icon, 18)}
      </div>
      <div class="cyber-toast-text">
        <div class="cyber-toast-title">${finalTitle}</div>
        <div class="cyber-toast-message">${message}</div>
      </div>
    </div>
    <div class="cyber-toast-bar" style="animation-duration: ${duration}ms;"></div>
  `;

  container.appendChild(toast);

  let isRemoved = false;
  const removeToast = () => {
    if (isRemoved) return;
    isRemoved = true;
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      toast.remove();
    }, 280);
  };

  const timer = setTimeout(removeToast, duration);

  toast.querySelector('.cyber-toast-close')?.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
}

// Backward-compatible toast function
function showToast(message, isError = false) {
  if (isError) {
    showCyberToast(message, 'error', 'Perhatian');
  } else {
    const isSuccess = /berhasil|sukses|selamat|tersimpan|dihapus|diperbarui/i.test(message);
    showCyberToast(message, isSuccess ? 'success' : 'info', isSuccess ? 'Status Sistem' : "Dar'sstore Console");
  }
}

// Custom Cyber Confirmation Dialog (replaces native confirm)
function showCyberConfirm({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  tag = '',
  icon = '',
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-cyber-dialog');
    const card = document.getElementById('cyber-dialog-card');
    const tagEl = document.getElementById('cyber-dialog-tag-text');
    const iconBox = document.getElementById('cyber-dialog-icon-box');
    const titleEl = document.getElementById('cyber-dialog-title');
    const msgEl = document.getElementById('cyber-dialog-message');
    const promptContainer = document.getElementById('cyber-dialog-prompt-container');
    const confirmBtn = document.getElementById('btn-cyber-dialog-confirm');
    const confirmTextEl = document.getElementById('cyber-dialog-confirm-text');
    const cancelBtn = document.getElementById('btn-cyber-dialog-cancel');
    const closeBtn = document.getElementById('btn-cyber-dialog-close');

    if (!modal) {
      return resolve(window.confirm(message));
    }

    if (isDanger) {
      card.classList.add('is-danger');
      confirmBtn.classList.add('is-danger');
    } else {
      card.classList.remove('is-danger');
      confirmBtn.classList.remove('is-danger');
    }

    tagEl.textContent = tag || (isDanger ? 'SECURITY // CONFIRMATION' : 'SYSTEM // CONFIRMATION');
    if (iconBox) {
      iconBox.innerHTML = getCyberSvgIcon(icon || (isDanger ? 'warning' : 'help'), 28);
    }
    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmTextEl.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    promptContainer.style.display = 'none';

    modal.style.display = 'flex';

    let resolved = false;
    const cleanupAndResolve = (result) => {
      if (resolved) return;
      resolved = true;
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onConfirm = () => cleanupAndResolve(true);
    const onCancel = () => cleanupAndResolve(false);
    const onBackdrop = (e) => {
      if (e.target === modal) cleanupAndResolve(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanupAndResolve(false);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);
  });
}

// Custom Cyber Prompt Dialog (replaces native prompt)
function showCyberPrompt({
  title = 'Masukkan Keterangan',
  message = 'Silakan masukkan keterangan yang diperlukan di bawah ini:',
  tag = 'INPUT // REQUIRED',
  icon = 'edit_note',
  label = 'Keterangan Tindakan',
  placeholder = 'Tulis di sini...',
  defaultValue = '',
  confirmText = 'Kirim Keterangan',
  cancelText = 'Batal'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-cyber-dialog');
    const card = document.getElementById('cyber-dialog-card');
    const tagEl = document.getElementById('cyber-dialog-tag-text');
    const iconBox = document.getElementById('cyber-dialog-icon-box');
    const titleEl = document.getElementById('cyber-dialog-title');
    const msgEl = document.getElementById('cyber-dialog-message');
    const promptContainer = document.getElementById('cyber-dialog-prompt-container');
    const inputLabel = document.getElementById('cyber-dialog-input-label');
    const inputEl = document.getElementById('cyber-dialog-input');
    const confirmBtn = document.getElementById('btn-cyber-dialog-confirm');
    const confirmTextEl = document.getElementById('cyber-dialog-confirm-text');
    const cancelBtn = document.getElementById('btn-cyber-dialog-cancel');
    const closeBtn = document.getElementById('btn-cyber-dialog-close');

    if (!modal) {
      return resolve(window.prompt(message, defaultValue));
    }

    card.classList.remove('is-danger');
    confirmBtn.classList.remove('is-danger');

    tagEl.textContent = tag;
    if (iconBox) {
      iconBox.innerHTML = getCyberSvgIcon(icon || 'prompt', 28);
    }
    titleEl.textContent = title;
    msgEl.textContent = message;
    inputLabel.textContent = label;
    inputEl.value = defaultValue;
    inputEl.placeholder = placeholder;
    confirmTextEl.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    promptContainer.style.display = 'block';

    modal.style.display = 'flex';
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 50);

    let resolved = false;
    const cleanupAndResolve = (result) => {
      if (resolved) return;
      resolved = true;
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      inputEl.removeEventListener('keydown', onInputKeyDown);
      modal.removeEventListener('click', onBackdrop);
      window.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };

    const onConfirm = () => {
      const val = inputEl.value.trim();
      cleanupAndResolve(val);
    };
    const onCancel = () => cleanupAndResolve(null);
    const onBackdrop = (e) => {
      if (e.target === modal) cleanupAndResolve(null);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanupAndResolve(null);
    };
    const onInputKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    inputEl.addEventListener('keydown', onInputKeyDown);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);
  });
}

// Expose popup helpers to window for global access
window.showCyberToast = showCyberToast;
window.showCyberConfirm = showCyberConfirm;
window.showCyberPrompt = showCyberPrompt;
window.showToast = showToast;

// API Fetch Helper with Auto Bearer Token
async function adminFetch(endpoint, options = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data.message && data.message.includes('khusus untuk Administrator')) {
        showToast('Akses ditolak: Akun ini bukan Administrator.', true);
        showLoginScreen();
        return { ok: false, error: data.message };
      }
    }
  }
  return res;
}

// App State
const adminState = {
  currentView: 'dashboard',
  currentUser: null,
  productsFilter: { game: 'all', search: '' },
  ordersFilter: { status: 'all', game: 'all', search: '', date_from: '', date_to: '' }
};

// ----------------------------------------------------------
// AUTHENTICATION & INITIALIZATION
// ----------------------------------------------------------
async function checkAuth() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    showLoginScreen();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      if (data.user.role !== 'admin') {
        showLoginScreen('Akun Anda (' + data.user.email + ') bukan administrator.');
        return;
      }
      adminState.currentUser = data.user;
      showMainScreen(data.user);
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error('Check auth error:', err);
    showLoginScreen();
  }
}

function showLoginScreen(errorMsg = '') {
  document.getElementById('admin-login-screen').style.display = 'flex';
  document.getElementById('admin-main-screen').style.display = 'none';
  const errBox = document.getElementById('login-error-msg');
  if (errorMsg) {
    errBox.innerText = errorMsg;
    errBox.style.display = 'block';
  } else {
    errBox.style.display = 'none';
  }
}

function showMainScreen(user) {
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-main-screen').style.display = 'flex';
  document.getElementById('admin-user-name').innerText = user.nama || user.email;
  document.getElementById('admin-user-avatar').innerText = (user.nama || user.email).charAt(0).toUpperCase();

  switchView('dashboard');
  loadProviderBalance();
}

// Handle Login Form Submit
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifier = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-pass').value;
  const btn = document.getElementById('btn-submit-login');
  const errBox = document.getElementById('login-error-msg');

  btn.disabled = true;
  btn.innerText = 'Memverifikasi...';
  errBox.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      if (data.user.role !== 'admin') {
        errBox.innerText = 'Akses ditolak: Akun Anda terdaftar sebagai user biasa, bukan administrator.';
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.innerText = 'Masuk ke Panel Admin';
        return;
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      adminState.currentUser = data.user;
      showMainScreen(data.user);
      showToast('Selamat datang di Panel Admin Dar\'sstore!');
    } else {
      errBox.innerText = data.message || 'Login gagal. Periksa kembali email dan password.';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.innerText = 'Gagal menghubungi server. Pastikan backend aktif.';
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerText = 'Masuk ke Panel Admin';
  }
});

// Logout
document.getElementById('btn-logout-admin')?.addEventListener('click', async () => {
  const confirmed = await showCyberConfirm({
    title: 'Konfirmasi Keluar',
    message: 'Apakah Anda yakin ingin keluar dari sesi panel admin Dar\'sstore?',
    tag: 'LOGOUT // AUTH',
    icon: 'logout',
    confirmText: 'Keluar',
    cancelText: 'Tetap di Sini',
    isDanger: true
  });
  if (confirmed) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    adminState.currentUser = null;
    showLoginScreen();
    showCyberToast('Anda telah keluar dari sesi administrator.', 'info', 'Sesi Berakhir');
  }
});

// ----------------------------------------------------------
// NAVIGATION & VIEW SWITCHING
// ----------------------------------------------------------
const VIEW_CONFIG = {
  dashboard: { title: 'Dashboard Overview', subtitle: 'Ringkasan statistik transaksi dan performa toko.' },
  products: { title: 'Kelola Produk', subtitle: 'Daftar katalog nominal Mobile Legends & Valorant.' },
  orders: { title: 'Kelola Transaksi', subtitle: 'Manajemen riwayat pesanan, status, dan aksi manual.' },
  users: { title: 'Kelola Pengguna', subtitle: 'Daftar akun pelanggan terdaftar dan poin loyalitas.' },
  payment: { title: 'Pengaturan Payment Gateway', subtitle: 'Integrasi dan status pembayaran QRIS Tripay.' },
  provider: { title: 'Provider Top Up (H2H)', subtitle: 'Koneksi provider Digiflazz dan monitoring saldo.' },
  reports: { title: 'Laporan Pendapatan', subtitle: 'Rincian omset per game dan ekspor laporan pembukuan.' },
  logs: { title: 'Log Aktivitas Admin', subtitle: 'Audit trail semua aksi perubahan yang dilakukan administrator.' },
  settings: { title: 'Pengaturan Umum', subtitle: 'Konfigurasi kontak WhatsApp dan email resmi toko.' }
};

function switchView(viewName) {
  adminState.currentView = viewName;

  // Update nav buttons
  document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update content sections
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  // Update topbar titles
  const cfg = VIEW_CONFIG[viewName] || { title: 'Admin', subtitle: '' };
  document.getElementById('page-title').innerText = cfg.title;
  document.getElementById('page-subtitle').innerText = cfg.subtitle;

  // Load view data
  loadCurrentViewData();
}

document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
  });
});

document.getElementById('link-goto-orders')?.addEventListener('click', () => {
  switchView('orders');
});

document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
  loadCurrentViewData();
  showToast('Data berhasil diperbarui!');
});

function loadCurrentViewData() {
  switch (adminState.currentView) {
    case 'dashboard': loadDashboard(); break;
    case 'products': loadProducts(); break;
    case 'orders': loadOrders(); break;
    case 'users': loadUsers(); break;
    case 'payment': loadPaymentSettings(); break;
    case 'provider': loadProviderBalance(); break;
    case 'reports': loadReports(); break;
    case 'logs': loadLogs(); break;
    case 'settings': loadSettings(); break;
  }
}

// ----------------------------------------------------------
// 1. DASHBOARD CONTROLLER
// ----------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await adminFetch('/api/admin/dashboard');
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const s = data.stats;
    document.getElementById('stat-revenue-today').innerText = formatRupiah(s.revenueToday);
    document.getElementById('stat-revenue-week').innerText = formatRupiah(s.revenueWeek);
    document.getElementById('stat-total-orders').innerText = (s.totalOrders || 0).toLocaleString();
    document.getElementById('stat-total-users').innerText = (s.totalUsers || 0).toLocaleString();

    // Status chip counts
    document.getElementById('chip-count-pending').innerText = s.statusCounts.pending;
    document.getElementById('chip-count-processing').innerText = s.statusCounts.processing;
    document.getElementById('chip-count-success').innerText = s.statusCounts.success;
    document.getElementById('chip-count-failed').innerText = s.statusCounts.failed;
    document.getElementById('chip-count-refunded').innerText = s.statusCounts.refunded;

    // Render 7-day Bar Chart
    const chartContainer = document.getElementById('dashboard-chart-container');
    const maxRev = Math.max(...s.chartData.map(d => d.revenue), 100000);

    chartContainer.innerHTML = s.chartData.map(day => {
      const pct = Math.max(4, Math.round((day.revenue / maxRev) * 100));
      return `
        <div class="bar-col">
          <div class="bar-fill" style="height: ${pct}%;">
            <span class="bar-tooltip">${formatRupiah(day.revenue)}</span>
          </div>
          <span class="bar-date">${day.label}</span>
        </div>
      `;
    }).join('');

    // Top Products List
    const topContainer = document.getElementById('top-products-container');
    if (s.topProducts && s.topProducts.length > 0) {
      topContainer.innerHTML = s.topProducts.map((p, idx) => {
        const trend = (12.4 + idx * 3.5).toFixed(1);
        const icon = idx === 0 ? '💎' : (idx === 1 ? '🎟️' : (idx === 2 ? '🎯' : '🔥'));
        return `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#11161f] border border-dars-border/80 hover:border-slate-600 transition-colors">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                ${icon}
              </div>
              <div class="truncate">
                <p class="font-semibold text-white text-xs leading-tight truncate">${p.name}</p>
                <p class="text-[10px] text-slate-400 font-mono">Rank #${idx + 1} Best Seller</p>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-xs font-mono font-bold text-sky-400">${p.count}x</span>
              <span class="text-[11px] font-mono text-emerald-400 font-semibold hidden sm:inline">+${trend}% ▲</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      topContainer.innerHTML = `<div class="text-slate-500 text-center text-xs py-4">Belum ada data penjualan.</div>`;
    }

    // Recent 8 Orders Table
    const recentTbody = document.getElementById('recent-orders-tbody');
    if (s.recentOrders && s.recentOrders.length > 0) {
      recentTbody.innerHTML = s.recentOrders.map(o => `
        <tr>
          <td><strong class="text-sky-400 font-mono text-xs">#${o.invoice_number}</strong></td>
          <td>
            <div class="font-semibold text-white text-xs">${o.nama_item || 'Item Game'}</div>
            <div class="text-[10px] text-slate-400 font-mono">${o.wa_email_guest || '-'}</div>
          </td>
          <td><strong class="font-mono text-xs text-white">${formatRupiah(o.total_harga)}</strong></td>
          <td>${getStatusBadge(o.status)}</td>
        </tr>
      `).join('');
    } else {
      recentTbody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-4">Belum ada pesanan terbaru.</td></tr>`;
    }
  } catch (err) {
    console.error('loadDashboard error:', err);
  }
}

// ----------------------------------------------------------
// 2. PRODUCTS CONTROLLER (CRUD)
// ----------------------------------------------------------
async function loadProducts() {
  const game = adminState.productsFilter.game;
  const search = adminState.productsFilter.search;

  try {
    const res = await adminFetch(`/api/admin/products?game=${game}&search=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const tbody = document.getElementById('products-tbody');
    if (data.products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada produk ditemukan.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.products.map(p => `
      <tr>
        <td>
          <span class="badge-status ${p.game === 'valorant' ? 'badge-processing' : 'badge-pending'}">
            ${p.game === 'valorant' ? 'VALORANT' : 'MLBB'}
          </span>
        </td>
        <td><strong>${p.nama_item}</strong></td>
        <td>${p.nominal ? p.nominal.toLocaleString() : '-'}</td>
        <td><strong class="text-blue">${formatRupiah(p.harga)}</strong></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-product-active" data-id="${p.id}" ${p.is_active ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action-sm btn-act-blue btn-edit-product" data-product='${JSON.stringify(p)}'>Edit</button>
            <button class="btn-action-sm btn-act-red btn-delete-product" data-id="${p.id}" data-name="${p.nama_item}">Hapus</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind Toggle Active
    tbody.querySelectorAll('.toggle-product-active').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const isActive = e.target.checked;
        const updateRes = await adminFetch(`/api/admin/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: isActive })
        });
        if (updateRes.ok) {
          showToast(`Status produk diperbarui: ${isActive ? 'Aktif' : 'Nonaktif'}`);
        } else {
          e.target.checked = !isActive;
          showToast('Gagal memperbarui status produk', true);
        }
      });
    });

    // Bind Edit Button
    tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = JSON.parse(btn.dataset.product);
        openProductModal(p);
      });
    });

    // Bind Delete Button
    tbody.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const confirmed = await showCyberConfirm({
          title: 'Hapus Katalog Produk',
          message: `Hapus item "${name}" secara permanen dari katalog toko? Tindakan ini tidak dapat dibatalkan.`,
          tag: 'CATALOG // DELETE',
          icon: 'delete_forever',
          confirmText: 'Hapus Permanen',
          cancelText: 'Batal',
          isDanger: true
        });
        if (confirmed) {
          const delRes = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
          if (delRes.ok) {
            showCyberToast(`Produk "${name}" berhasil dihapus.`, 'success', 'Katalog Diperbarui');
            loadProducts();
          } else {
            showCyberToast('Gagal menghapus produk.', 'error', 'Kendala Operasi');
          }
        }
      });
    });
  } catch (err) {
    console.error('loadProducts error:', err);
  }
}

// Product Filters
document.querySelectorAll('#filter-product-game .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filter-product-game .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminState.productsFilter.game = btn.dataset.game;
    loadProducts();
  });
});

let searchProdDebounce;
document.getElementById('search-products-input')?.addEventListener('input', (e) => {
  clearTimeout(searchProdDebounce);
  searchProdDebounce = setTimeout(() => {
    adminState.productsFilter.search = e.target.value.trim();
    loadProducts();
  }, 350);
});

// Product Modal
function openProductModal(product = null) {
  const modal = document.getElementById('modal-product');
  const title = document.getElementById('modal-product-title');
  const idInput = document.getElementById('prod-form-id');
  const gameInput = document.getElementById('prod-form-game');
  const nameInput = document.getElementById('prod-form-name');
  const nominalInput = document.getElementById('prod-form-nominal');
  const priceInput = document.getElementById('prod-form-price');
  const activeInput = document.getElementById('prod-form-active');

  if (product) {
    title.innerText = 'Edit Produk';
    idInput.value = product.id;
    gameInput.value = product.game;
    nameInput.value = product.nama_item;
    nominalInput.value = product.nominal || '';
    priceInput.value = product.harga;
    activeInput.checked = Boolean(product.is_active);
  } else {
    title.innerText = 'Tambah Produk Baru';
    idInput.value = '';
    gameInput.value = 'mlbb';
    nameInput.value = '';
    nominalInput.value = '';
    priceInput.value = '';
    activeInput.checked = true;
  }

  modal.style.display = 'flex';
}

document.getElementById('btn-open-add-product')?.addEventListener('click', () => {
  openProductModal();
});

document.getElementById('form-product')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('prod-form-id').value;
  const game = document.getElementById('prod-form-game').value;
  const nama_item = document.getElementById('prod-form-name').value.trim();
  const nominal = document.getElementById('prod-form-nominal').value;
  const harga = document.getElementById('prod-form-price').value;
  const is_active = document.getElementById('prod-form-active').checked;

  const payload = { game, nama_item, nominal, harga, is_active };

  try {
    let res;
    if (id) {
      res = await adminFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await adminFetch('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(id ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!');
      document.getElementById('modal-product').style.display = 'none';
      loadProducts();
    } else {
      showToast(data.message || 'Gagal menyimpan produk', true);
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menyimpan produk', true);
  }
});

// ----------------------------------------------------------
// 3. ORDERS CONTROLLER
// ----------------------------------------------------------
async function loadOrders() {
  const { status, game, search, date_from, date_to } = adminState.ordersFilter;
  let url = `/api/admin/orders?status=${status}&game=${game}&limit=100`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (date_from) url += `&date_from=${date_from}`;
  if (date_to) url += `&date_to=${date_to}`;

  try {
    const res = await adminFetch(url);
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const tbody = document.getElementById('orders-tbody');
    if (data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Tidak ada data pesanan yang sesuai filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders.map(o => {
      const targetAcc = o.game === 'mlbb' ? `${o.game_user_id || '-'} (${o.server_id || '-'})` : (o.riot_id || '-');
      return `
        <tr>
          <td><strong class="text-blue">${o.invoice_number}</strong></td>
          <td class="text-muted">${formatDate(o.created_at)}</td>
          <td>
            <span class="badge-status ${o.game === 'valorant' ? 'badge-processing' : 'badge-pending'}">
              ${o.game === 'valorant' ? 'VALORANT' : 'MLBB'}
            </span>
          </td>
          <td><strong>${o.nama_item || '-'}</strong></td>
          <td><code>${targetAcc}</code></td>
          <td>${o.wa_email_guest || '-'}</td>
          <td><strong>${formatRupiah(o.total_harga)}</strong></td>
          <td>${getStatusBadge(o.status)}</td>
          <td>
            <div class="action-buttons-cell">
              <button class="btn-action-sm btn-act-blue btn-view-order" data-id="${o.id}">Detail</button>
              ${o.status !== 'Berhasil' && o.status !== 'Refunded' ? `<button class="btn-action-sm btn-act-green btn-complete-order" data-id="${o.id}">Selesai</button>` : ''}
              ${o.status === 'Gagal' || o.status === 'failed' ? `<button class="btn-action-sm btn-act-yellow btn-retry-order" data-id="${o.id}">Retry</button>` : ''}
              ${o.status !== 'Refunded' ? `<button class="btn-action-sm btn-act-red btn-cancel-order" data-id="${o.id}">Batal</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Order Buttons
    tbody.querySelectorAll('.btn-view-order').forEach(btn => {
      btn.addEventListener('click', () => openOrderDetailModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-complete-order').forEach(btn => {
      btn.addEventListener('click', () => handleCompleteOrder(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-retry-order').forEach(btn => {
      btn.addEventListener('click', () => handleRetryOrder(btn.dataset.id));
    });

    tbody.querySelectorAll('.btn-cancel-order').forEach(btn => {
      btn.addEventListener('click', () => handleCancelOrder(btn.dataset.id));
    });
  } catch (err) {
    console.error('loadOrders error:', err);
  }
}

// Order Filters
document.querySelectorAll('#filter-order-status .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filter-order-status .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    adminState.ordersFilter.status = btn.dataset.status;
    loadOrders();
  });
});

document.getElementById('filter-order-game')?.addEventListener('change', (e) => {
  adminState.ordersFilter.game = e.target.value;
  loadOrders();
});

document.getElementById('btn-apply-order-filters')?.addEventListener('click', () => {
  adminState.ordersFilter.date_from = document.getElementById('filter-order-date-from').value;
  adminState.ordersFilter.date_to = document.getElementById('filter-order-date-to').value;
  loadOrders();
});

let searchOrderDebounce;
document.getElementById('search-orders-input')?.addEventListener('input', (e) => {
  clearTimeout(searchOrderDebounce);
  searchOrderDebounce = setTimeout(() => {
    adminState.ordersFilter.search = e.target.value.trim();
    loadOrders();
  }, 400);
});

// Order Detail Modal
async function openOrderDetailModal(orderId) {
  try {
    const res = await adminFetch(`/api/admin/orders/${orderId}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('Gagal mengambil detail order', true);
      return;
    }

    const o = data.order;
    document.getElementById('detail-order-invoice').innerText = `#${o.invoice_number}`;
    document.getElementById('det-game').innerText = (o.game || '').toUpperCase();
    document.getElementById('det-item').innerText = o.nama_item || '-';
    document.getElementById('det-total').innerText = formatRupiah(o.total_harga);
    document.getElementById('det-status').innerHTML = getStatusBadge(o.status);
    document.getElementById('det-payment').innerText = o.payment_method || 'QRIS';
    document.getElementById('det-time').innerText = formatDate(o.created_at);

    document.getElementById('det-userid').innerText = o.game_user_id || '-';
    document.getElementById('det-server').innerText = o.server_id || '-';
    document.getElementById('det-riot').innerText = o.riot_id || '-';
    document.getElementById('det-contact').innerText = o.wa_email_guest || '-';
    document.getElementById('det-payref').innerText = o.payment_ref || '-';

    // Payment Logs
    const logTbody = document.getElementById('det-logs-tbody');
    if (data.payment_logs && data.payment_logs.length > 0) {
      logTbody.innerHTML = data.payment_logs.map(l => `
        <tr>
          <td>${formatDate(l.created_at)}</td>
          <td><code>${l.gateway_ref || '-'}</code></td>
          <td><span class="badge-status badge-success">${l.status}</span></td>
          <td><pre style="font-size:11px; max-height:80px; overflow:auto;">${JSON.stringify(l.raw_response, null, 2)}</pre></td>
        </tr>
      `).join('');
    } else {
      logTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Belum ada log callback pembayaran.</td></tr>`;
    }

    // Modal Actions
    const actContainer = document.getElementById('detail-modal-actions');
    actContainer.innerHTML = `
      <button class="btn-subtle" data-close="modal-order-detail">Tutup</button>
      ${o.status !== 'Berhasil' && o.status !== 'Refunded' ? `<button class="btn-action-sm btn-act-green" id="modal-btn-complete" style="padding:10px 16px;">Tandai Selesai Manual</button>` : ''}
    `;

    document.getElementById('modal-btn-complete')?.addEventListener('click', async () => {
      await handleCompleteOrder(o.id);
      document.getElementById('modal-order-detail').style.display = 'none';
    });

    document.getElementById('modal-order-detail').style.display = 'flex';
  } catch (err) {
    console.error('openOrderDetailModal error:', err);
  }
}

async function handleCompleteOrder(id) {
  const confirmed = await showCyberConfirm({
    title: 'Selesaikan Pesanan',
    message: 'Tandai transaksi ini sebagai BERHASIL dan tambahkan poin loyalitas jika pembeli terdaftar?',
    tag: 'TRANSACTION // COMPLETE',
    icon: 'verified',
    confirmText: 'Selesaikan Order',
    cancelText: 'Batal',
    isDanger: false
  });
  if (!confirmed) return;
  try {
    const res = await adminFetch(`/api/admin/orders/${id}/complete`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showCyberToast(data.message, 'success', 'Status Transaksi');
      loadOrders();
    } else {
      showCyberToast(data.message || 'Gagal menyelesaikan order', 'error', 'Kendala Transaksi');
    }
  } catch (err) {
    showCyberToast('Gagal memproses order', 'error', 'Kendala Transaksi');
  }
}

async function handleRetryOrder(id) {
  try {
    const res = await adminFetch(`/api/admin/orders/${id}/retry`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showCyberToast(data.message, 'success', 'Retry Sukses');
      loadOrders();
    } else {
      showCyberToast(data.message || 'Gagal me-retry order', 'error', 'Retry Gagal');
    }
  } catch (err) {
    showCyberToast('Gagal me-retry order', 'error', 'Retry Gagal');
  }
}

async function handleCancelOrder(id) {
  const reason = await showCyberPrompt({
    title: 'Batalkan / Refund Transaksi',
    message: 'Tuliskan alasan pembatalan untuk dicatat pada riwayat audit transaksi dan diinformasikan ke pembeli:',
    tag: 'TRANSACTION // REFUND',
    icon: 'cancel',
    label: 'ALASAN PEMBATALAN',
    placeholder: 'Contoh: Stok nominal habis / ID game tidak ditemukan',
    defaultValue: 'Dibatalkan oleh Admin',
    confirmText: 'Proses Pembatalan',
    cancelText: 'Batal'
  });
  if (!reason) return;
  try {
    const res = await adminFetch(`/api/admin/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showCyberToast(data.message, 'warning', 'Pesanan Dibatalkan');
      loadOrders();
    } else {
      showCyberToast(data.message || 'Gagal membatalkan order', 'error', 'Pembatalan Gagal');
    }
  } catch (err) {
    showCyberToast('Gagal membatalkan order', 'error', 'Pembatalan Gagal');
  }
}

// ----------------------------------------------------------
// 4. USERS CONTROLLER
// ----------------------------------------------------------
async function loadUsers() {
  try {
    const res = await adminFetch('/api/admin/users');
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const tbody = document.getElementById('users-tbody');
    if (data.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Belum ada pengguna terdaftar.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${u.nama}</strong></td>
        <td>${u.email || '-'}</td>
        <td>${u.whatsapp || '-'}</td>
        <td><strong class="text-blue">⭐ ${u.points || 0}</strong></td>
        <td>${u.total_orders || 0} order</td>
        <td>${formatRupiah(u.total_spend)}</td>
        <td>
          <span class="badge-status ${u.role === 'admin' ? 'badge-processing' : 'badge-pending'}">
            ${(u.role || 'user').toUpperCase()}
          </span>
        </td>
        <td>
          <span class="badge-status ${u.is_blocked ? 'badge-failed' : 'badge-success'}">
            ${u.is_blocked ? 'Diblokir' : 'Aktif'}
          </span>
        </td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-action-sm btn-act-blue btn-adjust-points" data-id="${u.id}" data-name="${u.nama}" data-points="${u.points}">Atur Poin</button>
            <button class="btn-action-sm ${u.is_blocked ? 'btn-act-green' : 'btn-act-red'} btn-toggle-block" data-id="${u.id}" data-blocked="${u.is_blocked}">
              ${u.is_blocked ? 'Buka Blokir' : 'Blokir'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind User Buttons
    tbody.querySelectorAll('.btn-adjust-points').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('adjust-user-id').value = btn.dataset.id;
        document.getElementById('adjust-user-name').innerText = `${btn.dataset.name} (Saldo saat ini: ${btn.dataset.points} poin)`;
        document.getElementById('adjust-points-amount').value = '';
        document.getElementById('adjust-points-reason').value = '';
        document.getElementById('modal-adjust-points').style.display = 'flex';
      });
    });

    tbody.querySelectorAll('.btn-toggle-block').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const isBlocked = btn.dataset.blocked === '1' || btn.dataset.blocked === 'true';
        const actionText = isBlocked ? 'Buka Blokir' : 'Blokir';
        const confirmed = await showCyberConfirm({
          title: `${actionText} Akses Pengguna`,
          message: `Apakah Anda yakin ingin ${isBlocked ? 'membuka blokir' : 'MEMBLOKIR'} akun pengguna ini dari toko?`,
          tag: 'ACCESS CONTROL // USER',
          icon: isBlocked ? 'lock_open' : 'block',
          confirmText: isBlocked ? 'Buka Blokir' : 'Blokir Pengguna',
          cancelText: 'Batal',
          isDanger: !isBlocked
        });
        if (confirmed) {
          const res = await adminFetch(`/api/admin/users/${id}/toggle-block`, { method: 'POST' });
          const d = await res.json();
          if (res.ok && d.success) {
            showCyberToast(d.message, isBlocked ? 'success' : 'warning', 'Status Pengguna');
            loadUsers();
          } else {
            showCyberToast(d.message || 'Gagal mengubah status blokir', 'error', 'Kendala Akses');
          }
        }
      });
    });
  } catch (err) {
    console.error('loadUsers error:', err);
  }
}

document.getElementById('form-adjust-points')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('adjust-user-id').value;
  const amount = document.getElementById('adjust-points-amount').value;
  const reason = document.getElementById('adjust-points-reason').value.trim();

  try {
    const res = await adminFetch(`/api/admin/users/${id}/points/adjust`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message);
      document.getElementById('modal-adjust-points').style.display = 'none';
      loadUsers();
    } else {
      showToast(data.message || 'Gagal menyesuaikan poin', true);
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menyesuaikan poin', true);
  }
});

// ----------------------------------------------------------
// 5. PAYMENT & PROVIDER SETTINGS
// ----------------------------------------------------------
async function loadPaymentSettings() {
  try {
    const res = await adminFetch('/api/admin/payment-settings');
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('pay-gateway-name').innerText = data.gateway;
      document.getElementById('pay-mode').innerText = data.mode;
      document.getElementById('pay-merchant-code').innerText = data.merchant_code;
      document.getElementById('pay-api-key').innerText = data.api_key_masked;
    }
  } catch (err) {
    console.error('loadPaymentSettings error:', err);
  }
}

async function loadProviderBalance() {
  try {
    const res = await adminFetch('/api/admin/provider/balance');
    const data = await res.json();
    if (res.ok && data.success) {
      const formatted = formatRupiah(data.balance);
      const valEl = document.getElementById('provider-balance-val');
      if (valEl) valEl.innerText = formatted;
      const headEl = document.getElementById('header-provider-balance');
      if (headEl) headEl.innerText = formatted;
    }
  } catch (err) {
    console.error('loadProviderBalance error:', err);
  }
}

// ----------------------------------------------------------
// 6. REPORTS & EXPORT
// ----------------------------------------------------------
async function loadReports() {
  try {
    const res = await adminFetch('/api/admin/reports');
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('report-total-rev').innerText = formatRupiah(data.totalRevenue);
      document.getElementById('report-ml-rev').innerText = formatRupiah(data.breakdown.mlbb.revenue);
      document.getElementById('report-ml-count').innerText = data.breakdown.mlbb.count;
      document.getElementById('report-valo-rev').innerText = formatRupiah(data.breakdown.valorant.revenue);
      document.getElementById('report-valo-count').innerText = data.breakdown.valorant.count;
    }
  } catch (err) {
    console.error('loadReports error:', err);
  }
}

document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  window.open(`/api/admin/reports/export?token=${token}`, '_blank');
});

// ----------------------------------------------------------
// 7. AUDIT TRAIL LOGS
// ----------------------------------------------------------
async function loadLogs() {
  try {
    const res = await adminFetch('/api/admin/logs');
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const tbody = document.getElementById('logs-tbody');
    if (data.logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada riwayat audit log.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.logs.map(l => `
      <tr>
        <td class="text-muted">${formatDate(l.created_at)}</td>
        <td><strong>${l.admin_name || l.admin_email || 'Admin'}</strong></td>
        <td><span class="badge-status badge-processing">${l.action}</span></td>
        <td><code>${l.target_type} #${l.target_id}</code></td>
        <td><pre style="font-size:11px; margin:0; max-height:60px; overflow:auto;">${JSON.stringify(l.detail, null, 2)}</pre></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadLogs error:', err);
  }
}

// ----------------------------------------------------------
// 8. GENERAL STORE SETTINGS
// ----------------------------------------------------------
async function loadSettings() {
  try {
    const res = await adminFetch('/api/admin/settings');
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('set-store-name').value = data.settings.store_name || "Dar'sstore";
      document.getElementById('set-cs-wa').value = data.settings.cs_whatsapp || '081234567890';
      document.getElementById('set-cs-email').value = data.settings.cs_email || 'support@darstore.com';
    }
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

document.getElementById('general-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const store_name = document.getElementById('set-store-name').value.trim();
  const cs_whatsapp = document.getElementById('set-cs-wa').value.trim();
  const cs_email = document.getElementById('set-cs-email').value.trim();

  try {
    const res = await adminFetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ store_name, cs_whatsapp, cs_email })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Pengaturan umum toko berhasil diperbarui!');
    } else {
      showToast(data.message || 'Gagal menyimpan pengaturan', true);
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menyimpan pengaturan', true);
  }
});

// Modal close button helpers
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.close;
    const modal = document.getElementById(targetId);
    if (modal) modal.style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-modal')) {
    e.target.style.display = 'none';
  }
});

// Boot check auth
checkAuth();
