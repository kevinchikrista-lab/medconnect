import { store } from '../store.js';
import { CONFIG } from '../config.js';

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
  const unread = store.getUnreadCount(user?.id);

  return `
  <div class="min-h-screen bg-gray-50 pb-20">
    ${patientHeader(patient, unread)}
    <main class="p-4 max-w-lg mx-auto">
      <div class="mb-6"><h2 class="text-xl font-bold text-gray-800">Halo, ${patient?.full_name?.split(' ')[0] || 'Pasien'}!</h2><p class="text-sm text-gray-500">Semoga hari Anda sehat.</p></div>
      ${upcoming.length > 0 ? `
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Jadwal Terdekat</h3>
        <div class="space-y-3">
          ${upcoming.slice(0, 3).map(apt => {
            const doctor = store.getDoctor(apt.doctor_id);
            const days = daysUntil(apt.date);
            const typeLabels = { follow_up: 'Kontrol Ulang', vaccination: 'Vaksinasi', visit: 'Kunjungan', telemedicine: 'Telemedicine' };
            const typeIcons = { follow_up: '🔄', vaccination: '💉', visit: '🏥', telemedicine: '📹' };
            return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
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
          const steps = ['sent','received','preparing','ready','completed'];
          const currentIdx = steps.indexOf(rx.status);
          return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
            <div class="flex items-center justify-between mb-3"><span class="font-semibold text-sm text-gray-800">${rx.rx_number}</span><span class="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span></div>
            <div class="flex items-center gap-1 mb-3">${steps.map((s, i) => `<div class="flex-1 h-1.5 rounded-full ${i <= currentIdx ? 'bg-teal-500' : 'bg-gray-200'} transition"></div>`).join('')}</div>
            <div class="flex justify-between text-xs text-gray-400">${steps.map((s, i) => `<span class="${i <= currentIdx ? 'text-teal-600 font-medium' : ''}">${['Kirim','Terima','Siapkan','Ambil','Done'][i]}</span>`).join('')}</div>
            <p class="text-xs text-gray-500 mt-2">${pharmacy?.name || 'Apotek'}</p>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3"><h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Layanan Kesehatan</h3><a href="#/patient/services" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
        <div class="grid grid-cols-2 gap-3">
          ${services.map(s => `<a href="#/patient/services/${s.id}" class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition group">
            <div class="relative"><img src="${s.image_url}" alt="${s.name}" class="w-full h-24 object-cover group-hover:scale-105 transition duration-300"><div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div></div>
            <div class="p-3"><p class="font-medium text-gray-800 text-xs">${s.name}</p><p class="text-xs text-teal-600 font-semibold mt-1">Rp ${s.price.toLocaleString('id-ID')}</p></div>
          </a>`).join('')}
        </div>
      </div>
    </main>
    ${patientBottomNav('home')}
  </div>`;
}

export function patientHistory() {
  const patient = getPatient();
  const records = store.getRecords(patient?.id);
  const vaccinations = store.getVaccinations(patient?.id);
  return `
  <div class="min-h-screen bg-gray-50 pb-20" x-data="{ tab: 'visits' }">
    ${patientHeader(patient)}
    <main class="p-4 max-w-lg mx-auto">
      <h2 class="text-xl font-bold text-gray-800 mb-4">Riwayat Kesehatan</h2>
      <div class="flex gap-2 mb-4">
        <button @click="tab='visits'" :class="tab==='visits' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition flex-1">Kunjungan (${records.length})</button>
        <button @click="tab='vaccines'" :class="tab==='vaccines' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition flex-1">Vaksinasi (${vaccinations.length})</button>
      </div>
      <div x-show="tab==='visits'">
        ${records.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada riwayat kunjungan</div>' :
        records.map(r => {
          const doctor = store.getDoctor(r.doctor_id);
          const rxCount = store.data.prescriptions.filter(rx => rx.record_id === r.id).length;
          return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-3 overflow-hidden" x-data="{open:false}">
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
              return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
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

            return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
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
    ${patientBottomNav('history')}
  </div>`;
}

export function patientPrescriptions() {
  const patient = getPatient();
  const prescriptions = store.getPrescriptionsByPatient(patient?.id);
  return `
  <div class="min-h-screen bg-gray-50 pb-20">
    ${patientHeader(patient)}
    <main class="p-4 max-w-lg mx-auto">
      <h2 class="text-xl font-bold text-gray-800 mb-4">Resep Saya</h2>
      ${prescriptions.length === 0 ? '<div class="bg-white rounded-xl p-8 text-center text-gray-400 text-sm">Belum ada resep</div>' :
      prescriptions.map(rx => {
        const doctor = store.getDoctor(rx.doctor_id);
        const pharmacy = store.getPharmacy(rx.pharmacy_id);
        const items = store.getPrescriptionItems(rx.id);
        const steps = ['sent','received','preparing','ready','completed'];
        const currentIdx = steps.indexOf(rx.status);
        const isActive = !['completed','rejected'].includes(rx.status);
        return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-3 overflow-hidden" x-data="{open:false}">
          <div class="p-4 cursor-pointer" @click="open=!open">
            <div class="flex items-center justify-between mb-2"><span class="font-semibold text-sm text-gray-800">${rx.rx_number}</span><span class="px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-amber-100 text-amber-700' : rx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span></div>
            ${isActive ? `<div class="flex items-center gap-1 mb-2">${steps.map((s, i) => `<div class="flex-1 h-1.5 rounded-full ${i <= currentIdx ? 'bg-teal-500' : 'bg-gray-200'}"></div>`).join('')}</div>` : ''}
            <p class="text-xs text-gray-500">${doctor?.full_name || ''} | ${pharmacy?.name || ''} | ${formatDate(rx.created_at?.split('T')[0])}</p>
          </div>
          <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50">
            <h5 class="text-xs font-semibold text-gray-600 uppercase mb-2">Daftar Obat</h5>
            ${items.map(i => { const name = i.is_compound ? (i.display_name || i.drug_name) : `${i.drug_name} ${i.dosage}`; return `<div class="flex items-start gap-2 py-1.5 text-sm"><span class="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0"></span><div><p class="text-gray-800 font-medium">${name}</p><p class="text-xs text-gray-500">${i.frequency} ${i.time} — ${i.quantity} ${i.unit}</p></div></div>`; }).join('')}
            ${rx.notes ? `<p class="text-xs text-gray-500 mt-2 italic">Catatan: ${rx.notes}</p>` : ''}
          </div>
        </div>`;
      }).join('')}
    </main>
    ${patientBottomNav('prescriptions')}
  </div>`;
}

export function patientServices() {
  const patient = getPatient();
  const services = store.getServices();
  const categories = ['Semua', ...new Set(services.map(s => s.category))];
  const catColors = { Vaksinasi:'bg-teal-500', Infus:'bg-cyan-500', 'Check-up':'bg-indigo-500', HomeCare:'bg-amber-500', Konsultasi:'bg-pink-500' };
  return `
  <div class="min-h-screen bg-gray-50 pb-20" x-data="{ cat: 'Semua' }">
    ${patientHeader(patient)}
    <main class="p-4 max-w-lg mx-auto">
      <h2 class="text-xl font-bold text-gray-800 mb-1">Layanan Kesehatan</h2>
      <p class="text-sm text-gray-500 mb-4">Pilih kategori dan daftar layanan yang Anda butuhkan</p>
      <div class="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        ${categories.map(c => `<button @click="cat='${c}'" :class="cat==='${c}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition flex-shrink-0">${c}</button>`).join('')}
      </div>
      <div class="space-y-3">
        ${services.map(s => `
        <template x-if="cat==='Semua' || cat==='${s.category}'">
          <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
              </div>` : `<a href="#/patient/booking/${s.id}/0" class="mt-3 block w-full py-2.5 rounded-xl text-sm font-medium text-white text-center" style="background:linear-gradient(135deg,#0d9488,#0891b2)">Daftar Layanan — Rp ${(s.price||0).toLocaleString('id-ID')}</a>`}
            </div>
          </div>
        </template>`).join('')}
      </div>
    </main>
    ${patientBottomNav('services')}
  </div>`;
}

export function patientBooking(params) {
  const patient = getPatient();
  const service = store.getServices().find(s => s.id === params.serviceId) || store.getAllServices().find(s => s.id === params.serviceId);
  if (!service) return '<div class="min-h-screen flex items-center justify-center text-gray-400">Layanan tidak ditemukan</div>';
  const itemIdx = parseInt(params.itemIdx) || 0;
  const item = (service.items && service.items[itemIdx]) || { name: service.name, price: service.price || 0, desc: service.description };
  const adminWA = '6281234567890';

  return `
  <div class="min-h-screen bg-gray-50 pb-20" x-data="{
    preferred_date: '', preferred_time: 'Pagi (08:00-12:00)', notes: '',
    submitting: false, submitted: false,
    submit() {
      if (!this.preferred_date) { alert('Pilih tanggal yang diinginkan'); return; }
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
    <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <a href="#/patient/services" class="p-2 rounded-lg hover:bg-gray-100 transition"><svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></a>
      <h1 class="font-bold text-gray-800 text-sm">Pendaftaran Layanan</h1>
    </header>
    <main class="p-4 max-w-lg mx-auto">
      <!-- Service info -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <img src="${service.image_url}" alt="${service.name}" class="w-full h-36 object-cover">
        <div class="p-4">
          <span class="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700 font-medium">${service.category}</span>
          <h3 class="font-bold text-gray-800 mt-2">${item.name}</h3>
          <p class="text-xs text-gray-500 mt-1">${item.desc}</p>
          <p class="text-lg font-bold text-teal-600 mt-2">Rp ${item.price.toLocaleString('id-ID')}</p>
        </div>
      </div>
      <!-- Booking form -->
      <div x-show="!submitted" class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
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
        <button @click="submit()" :disabled="submitting || !preferred_date" class="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style="background:linear-gradient(135deg,#0d9488,#0891b2)"><span x-show="!submitting">Daftar Sekarang</span><span x-show="submitting" x-cloak>Memproses...</span></button>
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
  return `
  <div class="min-h-screen bg-gray-50 pb-20" x-data="{
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
  }">
    ${patientHeader(patient)}
    <main class="p-4 max-w-lg mx-auto">
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4 text-center">
        <div class="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3" style="background:linear-gradient(135deg,#0d9488,#0891b2)">${patient?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2) || 'P'}</div>
        <h2 class="text-lg font-bold text-gray-800">${patient?.full_name || '-'}</h2>
        <p class="text-sm text-gray-500">${user?.email || '-'}</p>
      </div>
      <div x-show="saved" x-cloak class="mb-3 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm text-center font-medium">Profil berhasil diperbarui!</div>
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
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
        <div x-show="editing" x-cloak class="p-4 border-t border-gray-100"><button @click="saveProfile()" :disabled="saving" class="w-full py-2.5 rounded-xl text-sm font-medium text-white" style="background:linear-gradient(135deg,#0d9488,#0891b2)"><span x-show="!saving">Simpan Perubahan</span><span x-show="saving" x-cloak>Menyimpan...</span></button></div>
      </div>
      <button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition">Keluar dari Akun</button>
    </main>
    ${patientBottomNav('profile')}
  </div>`;
}

function patientHeader(patient, unread = 0) {
  return `<header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-8 w-auto"></div>
    <a href="#/patient/notifications" class="relative p-1 hover:bg-gray-100 rounded-lg transition"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>${unread > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">${unread}</span>` : ''}</a>
  </header>`;
}

function patientBottomNav(active) {
  const items = [
    { id: 'home', label: 'Home', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>', href: '#/patient/dashboard' },
    { id: 'history', label: 'Riwayat', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>', href: '#/patient/history' },
    { id: 'prescriptions', label: 'Resep', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>', href: '#/patient/prescriptions' },
    { id: 'profile', label: 'Profil', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>', href: '#/patient/profile' },
  ];
  return `<nav class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-2 py-1 max-w-lg mx-auto">
    <div class="flex justify-around">${items.map(i => `<a href="${i.href}" class="flex flex-col items-center py-2 px-3 rounded-lg transition ${active === i.id ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${i.icon}</svg><span class="text-xs mt-0.5 font-medium">${i.label}</span></a>`).join('')}</div>
  </nav>`;
}
