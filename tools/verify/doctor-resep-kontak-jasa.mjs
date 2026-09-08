// Riwayat E-Resep sisi DOKTER menampilkan info yang sama seperti sisi apotek:
// kontak pasien (HP pasien / wali), alamat pasien, dan jasa dokter (SELALU
// ditampilkan, termasuk saat Rp 0). Dinamis -- memanggil doctorPrescriptions()
// sungguhan dengan data demo, memeriksa HTML yang benar-benar dihasilkan.

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
sessionStorage.setItem('medconnect_user', JSON.stringify({ id: 'u_doc1', role: 'doctor' }));
const { doctorPrescriptions } = await import('../../js/pages/doctor.js');

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== RIWAYAT E-RESEP DOKTER — KONTAK & JASA (dinamis, HTML sungguhan) ===');

const p1Sebelum = { ...store.getPatient('p_1') };

const htmlAwal = doctorPrescriptions();
ok('halaman memuat resep rx_1 (R-2026-0142) milik dokter ini', () => htmlAwal.includes('R-2026-0142'));
ok('kartu "Kontak Pasien" muncul di setiap resep', () => (htmlAwal.match(/Kontak Pasien/g) || []).length >= 4);
ok('nomor HP pasien (p_1) ditampilkan sebagai link tel:', () => htmlAwal.includes('tel:082345678901') && htmlAwal.includes('082345678901'));
ok('alamat pasien (p_1) ditampilkan', () => htmlAwal.includes('Jl. Sudirman No. 45, Jakarta Selatan'));
ok('pasien TANPA wali (p_1 di data demo) tidak menampilkan baris Keluarga/Wali kosong', () => {
  // Potong bagian resep rx_1 saja, supaya tidak ikut mencocokkan resep pasien lain.
  const mulai = htmlAwal.indexOf('R-2026-0142');
  const akhir = htmlAwal.indexOf('R-2026-0145');
  const bagianRx1 = htmlAwal.slice(mulai, akhir > mulai ? akhir : undefined);
  return !bagianRx1.includes('Keluarga / Wali');
});
ok('Jasa Dokter SELALU ditampilkan walau Rp 0 (rx_1 tidak punya service_fee_enabled di data demo)',
   () => (htmlAwal.match(/Jasa Dokter/g) || []).length >= 4 && htmlAwal.includes('Rp 0'));

// Ubah data pasien & resep sementara untuk membuktikan kasus "ADA wali" dan
// "jasa > 0" benar-benar dibaca dari data, bukan teks statis yang kebetulan
// selalu sama. Dikembalikan lagi sesudahnya.
const p1 = store.data.patients.find(p => p.id === 'p_1');
const rx1 = store.data.prescriptions.find(r => r.id === 'rx_1');
const rx1Sebelum = { ...rx1 };
Object.assign(p1, { family_name: 'Ani Santoso', family_phone: '082345678999', family_relation: 'Istri' });
Object.assign(rx1, { service_fee_enabled: true, service_fee: 75000 });

const htmlUbah = doctorPrescriptions();
ok('sesudah diisi, baris Keluarga/Wali MUNCUL dengan nama, hubungan & nomor HP-nya',
   () => htmlUbah.includes('Ani Santoso') && htmlUbah.includes('(Istri)') && htmlUbah.includes('tel:082345678999'));
ok('sesudah jasa diisi > 0, ditampilkan nominalnya dengan penanda "mohon ditarik dari pasien"',
   () => htmlUbah.includes('Rp 75.000') && htmlUbah.includes('mohon ditarik dari pasien'));

// Kembalikan seperti semula -- berkas verify lain memakai data yang sama.
// p1Sebelum tidak punya kunci family_* sama sekali (data demo aslinya
// memang tidak mengisinya), jadi Object.assign saja tidak cukup untuk
// MENGHAPUS kunci yang baru ditambahkan di atas -- harus dihapus eksplisit.
delete p1.family_name; delete p1.family_phone; delete p1.family_relation;
Object.assign(p1, p1Sebelum);
delete rx1.service_fee_enabled; delete rx1.service_fee;
Object.assign(rx1, rx1Sebelum);
ok('data pasien & resep berhasil dikembalikan seperti semula', () => {
  const htmlSetelah = doctorPrescriptions();
  return !htmlSetelah.includes('Ani Santoso') && htmlSetelah.includes('Rp 0');
});

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
