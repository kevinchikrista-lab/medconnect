// Stok Opening — Super Admin uploads a daily opening-stock Excel (from vmedis).
// Parsed in-browser via SheetJS (loaded on demand), archived per date, and
// low-stock items are flagged. Rendered inside the admin shell via a wrapper.
// x-data below uses SINGLE QUOTES ONLY (a double-quote would truncate the attr).

export function stockXData() {
  return `tab: 'upload', today: new Date().toISOString().split('T')[0],
    openingDate: new Date().toISOString().split('T')[0], filename: '', parsing: false, headers: [], rows: [],
    nameCol: '', stockCol: '', threshold: 10, saving: false, uploadMsg: '',
    loading: true, snapshots: [],
    detail: null, detailSearch: '', onlyLow: false, loadingDetail: false,
    toNum(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; },
    guessCols() { const h = this.headers; const find = (pats) => h.find(c => pats.some(p => String(c).toLowerCase().includes(p))) || '';
      this.nameCol = find(['nama','barang','item','produk','obat','deskripsi']);
      this.stockCol = find(['stok','stock','qty','jumlah','sisa','saldo','kuantitas','quantity']); },
    async onFile(ev) { const f = ev.target.files && ev.target.files[0]; if (!f) return;
      this.filename = f.name; this.parsing = true; this.uploadMsg = '';
      try { const XLSX = await window.__loadXLSX(); const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        this.rows = json; this.headers = json.length ? Object.keys(json[0]) : []; this.guessCols();
      } catch (e) { this.uploadMsg = 'Gagal membaca file: ' + (e.message || e); this.rows = []; this.headers = []; }
      this.parsing = false; },
    lowCount() { if (!this.stockCol) return 0; return this.rows.filter(r => this.toNum(r[this.stockCol]) <= this.threshold).length; },
    previewRows() { return this.rows.slice(0, 12); },
    async save() { if (!this.rows.length) { this.uploadMsg = 'Belum ada data. Pilih file Excel dulu.'; return; }
      if (!this.openingDate) { this.uploadMsg = 'Isi tanggal stok dulu.'; return; }
      this.saving = true;
      const r = await window.__store.addStockOpening({ opening_date: this.openingDate, filename: this.filename, columns: this.headers, rows: this.rows, name_col: this.nameCol, stock_col: this.stockCol, low_threshold: this.threshold, item_count: this.rows.length, low_count: this.lowCount() });
      this.saving = false;
      if (r.error) { this.uploadMsg = r.error; return; }
      this.rows = []; this.headers = []; this.filename = ''; this.uploadMsg = '';
      this.tab = 'list'; await this.loadList();
      window.__showToast && window.__showToast('Tersimpan', 'Stok opening tersimpan.'); },
    async loadList() { this.loading = true; try { this.snapshots = await window.__store.getStockOpenings(); } catch (e) { this.snapshots = []; } this.loading = false; },
    async openDetail(s) { this.tab = 'detail'; this.loadingDetail = true; this.detail = null; this.detailSearch = ''; this.onlyLow = false;
      try { this.detail = await window.__store.getStockOpeningById(s.id); } catch (e) { this.detail = null; } this.loadingDetail = false; },
    isLow(r) { const sc = this.detail && this.detail.stock_col; const th = (this.detail && this.detail.low_threshold) || 0; return sc ? this.toNum(r[sc]) <= th : false; },
    detailLowCount() { if (!this.detail || !this.detail.stock_col) return 0; return (this.detail.rows || []).filter(r => this.isLow(r)).length; },
    detailRows() { if (!this.detail) return []; const q = (this.detailSearch || '').toLowerCase();
      return (this.detail.rows || []).filter(r => { if (this.onlyLow && !this.isLow(r)) return false;
        if (q) return Object.values(r).some(v => String(v).toLowerCase().includes(q)); return true; }); },
    async removeSnapshot(s) { if (!confirm('Hapus stok opening tanggal ' + (s.opening_date || '') + '?')) return;
      await window.__store.deleteStockOpening(s.id); this.snapshots = this.snapshots.filter(x => x.id !== s.id); },
    fmt(d) { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }`;
}

export function stockBody() {
  return `
  <div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
    <h2 class="text-xl font-bold text-gray-800">Stok Opening Harian</h2>
    <div class="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
      <button @click="tab='upload'" :class="tab==='upload'?'bg-blue-600 text-white':'text-gray-600'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">Upload</button>
      <button @click="tab='list'; if(!snapshots.length) loadList()" :class="(tab==='list'||tab==='detail')?'bg-blue-600 text-white':'text-gray-600'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">Riwayat</button>
    </div>
  </div>

  <!-- UPLOAD -->
  <div x-show="tab==='upload'" x-cloak>
    <div class="bg-white border border-slate-100 rounded-3xl p-5 mb-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="block text-xs text-gray-600 mb-1">Tanggal Stok</label><input type="date" x-model="openingDate" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
        <div><label class="block text-xs text-gray-600 mb-1">File Excel (dari vmedis)</label><input type="file" accept=".xlsx,.xls,.csv" @change="onFile($event)" class="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"></div>
      </div>
      <p x-show="parsing" class="text-sm text-gray-400 mt-3">Membaca file...</p>
      <p x-show="uploadMsg" x-cloak class="mt-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm" x-text="uploadMsg"></p>
    </div>

    <template x-if="rows.length">
      <div>
        <div class="bg-white border border-slate-100 rounded-3xl p-5 mb-4">
          <h3 class="font-semibold text-gray-800 mb-3">Pengaturan Peringatan Stok</h3>
          <div class="grid sm:grid-cols-3 gap-4">
            <div><label class="block text-xs text-gray-600 mb-1">Kolom Nama Barang</label><select x-model="nameCol" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><template x-for="h in headers" :key="h"><option :value="h" x-text="h"></option></template></select></div>
            <div><label class="block text-xs text-gray-600 mb-1">Kolom Jumlah Stok</label><select x-model="stockCol" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">(pilih)</option><template x-for="h in headers" :key="h"><option :value="h" x-text="h"></option></template></select></div>
            <div><label class="block text-xs text-gray-600 mb-1">Ambang "mau habis" (&le;)</label><input type="number" x-model.number="threshold" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"></div>
          </div>
          <p class="mt-3 text-sm" x-show="stockCol"><span class="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">&#9888; <span x-text="lowCount()"></span> barang stoknya &le; <span x-text="threshold"></span></span></p>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-4">
          <div class="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">Pratinjau (<span x-text="rows.length"></span> baris, menampilkan 12 pertama)</div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="bg-gray-50 border-b border-gray-100"><template x-for="h in headers" :key="h"><th class="text-left text-xs font-semibold text-gray-500 px-3 py-2 whitespace-nowrap" x-text="h"></th></template></tr></thead>
              <tbody class="divide-y divide-gray-50">
                <template x-for="(r,ri) in previewRows()" :key="ri">
                  <tr :class="(stockCol && toNum(r[stockCol])<=threshold) ? 'bg-red-50' : ''">
                    <template x-for="h in headers" :key="h"><td class="px-3 py-1.5 text-gray-700 whitespace-nowrap" x-text="r[h]"></td></template>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <button @click="save()" :disabled="saving" class="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-text="saving ? 'Menyimpan...' : 'Simpan Stok Opening'"></span></button>
      </div>
    </template>
  </div>

  <!-- RIWAYAT (list) -->
  <div x-show="tab==='list'" x-cloak>
    <div x-show="loading" class="text-center py-10 text-gray-400 text-sm">Memuat...</div>
    <template x-if="!loading && snapshots.length===0"><div class="bg-white rounded-3xl border border-slate-100 p-10 text-center text-gray-400 text-sm">Belum ada stok opening. Upload dari tab "Upload".</div></template>
    <div class="space-y-2">
      <template x-for="s in snapshots" :key="s.id">
        <div class="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div class="cursor-pointer" @click="openDetail(s)">
            <p class="font-medium text-gray-800 text-sm" x-text="fmt(s.opening_date)"></p>
            <p class="text-xs text-gray-500" x-text="(s.item_count||0)+' barang'+(s.filename ? ' — '+s.filename : '')"></p>
          </div>
          <div class="flex items-center gap-2">
            <span x-show="s.low_count>0" class="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold" x-text="'&#9888; '+s.low_count+' mau habis'"></span>
            <button @click="openDetail(s)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Lihat</button>
            <button @click="removeSnapshot(s)" class="px-2 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- DETAIL (satu tanggal) -->
  <div x-show="tab==='detail'" x-cloak>
    <button @click="tab='list'" class="text-sm text-teal-600 hover:text-teal-700 mb-3">&larr; Kembali ke riwayat</button>
    <div x-show="loadingDetail" class="text-center py-10 text-gray-400 text-sm">Memuat stok...</div>
    <template x-if="!loadingDetail && detail">
      <div>
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div><h3 class="font-bold text-gray-800" x-text="fmt(detail.opening_date)"></h3><p class="text-xs text-gray-500" x-text="(detail.item_count||0)+' barang'"></p></div>
          <div class="flex items-center gap-2 flex-wrap">
            <span x-show="detailLowCount()>0" class="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold" x-text="'&#9888; '+detailLowCount()+' barang mau habis'"></span>
            <label class="flex items-center gap-1.5 text-sm text-gray-600"><input type="checkbox" x-model="onlyLow"> Hanya yang mau habis</label>
            <input type="text" x-model="detailSearch" placeholder="Cari barang..." class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto max-h-[70vh]">
            <table class="w-full text-sm">
              <thead class="sticky top-0"><tr class="bg-gray-50 border-b border-gray-100"><template x-for="h in (detail.columns||[])" :key="h"><th class="text-left text-xs font-semibold text-gray-500 px-3 py-2 whitespace-nowrap" x-text="h"></th></template></tr></thead>
              <tbody class="divide-y divide-gray-50">
                <template x-for="(r,ri) in detailRows()" :key="ri">
                  <tr :class="isLow(r) ? 'bg-red-50' : ''">
                    <template x-for="h in (detail.columns||[])" :key="h"><td class="px-3 py-1.5 whitespace-nowrap" :class="isLow(r) ? 'text-red-700 font-medium' : 'text-gray-700'" x-text="r[h]"></td></template>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>`;
}
