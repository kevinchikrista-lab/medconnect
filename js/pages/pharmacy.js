import { store } from '../store.js';
import { CONFIG } from '../config.js';

// Teks apa pun yang berasal dari isian orang harus lewat sini sebelum
// dicetak ke HTML. Nama obat kini bisa diketik apotek, jadi ini bukan lagi
// sekadar kehati-hatian.
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


function getPharmacy() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  return store.getPharmacyByUserId(user?.id);
}
function getUser() { return JSON.parse(sessionStorage.getItem('medconnect_user')); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }

export function pharmacyDashboard() {
  const pharmacy = getPharmacy();
  const user = getUser();
  const inventory = store.getInventory(pharmacy?.id);
  const lowStock = inventory.filter(i => i.stock <= i.min_stock);
  const unread = store.getUnreadCount(user?.id);
  window.__pharmacyId = pharmacy?.id || '';
  window.__pharmacyPrescriptionsInitial = store.getPrescriptionsByPharmacy(pharmacy?.id);
  window.__prescriptionStatusLabels = CONFIG.PRESCRIPTION_STATUS_LABELS;

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    pharmacyId: '${pharmacy?.id || ''}',
    prescriptions: window.__pharmacyPrescriptionsInitial || [],
    statusLabels: window.__prescriptionStatusLabels || {},
    canRx: window.__pharmacyCanRx === true,
    drafts: window.__pharmacyDrafts || [],
    rxPatients: window.__pharmacyPatients || [], rxDoctors: window.__pharmacyDoctors || [],
    rxUnits: window.__rxUnits || [], rxSigna: window.__rxSigna || [], rxSignaTime: window.__rxSignaTime || [],
    rxOpen: false, rxSaving: false, rxErr: '', rxCari: '',
    ulangOpen: false, ulangCari: '', ulangHasil: [], ulangBusy: false, ulangErr: '', ulangDokter: '', ulangPilih: '',
    rxForm: { patient_id: '', doctor_id: '', notes: '', items: [] },
    // ---- Menyusun resep (wajib ACC dokter) ----
    rxBlank() { return { drug_name: '', dosage: '', frequency: '', time: '', quantity: '', unit: (this.rxUnits[0] || 'Tablet'), instructions: '' }; },
    openRx() {
      this.rxErr = ''; this.rxCari = '';
      this.rxForm = { patient_id: '', doctor_id: (this.rxDoctors[0] && this.rxDoctors[0].id) || '', notes: '', items: [this.rxBlank()] };
      this.rxOpen = true;
    },
    rxAddItem() { this.rxForm.items.push(this.rxBlank()); },
    get rxPasienTersaring() {
      const q = (this.rxCari || '').toLowerCase();
      if (!q) return this.rxPatients.slice(0, 8);
      return this.rxPatients.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
    },
    rxPasienNama(id) { const p = this.rxPatients.find(x => x.id === id); return p ? p.name : ''; },
    async submitRx() {
      if (this.rxSaving) return;
      this.rxErr = '';
      this.rxSaving = true;
      const res = await window.__store.createPharmacyPrescription(
        { patient_id: this.rxForm.patient_id, notes: this.rxForm.notes, record_id: null },
        this.rxForm.items,
        { pharmacyId: this.pharmacyId, doctorId: this.rxForm.doctor_id });
      this.rxSaving = false;
      if (!res || res.error || !res.success) { this.rxErr = (res && res.error) || 'Gagal menyimpan resep.'; return; }
      this.rxOpen = false;
      this.drafts = window.__store.getRxDraftedByPharmacy(this.pharmacyId);
      window.__showToast && window.__showToast('Terkirim untuk ACC',
        'Resep ' + res.rx.rx_number + ' menunggu persetujuan dokter. Resep ini belum berlaku sampai disetujui.');
    },
    // ---- Resep ulang: ambil dari resep yang pernah sah ----
    openUlang() {
      this.ulangOpen = true; this.ulangErr = ''; this.ulangPilih = '';
      this.ulangCari = '';
      this.ulangDokter = (this.rxDoctors[0] && this.rxDoctors[0].id) || '';
      this.cariUlang();
    },
    cariUlang() { this.ulangHasil = window.__store.searchPrescriptionsForRepeat(this.ulangCari, 25); },
    ulangRingkas(r) {
      return (r.items || []).map(i => i.drug_name + (i.dosage ? ' ' + i.dosage : '')).join(', ');
    },
    async kirimUlang(r) {
      if (this.ulangBusy) return;
      if (!this.ulangDokter) { this.ulangErr = 'Pilih dokter yang akan meng-ACC terlebih dahulu.'; return; }
      if (!confirm('Ulangi resep ' + r.rx_number + ' untuk ' + r.patient_name + '? Resep ulang ini tetap menunggu ACC dokter sebelum berlaku.')) return;
      this.ulangBusy = true; this.ulangErr = '';
      const res = await window.__store.repeatPrescription(r.id, { pharmacyId: this.pharmacyId, doctorId: this.ulangDokter });
      this.ulangBusy = false;
      if (!res || res.error || !res.success) { this.ulangErr = (res && res.error) || 'Gagal membuat resep ulang.'; return; }
      this.ulangOpen = false;
      this.drafts = window.__store.getRxDraftedByPharmacy(this.pharmacyId);
      window.__showToast && window.__showToast('Resep ulang dikirim',
        'Resep ' + res.rx.rx_number + ' menunggu ACC dokter. Belum berlaku sampai disetujui.');
    },
    // Menyalin isinya ke formulir susun resep, bila mau diubah dulu.
    sunting(r) {
      this.ulangOpen = false;
      this.rxErr = ''; this.rxCari = r.patient_name;
      this.rxForm = {
        patient_id: r.patient_id,
        doctor_id: this.ulangDokter || (this.rxDoctors[0] && this.rxDoctors[0].id) || '',
        notes: 'Resep ulang dari ' + r.rx_number,
        items: (r.items || []).map(i => ({ drug_name: i.drug_name, dosage: i.dosage, frequency: i.frequency, time: i.time, quantity: i.quantity, unit: i.unit || (this.rxUnits[0] || 'Tablet'), instructions: i.instructions })),
      };
      if (!this.rxForm.items.length) this.rxForm.items = [this.rxBlank()];
      this.rxOpen = true;
    },
    rxAccLabel(rx) { const s = window.__store.rxApprovalStatus(rx); return s === 'pending' ? 'Menunggu ACC dokter' : (s === 'rejected' ? 'Ditolak dokter' : 'Disetujui'); },
    rxAccChip(rx) { const s = window.__store.rxApprovalStatus(rx); return s === 'pending' ? 'bg-amber-100 text-amber-800' : (s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'); },
    statusColors: { sent: 'border-l-red-500 bg-red-50/30', received: 'border-l-indigo-500', preparing: 'border-l-amber-500 bg-amber-50/30', ready: 'border-l-green-500 bg-green-50/30', delivering: 'border-l-blue-500 bg-blue-50/30' },
    statusDots: { sent: 'bg-red-500', received: 'bg-indigo-500', preparing: 'bg-amber-500', ready: 'bg-green-500', delivering: 'bg-blue-500' },
    statusBadges: { sent: 'bg-red-100 text-red-700', received: 'bg-indigo-100 text-indigo-700', preparing: 'bg-amber-100 text-amber-700', ready: 'bg-green-100 text-green-700', delivering: 'bg-blue-100 text-blue-700' },
    get incoming() { return this.prescriptions.filter(rx => rx.status === 'sent'); },
    get processing() { return this.prescriptions.filter(rx => ['received','preparing','delivering'].includes(rx.status)); },
    get ready() { return this.prescriptions.filter(rx => rx.status === 'ready'); },
    get completedToday() {
      // Was filtering by status alone (no date check at all), so it counted
      // every prescription ever marked completed, not just today's. Compares
      // local date strings (toDateString, not toISOString) so this lines up
      // with the pharmacy's own clock/timezone, not UTC.
      const today = new Date().toDateString();
      return this.prescriptions.filter(rx => rx.status === 'completed' && rx.completed_at && new Date(rx.completed_at).toDateString() === today);
    },
    get activeList() { return [...this.incoming, ...this.processing, ...this.ready].sort((a,b) => b.created_at.localeCompare(a.created_at)); },
    itemCount(rxId) { return window.__store.getPrescriptionItems(rxId).length; },
    patientName(id) { return window.__store.getPatient(id)?.full_name || 'N/A'; },
    doctorName(id) { return window.__store.getDoctor(id)?.full_name || 'N/A'; },
    patientContact(id) {
      const p = window.__store.getPatient(id) || {};
      return { phone: p.phone || '', famName: p.family_name || '', famPhone: p.family_phone || '', famRel: p.family_relation || '' };
    },
    timeAgo(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + ' menit lalu';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + ' jam lalu';
      return Math.floor(hrs / 24) + ' hari lalu';
    },
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 6000);
    },
    async poll() { this.prescriptions = await window.__store.fetchPrescriptionsForPharmacy(this.pharmacyId); },
    async accept(id) { await window.__store.updatePrescriptionStatus(id, 'preparing'); await this.poll(); },
    async reject(id, rxNumber) {
      const r = prompt('Alasan penolakan resep ' + rxNumber + ':');
      if (r === null) return;
      if (!r.trim()) { alert('Alasan penolakan wajib diisi'); return; }
      await window.__store.updatePrescriptionStatus(id, 'rejected', r.trim());
      await this.poll();
    },
    async sendNow(id) { await window.__store.updatePrescriptionStatus(id, 'delivering'); await this.poll(); },
    async markReady(id) { await window.__store.updatePrescriptionStatus(id, 'ready'); await this.poll(); },
    async complete(id) { await window.__store.updatePrescriptionStatus(id, 'completed'); await this.poll(); }
  }" class="min-h-screen bg-wash">
    ${pharmacySidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy, unread)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">${pharmacy?.name || 'Apotek'}</h2><p class="text-sm text-gray-500">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-green flex items-center justify-center"><span class="ms text-[22px] text-white">prescriptions</span></div><div><p class="text-2xl font-bold text-ink" x-text="incoming.length"></p><p class="text-xs text-faint">Resep Masuk</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#e0a112"><span class="ms text-[22px] text-white">pending_actions</span></div><div><p class="text-2xl font-bold text-ink" x-text="processing.length"></p><p class="text-xs text-faint">Sedang Proses</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#22b573,#158a54)"><span class="ms text-[22px] text-white">task_alt</span></div><div><p class="text-2xl font-bold text-ink" x-text="completedToday.length"></p><p class="text-xs text-faint">Selesai Hari Ini</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:${lowStock.length > 0 ? '#e8452c' : '#1b6fd6'}"><span class="ms text-[22px] text-white">warning</span></div><div><p class="text-2xl font-bold text-ink">${lowStock.length}</p><p class="text-xs text-faint">Stok Rendah</p></div></div></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl mb-6">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">Resep Masuk (Real-time)</h3><a href="#/pharmacy/prescriptions" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
          <div class="divide-y divide-gray-50">
            <template x-if="activeList.length === 0"><p class="p-6 text-center text-gray-400 text-sm">Tidak ada resep aktif</p></template>
            <template x-for="rx in activeList" :key="rx.id">
              <div class="p-4 border-l-4 hover:bg-gray-50 transition" :class="statusColors[rx.status] || ''">
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="w-2 h-2 rounded-full animate-pulse" :class="statusDots[rx.status] || 'bg-gray-400'"></span>
                      <span class="font-medium text-sm text-gray-800" x-text="rx.rx_number"></span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="statusBadges[rx.status] || 'bg-gray-100 text-gray-600'" x-text="statusLabels[rx.status] || rx.status"></span>
                      <template x-if="rx.delivery_method === 'delivery'"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">🚚 Dikirim</span></template>
                      <span class="text-xs text-gray-400" x-text="timeAgo(rx.created_at)"></span>
                    </div>
                    <p class="text-sm text-gray-700">Pasien: <span class="font-medium" x-text="patientName(rx.patient_id)"></span></p>
                    <p class="text-xs text-gray-500"><span x-text="'Dokter: ' + doctorName(rx.doctor_id)"></span> | <span x-text="itemCount(rx.id) + ' obat'"></span></p>
                    <p class="text-xs text-slate-600 mt-0.5">
                      <span x-text="'HP: ' + (patientContact(rx.patient_id).phone || '-')"></span>
                      <template x-if="patientContact(rx.patient_id).famPhone"><span x-text="' | Keluarga' + (patientContact(rx.patient_id).famRel ? ' ('+patientContact(rx.patient_id).famRel+')' : '') + ': ' + patientContact(rx.patient_id).famPhone"></span></template>
                    </p>
                  </div>
                  <div class="flex gap-1 flex-shrink-0">
                    <template x-if="rx.status === 'sent'">
                      <button @click="accept(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Terima</button>
                    </template>
                    <template x-if="rx.status === 'sent'">
                      <button @click="reject(rx.id, rx.rx_number)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">Tolak</button>
                    </template>
                    <template x-if="rx.status === 'preparing' && rx.delivery_method === 'delivery'">
                      <button @click="sendNow(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition">Kirim Sekarang</button>
                    </template>
                    <template x-if="rx.status === 'preparing' && rx.delivery_method !== 'delivery'">
                      <button @click="markReady(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Siap Diambil</button>
                    </template>
                    <template x-if="rx.status === 'ready'">
                      <button @click="complete(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Selesai</button>
                    </template>
                    <template x-if="rx.status === 'delivering'">
                      <button @click="complete(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Selesai (Diterima)</button>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        ${lowStock.length > 0 ? `
        <div class="bg-white rounded-xl border border-red-200 shadow-sm">
          <div class="p-4 border-b border-red-100 bg-red-50/50"><h3 class="font-semibold text-red-800 text-sm">Peringatan Stok Rendah</h3></div>
          <div class="divide-y divide-gray-50">${lowStock.map(i => `<div class="p-3 flex items-center justify-between"><div><p class="text-sm font-medium text-gray-800">${escHtml(i.drug_name)}</p><p class="text-xs text-gray-500">Min. stok: ${escHtml(String(i.min_stock))} ${escHtml(i.unit)}</p></div><span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Sisa: ${i.stock}</span></div>`).join('')}</div>
        </div>` : ''}
      </main>
    </div>
  </div>`;
}

export function pharmacyPrescriptions() {
  const pharmacy = getPharmacy();
  const user = getUser();
  window.__pharmacyId = pharmacy?.id || '';
  window.__pharmacyAllPrescriptionsInitial = store.getPrescriptionsByPharmacy(pharmacy?.id);
  window.__prescriptionStatusLabels = CONFIG.PRESCRIPTION_STATUS_LABELS;
  // Izin menyusun resep diberikan per apotek dari Manajemen User. Kalau tidak
  // diberi izin, seluruh bagian ini tidak dirender sama sekali — bukan sekadar
  // tombolnya dinonaktifkan.
  window.__pharmacyCanRx = store.pharmacyCanPrescribe(pharmacy?.id) === true;
  window.__pharmacyPatients = (store.data.patients || []).map(p => ({ id: p.id, name: p.full_name, phone: p.phone || '' }));
  window.__pharmacyDoctors = store.getDoctors().map(d => ({ id: d.id, name: d.full_name || 'Dokter', sip: d.sip_number || '' }));
  window.__pharmacyDrafts = store.getRxDraftedByPharmacy(pharmacy?.id);
  window.__rxUnits = CONFIG.DRUG_UNITS || [];
  window.__rxSigna = CONFIG.SIGNA_OPTIONS || [];
  window.__rxSignaTime = CONFIG.SIGNA_TIME || [];
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024, filter: '',
    pharmacyId: '${pharmacy?.id || ''}',
    userId: '${user?.id || ''}',
    prescriptions: window.__pharmacyAllPrescriptionsInitial || [],
    statusLabels: window.__prescriptionStatusLabels || {},
    canRx: window.__pharmacyCanRx === true,
    drafts: window.__pharmacyDrafts || [],
    rxPatients: window.__pharmacyPatients || [], rxDoctors: window.__pharmacyDoctors || [],
    rxUnits: window.__rxUnits || [], rxSigna: window.__rxSigna || [], rxSignaTime: window.__rxSignaTime || [],
    rxOpen: false, rxSaving: false, rxErr: '', rxCari: '',
    ulangOpen: false, ulangCari: '', ulangHasil: [], ulangBusy: false, ulangErr: '', ulangDokter: '', ulangPilih: '',
    rxForm: { patient_id: '', doctor_id: '', notes: '', items: [] },
    // ---- Menyusun resep (wajib ACC dokter) ----
    rxBlank() { return { drug_name: '', dosage: '', frequency: '', time: '', quantity: '', unit: (this.rxUnits[0] || 'Tablet'), instructions: '' }; },
    openRx() {
      this.rxErr = ''; this.rxCari = '';
      this.rxForm = { patient_id: '', doctor_id: (this.rxDoctors[0] && this.rxDoctors[0].id) || '', notes: '', items: [this.rxBlank()] };
      this.rxOpen = true;
    },
    rxAddItem() { this.rxForm.items.push(this.rxBlank()); },
    get rxPasienTersaring() {
      const q = (this.rxCari || '').toLowerCase();
      if (!q) return this.rxPatients.slice(0, 8);
      return this.rxPatients.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
    },
    rxPasienNama(id) { const p = this.rxPatients.find(x => x.id === id); return p ? p.name : ''; },
    async submitRx() {
      if (this.rxSaving) return;
      this.rxErr = '';
      this.rxSaving = true;
      const res = await window.__store.createPharmacyPrescription(
        { patient_id: this.rxForm.patient_id, notes: this.rxForm.notes, record_id: null },
        this.rxForm.items,
        { pharmacyId: this.pharmacyId, doctorId: this.rxForm.doctor_id });
      this.rxSaving = false;
      if (!res || res.error || !res.success) { this.rxErr = (res && res.error) || 'Gagal menyimpan resep.'; return; }
      this.rxOpen = false;
      this.drafts = window.__store.getRxDraftedByPharmacy(this.pharmacyId);
      window.__showToast && window.__showToast('Terkirim untuk ACC',
        'Resep ' + res.rx.rx_number + ' menunggu persetujuan dokter. Resep ini belum berlaku sampai disetujui.');
    },
    // ---- Mendaftarkan pasien baru ----
    // Yang paling sering terjadi: namanya sudah diketik di kotak cari, lalu
    // ternyata belum terdaftar. Karena itu nama yang sudah diketik dibawa masuk
    // ke formulir ini, bukan mulai dari kosong lagi.
    npOpen: false, npSaving: false, npErr: '', npMirip: [],
    npKosong() { return { full_name: '', nik: '', birth_date: '', gender: '', phone: '', address: '', allergies: '', family_name: '', family_phone: '', family_relation: '' }; },
    npForm: { full_name: '', nik: '', birth_date: '', gender: '', phone: '', address: '', allergies: '', family_name: '', family_phone: '', family_relation: '' },
    bukaPasienBaru(namaAwal) {
      this.npErr = '';
      this.npForm = { ...this.npKosong(), full_name: (namaAwal || '').trim() };
      this.cekMirip();
      this.npOpen = true;
    },
    // Duplikat pasien baru ketahuan saat riwayat obatnya dibutuhkan, dan saat
    // itu sudah terlambat. Jadi calon kembarannya ditampilkan sambil diketik,
    // sebelum ada yang tersimpan.
    cekMirip() {
      this.npMirip = window.__store.findSimilarPatients({ full_name: this.npForm.full_name, phone: this.npForm.phone, nik: this.npForm.nik });
    },
    // 'Ternyata sudah ada' — pakai yang lama, jangan buat yang kedua.
    pakaiPasienLama(p) {
      if (!this.rxPatients.some(x => x.id === p.id)) this.rxPatients = [{ id: p.id, name: p.full_name, phone: p.phone || '' }, ...this.rxPatients];
      this.rxForm.patient_id = p.id; this.rxCari = p.full_name || '';
      this.npOpen = false;
      window.__showToast && window.__showToast('Pasien dipilih', p.full_name + ' dipakai dari data yang sudah ada.');
    },
    async simpanPasienBaru() {
      if (this.npSaving) return;
      this.npErr = '';
      if (!(this.npForm.full_name || '').trim()) { this.npErr = 'Nama lengkap pasien wajib diisi.'; return; }
      this.npSaving = true;
      const res = await window.__store.createPatientByStaff(this.npForm, { byUserId: this.userId, via: 'apotek' });
      this.npSaving = false;
      if (!res || !res.success) { this.npErr = (res && res.error) || 'Gagal menyimpan data pasien.'; return; }
      const p = res.patient;
      // Dimasukkan sendiri ke daftar pilihan halaman ini (bukan memuat ulang
      // seluruh halaman) lalu langsung terpilih, supaya resepnya bisa
      // diteruskan tanpa mencari lagi dari awal.
      this.rxPatients = [{ id: p.id, name: p.full_name, phone: p.phone || '' }, ...this.rxPatients];
      this.rxForm.patient_id = p.id; this.rxCari = p.full_name;
      this.npOpen = false;
      window.__showToast && window.__showToast('Pasien terdaftar',
        p.full_name + ' sudah masuk daftar pasien' + (p.rm_number ? ' dengan No. RM ' + p.rm_number : '') + '.');
    },
    // ---- Resep ulang: ambil dari resep yang pernah sah ----
    openUlang() {
      this.ulangOpen = true; this.ulangErr = ''; this.ulangPilih = '';
      this.ulangCari = '';
      this.ulangDokter = (this.rxDoctors[0] && this.rxDoctors[0].id) || '';
      this.cariUlang();
    },
    cariUlang() { this.ulangHasil = window.__store.searchPrescriptionsForRepeat(this.ulangCari, 25); },
    ulangRingkas(r) {
      return (r.items || []).map(i => i.drug_name + (i.dosage ? ' ' + i.dosage : '')).join(', ');
    },
    async kirimUlang(r) {
      if (this.ulangBusy) return;
      if (!this.ulangDokter) { this.ulangErr = 'Pilih dokter yang akan meng-ACC terlebih dahulu.'; return; }
      if (!confirm('Ulangi resep ' + r.rx_number + ' untuk ' + r.patient_name + '? Resep ulang ini tetap menunggu ACC dokter sebelum berlaku.')) return;
      this.ulangBusy = true; this.ulangErr = '';
      const res = await window.__store.repeatPrescription(r.id, { pharmacyId: this.pharmacyId, doctorId: this.ulangDokter });
      this.ulangBusy = false;
      if (!res || res.error || !res.success) { this.ulangErr = (res && res.error) || 'Gagal membuat resep ulang.'; return; }
      this.ulangOpen = false;
      this.drafts = window.__store.getRxDraftedByPharmacy(this.pharmacyId);
      window.__showToast && window.__showToast('Resep ulang dikirim',
        'Resep ' + res.rx.rx_number + ' menunggu ACC dokter. Belum berlaku sampai disetujui.');
    },
    // Menyalin isinya ke formulir susun resep, bila mau diubah dulu.
    sunting(r) {
      this.ulangOpen = false;
      this.rxErr = ''; this.rxCari = r.patient_name;
      this.rxForm = {
        patient_id: r.patient_id,
        doctor_id: this.ulangDokter || (this.rxDoctors[0] && this.rxDoctors[0].id) || '',
        notes: 'Resep ulang dari ' + r.rx_number,
        items: (r.items || []).map(i => ({ drug_name: i.drug_name, dosage: i.dosage, frequency: i.frequency, time: i.time, quantity: i.quantity, unit: i.unit || (this.rxUnits[0] || 'Tablet'), instructions: i.instructions })),
      };
      if (!this.rxForm.items.length) this.rxForm.items = [this.rxBlank()];
      this.rxOpen = true;
    },
    rxAccLabel(rx) { const s = window.__store.rxApprovalStatus(rx); return s === 'pending' ? 'Menunggu ACC dokter' : (s === 'rejected' ? 'Ditolak dokter' : 'Disetujui'); },
    rxAccChip(rx) { const s = window.__store.rxApprovalStatus(rx); return s === 'pending' ? 'bg-amber-100 text-amber-800' : (s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'); },
    statusBadges: { sent:'bg-blue-100 text-blue-700', preparing:'bg-amber-100 text-amber-700', ready:'bg-green-100 text-green-700', delivering:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700', received:'bg-indigo-100 text-indigo-700' },
    get filteredPrescriptions() { return (this.filter ? this.prescriptions.filter(rx => rx.status === this.filter) : this.prescriptions).slice().sort((a,b) => b.created_at.localeCompare(a.created_at)); },
    itemsFor(rxId) { return window.__store.getPrescriptionItems(rxId); },
    patientName(id) { return window.__store.getPatient(id)?.full_name || 'N/A'; },
    doctorName(id) { return window.__store.getDoctor(id)?.full_name || ''; },
    // Kontak pasien + keluarga/wali — apotek perlu ini untuk konfirmasi obat
    // siap diambil / pengiriman, terutama pasien anak yang tak pegang HP.
    patientContact(id) {
      const p = window.__store.getPatient(id) || {};
      return { phone: p.phone || '', famName: p.family_name || '', famPhone: p.family_phone || '', famRel: p.family_relation || '' };
    },
    formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }); },
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 6000);
    },
    async poll() { this.prescriptions = await window.__store.fetchPrescriptionsForPharmacy(this.pharmacyId); },
    async accept(id) { await window.__store.updatePrescriptionStatus(id, 'preparing'); await this.poll(); },
    async reject(id, rxNumber) {
      const r = prompt('Alasan penolakan resep ' + rxNumber + ':');
      if (r === null) return;
      if (!r.trim()) { alert('Alasan penolakan wajib diisi'); return; }
      await window.__store.updatePrescriptionStatus(id, 'rejected', r.trim());
      await this.poll();
    },
    async sendNow(id) { await window.__store.updatePrescriptionStatus(id, 'delivering'); await this.poll(); },
    async markReady(id) { await window.__store.updatePrescriptionStatus(id, 'ready'); await this.poll(); },
    async complete(id) { await window.__store.updatePrescriptionStatus(id, 'completed'); await this.poll(); }
  }" class="min-h-screen bg-wash">
    ${pharmacySidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 class="text-xl font-bold text-gray-800">Semua E-Resep</h2>
          <div class="flex gap-2 flex-wrap">
            <!-- Mendaftarkan pasien itu pekerjaan meja depan, bukan keputusan
                 klinis, jadi tidak diikat izin "boleh menyusun resep": apotek
                 yang hanya melayani resep dari luar pun tetap perlu mencatat
                 pasien yang belum terdaftar. -->
            <button @click="bukaPasienBaru('')" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5">
              <span class="ms text-[17px]">person_add</span>Pasien Baru
            </button>
            <button x-show="canRx" x-cloak @click="openUlang()" class="px-4 py-2 rounded-lg text-sm font-semibold text-purple-800 bg-purple-100 hover:bg-purple-200 transition flex items-center gap-1.5">
              <span class="ms text-[17px]">history</span>Ambil Resep Sebelumnya
            </button>
            <button x-show="canRx" x-cloak @click="openRx()" class="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">
              <span class="ms text-[17px]">edit_note</span>Susun Resep
            </button>
          </div>
        </div>

        <!-- Resep yang disusun apotek ini. Ditaruh terpisah dari antrean
             pelayanan, karena selama menunggu ACC resepnya BELUM berlaku dan
             tidak boleh dilayani. -->
        <div x-show="canRx && drafts.length" x-cloak class="mb-5 bg-white border-2 border-purple-200 rounded-2xl overflow-hidden">
          <div class="px-4 py-2.5 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
            <span class="ms text-[18px] text-purple-700">edit_note</span>
            <p class="text-sm font-bold text-purple-900">Resep yang Anda Susun</p>
            <span class="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[11px] font-bold" x-text="drafts.length"></span>
          </div>
          <div class="divide-y divide-slate-50">
            <template x-for="rx in drafts" :key="rx.id">
              <div class="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div class="flex-1 min-w-[200px]">
                  <p class="text-sm font-semibold text-gray-800"><span x-text="rx.rx_number"></span> &middot; <span x-text="patientName(rx.patient_id)"></span></p>
                  <p class="text-[11px] text-slate-500">Dokter penilai: <span x-text="doctorName(rx.approval_doctor_id || rx.doctor_id) || '-'"></span></p>
                  <p x-show="rx.approval_note" x-cloak class="text-[11px] text-red-600 mt-0.5" x-text="'Catatan dokter: ' + rx.approval_note"></p>
                </div>
                <span class="px-2 py-1 rounded-full text-[11px] font-bold" :class="rxAccChip(rx)" x-text="rxAccLabel(rx)"></span>
              </div>
            </template>
          </div>
          <p class="px-4 py-2 bg-slate-50 text-[11px] text-slate-500 border-t border-slate-100">Resep yang masih <b>menunggu ACC</b> belum berlaku dan sengaja tidak muncul di antrean pelayanan mana pun &mdash; termasuk antrean apotek ini sendiri.</p>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          ${['','sent','preparing','ready','delivering','completed','rejected'].map(s => `<button @click="filter='${s}'" :class="filter==='${s}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">${s ? CONFIG.PRESCRIPTION_STATUS_LABELS[s] : 'Semua'}</button>`).join('')}
        </div>
        <template x-if="filteredPrescriptions.length === 0"><p class="bg-white border border-slate-100 rounded-3xl p-8 text-center text-gray-400 text-sm">Tidak ada resep</p></template>
        <div class="space-y-3">
          <template x-for="rx in filteredPrescriptions" :key="rx.id">
            <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm" x-data="{open:false}">
              <div class="p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer transition flex items-center justify-between" @click="open=!open">
                <div>
                  <p class="font-semibold text-sm text-gray-800">
                    <span x-text="rx.rx_number + ' — ' + patientName(rx.patient_id)"></span>
                    <template x-if="rx.delivery_method === 'delivery'"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 align-middle">🚚 Dikirim</span></template>
                    <template x-if="rx.service_fee_enabled"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 align-middle">💰 Jasa Dokter</span></template>
                  </p>
                  <p class="text-xs text-gray-500"><span x-text="doctorName(rx.doctor_id) + ' | ' + formatDate((rx.created_at||'').split('T')[0]) + ' | ' + itemsFor(rx.id).length + ' obat'"></span></p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 rounded-full text-xs font-medium" :class="statusBadges[rx.status] || 'bg-gray-100'" x-text="statusLabels[rx.status] || rx.status"></span>
                  <svg class="w-4 h-4 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
              <div x-show="open" x-cloak class="p-4 border-t-2 border-gray-200 space-y-3">
                  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p class="text-xs font-semibold text-slate-700 mb-1.5">Kontak Pasien</p>
                    <div class="text-sm text-slate-800 space-y-0.5">
                      <p><span class="text-slate-500">No. HP Pasien:</span>
                        <template x-if="patientContact(rx.patient_id).phone"><a :href="'tel:'+patientContact(rx.patient_id).phone" class="font-medium text-blue-700 hover:underline" x-text="patientContact(rx.patient_id).phone"></a></template>
                        <template x-if="!patientContact(rx.patient_id).phone"><span class="text-slate-400">-</span></template>
                      </p>
                      <template x-if="patientContact(rx.patient_id).famPhone || patientContact(rx.patient_id).famName">
                        <p><span class="text-slate-500">Keluarga / Wali:</span>
                          <span class="font-medium" x-text="patientContact(rx.patient_id).famName || '-'"></span><span class="text-slate-500" x-text="patientContact(rx.patient_id).famRel ? ' ('+patientContact(rx.patient_id).famRel+')' : ''"></span>
                          <template x-if="patientContact(rx.patient_id).famPhone"><span> &mdash; <a :href="'tel:'+patientContact(rx.patient_id).famPhone" class="font-medium text-blue-700 hover:underline" x-text="patientContact(rx.patient_id).famPhone"></a></span></template>
                        </p>
                      </template>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <template x-for="(item, idx) in itemsFor(rx.id)" :key="item.id">
                      <div>
                        <template x-if="item.is_compound">
                          <div class="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                            <div class="flex items-center gap-2 mb-1.5">
                              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wide">RACIKAN</span>
                              <span class="font-semibold text-gray-800" x-text="item.drug_name || ('R/' + (idx+1))"></span>
                            </div>
                            <p class="text-xs text-gray-500 font-medium mb-0.5">Komposisi:</p>
                            <p class="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-white rounded-lg border border-purple-100 p-2" x-text="(item.compound_details || '-').trim()"></p>
                            <p class="text-xs text-gray-500 mt-2" x-text="(item.frequency||'') + ' ' + (item.time||'') + ' — ' + (item.quantity||'-') + ' ' + (item.unit||'') + (item.duration ? ' · ' + item.duration : '')"></p>
                            <p class="text-xs text-gray-500 italic mt-1" x-show="item.instructions" x-text="'Instruksi: ' + item.instructions"></p>
                          </div>
                        </template>
                        <template x-if="!item.is_compound">
                          <div class="rounded-xl border border-gray-100 p-3">
                            <p class="font-semibold text-gray-800" x-text="item.drug_name + (item.dosage ? ' — ' + item.dosage : '')"></p>
                            <p class="text-xs text-gray-500 mt-0.5" x-text="(item.frequency||'') + ' ' + (item.time||'') + ' — ' + (item.quantity||'-') + ' ' + (item.unit||'') + (item.duration ? ' · ' + item.duration : '')"></p>
                            <p class="text-xs text-gray-500 italic mt-1" x-show="item.instructions" x-text="'Instruksi: ' + item.instructions"></p>
                          </div>
                        </template>
                      </div>
                    </template>
                  </div>
                  <template x-if="rx.delivery_method === 'delivery'">
                    <div class="rounded-xl border border-blue-200 bg-blue-50 p-3"><p class="text-xs font-semibold text-blue-800 mb-1">🚚 Alamat Pengiriman</p><p class="text-sm text-blue-900 whitespace-pre-line leading-relaxed" x-text="(rx.delivery_address || '-').trim()"></p></div>
                  </template>
                  <template x-if="rx.notes">
                    <div class="rounded-xl border border-amber-200 bg-amber-50 p-3"><p class="text-xs font-semibold text-amber-800 mb-1">Catatan untuk Apoteker</p><p class="text-sm text-amber-900 whitespace-pre-line leading-relaxed" x-text="(rx.notes||'').trim()"></p></div>
                  </template>
                  <template x-if="rx.service_fee_enabled">
                    <div class="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center justify-between"><p class="text-xs font-semibold text-green-800">💰 Jasa Dokter — mohon ditarik dari pasien</p><p class="text-sm font-bold text-green-900" x-text="'Rp ' + (rx.service_fee || 0).toLocaleString('id-ID')"></p></div>
                  </template>
                  <template x-if="rx.status === 'rejected' && rx.reject_reason">
                    <div class="rounded-xl border border-red-200 bg-red-50 p-3"><p class="text-xs font-semibold text-red-800 mb-1">Alasan Ditolak</p><p class="text-sm text-red-900 whitespace-pre-line leading-relaxed" x-text="(rx.reject_reason||'').trim()"></p></div>
                  </template>
                  <div class="flex gap-1 flex-wrap">
                    <button @click="window.__printResep && window.__printResep(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition inline-flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg> Cetak Resep</button>
                    <template x-if="rx.status === 'sent'"><button @click="accept(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Terima</button></template>
                    <template x-if="rx.status === 'sent'"><button @click="reject(rx.id, rx.rx_number)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200">Tolak</button></template>
                    <template x-if="rx.status === 'preparing' && rx.delivery_method === 'delivery'"><button @click="sendNow(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600">Kirim Sekarang</button></template>
                    <template x-if="rx.status === 'preparing' && rx.delivery_method !== 'delivery'"><button @click="markReady(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Siap Diambil</button></template>
                    <template x-if="rx.status === 'ready'"><button @click="complete(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600">Selesai</button></template>
                    <template x-if="rx.status === 'delivering'"><button @click="complete(rx.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600">Selesai (Diterima)</button></template>
                  </div>
              </div>
            </div>
          </template>
        </div>
      
        <!-- Ambil resep sebelumnya. Yang disalin hanya daftar obatnya; resep
             ulangnya tetap resep baru yang menunggu ACC dokter. -->
        <div x-show="ulangOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="ulangOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 max-h-[92vh] flex flex-col">
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-lg font-bold text-gray-800">Ambil Resep Sebelumnya</h3>
              <button @click="ulangOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div class="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
              <p class="text-[11.5px] text-amber-900 leading-relaxed">Resep ulang <b>tetap menunggu ACC dokter</b>. Yang menjadikan sebuah resep sah adalah keputusan dokter hari ini &mdash; kondisi pasien bisa sudah berbeda dari resep sebelumnya.</p>
            </div>
            <div class="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs text-gray-600 mb-1">Cari resep</label>
                <input type="text" x-model="ulangCari" @input="cariUlang()" placeholder="Nama pasien, no. resep, atau nama obat..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Dokter yang meng-ACC *</label>
                <select x-model="ulangDokter" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                  <template x-for="d in rxDoctors" :key="d.id"><option :value="d.id" x-text="d.name + (d.sip ? ' — SIP ' + d.sip : '')"></option></template>
                </select>
              </div>
            </div>
            <p x-show="ulangErr" x-cloak class="text-xs text-red-600 mb-2" x-text="ulangErr"></p>
            <div class="flex-1 min-h-0 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              <template x-for="r in ulangHasil" :key="r.id">
                <div class="p-3">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex-1 min-w-[200px]">
                      <p class="text-sm font-semibold text-gray-800"><span x-text="r.rx_number"></span> &middot; <span x-text="r.patient_name"></span></p>
                      <p class="text-[11px] text-slate-500" x-text="(r.created_at || '').slice(0,10) + (r.doctor_name ? ' · ' + r.doctor_name : '')"></p>
                      <p class="text-xs text-gray-700 mt-1" x-text="ulangRingkas(r)"></p>
                    </div>
                    <div class="flex gap-1.5">
                      <button @click="kirimUlang(r)" :disabled="ulangBusy" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50">Ulangi &amp; Kirim ACC</button>
                      <button @click="sunting(r)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">Ubah dulu</button>
                    </div>
                  </div>
                </div>
              </template>
              <div x-show="!ulangHasil.length" x-cloak class="p-8 text-center text-sm text-gray-400">Tidak ada resep yang cocok.</div>
            </div>
            <div class="flex justify-end mt-4">
              <button @click="ulangOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Tutup</button>
            </div>
          </div>
        </div>

        <!-- Menyusun resep. Selalu berujung pada ACC dokter. -->
        <div x-show="rxOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="rxOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-lg font-bold text-gray-800">Susun Resep</h3>
              <button @click="rxOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div class="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
              <p class="text-[11.5px] text-amber-900 leading-relaxed">Resep ini <b>tidak berlaku</b> sampai di-ACC dokter. Selama menunggu, resepnya tidak masuk antrean pelayanan dan tidak bisa ditebus.</p>
            </div>

            <div class="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs text-gray-600">Pasien *</label>
                  <button type="button" @click="bukaPasienBaru(rxCari)" class="text-[11px] font-semibold text-purple-700 hover:underline">+ Pasien baru</button>
                </div>
                <input type="text" x-model="rxCari" placeholder="Ketik nama pasien..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                <div class="mt-1 border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-40 overflow-y-auto">
                  <template x-for="p in rxPasienTersaring" :key="p.id">
                    <button type="button" @click="rxForm.patient_id = p.id; rxCari = p.name"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition"
                      :class="rxForm.patient_id === p.id ? 'bg-purple-50 font-semibold text-purple-800' : 'text-gray-700'">
                      <span x-text="p.name"></span><span class="text-[11px] text-slate-400" x-text="p.phone ? ' · ' + p.phone : ''"></span>
                    </button>
                  </template>
                  <!-- Jalan buntu yang paling sering bikin resep tidak jadi
                       ditulis: dicari, tidak ketemu, lalu tidak tahu harus apa. -->
                  <template x-if="rxCari && !rxPasienTersaring.length">
                    <button type="button" @click="bukaPasienBaru(rxCari)" class="w-full text-left px-3 py-2.5 text-sm text-purple-800 hover:bg-purple-50 transition">
                      <span class="ms text-[15px] align-middle">person_add</span>
                      <span>Belum terdaftar — daftarkan <b x-text="rxCari"></b> sebagai pasien baru</span>
                    </button>
                  </template>
                </div>
                <p x-show="rxForm.patient_id" x-cloak class="text-[11px] text-green-700 mt-1" x-text="'Terpilih: ' + rxPasienNama(rxForm.patient_id)"></p>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Dokter yang meng-ACC *</label>
                <select x-model="rxForm.doctor_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                  <template x-for="d in rxDoctors" :key="d.id"><option :value="d.id" x-text="d.name + (d.sip ? ' — SIP ' + d.sip : '')"></option></template>
                </select>
                <p class="text-[11px] text-gray-400 mt-1">Nama dokter inilah yang akan tercantum pada resep setelah disetujui.</p>
              </div>
            </div>

            <div class="mb-3">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs text-gray-600">Obat</label>
                <button type="button" @click="rxAddItem()" class="text-xs text-purple-700 font-semibold">+ Tambah obat</button>
              </div>
              <div class="space-y-2">
                <template x-for="(it, ix) in rxForm.items" :key="ix">
                  <div class="rounded-xl border border-slate-100 p-2.5 bg-slate-50/50">
                    <div class="grid grid-cols-12 gap-2">
                      <input type="text" x-model="it.drug_name" placeholder="Nama obat *" class="col-span-7 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                      <input type="text" x-model="it.dosage" placeholder="Dosis (mis. 500 mg)" class="col-span-5 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                      <select x-model="it.frequency" class="col-span-4 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white"><option value="">Frekuensi</option><template x-for="f in rxSigna" :key="f"><option :value="f" x-text="f"></option></template></select>
                      <select x-model="it.time" class="col-span-4 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white"><option value="">Waktu</option><template x-for="t in rxSignaTime" :key="t"><option :value="t" x-text="t"></option></template></select>
                      <input type="number" min="1" x-model="it.quantity" placeholder="Jml" class="col-span-2 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white">
                      <select x-model="it.unit" class="col-span-2 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white"><template x-for="u in rxUnits" :key="u"><option :value="u" x-text="u"></option></template></select>
                      <input type="text" x-model="it.instructions" placeholder="Aturan tambahan (opsional)" class="col-span-11 px-2 py-1.5 border border-gray-200 rounded text-sm bg-white">
                      <button type="button" @click="rxForm.items.splice(ix,1)" x-show="rxForm.items.length > 1" class="col-span-1 text-red-400 hover:text-red-600 text-sm">&times;</button>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div class="mb-3">
              <label class="block text-xs text-gray-600 mb-1">Catatan untuk dokter</label>
              <textarea x-model="rxForm.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Mis. keluhan pasien, riwayat alergi, alasan pemilihan obat"></textarea>
            </div>

            <p x-show="rxErr" x-cloak class="text-xs text-red-600 mb-2 leading-relaxed" x-text="rxErr"></p>
            <div class="flex gap-2 justify-end">
              <button @click="rxOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="submitRx()" :disabled="rxSaving || !rxForm.patient_id" class="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">
                <span x-show="!rxSaving">Kirim untuk ACC Dokter</span><span x-show="rxSaving" x-cloak>Menyimpan...</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Mendaftarkan pasien baru. Sengaja dipasang sebagai lapisan di ATAS
             formulir resep (z-60), bukan menggantikannya: yang sudah diketik di
             formulir resep tidak boleh hilang hanya karena pasiennya ternyata
             belum terdaftar. -->
        <div x-show="npOpen" x-cloak class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" @click.self="npOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-lg font-bold text-gray-800">Daftarkan Pasien Baru</h3>
              <button @click="npOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p class="text-[11.5px] text-gray-500 mb-4 leading-relaxed">Nomor rekam medis diberikan otomatis. Akun ini dibuat <b>tanpa login</b> &mdash; Super Admin bisa menambahkan e-mail pasien belakangan lewat Manajemen User bila pasiennya ingin memakai aplikasi.</p>

            <!-- Peringatan duplikat muncul SEBELUM disimpan, bukan sesudah.
                 Satu orang yang terdaftar dua kali membuat riwayat obatnya
                 terbelah, dan itu baru ketahuan saat riwayatnya dibutuhkan. -->
            <div x-show="npMirip.length" x-cloak class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p class="text-[11.5px] font-bold text-amber-900 mb-2">Sudah ada pasien yang mirip &mdash; pastikan bukan orang yang sama:</p>
              <div class="space-y-1.5">
                <template x-for="m in npMirip" :key="m.id">
                  <div class="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-amber-100">
                    <div class="min-w-0">
                      <p class="text-[12.5px] font-semibold text-gray-800 truncate" x-text="m.full_name"></p>
                      <p class="text-[11px] text-slate-500 truncate">
                        <span x-text="m.match_reason"></span>
                        <span x-text="m.phone ? ' · ' + m.phone : ''"></span>
                        <span x-text="m.rm_number ? ' · RM ' + m.rm_number : ''"></span>
                      </p>
                    </div>
                    <button type="button" @click="pakaiPasienLama(m)" class="shrink-0 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 transition">Pakai yang ini</button>
                  </div>
                </template>
              </div>
            </div>

            <div class="grid sm:grid-cols-2 gap-3">
              <div class="sm:col-span-2">
                <label class="block text-xs text-gray-600 mb-1">Nama Lengkap *</label>
                <input type="text" x-model="npForm.full_name" @input.debounce.300ms="cekMirip()" placeholder="Sesuai KTP / KK" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">No. HP</label>
                <input type="text" x-model="npForm.phone" @input.debounce.300ms="cekMirip()" placeholder="08xxxxxxxxxx" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">NIK</label>
                <input type="text" x-model="npForm.nik" @input.debounce.300ms="cekMirip()" placeholder="16 digit (opsional)" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Tanggal Lahir</label>
                <input type="date" x-model="npForm.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label>
                <select x-model="npForm.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                  <option value="">-</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs text-gray-600 mb-1">Alamat</label>
                <input type="text" x-model="npForm.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs text-gray-600 mb-1">Alergi Obat</label>
                <input type="text" x-model="npForm.allergies" placeholder="Kosongkan bila tidak ada" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                <p class="text-[11px] text-gray-400 mt-1">Ditulis di sini supaya dokter melihatnya saat meng-ACC resep.</p>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">Nama Keluarga / Wali</label>
                <input type="text" x-model="npForm.family_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs text-gray-600 mb-1">HP Keluarga</label>
                  <input type="text" x-model="npForm.family_phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">Hubungan</label>
                  <input type="text" x-model="npForm.family_relation" placeholder="Mis. Ibu" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                </div>
              </div>
            </div>

            <p x-show="npErr" x-cloak class="text-xs text-red-600 mt-3 leading-relaxed" x-text="npErr"></p>
            <div class="flex gap-2 justify-end mt-4">
              <button @click="npOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="simpanPasienBaru()" :disabled="npSaving || !npForm.full_name.trim()" class="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">
                <span x-show="!npSaving">Simpan Pasien</span><span x-show="npSaving" x-cloak>Menyimpan...</span>
              </button>
            </div>
          </div>
        </div>
</main>
    </div>
  </div>`;
}

export function pharmacyInventory() {
  const pharmacy = getPharmacy();
  const inventory = store.getInventory(pharmacy?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '' }" class="min-h-screen bg-wash">
    ${pharmacySidebar('inventory')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6"><h2 class="text-xl font-bold text-gray-800">Inventaris Obat</h2>
          <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari obat..."></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama Obat</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Stok</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Min. Stok</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Kadaluarsa</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th></tr></thead>
          <tbody class="divide-y divide-gray-50">
            ${inventory.map(i => `
            <template x-if="!search || '${i.drug_name.toLowerCase()}'.includes(search.toLowerCase())">
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-sm font-medium text-gray-800">${escHtml(i.drug_name)}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${i.stock} ${i.unit}</td>
                <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${i.min_stock} ${i.unit}</td>
                <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">${formatDate(i.expiry_date)}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${i.stock <= i.min_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${i.stock <= i.min_stock ? 'Rendah' : 'Cukup'}</span></td>
              </tr>
            </template>`).join('')}
          </tbody></table></div>
        </div>
      </main>
    </div>
  </div>`;
}

function pharmacySidebar(active) {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  // Tugas yang didelegasikan Super Admin/Owner lewat halaman To-Do.
  let openTasks = 0;
  try { openTasks = user ? store.getTasksForUser(user.id).filter(t => t.status !== 'done').length : 0; } catch (e) { openTasks = 0; }
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', href: '#/pharmacy/dashboard' },
    { id: 'prescriptions', label: 'E-Resep', icon: 'prescriptions', href: '#/pharmacy/prescriptions' },
    { id: 'inventory', label: 'Inventaris', icon: 'inventory_2', href: '#/pharmacy/inventory' },
    { id: 'tugas', label: 'Tugas Saya', icon: 'checklist', href: '#/tugas', badge: openTasks },
  ];
  return `
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-white border-r border-slate-100 z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-100 flex items-center justify-between" style="flex-shrink:0"><div class="flex items-center gap-2"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto"><div><span class="font-extrabold text-[13.5px] leading-none block">Klinik Prima</span><span class="block text-[10.5px] text-faint font-semibold mt-0.5">Apotek Mitra</span></div></div><button @click="sideOpen=false" class="lg:hidden text-faint hover:text-ink"><span class="ms text-[20px]">close</span></button></div>
    <nav class="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain side-scroll">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active===i.id ? 'bg-[#e9f7f1] text-green font-bold' : 'text-muted font-semibold hover:bg-slate-50'}"><span class="ms ${active===i.id ? 'ms-fill' : ''} text-[20px] ${active===i.id ? 'text-green' : 'text-faint'}">${i.icon}</span><span class="flex-1">${i.label}</span>${i.badge ? `<span class="w-5 h-5 rounded-full bg-[#ff5436] text-white text-[10.5px] font-bold flex items-center justify-center">${i.badge}</span>` : ''}</a>`).join('')}</nav>
    <div class="p-3 border-t border-slate-100" style="flex-shrink:0"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">logout</span>Keluar</button></div>
  </aside>`;
}

function pharmacyHeader(pharmacy, unread = 0) {
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
    <div class="flex items-center gap-3">
      <a href="#/pharmacy/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span><span data-notif-count class="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#ff5436] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white" style="${unread > 0 ? '' : 'display:none'}">${unread > 99 ? '99+' : unread}</span></a>
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-[#e9f7f1] flex items-center justify-center text-xs font-bold text-green">${(pharmacy?.name || 'A').charAt(0)}</div><span class="text-sm font-medium text-ink hidden sm:block">${pharmacy?.name || 'Apotek'}</span></div>
    </div>
  </header>`;
}
