import { store } from '../store.js';
import { CONFIG } from '../config.js';

function fmt(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Public page (no login) reached from the WhatsApp reminder link. Lets the
// patient confirm attendance or request another day for their appointment.
export function konfirmasiPage(params) {
  const today = new Date().toISOString().split('T')[0];
  window.__apptSlots = CONFIG.APPOINTMENT_SLOTS || [];
  return `
  <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0f172a 0%, #1c3980 50%, #3A6FC9 100%);"
    x-data="{ loading: true, appt: null, error: false, mode: 'view', submitting: false, done: false, doneMsg: '',
      rDate: '', rTime: '', rNote: '', slots: window.__apptSlots || [], taken: [], loadingSlots: false,
      async load() {
        try {
          const a = await window.__store.getAppointmentForConfirm('${params.apptId}');
          if (a) { this.appt = a; this.rDate = a.proposed_date || a.date || '${today}'; this.rTime = a.proposed_time || a.time_slot || ''; }
          else this.error = true;
        } catch(e) { this.error = true; }
        this.loading = false;
      },
      async openReschedule() { this.mode = 'reschedule'; await this.loadSlots(); },
      async loadSlots() {
        if (!this.appt || !this.appt.doctor_id || !this.rDate) { this.taken = []; return; }
        this.loadingSlots = true;
        try { this.taken = await window.__store.getTakenSlots(this.appt.doctor_id, this.rDate); } catch(e) { this.taken = []; }
        // Slot yang dipilih pasien di jadwal ini tak dianggap 'penuh' bagi dirinya.
        this.taken = (this.taken || []).filter(s => s !== this.appt.time_slot);
        this.loadingSlots = false;
      },
      async confirm() {
        this.submitting = true;
        const r = await window.__store.submitAppointmentResponse('${params.apptId}', 'confirmed', null, null, '');
        this.submitting = false;
        if (r.error) { alert(r.error); return; }
        this.done = true; this.doneMsg = 'Terima kasih! Kehadiran Anda sudah dikonfirmasi. Sampai jumpa di klinik. 🙏';
      },
      async reschedule() {
        if (!this.rDate) { alert('Pilih tanggal usulan dulu.'); return; }
        this.submitting = true;
        const r = await window.__store.submitAppointmentResponse('${params.apptId}', 'reschedule', this.rDate, this.rTime, this.rNote);
        this.submitting = false;
        if (r.error) { alert(r.error); return; }
        this.done = true; this.doneMsg = 'Terima kasih! Permintaan ganti hari Anda sudah kami terima. Petugas klinik akan menghubungi Anda untuk konfirmasi jadwal baru. 🙏';
      }
    }" x-init="load()">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <div class="inline-block rounded-2xl overflow-hidden mb-3 shadow-xl"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-16 w-auto"></div>
        <h1 class="text-xl font-bold text-white">Konfirmasi Jadwal</h1>
        <p class="text-teal-200/70 text-sm mt-1">Klinik Kasih Anugerah Prima &middot; myprima.id</p>
      </div>

      <div class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
        <div x-show="loading" class="text-center py-8"><svg class="animate-spin h-8 w-8 text-teal-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><p class="text-teal-100/70 text-sm">Memuat jadwal...</p></div>

        <!-- Selesai -->
        <template x-if="!loading && done">
          <div class="text-center py-4">
            <div class="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3"><svg class="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
            <p class="text-white font-semibold mb-1">Berhasil</p>
            <p class="text-teal-100/80 text-sm" x-text="doneMsg"></p>
          </div>
        </template>

        <!-- Tidak ditemukan -->
        <div x-show="!loading && error" x-cloak class="text-center py-6">
          <div class="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3"><svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></div>
          <p class="text-red-300 font-semibold mb-1">Jadwal Tidak Ditemukan</p>
          <p class="text-teal-100/60 text-sm">Link tidak valid atau jadwal sudah tidak tersedia.</p>
        </div>

        <!-- Detail + aksi -->
        <template x-if="!loading && appt && !done">
          <div>
            <div class="rounded-xl bg-white/10 border border-white/10 p-4 mb-5 text-sm">
              <div class="flex justify-between py-1.5 border-b border-white/10"><span class="text-teal-200/60">Nama</span><span class="text-white font-medium" x-text="appt.patient_name || '-'"></span></div>
              <div class="flex justify-between py-1.5 border-b border-white/10"><span class="text-teal-200/60">Tanggal</span><span class="text-white font-medium" x-text="new Date(appt.date).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})"></span></div>
              <div class="flex justify-between py-1.5" x-show="appt.time_slot"><span class="text-teal-200/60">Jam</span><span class="text-white font-medium" x-text="appt.time_slot"></span></div>
              <div class="flex justify-between py-1.5" x-show="appt.doctor_name"><span class="text-teal-200/60">Dokter</span><span class="text-white font-medium" x-text="appt.doctor_name"></span></div>
            </div>

            <!-- status respons sebelumnya -->
            <div x-show="appt.patient_response === 'confirmed'" x-cloak class="mb-4 p-2.5 rounded-lg bg-green-500/15 border border-green-400/30 text-green-200 text-xs text-center">Anda sudah mengonfirmasi kehadiran. Anda bisa mengubahnya di bawah.</div>
            <div x-show="appt.patient_response === 'reschedule'" x-cloak class="mb-4 p-2.5 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs text-center">Anda sudah meminta ganti hari. Anda bisa mengubahnya di bawah.</div>

            <!-- pilihan utama -->
            <div x-show="mode === 'view'" class="space-y-3">
              <button @click="confirm()" :disabled="submitting" class="w-full py-3.5 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg><span x-text="submitting ? 'Menyimpan...' : 'Ya, saya bisa datang'"></span></button>
              <button @click="openReschedule()" class="w-full py-3.5 rounded-xl font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/20 transition flex items-center justify-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Minta ganti hari</button>
            </div>

            <!-- form ganti hari -->
            <div x-show="mode === 'reschedule'" x-cloak class="space-y-3">
              <p class="text-teal-100/80 text-sm">Silakan pilih tanggal & jam yang Anda inginkan:</p>
              <div><label class="block text-teal-200/70 text-xs mb-1">Tanggal usulan</label><input type="date" x-model="rDate" @change="rTime=''; loadSlots()" class="w-full px-3 py-2.5 rounded-lg bg-white/90 text-gray-800 text-sm focus:outline-none"></div>
              <div>
                <label class="block text-teal-200/70 text-xs mb-1">Pilih jam tersedia</label>
                <div x-show="loadingSlots" class="text-teal-100/60 text-xs py-2">Memeriksa jam tersedia...</div>
                <div class="grid grid-cols-4 gap-2">
                  <template x-for="s in slots" :key="s">
                    <button type="button" :disabled="taken.includes(s)" @click="rTime = s"
                      :class="rTime===s ? 'bg-teal-500 text-white ring-2 ring-white/50' : (taken.includes(s) ? 'bg-white/10 text-white/30 line-through cursor-not-allowed' : 'bg-white/85 text-gray-800 hover:bg-white')"
                      class="py-2 rounded-lg text-sm font-medium transition" x-text="s"></button>
                  </template>
                </div>
                <p class="text-teal-100/50 text-[11px] mt-1">Jam bercoret = sudah terisi.</p>
              </div>
              <div><label class="block text-teal-200/70 text-xs mb-1">Catatan (opsional)</label><textarea x-model="rNote" rows="2" class="w-full px-3 py-2.5 rounded-lg bg-white/90 text-gray-800 text-sm focus:outline-none resize-none" placeholder="mis. lebih nyaman pagi hari"></textarea></div>
              <div class="flex gap-2">
                <button @click="mode = 'view'" class="px-4 py-2.5 rounded-lg text-sm text-teal-100 border border-white/20 hover:bg-white/10 transition">Kembali</button>
                <button @click="reschedule()" :disabled="submitting || !rTime" class="flex-1 py-2.5 rounded-lg font-semibold text-white bg-teal-500 hover:bg-teal-600 transition disabled:opacity-50" x-text="submitting ? 'Menyimpan...' : (rTime ? 'Kirim permintaan ('+rTime+')' : 'Pilih jam dulu')"></button>
              </div>
            </div>
          </div>
        </template>
      </div>
      <p class="text-center text-teal-100/40 text-xs mt-6">myprima.id &middot; Sistem Jadwal Klinik Prima</p>
    </div>
  </div>`;
}
