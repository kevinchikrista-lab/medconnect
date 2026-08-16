// =============================================================================
// STEMPEL FOTO — dokumentasi vaksinasi umroh & haji
// =============================================================================
//
// KENAPA ADA
//
// Klinik yang melayani vaksin umroh perlu menyerahkan foto berstempel waktu dan
// tempat kepada travel. Yang dipakai selama ini aplikasi pihak ketiga berbayar
// dan penuh iklan, dan iklannya menghambat pekerjaan saat antrean panjang.
// Jadi fungsinya dikerjakan sendiri di sini: buka kamera dari aplikasi, jepret,
// stempelnya langsung menempel. Tanpa iklan, tanpa langganan, tanpa memasang
// aplikasi apa pun.
//
// ANGKANYA DIUKUR, BUKAN DIKETIK
//
// Waktu diambil dari jam perangkat pada detik jepretan, koordinat dari GPS
// perangkat, alamat dari pencarian balik koordinat itu. Untuk foto yang sudah
// terlanjur ada, dipakai EXIF-nya. Kalau EXIF-nya tidak ada, petugas boleh
// mengisi — dan barisnya ditulis apa adanya sebagai waktu yang dicatat petugas,
// bukan disamarkan sebagai jam kamera. Sebuah stempel waktu hanya berguna
// selama ia berarti apa yang tampak diartikannya.
//
// TATA LETAKNYA
//
// Diukur dari lembar Photoshop yang dipakai klinik selama ini, kanvas
// 1200x1600, supaya hasilnya seragam dengan arsip mereka yang sudah ada:
//
//   kotak kanan atas   x 899..1146  y 1231..1292   (247 x  61)  radius 16
//   panel utama        x 368..1145  y 1288..1578   (777 x 290)  radius 16
//   kotak peta         x  58.. 345  y 1288..1575   (287 x 287)  radius 16
//   ikon kecil         x 913.. 944  y 1246..1278   ( 31 x  32)
//   teks kotak atas    x 957        puncak tinta y 1256   (tinggi 17)
//   dua baris besar    x 395        puncak tinta y 1317, 1367 (tinggi 36)
//   lima baris kecil   x 392        puncak tinta y 1412..1536 tiap 31 (tinggi 23)
//
// Warna panel #666666 rata.
// =============================================================================

export const KANVAS = { w: 1200, h: 1600 };
export const ABU = '#666666';
export const PUTIH = '#ffffff';

export const TATA = {
  kotakAtas: { x: 899, y: 1231, w: 247, h: 61, r: 16 },
  panel:     { x: 368, y: 1288, w: 777, h: 290, r: 16 },
  peta:      { x: 58,  y: 1288, w: 287, h: 287, r: 16 },
  ikon:      { x: 913, y: 1246, w: 31,  h: 32 },
  teksAtas:  { x: 957, yTop: 1256, tinta: 17 },
  besar:     { x: 395, yTop: [1317, 1367], tinta: 36 },
  kecil:     { x: 392, yTop: [1412, 1443, 1474, 1505, 1536], tinta: 23 },
};

// SF UI Display hanya boleh dipakai di platform Apple dan tidak boleh ditanam
// ke situs web, jadi ia dipanggil lewat -apple-system: di iPhone yang muncul
// font aslinya, di tempat lain Inter — yang memang dirancang mirip.
export const FONT_TUMPUK = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const HARI_INGGRIS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dua(n) { return String(n).padStart(2, '0'); }

// Selisih waktu perangkat terhadap GMT, ditulis seperti pada stempel: +07:00.
// Diambil dari perangkat, bukan dipaku ke WIB — klinik di Makassar atau Jayapura
// akan menghasilkan +08:00 dan +09:00 dengan sendirinya.
export function labelGmt(d) {
  const menit = -d.getTimezoneOffset();
  const tanda = menit < 0 ? '-' : '+';
  const a = Math.floor(Math.abs(menit) / 60), b = Math.abs(menit) % 60;
  return 'GMT ' + tanda + dua(a) + ':' + dua(b);
}

// "Saturday, 08/08/2026 12:11 PM GMT +07:00"
export function barisWaktu(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  let jam = d.getHours();
  const ampm = jam >= 12 ? 'PM' : 'AM';
  jam = jam % 12; if (jam === 0) jam = 12;
  return HARI_INGGRIS[d.getDay()] + ', '
    + dua(d.getDate()) + '/' + dua(d.getMonth() + 1) + '/' + d.getFullYear() + ' '
    + dua(jam) + ':' + dua(d.getMinutes()) + ' ' + ampm + ' ' + labelGmt(d);
}

// Tanggal + jam dari dua kotak isian layar, dibaca sebagai waktu setempat.
export function rakitWaktu(tanggal, jam) {
  const t = String(tanggal || '').slice(0, 10);
  const j = String(jam || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !/^\d{2}:\d{2}$/.test(j)) return null;
  const d = new Date(t + 'T' + j + ':00');
  return isNaN(d.getTime()) ? null : d;
}

// Number.isFinite, BUKAN isFinite. isFinite(null) bernilai true karena null
// dipaksa jadi 0 — jadi GPS yang mati menghasilkan "Lat 0.000000 Long
// 0.000000", sebuah titik di tengah Teluk Guinea, tercetak dengan penuh
// percaya diri di atas foto jemaah.
export function koordinatLabel(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  const b = (v) => (v < 0 ? '-' : '') + Math.abs(Number(v)).toFixed(6);
  return 'Lat ' + b(lat) + '° Long ' + b(lon) + '°';
}

// ---------------------------------------------------------------------------
// Isi panel.
//
// `asal` menentukan baris terakhir, dan itu satu-satunya tempat perbedaan
// antara foto yang dijepret di sini dan foto yang waktunya diketik terlihat.
// Perbedaan itu sengaja tidak disembunyikan.
// ---------------------------------------------------------------------------
export function susunBaris(isi) {
  const o = isi || {};
  const waktu = o.waktu instanceof Date ? o.waktu : null;
  const garisWaktu = waktu ? barisWaktu(waktu) : '';

  const kecil = [];
  (o.alamat || []).slice(0, 3).forEach(a => { if (a) kecil.push(String(a)); });
  const koord = koordinatLabel(o.lat, o.lon);
  if (koord) kecil.push(koord);
  if (garisWaktu) {
    kecil.push(o.asal === 'manual' ? garisWaktu + ' (dicatat petugas)' : garisWaktu);
  }
  // Panelnya memuat lima baris. Kalau koordinatnya tidak ada (GPS mati), yang
  // hilang barisnya, bukan tata letaknya — sisanya tetap di y yang sama.
  while (kecil.length < TATA.kecil.yTop.length) kecil.push('');

  return {
    atas: String(o.namaKlinik || '').slice(0, 28),
    besar: [String(o.namaJemaah || '').toUpperCase(), String(o.layanan || '')],
    kecil: kecil.slice(0, TATA.kecil.yTop.length),
  };
}

// ---------------------------------------------------------------------------
// Menggambar
// ---------------------------------------------------------------------------

function kotakBulat(ctx, k) {
  const { x, y, w, h, r } = k;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// Ukuran font dicari supaya TINGGI TINTA-nya sama dengan lembar Photoshop —
// bukan disamakan angka "px"-nya, karena tinggi tinta pada ukuran yang sama
// berbeda antar font, dan yang dilihat mata adalah tintanya.
export function ukuranUntukTinta(ctx, tinggiTarget, contoh, tumpuk) {
  let lo = 8, hi = 120, best = 12;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    ctx.font = mid + 'px ' + tumpuk;
    const m = ctx.measureText(contoh);
    const t = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
    if (t <= tinggiTarget) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return best;
}

// Menaruh teks berdasarkan PUNCAK TINTA, bukan garis dasar. Yang diukur dari
// lembar Photoshop adalah puncak tintanya; memakai garis dasar berarti
// menerjemahkan dua kali dan meleset beberapa piksel di tiap baris.
function teksDi(ctx, x, yPuncak, s, font) {
  if (!s) return;
  ctx.font = font;
  const m = ctx.measureText(s);
  ctx.fillText(s, x, yPuncak + (m.actualBoundingBoxAscent || 0));
}

// Foto dipotong tengah ke rasio 3:4 lalu diskalakan ke 1200x1600, supaya
// panelnya selalu jatuh di tempat yang sama seperti arsip lama klinik.
export function kotakPotong(lebar, tinggi) {
  const rasio = KANVAS.w / KANVAS.h;
  const r = lebar / tinggi;
  if (r > rasio) {
    const w = Math.round(tinggi * rasio);
    return { sx: Math.round((lebar - w) / 2), sy: 0, sw: w, sh: tinggi };
  }
  const h = Math.round(lebar / rasio);
  return { sx: 0, sy: Math.round((tinggi - h) / 2), sw: lebar, sh: h };
}

/**
 * Menggambar seluruh stempel ke sebuah canvas 1200x1600.
 *
 * @param canvas  elemen canvas tujuan
 * @param foto    HTMLImageElement / HTMLVideoElement / ImageBitmap, boleh null
 * @param isi     hasil susunBaris()
 * @param petaImg gambar peta 287x287 (boleh null)
 * @param logoImg logo klinik (boleh null)
 */
export function gambarStempel(canvas, foto, isi, petaImg, logoImg) {
  canvas.width = KANVAS.w;
  canvas.height = KANVAS.h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, KANVAS.w, KANVAS.h);
  if (foto) {
    const lebar = foto.naturalWidth || foto.videoWidth || foto.width;
    const tinggi = foto.naturalHeight || foto.videoHeight || foto.height;
    if (lebar && tinggi) {
      const p = kotakPotong(lebar, tinggi);
      ctx.drawImage(foto, p.sx, p.sy, p.sw, p.sh, 0, 0, KANVAS.w, KANVAS.h);
    }
  }

  ctx.fillStyle = ABU;
  kotakBulat(ctx, TATA.kotakAtas);
  kotakBulat(ctx, TATA.panel);
  kotakBulat(ctx, TATA.peta);

  // Kotak peta. Kalau petanya tidak bisa diambil (sinyal mati), yang muncul
  // logo klinik — BUKAN peta lokasi lain sebagai penambal, karena peta yang
  // salah lebih buruk daripada tidak ada peta.
  const isiPeta = petaImg || logoImg;
  if (isiPeta) {
    ctx.save();
    kotakBulat(ctx, { ...TATA.peta });
    ctx.clip();
    if (petaImg) {
      ctx.drawImage(petaImg, TATA.peta.x, TATA.peta.y, TATA.peta.w, TATA.peta.h);
    } else {
      const sisi = TATA.peta.w - 48;
      const lw = logoImg.naturalWidth || logoImg.width || sisi;
      const lh = logoImg.naturalHeight || logoImg.height || sisi;
      const s = Math.min(sisi / lw, sisi / lh);
      ctx.drawImage(logoImg, TATA.peta.x + (TATA.peta.w - lw * s) / 2,
        TATA.peta.y + (TATA.peta.h - lh * s) / 2, lw * s, lh * s);
    }
    ctx.restore();
  }

  if (logoImg) {
    const lw = logoImg.naturalWidth || logoImg.width || TATA.ikon.w;
    const lh = logoImg.naturalHeight || logoImg.height || TATA.ikon.h;
    const s = Math.min(TATA.ikon.w / lw, TATA.ikon.h / lh);
    ctx.drawImage(logoImg, TATA.ikon.x + (TATA.ikon.w - lw * s) / 2,
      TATA.ikon.y + (TATA.ikon.h - lh * s) / 2, lw * s, lh * s);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PUTIH;

  const uMini = ukuranUntukTinta(ctx, TATA.teksAtas.tinta, 'GPS Map Camera', FONT_TUMPUK);
  const uBesar = ukuranUntukTinta(ctx, TATA.besar.tinta, 'Kecamatan Delta Pawan, Kalimantan', FONT_TUMPUK);
  const uKecil = ukuranUntukTinta(ctx, TATA.kecil.tinta, 'Jl. Urip Sumoharjo No.49a, Kantor, Kec. Delta Pawan,', FONT_TUMPUK);

  teksDi(ctx, TATA.teksAtas.x, TATA.teksAtas.yTop, isi.atas, uMini + 'px ' + FONT_TUMPUK);

  const fBesar = uBesar + 'px ' + FONT_TUMPUK;
  TATA.besar.yTop.forEach((y, i) => teksDi(ctx, TATA.besar.x, y, isi.besar[i] || '', fBesar));

  const fKecil = uKecil + 'px ' + FONT_TUMPUK;
  TATA.kecil.yTop.forEach((y, i) => teksDi(ctx, TATA.kecil.x, y, isi.kecil[i] || '', fKecil));

  // Atribusi peta. Wajib dicantumkan saat memakai ubin OpenStreetMap, dan
  // ditaruh di dalam kotak petanya sendiri supaya ikut terpotong bila
  // petanya tidak ada.
  if (petaImg) {
    ctx.save();
    kotakBulat(ctx, { ...TATA.peta });
    ctx.clip();
    ctx.font = '15px ' + FONT_TUMPUK;
    const t = '© OpenStreetMap';
    const w = ctx.measureText(t).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(TATA.peta.x, TATA.peta.y + TATA.peta.h - 22, w, 22);
    ctx.fillStyle = PUTIH;
    ctx.fillText(t, TATA.peta.x + 6, TATA.peta.y + TATA.peta.h - 6);
    ctx.restore();
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Peta: ubin OpenStreetMap dirangkai sendiri.
//
// Tidak memakai peta Google: ubinnya tidak boleh diambil langsung tanpa kunci
// berbayar dan tidak boleh digambar ke canvas seperti ini. OpenStreetMap boleh,
// asal atribusinya dicantumkan — dan itu sudah digambar di atas.
// ---------------------------------------------------------------------------
export function ubinDari(lat, lon, z) {
  const rad = lat * Math.PI / 180;
  const n = Math.pow(2, z);
  const x = (lon + 180) / 360 * n;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  return { x, y };
}

export function petaUrls(lat, lon, z, sisi) {
  const t = ubinDari(lat, lon, z);
  const pusatX = t.x * 256, pusatY = t.y * 256;
  const kiri = pusatX - sisi / 2, atas = pusatY - sisi / 2;
  const x0 = Math.floor(kiri / 256), y0 = Math.floor(atas / 256);
  const x1 = Math.floor((kiri + sisi) / 256), y1 = Math.floor((atas + sisi) / 256);
  const maks = Math.pow(2, z);
  const daftar = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (ty < 0 || ty >= maks) continue;
      const wx = ((tx % maks) + maks) % maks;
      daftar.push({
        url: 'https://tile.openstreetmap.org/' + z + '/' + wx + '/' + ty + '.png',
        dx: tx * 256 - kiri, dy: ty * 256 - atas,
      });
    }
  }
  return daftar;
}

// ---------------------------------------------------------------------------
// Bagian yang berurusan dengan peramban.
//
// Dipisah dari yang di atas supaya hitungan tata letak, format waktu, dan
// susunan barisnya bisa diuji tanpa kamera, tanpa GPS, dan tanpa jaringan.
// ---------------------------------------------------------------------------

export function muatGambar(src, silang) {
  return new Promise((selesai, gagal) => {
    const im = new Image();
    // Tanpa ini, ubin dari domain lain MENCEMARI canvas dan toBlob() ditolak —
    // gambarnya terlihat di layar tapi tidak bisa diunduh sama sekali.
    if (silang) im.crossOrigin = 'anonymous';
    im.onload = () => selesai(im);
    im.onerror = () => gagal(new Error('Gambar gagal dimuat'));
    im.src = src;
  });
}

// Merangkai ubin OpenStreetMap jadi satu gambar 287x287 dengan penanda di
// tengah. Mengembalikan null bila jaringannya mati — pemanggilnya menggambar
// logo klinik sebagai gantinya, bukan peta tempat lain.
export async function ambilPeta(lat, lon, z) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const sisi = TATA.peta.w;
  const zoom = z || 17;
  try {
    const potongan = petaUrls(lat, lon, zoom, sisi);
    const gambar = await Promise.all(potongan.map(p => muatGambar(p.url, true)));
    const c = document.createElement('canvas');
    c.width = sisi; c.height = sisi;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e2d8'; ctx.fillRect(0, 0, sisi, sisi);
    gambar.forEach((im, i) => ctx.drawImage(im, potongan[i].dx, potongan[i].dy));
    // Penanda merah di titik koordinatnya
    const cx = sisi / 2, cy = sisi / 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 13, Math.PI, 0);
    ctx.lineTo(cx, cy + 16);
    ctx.closePath();
    ctx.fillStyle = '#d7263d'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 14, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    return c;
  } catch (e) { return null; }
}

export function posisiSekarang(timeoutMs) {
  return new Promise((selesai) => {
    if (!navigator.geolocation) return selesai(null);
    navigator.geolocation.getCurrentPosition(
      p => selesai({ lat: p.coords.latitude, lon: p.coords.longitude, akurasi: p.coords.accuracy }),
      () => selesai(null),
      { enableHighAccuracy: true, timeout: timeoutMs || 12000, maximumAge: 0 }
    );
  });
}

// Alamat dari koordinat. Gagal = alamat kosong, bukan alamat tebakan.
export async function alamatDari(lat, lon) {
  try {
    const u = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat='
      + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
    const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    const a = j.address || {};
    const jalan = [a.road, a.house_number].filter(Boolean).join(' No.');
    const desa = a.village || a.suburb || a.neighbourhood || '';
    const kec = a.city_district || a.municipality || a.county || '';
    const kota = a.city || a.town || a.regency || '';
    const prov = a.state || '';
    const pos = a.postcode || '';
    return [
      [jalan, desa].filter(Boolean).join(', '),
      [kec, kota].filter(Boolean).join(', '),
      [prov, pos, 'Indonesia'].filter(Boolean).join(' '),
    ].filter(Boolean);
  } catch (e) { return []; }
}

// ---- EXIF ------------------------------------------------------------------
// Pembaca kecil untuk dua hal saja: kapan foto diambil, dan di mana. Sengaja
// tidak memakai pustaka luar — aplikasi ini tidak punya tahap pembangunan, dan
// setiap <script> tambahan adalah satu hal lagi yang bisa gagal dimuat.
function _rasional(dv, off, le) {
  const a = dv.getUint32(off, le), b = dv.getUint32(off + 4, le);
  return b ? a / b : 0;
}

export function bacaExifDari(buffer) {
  try {
    const dv = new DataView(buffer);
    if (dv.getUint16(0, false) !== 0xFFD8) return null;   // bukan JPEG
    let off = 2;
    while (off < dv.byteLength - 4) {
      if (dv.getUint16(off, false) !== 0xFFE1) {
        const panjang = dv.getUint16(off + 2, false);
        if (!panjang) break;
        off += 2 + panjang;
        continue;
      }
      const awal = off + 4;
      if (dv.getUint32(awal, false) !== 0x45786966) return null;   // "Exif"
      const tiff = awal + 6;
      const le = dv.getUint16(tiff, false) === 0x4949;
      const ifd0 = tiff + dv.getUint32(tiff + 4, le);
      const hasil = { waktu: null, lat: null, lon: null };

      const bacaIfd = (mulai, tampung) => {
        const n = dv.getUint16(mulai, le);
        for (let i = 0; i < n; i++) {
          const e = mulai + 2 + i * 12;
          tampung(dv.getUint16(e, le), dv.getUint16(e + 2, le), dv.getUint32(e + 4, le), e + 8);
        }
        return mulai + 2 + n * 12;
      };
      const teks = (jml, nilaiOff) => {
        const p = jml > 4 ? tiff + dv.getUint32(nilaiOff, le) : nilaiOff;
        let s = '';
        for (let k = 0; k < jml - 1; k++) s += String.fromCharCode(dv.getUint8(p + k));
        return s;
      };

      let exifOff = 0, gpsOff = 0;
      bacaIfd(ifd0, (tag, tipe, jml, nilaiOff) => {
        if (tag === 0x8769) exifOff = tiff + dv.getUint32(nilaiOff, le);
        if (tag === 0x8825) gpsOff = tiff + dv.getUint32(nilaiOff, le);
      });

      if (exifOff) {
        bacaIfd(exifOff, (tag, tipe, jml, nilaiOff) => {
          // 0x9003 DateTimeOriginal — "2026:08:08 12:11:03"
          if (tag === 0x9003 || (tag === 0x9004 && !hasil.waktu)) {
            const s = teks(jml, nilaiOff);
            const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (m) hasil.waktu = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
          }
        });
      }
      if (gpsOff) {
        let latRef = 'N', lonRef = 'E', latV = null, lonV = null;
        bacaIfd(gpsOff, (tag, tipe, jml, nilaiOff) => {
          const dms = () => {
            const p = tiff + dv.getUint32(nilaiOff, le);
            return _rasional(dv, p, le) + _rasional(dv, p + 8, le) / 60 + _rasional(dv, p + 16, le) / 3600;
          };
          if (tag === 1) latRef = String.fromCharCode(dv.getUint8(nilaiOff));
          if (tag === 3) lonRef = String.fromCharCode(dv.getUint8(nilaiOff));
          if (tag === 2) latV = dms();
          if (tag === 4) lonV = dms();
        });
        if (latV !== null) hasil.lat = latRef === 'S' ? -latV : latV;
        if (lonV !== null) hasil.lon = lonRef === 'W' ? -lonV : lonV;
      }
      return hasil;
    }
    return null;
  } catch (e) { return null; }
}

export async function bacaExif(file) {
  try { return bacaExifDari(await file.arrayBuffer()); } catch (e) { return null; }
}
