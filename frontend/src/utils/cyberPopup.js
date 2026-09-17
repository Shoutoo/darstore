// ==========================================================
// DAR'SSTORE CYBER POPUP & TOAST SYSTEM (STOREFRONT & GLOBAL)
// ==========================================================

export function getCyberSvgIcon(name, size = 20) {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const n = (name || '').toLowerCase();
  if (n.includes('check') || n.includes('success') || n.includes('verified')) {
    return `<svg ${s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  }
  if (n.includes('trash') || n.includes('delete')) {
    return `<svg ${s}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  }
  if (n.includes('warn') || n.includes('alert-triangle') || n.includes('perhatian')) {
    return `<svg ${s}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  }
  if (n.includes('error') || n.includes('cancel') || n.includes('gagal') || n.includes('close')) {
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

export function showCyberToast(message, type = 'info', title = '', duration = 3800) {
  let container = document.getElementById('storefront-toast-container') || document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'storefront-toast-container';
    document.body.appendChild(container);
  }

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
      defaultTitle: 'Perhatian',
      icon: 'warning',
      className: 'toast-warning'
    },
    info: {
      tag: 'NOTICE // INFO',
      defaultTitle: "Dar'sstore",
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
      <span class="cyber-toast-tag">
        <span class="cyber-toast-tag-dot"></span>
        ${config.tag}
      </span>
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

export function showCyberConfirm({
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  tag = '',
  icon = '',
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById('modal-cyber-dialog');
    if (!modal) {
      // Create dynamically if not present
      modal = document.createElement('div');
      modal.id = 'modal-cyber-dialog';
      modal.className = 'cyber-dialog-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="cyber-dialog-card" id="cyber-dialog-card">
          <div class="cyber-dialog-top-accent"></div>
          <div class="cyber-dialog-top-row">
            <div class="cyber-dialog-header-tag" id="cyber-dialog-tag">
              <span class="cyber-dialog-tag-dot"></span>
              <span id="cyber-dialog-tag-text">SYSTEM // CONFIRMATION</span>
            </div>
            <button type="button" class="cyber-dialog-close" id="btn-cyber-dialog-close">&times;</button>
          </div>
          <div class="cyber-dialog-icon-wrapper" id="cyber-dialog-icon-box"></div>
          <h3 class="cyber-dialog-title" id="cyber-dialog-title">Konfirmasi Tindakan</h3>
          <p class="cyber-dialog-message" id="cyber-dialog-message"></p>
          <div class="cyber-dialog-prompt-box" id="cyber-dialog-prompt-container" style="display: none;">
            <label for="cyber-dialog-input" id="cyber-dialog-input-label">MASUKKAN KETERANGAN</label>
            <input type="text" id="cyber-dialog-input" class="cyber-dialog-prompt-input" autocomplete="off">
          </div>
          <div class="cyber-dialog-actions">
            <button type="button" class="btn-dialog-cancel" id="btn-cyber-dialog-cancel">Batal</button>
            <button type="button" class="btn-dialog-confirm" id="btn-cyber-dialog-confirm">
              <span id="cyber-dialog-confirm-text">Konfirmasi</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const card = modal.querySelector('#cyber-dialog-card');
    const tagEl = modal.querySelector('#cyber-dialog-tag-text');
    const iconBox = modal.querySelector('#cyber-dialog-icon-box');
    const titleEl = modal.querySelector('#cyber-dialog-title');
    const msgEl = modal.querySelector('#cyber-dialog-message');
    const promptContainer = modal.querySelector('#cyber-dialog-prompt-container');
    const confirmBtn = modal.querySelector('#btn-cyber-dialog-confirm');
    const confirmTextEl = modal.querySelector('#cyber-dialog-confirm-text');
    const cancelBtn = modal.querySelector('#btn-cyber-dialog-cancel');
    const closeBtn = modal.querySelector('#btn-cyber-dialog-close');

    if (isDanger) {
      card?.classList.add('is-danger');
      confirmBtn?.classList.add('is-danger');
    } else {
      card?.classList.remove('is-danger');
      confirmBtn?.classList.remove('is-danger');
    }

    if (tagEl) tagEl.textContent = tag || (isDanger ? 'SECURITY // CONFIRMATION' : 'SYSTEM // CONFIRMATION');
    if (iconBox) iconBox.innerHTML = getCyberSvgIcon(icon || (isDanger ? 'warning' : 'help'), 28);
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (confirmTextEl) confirmTextEl.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;
    if (promptContainer) promptContainer.style.display = 'none';

    modal.style.display = 'flex';

    let resolved = false;
    const cleanupAndResolve = (result) => {
      if (resolved) return;
      resolved = true;
      modal.style.display = 'none';
      confirmBtn?.removeEventListener('click', onConfirm);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
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

    confirmBtn?.addEventListener('click', onConfirm);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    window.addEventListener('keydown', onKeyDown);
  });
}

// Global Browser Alert Hook
// Automatically redirects any native window.alert to gorgeous Cyber Toast
if (typeof window !== 'undefined') {
  window.showCyberToast = showCyberToast;
  window.showCyberConfirm = showCyberConfirm;

  // Seamlessly convert native alert calls into Cyber Toasts
  const _originalAlert = window.alert;
  window.alert = function (msg) {
    if (typeof msg === 'string') {
      const isErr = /gagal|error|tidak|bukan|salah|minimal/i.test(msg);
      const isWarn = /silakan|masukkan|pilih|periksa|wajib/i.test(msg);
      const isSuccess = /berhasil|sukses|selamat/i.test(msg);
      const type = isErr ? 'error' : (isWarn ? 'warning' : (isSuccess ? 'success' : 'info'));
      const title = isErr ? 'Gagal Memproses' : (isWarn ? 'Perhatian' : (isSuccess ? 'Berhasil' : "Dar'sstore"));
      showCyberToast(msg, type, title);
    } else {
      showCyberToast(String(msg), 'info', "Dar'sstore");
    }
  };
}
