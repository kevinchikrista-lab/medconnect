// Bug: "Berikan Dosis Berikutnya" di halaman rekam medis dokter menghitung
// dosis berikutnya dari ELEMEN TERAKHIR array vaksinasi (yang urutannya
// mengikuti date_given lewat store.getVaccinations, BUKAN dose_number) --
// kalau tanggal pemberian dosisnya tercatat tidak berurutan (mis. dosis 1
// salah ketik tanggalnya jadi lebih baru dari dosis 2), sistem terus
// menawarkan dosis yang SAMA berulang, bukan maju ke dosis berikutnya.
// Diperbaiki dengan mengambil dosis ber-dose_number TERBESAR, bukan elemen
// array terakhir. Dinamis -- memanggil doctorEMR() sungguhan, memeriksa HTML
// yang benar-benar dihasilkan.

import { readFileSync } from 'fs';

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/doctor/emr',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>null};
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){},setAttribute(){}}),body:{appendChild(){}},addEventListener(){},images:[],head:{appendChild(){}}};
try{global.navigator={onLine:true};}catch(e){}
global.alert=()=>{}; global.confirm=()=>true;

const { CONFIG } = await import('../../js/config.js');
CONFIG.DEMO_MODE = true;
const { store } = await import('../../js/store.js');
window.__store = store;
sessionStorage.setItem('medconnect_user', JSON.stringify({ id: 'u_doc1', role: 'doctor' }));
const { doctorEMR } = await import('../../js/pages/doctor.js');

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== DOSIS BERIKUTNYA — URUTAN TIDAK KRONOLOGIS (dinamis, HTML sungguhan) ===');

// Persis kasus yang dilaporkan: dosis 1 tercatat diberikan 9 Des 2026, dosis
// 2 tercatat diberikan 9 Jan 2026 -- dosis 1 tanggalnya JUSTRU LEBIH BARU
// dari dosis 2 (data tidak berurutan), jadi getVaccinations() (sort by
// date_given) menaruh dosis 1 di ELEMEN TERAKHIR array, walau dose_number-nya
// paling kecil.
const dosisAwal = [
  { id: 'vtest_1', patient_id: 'p_1', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix B', vax_mode: 'series', dose_number: 1, total_doses: 3, date_given: '2026-12-09', next_dose_date: '2026-01-09', batch_number: 'GR1474', administered_by: 'd_1', location: 'Home Care', notes: '' },
  { id: 'vtest_2', patient_id: 'p_1', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix B', vax_mode: 'series', dose_number: 2, total_doses: 3, date_given: '2026-01-09', next_dose_date: '2026-04-09', batch_number: 'GR1424', administered_by: 'd_1', location: 'Home Care', notes: '' },
];
store.data.vaccinations.push(...dosisAwal);

const html = doctorEMR({ patientId: 'p_1' });

ok('urutan tanggalnya memang sengaja tidak kronologis (membuktikan data ujinya benar-benar meniru laporan)',
   () => store.getVaccinations('p_1').filter(v=>v.vaccine_name==='Hepatitis B').slice(-1)[0].dose_number === 1);
ok('halaman menawarkan "Berikan Dosis 3/3" (dosis SELANJUTNYA), BUKAN "Berikan Dosis 2/3" (dosis yang sudah diberikan)',
   () => html.includes('Berikan Dosis 3/3'));
ok('halaman TIDAK lagi menawarkan mengulang Dosis 2/3', () => !html.includes('Berikan Dosis 2/3'));
ok('lingkaran nomor dosis berikutnya menampilkan angka 3, bukan 2', () => /bg-amber-400 text-white text-xs font-bold">3</.test(html));
ok('nomor dosis awal formulir "Berikan Dosis" (af.dose_number) terisi 3 secara otomatis',
   () => /dose_number: 3,/.test(html));

console.log('\n=== FORMULIR "BERIKAN DOSIS" BISA DISUNTING NOMORNYA (statis + dinamis) ===');

ok('ada kolom "Dosis Ke-" yang bisa disunting di formulir pemberian dosis baru (bukan cuma dikunci otomatis)',
   () => html.includes('Dosis Ke- *') && html.includes('x-model.number="af.dose_number"'));
ok('ada kolom "Total Dosis" yang bisa disunting juga (jaga-jaga kalau total dosisnya sendiri perlu dikoreksi)',
   () => html.includes('Total Dosis *') && html.includes('x-model.number="af.total_doses"'));
ok('judul formulir ikut bereaksi ke perubahan af.dose_number (reaktif, bukan teks statis yang tidak ikut berubah kalau disunting)',
   () => html.includes("x-text=\"'💉 ' + (af.vax_mode === 'booster' ? 'Berikan Booster' : 'Berikan Dosis ' + af.dose_number + '/' + af.total_doses) + (af.external ? ' (di tempat lain)' : '')\""));

console.log('\n=== REGRESI: SERI YANG SUDAH BERURUTAN (HPV p_3) TETAP BENAR (dinamis) ===');

const htmlP3 = doctorEMR({ patientId: 'p_3' });
ok('untuk pasien dengan urutan tanggal yang SUDAH benar (HPV p_3, dosis 1 lalu 2), tetap menawarkan dosis 3/3 seperti sebelumnya',
   () => htmlP3.includes('Berikan Dosis 3/3'));

// Bersihkan data uji -- berkas verify lain memakai vaksinasi demo yang sama.
store.data.vaccinations = store.data.vaccinations.filter(v => v.id !== 'vtest_1' && v.id !== 'vtest_2');
ok('data uji berhasil dibersihkan', () => !store.data.vaccinations.some(v => v.id === 'vtest_1' || v.id === 'vtest_2'));

console.log('\n=== ISI DOSIS TIDAK BERURUTAN — DOSIS 3 DULU, 1 & 2 MENYUSUL (dinamis, HTML sungguhan) ===');

// Persis skenario yang diminta dr. Kevin: dosis ke-3 sempat dicatat duluan
// (mis. diketahui dari kartu vaksinasi anak), dosis 1 & 2-nya belum ada sama
// sekali di sistem. Keduanya harus muncul sebagai kartu TERPISAH yang bisa
// diisi kapan saja -- bukan cuma satu slot "next" yang menganggap
// pengisiannya selalu berurutan.
store.data.vaccinations.push({
  id: 'vtest_3', patient_id: 'p_4', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix B',
  vax_mode: 'series', dose_number: 3, total_doses: 3, date_given: '2026-08-01', next_dose_date: '',
  batch_number: 'GR9001', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: '',
});
const htmlP4 = doctorEMR({ patientId: 'p_4' });

ok('muncul kartu terpisah "Berikan Dosis 1/3" untuk dosis pertama yang belum tercatat',
   () => htmlP4.includes('Berikan Dosis 1/3') && htmlP4.includes('Dosis Pertama (1/3)'));
ok('muncul kartu terpisah "Berikan Dosis 2/3" untuk dosis kedua yang belum tercatat',
   () => htmlP4.includes('Berikan Dosis 2/3') && htmlP4.includes('Dosis ke-2 (2/3)'));
ok('TIDAK ada kartu "Berikan Dosis 4/3" -- dosis 3 sudah tercatat, totalnya cuma 3',
   () => !htmlP4.includes('Berikan Dosis 4/3'));
ok('kedua slot yang belum tercatat (dosis 1 & 2, bukan langsung sesudah dosis tertinggi) ditandai "Belum tercatat", bukan tanggal jadwal palsu',
   () => (htmlP4.match(/Belum tercatat/g) || []).length >= 2);

// Kalau seri itu sudah lengkap (1, 2, 3 dari 3), tidak ada kartu tersisa
// sama sekali -- baik dosis 1/2/3 atau slot lain.
store.data.vaccinations.push(
  { id: 'vtest_4', patient_id: 'p_4', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix B', vax_mode: 'series', dose_number: 1, total_doses: 3, date_given: '2026-01-01', next_dose_date: '', batch_number: 'GR9002', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: '' },
  { id: 'vtest_5', patient_id: 'p_4', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix B', vax_mode: 'series', dose_number: 2, total_doses: 3, date_given: '2026-04-01', next_dose_date: '', batch_number: 'GR9003', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: '' },
);
const htmlP4Lengkap = doctorEMR({ patientId: 'p_4' });
ok('begitu seri lengkap (1, 2, 3 dari 3), tidak ada kartu "Berikan Dosis" tersisa',
   () => !htmlP4Lengkap.includes('Berikan Dosis 1/3') && !htmlP4Lengkap.includes('Berikan Dosis 2/3') && !htmlP4Lengkap.includes('Berikan Dosis 4/3'));

console.log('\n=== DIBERIKAN DI TEMPAT LAIN — TOGGLE & PENYIMPANANNYA (statis + dinamis) ===');

ok('setiap kartu "Berikan Dosis" punya toggle "Diberikan di tempat lain"',
   () => (htmlP4.match(/Diberikan di <b>tempat lain<\/b>/g) || []).length === 2);
ok('lokasi berubah jadi kolom teks bebas (bukan pilihan tempat sendiri) begitu ditandai di tempat lain',
   () => htmlP4.includes('Tempat Vaksinasi (Puskesmas/Klinik Lain)'));
ok('Batch Number tidak lagi wajib kalau ditandai di tempat lain (label & syarat tombol ikut berubah)',
   () => htmlP4.includes("x-text=\"af.external ? 'Batch Number (kalau tahu)' : 'Batch Number *'\"")
      && htmlP4.includes('(!af.external && !af.batch_number)'));
ok('dosis yang ditandai di tempat lain disimpan dengan approval_status/vax_source yang benar (bukan seolah-olah kami yang menyuntik)',
   () => htmlP4.includes("vaxPayload.approval_status = 'external';") && htmlP4.includes("vaxPayload.vax_source = 'luar';") && htmlP4.includes("vaxPayload.administered_by = '';"));
ok('dosis di tempat lain TIDAK membuat rekam medis kunjungan palsu di klinik ini',
   () => htmlP4.includes('if (!eksternal) {') && /if \(!eksternal\) \{\s*\n\s*window\.__store\.createRecord/.test(htmlP4));

// Bersihkan data uji.
store.data.vaccinations = store.data.vaccinations.filter(v => !['vtest_3','vtest_4','vtest_5'].includes(v.id));
ok('data uji dosis-tidak-berurutan berhasil dibersihkan',
   () => !store.data.vaccinations.some(v => ['vtest_3','vtest_4','vtest_5'].includes(v.id)));

console.log('\n=== SUMBER KODE (statis) ===');
const doctorSrc = readFileSync('../../js/pages/doctor.js', 'utf8');
ok('lastDose dihitung dari dose_number TERBESAR, bukan elemen terakhir array',
   () => doctorSrc.includes('const lastDose = doses.reduce((max, d) => (d.dose_number > max.dose_number ? d : max), doses[0]);'));
ok('pola lama (doses[doses.length-1]) untuk lastDose sudah tidak ada lagi',
   () => !doctorSrc.includes('const lastDose = doses[doses.length-1];'));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
