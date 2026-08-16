// ---------------------------------------------------------------------------
// STEMPEL FOTO VAKSIN UMROH
//
// Satu halaman, tiga isian, satu tombol. Dipakai sambil berdiri di sebelah
// kursi vaksinasi dengan antrean di belakang, jadi yang diutamakan sedikitnya
// ketukan — bukan banyaknya pilihan.
//
// Hasilnya TAMPIL DULU di layar, ukuran penuh, baru ada tombol unduh. Petugas
// yang menyerahkan foto ke travel harus sempat melihat apa yang ia serahkan;
// tombol unduh yang langsung menyimpan tanpa ditampilkan membuat kesalahan
// ketik nama baru ketahuan setelah fotonya terkirim.
//
// Penggabungannya dikerjakan di peramban. Foto jemaah tidak dikirim ke server
// mana pun — kecuali koordinat, yang dikirim ke layanan pencari alamat, dan
// itu disebutkan di layar.
// ---------------------------------------------------------------------------
import { store } from '../store.js';
import {
  gambarStempel, susunBaris, rakitWaktu, barisWaktu,
  ambilPeta, posisiSekarang, alamatDari, bacaExif, muatGambar,
} from '../stempel.js';

const LAYANAN = [
  'Vaksinasi Meningitis - Umroh & Haji',
  'Vaksinasi Meningitis + Influenza',
  'Vaksinasi Polio - Umroh & Haji',
  'Vaksinasi Influenza',
];

export function stempelSetup() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const dok = (store.getDoctors() || [])[0] || {};
  const klinik = store.umrohStampKlinik(dok.id || '');
  window.__stempelKlinik = klinik;
  window.__stempelLayanan = LAYANAN;
  window.__stempelBoleh = store.canUmrohStamp(user) === true;

  // x-data tidak bisa meng-import modul sendiri, jadi seluruh kerjanya
  // dijembatani lewat window — sama seperti pembaca berkas di halaman Umroh.
  window.__stempelKerja = {
    async render(canvas, foto, isi) {
      let peta = null;
      if (Number.isFinite(isi.lat) && Number.isFinite(isi.lon)) peta = await ambilPeta(isi.lat, isi.lon);
      let logo = null;
      if (klinik.logo) { try { logo = await muatGambar(klinik.logo, true); } catch (e) { logo = null; } }
      gambarStempel(canvas, foto, susunBaris({ ...isi, namaKlinik: klinik.namaPendek }), peta, logo);
      return { adaPeta: !!peta };
    },
    rakitWaktu, barisWaktu, posisiSekarang, alamatDari, bacaExif, muatGambar,
    alamatKlinik: klinik.alamat, namaKlinik: klinik.nama,
  };
  return true;
}

export function stempelXData() {
  const hariIni = new Date().toLocaleDateString('en-CA');
  const jamIni = new Date().toTimeString().slice(0, 5);
  return `boleh: window.__stempelBoleh === true,
    klinik: window.__stempelKlinik || {},
    layananPilihan: window.__stempelLayanan || [],
    namaJemaah: '', layanan: (window.__stempelLayanan || [''])[0],
    tanggal: '${hariIni}', jam: '${jamIni}',
    lat: null, lon: null, alamat: [], akurasi: null,
    asal: '', adaFoto: false, adaPeta: false,
    kameraNyala: false, sibuk: false, pesan: '', galat: '',
    unduhUrl: '', namaBerkas: 'stempel.jpg',
    _aliran: null, _foto: null,

    get bolehBuat() { return this.adaFoto && this.namaJemaah.trim().length > 0; },
    get labelAsal() {
      if (this.asal === 'kamera') return 'Waktu dan lokasi diukur saat jepretan';
      if (this.asal === 'exif') return 'Waktu dan lokasi diambil dari data foto';
      if (this.asal === 'manual') return 'Waktu diisi petugas — ditulis apa adanya di stempel';
      return '';
    },
    get warnaAsal() {
      if (this.asal === 'manual') return 'bg-amber-50 text-amber-800 border-amber-200';
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    },

    async mulaiKamera() {
      this.galat = '';
      try {
        this._aliran = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
        this.kameraNyala = true;
        this.$nextTick(() => { const v = this.$refs.video; if (v) { v.srcObject = this._aliran; v.play(); } });
      } catch (e) {
        this.galat = 'Kamera tidak bisa dibuka. Pastikan izin kamera diberikan, lalu coba lagi. Atau pakai tombol Pilih Foto.';
      }
    },
    tutupKamera() {
      if (this._aliran) { this._aliran.getTracks().forEach(t => t.stop()); this._aliran = null; }
      this.kameraNyala = false;
    },

    async jepret() {
      const v = this.$refs.video;
      if (!v || !v.videoWidth) { this.galat = 'Kameranya belum siap.'; return; }
      this.sibuk = true; this.pesan = 'Mengambil lokasi...'; this.galat = '';
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      this._foto = await window.__stempelKerja.muatGambar(c.toDataURL('image/jpeg', 0.95));
      this.adaFoto = true;
      this.tutupKamera();

      const saat = new Date();
      this.tanggal = saat.toLocaleDateString('en-CA');
      this.jam = saat.toTimeString().slice(0, 5);
      const pos = await window.__stempelKerja.posisiSekarang(12000);
      if (pos) {
        this.lat = pos.lat; this.lon = pos.lon; this.akurasi = Math.round(pos.akurasi || 0);
        this.pesan = 'Mencari alamat...';
        this.alamat = await window.__stempelKerja.alamatDari(pos.lat, pos.lon);
        this.asal = 'kamera';
      } else {
        this.lat = null; this.lon = null; this.akurasi = null;
        this.alamat = window.__stempelKerja.alamatKlinik ? [window.__stempelKerja.alamatKlinik] : [];
        this.asal = 'kamera';
        this.galat = 'GPS tidak bisa dibaca. Fotonya tetap distempel, tapi tanpa koordinat dan peta.';
      }
      this.sibuk = false; this.pesan = '';
      await this.buat();
    },

    async pilihFoto(ev) {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      this.sibuk = true; this.pesan = 'Membaca foto...'; this.galat = '';
      this._foto = await window.__stempelKerja.muatGambar(URL.createObjectURL(f));
      this.adaFoto = true;
      const ex = await window.__stempelKerja.bacaExif(f);
      if (ex && ex.waktu) {
        this.tanggal = ex.waktu.toLocaleDateString('en-CA');
        this.jam = ex.waktu.toTimeString().slice(0, 5);
        this.asal = 'exif';
      } else {
        this.asal = 'manual';
      }
      if (ex && Number.isFinite(ex.lat) && Number.isFinite(ex.lon)) {
        this.lat = ex.lat; this.lon = ex.lon;
        this.pesan = 'Mencari alamat...';
        this.alamat = await window.__stempelKerja.alamatDari(ex.lat, ex.lon);
      } else {
        this.lat = null; this.lon = null;
        this.alamat = window.__stempelKerja.alamatKlinik ? [window.__stempelKerja.alamatKlinik] : [];
      }
      this.sibuk = false; this.pesan = '';
      await this.buat();
    },

    async buat() {
      if (!this.bolehBuat) return;
      this.sibuk = true; this.pesan = 'Menyusun stempel...'; this.galat = '';
      try {
        const waktu = window.__stempelKerja.rakitWaktu(this.tanggal, this.jam);
        const hasil = await window.__stempelKerja.render(this.$refs.kanvas, this._foto, {
          namaJemaah: this.namaJemaah, layanan: this.layanan,
          alamat: this.alamat, lat: this.lat, lon: this.lon,
          waktu, asal: this.asal,
        });
        this.adaPeta = hasil.adaPeta;
        const nama = this.namaJemaah.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
        this.namaBerkas = (nama || 'stempel') + '-' + this.tanggal + '.jpg';
        if (this.unduhUrl) URL.revokeObjectURL(this.unduhUrl);
        this.unduhUrl = await new Promise(r =>
          this.$refs.kanvas.toBlob(b => r(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.92));
        if (!this.unduhUrl) this.galat = 'Gambarnya jadi, tapi tidak bisa disiapkan untuk diunduh.';
      } catch (e) {
        this.galat = 'Gagal menyusun stempel: ' + (e && e.message ? e.message : e);
      }
      this.sibuk = false; this.pesan = '';
    },

    ulangi() {
      if (this.unduhUrl) URL.revokeObjectURL(this.unduhUrl);
      this.unduhUrl = ''; this.adaFoto = false; this._foto = null;
      this.asal = ''; this.lat = null; this.lon = null; this.alamat = []; this.galat = '';
    }`;
}

export function stempelBody() {
  return `
  <template x-if="!boleh">
    <div class="bg-white rounded-2xl border border-slate-100 p-8 text-center">
      <p class="text-sm font-semibold text-ink">Fitur Vaksin Umroh belum dinyalakan untuk akun ini.</p>
      <p class="text-[12.5px] text-muted mt-1">Pemilik klinik bisa menyalakannya dari Manajemen User.</p>
    </div>
  </template>

  <template x-if="boleh">
    <div class="grid lg:grid-cols-2 gap-4">

      <div class="space-y-3">
        <div class="bg-white rounded-2xl border border-slate-100 p-4">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Nama Jemaah *</label>
          <input type="text" x-model="namaJemaah" @input="unduhUrl && buat()" placeholder="Nama sesuai paspor"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">

          <label class="block text-xs font-semibold text-gray-600 mt-3 mb-1">Layanan</label>
          <select x-model="layanan" @change="unduhUrl && buat()"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40">
            <template x-for="l in layananPilihan" :key="l"><option :value="l" x-text="l"></option></template>
          </select>
        </div>

        <div class="bg-white rounded-2xl border border-slate-100 p-4">
          <p class="text-xs font-semibold text-gray-600 mb-2">Foto</p>
          <div class="flex gap-2">
            <button @click="mulaiKamera()" x-show="!kameraNyala" class="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:brightness-95 transition">Buka Kamera</button>
            <button @click="tutupKamera()" x-show="kameraNyala" x-cloak class="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100">Tutup Kamera</button>
            <label class="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-brand-dark bg-brand/10 hover:bg-brand/20 transition text-center cursor-pointer">
              Pilih Foto
              <input type="file" accept="image/*" class="hidden" @change="pilihFoto($event)">
            </label>
          </div>

          <div x-show="kameraNyala" x-cloak class="mt-3">
            <video x-ref="video" playsinline muted class="w-full rounded-xl bg-black aspect-[3/4] object-cover"></video>
            <button @click="jepret()" class="mt-2 w-full px-3 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:brightness-95 transition">Jepret</button>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-100 p-4">
          <p class="text-xs font-semibold text-gray-600 mb-2">Tanggal &amp; Jam</p>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" x-model="tanggal" @change="unduhUrl && buat()" class="px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
            <input type="time" x-model="jam" @change="unduhUrl && buat()" class="px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
          </div>
          <div x-show="asal" x-cloak class="mt-2 px-3 py-2 rounded-xl border text-[11.5px] leading-relaxed" :class="warnaAsal" x-text="labelAsal"></div>
          <p x-show="akurasi" x-cloak class="mt-1.5 text-[11px] text-gray-400" x-text="'Ketelitian GPS sekitar ' + akurasi + ' meter'"></p>
          <p x-show="asal && !adaPeta && unduhUrl" x-cloak class="mt-1.5 text-[11px] text-amber-700">Peta tidak bisa diambil — kotaknya diisi logo klinik, bukan peta tempat lain.</p>
        </div>

        <button @click="buat()" :disabled="!bolehBuat || sibuk"
          class="w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-brand disabled:opacity-40 disabled:cursor-not-allowed">
          <span x-show="!sibuk">Buat Stempel</span>
          <span x-show="sibuk" x-cloak x-text="pesan || 'Memproses...'"></span>
        </button>
        <p x-show="galat" x-cloak class="px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-[11.5px] text-red-700" x-text="galat"></p>
      </div>

      <div class="space-y-3">
        <div class="bg-white rounded-2xl border border-slate-100 p-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-gray-600">Hasil</p>
            <button x-show="adaFoto" x-cloak @click="ulangi()" class="text-[11.5px] text-slate-500 hover:text-slate-700">Ulangi</button>
          </div>
          <canvas x-ref="kanvas" class="w-full rounded-xl border border-slate-100" :class="unduhUrl ? '' : 'hidden'"></canvas>
          <div x-show="!unduhUrl" x-cloak class="aspect-[3/4] rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
            <p class="text-[12px] text-slate-400 text-center px-6">Isi nama jemaah, ambil fotonya, lalu tekan Buat Stempel.</p>
          </div>
          <a x-show="unduhUrl" x-cloak :href="unduhUrl" :download="namaBerkas"
            class="mt-3 block w-full px-4 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:brightness-95 transition text-center">Unduh Foto</a>
        </div>

        <div class="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
          <p class="text-[11.5px] text-gray-600 leading-relaxed">Foto jemaah <b>tidak dikirim ke server mana pun</b> &mdash; penggabungannya dikerjakan di perangkat ini. Yang dikirim keluar hanya koordinat, ke layanan pencari alamat dan peta OpenStreetMap.</p>
        </div>
      </div>

    </div>
  </template>`;
}
