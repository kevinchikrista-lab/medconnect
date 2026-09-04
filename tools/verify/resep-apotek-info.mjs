// Halaman Resep milik akun apotek (pharmacyPrescriptions): apotek minta (1)
// No. HP pasien / nama+HP wali, (2) alamat pasien, (3) jasa dokter SELALU
// tercetak walau Rp 0 -- supaya nol dibaca sebagai kepastian, bukan sebagai
// data yang belum termuat. Static only -- ini template Alpine yang dirender
// jadi string; benar/salahnya dibuktikan dari pola sumbernya, bukan dengan
// menjalankan reaktivitas Alpine (butuh DOM sungguhan).

import { readFileSync } from 'fs';

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

const src = readFileSync('../../js/pages/pharmacy.js', 'utf8');

// Fungsi patientContact() dipakai berulang (rx.patient_id). Ambil bagian
// halaman Resep-nya secara spesifik lewat penanda fungsi & komentarnya,
// supaya pemeriksa tidak salah sasaran ke patientContact() versi Dashboard.
const iResep = src.indexOf('export function pharmacyPrescriptions()');
const resepSrc = src.slice(iResep);

console.log('\n=== INFO PASIEN & JASA DI HALAMAN RESEP APOTEK (statis) ===');

ok('patientContact() di halaman Resep membawa address, bukan cuma phone/wali',
   () => /patientContact\(id\) \{[\s\S]{0,200}?address: p\.address \|\| ''/.test(resepSrc));
ok('No. HP pasien tetap tercetak (regresi -- jangan sampai edit ini merusak yang sudah ada)',
   () => resepSrc.includes('No. HP Pasien:'));
ok('Keluarga / Wali (nama + hubungan + HP) tetap tercetak',
   () => resepSrc.includes('Keluarga / Wali:') && resepSrc.includes('famRel') && resepSrc.includes('famPhone'));
ok('Alamat pasien SEKARANG ikut tercetak, tidak cuma alamat pengiriman',
   () => /<span class="text-slate-500">Alamat:<\/span> <span class="font-medium whitespace-pre-line" x-text="patientContact\(rx\.patient_id\)\.address \|\| '-'"/.test(resepSrc));

ok('baris Jasa Dokter TIDAK lagi dibungkus template x-if="rx.service_fee_enabled" (dulu hilang total saat nol)',
   () => !/<template x-if="rx\.service_fee_enabled">\s*<div class="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center justify-between"><p class="text-xs font-semibold text-green-800">💰 Jasa Dokter/.test(resepSrc));
ok('nilai jasa memakai fallback eksplisit ke 0 saat service_fee_enabled false (bukan menyembunyikan barisnya)',
   () => resepSrc.includes("'Rp ' + (rx.service_fee_enabled ? (rx.service_fee || 0) : 0).toLocaleString('id-ID')"));
ok('tampilan Rp 0 dibedakan gaya visualnya dari yang sungguhan ada jasanya (bukan disamarkan jadi terlihat sama)',
   () => /rx\.service_fee_enabled && rx\.service_fee > 0 \? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'/.test(resepSrc));
ok('label berubah jadi netral ("Jasa Dokter" saja, tanpa "mohon ditarik") saat memang tidak ada jasa',
   () => /rx\.service_fee_enabled && rx\.service_fee > 0 \? '💰 Jasa Dokter — mohon ditarik dari pasien' : 'Jasa Dokter'/.test(resepSrc));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
