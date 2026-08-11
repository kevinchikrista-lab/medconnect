// ---------------------------------------------------------------------------
// PEMBACA berkas "Laporan Detail Data Penjualan Obat" dari sistem kasir apotek.
//
// Berkasnya sudah memuat semua yang dibutuhkan laporan jemaah umroh: tanggal,
// nama pasien, nama dokter, kolom Sales (= travel pengirimnya), rincian vaksin
// yang diberikan, dan total yang dibayar. Karena itu laporan umroh dibaca dari
// sini, bukan diketik ulang — angka yang dipakai menagih cashback jadi angka
// yang sama dengan yang tercatat di kasir.
//
// BENTUK BERKASNYA berulang per transaksi, bukan satu baris per transaksi:
//
//   No | Tanggal | ... | No. Faktur | Nama Pasien | Nama Dokter | Sales | ...
//   1. | 01 Jul 2026 17:15:10 | ... | PJ2607230011 | ABDUL SYUKUR | DR. ... |
//   No | Golongan | Kategori Obat | Kode Obat | Nama Obat | ... | Total
//   1. |          | VAKSIN        |           | Combo Umroh ...
//   2. | Obat Keras | VAKSIN      | OBT...    | VAKSIN MENINGITIS - MENIVAX
//   Subtotal :                                                  600.000,00
//   Diskon Faktur :                                             100.000,00
//   Total :                                                     500.000,00
//
// Kolomnya dicari LEWAT NAMA JUDULNYA, bukan lewat nomor kolom tetap — kalau
// sistem kasir suatu saat menyisipkan satu kolom baru, laporan tetap terbaca
// benar, bukan diam-diam mengambil kolom sebelahnya.
// ---------------------------------------------------------------------------
import { CONFIG } from './config.js';

const XLSX_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

// Nama bulan versi Indonesia maupun Inggris — berkas ekspornya memakai
// keduanya tergantung setelan sistem kasirnya.
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nop: 11, nov: 11, des: 12, dec: 12,
};

// '01 Jul 2026 17:15:10' → { date: '2026-07-01', time: '17:15' }
export function parseIdDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return { date: '', time: '' };
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) {
      const p = (n) => String(n).padStart(2, '0');
      return {
        date: `${m[3]}-${p(mon)}-${p(Number(m[1]))}`,
        time: m[4] ? `${p(Number(m[4]))}:${m[5]}` : '',
      };
    }
  }
  // Sudah berbentuk ISO (mis. bila diekspor ke CSV oleh alat lain).
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, time: iso[4] ? `${iso[4]}:${iso[5]}` : '' };
  return { date: '', time: '' };
}

// '500.000,00' → 500000. Titik ribuan, koma desimal.
export function parseIdrNumber(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  const cleaned = s.replace(/[^0-9,.]/g, '');
  if (!cleaned) return 0;
  // Koma paling belakang dianggap pemisah desimal; titik dianggap ribuan.
  const val = Number(cleaned.replace(/\./g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, ''));
  if (!isFinite(val)) return 0;
  return Math.round(neg ? -val : val);
}

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const low = (s) => norm(s).toLowerCase();

// Cari indeks kolom dari sebuah baris judul, dicocokkan longgar.
function colIndex(headerRow, ...labels) {
  const want = labels.map(l => low(l));
  for (let i = 0; i < headerRow.length; i++) {
    const cell = low(headerRow[i]);
    if (cell && want.includes(cell)) return i;
  }
  return -1;
}

function isTxHeader(row) {
  return low(row[0]) === 'no' && /tanggal/.test(low(row[1] || ''));
}
function isItemHeader(row) {
  return low(row[0]) === 'no' && /golongan|nama obat|kategori/.test(low(row[1] || '') + ' ' + low(row[2] || '') + ' ' + low(row[4] || ''));
}
function isTotalRow(row) {
  return /:$/.test(norm(row[0]));
}

// Vaksin ini termasuk layanan umroh yang mana — '' bila bukan.
function vaxKindOf(name) {
  const hay = String(name || '');
  const hit = (CONFIG.UMROH_VACCINES || []).find(u => u.match && u.match.test(hay));
  return hit ? hit.key : '';
}
// Satu baris bisa menyebut dua vaksin sekaligus ('Combo Umroh (Meningitis
// Polio)'), jadi yang dikumpulkan semua yang cocok, bukan yang pertama saja.
function vaxKindsIn(name) {
  const hay = String(name || '');
  return (CONFIG.UMROH_VACCINES || []).filter(u => u.match && u.match.test(hay)).map(u => u.key);
}

function serviceLabelOf(kinds) {
  const names = Array.from(new Set(kinds)).map(k => {
    const f = (CONFIG.UMROH_VACCINES || []).find(u => u.key === k);
    return f ? f.label : k;
  });
  if (names.length > 1) return `Combo (${names.join(' + ')})`;
  return names[0] || '-';
}

/**
 * Baca matriks sel (array of array of string) menjadi daftar transaksi jemaah.
 * Mengembalikan { entries, stats } — entries hanya berisi transaksi yang
 * memuat vaksin umroh; sisanya dihitung di stats supaya jelas apa yang dilewati
 * dan tidak ada yang hilang diam-diam.
 */
export function parseUmrohSheet(matrix) {
  const rows = (matrix || []).map(r => (Array.isArray(r) ? r.map(c => norm(c)) : []));
  const entries = [];
  const stats = { transaksi: 0, umroh: 0, bukanUmroh: 0, tanpaTanggal: 0, tanpaFaktur: 0, tanpaTravel: 0, adaBarangLain: 0 };

  let i = 0;
  while (i < rows.length) {
    if (!isTxHeader(rows[i])) { i++; continue; }

    const txHead = rows[i];
    const cTanggal = colIndex(txHead, 'tanggal');
    const cFaktur = colIndex(txHead, 'no. faktur', 'no faktur', 'faktur');
    const cPasien = colIndex(txHead, 'nama pasien', 'pasien');
    const cDokter = colIndex(txHead, 'nama dokter', 'dokter');
    const cSales = colIndex(txHead, 'sales', 'travel');
    const val = rows[i + 1] || [];
    stats.transaksi++;

    // Lompat ke baris judul item, lalu kumpulkan itemnya.
    let j = i + 2;
    let itemHead = null;
    if (j < rows.length && isItemHeader(rows[j])) { itemHead = rows[j]; j++; }
    const cNamaObat = itemHead ? colIndex(itemHead, 'nama obat', 'nama barang', 'nama item') : -1;
    const cTotalItem = itemHead ? colIndex(itemHead, 'total') : -1;
    const cJumlah = itemHead ? colIndex(itemHead, 'jumlah', 'qty') : -1;

    const items = [];
    while (j < rows.length && !isTotalRow(rows[j]) && !isTxHeader(rows[j]) && norm(rows[j][0])) {
      const nama = cNamaObat >= 0 ? rows[j][cNamaObat] : '';
      if (nama) {
        items.push({
          name: nama,
          qty: cJumlah >= 0 ? (Number(String(rows[j][cJumlah]).replace(',', '.')) || 0) : 0,
          total: cTotalItem >= 0 ? parseIdrNumber(rows[j][cTotalItem]) : 0,
          kinds: vaxKindsIn(nama),
        });
      }
      j++;
    }

    // Baris-baris jumlah di bawahnya (Subtotal / Diskon Faktur / Total).
    const totals = {};
    while (j < rows.length && isTotalRow(rows[j])) {
      const label = low(rows[j][0]).replace(/\s*:$/, '');
      const nilai = cTotalItem >= 0 ? rows[j][cTotalItem] : rows[j][rows[j].length - 1];
      totals[label] = parseIdrNumber(nilai);
      j++;
    }
    i = j;

    const kinds = Array.from(new Set(items.flatMap(it => it.kinds)));
    if (!kinds.length) { stats.bukanUmroh++; continue; }

    const tgl = parseIdDate(cTanggal >= 0 ? val[cTanggal] : '');
    const invoice = cFaktur >= 0 ? val[cFaktur] : '';
    // Barang di luar vaksin umroh (mis. vaksin influenza yang dibeli sekalian)
    // ikut menaikkan Total, jadi ditandai supaya harganya tidak dikira salah.
    const lain = items.filter(it => !it.kinds.length && !/combo/i.test(it.name)).map(it => it.name);

    if (!tgl.date) stats.tanpaTanggal++;
    if (!invoice) stats.tanpaFaktur++;
    if (lain.length) stats.adaBarangLain++;

    const travel = cSales >= 0 ? val[cSales] : '';
    if (!travel) stats.tanpaTravel++;

    stats.umroh++;
    entries.push({
      invoice_no: invoice,
      sold_date: tgl.date,
      sold_time: tgl.time,
      patient_name: cPasien >= 0 ? val[cPasien] : '',
      doctor_name: cDokter >= 0 ? val[cDokter] : '',
      travel_name: travel,
      service: kinds.length > 1 ? 'combo' : kinds[0],
      service_label: serviceLabelOf(kinds),
      // Total sudah dipotong diskon faktur — itu yang benar-benar dibayar
      // jemaah, dan itu yang jadi dasar cashback.
      price: totals.total || totals.subtotal || items.reduce((s, it) => s + (it.total || 0), 0),
      subtotal: totals.subtotal || 0,
      discount: totals['diskon faktur'] || 0,
      items: items.map(it => it.name),
      other_items: lain,
    });
  }

  return { entries, stats };
}

// --------------------------------------------------------------------------
// Membaca berkasnya di peramban.
// --------------------------------------------------------------------------

// Pemecah CSV sederhana yang menghormati tanda kutip — dipakai supaya berkas
// CSV tetap bisa dibaca walau pustaka pembaca .xls gagal dimuat.
export function csvToMatrix(text) {
  const out = [];
  let row = [], cell = '', inQ = false;
  const s = String(text || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

let xlsxPromise = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  // Dimuat baru saat dibutuhkan, bukan di setiap kali aplikasi dibuka —
  // pustakanya besar dan hanya dipakai di satu halaman.
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_CDN;
    s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('Pustaka pembaca Excel gagal dimuat.')));
    s.onerror = () => reject(new Error('Pustaka pembaca Excel tidak bisa diunduh. Periksa koneksi internet, atau simpan berkasnya sebagai CSV lalu unggah ulang.'));
    document.head.appendChild(s);
  }).catch(e => { xlsxPromise = null; throw e; });
  return xlsxPromise;
}

// Berkas → matriks sel. Menerima .xls, .xlsx, dan .csv.
export async function fileToMatrix(file) {
  const name = String((file && file.name) || '').toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return csvToMatrix(await file.text());
  }
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('Berkasnya tidak berisi lembar data.');
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: '', raw: false });
}
