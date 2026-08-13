// =============================================================================
// JADWAL IMUNISASI ANAK — BIBIT DATA DARI REKOMENDASI IDAI
// =============================================================================
//
// KENAPA FILE INI ADA, DAN KENAPA ISINYA "BELUM BOLEH DIPAKAI"
//
// Selama ini tanggal dosis berikutnya diketik tangan ke kolom next_dose_date.
// Selama anaknya datang tepat waktu itu cukup. Yang tidak tertangani adalah
// justru kejadian yang paling sering: anak demam, vaksinnya ditunda dua bulan,
// lalu SELURUH tanggal sesudahnya yang terlanjur diketik menjadi salah — dan
// tidak ada yang menghitung ulang. Yang tersisa di layar adalah tanggal lama
// yang kelihatan meyakinkan padahal sudah tidak berlaku.
//
// Maka jadwalnya dipindahkan menjadi DATA: usia minimum tiap dosis dan jarak
// minimum antar dosis. Tanggalnya dihitung, bukan disimpan:
//
//     paling cepat boleh = MAX(tanggal lahir + usia minimum dosis ke-n,
//                              tanggal dosis terakhir + jarak minimum)
//
// Dengan begitu penundaan satu dosis otomatis menggeser sisanya, tanpa ada
// yang perlu mengetik ulang apa pun.
//
// ---------------------------------------------------------------------------
// PERINGATAN YANG TIDAK BOLEH DIHAPUS
//
// Angka-angka di bawah ini SAYA AMBIL DARI SUMBER SEKUNDER, bukan dari tabel
// resmi IDAI. Situs idai.or.id dan saripediatri.org tidak bisa dibuka dari
// lingkungan tempat berkas ini ditulis (diblokir proxy jaringan), sehingga
// yang tersedia hanya ringkasan dari halaman-halaman lain yang mengutip IDAI —
// dan ringkasan itu SALING BERBEDA di beberapa titik (contoh paling nyata:
// vaksin dengue, ada yang menulis CYD 9–16 tahun 3 dosis, ada yang menulis
// TAK-003 6–16 tahun 2 dosis).
//
// Untuk jadwal imunisasi bayi, angka yang meleset bukan perkara kosmetik:
// terlalu cepat berarti dosisnya tidak sah dan harus diulang, terlalu lambat
// berarti anaknya tidak terlindungi selama selisihnya. Karena itu seluruh
// tabel ini berstatus BELUM DIVERIFIKASI. Selama statusnya masih itu:
//
//   - setiap layar yang memakainya WAJIB menampilkan spanduk peringatan;
//   - hasil hitungannya disebut "perkiraan", bukan anjuran;
//   - dr. Kevin membuka Super Admin → Jadwal Vaksin IDAI, mencocokkan tiap
//     baris dengan tabel IDAI asli, membetulkan yang perlu, lalu menekan
//     "Saya sudah verifikasi". Baru sesudah itu ia berbicara sebagai anjuran.
//
// Angka yang sudah diverifikasi disimpan di tabel vax_schedule (lihat
// supabase-vax-schedule.sql) dan menimpa bibit di berkas ini. Jadi
// pembetulan dr. Kevin tidak akan hilang saat aplikasi diperbarui.
// =============================================================================

export const IDAI_META = {
  versi: 'bibit-2024',
  sumber: 'Rekomendasi Jadwal Imunisasi Anak Usia 0-18 Tahun, Ikatan Dokter Anak Indonesia (IDAI) 2024',
  sumber_url: 'https://www.idai.or.id/professional-resources/rekomendasi/jadwal-imunisasi-anak-usia-0-18-tahun',
  diambil: '2026-08-13',
  // Dari sumber sekunder (halaman yang mengutip IDAI), bukan dari tabel resmi.
  primer: false,
  verified: false,
  verified_by: '',
  verified_at: '',
};

// Berapa lama keterlambatan masih boleh dihitung otomatis. Lewat dari ini,
// aplikasi berhenti menganjurkan tanggal dan menyerahkannya ke dokter: anak
// yang tertinggal setengah tahun lebih bukan lagi soal menggeser tanggal, tapi
// soal menyusun jadwal kejar yang bergantung pada dosis mana saja yang sudah
// masuk dan berapa usianya sekarang.
export const AMBANG_TELAT_HARI = 180;

// ---------------------------------------------------------------------------
// Bentuk satu seri:
//
//   key           kunci tetap, dipakai menyimpan di kolom series_key
//   nama          yang dibaca orang tua
//   grup          seri sejenis yang saling menggantikan (rotavirus monovalen
//                 vs pentavalen, dengue CYD vs TAK-003). Hanya satu yang
//                 ditampilkan: yang sudah pernah dipakai anak ini, atau yang
//                 pertama bila belum ada satu pun.
//   alias         kata yang mungkin tertulis di kolom vaccine_name /
//                 vaccine_brand. Dicocokkan sebagai kata utuh, huruf kecil.
//   wajib         masuk imunisasi dasar (true) atau pilihan/anjuran (false)
//   batasUsia     seri tidak boleh lagi dimulai/dilanjutkan di atas usia ini
//   ulang         seri yang diulang seumur hidup (tifoid, influenza)
//   dosis[]       ke, usiaMin, usiaAnjuran, jarakMin, batasUsia, label
//
// Satuan usia ditulis sebagai objek {hari|minggu|bulan|tahun} supaya tidak ada
// pembulatan "1 bulan = 30 hari" yang menumpuk kesalahan di seri panjang.
// ---------------------------------------------------------------------------

export const IDAI_SEED = [
  {
    key: 'hepb',
    nama: 'Hepatitis B',
    alias: ['hepatitis b', 'hep b', 'hb', 'hbv', 'engerix', 'euvax', 'uniject', 'hepavax', 'pentabio', 'pentavalen', 'hexaxim'],
    wajib: true,
    catatan: 'Dosis pertama diberikan dalam 24 jam pertama setelah lahir. Dosis berikutnya biasanya ikut dalam vaksin kombinasi (pentavalen) bersama DTP dan Hib.',
    dosis: [
      { ke: 1, usiaMin: { hari: 0 }, usiaAnjuran: { hari: 0 }, label: 'HB-0 (dalam 24 jam setelah lahir)' },
      { ke: 2, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 3 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
    ],
  },
  {
    key: 'polio',
    nama: 'Polio',
    alias: ['polio', 'opv', 'ipv', 'bopv', 'poliomyelitis', 'imovax polio', 'hexaxim'],
    wajib: true,
    catatan: 'IDAI meminta paling sedikit 2 dosis di antaranya berupa IPV (polio suntik) sebelum anak berusia 1 tahun.',
    dosis: [
      { ke: 1, usiaMin: { hari: 0 }, usiaAnjuran: { hari: 0 }, label: 'Polio-0 (saat lahir)' },
      { ke: 2, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 3 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
      { ke: 5, usiaAnjuran: { bulan: 18 }, jarakMin: { bulan: 6 }, label: 'Booster' },
    ],
  },
  {
    key: 'bcg',
    nama: 'BCG',
    alias: ['bcg', 'tuberkulosis', 'tbc'],
    wajib: true,
    batasUsia: { bulan: 3 },
    catatan: 'Paling baik pada usia 2 bulan. Di atas usia 3 bulan perlu uji tuberkulin lebih dulu — jadi tidak dijadwalkan otomatis.',
    dosis: [
      { ke: 1, usiaMin: { hari: 0 }, usiaAnjuran: { bulan: 2 }, batasUsia: { bulan: 3 } },
    ],
  },
  {
    key: 'dtp',
    nama: 'DTP (Difteri, Tetanus, Pertusis)',
    alias: ['dtp', 'dpt', 'dtap', 'dtwp', 'difteri', 'pentabio', 'pentavalen', 'infanrix', 'hexaxim', 'tetraxim', 'pediacel', 'td', 'tdap', 'boostrix', 'adacel', 'dt'],
    wajib: true,
    catatan: 'Mulai usia 7 tahun memakai Td atau Tdap, bukan DTP anak.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 } },
      { ke: 2, usiaAnjuran: { bulan: 3 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaAnjuran: { bulan: 18 }, jarakMin: { bulan: 6 }, label: 'Booster 1' },
      { ke: 5, usiaMin: { tahun: 5 }, usiaAnjuran: { tahun: 5 }, jarakMin: { bulan: 12 }, label: 'Booster 2 (usia 5-7 tahun)' },
      { ke: 6, usiaMin: { tahun: 7 }, usiaAnjuran: { tahun: 10 }, jarakMin: { tahun: 1 }, label: 'Td/Tdap (usia 10-18 tahun)' },
    ],
  },
  {
    key: 'hib',
    nama: 'Hib (Haemophilus influenzae tipe b)',
    alias: ['hib', 'haemophilus', 'pentabio', 'pentavalen', 'hexaxim', 'act-hib'],
    wajib: true,
    catatan: 'Umumnya ikut dalam vaksin kombinasi pentavalen bersama DTP dan Hepatitis B.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 } },
      { ke: 2, usiaAnjuran: { bulan: 3 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaAnjuran: { bulan: 18 }, jarakMin: { bulan: 6 }, label: 'Booster' },
    ],
  },
  {
    key: 'pcv',
    nama: 'PCV (Pneumokokus)',
    alias: ['pcv', 'pneumokokus', 'pneumococcal', 'prevenar', 'synflorix', 'pcv13', 'pcv15'],
    wajib: true,
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 } },
      { ke: 2, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 6 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaMin: { bulan: 12 }, usiaAnjuran: { bulan: 12 }, jarakMin: { bulan: 2 }, label: 'Booster (12-15 bulan)' },
    ],
  },
  {
    key: 'rotavirus_penta',
    nama: 'Rotavirus (pentavalen, 3 dosis)',
    grup: 'rotavirus',
    alias: ['rotavirus', 'rotateq', 'rotavac', 'rota pentavalen'],
    wajib: true,
    batasUsia: { minggu: 32 },
    catatan: 'Dosis pertama tidak boleh diberikan pada usia 15 minggu atau lebih, dan seluruh serinya harus selesai sebelum usia 32 minggu. Bila lewat, serinya tidak dilanjutkan.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, batasUsia: { minggu: 15 } },
      { ke: 2, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 3 }, batasUsia: { minggu: 32 } },
      { ke: 3, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 4 }, batasUsia: { minggu: 32 } },
    ],
  },
  {
    key: 'rotavirus_mono',
    nama: 'Rotavirus (monovalen, 2 dosis)',
    grup: 'rotavirus',
    alias: ['rotarix', 'rota monovalen', 'bio rotavirus'],
    wajib: true,
    batasUsia: { minggu: 24 },
    catatan: 'Dua dosis, dan harus selesai sebelum usia 24 minggu.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, batasUsia: { minggu: 15 } },
      { ke: 2, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 3 }, batasUsia: { minggu: 24 } },
    ],
  },
  {
    key: 'mr',
    nama: 'MR / MMR (Campak, Rubela, Gondongan)',
    alias: ['mr', 'mmr', 'campak', 'measles', 'rubela', 'rubella', 'trimovax', 'priorix'],
    wajib: true,
    catatan: 'MMR boleh dipakai menggantikan MR. Bila MMR sudah diberikan pada usia 12 bulan, dosis 18 bulan tidak perlu diulang — ini termasuk yang perlu dinilai dokter.',
    dosis: [
      { ke: 1, usiaMin: { bulan: 9 }, usiaAnjuran: { bulan: 9 } },
      { ke: 2, usiaMin: { bulan: 15 }, usiaAnjuran: { bulan: 18 }, jarakMin: { bulan: 6 } },
      { ke: 3, usiaMin: { tahun: 5 }, usiaAnjuran: { tahun: 5 }, jarakMin: { bulan: 6 }, label: 'Usia 5-7 tahun' },
    ],
  },
  {
    key: 'je',
    nama: 'Japanese Encephalitis (JE)',
    alias: ['je', 'japanese encephalitis', 'imojev'],
    wajib: false,
    catatan: 'Hanya untuk anak yang tinggal di atau bepergian lama ke daerah endemis (mis. Bali). Tanya dokter dulu.',
    dosis: [
      { ke: 1, usiaMin: { bulan: 9 }, usiaAnjuran: { bulan: 10 } },
      { ke: 2, jarakMin: { bulan: 12 }, usiaAnjuran: { tahun: 2 }, label: 'Booster (1-2 tahun kemudian)' },
    ],
  },
  {
    key: 'varisela',
    nama: 'Varisela (Cacar Air)',
    alias: ['varisela', 'varicella', 'cacar air', 'varilrix', 'varivax'],
    wajib: false,
    dosis: [
      { ke: 1, usiaMin: { bulan: 12 }, usiaAnjuran: { bulan: 12 } },
      { ke: 2, jarakMin: { minggu: 6 }, usiaAnjuran: { bulan: 18 } },
    ],
  },
  {
    key: 'hepa',
    nama: 'Hepatitis A',
    alias: ['hepatitis a', 'hep a', 'hav', 'havrix', 'avaxim'],
    wajib: false,
    dosis: [
      { ke: 1, usiaMin: { bulan: 12 }, usiaAnjuran: { bulan: 12 } },
      { ke: 2, jarakMin: { bulan: 6 }, usiaAnjuran: { bulan: 18 } },
    ],
  },
  {
    key: 'tifoid',
    nama: 'Tifoid',
    alias: ['tifoid', 'typhoid', 'typhim', 'tifim', 'typbar'],
    wajib: false,
    ulang: { jarak: { tahun: 3 }, sampaiUsia: { tahun: 18 } },
    catatan: 'Diulang setiap 3 tahun.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 2 }, usiaAnjuran: { tahun: 2 } },
    ],
  },
  {
    key: 'influenza',
    nama: 'Influenza',
    alias: ['influenza', 'flu', 'influvac', 'vaxigrip', 'fluarix', 'flubio'],
    wajib: false,
    ulang: { jarak: { bulan: 12 }, sampaiUsia: { tahun: 18 } },
    catatan: 'Diulang setiap tahun. Pada pemberian pertama untuk anak di bawah 9 tahun, diberikan 2 dosis berjarak 4 minggu.',
    dosis: [
      { ke: 1, usiaMin: { bulan: 6 }, usiaAnjuran: { bulan: 6 } },
      { ke: 2, jarakMin: { minggu: 4 }, hanyaJika: { usiaKurangDari: { tahun: 9 } }, label: 'Dosis kedua pada pemberian pertama (usia di bawah 9 tahun)' },
    ],
  },
  {
    key: 'hpv',
    nama: 'HPV',
    alias: ['hpv', 'gardasil', 'cervarix', 'human papilloma'],
    wajib: false,
    catatan: 'Usia 9-14 tahun cukup 2 dosis. Mulai usia 15 tahun diperlukan 3 dosis — jadwal dosis ketiga ditentukan dokter.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 9 }, usiaAnjuran: { tahun: 10 } },
      { ke: 2, jarakMin: { bulan: 6 }, label: 'Jarak 6-15 bulan dari dosis pertama' },
    ],
  },
  {
    key: 'dengue_tak',
    nama: 'Dengue (TAK-003, 2 dosis)',
    grup: 'dengue',
    alias: ['dengue', 'qdenga', 'tak-003', 'tak003', 'demam berdarah'],
    wajib: false,
    catatan: 'Sumber yang saya baca berbeda-beda soal batas usia dan jumlah dosis vaksin dengue. Baris ini WAJIB dicocokkan dokter sebelum dipakai.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 6 }, usiaAnjuran: { tahun: 6 } },
      { ke: 2, jarakMin: { bulan: 3 } },
    ],
  },
  {
    key: 'dengue_cyd',
    nama: 'Dengue (CYD, 3 dosis)',
    grup: 'dengue',
    alias: ['dengvaxia', 'cyd'],
    wajib: false,
    catatan: 'Hanya untuk anak yang terbukti pernah terinfeksi dengue. Penentuannya di tangan dokter.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 9 }, usiaAnjuran: { tahun: 9 } },
      { ke: 2, jarakMin: { bulan: 6 } },
      { ke: 3, jarakMin: { bulan: 6 } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Hitungan tanggal.
//
// Tahun & bulan ditambahkan secara kalender (12 bulan dari 31 Januari jatuh di
// 31 Januari, bukan bergeser beberapa hari), minggu & hari ditambahkan sebagai
// hari. Bulan yang meluber — 31 Agustus + 6 bulan = 31 Februari — dikembalikan
// ke hari terakhir bulan itu, bukan dibiarkan melompat ke bulan berikutnya.
// ---------------------------------------------------------------------------
export function tambahUsia(tanggal, spec) {
  const s = String(tanggal || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  let [y, m, d] = s.split('-').map(Number);
  const sp = spec || {};
  const tambahBulan = (Number(sp.tahun) || 0) * 12 + (Number(sp.bulan) || 0);
  if (tambahBulan) {
    const total = (y * 12 + (m - 1)) + tambahBulan;
    y = Math.floor(total / 12);
    m = (total % 12) + 1;
    const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > akhir) d = akhir;
  }
  const hari = (Number(sp.minggu) || 0) * 7 + (Number(sp.hari) || 0);
  const t = new Date(Date.UTC(y, m - 1, d + hari));
  return t.toISOString().slice(0, 10);
}

export function selisihHari(a, b) {
  const pa = String(a || '').slice(0, 10), pb = String(b || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pa) || !/^\d{4}-\d{2}-\d{2}$/.test(pb)) return null;
  return Math.round((Date.parse(pb + 'T00:00:00Z') - Date.parse(pa + 'T00:00:00Z')) / 86400000);
}

// "1 tahun 3 bulan" — dipakai di kartu vaksin anak.
export function umurLabel(birthDate, sampai) {
  const lahir = String(birthDate || '').slice(0, 10);
  const kini = String(sampai || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lahir) || !/^\d{4}-\d{2}-\d{2}$/.test(kini)) return '';
  const [y1, m1, d1] = lahir.split('-').map(Number);
  const [y2, m2, d2] = kini.split('-').map(Number);
  let bulan = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) bulan -= 1;
  if (bulan < 0) return '';
  if (bulan < 1) {
    const h = selisihHari(lahir, kini) || 0;
    return h + ' hari';
  }
  const th = Math.floor(bulan / 12), bl = bulan % 12;
  if (!th) return bl + ' bulan';
  return bl ? th + ' tahun ' + bl + ' bulan' : th + ' tahun';
}

// Kebalikan dari usiaSpecLabel: '1 tahun 6 bulan' -> {tahun:1, bulan:6}.
// Dipakai layar Super Admin, supaya dokter mengetik persis seperti yang
// dibacanya di tabel IDAI, bukan mengisi tiga kotak angka bersatuan.
// Mengembalikan null untuk kosong / '-', yang berarti "tidak ada batas ini".
export function parseUsia(teks) {
  const s = String(teks == null ? '' : teks).toLowerCase().trim();
  if (!s || s === '-') return null;
  const out = {};
  const re = /(\d+(?:[.,]\d+)?)\s*(tahun|thn|th|bulan|bln|bl|minggu|mgg|mg|hari|hr)/g;
  let m, ketemu = false;
  while ((m = re.exec(s))) {
    const n = Math.round(Number(String(m[1]).replace(',', '.')));
    if (!isFinite(n)) continue;
    const u = m[2];
    if (u.startsWith('t')) out.tahun = (out.tahun || 0) + n;
    else if (u.startsWith('b')) out.bulan = (out.bulan || 0) + n;
    else if (u.startsWith('m')) out.minggu = (out.minggu || 0) + n;
    else out.hari = (out.hari || 0) + n;
    ketemu = true;
  }
  // 'lahir' / '0' berarti sejak lahir — itu batas yang nyata (usia minimum 0
  // hari), bukan ketiadaan batas, jadi tidak boleh dikembalikan sebagai null.
  if (!ketemu) {
    if (/^lahir$/.test(s) || /^0$/.test(s)) return { hari: 0 };
    return null;
  }
  return out;
}

export function usiaSpecLabel(spec) {
  if (!spec) return '';
  const bagian = [];
  if (spec.tahun) bagian.push(spec.tahun + ' tahun');
  if (spec.bulan) bagian.push(spec.bulan + ' bulan');
  if (spec.minggu) bagian.push(spec.minggu + ' minggu');
  if (spec.hari) bagian.push(spec.hari + ' hari');
  return bagian.length ? bagian.join(' ') : 'lahir';
}
