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

console.log('\n=== (3) BADGE DI HALAMAN DOKTER (statis) ===');
ok('halaman dokter memuat kedatangan pasien ini saat dibuka (cekKedatangan di x-init)',
   () => /x-init="[^"]*cekKedatangan\(\)/.test(doctorSrc));
ok('badge "Kunjungan BPJS" / "Kunjungan Umum" ditampilkan',
   () => doctorSrc.includes("'Kunjungan BPJS' : 'Kunjungan Umum'"));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
