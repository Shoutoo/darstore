const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jsmzphtxkmgwsjffxtqj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[SUPABASE] Initialized Supabase Cloud Client for project: ' + (process.env.SUPABASE_PROJECT_REF || 'jsmzphtxkmgwsjffxtqj'));
  } catch (err) {
    console.warn('[SUPABASE] Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log('[SUPABASE] Supabase credentials not configured in environment.');
}

module.exports = { supabase };
