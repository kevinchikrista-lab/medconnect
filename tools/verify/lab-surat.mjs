// Surat Keterangan Hasil Pemeriksaan & Bebas Narkoba.
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
const L = await import('../../js/lab-panel.js');
const D = await import('../../js/pages/doctor.js');
window.__store = store;

let fails=0;
const ok=(n,c)=>{let r=false,e='';try{r=!!c();}catch(x){r=false;e=' ('+x.message+')';}if(!r)fails++;console.log(`  ${r?'✅':'❌'} ${n}${r?'':e}`);return r;};
const cari = L.cariPanel;

// ===========================================================================
console.log('\n=== (1) KATALOGNYA MASUK AKAL ===');
// ===========================================================================
ok('memuat yang diminta: gula darah, asam urat, kolesterol',
   () => ['gds','asam_urat','kolesterol'].every(k => cari(k)));
ok('HbsAg ada dan hasilnya reaktif/non-reaktif', () => {
  const t = cari('hbsag');
  return t.jenis === 'pilihan' && t.pilihan.join() === 'Non-reaktif,Reaktif';
});
// Rapid test menunjukkan reaksi, bukan menegakkan diagnosis. Surat yang
// menulis 'positif HIV' menyatakan hal yang tidak dibuktikan pemeriksaan itu.
ok('serologi memakai Reaktif/Non-reaktif, bukan Positif/Negatif',
   () => ['hbsag','anti_hiv','anti_hcv','vdrl','tpha'].every(k => cari(k).pilihan.join() === 'Non-reaktif,Reaktif'));
ok('VDRL dan TPHA terpisah, bukan satu baris gabungan', () => !cari('sifilis') && !!cari('vdrl') && !!cari('tpha'));
ok('panel narkoba lengkap enam golongan', () => {
  const n = L.LAB_PANEL.filter(t => t.kelompok === 'Narkoba');
  return n.length === 6 && ['amp','met','thc','mop','coc','bzo'].every(k => n.some(t => t.key === k));
});
ok('narkoba memakai Negatif/Positif', () =>
   L.LAB_PANEL.filter(t => t.kelompok === 'Narkoba').every(t => t.pilihan.join() === 'Negatif,Positif'));
ok('buta warna ada', () => !!cari('buta_warna'));
ok('tiap pemeriksaan punya nama, kelompok, dan jenis',
   () => L.LAB_PANEL.every(t => t.key && t.nama && t.kelompok && (t.jenis === 'angka' || t.jenis === 'pilihan')));
ok('yang berjenis angka punya satuan',
   () => L.LAB_PANEL.filter(t => t.jenis === 'angka').every(t => t.satuan));
ok('yang berjenis pilihan punya daftar pilihannya',
   () => L.LAB_PANEL.filter(t => t.jenis === 'pilihan').every(t => (t.pilihan || []).length >= 2));
ok('tidak ada kunci yang kembar',
   () => new Set(L.LAB_PANEL.map(t => t.key)).size === L.LAB_PANEL.length);
ok('semua kelompoknya terdaftar',
   () => L.LAB_PANEL.every(t => L.KELOMPOK.indexOf(t.kelompok) !== -1));

// ===========================================================================
console.log('\n=== (2) RENTANG YANG BERBEDA MENURUT JENIS KELAMIN ===');
// ===========================================================================
// Asam urat 6,5 mg/dL: NORMAL pada laki-laki, TINGGI pada perempuan. Memakai
// satu rentang untuk keduanya salah pada separuh pasiennya.
const au = cari('asam_urat');
ok('asam urat 6,5 pada laki-laki: normal',
   () => L.nilaiHasil(au, '6,5', 'Laki-laki').status === 'normal');
ok('asam urat 6,5 pada perempuan: TINGGI',
   () => L.nilaiHasil(au, '6,5', 'Perempuan').status === 'tinggi');
ok('rujukan yang tercetak ikut berbeda',
   () => L.teksRujukan(au, 'Laki-laki') !== L.teksRujukan(au, 'Perempuan'));
ok('Hb juga berbeda menurut jenis kelamin', () => {
  const hb = cari('hb');
  return L.nilaiHasil(hb, '12.5', 'Laki-laki').status === 'rendah'
      && L.nilaiHasil(hb, '12.5', 'Perempuan').status === 'normal';
});
// Menebak berarti surat menyatakan 'normal' berdasarkan rentang yang belum
// tentu berlaku untuk orangnya.
ok('jenis kelamin tidak diketahui: rentangnya TIDAK ditebak',
   () => L.rentangUntuk(au, '').tahu === false);
ok('...dan hasilnya tidak dinilai sama sekali',
   () => L.nilaiHasil(au, '6,5', '').status === '');
ok('...rujukan yang tercetak dikosongkan, bukan diisi rentang laki-laki',
   () => L.teksRujukan(au, '') === '');
ok('pemeriksaan yang rentangnya sama tetap dinilai tanpa jenis kelamin',
   () => L.nilaiHasil(cari('kolesterol'), '250', '').status === 'tinggi');

// ===========================================================================
console.log('\n=== (3) MENILAI HASIL ===');
// ===========================================================================
ok('kolesterol 250: tinggi (H)', () => {
  const r = L.nilaiHasil(cari('kolesterol'), '250', 'Laki-laki');
  return r.status === 'tinggi' && r.tanda === 'H';
});
ok('kolesterol 180: normal, tanpa tanda', () => {
  const r = L.nilaiHasil(cari('kolesterol'), '180', 'Laki-laki');
  return r.status === 'normal' && r.tanda === '';
});
ok('gula darah puasa 60: rendah (L)', () => {
  const r = L.nilaiHasil(cari('gdp'), '60', 'Laki-laki');
  return r.status === 'rendah' && r.tanda === 'L';
});
// Di sini orang menulis 6,5 bukan 6.5. Menolak koma hanya akan membuat
// angkanya dimasukkan salah.
ok('koma diterima sebagai pemisah desimal', () => L.keAngka('6,5') === 6.5);
ok('titik juga diterima', () => L.keAngka('6.5') === 6.5);
ok('bukan angka: null, bukan 0', () => L.keAngka('abc') === null && L.keAngka('') === null);
// '' berarti TIDAK DINILAI — bukan normal. Hasil yang tidak bisa dinilai
// tidak boleh tampil seolah sudah dinilai dan ternyata baik.
ok('hasil yang bukan angka tidak dinilai, bukan dianggap normal',
   () => L.nilaiHasil(cari('kolesterol'), 'tinggi sekali', 'Laki-laki').status === '');
ok('HbsAg non-reaktif: normal', () => L.nilaiHasil(cari('hbsag'), 'Non-reaktif', '').status === 'normal');
ok('HbsAg reaktif: perlu perhatian (*)', () => {
  const r = L.nilaiHasil(cari('hbsag'), 'Reaktif', '');
  return r.status === 'perhatian' && r.tanda === '*';
});
// Anti-HBs terbalik: yang REAKTIF justru normal (sudah ada kekebalan).
ok('Anti-HBs reaktif: normal — terbalik dari HbsAg',
   () => L.nilaiHasil(cari('anti_hbs'), 'Reaktif', '').status === 'normal');
ok('...dan non-reaktif justru perlu perhatian',
   () => L.nilaiHasil(cari('anti_hbs'), 'Non-reaktif', '').status === 'perhatian');
// Tes kehamilan tidak punya jawaban 'normal' — positif bukan kelainan.
ok('tes kehamilan tidak dinilai normal/tidak',
   () => L.nilaiHasil(cari('hcg'), 'Positif', '').status === ''
      && L.nilaiHasil(cari('hcg'), 'Negatif', '').status === '');
ok('golongan darah juga tidak dinilai',
   () => L.nilaiHasil(cari('gol_darah'), 'O / Rh+', '').status === '');

// ===========================================================================
console.log('\n=== (4) MENYUSUN BARIS SURAT ===');
// ===========================================================================
const items = L.susunHasil([
  { key: 'gds', hasil: '250' },
  { key: 'asam_urat', hasil: '6,5' },
  { key: 'hbsag', hasil: 'Non-reaktif' },
  // Dicentang tapi TIDAK diisi: barisnya yang kosong akan terbaca sebagai
  // 'diperiksa, hasilnya tidak ada', padahal yang benar adalah belum diperiksa.
  { key: 'kolesterol', hasil: '' },
  { key: 'kolesterol', hasil: '   ' },
  { key: 'pemeriksaan_ngawur', hasil: '5' },
], 'Perempuan');
ok('yang tanpa hasil tidak ikut', () => items.every(i => i.key !== 'kolesterol'));
ok('kunci yang tidak dikenal diabaikan', () => items.every(i => i.key !== 'pemeriksaan_ngawur'));
ok('tiga baris tersusun', () => items.length === 3);
ok('membawa nama, hasil, satuan, rujukan', () => {
  const g = items.find(i => i.key === 'gds');
  return g.nama && g.hasil === '250' && g.satuan === 'mg/dL' && g.rujukan;
});
ok('tanda H ikut dibawa', () => items.find(i => i.key === 'gds').tanda === 'H');
ok('rentang perempuan yang dipakai, bukan laki-laki',
   () => items.find(i => i.key === 'asam_urat').tanda === 'H');
ok('jenis pilihan tidak diberi satuan', () => items.find(i => i.key === 'hbsag').satuan === '');
// Reagen tiap klinik berbeda; yang tercetak harus rentang alat yang dipakai.
const ubah = L.susunHasil([{ key: 'kolesterol', hasil: '190', rujukan: '< 180 (alat kami)' }], 'Laki-laki');
ok('nilai rujukan boleh ditimpa per surat', () => ubah[0].rujukan === '< 180 (alat kami)');

// ===========================================================================
console.log('\n=== (5) KESIMPULAN BEBAS NARKOBA ===');
// ===========================================================================
const semuaNeg = L.susunHasil(
  ['amp','met','thc','mop','coc','bzo'].map(k => ({ key: k, hasil: 'Negatif' })), 'Laki-laki');
ok('enam golongan negatif: bebas', () => /negatif terhadap 6 golongan/i.test(L.kalimatNarkoba(semuaNeg)));
const adaPos = L.susunHasil([
  { key: 'amp', hasil: 'Negatif' }, { key: 'thc', hasil: 'Positif' },
], 'Laki-laki');
ok('ada yang positif: kesimpulannya positif', () => /^Positif terhadap/.test(L.kalimatNarkoba(adaPos)));
ok('...dan menyebut golongan mana', () => /THC/.test(L.kalimatNarkoba(adaPos)));
// Panel 3 dan panel 6 sama-sama dipakai. Surat yang menyebut golongan yang
// tidak diperiksa adalah surat yang menyatakan sesuatu yang tidak dikerjakan.
const panel3 = L.susunHasil(['amp','met','thc'].map(k => ({ key: k, hasil: 'Negatif' })), '');
ok('panel 3: kesimpulannya menyebut 3, bukan 6', () => /3 golongan/.test(L.kalimatNarkoba(panel3)));
ok('tidak ada satu pun dicentang: TIDAK menyimpulkan apa-apa',
   () => L.kalimatNarkoba([]) === '');
ok('hasil lab non-narkoba tidak ikut jadi kesimpulan narkoba',
   () => L.kalimatNarkoba(L.susunHasil([{ key: 'gds', hasil: '90' }], '')) === '');
ok('kesimpulanNarkoba menolak menyimpulkan saat kosong',
   () => L.kesimpulanNarkoba([]).bisa === false);
// Ini yang melindungi dokter yang menandatanganinya.
ok('kalimat penapisan menyebut perlunya konfirmasi',
   () => /konfirmasi/i.test(L.CATATAN_NARKOBA));
ok('...dan bahwa negatif tidak meniadakan pemakaian',
   () => /tidak meniadakan/i.test(L.CATATAN_NARKOBA));

// ===========================================================================
console.log('\n=== (6) SURATNYA TERBIT & TERCETAK ===');
// ===========================================================================
const dok = { id:'d_1', full_name:'dr. Kevin Chikrista', sip_number:'SIP-123' };
store.data.doctors = [dok];
store.data.patients = [{ id:'p_1', full_name:'Budi Santoso', rm_number:'RM-2026-0001',
  birth_date:'1990-01-01', gender:'Laki-laki', address:'Pontianak', nik:'3174041503810001' }];
store.data.users = [{ id:'u_k', email:'kevinchikrista@gmail.com', role:'owner' }];
store._save();
sessionStorage.setItem('medconnect_user', JSON.stringify(store.data.users[0]));
sessionStorage.setItem('medconnect_profile', JSON.stringify(dok));

const SKD = await import('../../js/skd.js');
const suratLab = await SKD.createSKD({
  patientId: 'p_1', type: 'lab', doctor: dok,
  lab_items: L.susunHasil([{ key:'gds', hasil:'250' }, { key:'hbsag', hasil:'Non-reaktif' }], 'Laki-laki'),
  lab_keperluan: 'Melamar pekerjaan', lab_metode: 'rapid test',
});
ok('surat lab terbit', () => !!suratLab);
ok('perihalnya LABORATORIUM', () => suratLab.perihal === 'LABORATORIUM');
// Buku nomor sendiri: menggabungkannya membuat nomor melompat mengikuti surat
// lain yang terbit di sela-selanya.
ok('nomornya memakai buku LAB, bukan SKD', () => /\/LAB\//.test(suratLab.cert_number));
ok('hasilnya dibekukan ke dalam surat', () => (suratLab.details.lab_items || []).length === 2);
ok('keperluannya ikut', () => suratLab.details.lab_keperluan === 'Melamar pekerjaan');

const suratNar = await SKD.createSKD({
  patientId: 'p_1', type: 'narkoba', doctor: dok,
  lab_items: semuaNeg, lab_kesimpulan: L.kalimatNarkoba(semuaNeg), lab_catatan: L.CATATAN_NARKOBA,
});
ok('surat narkoba terbit dengan perihal NARKOBA', () => suratNar.perihal === 'NARKOBA');
ok('kesimpulannya ikut dibekukan', () => /negatif terhadap 6/i.test(suratNar.details.lab_kesimpulan));

// --- yang benar-benar tercetak ---
let dicetak = '';
const jendela = (tulis) => ({ document: { open(){}, write: tulis, close(){} }, focus(){}, close(){} });
const w = jendela((h) => { dicetak += h; });
SKD.renderSKDInto(w, suratLab);
ok('judul suratnya SURAT KETERANGAN HASIL PEMERIKSAAN', () => /SURAT KETERANGAN HASIL PEMERIKSAAN/.test(dicetak));
ok('perihalnya HASIL LABORATORIUM', () => /Perihal : SURAT KETERANGAN HASIL LABORATORIUM/.test(dicetak));
ok('tabel hasilnya ada', () => /<table class="lab">/.test(dicetak));
// Hasil tanpa rujukannya memaksa yang membacanya mencari sendiri angka
// pembandingnya — dan surat begitu tidak bisa dibaca siapa pun selain penulisnya.
ok('kolom Nilai Rujukan ikut tercetak', () => /Nilai Rujukan/.test(dicetak));
ok('nama & hasil pemeriksaan tercetak', () => /Glukosa Darah Sewaktu/.test(dicetak) && /250/.test(dicetak));
ok('satuannya tercetak', () => /mg\/dL/.test(dicetak));
ok('tanda H tercetak DI DALAM baris hasilnya, bukan cuma di keterangannya',
   () => /250\s*<b>H<\/b>/.test(dicetak));
ok('yang normal tidak diberi tanda apa pun',
   () => /Non-reaktif<\/td>/.test(dicetak) && !/Non-reaktif\s*<b>/.test(dicetak));
ok('keterangan arti H/L tercetak', () => /di atas nilai rujukan/.test(dicetak));
ok('peringatan bahwa rujukan bergantung metode ikut tercetak',
   () => /dapat berbeda menurut metode/.test(dicetak));
ok('kop Klinik Prima dipakai', () => /KLINIK KASIH ANUGERAH PRIMA/.test(dicetak));

let cetakNar = '';
const w2 = jendela((h) => { cetakNar += h; });
SKD.renderSKDInto(w2, suratNar);
ok('judul surat narkoba: BEBAS NARKOBA', () => /SURAT KETERANGAN BEBAS NARKOBA/.test(cetakNar));
ok('kesimpulannya tercetak', () => /NEGATIF TERHADAP 6 GOLONGAN/.test(cetakNar));
ok('keenam golongannya tersebut satu per satu', () => /Amphetamine/.test(cetakNar) && /THC/.test(cetakNar));
// Surat yang menyimpulkan tanpa menyebut batas pemeriksaannya menyatakan
// lebih daripada yang bisa dibuktikan alatnya.
ok('kalimat penapisan WAJIB ikut tercetak', () => /tes penapisan \(skrining\)/.test(cetakNar));

// ===========================================================================
console.log('\n=== (7) LAYARNYA ===');
// ===========================================================================
const H = D.doctorEMR({ patientId: 'p_1' });
ok('tombol Hasil Laboratorium ada', () => /Hasil Laboratorium/.test(H));
ok('tombol Bebas Narkoba ada', () => /Bebas Narkoba/.test(H));
ok('panelnya muncul untuk kedua jenis itu',
   () => /x-show="skdType==='lab' \|\| skdType==='narkoba'"/.test(H));
ok('daftarnya dirender dari katalog, bukan ditulis satu-satu',
   () => /x-for="t in labPanel/.test(H));
ok('dikelompokkan', () => /x-for="kel in labKelompok"/.test(H));
ok('nilai rujukan bisa disunting', () => /labRujukan\[t\.key\]/.test(H));
ok('tanda kelainan terlihat sebelum surat terbit',
   () => /x-show="labTanda\(t\.key\)"/.test(H));
ok('mengingatkan kalau jenis kelamin belum terisi',
   () => /Jenis kelamin pasien belum terisi/.test(H));
ok('menyebut berapa yang sudah ada hasilnya', () => /labSiap\(\)/.test(H));
ok('kesimpulan narkoba terlihat sebelum terbit', () => /labKesimpulan/.test(H));
// Surat hasil pemeriksaan tanpa satu pun hasil menyatakan sesuatu yang tidak
// dikerjakan; ditahan sebelum terbit, bukan ketahuan sesudah dicetak.
ok('terbit tanpa hasil ditahan', () => /tidak bisa diterbitkan tanpa hasil/.test(H));
ok('kalimat penapisan tidak bisa dihilangkan dokter',
   () => /__labCatatanNarkoba/.test(H));
ok('katalog dibuka lewat window, bukan disalin ke x-data',
   () => /window\.__labPanel/.test(H));

ok('x-data terkompilasi', () => {
  const xd = H.match(/x-data="([^"]*)"/g) || [];
  xd.forEach(b => new Function('return ' + b.slice(8, -1)));
  return xd.length > 0;
});
ok('<div> seimbang', () => (H.match(/<div/g)||[]).length === (H.match(/<\/div>/g)||[]).length);
ok('<template> seimbang', () => (H.match(/<template/g)||[]).length === (H.match(/<\/template>/g)||[]).length);

// Surat lain tidak boleh ikut rusak.
const suratSehat = await SKD.createSKD({ patientId:'p_1', type:'sehat', doctor:dok, keperluan:'Melamar' });
let cetakSehat = '';
const w3 = jendela((h) => { cetakSehat += h; });
SKD.renderSKDInto(w3, suratSehat);
ok('surat sehat tetap seperti semula', () => /SURAT KETERANGAN DOKTER/.test(cetakSehat)
   && /SEHAT FISIK DAN MENTAL/.test(cetakSehat) && !/<table class="lab">/.test(cetakSehat));
ok('...dan tetap memakai buku nomor SKD', () => /\/SKD\//.test(suratSehat.cert_number));

console.log('\n' + (fails ? `❌ ${fails} gagal` : '✅ semua lolos'));
process.exit(fails ? 1 : 0);
