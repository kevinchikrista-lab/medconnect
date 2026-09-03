// "Ambil dari Riwayat Pengobatan" di halaman Buat E-Resep: dokter bisa
// mencentang OBAT (bukan seluruh resep) dari riwayat pengobatan pasien
// sebelumnya, ditambahkan (bukan menimpa) ke resep yang sedang dibuat.
// Static only -- x-data-nya sendiri sudah dilewati logic engine harness
// (state Alpine murni, tidak layak dijalankan tanpa DOM sungguhan), tapi
// tiap potongan logikanya diverifikasi persis dari sumbernya.

import { readFileSync } from 'fs';

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

const src = readFileSync('../../js/pages/doctor.js', 'utf8');

console.log('\n=== "AMBIL DARI RIWAYAT PENGOBATAN" (statis, doctor.js sungguhan) ===');

ok('tombolnya ada dengan label yang jelas menyebut riwayat pengobatan',
   () => src.includes('>Ambil dari Riwayat Pengobatan<'));
ok('openCopy() memuat SELURUH resep pasien lewat getPrescriptionsByPatient',
   () => /openCopy\(\) \{[^}]*getPrescriptionsByPatient/.test(src));
ok('tiap resep membawa item-nya sendiri (per obat, bukan cuma ringkasan)',
   () => /items: its\.map\(function\(i\) \{/.test(src));
ok('tiap obat punya properti dipilih (state checkbox), default belum dicentang',
   () => /dipilih: false \};/.test(src));
ok('checkbox di modal terikat ke it.dipilih lewat x-model (bisa dicentang satu-satu)',
   () => /x-model="it\.dipilih"/.test(src));
ok('bisa mencentang lintas beberapa resep lama sekaligus (dua x-for bersarang: resep lalu obat)',
   () => /x-for="rx in copyList"/.test(src) && /x-for="\(it, idx\) in rx\.items"/.test(src));

ok('tambahkanDariRiwayat() MENAMBAHKAN ke items yang ada, bukan menimpanya',
   () => /this\.items = \(formMasihKosong \? \[\] : this\.items\)\.concat\(terpilih\)/.test(src));
ok('baris form yang masih sepenuhnya kosong diganti (bukan dibiarkan jadi baris kosong menganggur)',
   () => /const formMasihKosong = this\.items\.length === 1 && !this\.items\[0\]\.drug_name && !this\.items\[0\]\.compound_details/.test(src));
ok('obat yang tidak dicentang tidak ikut ditambahkan (hanya i.dipilih yang dikumpulkan)',
   () => /rx\.items\.forEach\(function\(i\) \{ if \(i\.dipilih\)/.test(src));
ok('properti dipilih dibuang sebelum obat itu masuk ke daftar resep (tidak bocor ke payload createPrescription)',
   () => /delete c\.dipilih;/.test(src));
ok('tombol Tambahkan mati kalau belum ada satu pun yang dicentang (adaDipilihDariRiwayat)',
   () => /:disabled="!adaDipilihDariRiwayat"/.test(src) && /get adaDipilihDariRiwayat\(\)/.test(src));
ok('tidak ada apply/tidak sengaja terkirim ke server tanpa dicentang dulu -- yang kosong tidak melakukan apa-apa',
   () => /if \(!terpilih\.length\) return;/.test(src));

// Fungsi useCopy (versi lama, "salin seluruh resep sekaligus, menimpa form")
// harus benar-benar sudah diganti, bukan ditinggal jadi kode mati yang
// membingungkan mana yang sungguhan dipakai.
ok('fungsi useCopy() versi lama (menimpa seluruh form) sudah dihapus, bukan ditinggal jadi dead code',
   () => !/useCopy\(rxId\)/.test(src));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
