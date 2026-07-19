// Shared BMHP & Jasa home care claim pages, rendered for both the Dokter and
// SuperAdmin roles. Each role's page module (doctor.js / admin.js) supplies
// its own sidebar/header markup and role-scoped data, then delegates the
// actual page body to the functions below.

export function homeCareNewPage(ctx) {
  const { role, sidebar, header, doctorId, doctors = [], patients = [], historyPath, claimId, existingClaim, existingItems } = ctx;
  const isEdit = !!claimId;
  // new Date().toISOString().split('T')[0] reads the UTC date — WIB is
  // UTC+7, so from local midnight to 7am that's still "yesterday" in UTC.
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  window.__homecarePatients = patients.map(p => ({ id: p.id, full_name: p.full_name, nik: p.nik || '' }));
  window.__homecareDoctors = doctors.map(d => ({ id: d.id, full_name: d.full_name }));
  window.__homecareExistingItems = (existingItems || []).map(it => ({
    name: it.item_name, category: it.category, bucket: it.category, unit: it.unit, price: it.unit_price, qty: it.quantity,
  }));

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    loading: true, priceItems: [], search: '', categoryFilter: '',
    selected: (function() {
      const map = {};
      (window.__homecareExistingItems || []).forEach(it => { map[it.name] = it; });
      return map;
    })(),
    visitDate: '${existingClaim?.visit_date || today}',
    doctorId: '${existingClaim?.doctor_id || doctorId || ''}',
    patients: window.__homecarePatients || [],
    doctors: window.__homecareDoctors || [],
    patientId: '${existingClaim?.patient_id || ''}', patientName: '${(existingClaim?.patient_name || '').replace(/'/g, "\\'")}', patientSearch: '${(existingClaim?.patient_name || '').replace(/'/g, "\\'")}', patientDropdownOpen: false,
    notes: '${(existingClaim?.notes || '').replace(/'/g, "\\'")}', saving: false, saved: false, deleting: false,
    async loadPriceList() {
      this.loading = true;
      this.priceItems = await window.__store.getPriceList();
      this.loading = false;
    },
    get categories() {
      return [...new Set(this.priceItems.map(it => it.category))].filter(Boolean).sort();
    },
    get filteredItems() {
      const q = this.search.toLowerCase();
      return this.priceItems.filter(it => (!this.categoryFilter || it.category === this.categoryFilter) && (!q || it.name.toLowerCase().includes(q)));
    },
    // Items carried over from an existing claim that no longer appear in the
    // live sheet (renamed/removed) — kept selected but shown separately since
    // they won't render as a checkable row in the main table.
    get leftoverItems() {
      const names = new Set(this.priceItems.map(it => it.name));
      return Object.values(this.selected).filter(i => !names.has(i.name));
    },
    isSelected(item) { return !!this.selected[item.name]; },
    toggle(item) {
      if (this.selected[item.name]) { const s = { ...this.selected }; delete s[item.name]; this.selected = s; }
      else this.selected = { ...this.selected, [item.name]: { ...item, qty: 1 } };
    },
    remove(name) { const s = { ...this.selected }; delete s[name]; this.selected = s; },
    setQty(item, qty) {
      const q = Math.max(1, parseInt(qty) || 1);
      if (this.selected[item.name]) this.selected = { ...this.selected, [item.name]: { ...this.selected[item.name], qty: q } };
    },
    setPrice(item, price) {
      const p = Math.max(0, parseInt(price) || 0);
      if (this.selected[item.name]) this.selected = { ...this.selected, [item.name]: { ...this.selected[item.name], price: p } };
    },
    get selectedList() { return Object.values(this.selected); },
    get totalBmhp() { return this.selectedList.filter(i => i.bucket === 'BMHP').reduce((s, i) => s + i.price * i.qty, 0); },
    get totalJasa() { return this.selectedList.filter(i => i.bucket === 'Jasa').reduce((s, i) => s + i.price * i.qty, 0); },
    get totalAll() { return this.totalBmhp + this.totalJasa; },
    get filteredPatients() {
      if (!this.patientSearch) return [];
      const q = this.patientSearch.toLowerCase();
      return this.patients.filter(p => p.full_name.toLowerCase().includes(q) || (p.nik || '').includes(q)).slice(0, 6);
    },
    selectPatient(p) { this.patientId = p.id; this.patientName = p.full_name; this.patientSearch = p.full_name; this.patientDropdownOpen = false; },
    formatRupiah(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); },
    async submitClaim() {
      this.saving = true;
      const header = {
        doctor_id: this.doctorId || null,
        patient_id: this.patientId || null,
        patient_name: this.patientName || this.patientSearch || '-',
        visit_date: this.visitDate,
        notes: this.notes,
        total_bmhp: this.totalBmhp, total_jasa: this.totalJasa, total_amount: this.totalAll,
      };
      const itemsPayload = this.selectedList.map(i => ({ category: i.bucket, item_name: i.name, unit: i.unit, unit_price: i.price, quantity: i.qty, subtotal: i.price * i.qty }));
      ${isEdit
        ? `await window.__store.updateHomeCareClaim('${claimId}', header, itemsPayload);`
        : `await window.__store.createHomeCareClaim(header, itemsPayload);`}
      this.saving = false; this.saved = true;
      setTimeout(() => { window.location.hash = '${historyPath}'; }, 800);
    }${isEdit ? `,
    async deleteClaim() {
      if (!confirm('Hapus klaim ini? Tindakan ini tidak bisa dibatalkan.')) return;
      this.deleting = true;
      await window.__store.deleteHomeCareClaim('${claimId}');
      window.location.hash = '${historyPath}';
    }` : ''}
  }" x-init="loadPriceList()" class="min-h-screen bg-wash">
    ${sidebar}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${header}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">${isEdit ? 'Edit Klaim BMHP & Jasa' : 'Klaim BMHP & Jasa — Home Care'}</h2>
          <div class="flex gap-2">
            ${isEdit ? `<button @click="deleteClaim()" :disabled="deleting" class="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-50">Hapus Klaim</button>` : ''}
            <button @click="submitClaim()" :disabled="saving || saved || selectedList.length === 0 || (!patientName && !patientSearch)${role === 'superadmin' ? ' || !doctorId' : ''}" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">
              <span x-show="!saving && !saved">${isEdit ? 'Simpan Perubahan' : 'Simpan Klaim'}</span>
              <span x-show="saving" x-cloak>Menyimpan...</span>
              <span x-show="saved" x-cloak>Tersimpan!</span>
            </button>
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="grid sm:grid-cols-2 ${role === 'superadmin' ? 'lg:grid-cols-3' : ''} gap-3">
            <div class="relative">
              <label class="block text-xs text-gray-500 mb-1">Pasien *</label>
              <input type="text" x-model="patientSearch" @input="patientDropdownOpen = true; patientId=''; patientName=''" @focus="patientDropdownOpen = true" @click.away="patientDropdownOpen = false" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari nama pasien atau ketik manual...">
              <div x-show="patientDropdownOpen && filteredPatients.length > 0" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                <template x-for="p in filteredPatients" :key="p.id">
                  <button type="button" @mousedown.prevent="selectPatient(p)" class="w-full text-left px-3 py-2 hover:bg-teal-50 transition border-b border-gray-50">
                    <span class="text-sm text-gray-800" x-text="p.full_name"></span>
                    <span class="text-xs text-gray-400 block" x-text="p.nik"></span>
                  </button>
                </template>
              </div>
            </div>
            <div><label class="block text-xs text-gray-500 mb-1">Tanggal Kunjungan *</label><input type="date" x-model="visitDate" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            ${role === 'superadmin' ? `<div><label class="block text-xs text-gray-500 mb-1">Dokter *</label><select x-model="doctorId" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih Dokter</option><template x-for="d in doctors" :key="d.id"><option :value="d.id" x-text="d.full_name"></option></template></select></div>` : ''}
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div class="flex flex-wrap gap-2">
              <button @click="categoryFilter=''" :class="!categoryFilter ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Semua</button>
              <template x-for="cat in categories" :key="cat">
                <button @click="categoryFilter=cat" :class="categoryFilter===cat ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition" x-text="cat"></button>
              </template>
            </div>
            <div class="relative flex-1"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari nama item BMHP/Jasa..."></div>
          </div>

          <template x-if="loading"><p class="text-center text-gray-400 text-sm py-8">Memuat daftar harga...</p></template>
          <template x-if="!loading && priceItems.length === 0"><p class="text-center text-gray-400 text-sm py-8">Daftar harga belum tersedia. Pastikan Google Sheet sudah dipublish dan URL-nya sudah diisi di konfigurasi.</p></template>

          <div x-show="!loading && priceItems.length > 0" class="overflow-x-auto">
            <table class="w-full">
              <thead><tr class="bg-gray-50 border-b border-gray-100">
                <th class="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2 w-8"></th>
                <th class="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Nama Item</th>
                <th class="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Kategori</th>
                <th class="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Harga</th>
                <th class="text-center text-xs font-semibold text-gray-500 uppercase px-3 py-2 w-24">Qty</th>
                <th class="text-right text-xs font-semibold text-gray-500 uppercase px-3 py-2">Subtotal</th>
              </tr></thead>
              <tbody class="divide-y divide-gray-50">
                <template x-for="item in filteredItems" :key="item.name">
                  <tr class="hover:bg-gray-50 transition" :class="isSelected(item) ? 'bg-teal-50/40' : ''">
                    <td class="px-3 py-2"><input type="checkbox" :checked="isSelected(item)" @change="toggle(item)" class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400/50"></td>
                    <td class="px-3 py-2 text-sm font-medium text-gray-800" x-text="item.name"></td>
                    <td class="px-3 py-2">
                      <div class="flex flex-col gap-1">
                        <span class="text-xs text-gray-500" x-text="item.category"></span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium w-fit" :class="item.bucket==='BMHP' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'" x-text="item.bucket"></span>
                      </div>
                    </td>
                    <td class="px-3 py-2 text-right">
                      <template x-if="!isSelected(item)"><span class="text-sm text-gray-600" x-text="formatRupiah(item.price) + (item.unit ? ' / '+item.unit : '')"></span></template>
                      <template x-if="isSelected(item)"><input type="number" min="0" :value="selected[item.name].price" @input="setPrice(item, $event.target.value)" class="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-400/50"></template>
                    </td>
                    <td class="px-3 py-2 text-center"><input type="number" min="1" :value="selected[item.name] ? selected[item.name].qty : 1" @input="setQty(item, $event.target.value)" :disabled="!isSelected(item)" class="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-400/50"></td>
                    <td class="px-3 py-2 text-sm font-medium text-gray-800 text-right" x-text="isSelected(item) ? formatRupiah(item.price * selected[item.name].qty) : '-'"></td>
                  </tr>
                </template>
                <template x-if="!loading && priceItems.length > 0 && filteredItems.length === 0"><tr><td colspan="6" class="px-3 py-8 text-center text-gray-400 text-sm">Tidak ada item yang cocok</td></tr></template>
              </tbody>
            </table>
          </div>

          <div x-show="leftoverItems.length > 0" x-cloak class="mt-3 pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-500 mb-2">Item berikut sudah dipilih sebelumnya tapi tidak lagi ada di daftar harga saat ini:</p>
            <template x-for="item in leftoverItems" :key="item.name">
              <div class="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span class="text-gray-700" x-text="item.name + ' (qty ' + item.qty + ' x ' + formatRupiah(item.price) + ')'"></span>
                <button @click="remove(item.name)" class="text-red-500 hover:text-red-700 text-xs">Hapus</button>
              </div>
            </template>
          </div>
        </div>

        <div class="grid lg:grid-cols-2 gap-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-2">Catatan</h4>
            <textarea x-model="notes" rows="3" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Opsional"></textarea>
          </div>
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Ringkasan</h4>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Total BMHP</span><span class="font-medium text-gray-800" x-text="formatRupiah(totalBmhp)"></span></div>
              <div class="flex justify-between"><span class="text-gray-500">Total Jasa</span><span class="font-medium text-gray-800" x-text="formatRupiah(totalJasa)"></span></div>
              <div class="flex justify-between pt-2 border-t border-gray-100"><span class="font-semibold text-gray-800">Total Tagihan Pasien</span><span class="font-bold text-teal-600" x-text="formatRupiah(totalAll)"></span></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function homeCareHistoryPage(ctx) {
  const { role, sidebar, header, claims = [], claimItemsMap = {}, doctors = [], newPath, editPath, doctorId } = ctx;
  window.__homecareClaims = claims;
  window.__homecareClaimItems = claimItemsMap;
  window.__homecareFilterDoctors = doctors.map(d => ({ id: d.id, full_name: d.full_name }));

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    claims: window.__homecareClaims || [],
    itemsMap: window.__homecareClaimItems || {},
    doctors: window.__homecareFilterDoctors || [],
    doctorFilter: '', dateFrom: '', dateTo: '', openId: null, statusFilter: 'pending',
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 8000);
    },
    async poll() {
      const claims = await window.__store.fetchHomeCareClaims(${doctorId ? `'${doctorId}'` : 'undefined'});
      this.claims = ${role === 'superadmin' ? 'claims.map(c => ({ ...c, doctor_name: window.__store.getDoctor(c.doctor_id)?.full_name || \'-\' }))' : 'claims'};
      const map = {};
      this.claims.forEach(c => { map[c.id] = window.__store.getHomeCareClaimItems(c.id); });
      this.itemsMap = map;
    },
    get filteredClaims() {
      return this.claims.filter(c =>
        (!this.doctorFilter || c.doctor_id === this.doctorFilter) &&
        (!this.dateFrom || c.visit_date >= this.dateFrom) &&
        (!this.dateTo || c.visit_date <= this.dateTo) &&
        (this.statusFilter === '' || (c.status || 'pending') === this.statusFilter)
      );
    },
    get totalBmhpFiltered() { return this.filteredClaims.reduce((s,c) => s + (c.total_bmhp||0), 0); },
    get totalJasaFiltered() { return this.filteredClaims.reduce((s,c) => s + (c.total_jasa||0), 0); },
    itemsFor(claimId) { return this.itemsMap[claimId] || []; },
    formatRupiah(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); },
    formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); },
    async deleteClaim(claimId) {
      if (!confirm('Hapus klaim ini? Tindakan ini tidak bisa dibatalkan.')) return;
      await window.__store.deleteHomeCareClaim(claimId);
      this.claims = this.claims.filter(c => c.id !== claimId);
    },
    async markComplete(claimId) {
      await window.__store.markHomeCareClaimComplete(claimId);
      const c = this.claims.find(x => x.id === claimId);
      if (c) c.status = 'selesai';
    },
    async unmarkComplete(claimId) {
      await window.__store.unmarkHomeCareClaimComplete(claimId);
      const c = this.claims.find(x => x.id === claimId);
      if (c) c.status = 'pending';
    }
  }" class="min-h-screen bg-wash">
    ${sidebar}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${header}
      <main class="p-4 lg:p-6 max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Riwayat Klaim BMHP & Jasa</h2>
          <a href="#${newPath}" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Klaim Baru</a>
        </div>

        <div class="grid sm:grid-cols-3 gap-4 mb-4">
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><p class="text-xs text-gray-500">Total BMHP (sesuai filter)</p><p class="text-xl font-bold text-blue-600" x-text="formatRupiah(totalBmhpFiltered)"></p></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><p class="text-xs text-gray-500">Total Jasa (sesuai filter)</p><p class="text-xl font-bold text-purple-600" x-text="formatRupiah(totalJasaFiltered)"></p></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><p class="text-xs text-gray-500">Jumlah Klaim</p><p class="text-xl font-bold text-gray-800" x-text="filteredClaims.length"></p></div>
        </div>

        <div class="flex gap-2 mb-4">
          <button @click="statusFilter='pending'" :class="statusFilter==='pending' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Aktif</button>
          <button @click="statusFilter='selesai'" :class="statusFilter==='selesai' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Selesai</button>
          <button @click="statusFilter=''" :class="statusFilter==='' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Semua</button>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="grid sm:grid-cols-2 ${role === 'superadmin' ? 'lg:grid-cols-4' : ''} gap-3">
            <div><label class="block text-xs text-gray-500 mb-1">Dari Tanggal</label><input type="date" x-model="dateFrom" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Sampai Tanggal</label><input type="date" x-model="dateTo" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            ${role === 'superadmin' ? `<div class="sm:col-span-2"><label class="block text-xs text-gray-500 mb-1">Dokter</label><select x-model="doctorFilter" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Semua Dokter</option><template x-for="d in doctors" :key="d.id"><option :value="d.id" x-text="d.full_name"></option></template></select></div>` : ''}
          </div>
        </div>

        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <template x-if="filteredClaims.length === 0"><p class="p-8 text-center text-gray-400 text-sm">Belum ada klaim yang tersimpan</p></template>
          <div class="divide-y divide-gray-50">
            <template x-for="claim in filteredClaims" :key="claim.id">
              <div>
                <div class="p-4 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between" @click="openId = openId === claim.id ? null : claim.id">
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="font-medium text-gray-800 text-sm" x-text="claim.patient_name || 'Pasien'"></p>
                      <span x-show="(claim.status || 'pending') === 'selesai'" class="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ Selesai</span>
                    </div>
                    <p class="text-xs text-gray-500" x-text="formatDate(claim.visit_date)${role === 'superadmin' ? " + ' — ' + (claim.doctor_name || '-')" : ''}"></p>
                  </div>
                  <div class="flex items-center gap-4 text-right">
                    <div><p class="text-xs text-gray-400">BMHP</p><p class="text-sm font-medium text-blue-600" x-text="formatRupiah(claim.total_bmhp)"></p></div>
                    <div><p class="text-xs text-gray-400">Jasa</p><p class="text-sm font-medium text-purple-600" x-text="formatRupiah(claim.total_jasa)"></p></div>
                    <div><p class="text-xs text-gray-400">Total</p><p class="text-sm font-bold text-gray-800" x-text="formatRupiah(claim.total_amount)"></p></div>
                    <div class="flex gap-1">
                      ${role === 'superadmin' ? `
                      <button x-show="(claim.status || 'pending') !== 'selesai'" @click.stop="markComplete(claim.id)" class="px-2 py-1 rounded text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition">Tandai Selesai</button>
                      <button x-show="claim.status === 'selesai'" @click.stop="unmarkComplete(claim.id)" class="px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Batalkan Selesai</button>
                      ` : ''}
                      <a :href="'#${editPath}/' + claim.id" @click.stop class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit</a>
                      <button @click.stop="deleteClaim(claim.id)" class="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 transition" :class="openId === claim.id && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                <div x-show="openId === claim.id" x-cloak class="px-4 pb-4 bg-gray-50/50">
                  <table class="w-full text-sm">
                    <thead><tr class="text-xs text-gray-500 uppercase"><th class="text-left py-1">Item</th><th class="text-left py-1">Kategori</th><th class="text-right py-1">Harga</th><th class="text-right py-1">Qty</th><th class="text-right py-1">Subtotal</th></tr></thead>
                    <tbody>
                      <template x-for="it in itemsFor(claim.id)" :key="it.id">
                        <tr class="border-t border-gray-100">
                          <td class="py-1.5" x-text="it.item_name"></td>
                          <td class="py-1.5" x-text="it.category"></td>
                          <td class="py-1.5 text-right" x-text="formatRupiah(it.unit_price)"></td>
                          <td class="py-1.5 text-right" x-text="it.quantity"></td>
                          <td class="py-1.5 text-right font-medium" x-text="formatRupiah(it.subtotal)"></td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                  <p class="text-xs text-gray-400 mt-2" x-show="claim.notes" x-text="'Catatan: ' + claim.notes"></p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}
