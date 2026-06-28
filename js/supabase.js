import { CONFIG } from './config.js';

const SUPA_URL = CONFIG.SUPABASE_URL;
const SUPA_KEY = CONFIG.SUPABASE_ANON_KEY;

function headers(token) {
  const h = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token || SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  return h;
}

export const supabase = {
  // Auth
  async signUp(email, password) {
    const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async signOut(token) {
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST', headers: headers(token)
    }).catch(() => {});
  },

  async resetPassword(email) {
    const res = await fetch(`${SUPA_URL}/auth/v1/recover`, {
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
    if (query.eq) Object.entries(query.eq).forEach(([k, v]) => params.push(`${k}=eq.${v}`));
    if (query.neq) Object.entries(query.neq).forEach(([k, v]) => params.push(`${k}=neq.${v}`));
    if (query.gte) Object.entries(query.gte).forEach(([k, v]) => params.push(`${k}=gte.${v}`));
    if (query.lte) Object.entries(query.lte).forEach(([k, v]) => params.push(`${k}=lte.${v}`));
    if (query.like) Object.entries(query.like).forEach(([k, v]) => params.push(`${k}=ilike.*${v}*`));
    if (query.order) params.push(`order=${query.order}`);
    if (query.limit) params.push(`limit=${query.limit}`);
    url += params.join('&');
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) return [];
    return res.json();
  },

  async insert(table, data) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const body = Array.isArray(data) ? data : [data];
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: 'POST', headers: headers(token), body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); return { error: err.message || 'Insert failed' }; }
    const result = await res.json();
    return Array.isArray(data) ? result : result[0];
  },

  async update(table, id, data) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH', headers: headers(token), body: JSON.stringify(data)
    });
    if (!res.ok) return { error: 'Update failed' };
    const result = await res.json();
    return result[0] || { success: true };
  },

  async delete(table, id) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE', headers: headers(token)
    });
  },

  async deleteWhere(table, eq) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const params = Object.entries(eq).map(([k, v]) => `${k}=eq.${v}`).join('&');
    await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {
      method: 'DELETE', headers: headers(token)
    });
  },

  async rpc(fn, params = {}) {
    const token = sessionStorage.getItem('sb_token') || SUPA_KEY;
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: headers(token), body: JSON.stringify(params)
    });
    return res.json();
  }
};
