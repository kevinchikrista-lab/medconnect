// Tes Koneksi SATUSEHAT Sandbox: memastikan nama fungsi yang dipanggil dari
// browser (store.js -> supabase.js -> fetch functions/v1/<nama>) SAMA PERSIS
// dengan nama folder Edge Function-nya di supabase/functions/. Kalau
// berbeda satu huruf saja, panggilannya 404 diam-diam -- Supabase tidak
// menolak dengan pesan yang jelas, cuma "not found".

import { readFileSync, existsSync } from 'fs';

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

const FN_NAME = 'satusehat-sandbox-test';
const storeSrc = readFileSync('../../js/store.js', 'utf8');
const supabaseSrc = readFileSync('../../js/supabase.js', 'utf8');
const adminSrc = readFileSync('../../js/pages/admin.js', 'utf8');
const fnPath = `../../supabase/functions/${FN_NAME}/index.ts`;

console.log('\n=== TES KONEKSI SATUSEHAT SANDBOX ===');

ok('folder Edge Function ada di supabase/functions/' + FN_NAME, () => existsSync(fnPath));

ok('store.tesSatusehatSandbox() memanggil supabase.invoke dengan nama fungsi yang sama persis',
   () => new RegExp(`tesSatusehatSandbox\\(\\)\\s*\\{[^}]*supabase\\.invoke\\('${FN_NAME}'`, 's').test(storeSrc));

ok('supabase.invoke() memanggil endpoint functions/v1/<nama>, bukan rest/v1',
   () => /invoke\(fn, body = \{\}\)/.test(supabaseSrc) && /functions\/v1\/\$\{fn\}/.test(supabaseSrc));

// Prefer: return=representation cuma dipahami PostgREST. Edge Function tidak
// mendaftarkannya di Access-Control-Allow-Headers, jadi kalau invoke() masih
// mengirimnya, pre-flight CORS gagal dan browser membatalkan requestnya --
// munculnya cuma "Failed to fetch" tanpa pesan error apa pun dari kode kita.
ok('invoke() TIDAK mengirim header Prefer (bikin CORS pre-flight gagal, "Failed to fetch")', () => {
  const i = supabaseSrc.indexOf('async invoke(fn');
  const akhir = supabaseSrc.indexOf('\n  },', i);
  return i !== -1 && akhir !== -1 && /noPrefer\s*:\s*true/.test(supabaseSrc.slice(i, akhir));
});

ok('halaman admin memanggil window.__store.tesSatusehatSandbox() (bukan supabase.invoke langsung)',
   () => /window\.__store\.tesSatusehatSandbox\(\)/.test(adminSrc));

ok('halaman admin punya tombol tes & menampilkan hasil/errornya',
   () => /tesSandbox\(\)/.test(adminSrc) && /tesHasil/.test(adminSrc) && /tesError/.test(adminSrc));

if (existsSync(fnPath)) {
  const fnSrc = readFileSync(fnPath, 'utf8');
  ok('Edge Function membaca ketiga secret Sandbox yang diminta di panduan',
     () => ['SATUSEHAT_SANDBOX_CLIENT_ID', 'SATUSEHAT_SANDBOX_CLIENT_SECRET', 'SATUSEHAT_SANDBOX_ORG_ID']
       .every(k => fnSrc.includes(k)));
  ok('Edge Function memakai endpoint Sandbox (stg.dto.kemkes.go.id), bukan Production',
     () => fnSrc.includes('api-satusehat-stg.dto.kemkes.go.id') && !fnSrc.includes('api-satusehat.kemkes.go.id'));
  ok('client_secret & access_token tidak pernah dikembalikan ke pemanggil (tidak ada di isi return json(...))', () => {
    let i = 0, bersih = true;
    while ((i = fnSrc.indexOf('json(', i)) !== -1) {
      const mulai = i + 'json('.length;
      let d = 1, j = mulai;
      while (j < fnSrc.length && d > 0) { if (fnSrc[j] === '(') d++; else if (fnSrc[j] === ')') d--; j++; }
      const isi = fnSrc.slice(mulai, j - 1);
      if (/clientSecret|accessToken/.test(isi)) bersih = false;
      i = j;
    }
    return bersih;
  });
  ok('cuma owner/superadmin yang boleh menjalankan tes ini',
     () => /role !== 'owner' && role !== 'superadmin'/.test(fnSrc) || /'owner'.*'superadmin'/.test(fnSrc));
  ok('tidak ada data pasien yang disentuh (tidak ada tabel patients/medical_records dipanggil)',
     () => !/patients|medical_records/.test(fnSrc));
} else {
  fails++;
  console.log('  ❌ berkas Edge Function tidak ditemukan, sisa pemeriksaan dilewati');
}

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
