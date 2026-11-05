import { apiFetch } from './client.js';

export async function checkMLAccount(userId, serverId) {
  const params = new URLSearchParams({
    user_id: String(userId || '').trim(),
    server_id: String(serverId || '').trim()
  });
  const res = await apiFetch(`/api/orders/check-ml-account?${params.toString()}`);
  return res.json();
}

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
