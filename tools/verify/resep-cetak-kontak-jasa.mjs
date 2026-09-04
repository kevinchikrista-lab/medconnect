// Kertas resep yang DICETAK (bukan cuma layar dashboard apotek) juga perlu
// kontak pasien/wali & jasa dokter -- apotek LUAR (rx_target 'luar') cuma
// punya lembar ini, tidak ada akses ke dashboard apotek dalam. Dinamis --
// benar-benar mencetak lewat printResepById() dan store.js sungguhan.

function mk(){const m=new Map();return{getItem:k=>(m.has(k)?m.get(k):null),setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear()};}
global.localStorage=mk(); global.sessionStorage=mk();
global.fetch=async()=>({ok:false,status:0,json:async()=>({})});
let captured = '';
const fakeW = { document: { open(){}, write: (s) => { captured += s; }, close(){} }, focus(){}, close(){} };
global.window={innerWidth:1400,localStorage,sessionStorage,location:{origin:'https://myprima.id',hash:'#/pharmacy/prescriptions',href:'x',pathname:'/'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),alert(){},prompt:()=>'',setTimeout:(f,t)=>setTimeout(f,t),scrollTo(){},__showToast:()=>{},__rerender:()=>{},open:()=>fakeW};
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},appendChild(){},setAttribute(){}}),body:{appendChild(){}},addEventListener(){},images:[],head:{appendChild(){}}};
try{global.navigator={onLine:true};}catch(e){}
global.alert=()=>{}; global.confirm=()=>true;

const { CONFIG } = await import('../../js/config.js');
CONFIG.DEMO_MODE = true;
const { store } = await import('../../js/store.js');
window.__store = store;
const R = await import('../../js/resep.js');

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

console.log('\n=== KERTAS RESEP: KONTAK & JASA (dinamis, store.js + resep.js sungguhan) ===');

// rx_1 (p_1): punya HP pasien, TIDAK punya jasa aktif -- kasus paling umum.
captured = '';
await R.printResepById('rx_1');
ok('No. HP pasien (082345678901) tercetak di kertas resep', () => captured.includes('082345678901'));
ok('alamat pasien tetap tercetak seperti sebelumnya (regresi)', () => captured.includes('Jl. Sudirman No. 45'));
ok('baris Jasa Dokter tercetak walau tidak ada jasa (Rp 0, bukan hilang/kosong)', () => /Jasa Dokter<\/td><td class="s">:<\/td><td class="v">Rp 0<\/td>/.test(captured));
ok('tidak mencetak "mohon ditarik" saat memang tidak ada jasa', () => !captured.includes('mohon ditarik dari pasien'));

// Set wali & jasa aktif pada pasien/resep yang sama, cetak ulang.
const p1 = store.data.patients.find(p => p.id === 'p_1');
const backupP1 = { family_name: p1.family_name, family_phone: p1.family_phone, family_relation: p1.family_relation };
p1.family_name = 'Siti Aminah'; p1.family_phone = '081399988877'; p1.family_relation = 'Ibu';
const rx1 = store.data.prescriptions.find(r => r.id === 'rx_1');
const backupRx1 = { service_fee_enabled: rx1.service_fee_enabled, service_fee: rx1.service_fee };
rx1.service_fee_enabled = true; rx1.service_fee = 50000;

captured = '';
await R.printResepById('rx_1');
ok('nama & hubungan wali tercetak (Siti Aminah, Ibu)', () => captured.includes('Siti Aminah') && captured.includes('(Ibu)'));
ok('No. HP wali tercetak (081399988877)', () => captured.includes('081399988877'));
ok('jasa yang sungguhan aktif tercetak dengan nominalnya (Rp 50.000)', () => captured.includes('Rp 50.000'));
ok('peringatan "mohon ditarik dari pasien" muncul saat jasanya memang ada', () => captured.includes('mohon ditarik dari pasien'));

// Kembalikan data demo seperti semula -- berkas verify lain memakai p_1/rx_1 juga.
Object.assign(p1, backupP1);
Object.assign(rx1, backupRx1);

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
