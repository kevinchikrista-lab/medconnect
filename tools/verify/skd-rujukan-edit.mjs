// Sunting Surat Rujukan (js/skdedit.js) harus membaca & menulis field yang
// SAMA dengan yang dibaca skd.js saat mencetak surat rujukan (js/skd.js).
// Sebelum perbaikan ini, editSKD() cuma mengenal SEHAT/SAKIT -- rujukan
// jatuh ke cabang SAKIT dan menyunting field (diagnosis/rest_days/tanggal
// istirahat) yang tidak pernah dibaca ulang oleh pencetak suratnya, sehingga
// perubahan tersimpan tapi surat yang dicetak ulang tidak berubah sama
// sekali. Pemeriksaan ini statis (tanpa DOM sungguhan, karena tidak ada
// jsdom di proyek ini) -- tapi tepat menangkap kelas bug ini: field yang
// disunting vs field yang dicetak tidak pernah cocok.

import { readFileSync } from 'fs';

const editSrc = readFileSync('../../js/skdedit.js', 'utf8');
const skdSrc = readFileSync('../../js/skd.js', 'utf8');

let fails = 0;
const ok = (n, c) => {
  let r = false, e = '';
  try { r = !!c(); } catch (x) { r = false; e = ' (' + x.message + ')'; }
  if (!r) fails++;
  console.log(`  ${r ? '✅' : '❌'} ${n}${e}`);
  return r;
};

// Field datar (bukan di dalam vital) yang harus dibaca di bagian populate
// form (d.KEY), ditulis balik saat simpan (nd.KEY = val(...)), dan dibaca
// oleh pencetak surat rujukan di skd.js (d.KEY).
const FIELDS = ['tujuan_dokter', 'tujuan_faskes', 'anamnesis', 'pemeriksaan',
  'penunjang', 'diagnosis', 'icd10', 'terapi', 'alasan', 'harapan'];

// Sub-field tanda vital, disimpan sebagai objek d.vital = {td,nadi,...}.
const VITALS = ['td', 'nadi', 'suhu', 'rr', 'bb', 'tb'];

console.log('\n=== SUNTING SURAT RUJUKAN: field cocok dengan yang dicetak ===');

for (const k of FIELDS) {
  ok(`${k}: dibaca saat membuka form edit (d.${k})`,
     () => new RegExp(`set\\('e_\\w+',\\s*d\\.${k}\\)`).test(editSrc));
  ok(`${k}: ditulis balik saat disimpan (nd.${k} = val(...))`,
     () => new RegExp(`nd\\.${k}\\s*=\\s*val\\(`).test(editSrc));
  ok(`${k}: benar-benar dibaca pencetak surat rujukan di skd.js`,
     () => new RegExp(`d\\.${k}\\b`).test(skdSrc));
}

for (const k of VITALS) {
  ok(`vital.${k}: dibaca saat membuka form edit (vt.${k})`,
     () => new RegExp(`\\bvt\\.${k}\\b`).test(editSrc) && editSrc.includes('const vt = d.vital'));
  ok(`vital.${k}: ditulis balik ke dalam objek nd.vital saat disimpan`,
     () => new RegExp(`nd\\.vital\\s*=\\s*\\{[^}]*\\b${k}:`).test(editSrc));
  ok(`vital.${k}: benar-benar dibaca pencetak surat (vt.${k} di skd.js)`,
     () => new RegExp(`\\bvt\\.${k}\\b`).test(skdSrc));
}

ok('cabang isRujukan ada di form (bukan jatuh ke cabang SAKIT)',
   () => /isRujukan\s*\?/.test(editSrc) && /const isRujukan = /.test(editSrc));
ok('judul modal membedakan Rujukan dari Sehat/Sakit',
   () => /isRujukan \? 'Rujukan'/.test(editSrc));
ok('surat lab/narkoba ditolak dengan pesan jelas, bukan jatuh diam-diam ke cabang SAKIT',
   () => /isLab.*alert\(/s.test(editSrc) || /if \(isLab\) \{ alert\(/.test(editSrc));

console.log(fails ? `\n❌ ${fails} gagal` : '\n✅ semua lolos');
process.exit(fails ? 1 : 0);
