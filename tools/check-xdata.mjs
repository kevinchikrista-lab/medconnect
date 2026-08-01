// Pemeriksa x-data: memastikan tidak ada tanda kutip ganda di dalam atribut
// x-data="{...}" pada SELURUH berkas halaman.
//
// Kenapa penting: x-data dibungkus tanda kutip ganda. Satu tanda kutip ganda di
// dalamnya (mis. di komentar, atau teks seperti 'Klik "Cetak"') membuat browser
// MEMOTONG atribut di titik itu -> Alpine gagal init -> seluruh properti hilang
// dan halaman rusak total (tata letak berantakan, tombol mati). Bug ini sulit
// terlihat karena JS-nya tetap valid; yang salah adalah parsing HTML-nya.
//
// Jalankan: node tools/check-xdata.mjs

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOTS = ['js', 'js/pages'];
let failures = 0;
let scanned = 0;

// Ambil isi atribut x-data="..." dengan menghormati ${...} (interpolasi template),
// komentar, dan string, lalu laporkan tanda kutip ganda yang tersisa.
function scanFile(path) {
  const text = readFileSync(path, 'utf8');
  const MARK = 'x-data="';
  let i = 0;
  while ((i = text.indexOf(MARK, i)) !== -1) {
    let j = i + MARK.length;
    let depth = 0, started = false, bad = -1;
    while (j < text.length) {
      const c = text[j], c2 = text[j + 1];
      if (c === '$' && c2 === '{') { // interpolasi: dievaluasi saat render, lewati
        let d = 1; j += 2;
        while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
        continue;
      }
      if (c === '/' && c2 === '/') { // komentar baris
        const nl = text.indexOf('\n', j);
        const seg = text.slice(j, nl === -1 ? text.length : nl);
        if (seg.includes('"')) { bad = j + seg.indexOf('"'); break; }
        j = nl === -1 ? text.length : nl; continue;
      }
      if (c === '/' && c2 === '*') { // komentar blok
        const e = text.indexOf('*/', j);
        const seg = text.slice(j, e === -1 ? text.length : e);
        if (seg.includes('"')) { bad = j + seg.indexOf('"'); break; }
        j = (e === -1 ? text.length : e + 2); continue;
      }
      if (c === "'") { j++; while (j < text.length && text[j] !== "'") { if (text[j] === '\\') j++; j++; } j++; continue; }
      if (c === '`') { j++; while (j < text.length && text[j] !== '`') { if (text[j] === '\\') j++; j++; } j++; continue; }
      if (c === '"') { if (!started) break; bad = j; break; } // penutup atribut vs kutip nyasar
      if (c === '{') { depth++; started = true; }
      else if (c === '}') { depth--; if (started && depth === 0) { j++; break; } }
      j++;
    }
    if (bad !== -1) {
      const line = text.slice(0, bad).split('\n').length;
      const ctx = text.slice(Math.max(0, bad - 60), bad + 20).replace(/\n/g, ' ');
      console.error(`❌ ${path}:${line} — tanda kutip ganda di dalam x-data\n   ...${ctx}...`);
      failures++;
    }
    i = j;
  }
  scanned++;
}

for (const root of ROOTS) {
  for (const f of readdirSync(root, { withFileTypes: true })) {
    if (f.isFile() && f.name.endsWith('.js')) scanFile(join(root, f.name));
  }
}

if (failures) {
  console.error(`\n${failures} masalah ditemukan pada ${scanned} berkas.`);
  process.exit(1);
}
console.log(`✅ ${scanned} berkas diperiksa — tidak ada tanda kutip ganda di dalam x-data.`);
