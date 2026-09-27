import { apiFetch } from './client.js';

export async function getRewardsList() {
  const res = await apiFetch('/api/rewards');
  return res.json();
}

export async function redeemRewardItem(rewardId, payload) {
  const res = await apiFetch(`/api/rewards/${rewardId}/redeem`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function getMyRedemptions() {
  const res = await apiFetch('/api/rewards/my-claims');
  return res.json();
}
