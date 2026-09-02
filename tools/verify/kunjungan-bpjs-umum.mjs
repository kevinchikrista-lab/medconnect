// Kunjungan Hari Ini — BPJS atau Umum, ditentukan ADMIN saat pasien datang,
// bukan dokter. (1) dinamis -- lewat store.js yang sungguhan; (2) statis --
// halaman admin & badge di halaman dokter benar-benar ada dan tersambung.

import { readFileSync } from 'fs';

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/admin/kunjungan',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>null};
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

console.log('\n=== (1) KEDATANGAN & JENIS KUNJUNGAN (dinamis, store.js sungguhan) ===');

const gagalTanpaPasien = await store.createCheckin({ payment_type: 'bpjs' });
ok('createCheckin menolak tanpa pasien', () => !!gagalTanpaPasien.error);
const gagalJenisSalah = await store.createCheckin({ patient_id: 'p_1', payment_type: 'tunai' });
ok('createCheckin menolak jenis yang bukan bpjs/umum', () => !!gagalJenisSalah.error);

const checkin = await store.createCheckin({ patient_id: 'p_1', payment_type: 'bpjs', notes: 'kontrol rutin' });
ok('createCheckin berhasil untuk input yang benar', () => checkin && !checkin.error && checkin.id);
const hariIni = await store.getCheckinsToday();
ok('kedatangan hari ini memuatnya', () => hariIni.some(c => c.id === checkin.id));
ok('getCheckinForPatientToday menemukan yang baru dibuat (belum ditangani)', () => {
  const c = store.getCheckinForPatientToday('p_1');
  return c && c.id === checkin.id && c.payment_type === 'bpjs';
});

const dok = { id: 'd_1' };
const rec = await store.createRecord({ patient_id: 'p_1', doctor_id: dok.id, diagnosis: 'Kontrol rutin', therapy: '-' });
ok('createRecord otomatis mewarisi payment_type dari kedatangan hari ini', () => rec.payment_type === 'bpjs');
ok('kedatangan ditandai selesai (medical_record_id terisi) sesudah rekam medis dibuat', () => {
  const c = (store.data.patient_checkins || []).find(x => x.id === checkin.id);
  return c && c.medical_record_id === rec.id;
});
ok('kedatangan yang sudah ditangani TIDAK lagi ditemukan getCheckinForPatientToday (tidak dipakai dua kali)',
   () => store.getCheckinForPatientToday('p_1') === null);

// Rekam medis kedua hari yang sama, TANPA kedatangan baru: payment_type
// kosong, bukan menebak dari kunjungan sebelumnya atau menganggap Umum.
const rec2 = await store.createRecord({ patient_id: 'p_1', doctor_id: dok.id, diagnosis: 'Keluhan lain', therapy: '-' });
ok('rekam medis TANPA kedatangan terdaftar: payment_type kosong, bukan ditebak', () => !rec2.payment_type);

// payment_type yang sudah eksplisit di parameter (mis. jalur vaksin/lain)
// tidak boleh ditimpa oleh kedatangan yang kebetulan ada.
await store.createCheckin({ patient_id: 'p_2', payment_type: 'umum' });
const rec3 = await store.createRecord({ patient_id: 'p_2', doctor_id: dok.id, diagnosis: 'x', therapy: '-', payment_type: 'bpjs' });
ok('payment_type yang sudah ditentukan pemanggil tidak ditimpa oleh kedatangan', () => rec3.payment_type === 'bpjs');

const checkinBatal = await store.createCheckin({ patient_id: 'p_3', payment_type: 'umum' });
await store.cancelCheckin(checkinBatal.id);
ok('cancelCheckin menghapusnya dari daftar', () => !(store.data.patient_checkins || []).some(x => x.id === checkinBatal.id));

// TTV sederhana ikut tersimpan di kedatangannya.
const checkinTtv = await store.createCheckin({ patient_id: 'p_4', payment_type: 'umum', td: '120/80', nadi: '88', suhu: '36.7' });
ok('TTV (td/nadi/suhu) tersimpan di kedatangan', () => checkinTtv.td === '120/80' && checkinTtv.nadi === '88' && checkinTtv.suhu === '36.7');

console.log('\n=== (1b) NOTIFIKASI KE DOKTER TUJUAN (dinamis) ===');

const sebelumNotif = (store.data.notifications || []).length;
await store.createCheckin({ patient_id: 'p_5', payment_type: 'bpjs', doctor_id: 'd_1' });
ok('dokter tujuan diberi notifikasi saat kedatangan didaftarkan', () => {
  const setelah = store.data.notifications || [];
  return setelah.length > sebelumNotif && setelah.some(n => n.user_id === 'u_doc1' && /menunggu/i.test(n.message || ''));
});

// Superadmin menyunting kedatangan: ganti dokter tujuan, jenis kunjungan,
// dan TTV -- dokter yang BARU diberi tahu, bukan cuma dicatat diam-diam.
const checkinEdit = await store.createCheckin({ patient_id: 'p_1', payment_type: 'umum' });
const sebelumNotif2 = (store.data.notifications || []).length;
const hasilEdit = await store.updateCheckin(checkinEdit.id, { payment_type: 'bpjs', doctor_id: 'd_1', td: '110/70', nadi: '80', suhu: '36.5' });
ok('updateCheckin berhasil mengubah data kedatangan', () => hasilEdit && !hasilEdit.error);
ok('perubahan payment_type & TTV benar-benar tersimpan', () => {
  const c = (store.data.patient_checkins || []).find(x => x.id === checkinEdit.id);
  return c && c.payment_type === 'bpjs' && c.td === '110/70' && c.nadi === '80' && c.suhu === '36.5';
});
ok('mengganti dokter tujuan lewat edit ikut mengirim notifikasi', () => {
  const setelah = store.data.notifications || [];
  return setelah.length > sebelumNotif2 && setelah.some(n => n.user_id === 'u_doc1' && /dialihkan|menunggu/i.test(n.message || ''));
});

console.log('\n=== (2) HALAMAN ADMIN & RUTE (statis) ===');

const adminSrc = readFileSync('../../js/pages/admin.js', 'utf8');
const appSrc = readFileSync('../../js/app.js', 'utf8');
const doctorSrc = readFileSync('../../js/pages/doctor.js', 'utf8');

ok('adminKunjunganHariIni() ada', () => /export function adminKunjunganHariIni\(\)/.test(adminSrc));
ok('tombol Tandai Kedatangan ada', () => adminSrc.includes('+ Tandai Kedatangan'));
ok('pilihan Umum & BPJS ada di modalnya', () => /payment_type=.umum./.test(adminSrc) && /payment_type=.bpjs./.test(adminSrc));
ok('daftar menampilkan badge BPJS/UMUM & status Menunggu dokter / Sudah ditangani',
   () => adminSrc.includes("'BPJS' : 'UMUM'") && adminSrc.includes('Sudah ditangani') && adminSrc.includes('Menunggu dokter'));
ok('menu sidebar "Kunjungan Hari Ini" ada, menuju #/admin/kunjungan',
   () => /id: 'kunjungan', label: 'Kunjungan Hari Ini'.*href: '#\/admin\/kunjungan'/.test(adminSrc));
ok('rute /admin/kunjungan terdaftar ke adminKunjunganHariIni', () => /router\.add\('\/admin\/kunjungan', \(\) => render\(adminKunjunganHariIni\)\)/.test(appSrc));
ok('adminKunjunganHariIni diimpor dari pages/admin.js', () => /adminKunjunganHariIni.*\} from '\.\/pages\/admin\.js'/.test(appSrc));

console.log('\n=== (3) BADGE & EDIT (statis) ===');
ok('tombol Edit ada di daftar kedatangan admin (superadmin bisa ubah data)',
   () => /openEdit\(c\)/.test(adminSrc) && adminSrc.includes('>Edit<'));
ok('form admin punya input TTV (td/nadi/suhu)',
   () => /x-model="form\.td"/.test(adminSrc) && /x-model="form\.nadi"/.test(adminSrc) && /x-model="form\.suhu"/.test(adminSrc));
ok('updateCheckin dipanggil saat menyunting (bukan createCheckin lagi)',
   () => /editingId \? await window\.__store\.updateCheckin/.test(adminSrc));

ok('halaman dokter (EMR & Kunjungan Baru) SAMA-SAMA memuat kedatangan hari ini saat dibuka',
   () => (doctorSrc.match(/x-init="[^"]*cekKedatangan\(\)/g) || []).length >= 2);
ok('badge "Kunjungan BPJS" / "Kunjungan Umum" ditampilkan di halaman rekam medis',
   () => doctorSrc.includes("'Kunjungan BPJS' : 'Kunjungan Umum'"));
ok('badge BPJS/Umum juga ditampilkan di formulir Kunjungan Baru',
   () => /kedatangan && \(kedatangan\.payment_type === 'bpjs' \? 'BPJS' : 'Umum'\)/.test(doctorSrc));
ok('TTV dari kedatangan mengisi form vital_signs TAPI hanya kalau masih kosong (tidak menimpa isian dokter)',
   () => /if \(this\.kedatangan\.td && !this\.form\.vital_signs\.td\)/.test(doctorSrc)
      && /if \(this\.kedatangan\.nadi && !this\.form\.vital_signs\.nadi\)/.test(doctorSrc)
      && /if \(this\.kedatangan\.suhu && !this\.form\.vital_signs\.suhu\)/.test(doctorSrc));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
