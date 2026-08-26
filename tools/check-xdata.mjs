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

function lapor(path, text, pos, pesan) {
  const line = text.slice(0, pos).split('\n').length;
  const ctx = text.slice(Math.max(0, pos - 70), pos + 25).replace(/\n/g, ' ');
  console.error(`❌ ${path}:${line} — ${pesan}\n   ...${ctx}...`);
  failures++;
}

// Ambil isi atribut x-data="..." dengan menghormati ${...} (interpolasi template),
// lalu laporkan dua hal yang sama-sama mematikan Alpine untuk SELURUH halaman:
//
//   1. tanda kutip ganda  -> browser memotong atribut di titik itu
//   2. \n atau \r         -> template literal-nya menghasilkan BARIS BARU
//                            sungguhan di dalam atribut, yang memutus string
//                            JS di dalamnya
//
// Keduanya diperiksa di MANA PUN di dalam atribut, termasuk di dalam string
// ber-kutip-tunggal. Dulu string ber-kutip-tunggal dilewati utuh — masuk akal
// kalau yang dibaca JS-nya, tapi salah di sini: yang membaca atribut ini
// duluan adalah parser HTML, dan parser HTML tidak tahu apa-apa soal string
// JS. Karena celah itu, baris confirm('...\n\n... "Dibatalkan / Tidak Valid".')
// lolos dan mematikan seluruh halaman rekam medis.
function scanFile(path) {
  const text = readFileSync(path, 'utf8');
  const MARK = 'x-data="';
  let i = 0;
  while ((i = text.indexOf(MARK, i)) !== -1) {
    let j = i + MARK.length;
    let depth = 0, started = false;
    while (j < text.length) {
      const c = text[j], c2 = text[j + 1];
      if (c === '$' && c2 === '{') { // interpolasi: dievaluasi saat render, lewati
        let d = 1; j += 2;
        while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
        continue;
      }
      if (c === '\\') {
        // Satu garis miring di sumber = baris baru sungguhan di atribut.
        // Yang benar \\n (dua garis miring), supaya yang sampai ke atribut
        // tetap berupa escape.
        if (c2 === 'n' || c2 === 'r') {
          lapor(path, text, j, `\\${c2} di dalam x-data menghasilkan baris baru sungguhan pada atribut (pakai \\\\${c2})`);
        }
        j += 2; continue;
      }
      if (c === "'") {
        // String ber-kutip-tunggal diperiksa isinya (kutip ganda, backtick,
        // \n/\r di dalamnya sama-sama fatal), TAPI "//" atau "/*" di
        // dalamnya (mis. di dalam URL 'https://...') BUKAN komentar — itu
        // sebabnya string ini punya jalur sendiri, terpisah dari pemindai
        // komentar di bawah. Pernah tercampur sekali: "https://" di dalam
        // sebuah URL terbaca sebagai awal komentar baris, menelan sisa
        // baris itu (termasuk tanda kurung kurawal penutup) tanpa jejak.
        j++;
        while (j < text.length && text[j] !== "'") {
          // ${...} bisa juga muncul DI DALAM string ber-kutip-tunggal (mis.
          // selectedDate: '${cond ? a : `${tahun}-...`}' ) — itu interpolasi
          // milik template literal pembungkus di luar sini, boleh berisi
          // backtick/kutip apa pun karena semuanya sudah dievaluasi JS
          // sebelum mendarat di atribut. Lewati utuh, sama seperti di aras atas.
          if (text[j] === '$' && text[j + 1] === '{') {
            let d = 1; j += 2;
            while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
            continue;
          }
          if (text[j] === '\\') {
            if (text[j + 1] === 'n' || text[j + 1] === 'r') {
              lapor(path, text, j, `\\${text[j + 1]} di dalam x-data menghasilkan baris baru sungguhan pada atribut (pakai \\\\${text[j + 1]})`);
            }
            j += 2; continue;
          }
          if (text[j] === '"') { lapor(path, text, j, 'tanda kutip ganda di dalam x-data — memotong atribut'); break; }
          if (text[j] === '`') { lapor(path, text, j, 'backtick di dalam x-data — menutup template literal pembungkusnya'); break; }
          j++;
        }
        j++; continue;
      }
      if (c === '/' && c2 === '/') { // komentar baris
        const nl = text.indexOf('\n', j);
        const seg = text.slice(j, nl === -1 ? text.length : nl);
        if (seg.includes('"')) { lapor(path, text, j + seg.indexOf('"'), 'tanda kutip ganda di dalam komentar x-data'); }
        if (seg.includes('`')) { lapor(path, text, j + seg.indexOf('`'), 'backtick di dalam komentar x-data — menutup template literal-nya'); }
        j = nl === -1 ? text.length : nl; continue;
      }
      if (c === '/' && c2 === '*') { // komentar blok
        const e = text.indexOf('*/', j);
        const seg = text.slice(j, e === -1 ? text.length : e);
        if (seg.includes('"')) { lapor(path, text, j + seg.indexOf('"'), 'tanda kutip ganda di dalam komentar x-data'); }
        if (seg.includes('`')) { lapor(path, text, j + seg.indexOf('`'), 'backtick di dalam komentar x-data — menutup template literal-nya'); }
        j = (e === -1 ? text.length : e + 2); continue;
      }
      // Backtick tanpa escape berarti template literal pembungkus HTML-nya
      // berakhir di sini — jadi atributnya juga berakhir. Berhenti.
      if (c === '`') break;
      if (c === '"') { if (!started) break; lapor(path, text, j, 'tanda kutip ganda di dalam x-data — memotong atribut'); break; }
      if (c === '{') { depth++; started = true; }
      else if (c === '}') { depth--; if (started && depth === 0) { j++; break; } }
      j++;
    }
    i = j;
  }
  scanned++;
}

// Celah yang pernah lolos: sebagian halaman merakit isi x-data dari fungsi
// terpisah, mis. x-data="{ ${tasksXData('all')} }". Pemindai di atas MELEWATI
// ${...} (memang harus, karena isinya baru ada saat render), jadi tanda kutip
// ganda di dalam fungsi itu tidak pernah terlihat — padahal hasilnya sama-sama
// memotong atribut. Karena itu setiap fungsi bernama *XData diperiksa juga:
// apa pun yang dikembalikannya pasti mendarat di dalam x-data="...".
function scanXDataBuilders(path) {
  const text = readFileSync(path, 'utf8');
  const re = /function\s+(\w*XData)\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const open = text.indexOf('`', m.index);
    if (open === -1) continue;
    let j = open + 1;
    while (j < text.length) {
      const c = text[j], c2 = text[j + 1];
      if (c === '\\') {
        // \n di dalam template literal menghasilkan BARIS BARU sungguhan pada
        // atribut x-data, yang memutus string JS di dalamnya dan membuat Alpine
        // gagal menyalakan seluruh halaman. Yang benar \\n (dua garis miring),
        // supaya yang sampai ke atribut tetap berupa escape, bukan baris baru.
        if (c2 === 'n' || c2 === 'r') {
          const line = text.slice(0, j).split('\n').length;
          const ctx = text.slice(Math.max(0, j - 70), j + 20).replace(/\n/g, ' ');
          console.error(`❌ ${path}:${line} — \\${c2} di dalam ${m[1]}() menghasilkan baris baru sungguhan pada x-data (pakai \\\\${c2})\n   ...${ctx}...`);
          failures++;
        }
        j += 2; continue;
      }
      // String ber-kutip-tunggal diperiksa isinya sendiri, TANPA menganggap
      // "//" di dalamnya (mis. URL 'https://...') sebagai awal komentar —
      // kalau tidak, sisa baris sesudahnya (bisa saja berisi backtick atau
      // kutip ganda yang justru harus ditangkap) ikut terlewat diam-diam.
      if (c === "'") {
        j++;
        while (j < text.length && text[j] !== "'") {
          if (text[j] === '$' && text[j + 1] === '{') {
            let d = 1; j += 2;
            while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
            continue;
          }
          if (text[j] === '\\') {
            if (text[j + 1] === 'n' || text[j + 1] === 'r') {
              const line = text.slice(0, j).split('\n').length;
              const ctx = text.slice(Math.max(0, j - 70), j + 20).replace(/\n/g, ' ');
              console.error(`❌ ${path}:${line} — \\${text[j + 1]} di dalam ${m[1]}() menghasilkan baris baru sungguhan pada x-data (pakai \\\\${text[j + 1]})\n   ...${ctx}...`);
              failures++;
            }
            j += 2; continue;
          }
          if (text[j] === '"' || text[j] === '`') {
            const line = text.slice(0, j).split('\n').length;
            const ctx = text.slice(Math.max(0, j - 70), j + 20).replace(/\n/g, ' ');
            const sebab = text[j] === '`'
              ? 'backtick di dalam ' + m[1] + '() — menutup template literal pembungkusnya'
              : 'tanda kutip ganda di dalam ' + m[1] + '() (isinya masuk ke x-data)';
            console.error(`❌ ${path}:${line} — ${sebab}\n   ...${ctx}...`);
            failures++;
            break;
          }
          j++;
        }
        j++; continue;
      }
      // Komentar dilewati sebagai satu kesatuan, TAPI isinya tetap diperiksa.
      // Sebelumnya komentar tidak dikenali sama sekali, sehingga satu backtick
      // di dalamnya (mis. menyebut `this` dengan gaya kode) dibaca sebagai
      // akhir template literal: pemindaian berhenti di situ dan SELURUH sisa
      // fungsi tidak pernah diperiksa. Berhentinya diam-diam — tidak ada yang
      // gagal, jadi tidak ada yang tahu.
      if (c === '/' && (c2 === '/' || c2 === '*')) {
        const baris = c2 === '/';
        const e = baris ? text.indexOf('\n', j) : text.indexOf('*/', j);
        const akhir = e === -1 ? text.length : e;
        const seg = text.slice(j, akhir);
        const salah = seg.indexOf('`') !== -1 ? '`' : (seg.indexOf('"') !== -1 ? '"' : '');
        if (salah) {
          const pos = j + seg.indexOf(salah);
          const line = text.slice(0, pos).split('\n').length;
          const ctx = text.slice(Math.max(0, pos - 70), pos + 20).replace(/\n/g, ' ');
          const sebab = salah === '`'
            ? 'backtick di dalam komentar ' + m[1] + '() — menutup template literal-nya'
            : 'tanda kutip ganda di dalam ' + m[1] + '() (isinya masuk ke x-data)';
          console.error(`❌ ${path}:${line} — ${sebab}\n   ...${ctx}...`);
          failures++;
        }
        j = baris ? akhir : akhir + 2;
        continue;
      }
      if (c === '`') break;                       // akhir template literal
      if (c === '$' && c2 === '{') {              // interpolasi: dinilai saat render
        let d = 1; j += 2;
        while (j < text.length && d > 0) { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; }
        continue;
      }
      if (c === '"') {
        const line = text.slice(0, j).split('\n').length;
        const ctx = text.slice(Math.max(0, j - 70), j + 20).replace(/\n/g, ' ');
        console.error(`❌ ${path}:${line} — tanda kutip ganda di dalam ${m[1]}() (isinya masuk ke x-data)\n   ...${ctx}...`);
        failures++;
      }
      j++;
    }
  }
}

for (const root of ROOTS) {
  for (const f of readdirSync(root, { withFileTypes: true })) {
    if (f.isFile() && f.name.endsWith('.js')) { scanFile(join(root, f.name)); scanXDataBuilders(join(root, f.name)); }
  }
}

if (failures) {
  console.error(`\n${failures} masalah ditemukan pada ${scanned} berkas.`);
  process.exit(1);
}
console.log(`✅ ${scanned} berkas diperiksa — tidak ada tanda kutip ganda di dalam x-data.`);
