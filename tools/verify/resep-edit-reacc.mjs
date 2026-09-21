// Resep boleh disunting dokter sampai apotek benar-benar mengirim/
// menyelesaikannya -- termasuk yang SUDAH di-ACC apotek (preparing/ready).
// Kalau sudah di-ACC, menyunting memaksa status kembali ke 'sent',
// menandai needs_reacc, dan memberi tahu apotek. Dinamis -- store.js
// sungguhan, dibuktikan dengan data demo yang statusnya beragam.

import { readFileSync } from 'fs';

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/doctor/prescriptions',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>null};
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){},setAttribute(){}}),body:{appendChild(){}},addEventListener(){},images:[],head:{appendChild(){}}};
try{global.navigator={onLine:true};}catch(e){}
global.alert=()=>{}; global.confirm=()=>true;

const { CONFIG } = await import('../../js/config.js');
CONFIG.DEMO_MODE = true;
const { store } = await import('../../js/store.js');
window.__store = store;

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== SUNTING RESEP SESUDAH DI-ACC (dinamis, store.js sungguhan) ===');

// rx_3 (completed): sudah selesai, tidak boleh disunting sama sekali.
const gagalCompleted = await store.updatePrescription('rx_3', { notes: 'coba ubah' });
ok('resep completed TIDAK bisa disunting', () => !!gagalCompleted.error);
ok('resep completed di store TIDAK berubah (rollback / tidak pernah diterapkan)',
   () => store.data.prescriptions.find(r => r.id === 'rx_3').notes === '');

// rx_2 (sent, BELUM di-ACC apotek): boleh disunting, TIDAK perlu re-ACC
// (belum pernah di-ACC sama sekali, jadi tidak ada apa-apa yang perlu
// "diulang").
const sebelumNotif1 = (store.data.notifications || []).length;
const hasil2 = await store.updatePrescription('rx_2', { notes: 'dosis disesuaikan' });
ok('resep sent (belum di-ACC) berhasil disunting', () => hasil2.success);
ok('resep sent yang disunting TIDAK ditandai needs_reacc (belum pernah di-ACC)',
   () => !store.data.prescriptions.find(r => r.id === 'rx_2').needs_reacc);
ok('menyunting resep yang belum di-ACC TIDAK mengirim notifikasi ke apotek (tidak ada yang perlu diulang)',
   () => (store.data.notifications || []).length === sebelumNotif1);

// rx_1 (preparing, SUDAH di-ACC apotek): inti fiturnya.
const rx1Sebelum = { ...store.data.prescriptions.find(r => r.id === 'rx_1') };
ok('rx_1 memang berstatus preparing sebelum diedit (asumsi data demo)', () => rx1Sebelum.status === 'preparing');
const sebelumNotif2 = (store.data.notifications || []).length;
const hasil1 = await store.updatePrescription('rx_1', { notes: 'dosis Amoxicillin diturunkan' });
ok('resep preparing (SUDAH di-ACC) tetap berhasil disunting, bukan ditolak', () => hasil1.success);
const rx1Sesudah = store.data.prescriptions.find(r => r.id === 'rx_1');
ok('status dipaksa kembali ke "sent" supaya apotek melihatnya lagi sebagai perlu ditindak',
   () => rx1Sesudah.status === 'sent');
ok('ditandai needs_reacc: true', () => rx1Sesudah.needs_reacc === true);
ok('isi suntingannya (notes) benar-benar tersimpan, bukan cuma status yang berubah',
   () => rx1Sesudah.notes === 'dosis Amoxicillin diturunkan');
ok('apotek (ph_1, user_id u_pha1) diberi notifikasi tentang perubahan ini', () => {
  const setelah = store.data.notifications || [];
  return setelah.length > sebelumNotif2
    && setelah.some(n => n.user_id === 'u_pha1' && /diubah dokter/i.test(n.message || '') && n.message.includes('R-2026-0142'));
});

// Apotek bertindak lagi (mis. Terima) -- needs_reacc harus bersih lagi,
// bukan tersangkut selamanya sebagai "perlu ditindak".
store.updatePrescriptionStatus('rx_1', 'preparing');
ok('needs_reacc dibersihkan begitu apotek bertindak lagi (accept)',
   () => store.data.prescriptions.find(r => r.id === 'rx_1').needs_reacc === false);

// rx_4 (ready, SUDAH di-ACC apotek): status "sudah di-ACC" mencakup lebih
// dari satu status (preparing DAN ready), bukan cuma preparing.
const hasil4 = await store.updatePrescription('rx_4', { notes: 'catatan tambahan' });
ok('resep ready (juga sudah di-ACC) bisa disunting & ditandai needs_reacc juga', () => {
  const rx4 = store.data.prescriptions.find(r => r.id === 'rx_4');
  return hasil4.success && rx4.status === 'sent' && rx4.needs_reacc === true;
});

// Kembalikan rx_1/rx_2/rx_4 seperti semula -- berkas verify lain memakainya.
Object.assign(store.data.prescriptions.find(r => r.id === 'rx_1'), rx1Sebelum);
Object.assign(store.data.prescriptions.find(r => r.id === 'rx_2'), { notes: 'Pasien alergi NSAID. Jangan ganti dengan obat mengandung aspirin.', status: 'sent', needs_reacc: false });
Object.assign(store.data.prescriptions.find(r => r.id === 'rx_4'), { notes: '', status: 'ready', needs_reacc: false });
Object.assign(store.data.prescriptions.find(r => r.id === 'rx_3'), { notes: '' });

console.log('\n=== TAMPILAN (statis) ===');

const doctorSrc = readFileSync('../../js/pages/doctor.js', 'utf8');
const pharmSrc = readFileSync('../../js/pages/pharmacy.js', 'utf8');
const sqlSrc = readFileSync('../../supabase-resep-edit-reacc.sql', 'utf8');

ok('canEdit di halaman dokter mengizinkan preparing & ready, tidak cuma sent/rejected',
   () => /const canEdit = \['sent', 'rejected', 'preparing', 'ready'\]\.includes\(rx\.status\)/.test(doctorSrc));
ok('halaman Edit Resep memberi peringatan KHUSUS saat resepnya sudah di-ACC apotek',
   () => doctorSrc.includes('SUDAH DITERIMA apotek') && doctorSrc.includes('sudahDiaccApotek'));
ok('badge "Diubah dokter — ACC ulang" muncul di daftar resep apotek (halaman detail)',
   () => (pharmSrc.match(/✏️ Diubah dokter — ACC ulang/g) || []).length >= 2);
ok('store.updatePrescription menolak status yang sudah terkirim/selesai ke pasien',
   () => /const BISA_DISUNTING = \['sent', 'rejected', 'preparing', 'ready'\]/.test(readFileSync('../../js/store.js', 'utf8')));
ok('update ke Supabase punya jalur cadangan tanpa kolom needs_reacc (migrasi belum tentu sudah jalan)',
   () => (readFileSync('../../js/store.js', 'utf8').match(/needs_reacc' in (finalUpdates|updates)/g) || []).length >= 2);
ok('SQL migrasi needs_reacc ada & aman diulang (ADD COLUMN IF NOT EXISTS)',
   () => sqlSrc.includes('ADD COLUMN IF NOT EXISTS needs_reacc'));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
