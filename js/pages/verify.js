import { store } from '../store.js';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function verifyPage(params) {
  return `
  <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0f172a 0%, #1c3980 50%, #3A6FC9 100%);"
    x-data="{ loading: true, cert: null, error: false,
      async load() {
        try {
          const result = await window.__store.getCertificateById('${params.certId}');
          if (result) { this.cert = result; } else { this.error = true; }
        } catch(e) { this.error = true; }
        this.loading = false;
      }
    }" x-init="load()">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <div class="inline-block rounded-2xl overflow-hidden mb-3 shadow-xl">
          <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-16 w-auto">
        </div>
        <h1 class="text-xl font-bold text-white">Verifikasi Sertifikat</h1>
        <p class="text-teal-200/70 text-sm mt-1">Klinik Kasih Anugerah Prima &middot; Primuni.id</p>
      </div>

      <div class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
        <div x-show="loading" class="text-center py-8">
          <svg class="animate-spin h-8 w-8 text-teal-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <p class="text-teal-100/70 text-sm">Memeriksa dokumen...</p>
        </div>

        <template x-if="!loading && cert">
          <div>
            <div class="flex items-center gap-3 mb-5 p-3 rounded-xl bg-green-500/15 border border-green-400/30">
              <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"><svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
              <div><p class="text-green-300 font-semibold text-sm" x-text="cert.cert_type === 'skd' ? 'Surat Sah & Terverifikasi' : 'Sertifikat Sah & Terverifikasi'"></p><p class="text-green-200/70 text-xs">Dokumen ini diterbitkan resmi oleh Klinik Prima</p></div>
            </div>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between py-2 border-b border-white/10"><span class="text-teal-200/60">Nama Pasien</span><span class="text-white font-medium" x-text="cert.patient_name"></span></div>
              <!-- SKD (Surat Keterangan Dokter) -->
              <template x-if="cert.cert_type === 'skd'">
                <div class="space-y-3">
                  <div class="flex justify-between py-2 border-b border-white/10"><span class="text-teal-200/60">Jenis Surat</span><span class="text-white font-medium" x-text="'Surat Keterangan ' + ((cert.perihal||'').charAt(0) + (cert.perihal||'').slice(1).toLowerCase())"></span></div>
                  <div class="flex justify-between py-2 border-b border-white/10" x-show="cert.details && cert.details.diagnosis"><span class="text-teal-200/60">Diagnosis</span><span class="text-white font-medium" x-text="cert.details && cert.details.diagnosis"></span></div>
                  <div class="flex justify-between py-2 border-b border-white/10" x-show="cert.details && cert.details.keperluan"><span class="text-teal-200/60">Keperluan</span><span class="text-white font-medium" x-text="cert.details && cert.details.keperluan"></span></div>
                  <div class="flex justify-between py-2 border-b border-white/10" x-show="cert.doctor_name"><span class="text-teal-200/60">Dokter</span><span class="text-white font-medium" x-text="cert.doctor_name"></span></div>
                </div>
              </template>
              <!-- Vaccination certificate -->
              <template x-if="cert.cert_type !== 'skd'">
                <div class="flex justify-between py-2 border-b border-white/10"><span class="text-teal-200/60">Vaksin</span><span class="text-white font-medium" x-text="cert.vaccine_name + (cert.vaccine_brand ? ' - ' + cert.vaccine_brand : '')"></span></div>
              </template>
              <div class="flex justify-between py-2 border-b border-white/10"><span class="text-teal-200/60">No. Dokumen</span><span class="text-white font-medium" x-text="cert.cert_number"></span></div>
              <div class="flex justify-between py-2"><span class="text-teal-200/60">Diterbitkan</span><span class="text-white font-medium" x-text="new Date(cert.issued_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})"></span></div>
            </div>
          </div>
        </template>

        <div x-show="!loading && !cert" x-cloak class="text-center py-6">
          <div class="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3"><svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></div>
          <p class="text-red-300 font-semibold mb-1">Sertifikat Tidak Ditemukan</p>
          <p class="text-teal-100/60 text-sm">Dokumen ini tidak terdaftar dalam sistem kami atau ID verifikasi tidak valid.</p>
        </div>
      </div>
      <p class="text-center text-teal-100/40 text-xs mt-6">myprima.id &middot; Sistem Verifikasi Digital Klinik Prima</p>
    </div>
  </div>`;
}
