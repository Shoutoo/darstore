import { apiFetch } from './client.js';

export async function createOrder(orderPayload) {
  const res = await apiFetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderPayload)
  });
  return res.json();
}

export async function searchInvoice(invoiceNumber) {
  const res = await apiFetch(`/api/orders/track/${encodeURIComponent(invoiceNumber)}`);
  return res.json();
}

export async function getRecentOrders() {
  const res = await apiFetch('/api/orders/public/recent');
  return res.json();
}

export async function simulatePayment(invoiceNumber) {
  const res = await apiFetch('/api/webhook/simulate-payment', {
    method: 'POST',
    body: JSON.stringify({ invoice_number: invoiceNumber })
  });
  return res.json();
}
