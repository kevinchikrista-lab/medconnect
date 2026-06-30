import { CONFIG } from './config.js';

const SUPA_URL = CONFIG.SUPABASE_URL;
const SUPA_KEY = CONFIG.SUPABASE_ANON_KEY;
const TIMEOUT_MS = 6000;

function headers(token) {
  const h = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token || SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  return h;
}

// Wraps fetch with a hard timeout so a flaky connection falls back to local
// data quickly instead of hanging indefinitely.
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = {
  // Auth
  async signUp(email, password) {
    const res = await fetchWithTimeout(`${SUPA_URL}/auth/v1/signup`, {
      method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async signIn(email, password) {
    const res = await fetchWithTimeout(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async signOut(token) {
    await fetchWithTimeout(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST', headers: headers(token)
    }).catch(() => {});
  },

  async resetPassword(email) {
    const res = await fetchWithTimeout(`${SUPA_URL}/auth/v1/recover`, {
      method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  // Generic CRUD
  async select(table, query = {}) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    let url = `${SUPA_URL}/rest/v1/${table}?`;
    const params = [];
    if (query.select) params.push(`select=${query.select}`);
    else params.push('select=*');
    if (query.eq) Object.entries(query.eq).forEach(([k, v]) => params.push(`${k}=eq.${encodeURIComponent(v)}`));
    if (query.neq) Object.entries(query.neq).forEach(([k, v]) => params.push(`${k}=neq.${encodeURIComponent(v)}`));
    if (query.gte) Object.entries(query.gte).forEach(([k, v]) => params.push(`${k}=gte.${encodeURIComponent(v)}`));
    if (query.lte) Object.entries(query.lte).forEach(([k, v]) => params.push(`${k}=lte.${encodeURIComponent(v)}`));
    if (query.like) Object.entries(query.like).forEach(([k, v]) => params.push(`${k}=ilike.*${encodeURIComponent(v)}*`));
    if (query.order) params.push(`order=${query.order}`);
    if (query.limit) params.push(`limit=${query.limit}`);
    url += params.join('&');
    try {
      const res = await fetchWithTimeout(url, { headers: headers(token) });
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  },

  async insert(table, data) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const body = Array.isArray(data) ? data : [data];
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/${table}`, {
        method: 'POST', headers: headers(token), body: JSON.stringify(body)
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); return { error: err.message || 'Insert failed' }; }
      const result = await res.json();
      return Array.isArray(data) ? result : result[0];
    } catch (e) { return { error: e.message || 'Network error' }; }
  },

  async update(table, id, data) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH', headers: headers(token), body: JSON.stringify(data)
      });
      if (!res.ok) return { error: 'Update failed' };
      const result = await res.json();
      return result[0] || { success: true };
    } catch (e) { return { error: e.message || 'Network error' }; }
  },

  async delete(table, id) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    await fetchWithTimeout(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE', headers: headers(token)
    }).catch(() => {});
  },

  async deleteWhere(table, eq) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const params = Object.entries(eq).map(([k, v]) => `${k}=eq.${v}`).join('&');
    await fetchWithTimeout(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      method: 'DELETE', headers: headers(token)
    }).catch(() => {});
  },

  async rpc(fn, params = {}) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    try {
      const res = await fetchWithTimeout(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: headers(token), body: JSON.stringify(params)
      });
      return res.json();
    } catch (e) { return { error: e.message || 'Network error' }; }
  }
};
