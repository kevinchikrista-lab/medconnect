import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { chatListPage, chatThreadPage } from './chat.js';

function getPatient() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  return store.getPatientByUserId(user?.id);
}
function getUser() { return JSON.parse(sessionStorage.getItem('medconnect_user')); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
function daysUntil(d) { if (!d) return null; const diff = Math.ceil((new Date(d) - new Date()) / (1000*60*60*24)); return diff; }

export function patientDashboard() {
  const patient = getPatient();
  const user = getUser();
  const upcoming = store.getUpcomingAppointments(patient?.id);
  const prescriptions = store.getPrescriptionsByPatient(patient?.id);
  const activePrescriptions = prescriptions.filter(rx => !['completed','rejected'].includes(rx.status));
  const services = store.getServices().slice(0, 4);
  const doctors = store.getDoctors().slice(0, 6);
  const unread = store.getUnreadCount(user?.id);

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${patientSidebar('home')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      <div class="hidden lg:block">${patientHeader(patient, unread)}</div>
      <div class="lg:hidden bg-gradient-to-b from-[#2b7ee0] to-brand-dark px-5 pt-5 pb-12 relative overflow-hidden rounded-b-[28px]">
        <div class="absolute -right-10 -top-5 w-40 h-40 rounded-full bg-white/[.07]"></div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-8 w-auto bg-white/90 rounded-lg p-1">
            <div><div class="text-xs text-white/70 font-semibold leading-none">Klinik Prima</div><div class="text-[14.5px] text-white font-extrabold leading-relaxed mt-0.5">Halo, ${patient?.full_name?.split(' ')[0] || 'Pasien'}</div></div>
          </div>
          <a href="#/patient/notifications" class="relative w-10 h-10 rounded-xl bg-white/[.16] flex items-center justify-center"><span class="ms text-[21px] text-white">notifications</span>${unread > 0 ? `<span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#ff5436] border-2 border-brand-dark"></span>` : ''}</a>
        </div>
      </div>
      <a href="#/patient/services" class="lg:hidden -mt-7 mx-5 relative z-10 flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3.5 shadow-xl shadow-slate-900/10">
        <span class="ms text-[20px] text-brand">search</span>
        <span class="text-sm text-slate-400 font-medium">Cari dokter atau layanan…</span>
      </a>
      <main class="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-6">
      <div class="mb-6 hidden lg:block"><h2 class="text-xl font-bold text-ink">Halo, ${patient?.full_name?.split(' ')[0] || 'Pasien'}!</h2><p class="text-sm text-gray-500">Semoga hari Anda sehat.</p></div>
      <div class="lg:hidden grid grid-cols-4 gap-2.5 mb-6 mt-4">
        <a href="#/patient/services" class="flex flex-col items-center gap-2"><span class="w-[54px] h-[54px] rounded-2xl bg-tint flex items-center justify-center"><span class="ms text-[24px] text-brand">calendar_month</span></span><span class="text-[11px] font-semibold text-[#3a4b66]">Janji</span></a>
        <a href="#/patient/prescriptions" class="flex flex-col items-center gap-2"><span class="w-[54px] h-[54px] rounded-2xl bg-[#e9f7f1] flex items-center justify-center"><span class="ms text-[24px] text-[#1f9d63]">medication</span></span><span class="text-[11px] font-semibold text-[#3a4b66]">Resep</span></a>
        <a href="#/patient/history" class="flex flex-col items-center gap-2"><span class="w-[54px] h-[54px] rounded-2xl bg-[#fdeee9] flex items-center justify-center"><span class="ms text-[24px] text-[#e8452c]">clinical_notes</span></span><span class="text-[11px] font-semibold text-[#3a4b66]">Riwayat</span></a>
        <a href="#/patient/profile" class="flex flex-col items-center gap-2"><span class="w-[54px] h-[54px] rounded-2xl bg-[#f4eefb] flex items-center justify-center"><span class="ms text-[24px] text-[#7b52c4]">person</span></span><span class="text-[11px] font-semibold text-[#3a4b66]">Profil</span></a>
      </div>
      ${upcoming.length > 0 ? `
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Jadwal Terdekat</h3>
        <div class="space-y-3">
          ${upcoming.slice(0, 3).map(apt => {
            const doctor = store.getDoctor(apt.doctor_id);
            const days = daysUntil(apt.date);
            const typeLabels = { follow_up: 'Kontrol Ulang', vaccination: 'Vaksinasi', visit: 'Kunjungan', telemedicine: 'Telemedicine' };
            const typeIcons = { follow_up: '🔄', vaccination: '💉', visit: '🏥', telemedicine: '📹' };
            return `<div class="bg-white border border-slate-100 rounded-3xl p-4">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style="background:linear-gradient(135deg,#ecfdf5,#d1fae5)">${typeIcons[apt.type] || '📋'}</div>
                <div class="flex-1">
                  <p class="font-semibold text-gray-800 text-sm">${typeLabels[apt.type] || apt.type}</p>
                  <p class="text-xs text-gray-500">${doctor?.full_name || ''}</p>
                  <p class="text-xs text-gray-500">${formatDate(apt.date)}, ${apt.time_slot}</p>
                </div>
                <div class="text-right"><span class="px-2 py-1 rounded-full text-xs font-medium ${days <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}">${days} hari lagi</span></div>
              </div>
              ${apt.notes ? `<p class="text-xs text-gray-400 mt-2 pl-13">${apt.notes}</p>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
      ${activePrescriptions.length > 0 ? `
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Status Resep</h3>
        ${activePrescriptions.slice(0, 2).map(rx => {
          const pharmacy = store.getPharmacy(rx.pharmacy_id);
          const isDelivery = rx.delivery_method === 'delivery';
          const steps = isDelivery ? ['sent','preparing','delivering','completed'] : ['sent','preparing','ready','completed'];
          const stepLabels = isDelivery ? ['Kirim','Siapkan','Dikirim','Diterima'] : ['Kirim','Siapkan','Siap Diambil','Selesai'];
          const currentIdx = steps.indexOf(rx.status);
          return `<div class="bg-white border border-slate-100 rounded-3xl p-4 mb-3">
            <div class="flex items-center justify-between mb-3"><span class="font-semibold text-sm text-gray-800">${rx.rx_number}</span><span class="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span></div>
            <div class="flex items-center gap-1 mb-3">${steps.map((s, i) => `<div class="flex-1 h-1.5 rounded-full ${i <= currentIdx ? 'bg-teal-500' : 'bg-gray-200'} transition"></div>`).join('')}</div>
            <div class="flex justify-between text-xs text-gray-400">${stepLabels.map((label, i) => `<span class="${i <= currentIdx ? 'text-teal-600 font-medium' : ''}">${label}</span>`).join('')}</div>
            <p class="text-xs text-gray-500 mt-2">${pharmacy?.name || 'Apotek'}</p>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3"><h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Layanan Kesehatan</h3><a href="#/patient/services" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
        <div class="grid grid-cols-2 gap-3">
          ${services.map(s => `<a href="#/patient/services/${s.id}" class="bg-white border border-slate-100 rounded-3xl overflow-hidden hover:shadow-md transition group">
            <div class="relative"><img src="${s.image_url}" alt="${s.name}" class="w-full h-24 object-cover group-hover:scale-105 transition duration-300"><div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div></div>
            <div class="p-3"><p class="font-medium text-gray-800 text-xs">${s.name}</p><p class="text-xs text-teal-600 font-semibold mt-1">Rp ${s.price.toLocaleString('id-ID')}</p></div>
          </a>`).join('')}
        </div>
      </div>
      <div class="lg:hidden -mx-4">
        <div class="flex items-center justify-between px-4 pb-3"><span class="text-[15.5px] font-extrabold">Dokter Tersedia</span></div>
        <div class="flex gap-3.5 overflow-x-auto px-4 pb-1.5">
          ${doctors.map(d => `<a href="#/patient/chat/start/${d.id}" class="shrink-0 w-[150px] bg-white border border-slate-100 rounded-3xl p-4 hover:shadow-md transition">
            <div class="w-[52px] h-[52px] rounded-full bg-tint flex items-center justify-center"><span class="ms text-[26px] text-brand">person</span></div>
            <div class="mt-3 text-[13.5px] font-extrabold">${d.full_name}</div>
            <div class="text-[11px] text-faint font-medium">${d.specialization || '-'}</div>
            <div class="flex items-center gap-1 mt-2">${d.is_available ? `<span class="w-1.5 h-1.5 rounded-full bg-[#1f9d63]"></span><span class="text-[10.5px] font-bold text-[#1f9d63]">Online sekarang</span>` : `<span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span><span class="text-[10.5px] font-bold text-faint">Offline</span>`}</div>
          </a>`).join('')}
        </div>
      </div>
      </main>
    </div>
  </div>
  ${patientBottomNav('home')}`;
}

export function patientHistory() {
  const patient = getPatient();
  const records = store.getRecords(patient?.id);
  const vaccinations = store.getVaccinations(patient?.id);
  window.__patientBookingsInitial = store.getBookingsByPatient(patient?.id);
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024, tab: 'visits',
    patientId: '${patient?.id || ''}',
    bookings: window.__patientBookingsInitial || [],
    statusLabels: { pending:'Menunggu Konfirmasi', confirmed:'Dikonfirmasi', completed:'Selesai', cancelled:'Ditolak' },
    statusColors: { pending:'bg-amber-100 text-amber-700', confirmed:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', cancelled:'bg-red-100 text-red-700' },
    init() {
      if (!this.patientId) return;
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 8000);
    },
    async poll() { this.bookings = await window.__store.fetchBookingsForPatient(this.patientId); },
    async removeBooking(id) {
      if (!confirm('Hapus pendaftaran ini?')) return;
      const result = await window.__store.deleteBooking(id);
      if (result.error) { alert(result.error); return; }
      await this.poll();
    }
  }" class="min-h-screen bg-wash">
    ${patientSidebar('history')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      ${patientHeader(patient)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-6">
      <h2 class="text-xl font-bold text-ink mb-4">Riwayat Kesehatan</h2>
      <div class="flex gap-2 mb-4">
        <button @click="tab='visits'" :class="tab==='visits' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition flex-1">Kunjungan (${records.length})</button>
        <button @click="tab='vaccines'" :class="tab==='vaccines' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition flex-1">Vaksinasi (${vaccinations.length})</button>
        <button @click="tab='bookings'" :class="tab==='bookings' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition flex-1">Pendaftaran (<span x-text="bookings.length"></span>)</button>
      </div>
      <div x-show="tab==='bookings'" x-cloak>
        <template x-if="bookings.length === 0"><div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada pendaftaran layanan</div></template>
        <template x-for="b in bookings" :key="b.id">
          <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-3">
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="font-medium text-gray-800 text-sm" x-text="b.item_name || b.service_name"></p>
                <p class="text-xs text-gray-500 mt-0.5" x-text="'Rp ' + (b.price||0).toLocaleString('id-ID')"></p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <span class="px-2 py-1 rounded-full text-xs font-medium" :class="statusColors[b.status] || 'bg-gray-100 text-gray-600'" x-text="statusLabels[b.status] || b.status"></span>
                <span class="px-2 py-1 rounded-full text-xs font-medium" :class="b.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'" x-text="b.is_paid ? 'Sudah Bayar' : 'Belum Bayar'"></span>
              </div>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span x-text="'Tanggal: ' + (b.preferred_date || '-')"></span>
              <span x-text="'Waktu: ' + (b.preferred_time || '-')"></span>
            </div>
            <template x-if="b.status === 'cancelled'">
              <div class="mt-2 pt-2 border-t border-gray-100 text-right">
                <button @click="removeBooking(b.id)" class="px-3 py-1 rounded-lg text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition">Hapus</button>
              </div>
            </template>
          </div>
        </template>
      </div>
      <div x-show="tab==='visits'">
        ${records.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada riwayat kunjungan</div>' :
        records.map(r => {
          const doctor = store.getDoctor(r.doctor_id);
          const rxCount = store.data.prescriptions.filter(rx => rx.record_id === r.id).length;
          return `<div class="bg-white border border-slate-100 rounded-3xl mb-3 overflow-hidden" x-data="{open:false}">
            <div class="p-4 cursor-pointer" @click="open=!open">
              <div class="flex items-center justify-between"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div><p class="font-medium text-gray-800 text-sm">${formatDate(r.visit_date)}</p><p class="text-xs text-gray-500">${doctor?.full_name || ''}</p></div></div><svg class="w-5 h-5 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></div>
              <div class="flex gap-2 mt-2"><span class="px-2 py-0.5 rounded text-xs bg-teal-50 text-teal-700">${r.diagnosis}</span>${rxCount > 0 ? `<span class="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">${rxCount} resep</span>` : ''}${r.follow_up_date ? `<span class="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">Kontrol ${formatDate(r.follow_up_date)}</span>` : ''}</div>
            </div>
            <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50 text-sm space-y-3">
              <div><h5 class="font-semibold text-gray-700 text-xs uppercase mb-1">Keluhan</h5><p class="text-gray-600 text-sm">${r.anamnesis}</p></div>
              <div><h5 class="font-semibold text-gray-700 text-xs uppercase mb-1">Diagnosis</h5><p class="text-gray-800 font-medium">${r.diagnosis}</p></div>
              <div><h5 class="font-semibold text-gray-700 text-xs uppercase mb-1">Terapi</h5><p class="text-gray-600 text-sm">${r.therapy || '-'}</p></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div x-show="tab==='vaccines'" x-cloak>
        ${vaccinations.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada data vaksinasi</div>' :
        (() => {
          const grouped = {};
          vaccinations.forEach(v => { if (!grouped[v.vaccine_name]) grouped[v.vaccine_name] = []; grouped[v.vaccine_name].push(v); });
          return Object.entries(grouped).map(([name, doses]) => {
            const isBooster = doses[0]?.vax_mode === 'booster';
            const intervalMonths = doses[0]?.booster_interval_months || 12;
            const sortedDoses = [...doses].sort((a,b) => (b.date_given||'').localeCompare(a.date_given||''));
            const latestDose = sortedDoses[0];
            const certBtn = `<button onclick="window.__generateVaxCert('${patient.id}','${name.replace(/'/g,"\\'")}')" class="px-2 py-1 rounded text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Sertifikat</button>`;

            if (isBooster) {
              const intervalLabel = intervalMonths >= 12 ? (intervalMonths/12)+' tahun' : intervalMonths+' bulan';
              return `<div class="bg-white border border-slate-100 rounded-3xl p-4 mb-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2"><h4 class="font-semibold text-gray-800 text-sm">${name}</h4><span class="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">Booster tiap ${intervalLabel}</span></div>
                  ${certBtn}
                </div>
                <!-- Next booster highlight -->
                ${latestDose?.next_dose_date ? `<div class="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 mb-3">
                  <div class="flex items-center justify-between">
                    <div><p class="text-sm font-semibold text-amber-800">Booster Berikutnya</p><p class="text-xs text-amber-600">${formatDate(latestDose.next_dose_date)}</p></div>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${daysUntil(latestDose.next_dose_date) <= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${daysUntil(latestDose.next_dose_date)} hari lagi</span>
                  </div>
                </div>` : ''}
                <p class="text-xs text-gray-500 mb-2 font-medium">Riwayat Pemberian</p>
                <div class="space-y-2">
                  ${sortedDoses.map((d, i) => `<div class="flex items-center gap-3 p-2 rounded-lg bg-green-50">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-green-500 text-white">${sortedDoses.length - i}</div>
                    <div class="flex-1"><p class="text-xs font-medium text-gray-800">${d.vaccine_brand || name}${d.location ? ' — '+d.location : ''}</p><p class="text-xs text-gray-500">${formatDate(d.date_given)}${d.batch_number ? ' | Batch: '+d.batch_number : ''}</p></div>
                    <span class="text-xs text-green-600">Selesai</span>
                  </div>`).join('')}
                </div>
              </div>`;
            }

            // Seri dosis mode
            const totalD = doses[0]?.total_doses || 1;
            const completedCount = doses.filter(d => d.date_given).length;
            const allSchedules = doses.reduce((acc, d) => { if (d.dose_schedule) d.dose_schedule.forEach(s => { if (!doses.find(x => x.dose_number === s.dose && x.date_given)) acc.push(s); }); return acc; }, []);
            const uniqueSchedules = [];
            allSchedules.forEach(s => { if (!uniqueSchedules.find(u => u.dose === s.dose)) uniqueSchedules.push(s); });

            return `<div class="bg-white border border-slate-100 rounded-3xl p-4 mb-3">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2"><h4 class="font-semibold text-gray-800 text-sm">${name}</h4><span class="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-700 font-medium">Seri ${completedCount}/${totalD}</span></div>
                ${certBtn}
              </div>
              <div class="flex gap-1 mb-3">${Array.from({length: totalD}, (_, i) => {
                const done = doses.find(d => d.dose_number === i + 1 && d.date_given);
                return `<div class="flex-1 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-gray-200'}"></div>`;
              }).join('')}</div>
              <div class="space-y-2">
                ${doses.filter(d => d.date_given).sort((a,b) => a.dose_number - b.dose_number).map(d => `<div class="flex items-center gap-3 p-2 rounded-lg bg-green-50">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-green-500 text-white">${d.dose_number}</div>
                  <div class="flex-1"><p class="text-xs font-medium text-gray-800">Dosis ${d.dose_number}/${totalD}${d.vaccine_brand ? ' — '+d.vaccine_brand : ''}</p><p class="text-xs text-gray-500">${formatDate(d.date_given)}${d.batch_number ? ' | Batch: '+d.batch_number : ''}${d.location ? ' | '+d.location : ''}</p></div>
                  <span class="text-xs text-green-600">Selesai</span>
                </div>`).join('')}
                ${uniqueSchedules.sort((a,b) => a.dose - b.dose).map(s => `<div class="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-amber-400 text-white">${s.dose}</div>
                  <div class="flex-1"><p class="text-xs font-medium text-amber-800">Dosis ${s.dose}/${totalD} — Terjadwal</p><p class="text-xs text-amber-600">Jadwal: ${formatDate(s.date)}</p></div>
                  <span class="text-xs text-amber-600 font-medium">${s.date ? daysUntil(s.date)+' hari' : '-'}</span>
                </div>`).join('')}
              </div>
            </div>`;
          }).join('');
        })()}
      </div>
      </main>
    </div>
  </div>
  ${patientBottomNav('history')}`;
}

export function patientPrescriptions() {
  const patient = getPatient();
  const prescriptions = store.getPrescriptionsByPatient(patient?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${patientSidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      ${patientHeader(patient)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-6">
      <h2 class="text-xl font-bold text-ink mb-4">Resep Saya</h2>
      ${prescriptions.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada resep</div>' :
      prescriptions.map(rx => {
        const doctor = store.getDoctor(rx.doctor_id);
        const pharmacy = store.getPharmacy(rx.pharmacy_id);
        const items = store.getPrescriptionItems(rx.id);
        const isDelivery = rx.delivery_method === 'delivery';
        const steps = isDelivery ? ['sent','preparing','delivering','completed'] : ['sent','preparing','ready','completed'];
        const stepLabels = isDelivery ? ['Kirim','Siapkan','Dikirim','Diterima'] : ['Kirim','Siapkan','Siap Diambil','Selesai'];
        const currentIdx = steps.indexOf(rx.status);
        const isActive = !['completed','rejected'].includes(rx.status);
        const waLink = pharmacy?.phone ? 'https://wa.me/62' + pharmacy.phone.replace(/^0/, '').replace(/\D/g, '') : null;
        return `<div class="bg-white border border-slate-100 rounded-3xl mb-3 overflow-hidden" x-data="{open:false}">
          <div class="p-4 cursor-pointer" @click="open=!open">
            <div class="flex items-center justify-between mb-2"><span class="font-semibold text-sm text-gray-800">${rx.rx_number}${isDelivery ? ` <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 align-middle">🚚 Dikirim</span>` : ''}</span><span class="px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-amber-100 text-amber-700' : rx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span></div>
            ${isActive ? `<div class="flex items-center gap-1 mb-1">${steps.map((s, i) => `<div class="flex-1 h-1.5 rounded-full ${i <= currentIdx ? 'bg-teal-500' : 'bg-gray-200'}"></div>`).join('')}</div>
            <div class="flex justify-between text-[10px] text-gray-400 mb-2">${stepLabels.map((label, i) => `<span class="${i <= currentIdx ? 'text-teal-600 font-medium' : ''}">${label}</span>`).join('')}</div>` : ''}
            <p class="text-xs text-gray-500">${doctor?.full_name || ''} | ${pharmacy?.name || ''} | ${formatDate(rx.created_at?.split('T')[0])}</p>
          </div>
          <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50">
            <h5 class="text-xs font-semibold text-gray-600 uppercase mb-2">Daftar Obat</h5>
            ${items.map(i => { const name = i.is_compound ? (i.display_name || i.drug_name) : `${i.drug_name} ${i.dosage}`; return `<div class="flex items-start gap-2 py-1.5 text-sm"><span class="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span><div><p class="text-gray-800 font-medium">${name}</p><p class="text-xs text-gray-500">${i.frequency} ${i.time} — ${i.quantity} ${i.unit}</p></div></div>`; }).join('')}
            ${rx.notes ? `<p class="text-xs text-gray-500 mt-2 italic">Catatan: ${rx.notes}</p>` : ''}
            ${isDelivery && rx.delivery_address ? `<div class="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100"><p class="text-xs font-semibold text-blue-800">🚚 Dikirim ke:</p><p class="text-xs text-blue-900 whitespace-pre-line">${rx.delivery_address}</p></div>` : ''}
            ${rx.status === 'rejected' && rx.reject_reason ? `<div class="mt-2 p-2 rounded-lg bg-red-50 border border-red-100"><p class="text-xs font-semibold text-red-800">Alasan Ditolak:</p><p class="text-xs text-red-900 whitespace-pre-line">${rx.reject_reason}</p></div>` : ''}
            ${waLink ? `<a href="${waLink}" target="_blank" class="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition">💬 Hubungi Apotek (mau titip obat lain?)</a>` : ''}
          </div>
        </div>`;
      }).join('')}
      </main>
    </div>
  </div>
  ${patientBottomNav('prescriptions')}`;
}

export function patientServices() {
  const patient = getPatient();
  const services = store.getServices();
  const categories = ['Semua', ...new Set(services.map(s => s.category))];
  const catColors = { Vaksinasi:'bg-teal-500', Infus:'bg-cyan-500', 'Check-up':'bg-indigo-500', HomeCare:'bg-amber-500', Konsultasi:'bg-pink-500' };
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, cat: 'Semua' }" class="min-h-screen bg-wash">
    ${patientSidebar('services')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      <div class="hidden lg:block">${patientHeader(patient)}</div>
      <div class="lg:hidden bg-gradient-to-b from-[#2b7ee0] to-brand-dark px-5 pt-5 pb-6 rounded-b-[28px]">
        <div class="text-[17px] font-extrabold text-white leading-tight">Layanan Kami</div>
        <div class="text-[11.5px] text-white/70 font-medium">Pilih & booking langsung</div>
        <div class="flex gap-2.5 overflow-x-auto mt-4">
          ${categories.map(c => `<button @click="cat='${c}'" :class="cat==='${c}' ? 'bg-white text-brand-dark' : 'bg-white/[.18] text-white'" class="shrink-0 text-[12.5px] font-bold px-4 py-2 rounded-full transition whitespace-nowrap">${c}</button>`).join('')}
        </div>
      </div>
      <main class="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-6">
      <h2 class="hidden lg:block text-xl font-bold text-ink mb-1">Layanan Kesehatan</h2>
      <p class="hidden lg:block text-sm text-gray-500 mb-4">Pilih kategori dan daftar layanan yang Anda butuhkan</p>
      <div class="hidden lg:flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        ${categories.map(c => `<button @click="cat='${c}'" :class="cat==='${c}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition flex-shrink-0">${c}</button>`).join('')}
      </div>
      <div class="space-y-3">
        ${services.map(s => `
        <template x-if="cat==='Semua' || cat==='${s.category}'">
          <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
            <div class="relative"><img src="${s.image_url}" alt="${s.name}" class="w-full h-32 object-cover"><div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div><div class="absolute bottom-3 left-3"><span class="px-2 py-1 rounded-full text-xs text-white font-medium ${catColors[s.category] || 'bg-gray-500'}">${s.category}</span></div></div>
            <div class="p-4">
              <h4 class="font-semibold text-gray-800">${s.name}</h4>
              <p class="text-xs text-gray-500 mt-1">${s.description}</p>
              ${(s.items && s.items.length > 0) ? `
              <div class="mt-3 space-y-2">
                ${s.items.map((item, idx) => `<a href="#/patient/booking/${s.id}/${idx}" class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition cursor-pointer group">
                  <div><p class="text-sm font-medium text-gray-800 group-hover:text-teal-700">${item.name}</p><p class="text-xs text-gray-400">${item.desc}</p></div>
                  <div class="text-right flex-shrink-0 ml-3"><p class="text-sm font-bold text-teal-600">Rp ${item.price.toLocaleString('id-ID')}</p><span class="text-xs text-teal-500">Daftar &rarr;</span></div>
                </a>`).join('')}
              </div>` : `<a href="#/patient/booking/${s.id}/0" class="mt-3 block w-full py-2.5 rounded-xl text-sm font-medium text-white text-center" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Daftar Layanan — Rp ${(s.price||0).toLocaleString('id-ID')}</a>`}
            </div>
          </div>
        </template>`).join('')}
      </div>
      </main>
    </div>
  </div>
  ${patientBottomNav('services')}`;
}

export function patientBooking(params) {
  const patient = getPatient();
  const service = store.getServices().find(s => s.id === params.serviceId) || store.getAllServices().find(s => s.id === params.serviceId);
  if (!service) return '<div class="min-h-screen flex items-center justify-center text-gray-400">Layanan tidak ditemukan</div>';
  const itemIdx = parseInt(params.itemIdx) || 0;
  const item = (service.items && service.items[itemIdx]) || { name: service.name, price: service.price || 0, desc: service.description };
  const adminWA = CONFIG.CLINIC_WHATSAPP;

  return `
  <div class="min-h-screen bg-wash pb-20" x-data="{
    preferred_date: '', preferred_time: 'Pagi (08:00-12:00)', notes: '',
    submitting: false, submitted: false,
    submit() {
      if (!this.preferred_date) { alert('Pilih tanggal yang diinginkan'); return; }
      if (!'${patient?.id || ''}') { alert('Data profil pasien Anda tidak ditemukan, tidak bisa mendaftar. Coba logout lalu login kembali, atau hubungi admin.'); return; }
      this.submitting = true;
      const self = this;
      setTimeout(function() {
        window.__store.createBooking({
          patient_id: '${patient?.id}', patient_name: '${(patient?.full_name||'').replace(/'/g,"\\'")}',
          service_id: '${service.id}', service_name: '${service.name.replace(/'/g,"\\'")}',
          item_name: '${item.name.replace(/'/g,"\\'")}', price: ${item.price},
          preferred_date: self.preferred_date, preferred_time: self.preferred_time, notes: self.notes
        });
        self.submitting = false; self.submitted = true;
      }, 500);
    },
    waLink() {
      const msg = encodeURIComponent('Halo Klinik Prima, saya ${(patient?.full_name||'').replace(/'/g,"\\'")} ingin mendaftar layanan ${item.name.replace(/'/g,"\\'")} pada tanggal ' + this.preferred_date + ' (' + this.preferred_time + '). Terima kasih.');
      return 'https://wa.me/${adminWA}?text=' + msg;
    }
  }">
    <header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center gap-3">
      <a href="#/patient/services" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[20px] text-muted">arrow_back</span></a>
      <h1 class="font-bold text-ink text-sm">Pendaftaran Layanan</h1>
    </header>
    <main class="p-4 max-w-lg mx-auto">
      <!-- Service info -->
      <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-4">
        <img src="${service.image_url}" alt="${service.name}" class="w-full h-36 object-cover">
        <div class="p-4">
          <span class="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700 font-medium">${service.category}</span>
          <h3 class="font-bold text-gray-800 mt-2">${item.name}</h3>
          <p class="text-xs text-gray-500 mt-1">${item.desc}</p>
          <p class="text-lg font-bold text-teal-600 mt-2">Rp ${item.price.toLocaleString('id-ID')}</p>
        </div>
      </div>
      <!-- Booking form -->
      <div x-show="!submitted" class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
        <h4 class="font-semibold text-gray-800 mb-4">Pilih Jadwal</h4>
        <div class="space-y-3">
          <div><label class="block text-xs text-gray-500 mb-1">Tanggal yang Diinginkan *</label><input type="date" x-model="preferred_date" :min="new Date().toISOString().split('T')[0]" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
          <div><label class="block text-xs text-gray-500 mb-1">Waktu Preferensi</label>
            <div class="grid grid-cols-2 gap-2">
              ${['Pagi (08:00-12:00)','Siang (12:00-15:00)','Sore (15:00-18:00)','Fleksibel'].map(t => `<button type="button" @click="preferred_time='${t}'" :class="preferred_time==='${t}' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200'" class="px-3 py-2 rounded-lg text-xs font-medium border transition">${t.split(' ')[0]}</button>`).join('')}
            </div>
          </div>
          <div><label class="block text-xs text-gray-500 mb-1">Catatan Tambahan</label><textarea x-model="notes" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Opsional: keluhan, permintaan khusus..."></textarea></div>
        </div>
        <button @click="submit()" :disabled="submitting || !preferred_date" class="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!submitting">Daftar Sekarang</span><span x-show="submitting" x-cloak>Memproses...</span></button>
      </div>
      <!-- Success -->
      <div x-show="submitted" x-cloak class="bg-white rounded-xl border border-green-200 shadow-sm p-6 text-center mb-4">
        <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">Pendaftaran Berhasil!</h3>
        <p class="text-sm text-gray-500 mb-4">Tim kami akan segera menghubungi Anda untuk konfirmasi jadwal.</p>
        <div class="bg-gray-50 rounded-lg p-3 mb-4 text-left text-sm">
          <p class="text-gray-600"><span class="font-medium">Layanan:</span> ${item.name}</p>
          <p class="text-gray-600"><span class="font-medium">Tanggal:</span> <span x-text="preferred_date"></span></p>
          <p class="text-gray-600"><span class="font-medium">Waktu:</span> <span x-text="preferred_time"></span></p>
        </div>
        <a :href="waLink()" target="_blank" class="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition mb-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.386 0-4.592-.836-6.318-2.228l-.16-.126-3.342 1.12 1.12-3.342-.138-.174A9.935 9.935 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          Konfirmasi via WhatsApp
        </a>
        <a href="#/patient/services" class="block w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 text-center">Kembali ke Layanan</a>
      </div>
    </main>
    ${patientBottomNav('services')}
  </div>`;
}

export function patientProfile() {
  const patient = getPatient();
  const user = getUser();
  const recordsCount = store.getRecords(patient?.id).length;
  const upcomingCount = store.getUpcomingAppointments(patient?.id).length;
  const adminWA = CONFIG.CLINIC_WHATSAPP;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    editing: false, saving: false, saved: false,
    form: { phone:'${(patient?.phone||'').replace(/'/g,"\\'")}', address:'${(patient?.address||'').replace(/'/g,"\\'")}', emergency_contact:'${(patient?.emergency_contact||'').replace(/'/g,"\\'")}', allergies:'${(patient?.allergies||'').replace(/'/g,"\\'")}' },
    saveProfile() {
      this.saving = true;
      const self = this;
      setTimeout(function() {
        window.__store.updatePatientProfile('${patient?.id}', self.form);
        self.saving = false; self.saved = true; self.editing = false;
        setTimeout(function(){ self.saved = false; }, 2000);
      }, 400);
    }
  }" class="min-h-screen bg-wash">
    ${patientSidebar('profile')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      <div class="hidden lg:block">${patientHeader(patient)}</div>
      <div class="lg:hidden bg-gradient-to-b from-[#2b7ee0] to-brand-dark px-5 pt-5 pb-8 rounded-b-[28px]">
        <div class="flex items-center justify-between">
          <div class="text-[17px] font-extrabold text-white">Profil Saya</div>
          <button @click="editing=true" class="text-[11px] font-bold text-brand-dark bg-white px-3 py-1.5 rounded-full">Edit</button>
        </div>
        <div class="flex items-center gap-3.5 mt-4">
          <div class="w-[62px] h-[62px] rounded-full bg-white/[.18] flex items-center justify-center border-2 border-white/35 text-white font-bold text-lg">${patient?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || 'P'}</div>
          <div class="flex-1"><div class="text-[17px] font-extrabold text-white">${patient?.full_name || '-'}</div><div class="text-xs text-white/75">${user?.email || '-'}</div></div>
        </div>
      </div>
      <main class="p-4 lg:p-6 max-w-7xl mx-auto pb-24 lg:pb-6">
      <div class="lg:hidden -mt-5 mb-4 bg-white border border-slate-100 rounded-3xl p-4 flex shadow-lg shadow-slate-900/5">
        <div class="flex-1 text-center"><div class="text-lg font-extrabold">${recordsCount}</div><div class="text-[10.5px] text-faint font-semibold">Kunjungan</div></div>
        <div class="w-px bg-slate-100"></div>
        <div class="flex-1 text-center"><div class="text-lg font-extrabold text-brand">${upcomingCount}</div><div class="text-[10.5px] text-faint font-semibold">Terjadwal</div></div>
        <div class="w-px bg-slate-100"></div>
        <div class="flex-1 text-center"><div class="text-lg font-extrabold text-[#1f9d63]">${patient?.blood_type || '-'}</div><div class="text-[10.5px] text-faint font-semibold">Gol. darah</div></div>
      </div>
      <div class="lg:hidden mb-4 bg-white border border-slate-100 rounded-3xl overflow-hidden">
        <a href="#/patient/history" class="flex items-center gap-3.5 p-3.5 border-b border-slate-50"><span class="w-9 h-9 rounded-xl bg-tint flex items-center justify-center"><span class="ms text-[20px] text-brand">history</span></span><span class="flex-1 text-[13.5px] font-bold text-[#243b5e]">Riwayat Kunjungan</span><span class="ms text-[20px] text-slate-300">chevron_right</span></a>
        <a href="#/patient/notifications" class="flex items-center gap-3.5 p-3.5 border-b border-slate-50"><span class="w-9 h-9 rounded-xl bg-[#fdeee9] flex items-center justify-center"><span class="ms text-[20px] text-[#e8452c]">notifications_active</span></span><span class="flex-1 text-[13.5px] font-bold text-[#243b5e]">Pengingat & Notifikasi</span><span class="ms text-[20px] text-slate-300">chevron_right</span></a>
        <a href="https://wa.me/${adminWA}" target="_blank" class="flex items-center gap-3.5 p-3.5"><span class="w-9 h-9 rounded-xl bg-[#f4eefb] flex items-center justify-center"><span class="ms text-[20px] text-[#7b52c4]">help</span></span><span class="flex-1 text-[13.5px] font-bold text-[#243b5e]">Bantuan & Kontak</span><span class="ms text-[20px] text-slate-300">chevron_right</span></a>
      </div>
      <div class="hidden lg:block bg-white border border-slate-100 rounded-3xl p-6 mb-4 text-center">
        <div class="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${patient?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || 'P'}</div>
        <h2 class="text-lg font-bold text-gray-800">${patient?.full_name || '-'}</h2>
        <p class="text-sm text-gray-500">${user?.email || '-'}</p>
      </div>
      <div x-show="saved" x-cloak class="mb-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm text-center font-medium">Profil berhasil diperbarui!</div>
      <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-4">
        <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 class="font-semibold text-gray-800 text-sm">Data Pribadi</h3>
          <button @click="editing=!editing" class="text-xs font-medium text-teal-600 hover:text-teal-700 transition" x-text="editing ? 'Batal' : 'Edit Profil'"></button>
        </div>
        <div class="divide-y divide-gray-50">
          <div class="px-4 py-3 flex justify-between"><span class="text-sm text-gray-500">NIK</span><span class="text-sm text-gray-800 font-medium">${patient?.nik || '-'}<span class="ml-1 text-xs text-gray-400">(tidak bisa diubah)</span></span></div>
          <div class="px-4 py-3 flex justify-between"><span class="text-sm text-gray-500">Tanggal Lahir</span><span class="text-sm text-gray-800 font-medium">${formatDate(patient?.birth_date)}</span></div>
          <div class="px-4 py-3 flex justify-between"><span class="text-sm text-gray-500">Jenis Kelamin</span><span class="text-sm text-gray-800 font-medium">${patient?.gender || '-'}</span></div>
          <div class="px-4 py-3 flex justify-between"><span class="text-sm text-gray-500">Golongan Darah</span><span class="text-sm text-gray-800 font-medium">${patient?.blood_type || '-'}</span></div>
          <!-- Editable fields -->
          <div class="px-4 py-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Telepon</span><span x-show="!editing" class="text-sm text-gray-800 font-medium" x-text="form.phone || '-'"></span></div><input x-show="editing" x-cloak type="tel" x-model="form.phone" class="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
          <div class="px-4 py-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Alamat</span><span x-show="!editing" class="text-sm text-gray-800 font-medium text-right max-w-[60%]" x-text="form.address || '-'"></span></div><textarea x-show="editing" x-cloak x-model="form.address" rows="2" class="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
          <div class="px-4 py-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Riwayat Alergi</span><span x-show="!editing" class="text-sm text-gray-800 font-medium" x-text="form.allergies || '-'"></span></div><input x-show="editing" x-cloak type="text" x-model="form.allergies" class="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Dilaporkan oleh pasien"><p x-show="editing" class="text-xs text-amber-600 mt-1">Perubahan alergi akan ditandai sebagai "dilaporkan pasien"</p></div>
          <div class="px-4 py-3"><div class="flex justify-between items-center"><span class="text-sm text-gray-500">Kontak Darurat</span><span x-show="!editing" class="text-sm text-gray-800 font-medium text-right max-w-[60%]" x-text="form.emergency_contact || '-'"></span></div><input x-show="editing" x-cloak type="text" x-model="form.emergency_contact" class="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Nama - No. Telepon"></div>
        </div>
        <div x-show="editing" x-cloak class="p-4 border-t border-gray-100"><button @click="saveProfile()" :disabled="saving" class="w-full py-2.5 rounded-xl text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving">Simpan Perubahan</span><span x-show="saving" x-cloak>Menyimpan...</span></button></div>
      </div>
      <button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition">Keluar dari Akun</button>
      </main>
    </div>
  </div>
  ${patientBottomNav('profile')}`;
}

function patientSidebar(active) {
  const patient = getPatient();
  const unreadChat = patient ? store.getConsultationsForPatient(patient.id).reduce((s, c) => s + (c.unread_count || 0), 0) : 0;
  const items = [
    { id: 'home', label: 'Dashboard', icon: 'home', href: '#/patient/dashboard' },
    { id: 'history', label: 'Riwayat', icon: 'clinical_notes', href: '#/patient/history' },
    { id: 'services', label: 'Layanan', icon: 'medical_services', href: '#/patient/services' },
    { id: 'prescriptions', label: 'Resep', icon: 'medication', href: '#/patient/prescriptions' },
    { id: 'chat', label: 'Chat', icon: 'forum', href: '#/patient/chat', badge: unreadChat },
    { id: 'profile', label: 'Profil', icon: 'person', href: '#/patient/profile' },
  ];
  return `
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-white border-r border-slate-100 z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-100 flex items-center justify-between">
      <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto">
      <button @click="sideOpen=false" class="lg:hidden text-faint hover:text-ink"><span class="ms text-[20px]">close</span></button>
    </div>
    <nav class="p-3 space-y-1 flex-1">${items.map(i => `<a href="${i.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active === i.id ? 'bg-tint text-brand font-bold' : 'text-muted font-semibold hover:bg-slate-50'}"><span class="ms ${active === i.id ? 'ms-fill' : ''} text-[20px] ${active === i.id ? 'text-brand' : 'text-faint'}">${i.icon}</span><span class="flex-1">${i.label}</span>${i.badge ? `<span class="w-5 h-5 rounded-full bg-[#ff5436] text-white text-[10.5px] font-bold flex items-center justify-center">${i.badge}</span>` : ''}</a>`).join('')}</nav>
    <div class="p-3 border-t border-slate-100"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">logout</span>Keluar</button></div>
  </aside>`;
}

function patientHeader(patient, unread = 0) {
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button @click="sideOpen=!sideOpen" class="lg:hidden p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
      <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto lg:hidden">
    </div>
    <a href="#/patient/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span>${unread > 0 ? `<span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#ff5436] border-2 border-white"></span>` : ''}</a>
  </header>`;
}

export function patientBottomNav(active) {
  const patient = getPatient();
  const unreadChat = patient ? store.getConsultationsForPatient(patient.id).reduce((s, c) => s + (c.unread_count || 0), 0) : 0;
  const items = [
    { id: 'home', icon: 'home', href: '#/patient/dashboard' },
    { id: 'services', icon: 'medical_services', href: '#/patient/services' },
    { id: 'fab' },
    { id: 'chat', icon: 'forum', href: '#/patient/chat', badge: unreadChat },
    { id: 'profile', icon: 'person', href: '#/patient/profile' },
  ];
  return `<nav class="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2.5 z-40">
    <div class="flex items-center justify-around bg-ink rounded-[22px] px-2.5 py-3">
      ${items.map(i => i.id === 'fab'
        ? `<a href="#/patient/services" class="w-11 h-11 rounded-full bg-[#ff5436] flex items-center justify-center -mt-6 border-4 border-wash"><span class="ms text-[22px] text-white">add</span></a>`
        : `<a href="${i.href}" class="relative ms ${active === i.id ? 'ms-fill text-white' : 'text-white/50'} text-[24px]">${i.icon}${i.badge ? `<span class="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#ff5436] border-2 border-ink"></span>` : ''}</a>`
      ).join('')}
    </div>
  </nav>`;
}

export function patientChatList() {
  const patient = getPatient();
  const conversations = store.getConsultationsForPatient(patient?.id);
  return chatListPage({ sidebar: patientSidebar('chat'), header: patientHeader(patient), conversations, viewerRole: 'patient', viewerId: patient?.id, threadPathPrefix: '#/patient/chat/' });
}

export function patientChatThread(params) {
  const patient = getPatient();
  const consultation = store.getConsultation(params.conversationId);
  if (!consultation) return '<div class="min-h-screen flex items-center justify-center text-gray-400">Percakapan tidak ditemukan</div>';
  const doctor = store.getDoctor(consultation.doctor_id);
  return chatThreadPage({ sidebar: patientSidebar('chat'), header: patientHeader(patient), consultationId: consultation.id, otherName: doctor?.full_name || 'Dokter', messages: store.getMessages(consultation.id), viewerRole: 'patient', listPath: '#/patient/chat' });
}

export function patientChatStart(params) {
  const patient = getPatient();
  window.__chatStartArgs = { doctorId: params.doctorId, patientId: patient?.id };
  return `<div x-data="{}" x-init="(async () => { const c = await window.__store.getOrCreateConsultation(window.__chatStartArgs.patientId, window.__chatStartArgs.doctorId); window.location.hash = '/patient/chat/' + c.id; })()" class="min-h-screen flex items-center justify-center bg-wash"><p class="text-sm text-faint">Membuka percakapan...</p></div>`;
}
