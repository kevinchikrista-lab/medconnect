// Panel "Riwayat Rekam Medis" (dibuka dokter saat membuat Kunjungan Baru)
// menampilkan kunjungan-kunjungan lama pasien -- tapi sebelumnya hanya
// menyebut "Terapi" (kalimat bebas non-obat), tidak pernah menyebut e-resep
// yang sungguhan diresepkan. (1) dinamis -- window.__oldRecords benar-benar
// dibangun dari store.js sungguhan; (2) statis -- panel-nya benar-benar
// merender apa yang ada di window.__oldRecords.

import { readFileSync } from 'fs';

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/doctor/emr/p_1/new',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>null};
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){},setAttribute(){}}),body:{appendChild(){}},addEventListener(){},images:[],head:{appendChild(){}}};
try{global.navigator={onLine:true};}catch(e){}
global.alert=()=>{}; global.confirm=()=>true;

const { CONFIG } = await import('../../js/config.js');
CONFIG.DEMO_MODE = true;
const { store } = await import('../../js/store.js');
window.__store = store;
sessionStorage.setItem('medconnect_user', JSON.stringify({ id: 'u_doc1', role: 'doctor' }));

const D = await import('../../js/pages/doctor.js');

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== (1) window.__oldRecords MEMBAWA E-RESEP (dinamis, store.js sungguhan) ===');

D.doctorEMRNew({ patientId: 'p_1' });
const mr1 = (window.__oldRecords || []).find(r => r.id === 'mr_1');
ok('rekam medis lama (mr_1) ikut termuat', () => !!mr1);
ok('membawa array prescriptions, bukan cuma teks therapy', () => Array.isArray(mr1.prescriptions) && mr1.prescriptions.length > 0);
const rx1 = (mr1.prescriptions || []).find(r => r.rx_number === 'R-2026-0142');
ok('resep rx_1 (R-2026-0142) ditemukan dengan nama apotek & status', () => rx1 && rx1.pharmacy_name === 'Apotek Sehat Farma' && rx1.status_label);
ok('obat biasa (Amoxicillin) ikut termuat dengan dosis lengkap', () =>
   rx1.items.some(i => i.drug_name === 'Amoxicillin' && i.dosage === '500mg' && i.frequency === '3 x 1'));
ok('obat racikan ikut termuat dengan compound_details, bukan cuma nama', () =>
   rx1.items.some(i => i.is_compound && i.display_name === 'Obat Batuk Pilek 3x1 kapsul' && i.compound_details.includes('Codein')));

// Kunjungan tanpa e-resep sama sekali: prescriptions array kosong, bukan
// undefined -- panel Alpine-nya pakai (selectedOld.prescriptions || []),
// tapi array kosong yang konsisten tetap lebih aman daripada mengandalkan itu.
const mrTanpaResep = (window.__oldRecords || []).find(r => !(r.prescriptions || []).length);
ok('kunjungan tanpa e-resep tetap punya array prescriptions (kosong, bukan hilang)',
   () => mrTanpaResep ? Array.isArray(mrTanpaResep.prescriptions) : true);

console.log('\n=== (2) PANEL MERENDER E-RESEP-NYA (statis) ===');

const doctorSrc = readFileSync('../../js/pages/doctor.js', 'utf8');
ok('window.__oldRecords menyertakan prescriptions lewat getPrescriptionsByRecord',
   () => /prescriptions: store\.getPrescriptionsByRecord\(r\.id\)\.map/.test(doctorSrc));
ok('tiap resep membawa item lewat getPrescriptionItems (bukan cuma header resepnya)',
   () => /items: store\.getPrescriptionItems\(rx\.id\)\.map/.test(doctorSrc));
ok('panel oldRecordsPanelInner benar-benar me-render selectedOld.prescriptions',
   () => /x-for="rx in \(selectedOld\.prescriptions \|\| \[\]\)"/.test(doctorSrc));
ok('racikan dibedakan dari obat biasa saat dirender (compound_details ikut ditampilkan)',
   () => /i\.is_compound \? \(i\.display_name \+ ' \(Racikan\): ' \+ i\.compound_details\)/.test(doctorSrc));
ok('label "Terapi" lama diganti jadi "Terapi Non-Farmakologis" supaya tidak dikira mencakup obat',
   () => doctorSrc.includes('Terapi Non-Farmakologis</p><p class="text-gray-700 whitespace-pre-line" x-text="selectedOld.therapy"'));

console.log('\n=== (3) RIWAYAT REKAM MEDIS DI HALAMAN ADMIN (dinamis, admin.js sungguhan) ===');

const A = await import('../../js/pages/admin.js');
const adminHtml = A.adminPatientDetail({ patientId: 'p_1' });
ok('e-resep mr_1 (nomor & apotek) tercetak di halaman admin', () => adminHtml.includes('R-2026-0142') && adminHtml.includes('Apotek Sehat Farma'));
ok('obat biasa (Amoxicillin, dosis, aturan pakai) tercetak di halaman admin', () => adminHtml.includes('Amoxicillin') && adminHtml.includes('500mg') && adminHtml.includes('3 x 1'));
ok('obat racikan (dengan compound_details) tercetak di halaman admin', () => adminHtml.includes('Obat Batuk Pilek 3x1 kapsul') && adminHtml.includes('Codein'));
ok('label lama "Terapi:" diganti "Terapi Non-Farmakologis:" di halaman admin', () => adminHtml.includes('Terapi Non-Farmakologis:'));

console.log('\n=== (4) RIWAYAT REKAM MEDIS DI HALAMAN PASIEN (dinamis, patient.js sungguhan) ===');

sessionStorage.setItem('medconnect_user', JSON.stringify({ id: 'u_pat1', role: 'patient' }));
const P = await import('../../js/pages/patient.js');
const patientHtml = P.patientHistory();
ok('e-resep mr_1 (nomor & apotek) tercetak di halaman riwayat pasien', () => patientHtml.includes('R-2026-0142') && patientHtml.includes('Apotek Sehat Farma'));
ok('obat biasa (Amoxicillin, dosis, aturan pakai) tercetak di halaman riwayat pasien', () => patientHtml.includes('Amoxicillin') && patientHtml.includes('500mg') && patientHtml.includes('3 x 1'));
ok('obat racikan (dengan compound_details) tercetak di halaman riwayat pasien', () => patientHtml.includes('Obat Batuk Pilek 3x1 kapsul') && patientHtml.includes('Codein'));
ok('badge "resep" masih memakai jumlah e-resep sungguhan (getPrescriptionsByRecord), bukan hitungan lama', () => /const rxList = store\.getPrescriptionsByRecord\(r\.id\)/.test(readFileSync('../../js/pages/patient.js', 'utf8')));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
