import { apiFetch } from './client.js';

export async function getProducts(game) {
  const query = game ? `?game=${encodeURIComponent(game)}` : '';
  const res = await apiFetch(`/api/products${query}`);
  return res.json();
}
