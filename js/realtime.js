// Sambungan langsung ke Supabase Realtime — TANPA pustaka.
//
// Sebelumnya halaman yang dipakai bersama saling menyusul dengan menanyakan
// ulang tiap belasan detik. Itu cukup untuk catatan yang ditulis sesekali,
// tetapi terasa lambat untuk dua orang yang menulis bergantian: yang satu
// menekan simpan, yang lain baru melihatnya belasan detik kemudian.
//
// KENAPA TIDAK MEMAKAI supabase-js
//
// Aplikasi ini tidak punya tahap pembangunan. Menambah supabase-js berarti
// satu berkas besar dari CDN yang harus berhasil dimuat sebelum halaman bisa
// dipakai sama sekali — dan kalau CDN-nya bermasalah, yang mati bukan cuma
// pembaruan langsungnya, melainkan seluruh halaman.
//
// Realtime Supabase adalah Phoenix Channels di atas WebSocket biasa. Seluruh
// protokolnya JSON, dan peramban sudah punya WebSocket sejak lama. Berkas ini
// memakai keduanya langsung, jadi tidak ada yang perlu diunduh lebih dulu.
//
// YANG DIKIRIM LEWAT SAMBUNGAN INI: TIDAK APA-APA
//
// Pesan dari Realtime di sini diperlakukan sebagai BEL PINTU, bukan sebagai
// data. Isinya sengaja tidak dibaca sama sekali — begitu ada kabar bahwa
// tabelnya berubah, halaman mengambil ulang lewat jalur REST biasa yang sudah
// melewati RLS. Jadi walau suatu saat kebijakan Realtime salah pasang dan
// mengirim baris yang tidak seharusnya, tidak ada isi yang sampai ke layar
// dari jalur ini.
//
// Prasyarat di server: tabelnya harus dimasukkan ke publikasi Realtime —
// lihat supabase-realtime-catatan.sql.

import { CONFIG } from './config.js';

const URL_WS = String(CONFIG.SUPABASE_URL || '').replace(/^http/, 'ws') + '/realtime/v1/websocket';

// Phoenix memutus sambungan yang diam terlalu lama. 25 detik memberi ruang
// sebelum batas 60 detik di sisi server, tanpa jadi lalu lintas yang berarti.
let JEDA_DETAK = 25000;

// Menyambung ulang tidak boleh langsung dan tidak boleh terus-menerus: kalau
// jaringan klinik sedang putus, seratus percobaan per menit hanya menghabiskan
// baterai dan kuota tanpa satu pun berhasil.
const MUNDUR = [1000, 2000, 4000, 8000, 15000, 30000];

let sock = null;
let ref = 0;
let detakTimer = null;
let sambungTimer = null;
let gagalBerturut = 0;
let tokenTerkirim = '';

// topik -> { tabel, joinRef, tersambung, pendengar:Set }
const kanal = new Map();
const pemerhatiStatus = new Set();

let status = 'mati';   // mati | menyambung | hidup | gagal

function setStatus(s) {
  if (status === s) return;
  status = s;
  pemerhatiStatus.forEach(f => { try { f(s); } catch (e) {} });
}

export function realtimeStatus() { return status; }

function tokenSekarang() {
  try {
    return window.sessionStorage.getItem('sb_token') || CONFIG.SUPABASE_ANON_KEY;
  } catch (e) {
    return CONFIG.SUPABASE_ANON_KEY;
  }
}

function kirim(pesan) {
  if (!sock || sock.readyState !== 1) return false;
  try { sock.send(JSON.stringify(pesan)); return true; } catch (e) { return false; }
}

function gabungKanal(topik) {
  const k = kanal.get(topik);
  if (!k) return;
  k.joinRef = String(++ref);
  k.tersambung = false;
  tokenTerkirim = tokenSekarang();
  kirim({
    topic: topik,
    event: 'phx_join',
    payload: {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: '' },
        postgres_changes: [{ event: '*', schema: 'public', table: k.tabel }],
      },
      access_token: tokenTerkirim,
    },
    ref: k.joinRef,
    join_ref: k.joinRef,
  });
}

function detak() {
  // Token login diperbarui berkala (lihat js/supabase.js). Kalau yang dipegang
  // Realtime tetap yang lama, sambungannya akan diputus diam-diam begitu token
  // itu kedaluwarsa — dan halaman terlihat baik-baik saja sambil berhenti
  // menerima kabar.
  const t = tokenSekarang();
  if (t && t !== tokenTerkirim) {
    tokenTerkirim = t;
    kanal.forEach((k, topik) => {
      if (k.tersambung) kirim({ topic: topik, event: 'access_token', payload: { access_token: t }, ref: String(++ref) });
    });
  }
  kirim({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) });
}

function bersihkan() {
  if (detakTimer) { clearInterval(detakTimer); detakTimer = null; }
  if (sock) {
    try { sock.onopen = sock.onmessage = sock.onerror = sock.onclose = null; sock.close(); } catch (e) {}
    sock = null;
  }
  kanal.forEach(k => { k.tersambung = false; });
}

function jadwalkanSambungUlang() {
  if (sambungTimer || !kanal.size) return;
  const jeda = MUNDUR[Math.min(gagalBerturut, MUNDUR.length - 1)];
  gagalBerturut++;
  // Sesudah beberapa kali gagal, halaman perlu tahu supaya bisa berterus
  // terang bahwa ia kembali menyusul berkala — layar yang mengaku 'langsung'
  // padahal tidak akan membuat orang percaya pada sesuatu yang tidak ada.
  if (gagalBerturut >= 2) setStatus('gagal');
  sambungTimer = setTimeout(() => { sambungTimer = null; sambung(); }, jeda);
}

function sambung() {
  if (CONFIG.DEMO_MODE) return;
  if (!kanal.size) return;
  if (sock && (sock.readyState === 0 || sock.readyState === 1)) return;
  // Diambil dari window, bukan dipakai telanjang, supaya jelas dari mana ia
  // datang. Peramban yang tidak punya WebSocket sama sekali TIDAK diperiksa
  // terpisah di sini: `new undefined(...)` melempar, dan tangkapan di bawah
  // sudah memperlakukannya persis sama dengan sambungan yang ditolak. Penjaga
  // tersendiri untuk itu hanya akan jadi cabang yang tidak pernah mengubah
  // apa pun — dan cabang yang tidak bisa dibedakan akibatnya tidak bisa
  // dibuktikan benar.
  const WS = window.WebSocket;

  bersihkan();
  if (status !== 'gagal') setStatus('menyambung');

  const url = URL_WS + '?apikey=' + encodeURIComponent(CONFIG.SUPABASE_ANON_KEY) + '&vsn=1.0.0';
  try { sock = new WS(url); } catch (e) { setStatus('gagal'); jadwalkanSambungUlang(); return; }

  sock.onopen = () => {
    detakTimer = setInterval(detak, JEDA_DETAK);
    kanal.forEach((k, topik) => gabungKanal(topik));
  };

  sock.onmessage = (ev) => {
    let m = null;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || !m.topic) return;
    const k = kanal.get(m.topic);

    if (m.event === 'phx_reply') {
      if (!k) return;
      if (m.payload && m.payload.status === 'ok') {
        k.tersambung = true;
        gagalBerturut = 0;
        setStatus('hidup');
      } else {
        // Ditolak — hampir selalu karena tabelnya belum dimasukkan ke
        // publikasi Realtime. Menyambung ulang tidak akan menolong, jadi
        // jangan berputar; biarkan halaman kembali menyusul berkala.
        setStatus('gagal');
      }
      return;
    }

    if (m.event === 'postgres_changes') {
      // Isinya sengaja TIDAK dibaca. Ini cuma bel pintu: yang mengambil
      // datanya tetap jalur REST yang lewat RLS.
      if (k) k.pendengar.forEach(f => { try { f(); } catch (e) {} });
      return;
    }

    if (m.event === 'phx_close' || m.event === 'phx_error') {
      if (k) k.tersambung = false;
      jadwalkanSambungUlang();
    }
  };

  sock.onerror = () => { /* onclose menyusul; ditangani di sana */ };
  sock.onclose = () => { bersihkan(); jadwalkanSambungUlang(); };
}

// Mendengarkan perubahan satu tabel. Mengembalikan fungsi untuk berhenti.
//
// Beberapa halaman boleh mendengarkan tabel yang sama; kanalnya dipakai
// bersama, dan baru ditutup saat pendengar terakhir berhenti.
export function dengarTabel(tabel, fn) {
  if (CONFIG.DEMO_MODE || typeof fn !== 'function') return () => {};
  const topik = 'realtime:medconnect-' + tabel;
  let k = kanal.get(topik);
  if (!k) {
    k = { tabel, joinRef: '', tersambung: false, pendengar: new Set() };
    kanal.set(topik, k);
    if (sock && sock.readyState === 1) gabungKanal(topik); else sambung();
  }
  k.pendengar.add(fn);

  let sudahBerhenti = false;
  return () => {
    if (sudahBerhenti) return;
    sudahBerhenti = true;
    const kk = kanal.get(topik);
    if (!kk) return;
    kk.pendengar.delete(fn);
    if (kk.pendengar.size) return;
    if (kk.tersambung) kirim({ topic: topik, event: 'phx_leave', payload: {}, ref: String(++ref), join_ref: kk.joinRef });
    kanal.delete(topik);
    // Tidak ada lagi yang didengarkan: tutup soketnya. Sambungan yang
    // dibiarkan menganggur tetap memakan kuota lewat detaknya.
    if (!kanal.size) {
      if (sambungTimer) { clearTimeout(sambungTimer); sambungTimer = null; }
      gagalBerturut = 0;
      bersihkan();
      setStatus('mati');
    }
  };
}

export function dengarStatus(fn) {
  if (typeof fn !== 'function') return () => {};
  pemerhatiStatus.add(fn);
  try { fn(status); } catch (e) {}
  return () => pemerhatiStatus.delete(fn);
}

// Hanya untuk berkas uji: memperpendek detak supaya jalur pembaruan token
// bisa benar-benar dijalankan, bukan cuma dibaca. Tanpa ini pemeriksaannya
// harus menunggu 25 detik, dan pemeriksaan yang terlalu lama akan dilewati.
export function _setJedaDetak(ms) {
  JEDA_DETAK = Number(ms) || 25000;
  if (detakTimer) { clearInterval(detakTimer); detakTimer = setInterval(detak, JEDA_DETAK); }
}

// Hanya untuk berkas uji: mengembalikan keadaan dalamannya ke awal.
export function _resetRealtime() {
  if (sambungTimer) { clearTimeout(sambungTimer); sambungTimer = null; }
  bersihkan();
  kanal.clear();
  pemerhatiStatus.clear();
  gagalBerturut = 0; ref = 0; tokenTerkirim = '';
  JEDA_DETAK = 25000;
  status = 'mati';
}
