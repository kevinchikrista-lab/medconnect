// Tes koneksi ke SATUSEHAT Sandbox -- BUKAN pengiriman data pasien.
//
// Cuma membuktikan tiga hal: client_id & client_secret yang tersimpan di
// Supabase itu benar, prosesnya bisa login (dapat access_token), dan
// tokennya bisa dipakai membaca kembali data Organization milik klinik
// sendiri di SATUSEHAT. Tidak ada data pasien yang disentuh sama sekali --
// ini murni "apakah pintunya bisa dibuka", bukan "kirim isinya".
//
// client_id/client_secret TIDAK PERNAH melewati browser. Yang dipanggil dari
// MedConnect cuma nama fungsi ini; kredensialnya dibaca di sini, dari
// Supabase Secrets (Project Settings -> Edge Functions -> Secrets), dan
// tidak pernah dikembalikan ke pemanggil dalam bentuk apa pun.
//
// Deploy: Supabase Dashboard -> Edge Functions -> buat fungsi baru bernama
// "satusehat-sandbox-test" -> tempel isi berkas ini -> Deploy.
// Secrets yang wajib diisi (Project Settings -> Edge Functions -> Secrets):
//   SATUSEHAT_SANDBOX_CLIENT_ID
//   SATUSEHAT_SANDBOX_CLIENT_SECRET
//   SATUSEHAT_SANDBOX_ORG_ID
// (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah otomatis tersedia di tiap
// Edge Function -- tidak perlu diisi manual.)

const SANDBOX_OAUTH_URL = 'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken?grant_type=client_credentials';
const SANDBOX_FHIR_BASE = 'https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Siapa yang memanggil ini. Supabase sudah menolak token yang tidak valid
  // sebelum kode ini jalan (verify_jwt bawaan) -- di sini diperiksa lagi
  // perannya: cuma pemilik klinik / Super Admin yang boleh memicu tes ini,
  // supaya kredensialnya tidak bisa dipakai iseng dari akun lain.
  const authHeader = req.headers.get('Authorization') || '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!userToken || !SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: 'Sesi login tidak valid. Coba muat ulang halaman dan login lagi.' }, 401);
  }

  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${userToken}` },
    });
    if (!meRes.ok) return json({ error: 'Sesi login tidak valid. Coba muat ulang halaman dan login lagi.' }, 401);
    const me = await meRes.json();

    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?auth_id=eq.${me.id}&select=role`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    const prof = await profRes.json().catch(() => []);
    const role = Array.isArray(prof) && prof[0] ? prof[0].role : null;
    if (role !== 'owner' && role !== 'superadmin') {
      return json({ error: 'Hanya pemilik klinik / Super Admin yang boleh menjalankan tes ini.' }, 403);
    }
  } catch (e) {
    return json({ error: 'Tidak bisa memeriksa sesi login: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }

  const clientId = Deno.env.get('SATUSEHAT_SANDBOX_CLIENT_ID');
  const clientSecret = Deno.env.get('SATUSEHAT_SANDBOX_CLIENT_SECRET');
  const orgId = Deno.env.get('SATUSEHAT_SANDBOX_ORG_ID');
  if (!clientId || !clientSecret || !orgId) {
    return json({
      error: 'Kredensial SATUSEHAT Sandbox belum diatur di Supabase. '
        + 'Buka Project Settings -> Edge Functions -> Secrets, lalu isi '
        + 'SATUSEHAT_SANDBOX_CLIENT_ID, SATUSEHAT_SANDBOX_CLIENT_SECRET, dan SATUSEHAT_SANDBOX_ORG_ID.',
    }, 400);
  }

  // Langkah 1: login ke SATUSEHAT, minta access_token.
  let accessToken = '';
  try {
    const tokenRes = await fetch(SANDBOX_OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    });
    const tokenBody = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenBody.access_token) {
      return json({
        error: 'SATUSEHAT menolak client_id/client_secret Sandbox ini. '
          + 'Cek lagi apakah nilainya sudah persis sama dengan yang di dashboard SATUSEHAT (tab Sandbox, tipe Fasyankes).',
        detail: tokenBody.error_description || tokenBody.error || `HTTP ${tokenRes.status}`,
      }, 502);
    }
    accessToken = tokenBody.access_token;
  } catch (e) {
    return json({ error: 'Tidak bisa menghubungi SATUSEHAT: ' + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  // Langkah 2: pakai token itu untuk membaca kembali data Organization milik
  // klinik sendiri. Ini yang membuktikan tokennya benar-benar bisa dipakai,
  // bukan cuma "berhasil login" -- dan tidak menyentuh data pasien sama sekali.
  try {
    const orgRes = await fetch(`${SANDBOX_FHIR_BASE}/Organization/${encodeURIComponent(orgId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    const orgBody = await orgRes.json().catch(() => ({}));
    if (!orgRes.ok) {
      return json({
        error: `Login ke SATUSEHAT berhasil, tapi Organization ID "${orgId}" tidak ditemukan/ditolak.`,
        detail: orgBody.issue?.[0]?.diagnostics || `HTTP ${orgRes.status}`,
      }, 502);
    }
    return json({
      ok: true,
      pesan: 'Terhubung ke SATUSEHAT Sandbox.',
      organisasi: { id: orgId, nama: orgBody.name || '(tanpa nama)' },
    });
  } catch (e) {
    return json({ error: 'Login berhasil, tapi gagal membaca data Organization: ' + (e instanceof Error ? e.message : String(e)) }, 502);
  }
});
