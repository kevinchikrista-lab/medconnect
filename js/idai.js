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
// Angka di bawah ini disalin dari LEMBAR RESMI IDAI 2024 — tabelnya beserta
// seluruh catatan kakinya. Versi pertama berkas ini sempat memakai sumber
// sekunder (halaman-halaman yang mengutip IDAI) karena situs IDAI diblokir
// dari lingkungan tempat kode ini ditulis; lembar aslinya kemudian diberikan
// oleh dr. Kevin, dan angkanya sudah dicocokkan ulang. Yang sempat keliru dan
// kini dibetulkan: BCG (bukan usia 2 bulan, melainkan segera setelah lahir),
// batas dosis pertama rotavirus (12 minggu, bukan 15), dosis Hepatitis B &
// Polio pada usia 18 bulan yang sebelumnya hilang, dan vaksin dengue (IDAI
// 2024 hanya mencantumkan satu jenis, 2 dosis usia 6-45 tahun — varian CYD
// 3 dosis yang saya cantumkan dari sumber sekunder ternyata tidak ada).
//
// MESKIPUN BEGITU, statusnya tetap BELUM DIVERIFIKASI. Menyalin tetap bisa
// keliru, dan yang berhak menyatakan sebuah jadwal imunisasi layak dipakai
// pada pasien adalah dokter, bukan penyalinnya.
//
// Untuk jadwal imunisasi bayi, angka yang meleset bukan perkara kosmetik:
// terlalu cepat berarti dosisnya tidak sah dan harus diulang, terlalu lambat
// berarti anaknya tidak terlindungi selama selisihnya. Karena itu seluruh
// tabel ini berstatus BELUM DIVERIFIKASI. Selama statusnya masih itu:
//
//   - setiap layar yang memakainya WAJIB menampilkan spanduk peringatan;
//   - hasil hitungannya disebut "perkiraan", bukan anjuran;
//   - dr. Kevin membuka Super Admin → Jadwal Vaksin IDAI, mencocokkan tiap
//     baris dengan lembar IDAI 2024 di sebelahnya, membetulkan bila ada yang
//     salah salin, lalu menekan "Saya sudah verifikasi". Baru sesudah itu ia
//     berbicara sebagai anjuran.
//
// Angka yang sudah diverifikasi disimpan di tabel vax_schedule (lihat
// supabase-vax-schedule.sql) dan menimpa bibit di berkas ini. Jadi
// pembetulan dr. Kevin tidak akan hilang saat aplikasi diperbarui.
// =============================================================================

export const IDAI_META = {
  versi: 'idai-2024',
  sumber: 'Jadwal Imunisasi Anak Usia 0-18 Tahun, Rekomendasi Ikatan Dokter Anak Indonesia (IDAI) Tahun 2024',
  sumber_url: 'https://www.idai.or.id/professional-resources/rekomendasi/jadwal-imunisasi-anak-usia-0-18-tahun',
  diambil: '2026-08-14',
  // Kini disalin langsung dari lembar resmi IDAI 2024 (tabel + seluruh
  // catatan kakinya), bukan lagi dari halaman yang mengutipnya.
  primer: true,
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
    catatan: 'Vaksin monovalen disuntikkan segera setelah lahir, sebelum berumur 24 jam, didahului vitamin K minimal 30 menit sebelumnya. Bayi dengan berat lahir kurang dari 2000 g sebaiknya ditunda sampai usia 1 bulan, KECUALI bila ibunya HBsAg positif. Dosis berikutnya ikut vaksin kombinasi pentavalen.',
    dosis: [
      { ke: 1, usiaMin: { hari: 0 }, usiaAnjuran: { hari: 0 }, label: 'HB-0 (dalam 24 jam setelah lahir)' },
      { ke: 2, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, jarakMin: { minggu: 4 } },
      { ke: 3, usiaAnjuran: { bulan: 3 }, jarakMin: { minggu: 4 } },
      { ke: 4, usiaAnjuran: { bulan: 4 }, jarakMin: { minggu: 4 } },
      { ke: 5, usiaAnjuran: { bulan: 18 }, jarakMin: { bulan: 6 }, jenis: 'booster', label: 'HB-4 (ikut booster pentavalen usia 18 bulan)' },
    ],
  },
  {
    key: 'polio',
    nama: 'Polio',
    alias: ['polio', 'opv', 'ipv', 'bopv', 'poliomyelitis', 'imovax polio', 'hexaxim'],
    wajib: true,
    catatan: 'bOPV (tetes) saat lahir, lalu 3x bOPV pada usia 2, 3, 4 bulan, DAN minimal 2x IPV (suntik) — sesuai panduan Kemenkes pada usia 4 dan 9 bulan.',
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
    // TIDAK diberi batasUsia. Di atas 3 bulan BCG masih boleh diberikan bila
    // uji tuberkulin negatif — jadi menandainya "lewat batas" akan keliru dan
    // membuat anak yang sebetulnya masih bisa divaksin terlihat tidak bisa.
    // Yang benar: ia jatuh ke "perlu dinilai dokter", dan itu memang tepat.
    catatan: 'Diberikan segera setelah lahir atau sebelum usia 1 bulan. Pada usia 3 bulan atau lebih, BCG baru diberikan bila uji tuberkulin negatif. Bayi dari ibu TB aktif: ditunda sampai terbukti tidak terinfeksi.',
    dosis: [
      { ke: 1, usiaMin: { hari: 0 }, usiaAnjuran: { hari: 0 }, jenis: 'primer' },
    ],
  },
  {
    key: 'dtp',
    nama: 'DTP (Difteri, Tetanus, Pertusis)',
    alias: ['dtp', 'dpt', 'dtap', 'dtwp', 'difteri', 'pentabio', 'pentavalen', 'infanrix', 'hexaxim', 'tetraxim', 'pediacel', 'td', 'tdap', 'boostrix', 'adacel', 'dt'],
    wajib: true,
    catatan: 'Boleh mulai usia 6 minggu. DTPa dapat diberikan pada usia 2, 3, 4 bulan atau 2, 4, 6 bulan. Booster pertama usia 18 bulan, berikutnya 5-7 tahun dan 10-18 tahun. Mulai usia 7 tahun memakai Td/Tdap.',
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
    catatan: 'Diberikan dalam bentuk kombinasi pentavalen atau heksavalen bersama DTP, pada usia 2, 4, 6 bulan atau 2, 3, 4 bulan, dan booster usia 18 bulan.',
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
    catatan: 'Usia 2, 4, 6 bulan dengan booster 12-15 bulan. Jadwal kejar: belum diberikan pada usia 7-12 bulan -> 2 kali jarak minimal 1 bulan + booster 12-15 bulan; usia 1-2 tahun -> 2 kali jarak minimal 2 bulan; usia 2-5 tahun -> PCV10 2 kali jarak 2 bulan, PCV13/PCV15 cukup 1 kali. Program nasional memakai PCV13 pada usia 2, 3, dan 12 bulan.',
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
    catatan: 'Dosis pertama pada usia 6-12 minggu, jarak antar dosis 4-10 minggu, dan dosis ketiga paling lambat usia 32 minggu. Program nasional memakai jadwal 2, 3, 4 bulan dengan dosis ketiga paling lambat usia 6 bulan 29 hari.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, batasUsia: { minggu: 12 }, jenis: 'primer' },
      { ke: 2, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 4 }, batasUsia: { minggu: 32 }, jenis: 'primer' },
      { ke: 3, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 6 }, batasUsia: { minggu: 32 }, jenis: 'primer' },
    ],
  },
  {
    key: 'rotavirus_mono',
    nama: 'Rotavirus (monovalen, 2 dosis)',
    grup: 'rotavirus',
    alias: ['rotarix', 'rota monovalen', 'bio rotavirus'],
    wajib: true,
    batasUsia: { minggu: 24 },
    catatan: 'Dua dosis. Dosis pertama usia 6-12 minggu, dosis kedua berjarak minimal 4 minggu, paling lambat usia 24 minggu.',
    dosis: [
      { ke: 1, usiaMin: { minggu: 6 }, usiaAnjuran: { bulan: 2 }, batasUsia: { minggu: 12 }, jenis: 'primer' },
      { ke: 2, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 4 }, batasUsia: { minggu: 24 }, jenis: 'primer' },
    ],
  },
  {
    key: 'mr',
    nama: 'MR / MMR (Campak, Rubela, Gondongan)',
    alias: ['mr', 'mmr', 'campak', 'measles', 'rubela', 'rubella', 'trimovax', 'priorix'],
    wajib: true,
    catatan: 'MR mulai umur 9 bulan, dosis kedua umur 15-18 bulan, dosis ketiga umur 5-7 tahun. Bila sampai usia 12 bulan belum mendapat MR, boleh diberikan MR/MMR dengan dosis kedua berjarak 6 bulan.',
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
    catatan: 'Untuk anak yang tinggal di daerah endemis atau akan bepergian ke sana selama 1 bulan atau lebih. Dosis pertama mulai usia 9 bulan; booster 1-2 tahun kemudian untuk yang menetap di daerah endemis.',
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
    catatan: 'Mulai usia 12 bulan. Usia 1-12 tahun: 2 dosis berjarak 6 minggu sampai 3 bulan. Usia 13 tahun ke atas: jarak 4-6 minggu. Anak 2 tahun ke atas yang belum mendapat MR/MMR dan varisela boleh memakai MMRV sebagai dosis primer.',
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
    catatan: 'Mulai usia 12 bulan, 2 dosis dengan jarak 6-18 bulan.',
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
    catatan: 'Vaksin tifoid polisakarida, mulai usia 2 tahun, diulang tiap 3 tahun.',
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
    catatan: 'Mulai usia 6 bulan. Pada seri pertama untuk usia 6 bulan sampai 8 tahun diberikan 2 dosis berjarak 4 minggu; usia 9 tahun ke atas cukup satu kali. Selanjutnya diulang setiap tahun satu kali.',
    dosis: [
      { ke: 1, usiaMin: { bulan: 6 }, usiaAnjuran: { bulan: 6 } },
      { ke: 2, jarakMin: { minggu: 4 }, usiaAnjuran: { bulan: 7 }, hanyaJika: { usiaKurangDari: { tahun: 9 } }, jenis: 'primer', label: 'Dosis kedua pada pemberian pertama (usia di bawah 9 tahun)' },
    ],
  },
  {
    key: 'hpv',
    nama: 'HPV',
    alias: ['hpv', 'gardasil', 'cervarix', 'human papilloma'],
    wajib: false,
    catatan: 'Anak perempuan usia 9-14 tahun: 2 dosis berjarak 6-12 bulan. Mulai usia 15 tahun: 3 dosis seperti dosis dewasa (bivalen 0, 1, 6 bulan; quadrivalen/nonavalen 0, 2, 6 bulan) — jadwal dosis ketiga ditentukan dokter.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 9 }, usiaAnjuran: { tahun: 10 } },
      { ke: 2, jarakMin: { bulan: 6 }, usiaAnjuran: { tahun: 11 }, jenis: 'primer', label: 'Jarak 6-12 bulan dari dosis pertama' },
    ],
  },
  {
    key: 'dengue',
    nama: 'Dengue',
    alias: ['dengue', 'qdenga', 'tak-003', 'tak003', 'dengvaxia', 'demam berdarah'],
    wajib: false,
    catatan: 'Dua dosis dengan jarak 3 bulan, untuk usia 6-45 tahun. Tidak perlu pemeriksaan serologis sebagai pra-skrining.',
    dosis: [
      { ke: 1, usiaMin: { tahun: 6 }, usiaAnjuran: { tahun: 6 }, jenis: 'primer' },
      { ke: 2, jarakMin: { bulan: 3 }, usiaAnjuran: { tahun: 6 }, jenis: 'primer' },
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

// ---------------------------------------------------------------------------
// SUMBU USIA — kolom-kolom pada tabel gaya IDAI.
//
// Disalin persis dari lembar resmi: bulan 0,1,2,3,4,5,6,9,12,15,18,24 lalu
// tahun 3 sampai 18. Perhatikan lompatannya (tidak ada bulan 7, 8, 10, 11) —
// itu memang begitu di lembar aslinya, dan menambah kolom yang tidak ada di
// sana akan membuat tabel kita tidak lagi bisa dicocokkan dengan lembar yang
// dipegang dokter.
//
// Cara membaca satu kolom, menurut catatan di lembar itu: "misal 2 berarti
// mulai usia 2 bulan (60 hari) sampai dengan 2 bulan 29 hari (89 hari)".
// ---------------------------------------------------------------------------
export const KOLOM_USIA = [
  { key: 'lahir', label: 'Lahir', bulan: 0, satuan: 'bulan' },
  { key: 'b1', label: '1', bulan: 1, satuan: 'bulan' },
  { key: 'b2', label: '2', bulan: 2, satuan: 'bulan' },
  { key: 'b3', label: '3', bulan: 3, satuan: 'bulan' },
  { key: 'b4', label: '4', bulan: 4, satuan: 'bulan' },
  { key: 'b5', label: '5', bulan: 5, satuan: 'bulan' },
  { key: 'b6', label: '6', bulan: 6, satuan: 'bulan' },
  { key: 'b9', label: '9', bulan: 9, satuan: 'bulan' },
  { key: 'b12', label: '12', bulan: 12, satuan: 'bulan' },
  { key: 'b15', label: '15', bulan: 15, satuan: 'bulan' },
  { key: 'b18', label: '18', bulan: 18, satuan: 'bulan' },
  { key: 'b24', label: '24', bulan: 24, satuan: 'bulan' },
  { key: 't3', label: '3', bulan: 36, satuan: 'tahun' },
  { key: 't4', label: '4', bulan: 48, satuan: 'tahun' },
  { key: 't5', label: '5', bulan: 60, satuan: 'tahun' },
  { key: 't6', label: '6', bulan: 72, satuan: 'tahun' },
  { key: 't7', label: '7', bulan: 84, satuan: 'tahun' },
  { key: 't8', label: '8', bulan: 96, satuan: 'tahun' },
  { key: 't9', label: '9', bulan: 108, satuan: 'tahun' },
  { key: 't10', label: '10', bulan: 120, satuan: 'tahun' },
  { key: 't11', label: '11', bulan: 132, satuan: 'tahun' },
  { key: 't12', label: '12', bulan: 144, satuan: 'tahun' },
  { key: 't13', label: '13', bulan: 156, satuan: 'tahun' },
  { key: 't14', label: '14', bulan: 168, satuan: 'tahun' },
  { key: 't15', label: '15', bulan: 180, satuan: 'tahun' },
  { key: 't16', label: '16', bulan: 192, satuan: 'tahun' },
  { key: 't17', label: '17', bulan: 204, satuan: 'tahun' },
  { key: 't18', label: '18', bulan: 216, satuan: 'tahun' },
];

// Berapa bulan sebuah spesifikasi usia, untuk keperluan MENEMPATKAN KOLOM
// saja. Minggu dan hari dibulatkan kasar di sini — dan itu memang tidak apa,
// karena yang dihitung bukan tanggal suntikannya (itu tetap lewat tambahUsia
// yang kalender-tepat), melainkan sel mana yang diwarnai.
export function usiaKeBulan(spec) {
  if (!spec) return 0;
  return (Number(spec.tahun) || 0) * 12 + (Number(spec.bulan) || 0)
    + (Number(spec.minggu) || 0) / 4.345 + (Number(spec.hari) || 0) / 30.44;
}

// Kolom terakhir yang usianya belum melewati nilai ini. 18 bulan jatuh di
// kolom '18', 20 bulan tetap di kolom '18' (kolom berikutnya baru 24).
export function kolomUntukBulan(bulan) {
  const b = Number(bulan) || 0;
  let idx = 0;
  for (let i = 0; i < KOLOM_USIA.length; i++) {
    if (KOLOM_USIA[i].bulan <= b) idx = i; else break;
  }
  return idx;
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
