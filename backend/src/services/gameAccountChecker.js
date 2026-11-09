/**
 * Service to verify Mobile Legends (MLBB) game accounts and retrieve real-time in-game Nicknames.
 * Uses a resilient multi-provider upstream inquiry chain (GoPay Games, Mobapay Official Partner, Isan)
 * with in-memory caching to ensure instant responses, zero Digiflazz balance consumption,
 * and high availability across both local environments and Vercel serverless.
 */

// In-memory cache for fast lookups and upstream rate-protection
const accountCache = new Map();
const CACHE_TTL_VALID = 15 * 60 * 1000; // 15 minutes for valid accounts
const CACHE_TTL_INVALID = 2 * 60 * 1000; // 2 minutes for not found

function getCachedResult(key) {
  const cached = accountCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    accountCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCachedResult(key, data, isValid) {
  const ttl = isValid ? CACHE_TTL_VALID : CACHE_TTL_INVALID;
  accountCache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });

  // Keep cache size bounded
  if (accountCache.size > 1000) {
    const oldestKey = accountCache.keys().next().value;
    accountCache.delete(oldestKey);
  }
}

/**
 * Check Mobile Legends account by User ID and Zone/Server ID
 * @param {string} userId - 6 to 10 digit Mobile Legends User ID
 * @param {string} serverId - 3 to 5 digit Mobile Legends Zone/Server ID
 * @returns {Promise<{success: boolean, valid: boolean|null, nickname?: string, status?: string, message?: string}>}
 */
async function checkMLAccount(userId, serverId) {
  const uid = String(userId || '').trim();
  const srv = String(serverId || '').trim();

  if (!uid || !srv) {
    return {
      success: false,
      valid: false,
      status: 'invalid_input',
      message: 'User ID dan Server ID Mobile Legends wajib diisi.'
    };
  }

  if (!/^\d{6,10}$/.test(uid)) {
    return {
      success: false,
      valid: false,
      status: 'invalid_format',
      message: 'User ID tidak valid (harus 6-10 digit angka). Contoh: 123456789'
    };
  }

  if (!/^\d{3,5}$/.test(srv)) {
    return {
      success: false,
      valid: false,
      status: 'invalid_format',
      message: 'Server / Zone ID tidak valid (harus 3-5 digit angka). Contoh: 2114'
    };
  }

  const cacheKey = `mlbb:${uid}:${srv}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // 1. Primary Upstream: GoPay Games API (~200ms)
  try {
    const res = await fetch('https://gopay.co.id/games/v1/order/user-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        code: 'MOBILE_LEGENDS',
        data: { userId: uid, zoneId: srv }
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (res.status === 201) {
      const data = await res.json();
      const raw = data.data?.username || '';
      let nickname = raw;
      try {
        nickname = decodeURIComponent(raw.replace(/\+/g, ' '));
      } catch (_) {}

      if (nickname) {
        const result = {
          success: true,
          valid: true,
          nickname,
          user_id: uid,
          server_id: srv,
          source: 'gopay'
        };
        setCachedResult(cacheKey, result, true);
        return result;
      }
    }

    if (res.status === 404) {
      const notFoundResult = {
        success: true,
        valid: false,
        status: 'not_found',
        message: 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.'
      };
      setCachedResult(cacheKey, notFoundResult, false);
      return notFoundResult;
    }
  } catch (err) {
    // Failover to secondary provider
  }

  // 2. Secondary Upstream: Mobapay (Official Moonton Top-Up Partner, ~350ms)
  try {
    const url = `https://api.mobapay.com/api/app_shop?app_id=100000&user_id=${encodeURIComponent(uid)}&server_id=${encodeURIComponent(srv)}&country=ID&language=en`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const json = await res.json();
      const userInfo = json?.data?.user_info;
      if (userInfo && userInfo.code === 0 && userInfo.user_name) {
        const result = {
          success: true,
          valid: true,
          nickname: userInfo.user_name,
          user_id: uid,
          server_id: srv,
          source: 'mobapay'
        };
        setCachedResult(cacheKey, result, true);
        return result;
      }

      if (userInfo && userInfo.code === -1) {
        const notFoundResult = {
          success: true,
          valid: false,
          status: 'not_found',
          message: 'Akun Mobile Legends dengan User ID dan Server tersebut tidak terdaftar / tidak ditemukan.'
        };
        setCachedResult(cacheKey, notFoundResult, false);
        return notFoundResult;
      }
    }
  } catch (err) {
    // Failover to tertiary provider
  }

  // 3. Tertiary Upstream: Isan Public MLBB Checker
  try {
    const url = `https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(uid)}&zone=${encodeURIComponent(srv)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.name) {
        const result = {
          success: true,
          valid: true,
          nickname: json.name,
          user_id: uid,
          server_id: srv,
          source: 'isan'
        };
        setCachedResult(cacheKey, result, true);
        return result;
      }
    }
  } catch (err) {
    // All providers exhausted
  }

  return {
    success: false,
    valid: null,
    status: 'service_unavailable',
    message: 'Layanan verifikasi nickname sedang sibuk. Mohon periksa kembali User ID dan Server Anda secara manual.'
  };
}

module.exports = {
  checkMLAccount,
  _accountCache: accountCache
};

