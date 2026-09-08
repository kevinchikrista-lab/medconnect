// Home Care: alamat kunjungan (location_detail) + riwayat alamat tambahan
// pasien (patient_addresses). patients.address tetap alamat utama, tidak
// pernah ditimpa -- alamat BARU yang berbeda otomatis tersimpan sebagai
// alamat tambahan saat dokter mencatat kunjungan Home Care. Dinamis --
// lewat store.js yang sungguhan.

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

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== ALAMAT PASIEN — UTAMA & TAMBAHAN (dinamis, store.js sungguhan) ===');

const p2 = store.getPatient('p_2'); // 'Jl. Gatot Subroto No. 12, Jakarta Selatan'
ok('getPatientAddresses awalnya hanya berisi alamat utama pasien',
   () => { const a = store.getPatientAddresses('p_2'); return a.length === 1 && a[0] === p2.address; });

const hasilDup = await store.addPatientAddress('p_2', p2.address.toUpperCase() + '  ');
ok('addPatientAddress menolak (skip) alamat yang sama dengan alamat utama (tanpa peduli kapital/spasi)',
   () => hasilDup.skipped === true);
ok('daftar alamat TIDAK bertambah setelah percobaan duplikat', () => store.getPatientAddresses('p_2').length === 1);

const hasilBaru = await store.addPatientAddress('p_2', 'Jl. Kos Anak No. 7, Depok');
ok('addPatientAddress berhasil menambah alamat yang benar-benar baru', () => hasilBaru.success === true);
ok('getPatientAddresses sekarang memuat alamat utama + alamat baru itu', () => {
  const a = store.getPatientAddresses('p_2');
  return a.length === 2 && a[0] === p2.address && a.includes('Jl. Kos Anak No. 7, Depok');
});

const hasilDup2 = await store.addPatientAddress('p_2', ' jl. kos anak no. 7, depok ');
ok('menambahkan alamat yang sama (beda kapital/spasi) dengan alamat TAMBAHAN yang sudah ada juga di-skip',
   () => hasilDup2.skipped === true && store.getPatientAddresses('p_2').length === 2);

const tanpaPatientId = await store.addPatientAddress('', 'Jl. Contoh');
const tanpaAlamat = await store.addPatientAddress('p_2', '   ');
ok('addPatientAddress menolak (skip) tanpa patientId atau alamat kosong',
   () => tanpaPatientId.skipped === true && tanpaAlamat.skipped === true);

console.log('\n=== createRecord: KUNJUNGAN HOME CARE OTOMATIS MENYIMPAN ALAMAT BARU (dinamis) ===');

const p3 = store.getPatient('p_3'); // 'Jl. Rasuna Said No. 8, Jakarta Selatan'
ok('p_3 belum punya alamat tambahan di awal', () => store.getPatientAddresses('p_3').length === 1);

const recHC = await store.createRecord({
  patient_id: 'p_3', doctor_id: 'd_1', diagnosis: 'Kontrol tekanan darah', therapy: '-',
  location: 'Home Care', location_detail: 'Rumah anak, Jl. Melati No. 9, Jakarta Selatan',
});
ok('rekam medis Home Care tersimpan dengan location_detail-nya', () => recHC.location_detail === 'Rumah anak, Jl. Melati No. 9, Jakarta Selatan');
ok('alamat baru itu OTOMATIS masuk sebagai alamat tambahan pasien', () => {
  const a = store.getPatientAddresses('p_3');
  return a.length === 2 && a.includes('Rumah anak, Jl. Melati No. 9, Jakarta Selatan');
});

// Kunjungan Home Care KEDUA ke alamat yang SAMA -- tidak boleh dobel di
// daftar alamat, walau history rekam medisnya sendiri tetap dua baris.
const recHC2 = await store.createRecord({
  patient_id: 'p_3', doctor_id: 'd_1', diagnosis: 'Kontrol ulang', therapy: '-',
  location: 'Home Care', location_detail: 'Rumah anak, Jl. Melati No. 9, Jakarta Selatan',
});
ok('kunjungan Home Care kedua ke alamat yang SAMA tidak menggandakan daftar alamat',
   () => store.getPatientAddresses('p_3').length === 2);
ok('tapi rekam medisnya sendiri tetap tercatat sebagai kunjungan terpisah (riwayat)', () => recHC2.id !== recHC.id);

// Kunjungan Home Care dengan alamat SAMA PERSIS dengan alamat utama pasien
// (bukan tambahan, mis. rumahnya sendiri) -- tidak menambah entri baru.
const p4 = store.getPatient('p_4');
const recHCUtama = await store.createRecord({
  patient_id: 'p_4', doctor_id: 'd_1', diagnosis: 'Kontrol', therapy: '-',
  location: 'Home Care', location_detail: p4.address,
});
ok('Home Care ke alamat utama pasien sendiri tidak menambah alamat tambahan (bukan alamat baru)',
   () => store.getPatientAddresses('p_4').length === 1);

// Kunjungan BUKAN Home Care (mis. di klinik) dengan location_detail terisi
// (jarang, tapi kalau ada) TIDAK ikut disimpan sebagai alamat pasien --
// hanya kunjungan Home Care yang berarti "alamat rumah yang dikunjungi".
const p5 = store.getPatient('p_5');
await store.createRecord({
  patient_id: 'p_5', doctor_id: 'd_1', diagnosis: 'Kontrol', therapy: '-',
  location: 'Klinik Utama Prima', location_detail: 'Alamat yang seharusnya diabaikan',
});
ok('location_detail pada kunjungan BUKAN Home Care tidak ikut disimpan sebagai alamat pasien',
   () => store.getPatientAddresses('p_5').length === 1);

console.log('\n=== updateRecord: MENYUNTING LOKASI JADI HOME CARE JUGA MENYIMPAN ALAMAT (dinamis) ===');

const p1SebelumEdit = store.getPatientAddresses('p_1').length;
const recBiasa = await store.createRecord({ patient_id: 'p_1', doctor_id: 'd_1', diagnosis: 'Kontrol', therapy: '-', location: 'Klinik Utama Prima' });
const hasilUpdate = store.updateRecord(recBiasa.id, { location: 'Home Care', location_detail: 'Ruko Kantor, Jl. Sudirman No. 99, Jakarta Selatan' });
ok('updateRecord berhasil', () => hasilUpdate.success === true);
ok('mengubah rekam medis lama jadi Home Care (lewat edit) juga menyimpan alamat barunya',
   () => store.getPatientAddresses('p_1').length === p1SebelumEdit + 1 && store.getPatientAddresses('p_1').includes('Ruko Kantor, Jl. Sudirman No. 99, Jakarta Selatan'));

console.log('\n=== TAMPILAN & SKEMA (statis) ===');

const doctorSrc = readFileSync('../../js/pages/doctor.js', 'utf8');
const storeSrc = readFileSync('../../js/store.js', 'utf8');
const sqlSrc = readFileSync('../../supabase-homecare-address.sql', 'utf8');

ok('location_detail termasuk kolom opsional rekam medis (migrasi belum tentu sudah jalan)',
   () => /const KOLOM_RM_BARU = \[.*'location_detail'.*\]/.test(storeSrc));
ok('SQL migrasi menambah medical_records.location_detail & tabel patient_addresses, aman diulang',
   () => sqlSrc.includes('ADD COLUMN IF NOT EXISTS location_detail')
      && sqlSrc.includes('CREATE TABLE IF NOT EXISTS public.patient_addresses')
      && sqlSrc.includes('DROP POLICY IF EXISTS "Authenticated full access patient_addresses"'));
ok('updateRecord punya jalur cadangan tanpa kolom location_detail (migrasi belum tentu sudah jalan)',
   () => /'location_detail' in updates/.test(storeSrc));
ok('form Kunjungan Baru menampilkan kolom alamat khusus saat lokasi = Home Care',
   () => /form\.location\s*===\s*'Home Care'/.test(doctorSrc) && doctorSrc.includes('location_detail'));
ok('kolom alamat Home Care punya pilihan dari alamat pasien yang sudah dikenal (getPatientAddresses)',
   () => doctorSrc.includes('getPatientAddresses'));
ok('kolom alamat terisi otomatis begitu Lokasi diganti ke Home Care (bukan dibiarkan kosong)',
   () => (doctorSrc.match(/onLokasiBerubah\(\) \{\s*\n\s*if \(this\.form\.location === 'Home Care' && !this\.form\.location_detail\) this\.form\.location_detail = this\.homeCareAddrChoices\[0\] \|\| '';/g) || []).length === 2);
ok('tombol simpan (baru & edit) dikunci selama kunjungan Home Care belum diisi alamatnya',
   () => (doctorSrc.match(/form\.location === 'Home Care' && !form\.location_detail\.trim\(\)/g) || []).length === 2);
ok('form Kunjungan Baru & Edit SAMA-SAMA punya kolom alamat Home Care (bukan cuma salah satu)',
   () => (doctorSrc.match(/Alamat Home Care \(rumah yang dikunjungi\)/g) || []).length === 2);

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
