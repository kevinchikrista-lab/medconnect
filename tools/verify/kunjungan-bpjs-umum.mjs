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

console.log('\n=== (4) KUNJUNGAN HARI INI — SISI DOKTER (statis & dinamis) ===');
ok('doctorKunjunganHariIni() ada', () => /export function doctorKunjunganHariIni\(\)/.test(doctorSrc));
ok('menu sidebar dokter "Kunjungan Hari Ini" ada, menuju #/doctor/kunjungan',
   () => /id: 'kunjungan', label: 'Kunjungan Hari Ini'.*href: '#\/doctor\/kunjungan'/.test(doctorSrc));
ok('rute /doctor/kunjungan terdaftar ke doctorKunjunganHariIni', () => /router\.add\('\/doctor\/kunjungan', \(\) => render\(doctorKunjunganHariIni\)\)/.test(appSrc));
ok('doctorKunjunganHariIni diimpor dari pages/doctor.js', () => /doctorKunjunganHariIni.*\} from '\.\/pages\/doctor\.js'/.test(appSrc));
ok('mengklik baris pasien langsung membuka Kunjungan Baru pasien itu',
   () => /mulai\(patientId\) \{ window\.location\.hash = '#\/doctor\/emr\/' \+ patientId \+ '\/new'; \}/.test(doctorSrc));
ok('daftarnya menyaring: hanya yang belum ditangani DAN (untuk dokter ini ATAU belum ditentukan)',
   () => /!c\.medical_record_id && \(!c\.doctor_id \|\| c\.doctor_id === /.test(doctorSrc));

// Dinamis: kedatangan untuk dokter LAIN tidak boleh nyasar ke sini, tapi yang
// belum ditentukan dokternya (doctor_id null) harus tetap kelihatan -- siapa
// saja boleh mengambilnya.
const semuaHariIni = await store.getCheckinsToday();
const untukD1 = semuaHariIni.filter(c => !c.medical_record_id && (!c.doctor_id || c.doctor_id === 'd_1'));
ok('kedatangan tanpa dokter tujuan tetap muncul untuk dokter mana pun (bisa diambil siapa saja)',
   () => semuaHariIni.some(c => !c.doctor_id) ? untukD1.some(c => !c.doctor_id) : true);
const checkinDokterLain = await store.createCheckin({ patient_id: 'p_3', payment_type: 'umum', doctor_id: 'd_2' });
const setelahD1 = (await store.getCheckinsToday()).filter(c => !c.medical_record_id && (!c.doctor_id || c.doctor_id === 'd_1'));
ok('kedatangan untuk DOKTER LAIN yang eksplisit tidak ikut muncul di daftar dokter ini',
   () => !setelahD1.some(c => c.id === checkinDokterLain.id));

console.log('\n=== (5) KUNJUNGAN HARI INI — GABUNGAN KEDATANGAN + APPOINTMENT (dinamis, mergeKunjunganHariIni sungguhan) ===');

const { mergeKunjunganHariIni } = await import('../../js/pages/doctor.js');

ok('mergeKunjunganHariIni diekspor sebagai fungsi murni (bisa diuji langsung)',
   () => typeof mergeKunjunganHariIni === 'function');

// Pasien hanya kedatangan (tanpa jadwal): tetap muncul, tanpa time_slot.
const hanyaCheckin = mergeKunjunganHariIni(
  [{ patient_id: 'px_1', payment_type: 'bpjs', td: '120/80', nadi: '', suhu: '', notes: '', created_at: '2026-09-08T01:00:00Z' }],
  []
);
ok('pasien yang hanya punya kedatangan (tanpa jadwal) tetap muncul di daftar gabungan',
   () => hanyaCheckin.length === 1 && hanyaCheckin[0].patient_id === 'px_1' && hanyaCheckin[0].payment_type === 'bpjs' && !hanyaCheckin[0].time_slot);

// Pasien hanya appointment (tanpa didaftarkan admin): tetap muncul, tanpa payment_type.
const hanyaAppt = mergeKunjunganHariIni(
  [],
  [{ patient_id: 'px_2', time_slot: '09:00', queue_number: 3, notes: 'Kontrol' }]
);
ok('pasien yang hanya punya jadwal appointment (tanpa kedatangan admin) tetap muncul di daftar gabungan',
   () => hanyaAppt.length === 1 && hanyaAppt[0].patient_id === 'px_2' && hanyaAppt[0].time_slot === '09:00' && !hanyaAppt[0].payment_type);

// Pasien yang ADA DI KEDUANYA: digabung jadi SATU baris, bukan dua baris
// untuk orang yang sama -- payment_type/TTV dari kedatangan, time_slot/
// queue_number dari appointment.
const keduanya = mergeKunjunganHariIni(
  [{ patient_id: 'px_3', payment_type: 'umum', td: '110/70', nadi: '78', suhu: '36.6', notes: '', created_at: '2026-09-08T01:00:00Z' }],
  [{ patient_id: 'px_3', time_slot: '10:30', queue_number: 5, notes: 'Vaksinasi' }]
);
ok('pasien yang ada di KEDUA sumber digabung jadi satu baris, bukan dua baris terpisah',
   () => keduanya.length === 1);
ok('baris gabungan membawa payment_type & TTV dari kedatangan',
   () => keduanya[0].payment_type === 'umum' && keduanya[0].td === '110/70' && keduanya[0].nadi === '78' && keduanya[0].suhu === '36.6');
ok('baris gabungan membawa time_slot & queue_number dari appointment',
   () => keduanya[0].time_slot === '10:30' && keduanya[0].queue_number === 5);

// Catatan: kalau kedatangan belum ada catatannya, dipakai catatan dari
// appointment supaya tidak kosong begitu saja.
const catatanDariAppt = mergeKunjunganHariIni(
  [{ patient_id: 'px_4', payment_type: 'bpjs', td: '', nadi: '', suhu: '', notes: '', created_at: '2026-09-08T01:00:00Z' }],
  [{ patient_id: 'px_4', time_slot: '11:00', queue_number: 2, notes: 'Kontrol diabetes' }]
);
ok('catatan appointment dipakai kalau kedatangan belum punya catatan sendiri',
   () => catatanDariAppt[0].notes === 'Kontrol diabetes');

// Urutan: yang punya jadwal jam tertentu tampil dulu berurutan sesuai jamnya;
// yang cuma kedatangan tanpa jadwal menyusul di bawahnya.
const urutan = mergeKunjunganHariIni(
  [
    { patient_id: 'px_urut_checkin1', payment_type: 'bpjs', notes: '', created_at: '2026-09-08T01:00:00Z' },
    { patient_id: 'px_urut_checkin2', payment_type: 'umum', notes: '', created_at: '2026-09-08T02:00:00Z' },
  ],
  [
    { patient_id: 'px_urut_jam2', time_slot: '14:00', queue_number: 4, notes: '' },
    { patient_id: 'px_urut_jam1', time_slot: '08:00', queue_number: 1, notes: '' },
  ]
);
ok('yang punya jadwal jam tertentu tampil dulu, berurutan sesuai jamnya (08:00 sebelum 14:00)',
   () => urutan.findIndex(x => x.patient_id === 'px_urut_jam1') < urutan.findIndex(x => x.patient_id === 'px_urut_jam2'));
ok('yang cuma kedatangan tanpa jadwal tampil SESUDAH semua yang berjadwal',
   () => urutan.findIndex(x => x.patient_id === 'px_urut_jam2') < urutan.findIndex(x => x.patient_id === 'px_urut_checkin1'));
ok('di antara yang cuma kedatangan tanpa jadwal, urut sesuai waktu didaftarkan (created_at)',
   () => urutan.findIndex(x => x.patient_id === 'px_urut_checkin1') < urutan.findIndex(x => x.patient_id === 'px_urut_checkin2'));

console.log('\n=== (6) KUNJUNGAN HARI INI — SUMBER DATANYA (statis) ===');
ok('appointment hari ini diambil lewat store.getAppointmentsByDoctor, disaring bukan yang completed',
   () => /store\.getAppointmentsByDoctor\(doc\?\.id, todayLocal\(\)\)\s*\n\s*\.filter\(a => a\.status !== 'completed'\)/.test(doctorSrc));
ok('halaman memakai mergeKunjunganHariIni yang sungguhan (window\\.__mergeKunjunganHariIni), bukan logika gabungan yang ditulis ulang di dalam x-data',
   () => doctorSrc.includes('this.checkins = window.__mergeKunjunganHariIni(daftarCheckin, appts);'));
ok('mergeKunjunganHariIni diimpor & disambungkan ke window di app.js',
   () => appSrc.includes('mergeKunjunganHariIni') && /window\.__mergeKunjunganHariIni = mergeKunjunganHariIni;/.test(appSrc));
ok('teks pengantar halaman menyebut KEDUA sumber (didaftarkan admin & sudah punya jadwal)',
   () => doctorSrc.includes('yang didaftarkan admin (BPJS/Umum) maupun yang sudah punya jadwal appointment'));
ok('badge time_slot/nomor antrean ditampilkan berdampingan dengan badge BPJS/UMUM, bukan saling menggantikan',
   () => /x-show="c\.time_slot".*queue_number \|\| c\.time_slot/.test(doctorSrc.replace(/\n/g, ' ')));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
