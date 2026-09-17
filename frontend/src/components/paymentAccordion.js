import { PAYMENT_GROUPS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';

export function renderPaymentAccordion(containerId, gameKey, appState, onPaymentSelect) {
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
      if (typeof onPaymentSelect === 'function') {
        onPaymentSelect(gameKey);
      }
    });
  });
}
