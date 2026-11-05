import { PAYMENT_GROUPS } from '../data/index.js';
import { formatRupiah } from '../utils/format.js';

function renderFeeLabel(fee, basePrice = 0) {
  const numFee = Number(fee) || 0;
  if (numFee === 0) {
    return basePrice > 0
      ? `<span style="color: #34d399; font-weight: 700;">Gratis Admin</span> <span style="color: var(--text-muted); font-size: 11px;">(${formatRupiah(basePrice)})</span>`
      : `<span style="color: #34d399; font-weight: 700;">Gratis Admin</span>`;
  }
  return basePrice > 0
    ? `<span style="color: #fbbf24; font-weight: 700;">Tambahan Admin +${formatRupiah(numFee)}</span> <span style="color: var(--text-primary); font-size: 11px; font-weight: 600;">(Total ${formatRupiah(basePrice + numFee)})</span>`
    : `<span style="color: #fbbf24; font-weight: 700;">Tambahan Admin +${formatRupiah(numFee)}</span>`;
}

export function updatePaymentAccordionPrices(containerId, basePrice = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.payment-method-card').forEach(card => {
    if (card.dataset.isDemo === 'true') return;
    const priceEl = card.querySelector('.payment-method-price');
    if (!priceEl) return;
    const fee = Number(priceEl.dataset.fee) || 0;
    priceEl.innerHTML = renderFeeLabel(fee, basePrice);
  });
}

export function renderPaymentAccordion(containerId, gameKey, appState, onPaymentSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentNominal = appState[gameKey]?.selectedNominal;
  const currentQty = gameKey === 'ml' ? (appState[gameKey]?.qty || 1) : 1;
  const currentBasePrice = currentNominal ? (Number(currentNominal.price) || 0) * currentQty : 0;

  container.innerHTML = PAYMENT_GROUPS.map((group) => `
    <div class="payment-group expanded ${group.isDemo ? 'group-qris-demo' : 'group-va-active'}" data-group-id="${group.id}">
      <div class="payment-group-header">
        <div class="payment-group-title">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 700;">${group.title}</span>
            <span class="payment-status-badge ${group.isDemo ? 'badge-demo' : 'badge-available'}">
              ${group.badge}
            </span>
          </div>
          <div class="payment-group-desc" style="font-size: 12px; color: var(--text-muted); font-weight: 400; margin-top: 2px;">
            ${group.description}
          </div>
        </div>
        <div class="payment-header-right">
          <div class="payment-header-preview">
            ${group.methods.slice(0, 5).map(m => `<img src="${m.image}" alt="${m.name}" style="${group.isDemo ? 'border: 1px dashed rgba(239,68,68,0.5);' : ''}" />`).join('')}
          </div>
          <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
      <div class="payment-methods-grid">
        ${group.methods.map(method => `
          <div class="payment-method-card ${method.isDemo ? 'card-demo-method' : ''}" 
               data-method-id="${method.id}" 
               data-group-id="${group.id}" 
               data-is-demo="${Boolean(method.isDemo)}">
            <img src="${method.image}" alt="${method.name}" class="payment-method-logo" style="${method.isDemo ? 'filter: drop-shadow(0 0 4px rgba(239,68,68,0.3));' : ''}" />
            <div class="payment-method-info">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="payment-method-name">${method.name}</span>
                ${method.isDemo ? '<span class="badge-demo-chip">DEMO</span>' : ''}
              </div>
              <span class="payment-method-price" data-fee="${method.fee}">
                ${method.isDemo ? '<span style="color: #f87171; font-size: 11px; font-weight: 700;">Pratinjau (Belum Aktif)</span>' : renderFeeLabel(method.fee, currentBasePrice)}
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

  // Select payment method or trigger QRIS demo modal
  container.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const isDemo = card.dataset.isDemo === 'true';
      const methodId = card.dataset.methodId;

      if (isDemo) {
        // PERINGATAN KEAMANAN: QRIS Demo BUKAN opsi pembayaran nyata.
        // Tampilkan modal pratinjau edukatif informasional tanpa mengubah form checkout.
        if (typeof window.openQrisDemoModal === 'function') {
          window.openQrisDemoModal(gameKey);
        }
        return;
      }

      // Pembayaran Virtual Account nyata
      container.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      for (const grp of PAYMENT_GROUPS) {
        const found = grp.methods.find(m => m.id === methodId);
        if (found && !found.isDemo) {
          appState[gameKey].selectedPayment = found;
          break;
        }
      }
      if (typeof onPaymentSelect === 'function') {
        onPaymentSelect(gameKey);
      }
    });
  });

  // Default selection: select the first active Virtual Account method if none selected
  if (!appState[gameKey].selectedPayment || appState[gameKey].selectedPayment.isDemo) {
    const firstVaGroup = PAYMENT_GROUPS.find(g => !g.isDemo);
    if (firstVaGroup && firstVaGroup.methods.length > 0) {
      const defaultMethod = firstVaGroup.methods[0];
      appState[gameKey].selectedPayment = defaultMethod;
      const defaultCard = container.querySelector(`[data-method-id="${defaultMethod.id}"]`);
      if (defaultCard) {
        defaultCard.classList.add('selected');
      }
    }
  } else {
    const selectedId = appState[gameKey].selectedPayment.id;
    const selectedCard = container.querySelector(`[data-method-id="${selectedId}"]`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }
  }
}
