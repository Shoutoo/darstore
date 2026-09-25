import { apiFetch } from './client.js';

/**
 * Fetch leaderboard data from backend
 * @param {Object} options
 * @param {string} options.period - 'today' | 'week' | 'month' | 'all'
 * @param {string} options.sortBy - 'amount' (top spender) | 'count' (most transactions)
 * @param {string} options.game - 'all' | 'mlbb' | 'valorant'
 * @param {number} options.limit - number of ranks to fetch (default: 10)
 */
export async function getLeaderboard({
  period = 'all',
  sortBy = 'amount',
  game = 'all',
  limit = 10
} = {}) {
  const params = new URLSearchParams({
    period,
    sortBy,
    game,
    limit: String(limit)
  });

  const res = await apiFetch(`/api/leaderboard?${params.toString()}`);
  return res.json();
}
