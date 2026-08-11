// ---------------------------------------------------------------------------
// UMROH & HAJI — laporan jemaah + cashback travel.
//
// Datanya TIDAK diketik ulang. Berkas "Laporan Detail Data Penjualan Obat" dari
// sistem kasir apotek diunggah di sini, lalu dibaca oleh js/umroh-import.js.
// Berkas itu sudah memuat tanggal, nama pasien, nama dokter, kolom Sales
// (= travel pengirimnya), rincian vaksin, dan total yang dibayar — jadi angka
// yang dipakai menagih cashback adalah angka yang sama dengan yang tercatat di
// kasir, bukan angka kedua yang harus dicocokkan tiap bulan.
//
// Yang diisi tangan hanya NOMINAL CASHBACK-nya (kasir tidak tahu soal itu) dan
// tanda sudah/belum dibayarnya.
// ---------------------------------------------------------------------------
import { store } from '../store.js';
import { fileToMatrix, parseUmrohSheet } from '../umroh-import.js';

const SERVICES = [
  { key: 'meningitis', label: 'Meningitis', chip: 'bg-teal-50 text-teal-700' },
  { key: 'polio', label: 'Polio', chip: 'bg-sky-50 text-sky-700' },
  { key: 'combo', label: 'Combo', chip: 'bg-violet-50 text-violet-700' },
];

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function monthStart() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
}

export function umrohSetup() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  window.__umrohCanCash = store.canMarkCashback(user) === true;
  window.__umrohMe = (user && user.id) || '';
  window.__umrohToday = todayStr();
  window.__umrohMonthStart = monthStart();
  window.__umrohServices = SERVICES;
  // Pembacaan berkas dijembatani lewat window karena x-data tidak bisa
  // meng-import modul sendiri.
  window.__umrohReadFile = async (file) => parseUmrohSheet(await fileToMatrix(file));
  return true;
}

export function umrohXData() {
  return `loading: true,
    rows: [], services: window.__umrohServices || [],
    canCash: window.__umrohCanCash === true, me: window.__umrohMe || '',
    from: window.__umrohMonthStart, to: window.__umrohToday,
    q: '', fDoctor: '', fService: '', fCashback: '', fTravel: '',
    editKey: '', draftCash: 0, saving: false,
    travelKey: '', draftTravel: '',
    impOpen: false, impBusy: false, impName: '', impErr: '', impPreview: null, impStats: null,
    rateOpen: false, rateTravel: '', rateAmount: 0, rateBusy: false,
    waOpen: false, waTravel: '', waPhone: '', waUnpaidOnly: true, waText: '', waMarking: false,

    async load() {
      this.loading = true;
      try { await window.__store.loadUmrohSales(); } catch (e) {}
      this.refresh();
      // Rentang bawaan mengikuti DATANYA, bukan bulan berjalan. Laporan kasir
      // hampir selalu diunggah untuk periode yang sudah lewat; kalau bawaannya
      // bulan ini, travel yang hanya beroperasi bulan sebelumnya lenyap dari
      // daftar dan terlihat seperti datanya tidak terbaca.
      const r = window.__store.umrohDateRange();
      if (r.min && r.max) { this.from = r.min; this.to = r.max; }
      this.loading = false;
    },
    refresh() { this.rows = window.__store.getUmrohEntries({}); },

    // ---- Rentang tanggal ----
    // Pintasan dihitung dari tanggal hari ini, bukan disimpan sebagai pilihan
    // — supaya Bulan Ini tetap berarti bulan ini juga besok pagi.
    setRange(kind) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const fmt = (x) => x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
      if (kind === 'month') { this.from = fmt(new Date(d.getFullYear(), d.getMonth(), 1)); this.to = fmt(d); }
      else if (kind === 'last') { this.from = fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1)); this.to = fmt(new Date(d.getFullYear(), d.getMonth(), 0)); }
      else if (kind === 'days30') { const s = new Date(d); s.setDate(s.getDate() - 29); this.from = fmt(s); this.to = fmt(d); }
      else if (kind === 'year') { this.from = d.getFullYear() + '-01-01'; this.to = fmt(d); }
      else { this.from = ''; this.to = ''; }
    },
    get rangeInvalid() { return !!(this.from && this.to && this.from > this.to); },

    // ---- Penyaringan ----
    get inRange() {
      if (this.rangeInvalid) return [];
      return this.rows.filter(r => (!this.from || r.date >= this.from) && (!this.to || r.date <= this.to));
    },
    get shown() {
      const q = (this.q || '').toLowerCase();
      return this.inRange.filter(r => {
        if (this.fDoctor && r.doctor_name !== this.fDoctor) return false;
        if (this.fService && r.service !== this.fService) return false;
        if (this.fCashback === 'paid' && !r.paid) return false;
        if (this.fCashback === 'unpaid' && r.paid) return false;
        // __none menjaring yang travelnya kosong di berkas kasir — itu justru
        // daftar kerja yang perlu ditelusuri, bukan sampah data.
        if (this.fTravel === '__none' && r.travel) return false;
        if (this.fTravel && this.fTravel !== '__none' && r.travel !== this.fTravel) return false;
        if (q && !((r.patient_name || '') + ' ' + (r.travel || '') + ' ' + (r.doctor_name || '') + ' ' + (r.invoice_no || '')).toLowerCase().includes(q)) return false;
        return true;
      });
    },
    get summary() { return window.__store.umrohSummary(this.shown); },
    get travels() { return window.__store.umrohTravels(this.inRange); },
    get doctors() { return window.__store.umrohDoctors(this.inRange); },
    // Berapa yang tersembunyi hanya gara-gara rentang tanggalnya.
    get outsideCount() { return this.rows.length - this.inRange.length; },
    showAllDates() { const r = window.__store.umrohDateRange(); this.from = r.min || ''; this.to = r.max || ''; },
    get anyFilter() { return !!(this.q || this.fDoctor || this.fService || this.fCashback || this.fTravel); },
    clearFilters() { this.q = ''; this.fDoctor = ''; this.fService = ''; this.fCashback = ''; this.fTravel = ''; },

    // ---- Tampilan ----
    rupiah(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); },
    fmtDate(d) {
      if (!d) return '-';
      const dt = new Date(d + 'T00:00:00');
      return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fmtWhen(iso) {
      if (!iso) return '';
      const dt = new Date(iso);
      return isNaN(dt) ? '' : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    serviceChip(key) { const f = this.services.find(s => s.key === key); return f ? f.chip : 'bg-slate-100 text-slate-600'; },

    // ---- Unggah berkas dari kasir ----
    openImport() { this.impOpen = true; this.impErr = ''; this.impPreview = null; this.impStats = null; this.impName = ''; },
    async onFile(ev) {
      const file = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!file) return;
      this.impBusy = true; this.impErr = ''; this.impPreview = null; this.impStats = null;
      this.impName = file.name;
      try {
        const hasil = await window.__umrohReadFile(file);
        this.impStats = hasil.stats;
        this.impPreview = hasil.entries;
        if (!hasil.entries.length) this.impErr = 'Tidak ada transaksi vaksin umroh yang terbaca di berkas ini. Pastikan yang diunggah adalah Laporan Detail Data Penjualan Obat.';
      } catch (e) {
        this.impErr = (e && e.message) || 'Berkasnya tidak bisa dibaca.';
      }
      this.impBusy = false;
      // Dikosongkan supaya berkas yang sama bisa dipilih lagi setelah diperbaiki.
      if (ev && ev.target) ev.target.value = '';
    },
    async applyImport() {
      if (this.impBusy || !this.impPreview || !this.impPreview.length) return;
      this.impBusy = true;
      const res = await window.__store.importUmrohSales(this.impPreview, { source_file: this.impName, imported_by: this.me });
      this.impBusy = false;
      if (res && res.error) { this.impErr = res.error; return; }
      this.impOpen = false; this.impPreview = null;
      this.refresh();
      window.__showToast && window.__showToast('Berkas terbaca',
        res.baru + ' jemaah baru, ' + res.diperbarui + ' diperbarui, ' + res.sama + ' sudah sama.');
    },

    // ---- Isi travel secara manual ----
    // Kolom Sales di kasir kadang terlewat diisi. Isian di sini bertahan saat
    // berkas yang sama diunggah lagi — lihat store.setUmrohTravel.
    startTravel(r) { this.travelKey = r.key; this.draftTravel = r.travel || ''; },
    cancelTravel() { this.travelKey = ''; },
    saveTravel(r) {
      const res = window.__store.setUmrohTravel(r.id, this.draftTravel);
      if (res && res.error) { window.__showToast && window.__showToast('Gagal', res.error); return; }
      this.travelKey = ''; this.refresh();
      window.__showToast && window.__showToast(
        res.travel ? 'Travel diisi' : 'Kembali ke data kasir',
        res.travel ? (r.patient_name + ' \u2192 ' + res.travel) : (r.patient_name + ' mengikuti berkas kasir lagi.'));
    },
    // Satu travel biasanya mengirim serombongan jemaah sekaligus, jadi yang
    // kosong pada tampilan sekarang bisa diisi sekali jalan.
    get blankRows() { return this.shown.filter(r => !r.travel); },
    fillBlanks() {
      const rows = this.blankRows;
      if (!rows.length) return;
      const nama = window.prompt('Isi travel untuk ' + rows.length + ' jemaah yang travelnya masih kosong pada tampilan ini:', '');
      if (nama === null) return;
      const res = window.__store.setUmrohTravelBulk(rows.map(r => r.id), nama);
      if (res && res.error) { window.__showToast && window.__showToast('Gagal', res.error); return; }
      this.refresh();
      window.__showToast && window.__showToast('Terisi', res.count + ' jemaah disetel ke ' + nama.trim() + '.');
    },

    // ---- Nominal cashback ----
    startEdit(r) { this.editKey = r.key; this.draftCash = r.cashback || 0; },
    cancelEdit() { this.editKey = ''; },
    saveEdit(r) {
      const res = window.__store.setUmrohCashbackAmount(r.id, this.draftCash);
      if (res && res.error) { window.__showToast && window.__showToast('Gagal', res.error); return; }
      this.editKey = ''; this.refresh();
    },
    openRate(travel) {
      this.rateTravel = travel || (this.fTravel && this.fTravel !== '__none' ? this.fTravel : (this.travels[0] || ''));
      this.rateAmount = 0;
      this.rateOpen = true;
    },
    get rateCount() {
      if (!this.rateTravel) return 0;
      return this.inRange.filter(r => r.travel === this.rateTravel && !r.paid).length;
    },
    applyRate() {
      if (!this.rateTravel || this.rateBusy) return;
      this.rateBusy = true;
      const res = window.__store.applyUmrohTravelRate(this.rateTravel, this.rateAmount, { from: this.from, to: this.to });
      this.rateBusy = false;
      this.rateOpen = false;
      this.refresh();
      window.__showToast && window.__showToast('Tarif diterapkan',
        res.count + ' jemaah ' + this.rateTravel + ' disetel ' + this.rupiah(this.rateAmount) + '.');
    },

    // ---- Tanda sudah / belum dibayar ----
    toggleCash(r) {
      if (!this.canCash) return;
      const res = window.__store.setUmrohCashbackPaid([r.id], !r.paid, this.me);
      if (res && res.error) { window.__showToast && window.__showToast('Gagal', res.error); return; }
      this.refresh();
    },

    // ---- Kirim rincian ke travel lewat WhatsApp ----
    openWa(travel) {
      this.waTravel = travel || (this.fTravel && this.fTravel !== '__none' ? this.fTravel : (this.travels[0] || ''));
      this.waPhone = '';
      this.waUnpaidOnly = true;
      this.waOpen = true;
      this.syncWaText();
    },
    get waRows() {
      if (!this.waTravel) return [];
      return this.inRange.filter(r => r.travel === this.waTravel && (!this.waUnpaidOnly || !r.paid));
    },
    get waTotal() { return this.waRows.reduce((s, r) => s + (Number(r.cashback) || 0), 0); },
    // Teksnya dirakit di store, lalu disalin ke kotak yang bisa disunting —
    // jadi kalimatnya masih bisa diubah sebelum dikirim.
    syncWaText() { this.waText = window.__store.buildUmrohCashbackText(this.waTravel, this.waRows, this.from, this.to); },
    get waHref() {
      const p = (this.waPhone || '').replace(/[^0-9]/g, '');
      if (!p) return '';
      return window.__waHref(p, this.waText || '');
    },
    markWaPaid() {
      if (!this.canCash || this.waMarking) return;
      const rows = this.waRows.slice();
      if (!rows.length) return;
      if (!confirm('Tandai cashback ' + rows.length + ' jemaah dari ' + this.waTravel + ' sebagai SUDAH dibayar?')) return;
      this.waMarking = true;
      const res = window.__store.setUmrohCashbackPaid(rows.map(r => r.id), true, this.me);
      this.waMarking = false;
      this.refresh(); this.syncWaText();
      window.__showToast && window.__showToast('Ditandai sudah', (res.count || 0) + ' jemaah ditandai sudah menerima cashback.');
    }`;
}

function statCard(icon, bg, valueExpr, label, sub) {
  return `<div class="bg-white rounded-2xl p-4 border border-slate-100">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background:${bg}"><span class="ms text-[21px] text-white">${icon}</span></div>
      <div class="min-w-0">
        <p class="text-xl font-bold text-ink truncate" x-text="${valueExpr}"></p>
        <p class="text-[11px] text-faint">${label}</p>
        ${sub ? `<p class="text-[10.5px] text-slate-400 mt-0.5" x-text="${sub}"></p>` : ''}
      </div>
    </div>
  </div>`;
}

export function umrohBody() {
  const svcOptions = SERVICES.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
  return `
  <div class="flex items-center justify-between gap-2 flex-wrap mb-4">
    <div>
      <h2 class="text-xl font-bold text-gray-800">Umroh &amp; Haji</h2>
      <p class="text-sm text-gray-500 mt-0.5">Jemaah yang divaksinasi di klinik, travel yang mengirimnya, dan cashback-nya.</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <button @click="openImport()" class="px-3 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">
        <span class="ms text-[17px]">upload_file</span>Unggah Data Penjualan
      </button>
      <button @click="openRate('')" :disabled="!travels.length" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-40">Tarif Cashback</button>
      <button @click="openWa('')" :disabled="!travels.length" class="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 flex items-center gap-1.5" style="background:#25D366">
        <span class="ms text-[17px]">forward_to_inbox</span>Kirim Rincian
      </button>
    </div>
  </div>

  <!-- Rentang tanggal -->
  <div class="bg-white border border-slate-100 rounded-2xl p-4 mb-4">
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Tanggal Awal</label>
        <input type="date" x-model="from" class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-500 mb-1">Tanggal Akhir</label>
        <input type="date" x-model="to" class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <button @click="setRange('month')" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Bulan Ini</button>
        <button @click="setRange('last')" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Bulan Lalu</button>
        <button @click="setRange('days30')" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">30 Hari</button>
        <button @click="setRange('year')" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Tahun Ini</button>
        <button @click="setRange('all')" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Semua</button>
      </div>
    </div>
    <p x-show="rangeInvalid" x-cloak class="text-xs text-red-600 mt-2">Tanggal awal melewati tanggal akhir &mdash; tidak ada data yang bisa ditampilkan.</p>
    <!-- Peringatan ini yang mencegah data terbaca "hilang" padahal hanya
         tersembunyi rentang tanggalnya. -->
    <p x-show="!loading && outsideCount > 0" x-cloak class="text-xs text-amber-700 mt-2">
      <b><span x-text="outsideCount"></span> jemaah</b> tidak ditampilkan karena berada di luar rentang tanggal ini.
      <button @click="showAllDates()" class="ml-1 font-semibold text-brand-dark underline">Tampilkan semua tanggal</button>
    </p>
  </div>

  <!-- Ringkasan -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
    ${statCard('groups', 'linear-gradient(135deg,#7c3aed,#5b21b6)', 'summary.jamaah', 'Jemaah Divaksinasi', "summary.travels + ' travel'")}
    ${statCard('vaccines', '#0d9488', 'summary.combo + summary.meningitis', 'Dapat Meningitis', "summary.combo + ' combo, ' + summary.polio + ' polio saja'")}
    ${statCard('payments', '#e0a112', 'rupiah(summary.revenue)', 'Nilai Penjualan', "summary.jamaah + ' faktur'")}
    ${statCard('redeem', '#dc2626', 'rupiah(summary.cashbackDue)', 'Cashback Belum Dibayar', "rupiah(summary.cashbackPaid) + ' sudah dibayar'")}
  </div>

  <!-- Penyaring -->
  <div class="flex gap-2 flex-wrap items-center mb-4">
    <input type="text" x-model="q" placeholder="Cari nama jemaah / travel / no. faktur..." class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 flex-1 min-w-[200px]">
    <select x-model="fDoctor" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Semua dokter</option>
      <template x-for="d in doctors" :key="d"><option :value="d" x-text="d"></option></template>
    </select>
    <select x-model="fService" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Semua layanan</option>
      ${svcOptions}
    </select>
    <select x-model="fCashback" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Cashback: semua</option>
      <option value="paid">Sudah dibayar</option>
      <option value="unpaid">Belum dibayar</option>
    </select>
    <select x-model="fTravel" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
      <option value="">Semua travel</option>
      <option value="__none">Tanpa travel</option>
      <template x-for="t in travels" :key="t"><option :value="t" x-text="t"></option></template>
    </select>
    <button x-show="anyFilter" x-cloak @click="clearFilters()" class="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 transition">Bersihkan</button>
  </div>

  <div x-show="!loading && summary.noTravel" x-cloak class="mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 flex items-start justify-between gap-3 flex-wrap">
    <p class="text-xs text-amber-800 leading-relaxed flex-1 min-w-[240px]"><b><span x-text="summary.noTravel"></span> jemaah</b> kolom Sales-nya kosong di berkas kasir, jadi belum bisa masuk rincian cashback travel mana pun. Klik <b>Isi travel</b> pada barisnya untuk mengisi sendiri &mdash; isian itu <b>tidak akan hilang</b> walau berkasnya diunggah ulang.</p>
    <button @click="fillBlanks()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 transition whitespace-nowrap">Isi semua yang kosong</button>
  </div>

  <div x-show="loading" class="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-gray-400">Memuat data jemaah...</div>

  <!-- Tabel jemaah -->
  <div x-show="!loading" x-cloak class="bg-white border border-slate-100 rounded-2xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm min-w-[900px]">
        <thead class="bg-slate-50 border-b border-slate-100">
          <tr class="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th class="px-3 py-2.5 font-bold">Tanggal</th>
            <th class="px-3 py-2.5 font-bold">Nama Pasien</th>
            <th class="px-3 py-2.5 font-bold">Nama Dokter</th>
            <th class="px-3 py-2.5 font-bold">Sales (Travel)</th>
            <th class="px-3 py-2.5 font-bold">Layanan</th>
            <th class="px-3 py-2.5 font-bold text-right">Harga</th>
            <th class="px-3 py-2.5 font-bold">Cashback</th>
            <th class="px-3 py-2.5 font-bold"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <template x-for="r in shown" :key="r.key">
            <tr class="hover:bg-slate-50/60 align-top">
              <td class="px-3 py-2.5 whitespace-nowrap text-gray-600">
                <span x-text="fmtDate(r.date)"></span>
                <span class="block text-[10px] text-slate-400" x-text="r.time"></span>
              </td>
              <td class="px-3 py-2.5">
                <p class="font-semibold text-gray-800" x-text="r.patient_name"></p>
                <p class="text-[10px] text-slate-400" x-text="r.invoice_no"></p>
                <span x-show="r.other_items.length" x-cloak class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700"
                  :title="'Faktur ini juga memuat: ' + r.other_items.join(', ')">
                  <span class="ms text-[11px]">info</span>Ada barang lain
                </span>
              </td>
              <td class="px-3 py-2.5 text-gray-600" x-text="r.doctor_name"></td>
              <td class="px-3 py-2.5">
                <template x-if="travelKey === r.key">
                  <span class="inline-flex items-center gap-1.5">
                    <input type="text" x-model="draftTravel" list="umroh-travel-list" placeholder="Nama travel"
                      @keydown.enter="saveTravel(r)" @keydown.escape="cancelTravel()"
                      class="w-36 px-2 py-1 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                    <button @click="saveTravel(r)" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-green-600 hover:bg-green-500 transition">OK</button>
                    <button @click="cancelTravel()" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Batal</button>
                  </span>
                </template>
                <template x-if="travelKey !== r.key">
                  <button @click="startTravel(r)" class="text-left group"
                    :title="r.travel ? 'Klik untuk mengubah travel' : 'Klik untuk mengisi travel'">
                    <span x-show="r.travel" x-text="r.travel" class="text-gray-700 font-medium group-hover:text-brand-dark group-hover:underline"></span>
                    <span x-show="!r.travel" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 group-hover:bg-amber-100">
                      <span class="ms text-[12px]">edit</span>Isi travel
                    </span>
                    <span x-show="r.travel_manual" x-cloak class="block text-[10px] text-purple-500" title="Diisi manual, bertahan walau berkasnya diunggah ulang">diisi manual</span>
                  </button>
                </template>
              </td>
              <td class="px-3 py-2.5">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" :class="serviceChip(r.service)" x-text="r.service_label"></span>
              </td>
              <td class="px-3 py-2.5 text-right whitespace-nowrap font-semibold text-gray-800" x-text="rupiah(r.price)"></td>

              <td class="px-3 py-2.5 whitespace-nowrap">
                <template x-if="editKey === r.key">
                  <span class="inline-flex items-center gap-1.5">
                    <input type="number" min="0" step="1000" x-model="draftCash"
                      class="w-28 px-2 py-1 border border-gray-200 rounded-lg text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                    <button @click="saveEdit(r)" class="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-green-600 hover:bg-green-500 transition">OK</button>
                    <button @click="cancelEdit()" class="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Batal</button>
                  </span>
                </template>
                <template x-if="editKey !== r.key">
                  <span class="inline-flex items-center gap-2">
                    <button @click="toggleCash(r)" :disabled="!canCash"
                      :title="canCash ? (r.paid ? 'Batalkan tanda sudah' : 'Tandai sudah dibayar') : 'Hanya dr. Kevin yang menandai cashback'"
                      class="px-2 py-1 rounded-lg text-[11px] font-bold transition disabled:cursor-not-allowed"
                      :class="r.paid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'"
                      x-text="r.paid ? 'Sudah' : 'Belum'"></button>
                    <span x-show="r.cashback" class="text-[11px] text-gray-500" x-text="rupiah(r.cashback)"></span>
                    <span x-show="!r.cashback" class="text-[11px] text-slate-300">nominal kosong</span>
                  </span>
                </template>
                <p x-show="editKey !== r.key && r.paid && r.paid_at" x-cloak class="text-[10px] text-green-600 mt-0.5" x-text="'Dibayar ' + fmtWhen(r.paid_at)"></p>
              </td>

              <td class="px-3 py-2.5 whitespace-nowrap text-right">
                <button x-show="editKey !== r.key" @click="startEdit(r)" class="px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Nominal</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div x-show="!shown.length" x-cloak class="p-10 text-center">
      <span class="ms text-[36px] text-slate-300">travel_explore</span>
      <p class="text-sm text-gray-600 font-medium mt-2" x-text="rows.length ? 'Tidak ada jemaah pada rentang atau saringan ini.' : 'Belum ada data jemaah.'"></p>
      <p class="text-xs text-gray-400 mt-1" x-text="rows.length ? 'Coba lebarkan rentang tanggalnya atau bersihkan saringan.' : 'Tekan Unggah Data Penjualan, lalu pilih berkas Laporan Detail Data Penjualan Obat dari sistem kasir.'"></p>
    </div>
  </div>

  <div class="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
    <p class="text-xs text-blue-800 leading-relaxed"><b>Dari mana datanya:</b> seluruh isi tabel ini dibaca dari berkas <b>Laporan Detail Data Penjualan Obat</b> yang diunggah &mdash; tanggal, nama jemaah, dokter, kolom <b>Sales</b> (travel), jenis vaksin, dan total yang dibayar. Tidak ada yang perlu diketik ulang, dan angkanya selalu sama dengan yang tercatat di kasir.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-1.5">Kolom <b>Sales (Travel)</b> bisa diklik dan diisi sendiri bila di kasir terlewat. Isian manual ditandai <i>diisi manual</i> dan <b>bertahan</b> saat berkasnya diunggah ulang &mdash; nilai asli dari kasir tetap disimpan, jadi mengosongkan isian manual akan mengembalikannya mengikuti kasir lagi.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-1.5">Selain itu yang diisi di sini hanya <b>nominal cashback</b> (kasir tidak mencatat itu) dan tandanya sudah / belum dibayar. Mengunggah ulang periode yang sama <b>tidak</b> menggandakan data &mdash; barisnya dikenali dari nomor faktur, dan tanda cashback yang sudah Anda beri <b>tidak</b> ikut tertimpa.</p>
    <p class="text-xs text-blue-800 leading-relaxed mt-1.5">Tanda <b>Sudah / Belum</b> hanya bisa diubah oleh dr. Kevin Chikrista. Super Admin lain tetap bisa melihat laporannya dan mengisi nominalnya.</p>
  </div>

  <!-- Unggah berkas -->
  <div x-show="impOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="impOpen=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-1">Unggah Data Penjualan</h3>
      <p class="text-xs text-gray-500 mb-4">Pilih berkas <b>Laporan Detail Data Penjualan Obat</b> hasil ekspor sistem kasir apotek (.xls, .xlsx, atau .csv). Hanya transaksi yang memuat vaksin meningitis / polio yang diambil.</p>

      <label class="block border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center cursor-pointer hover:bg-purple-50/50 transition">
        <input type="file" accept=".xls,.xlsx,.csv" class="hidden" @change="onFile($event)">
        <span class="ms text-[32px] text-purple-400">upload_file</span>
        <p class="text-sm font-semibold text-purple-800 mt-1">Pilih berkas</p>
        <p class="text-[11px] text-slate-400 mt-0.5" x-text="impName || 'Belum ada berkas dipilih'"></p>
      </label>

      <p x-show="impBusy" x-cloak class="text-xs text-slate-500 mt-3">Membaca berkas...</p>
      <p x-show="impErr" x-cloak class="text-xs text-red-600 mt-3 leading-relaxed" x-text="impErr"></p>

      <div x-show="impStats && !impErr" x-cloak class="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
        <p class="text-xs text-slate-700 leading-relaxed">
          Terbaca <b><span x-text="impStats ? impStats.transaksi : 0"></span> transaksi</b>, di antaranya
          <b class="text-purple-700"><span x-text="impStats ? impStats.umroh : 0"></span> jemaah umroh</b>.
          <span x-show="impStats && impStats.bukanUmroh" x-cloak><span x-text="impStats ? impStats.bukanUmroh : 0"></span> transaksi lain dilewati karena tidak memuat vaksin meningitis / polio.</span>
        </p>
        <p x-show="impStats && impStats.tanpaTravel" x-cloak class="text-[11px] text-amber-700 mt-1"><span x-text="impStats ? impStats.tanpaTravel : 0"></span> di antaranya kolom Sales-nya kosong &mdash; tetap dimasukkan, tapi belum bisa ditagihkan ke travel mana pun.</p>
        <p x-show="impStats && impStats.adaBarangLain" x-cloak class="text-[11px] text-amber-700 mt-1"><span x-text="impStats ? impStats.adaBarangLain : 0"></span> faktur juga memuat barang di luar vaksin umroh, jadi harganya lebih besar. Faktur itu diberi tanda di tabel.</p>
      </div>

      <div x-show="impPreview && impPreview.length" x-cloak class="mt-3 border border-slate-100 rounded-xl overflow-hidden">
        <p class="px-3 py-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Contoh 5 baris pertama</p>
        <div class="divide-y divide-slate-50">
          <template x-for="e in (impPreview || []).slice(0, 5)" :key="e.invoice_no">
            <div class="px-3 py-2 text-xs text-slate-600 flex justify-between gap-2">
              <span class="truncate"><b x-text="e.patient_name"></b> &middot; <span x-text="e.travel_name || 'tanpa travel'"></span></span>
              <span class="whitespace-nowrap text-slate-400" x-text="e.sold_date + ' \\u00b7 ' + rupiah(e.price)"></span>
            </div>
          </template>
        </div>
      </div>

      <div class="flex gap-2 justify-end mt-5">
        <button @click="impOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
        <button @click="applyImport()" :disabled="impBusy || !impPreview || !impPreview.length"
          class="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">
          <span x-show="!impBusy">Masukkan ke Laporan</span><span x-show="impBusy" x-cloak>Menyimpan...</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Tarif cashback per travel -->
  <div x-show="rateOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="rateOpen=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <h3 class="text-lg font-bold text-gray-800 mb-1">Tarif Cashback per Travel</h3>
      <p class="text-xs text-gray-500 mb-4">Menyetel nominal cashback sekaligus untuk semua jemaah travel ini di rentang tanggal yang sedang dipilih. Yang sudah ditandai <b>dibayar</b> tidak diubah.</p>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Travel</label>
          <select x-model="rateTravel" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">-- pilih travel --</option>
            <template x-for="t in travels" :key="t"><option :value="t" x-text="t"></option></template>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Cashback per jemaah (Rp)</label>
          <input type="number" min="0" step="1000" x-model="rateAmount" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-400/50">
        </div>
        <p class="text-xs text-slate-600">Akan diterapkan ke <b><span x-text="rateCount"></span> jemaah</b> yang cashback-nya belum dibayar.</p>
      </div>
      <div class="flex gap-2 justify-end mt-5">
        <button @click="rateOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
        <button @click="applyRate()" :disabled="!rateTravel || rateBusy" class="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Terapkan</button>
      </div>
    </div>
  </div>

  <!-- Kirim rincian cashback lewat WhatsApp -->
  <div x-show="waOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="waOpen=false">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-1">Kirim Rincian Cashback</h3>
      <p class="text-xs text-gray-500 mb-4">Daftar jemaah disusun otomatis dari rentang tanggal yang sedang dipilih.</p>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Travel</label>
          <select x-model="waTravel" @change="syncWaText()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">-- pilih travel --</option>
            <template x-for="t in travels" :key="t"><option :value="t" x-text="t"></option></template>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-600 mb-1">Nomor WhatsApp Travel</label>
          <input type="tel" x-model="waPhone" placeholder="0812xxxxxxx" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50">
        </div>
      </div>

      <label class="flex items-center gap-2 mt-3 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" x-model="waUnpaidOnly" @change="syncWaText()" class="rounded border-gray-300">
        Hanya yang cashback-nya belum dibayar
      </label>

      <div class="mt-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
        <p class="text-xs text-slate-600">
          <b><span x-text="waRows.length"></span> jemaah</b> akan dikirimkan<span x-show="waTotal" x-cloak>, total cashback <b x-text="rupiah(waTotal)"></b></span>.
        </p>
        <p x-show="!waRows.length" x-cloak class="text-[11px] text-amber-700 mt-1">Tidak ada jemaah yang cocok. Coba lebarkan rentang tanggalnya, atau hilangkan centang &ldquo;hanya yang belum dibayar&rdquo;.</p>
      </div>

      <div class="mt-3">
        <label class="block text-xs text-gray-600 mb-1">Isi pesan (boleh diubah sebelum dikirim)</label>
        <textarea x-model="waText" rows="9" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-400/50"></textarea>
      </div>

      <div class="flex gap-2 justify-between items-center mt-5 flex-wrap">
        <button x-show="canCash && waRows.length" x-cloak @click="markWaPaid()" :disabled="waMarking"
          class="px-3 py-2 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition disabled:opacity-50">
          Tandai semuanya sudah dibayar
        </button>
        <div class="flex gap-2 ml-auto">
          <button @click="waOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Tutup</button>
          <a :href="waHref" x-show="waHref && waRows.length" x-cloak target="_blank" rel="noopener"
            class="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style="background:#25D366">
            <span class="ms text-[17px]">send</span>Buka WhatsApp
          </a>
          <span x-show="!waHref || !waRows.length" x-cloak class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 bg-slate-100 cursor-not-allowed">Buka WhatsApp</span>
        </div>
      </div>
    </div>
  </div>`;
}
