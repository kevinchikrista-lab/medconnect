// Katalog pemeriksaan penunjang untuk Surat Keterangan Laboratorium.
//
// KENAPA KATALOG, BUKAN ISIAN BEBAS
//
// Halaman hasil penunjang yang sudah ada (tab Penunjang di rekam medis)
// meminta nama pemeriksaan, nilai, satuan, dan nilai rujukan diketik satu per
// satu. Untuk hasil laboratorium luar yang bentuknya bermacam-macam, itu
// memang jalan yang benar.
//
// Tapi yang dikerjakan klinik ini sehari-hari adalah pemeriksaan yang itu-itu
// juga: gula darah, asam urat, kolesterol, dan rapid test. Mengetik ulang
// 'Asam Urat', 'mg/dL', dan '3,4 - 7,0' setiap kali bukan cuma lambat — ia
// juga sumber salah ketik pada NILAI RUJUKAN, dan nilai rujukan yang salah
// ketik membuat hasil normal terbaca tinggi, atau sebaliknya.
//
// NILAI RUJUKAN DI SINI ADALAH NILAI UMUM, BUKAN NILAI ALAT ANDA
//
// Rentang rujukan bergantung pada metode dan reagen yang dipakai. Angka di
// bawah diambil dari rentang yang lazim dipakai di Indonesia, dan SEMUANYA
// bisa disunting saat surat dibuat. Sebelum dipakai rutin, cocokkan dengan
// sisipan reagen alat yang benar-benar dipakai klinik.
//
// RENTANG YANG BERBEDA MENURUT JENIS KELAMIN
//
// Asam urat, hemoglobin, kreatinin, dan HDL punya rentang berbeda untuk
// laki-laki dan perempuan. Memakai satu rentang untuk keduanya adalah
// kesalahan yang tidak kelihatan: hasil asam urat 6,5 mg/dL normal pada
// laki-laki dan tinggi pada perempuan, dan surat yang menyebutnya normal
// untuk keduanya salah pada separuh pasiennya.

// jenis 'angka'  : hasilnya berupa bilangan, dibandingkan dengan rentang
// jenis 'pilihan': hasilnya salah satu dari daftar (mis. Reaktif / Non-reaktif)
//
// rendah/tinggi  : batas rentang normal. null berarti tidak dibatasi di sisi itu
//                  (mis. kolesterol total hanya punya batas atas).
// perL / perP    : rentang khusus laki-laki / perempuan; menang atas rendah/tinggi.
// normal         : untuk jenis 'pilihan', jawaban mana yang dianggap normal.
export const LAB_PANEL = [
  // ---- Kimia darah --------------------------------------------------------
  { key: 'gds', kelompok: 'Kimia Darah', nama: 'Glukosa Darah Sewaktu',
    jenis: 'angka', satuan: 'mg/dL', tinggi: 200, catatan: 'Sewaktu, tanpa syarat puasa' },
  { key: 'gdp', kelompok: 'Kimia Darah', nama: 'Glukosa Darah Puasa',
    jenis: 'angka', satuan: 'mg/dL', rendah: 70, tinggi: 100, catatan: 'Puasa 8–10 jam' },
  { key: 'gd2pp', kelompok: 'Kimia Darah', nama: 'Glukosa Darah 2 Jam PP',
    jenis: 'angka', satuan: 'mg/dL', tinggi: 140, catatan: '2 jam sesudah makan' },
  // Rentang asam urat berbeda menurut jenis kelamin — lihat catatan di atas.
  { key: 'asam_urat', kelompok: 'Kimia Darah', nama: 'Asam Urat',
    jenis: 'angka', satuan: 'mg/dL', perL: [3.4, 7.0], perP: [2.4, 6.0] },
  { key: 'kolesterol', kelompok: 'Kimia Darah', nama: 'Kolesterol Total',
    jenis: 'angka', satuan: 'mg/dL', tinggi: 200 },
  { key: 'trigliserida', kelompok: 'Kimia Darah', nama: 'Trigliserida',
    jenis: 'angka', satuan: 'mg/dL', tinggi: 150 },
  { key: 'hdl', kelompok: 'Kimia Darah', nama: 'Kolesterol HDL',
    jenis: 'angka', satuan: 'mg/dL', perL: [40, null], perP: [50, null],
    catatan: 'Makin tinggi makin baik' },
  { key: 'ldl', kelompok: 'Kimia Darah', nama: 'Kolesterol LDL',
    jenis: 'angka', satuan: 'mg/dL', tinggi: 100 },
  { key: 'ureum', kelompok: 'Kimia Darah', nama: 'Ureum',
    jenis: 'angka', satuan: 'mg/dL', rendah: 15, tinggi: 40 },
  { key: 'kreatinin', kelompok: 'Kimia Darah', nama: 'Kreatinin',
    jenis: 'angka', satuan: 'mg/dL', perL: [0.6, 1.2], perP: [0.5, 1.1] },

  // ---- Hematologi sederhana ----------------------------------------------
  { key: 'hb', kelompok: 'Hematologi', nama: 'Hemoglobin (Hb)',
    jenis: 'angka', satuan: 'g/dL', perL: [13, 17], perP: [12, 15] },
  { key: 'gol_darah', kelompok: 'Hematologi', nama: 'Golongan Darah / Rhesus',
    jenis: 'pilihan', pilihan: ['A / Rh+', 'A / Rh−', 'B / Rh+', 'B / Rh−',
      'AB / Rh+', 'AB / Rh−', 'O / Rh+', 'O / Rh−'] },

  // ---- Rapid test / serologi ---------------------------------------------
  // Hasilnya REAKTIF / NON-REAKTIF, bukan positif / negatif. Itu bukan soal
  // bahasa: rapid test menunjukkan reaksi antigen-antibodi, bukan menegakkan
  // diagnosis, dan surat yang menulis 'positif HIV' menyatakan hal yang tidak
  // dibuktikan pemeriksaan itu.
  { key: 'hbsag', kelompok: 'Rapid Test', nama: 'HBsAg',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif' },
  { key: 'anti_hbs', kelompok: 'Rapid Test', nama: 'Anti-HBs',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Reaktif',
    catatan: 'Reaktif berarti sudah ada kekebalan' },
  { key: 'anti_hiv', kelompok: 'Rapid Test', nama: 'Anti-HIV',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif' },
  { key: 'anti_hcv', kelompok: 'Rapid Test', nama: 'Anti-HCV',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif' },
  // VDRL (non-treponemal) dan TPHA (treponemal) dulunya satu baris "Sifilis
  // (TPHA / VDRL)" — dipisah karena keduanya pemeriksaan yang berbeda, boleh
  // dicentang salah satu saja, dan hasilnya bisa berbeda (mis. VDRL reaktif
  // TPHA non-reaktif pada reaksi biologis semu).
  { key: 'vdrl', kelompok: 'Rapid Test', nama: 'VDRL',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif' },
  { key: 'tpha', kelompok: 'Rapid Test', nama: 'TPHA',
    jenis: 'pilihan', pilihan: ['Non-reaktif', 'Reaktif'], normal: 'Non-reaktif' },
  { key: 'malaria', kelompok: 'Rapid Test', nama: 'Malaria (RDT)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'hcg', kelompok: 'Rapid Test', nama: 'Tes Kehamilan (HCG Urin)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: '' },
  { key: 'widal', kelompok: 'Rapid Test', nama: 'Widal',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },

  // ---- Skrining narkoba (urin) -------------------------------------------
  // Enam golongan yang lazim ada pada panel rapid urin. Yang dicentang hanya
  // yang benar-benar ada pada alatnya — panel 3 dan panel 6 sama-sama dipakai,
  // dan surat yang menyebut golongan yang tidak diperiksa adalah surat yang
  // menyatakan sesuatu yang tidak dikerjakan.
  { key: 'amp', kelompok: 'Narkoba', nama: 'Amphetamine (AMP)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'met', kelompok: 'Narkoba', nama: 'Methamphetamine (MET)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'thc', kelompok: 'Narkoba', nama: 'THC / Ganja',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'mop', kelompok: 'Narkoba', nama: 'Morphine / Opiat (MOP)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'coc', kelompok: 'Narkoba', nama: 'Cocaine (COC)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },
  { key: 'bzo', kelompok: 'Narkoba', nama: 'Benzodiazepine (BZO)',
    jenis: 'pilihan', pilihan: ['Negatif', 'Positif'], normal: 'Negatif' },

  // ---- Pemeriksaan lain ---------------------------------------------------
  { key: 'buta_warna', kelompok: 'Lain-lain', nama: 'Tes Buta Warna (Ishihara)',
    jenis: 'pilihan', normal: 'Normal',
    pilihan: ['Normal', 'Buta warna parsial (defisiensi merah-hijau)', 'Buta warna total'] },
  { key: 'visus', kelompok: 'Lain-lain', nama: 'Tajam Penglihatan (Visus)',
    jenis: 'pilihan', normal: '6/6 — 6/6',
    pilihan: ['6/6 — 6/6', 'Dikoreksi kacamata', 'Menurun'] },
];

export const KELOMPOK = ['Kimia Darah', 'Hematologi', 'Rapid Test', 'Narkoba', 'Lain-lain'];

export function cariPanel(key) {
  return LAB_PANEL.find(t => t.key === key) || null;
}

// Rentang normal untuk seorang pasien. gender: 'Laki-laki' | 'Perempuan'.
//
// Kalau jenis kelaminnya TIDAK diketahui pada pemeriksaan yang rentangnya
// memang berbeda, rentangnya dikembalikan null — bukan ditebak dengan rentang
// laki-laki. Menebak berarti surat menyatakan 'normal' berdasarkan rentang
// yang belum tentu berlaku untuk orangnya.
export function rentangUntuk(test, gender) {
  if (!test) return { rendah: null, tinggi: null, tahu: false };
  const g = String(gender || '').trim().toLowerCase();
  if (test.perL || test.perP) {
    const lk = g.startsWith('l') || g === 'male' || g === 'm';
    const pr = g.startsWith('p') || g === 'female' || g === 'f';
    if (!lk && !pr) return { rendah: null, tinggi: null, tahu: false, perluGender: true };
    const r = lk ? test.perL : test.perP;
    return { rendah: r[0], tinggi: r[1], tahu: true, perluGender: true };
  }
  const ada = test.rendah != null || test.tinggi != null;
  return { rendah: test.rendah == null ? null : test.rendah,
           tinggi: test.tinggi == null ? null : test.tinggi, tahu: ada };
}

function angkaRapi(n) {
  if (n == null) return '';
  return String(n).replace('.', ',');
}

// Teks nilai rujukan yang dicetak di surat.
export function teksRujukan(test, gender) {
  if (!test) return '';
  if (test.jenis === 'pilihan') return test.normal || '';
  const r = rentangUntuk(test, gender);
  if (!r.tahu) return '';
  if (r.rendah != null && r.tinggi != null) return `${angkaRapi(r.rendah)} – ${angkaRapi(r.tinggi)}`;
  if (r.tinggi != null) return `< ${angkaRapi(r.tinggi)}`;
  return `> ${angkaRapi(r.rendah)}`;
}

// Angka yang diketik pemakai. Koma diterima sebagai pemisah desimal — di sini
// orang menulis 6,5 bukan 6.5, dan menolak koma hanya akan membuat angkanya
// dimasukkan salah.
export function keAngka(nilai) {
  const t = String(nilai == null ? '' : nilai).trim().replace(',', '.');
  if (!t || !/^-?[0-9]+(\.[0-9]+)?$/.test(t)) return null;
  return Number(t);
}

// Membandingkan hasil dengan rentangnya.
//   status : 'normal' | 'tinggi' | 'rendah' | 'perhatian' | ''
//   tanda  : 'H' | 'L' | '*' | ''   (dicetak di sebelah hasilnya)
//
// '' berarti TIDAK DINILAI — bukan berarti normal. Itu beda yang penting:
// hasil yang tidak bisa dinilai tidak boleh tampil seolah sudah dinilai dan
// ternyata baik.
export function nilaiHasil(test, hasil, gender) {
  const kosong = { status: '', tanda: '' };
  if (!test) return kosong;
  if (test.jenis === 'pilihan') {
    const h = String(hasil || '').trim();
    if (!h || !test.normal) return kosong;
    return h === test.normal ? { status: 'normal', tanda: '' } : { status: 'perhatian', tanda: '*' };
  }
  const n = keAngka(hasil);
  if (n === null) return kosong;
  const r = rentangUntuk(test, gender);
  if (!r.tahu) return kosong;
  if (r.tinggi != null && n > r.tinggi) return { status: 'tinggi', tanda: 'H' };
  if (r.rendah != null && n < r.rendah) return { status: 'rendah', tanda: 'L' };
  return { status: 'normal', tanda: '' };
}

// Kesimpulan surat keterangan bebas narkoba.
//
// Yang dikembalikan BUKAN cuma bebas / tidak, melainkan juga apakah
// kesimpulannya boleh ditarik sama sekali. Panel yang tidak dicentang satu pun
// tidak menghasilkan kesimpulan apa-apa — surat 'bebas narkoba' tanpa satu pun
// golongan yang diperiksa adalah surat yang menyatakan sesuatu yang tidak
// dikerjakan.
export function kesimpulanNarkoba(hasilNarkoba) {
  const daftar = (hasilNarkoba || []).filter(h => h && h.key && String(h.hasil || '').trim());
  if (!daftar.length) return { bisa: false, bebas: false, positif: [], jumlah: 0 };
  const positif = daftar.filter(h => String(h.hasil).trim().toLowerCase() !== 'negatif');
  return {
    bisa: true,
    bebas: positif.length === 0,
    positif: positif.map(h => h.nama || h.key),
    jumlah: daftar.length,
  };
}

// Kalimat yang WAJIB ikut pada surat keterangan bebas narkoba.
//
// Rapid test urin adalah pemeriksaan PENAPISAN. Hasil positifnya belum
// memastikan penyalahgunaan (obat flu tertentu bisa memberi hasil positif
// amphetamine), dan hasil negatifnya tidak meniadakan pemakaian di luar
// rentang waktu deteksi alatnya. Surat yang menyimpulkan tanpa menyebut ini
// menyatakan lebih daripada yang bisa dibuktikan pemeriksaannya — dan yang
// menanggung akibatnya dokter yang menandatanganinya.
export const CATATAN_NARKOBA =
  'Pemeriksaan ini merupakan tes penapisan (skrining) dengan metode rapid test urin. '
  + 'Hasil reaktif/positif memerlukan pemeriksaan konfirmasi di laboratorium rujukan, '
  + 'dan hasil negatif tidak meniadakan kemungkinan pemakaian di luar rentang waktu deteksi.';

export const CATATAN_RUJUKAN =
  'Nilai rujukan dapat berbeda menurut metode dan reagen yang digunakan.';

// Menyusun baris-baris hasil yang akan DIBEKUKAN ke dalam surat.
//
// Yang masuk hanya pemeriksaan yang benar-benar dicentang DAN ada hasilnya.
// Dicentang tanpa diisi berarti pemeriksaannya belum selesai, dan barisnya
// yang kosong pada surat akan terbaca sebagai 'diperiksa, hasilnya tidak ada'
// — padahal yang benar adalah belum diperiksa.
//
// rujukan boleh ditimpa per surat (opsional): reagen tiap klinik berbeda, dan
// yang tercetak harus rentang alat yang benar-benar dipakai.
export function susunHasil(pilihan, gender) {
  return (pilihan || []).map(p => {
    const t = cariPanel(p.key);
    if (!t) return null;
    const hasil = String(p.hasil == null ? '' : p.hasil).trim();
    if (!hasil) return null;
    const nilai = nilaiHasil(t, hasil, gender);
    const rujukanUbah = String(p.rujukan == null ? '' : p.rujukan).trim();
    return {
      key: t.key, nama: t.nama, kelompok: t.kelompok,
      hasil, satuan: t.jenis === 'angka' ? (t.satuan || '') : '',
      rujukan: rujukanUbah || teksRujukan(t, gender),
      status: nilai.status, tanda: nilai.tanda,
    };
  }).filter(Boolean);
}

// Kesimpulan surat bebas narkoba, sudah berupa kalimat siap cetak.
export function kalimatNarkoba(items) {
  const k = kesimpulanNarkoba((items || []).filter(i => i.kelompok === 'Narkoba'));
  if (!k.bisa) return '';
  if (k.bebas) return 'Negatif terhadap ' + k.jumlah + ' golongan narkoba yang diperiksa';
  return 'Positif terhadap ' + k.positif.join(', ');
}
