// Golongan Darah & Pemeriksaan Buta Warna di Surat Keterangan Sehat.
// Dua bagian: (1) dinamis -- benar-benar menerbitkan surat sehat dan
// memeriksa HTML yang tercetak; (2) statis -- memastikan form edit
// (skdedit.js) membaca & menulis field yang SAMA dengan yang dicetak,
// supaya tidak terulang bug yang sama seperti surat rujukan sebelumnya
// (field yang disunting tidak pernah cocok dengan yang dicetak).

import { readFileSync } from 'fs';

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/doctor/emr/p_1',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>null};
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){},setAttribute(){}}),body:{appendChild(){}},addEventListener(){},images:[],head:{appendChild(){}}};
try{global.navigator={onLine:true};}catch(e){}
global.alert=()=>{}; global.confirm=()=>true;

const { CONFIG } = await import('../../js/config.js');
CONFIG.DEMO_MODE = true;
const { store } = await import('../../js/store.js');
const SKD = await import('../../js/skd.js');
window.__store = store;

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};
const jendela = (tulis) => ({ document: { open(){}, write: tulis, close(){} }, focus(){}, close(){} });

console.log('\n=== (1) SURAT SEHAT: GOLONGAN DARAH & BUTA WARNA (dinamis) ===');

const dok = { id: 'd_1' };
const cert = await SKD.createSKD({
  patientId: 'p_1', type: 'sehat', doctor: dok,
  keperluan: 'Melamar pekerjaan', golongan_darah: 'O', buta_warna: 'Buta warna parsial (defisiensi merah-hijau)',
});
ok('surat terbit', () => !!cert);
ok('golongan_darah tersimpan di details', () => cert.details.golongan_darah === 'O');
ok('buta_warna tersimpan di details', () => cert.details.buta_warna === 'Buta warna parsial (defisiensi merah-hijau)');

let cetak = '';
SKD.renderSKDInto(jendela(h => { cetak += h; }), cert);
ok('Golongan Darah tercetak', () => cetak.includes('Golongan Darah') && cetak.includes('>O<'.replace('<','') ) || /Golongan Darah[\s\S]{0,80}>O</.test(cetak) || cetak.includes('O</td>'));
ok('label baris Buta Warna tercetak', () => cetak.includes('Pemeriksaan Buta Warna'));
ok('hasil buta warna tercetak', () => cetak.includes('Buta warna parsial (defisiensi merah-hijau)'));

// Kosong -> tercetak '-', bukan hilang begitu saja atau salah baca "normal".
const cert2 = await SKD.createSKD({ patientId: 'p_1', type: 'sehat', doctor: dok, keperluan: 'Cek rutin' });
let cetak2 = '';
SKD.renderSKDInto(jendela(h => { cetak2 += h; }), cert2);
ok('golongan darah kosong tercetak sebagai "-", bukan hilang', () => /Golongan Darah<\/td><td class="s">:<\/td><td class="v">-<\/td>/.test(cetak2));
ok('buta warna kosong tercetak sebagai "-", bukan disimpulkan normal', () => /Pemeriksaan Buta Warna<\/td><td class="s">:<\/td><td class="v">-<\/td>/.test(cetak2));

// Surat SAKIT & RUJUKAN tidak ikut membawa field ini -- field khusus sehat
// tidak boleh bocor ke jenis surat lain.
const certSakit = await SKD.createSKD({ patientId: 'p_1', type: 'sakit', doctor: dok, diagnosis: 'A09 - Diare', rest_days: 2, from_date: '2026-01-01', to_date: '2026-01-02' });
ok('surat sakit TIDAK membawa golongan_darah/buta_warna', () => !certSakit.details.golongan_darah && !certSakit.details.buta_warna);

console.log('\n=== (2) FORM EDIT COCOK DENGAN YANG DICETAK (statis) ===');

const editSrc = readFileSync('../../js/skdedit.js', 'utf8');
for (const k of ['golongan_darah', 'buta_warna']) {
  ok(`${k}: dibaca saat form edit dibuka (d.${k})`,
     () => new RegExp(`set\\('e_\\w+',\\s*d\\.${k}\\)`).test(editSrc));
  ok(`${k}: ditulis balik saat disimpan (nd.${k} = val(...))`,
     () => new RegExp(`nd\\.${k}\\s*=\\s*val\\(`).test(editSrc));
}

console.log('\n=== (3) FORM PEMBUATAN SURAT (doctor.js & admin.js) ===');
for (const [nama, path] of [['doctor.js', '../../js/pages/doctor.js'], ['admin.js', '../../js/pages/admin.js']]) {
  const src = readFileSync(path, 'utf8');
  ok(`${nama}: dropdown Golongan Darah ada, opsinya A/B/AB/O`,
     () => /x-model="skd\.golongan_darah"/.test(src) && /<option>A<\/option><option>B<\/option><option>AB<\/option><option>O<\/option>/.test(src));
  ok(`${nama}: dropdown Buta Warna ada, tiga pilihan (Normal/Parsial/Total)`,
     () => /x-model="skd\.buta_warna"/.test(src)
       && src.includes('<option>Normal</option><option>Buta warna parsial (defisiensi merah-hijau)</option><option>Buta warna total</option>'));
  ok(`${nama}: skd default object membawa golongan_darah & buta_warna`,
     () => /golongan_darah:[^,]*,\s*buta_warna:\s*''/.test(src));
}

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
