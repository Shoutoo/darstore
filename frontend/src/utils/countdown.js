/**
 * Live Countdown Timer for Midtrans QRIS payment modal
 */
let timerInterval = null;

export function startQrisCountdown(elementId, expiredAt) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  let targetTime;
  if (expiredAt) {
    const parsed = new Date(expiredAt).getTime();
    targetTime = isNaN(parsed) ? Date.now() + 15 * 60 * 1000 : parsed;
  } else {
    targetTime = Date.now() + 15 * 60 * 1000;
  }

  function update() {
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      el.textContent = '00:00 (Kadaluwarsa)';
      el.style.color = '#ef4444';
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  update();
  timerInterval = setInterval(update, 1000);
}

export function stopQrisCountdown() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}
