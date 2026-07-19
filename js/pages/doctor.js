import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { ICD10 } from '../icd10.js';
import { homeCareNewPage, homeCareHistoryPage } from './homecare.js';
import { chatListPage, chatThreadPage } from './chat.js';

function getDoctor() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  return store.getDoctorByUserId(user?.id);
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

export function doctorDashboard() {
  const doc = getDoctor();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = store.getAppointmentsByDoctor(doc?.id, today);
  const allRecords = store.getRecordsByDoctor(doc?.id);
  const todayRecords = allRecords.filter(r => r.visit_date === today);
  const prescriptions = store.getPrescriptionsByDoctor(doc?.id);
  const waiting = todayAppts.filter(a => a.status === 'waiting').length;
  const completed = todayRecords.length;
  const todayPatientIds = new Set([...todayAppts.map(a => a.patient_id), ...todayRecords.map(r => r.patient_id)]);
  const upcoming = store.data.appointments.filter(a => a.doctor_id === doc?.id && a.date > today && a.status === 'scheduled').slice(0, 5);

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${doctorSidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Selamat Datang, ${doc?.full_name || 'Dokter'}</h2>
          <p class="text-gray-500 text-sm">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-brand flex items-center justify-center"><span class="ms text-[22px] text-white">groups</span></div><div><p class="text-2xl font-bold text-ink">${todayPatientIds.size}</p><p class="text-xs text-faint">Pasien Hari Ini</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#e0a112"><span class="ms text-[22px] text-white">schedule</span></div><div><p class="text-2xl font-bold text-ink">${waiting}</p><p class="text-xs text-faint">Antrean Aktif</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#1f9d63"><span class="ms text-[22px] text-white">task_alt</span></div><div><p class="text-2xl font-bold text-ink">${completed}</p><p class="text-xs text-faint">Selesai Hari Ini</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#7b52c4"><span class="ms text-[22px] text-white">prescriptions</span></div><div><p class="text-2xl font-bold text-ink">${prescriptions.length}</p><p class="text-xs text-faint">Resep Terkirim</p></div></div></div>
        </div>
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="bg-white border border-slate-100 rounded-3xl">
            <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">Antrean Pasien Hari Ini</h3><a href="#/doctor/patients" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
            <div class="divide-y divide-gray-50">
              ${todayAppts.length === 0 ? '<p class="p-4 text-gray-400 text-sm text-center">Tidak ada antrean hari ini</p>' : todayAppts.map(apt => {
                const patient = store.getPatient(apt.patient_id);
                const statusColors = { waiting: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700' };
                const statusLabels = { waiting: 'Menunggu', completed: 'Selesai', scheduled: 'Terjadwal' };
                return `<div class="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${apt.queue_number || '-'}</div>
                    <div><p class="font-medium text-gray-800 text-sm">${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500">${apt.time_slot} — ${apt.notes || apt.type}</p></div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[apt.status] || 'bg-gray-100 text-gray-600'}">${statusLabels[apt.status] || apt.status}</span>
                    ${apt.status === 'waiting' ? `<a href="#/doctor/emr/${apt.patient_id}/new" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Mulai</a>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <div class="bg-white border border-slate-100 rounded-3xl">
            <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">Kontrol Ulang Mendatang</h3><a href="#/doctor/calendar" class="text-xs text-teal-600 hover:text-teal-700">Kalender</a></div>
            <div class="divide-y divide-gray-50">
              ${upcoming.length === 0 ? '<p class="p-4 text-gray-400 text-sm text-center">Tidak ada jadwal mendatang</p>' : upcoming.map(apt => {
                const patient = store.getPatient(apt.patient_id);
                return `<div class="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><span class="text-blue-600 text-xs font-bold">${new Date(apt.date).getDate()}<br>${new Date(apt.date).toLocaleDateString('id-ID',{month:'short'})}</span></div>
                    <div><p class="font-medium text-gray-800 text-sm">${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500">${apt.notes || 'Kontrol ulang'}</p></div>
                  </div>
                  <span class="text-xs text-gray-400">${apt.time_slot}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorPatients() {
  const doc = getDoctor();
  const patients = store.getPatients();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '', showNewForm: false, newPatient: { full_name:'',nik:'',birth_date:'',gender:'',phone:'',address:'',blood_type:'',allergies:'',email:'',password:'pasien123' } }" class="min-h-screen bg-wash">
    ${doctorSidebar('patients')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Manajemen Pasien</h2>
          <div class="flex gap-2">
            <div class="relative flex-1"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari nama, NIK, telepon..."></div>
            <button @click="showNewForm = !showNewForm" class="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Pasien Baru</button>
          </div>
        </div>
        <div x-show="showNewForm" x-cloak x-data="{ saving: false, msg: '' }" class="bg-white border border-slate-100 rounded-3xl p-6 mb-6">
          <h3 class="font-semibold text-gray-800 mb-4">Registrasi Pasien Baru</h3>
          <div x-show="msg" class="mb-3 p-2 rounded-lg bg-green-50 text-green-700 text-sm" x-text="msg"></div>
          <form @submit.prevent="async function doReg(){saving=true; const r=await window.__store.register({...newPatient}); if(r.error){msg=r.error}else{msg='Pasien berhasil didaftarkan! (tersimpan di cloud)'; newPatient={full_name:'',nik:'',birth_date:'',gender:'',phone:'',address:'',blood_type:'',allergies:'',email:'',password:'pasien123'}}; saving=false}; doReg()">
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div><label class="block text-xs text-gray-600 mb-1">Nama Lengkap *</label><input type="text" x-model="newPatient.full_name" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">NIK *</label><input type="text" x-model="newPatient.nik" maxlength="16" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Tanggal Lahir</label><input type="date" x-model="newPatient.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label><select x-model="newPatient.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></div>
              <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="newPatient.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Email *</label><input type="email" x-model="newPatient.email" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="newPatient.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Gol. Darah</label><select x-model="newPatient.blood_type" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">-</option><option>A</option><option>B</option><option>AB</option><option>O</option></select></div>
            </div>
            <div class="flex gap-2"><button type="submit" :disabled="saving" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Simpan</button><button type="button" @click="showNewForm=false" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</button></div>
          </form>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">NIK</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Gender</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Telepon</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th></tr></thead>
              <tbody class="divide-y divide-gray-50">
                ${patients.map(p => `
                <template x-if="!search || '${p.full_name.toLowerCase()}'.includes(search.toLowerCase()) || '${p.nik}'.includes(search) || '${p.phone}'.includes(search)">
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${p.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><div><p class="font-medium text-gray-800 text-sm">${p.full_name}</p><p class="text-xs text-gray-400">${p.blood_type ? 'Gol. '+p.blood_type : ''} ${p.allergies && p.allergies !== '-' ? '| Alergi: '+p.allergies : ''}</p></div></div></td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${p.nik}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">${p.gender}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">${p.phone}</td>
                    <td class="px-4 py-3"><div class="flex gap-1"><a href="#/doctor/emr/${p.id}" class="px-2 py-1 rounded text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Rekam Medis</a><a href="#/doctor/emr/${p.id}/new" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">+ Kunjungan</a><a href="#/doctor/chat/start/${p.id}" class="px-2 py-1 rounded text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition">Chat</a></div></td>
                  </tr>
                </template>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorEMR(params) {
  const doc = getDoctor();
  const patient = store.getPatient(params.patientId);
  const records = store.getRecords(params.patientId);
  const vaccinations = store.getVaccinations(params.patientId);
  if (!patient) return `<div class="min-h-screen flex items-center justify-center"><p class="text-gray-500">Pasien tidak ditemukan</p></div>`;

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, activeTab: 'records' }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center gap-2 mb-4 text-sm text-gray-500"><a href="#/doctor/patients" class="hover:text-teal-600 transition">Pasien</a><span>/</span><span class="text-gray-800 font-medium">${patient.full_name}</span></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${patient.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
              <div>
                <h2 class="text-lg font-bold text-gray-800">${patient.full_name}</h2>
                <p class="text-sm text-gray-500">${patient.gender}, ${patient.birth_date ? Math.floor((Date.now()-new Date(patient.birth_date))/(365.25*24*60*60*1000)) + ' thn' : '-'} | NIK: ${patient.nik}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 text-xs">
              <span class="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium">Gol. Darah: ${patient.blood_type || '-'}</span>
              <span class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-medium">Alergi: ${patient.allergies || '-'}</span>
              <span class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium">Telp: ${patient.phone}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mb-4">
          <button @click="activeTab='records'" :class="activeTab==='records' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Rekam Medis (${records.length})</button>
          <button @click="activeTab='vaccinations'" :class="activeTab==='vaccinations' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Vaksinasi (${vaccinations.length})</button>
          <a href="#/doctor/emr/${patient.id}/new" class="px-4 py-2 rounded-lg text-sm font-medium text-white ml-auto" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Kunjungan Baru</a>
        </div>
        <div x-show="activeTab==='records'">
          ${records.length === 0 ? '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Belum ada rekam medis</div>' :
          records.map(r => {
            const doctor = store.getDoctor(r.doctor_id);
            const rxList = store.getPrescriptionsByRecord(r.id);
            return `<div class="bg-white border border-slate-100 rounded-3xl mb-4 overflow-hidden" x-data="{open:false}">
              <div class="p-4 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between" @click="open=!open">
                <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div><p class="font-medium text-gray-800">${formatDate(r.visit_date)}</p><p class="text-sm text-gray-500">${r.diagnosis} — ${doctor?.full_name || ''}</p></div></div>
                <div class="flex items-center gap-2">${r.follow_up_date ? `<span class="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">Kontrol: ${formatDate(r.follow_up_date)}</span>` : ''}<svg class="w-5 h-5 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></div>
              </div>
              <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50">
                <div class="grid lg:grid-cols-2 gap-4 text-sm">
                  <div><h4 class="font-semibold text-gray-700 mb-1">Anamnesis</h4><p class="text-gray-600">${r.anamnesis}</p></div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Pemeriksaan Fisik</h4><p class="text-gray-600">${r.examination || '-'}</p>${r.vital_signs ? `<div class="flex flex-wrap gap-2 mt-2">${Object.entries(r.vital_signs).map(([k,v])=>`<span class="px-2 py-1 rounded bg-white border border-gray-200 text-xs">${k.toUpperCase()}: ${v}</span>`).join('')}</div>` : ''}</div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Diagnosis</h4><p class="text-gray-600 font-medium">${r.diagnosis}</p>${r.diagnosis_secondary ? `<p class="text-gray-500 text-xs mt-1">Sekunder: ${r.diagnosis_secondary}</p>` : ''}</div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Terapi Non-Farmakologis</h4><p class="text-gray-600">${r.therapy || '-'}</p></div>
                </div>
                ${r.follow_up_date ? `<div class="mt-4 pt-4 border-t border-gray-100"><h4 class="font-semibold text-gray-700 mb-1 text-sm">Jadwal Kontrol Ulang</h4><p class="text-sm text-blue-700 font-medium">${formatDate(r.follow_up_date)}</p>${r.follow_up_notes ? `<p class="text-sm text-gray-500 mt-0.5">${r.follow_up_notes}</p>` : ''}</div>` : ''}
                <div class="mt-4 pt-4 border-t border-gray-100">
                  <h4 class="font-semibold text-gray-700 mb-2 text-sm">Terapi Farmakologis (E-Resep)</h4>
                  ${rxList.length === 0 ? '<p class="text-sm text-gray-400">Belum ada e-resep dibuat untuk kunjungan ini</p>' : rxList.map(rx => {
                    const rxPharmacy = store.getPharmacy(rx.pharmacy_id);
                    const rxItems = store.getPrescriptionItems(rx.id);
                    const statusColors = { sent:'bg-blue-100 text-blue-700', preparing:'bg-amber-100 text-amber-700', ready:'bg-green-100 text-green-700', delivering:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700' };
                    return `<div class="bg-white border border-gray-100 rounded-xl p-3 mb-2">
                      <div class="flex items-center justify-between mb-1.5">
                        <span class="text-sm font-medium text-gray-800">${rx.rx_number} — ${rxPharmacy?.name || 'N/A'}</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[rx.status] || 'bg-gray-100'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status] || rx.status}</span>
                      </div>
                      ${rx.status === 'rejected' && rx.reject_reason ? `<p class="text-xs text-red-600 mb-1">Ditolak: ${rx.reject_reason}</p>` : ''}
                      <div class="space-y-1.5">${rxItems.map(i => i.is_compound ? `
                        <div class="rounded-lg border border-purple-200 bg-purple-50/60 p-2">
                          <p class="text-xs font-semibold text-purple-700 mb-1">${i.display_name || i.drug_name} (Racikan)</p>
                          <p class="text-xs text-gray-700 whitespace-pre-line leading-relaxed">${(i.compound_details || '-').trim()}</p>
                          <p class="text-xs text-gray-500 mt-1">${i.frequency||''} ${i.time||''} (${i.quantity||'-'} ${i.unit||''})</p>
                        </div>` : `<p class="text-xs text-gray-600">• ${i.drug_name} ${i.dosage||''} — ${i.frequency||''} ${i.time||''} (${i.quantity||'-'} ${i.unit||''})</p>`).join('')}</div>
                    </div>`;
                  }).join('')}
                </div>
                <div class="flex gap-2 mt-4"><a href="#/doctor/emr/edit/${r.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit Rekam Medis</a><a href="#/doctor/prescriptions/new/${r.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 transition">Buat E-Resep</a></div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div x-show="activeTab==='vaccinations'" x-cloak>
          ${vaccinations.length === 0 ? '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Belum ada data vaksinasi</div>' :
          (() => {
            const grouped = {};
            vaccinations.forEach(v => { if (!grouped[v.vaccine_name]) grouped[v.vaccine_name] = []; grouped[v.vaccine_name].push(v); });
            return Object.entries(grouped).map(([name, doses]) => `
              <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
                <div class="flex items-center justify-between mb-3"><h4 class="font-semibold text-gray-800">${name}${doses[0]?.vaccine_brand ? ' ('+doses[0].vaccine_brand+')' : ''}</h4><span class="text-xs text-gray-400">${doses[0]?.vax_mode === 'booster' ? 'Booster' : 'Seri '+doses.filter(d=>d.date_given).length+'/'+doses[0]?.total_doses}</span></div>
                <div class="space-y-3">
                  ${doses.map(d => `<div class="flex items-center gap-3 p-3 rounded-lg ${d.date_given ? 'bg-green-50' : 'bg-gray-50'}" x-data="{editing:false}">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${d.date_given ? 'bg-green-500' : 'bg-gray-300'} text-white text-xs font-bold">${d.dose_number}</div>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800">Dosis ${d.dose_number}/${d.total_doses} ${d.date_given ? '— Selesai' : '— Terjadwal'}${d.vaccine_brand ? ' | '+d.vaccine_brand : ''}</p>
                      <p class="text-xs text-gray-500">${d.date_given ? formatDate(d.date_given) + (d.batch_number ? ' | Batch: '+d.batch_number : '') + (d.location ? ' | '+d.location : '') : 'Jadwal: ' + formatDate(d.next_dose_date)}</p>
                    </div>
                    <div class="flex gap-1">
                      <button @click="editing=!editing" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit</button>
                      <button onclick="if(confirm('Hapus data vaksinasi dosis ini?')){window.__store.deleteVaccination('${d.id}'); window.location.hash='/doctor/dashboard'; setTimeout(()=>window.location.hash='/doctor/emr/${params.patientId}',50)}" class="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
                    </div>
                    <div x-show="editing" x-cloak class="absolute right-0 mt-2 z-10"></div>
                  </div>
                  <template x-if="editing"><div class="ml-11 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm" x-data="{
                    ef: { dose_number: ${d.dose_number}, total_doses: ${d.total_doses}, vaccine_brand:'${(d.vaccine_brand||'').replace(/'/g,"\\'")}', batch_number:'${(d.batch_number||'').replace(/'/g,"\\'")}', location:'${(d.location||'').replace(/'/g,"\\'")}', date_given:'${d.date_given||''}', next_dose_date:'${d.next_dose_date||''}' },
                    saveVax() { window.__store.updateVaccination('${d.id}', this.ef); window.location.hash='/doctor/dashboard'; setTimeout(()=>window.location.hash='/doctor/emr/${params.patientId}',50); }
                  }">
                    <p class="text-xs font-semibold text-blue-700 mb-2">Edit Vaksinasi</p>
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      <div><label class="block text-xs text-gray-500 mb-1">Dosis Ke-</label><input type="number" x-model="ef.dose_number" min="1" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Total Dosis</label><input type="number" x-model="ef.total_doses" min="1" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Merk</label><input type="text" x-model="ef.vaccine_brand" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Batch</label><input type="text" x-model="ef.batch_number" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Tanggal</label><input type="date" x-model="ef.date_given" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Jadwal Berikut</label><input type="date" x-model="ef.next_dose_date" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div><label class="block text-xs text-gray-500 mb-1">Lokasi</label><input type="text" x-model="ef.location" class="w-full px-2 py-1.5 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"></div>
                      <div class="flex items-end"><button @click="saveVax()" class="px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition w-full">Simpan</button></div>
                    </div>
                  </div></template>
                  `).join('')}
                  ${(() => {
                    const lastDose = doses[doses.length-1];
                    const totalD = doses[0]?.total_doses || 1;
                    const isBooster = doses[0]?.vax_mode === 'booster';
                    const nextDoseNum = lastDose.dose_number + 1;
                    const hasNext = isBooster ? !!lastDose.next_dose_date : (lastDose.dose_number < totalD);
                    if (!hasNext) return '';

                    const scheduledDate = lastDose.next_dose_date || '';
                    const brand = lastDose.vaccine_brand || '';
                    const loc = lastDose.location || 'Klinik Utama Prima';
                    const boosterInterval = doses[0]?.booster_interval_months || 12;
                    const label = isBooster ? 'Berikan Booster' : `Berikan Dosis ${nextDoseNum}/${totalD}`;
                    const locations = (CONFIG.LOCATIONS || ['Klinik Utama Prima','Home Care','Telemedicine']);

                    return `<div class="p-3 rounded-lg bg-amber-50 border border-amber-200" x-data="{showForm:false}">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center bg-amber-400 text-white text-xs font-bold">${isBooster ? '→' : nextDoseNum}</div>
                        <div class="flex-1">
                          <p class="text-sm font-medium text-amber-800">${isBooster ? 'Booster Berikutnya' : 'Dosis '+nextDoseNum+'/'+totalD+' — Terjadwal'}</p>
                          <p class="text-xs text-amber-600">Jadwal: ${formatDate(scheduledDate)}</p>
                        </div>
                        <button @click="showForm=!showForm" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition">${label}</button>
                      </div>
                      <template x-if="showForm">
                        <div class="mt-3 p-4 rounded-lg bg-white border border-amber-200" x-data="{
                          af: {
                            vaccine_name: '${name.replace(/'/g,"\\'")}',
                            vaccine_brand: '${brand.replace(/'/g,"\\'")}',
                            vax_mode: '${isBooster ? 'booster' : 'series'}',
                            dose_number: ${isBooster ? lastDose.dose_number + 1 : nextDoseNum},
                            total_doses: ${totalD},
                            batch_number: '',
                            date_given: new Date().toISOString().split('T')[0],
                            next_dose_date: '',
                            location: '${loc.replace(/'/g,"\\'")}',
                            ${isBooster ? 'booster_interval_months: '+boosterInterval+',' : ''}
                            notes: ''
                          },
                          saving: false,
                          saveDose() {
                            this.saving = true;
                            const self = this;
                            ${isBooster ? `
                            const given = new Date(self.af.date_given);
                            const next = new Date(given);
                            next.setMonth(next.getMonth() + ${boosterInterval});
                            self.af.next_dose_date = next.toISOString().split('T')[0];
                            ` : ''}
                            setTimeout(function() {
                              window.__store.createVaccination({
                                patient_id: '${params.patientId}',
                                administered_by: '${getDoctor()?.id}',
                                ...self.af
                              });
                              window.__store.createRecord({
                                patient_id: '${params.patientId}',
                                doctor_id: '${getDoctor()?.id}',
                                visit_type: 'vaccination',
                                location: self.af.location,
                                anamnesis: 'Vaksinasi ' + self.af.vaccine_name + ' ' + self.af.vaccine_brand + ' Dosis ' + self.af.dose_number,
                                diagnosis: 'Vaksinasi ' + self.af.vaccine_name,
                                therapy: 'Pemberian vaksin ' + self.af.vaccine_brand + ' dosis ' + self.af.dose_number + ${isBooster ? "''" : "'/' + self.af.total_doses"},
                                vital_signs: {},
                                follow_up_date: self.af.next_dose_date,
                                follow_up_notes: '${isBooster ? 'Booster berikutnya' : 'Vaksin dosis berikutnya'}',
                                notes: 'Batch: ' + self.af.batch_number
                              });
                              self.saving = false;
                              window.location.hash='/doctor/dashboard';
                              setTimeout(function(){ window.location.hash='/doctor/emr/${params.patientId}'; },50);
                            }, 400);
                          }
                        }">
                          <p class="text-sm font-semibold text-amber-800 mb-3">💉 ${label}</p>
                          <div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            <div><label class="block text-xs text-gray-500 mb-1">Vaksin</label><input type="text" x-model="af.vaccine_name" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50" readonly></div>
                            <div><label class="block text-xs text-gray-500 mb-1">Merk</label><input type="text" x-model="af.vaccine_brand" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div>
                            <div><label class="block text-xs text-gray-500 mb-1">Tanggal Pemberian *</label><input type="date" x-model="af.date_given" class="w-full px-2 py-1.5 border border-amber-300 rounded text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div>
                            <div><label class="block text-xs text-gray-500 mb-1">Batch Number *</label><input type="text" x-model="af.batch_number" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" placeholder="Batch no."></div>
                            <div><label class="block text-xs text-gray-500 mb-1">Lokasi</label><select x-model="af.location" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50">${locations.map(l=>`<option>${l}</option>`).join('')}</select></div>
                            ${!isBooster ? `<div><label class="block text-xs text-gray-500 mb-1">Jadwal Dosis Berikut</label><input type="date" x-model="af.next_dose_date" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"></div>` : ''}
                            <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">Catatan KIPI</label><input type="text" x-model="af.notes" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" placeholder="Opsional"></div>
                          </div>
                          <div class="flex gap-2 mt-3">
                            <button @click="saveDose()" :disabled="saving || !af.batch_number" class="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 bg-amber-500 hover:bg-amber-600 transition"><span x-show="!saving">Simpan & Catat Vaksinasi</span><span x-show="saving" x-cloak>Menyimpan...</span></button>
                            <button @click="showForm=false" class="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 border border-gray-200">Batal</button>
                          </div>
                        </div>
                      </template>
                    </div>`;
                  })()}
                </div>
              </div>`).join('');
          })()}
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorEMRNew(params) {
  const doc = getDoctor();
  const patient = store.getPatient(params.patientId);
  if (!patient) return '<div class="p-8 text-center text-gray-500">Pasien tidak ditemukan</div>';
  const locations = CONFIG.LOCATIONS || ['Klinik Utama Prima','Home Care','Telemedicine'];
  window.__icd10 = ICD10;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    visitType: 'consultation',
    visitDate: '${new Date().toISOString().split('T')[0]}',
    form: { anamnesis:'', examination:'', diagnosis:'', diagnosis_secondary:'', therapy:'', follow_up_date:'', follow_up_notes:'', vital_signs: {td:'',nadi:'',suhu:'',rr:'',spo2:'',bb:'',tb:''}, notes:'', location:'${locations[0]}', visit_type:'consultation' },
    icdSearch: '', icdResults: [], icdOpen: false, icdSearch2: '', icdResults2: [], icdOpen2: false,
    searchICD(q, which) {
      if (!q || q.length < 2) { if(which===2){this.icdResults2=[];this.icdOpen2=false}else{this.icdResults=[];this.icdOpen=false}; return; }
      const s = q.toLowerCase();
      const results = (window.__icd10||[]).filter(d => d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s) || d.name_id.toLowerCase().includes(s)).slice(0, 8);
      if(which===2){this.icdResults2=results;this.icdOpen2=results.length>0}else{this.icdResults=results;this.icdOpen=results.length>0};
    },
    selectICD(item, which) {
      const val = item.code + ' - ' + item.name_id;
      if(which===2){this.form.diagnosis_secondary=val;this.icdSearch2=val;this.icdOpen2=false}else{this.form.diagnosis=val;this.icdSearch=val;this.icdOpen=false};
    },
    vaxForm: { vaccine_name:'', vaccine_brand:'', vax_mode:'series', dose_number:1, total_doses:1, batch_number:'', dose_schedule:[], booster_interval_months:12, next_dose_date:'', location:'${locations[0]}', notes:'' },
    saving: false, saved: false,
    updateDoseSchedule() {
      const currentDose = parseInt(this.vaxForm.dose_number) || 1;
      const totalDoses = parseInt(this.vaxForm.total_doses) || 1;
      if (this.vaxForm.vax_mode === 'series' && totalDoses > 1) {
        const existing = this.vaxForm.dose_schedule || [];
        const newSchedule = [];
        for (let i = currentDose + 1; i <= totalDoses; i++) {
          const prev = existing.find(s => s.dose === i);
          newSchedule.push({ dose: i, date: prev ? prev.date : '' });
        }
        this.vaxForm.dose_schedule = newSchedule;
        this.vaxForm.next_dose_date = newSchedule.length > 0 ? newSchedule[0].date : '';
      } else {
        this.vaxForm.dose_schedule = [];
      }
    },
    saveRecord() {
      this.saving = true;
      const self = this;
      setTimeout(function() {
        self.form.visit_type = self.visitType;
        var result = null;
        if (self.visitType === 'consultation' || self.visitType === 'both') {
          result = window.__store.createRecord({patient_id:'${patient.id}', doctor_id:'${doc?.id}', ...self.form, visit_date: self.visitDate});
        }
        if (self.visitType === 'vaccination' || self.visitType === 'both') {
          const vd = {...self.vaxForm};
          if (vd.vax_mode === 'booster') {
            const given = new Date(self.visitDate);
            const next = new Date(given);
            next.setMonth(next.getMonth() + parseInt(vd.booster_interval_months));
            vd.next_dose_date = next.toISOString().split('T')[0];
            vd.total_doses = 1;
          } else {
            vd.next_dose_date = vd.dose_schedule && vd.dose_schedule.length > 0 ? vd.dose_schedule[0].date : '';
          }
          window.__store.createVaccination({patient_id:'${patient.id}', administered_by:'${doc?.id}', date_given: self.visitDate, ...vd});
          if (self.visitType === 'vaccination') {
            const followDate = vd.next_dose_date || '';
            const modeLabel = vd.vax_mode === 'booster' ? ' (Booster tiap '+vd.booster_interval_months+' bulan)' : ' Dosis '+vd.dose_number+'/'+vd.total_doses;
            window.__store.createRecord({patient_id:'${patient.id}', doctor_id:'${doc?.id}', visit_type:'vaccination', visit_date: self.visitDate, location:vd.location, anamnesis:'Vaksinasi '+vd.vaccine_name+' '+vd.vaccine_brand+modeLabel, diagnosis:'Vaksinasi '+vd.vaccine_name, therapy:'Pemberian vaksin '+vd.vaccine_brand+modeLabel, vital_signs:self.form.vital_signs, follow_up_date:followDate, follow_up_notes:vd.vax_mode==='booster'?'Booster berikutnya':'Vaksin dosis berikutnya', notes:'Batch: '+vd.batch_number });
          }
        }
        self.saving = false; self.saved = true; self.savedRecordId = (result && result.id) ? result.id : null;
      }, 400);
    },
    savedRecordId: null
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2 text-sm text-gray-500"><a href="#/doctor/emr/${patient.id}" class="hover:text-teal-600 transition">${patient.full_name}</a><span>/</span><span class="text-gray-800 font-medium">Kunjungan Baru</span></div>
          <div class="flex gap-2">
            <button @click="saveRecord()" :disabled="saving || saved || (visitType!=='vaccination' && (!form.anamnesis || !form.diagnosis)) || ((visitType==='vaccination'||visitType==='both') && !vaxForm.vaccine_name)" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving && !saved">Simpan Rekam Medis</span><span x-show="saving" x-cloak>Menyimpan...</span><span x-show="saved" x-cloak>Tersimpan!</span></button>
            <a href="#/doctor/emr/${patient.id}" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</a>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="flex items-center gap-4"><div class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${patient.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><div><h3 class="font-bold text-gray-800">${patient.full_name}</h3><p class="text-sm text-gray-500">${patient.gender}, ${patient.birth_date ? Math.floor((Date.now()-new Date(patient.birth_date))/(365.25*24*60*60*1000))+' thn' : '-'} | Gol. ${patient.blood_type || '-'} | Alergi: ${patient.allergies || '-'}</p></div></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <h4 class="font-semibold text-gray-800 mb-3">Tipe Kunjungan & Lokasi</h4>
          <div class="grid sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Tipe Kunjungan *</label>
              <div class="flex gap-2">
                <button @click="visitType='consultation'" :class="visitType==='consultation' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'" class="px-3 py-2 rounded-lg text-xs font-medium transition">Konsultasi</button>
                <button @click="visitType='vaccination'" :class="visitType==='vaccination' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'" class="px-3 py-2 rounded-lg text-xs font-medium transition">Vaksinasi</button>
                <button @click="visitType='both'" :class="visitType==='both' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'" class="px-3 py-2 rounded-lg text-xs font-medium transition">Keduanya</button>
              </div>
              <p class="text-xs text-gray-400 mt-1" x-show="visitType==='both'">Akan membuat 2 rekam medis terpisah (konsultasi + vaksinasi) di waktu yang sama.</p>
            </div>
            <div><label class="block text-xs text-gray-500 mb-1">Tanggal Kunjungan *</label><input type="date" x-model="visitDate" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            <div><label class="block text-xs text-gray-500 mb-1">Lokasi / Tempat *</label><select x-model="form.location" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${locations.map(l=>`<option>${l}</option>`).join('')}<option>Lainnya</option></select></div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg> Vital Signs</h4>
            <div class="grid grid-cols-3 lg:grid-cols-7 gap-3">
              <div><label class="block text-xs text-gray-500 mb-1">TD (mmHg)</label><input type="text" x-model="form.vital_signs.td" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="120/80"></div>
              <div><label class="block text-xs text-gray-500 mb-1">Nadi (x/m)</label><input type="number" x-model="form.vital_signs.nadi" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="80"></div>
              <div><label class="block text-xs text-gray-500 mb-1">Suhu (C)</label><input type="number" step="0.1" x-model="form.vital_signs.suhu" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="36.5"></div>
              <div><label class="block text-xs text-gray-500 mb-1">RR (x/m)</label><input type="number" x-model="form.vital_signs.rr" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="18"></div>
              <div><label class="block text-xs text-gray-500 mb-1">SpO2 (%)</label><input type="number" x-model="form.vital_signs.spo2" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="98"></div>
              <div><label class="block text-xs text-gray-500 mb-1">BB (kg)</label><input type="number" x-model="form.vital_signs.bb" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="70"></div>
              <div><label class="block text-xs text-gray-500 mb-1">TB (cm)</label><input type="number" x-model="form.vital_signs.tb" class="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="170"></div>
            </div>
          </div>
          <!-- KONSULTASI SECTION -->
          <template x-if="visitType==='consultation' || visitType==='both'">
            <div class="space-y-4">
              <div class="bg-white border border-slate-100 rounded-3xl p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Anamnesis *</h4>
                <textarea x-model="form.anamnesis" rows="4" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Keluhan utama, riwayat penyakit sekarang, riwayat penyakit dahulu..."></textarea>
              </div>
              <div class="grid lg:grid-cols-2 gap-4">
                <div class="bg-white border border-slate-100 rounded-3xl p-4">
                  <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2"><svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Diagnosis Utama (ICD-10) *</h4>
                  <div class="relative">
                    <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" x-model="icdSearch" @input="searchICD(icdSearch,1)" @focus="searchICD(icdSearch,1)" @click.away="icdOpen=false" class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari kode ICD-10 atau nama penyakit..."></div>
                    <div x-show="icdOpen" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      <template x-for="item in icdResults" :key="item.code">
                        <button type="button" @mousedown.prevent="selectICD(item,1)" class="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition border-b border-gray-50">
                          <div class="flex items-center gap-2"><span class="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-xs font-mono font-bold flex-shrink-0" x-text="item.code"></span><span class="text-sm text-gray-800 font-medium" x-text="item.name_id"></span></div>
                          <p class="text-xs text-gray-400 mt-0.5 pl-10" x-text="item.name"></p>
                        </button>
                      </template>
                    </div>
                  </div>
                  <div x-show="form.diagnosis" x-cloak class="mt-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-center gap-2">
                    <svg class="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span x-text="form.diagnosis" class="font-medium"></span>
                    <button type="button" @click="form.diagnosis='';icdSearch=''" class="ml-auto text-teal-400 hover:text-teal-700"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                  </div>
                  <label class="block text-xs text-gray-500 mt-3 mb-1">Diagnosis Sekunder (ICD-10)</label>
                  <div class="relative">
                    <input type="text" x-model="icdSearch2" @input="searchICD(icdSearch2,2)" @focus="searchICD(icdSearch2,2)" @click.away="icdOpen2=false" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional — cari ICD-10...">
                    <div x-show="icdOpen2" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      <template x-for="item in icdResults2" :key="item.code">
                        <button type="button" @mousedown.prevent="selectICD(item,2)" class="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition border-b border-gray-50">
                          <div class="flex items-center gap-2"><span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono font-bold flex-shrink-0" x-text="item.code"></span><span class="text-sm text-gray-800" x-text="item.name_id"></span></div>
                        </button>
                      </template>
                    </div>
                  </div>
                  <div x-show="form.diagnosis_secondary" x-cloak class="mt-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
                    <span x-text="form.diagnosis_secondary"></span>
                    <button type="button" @click="form.diagnosis_secondary='';icdSearch2=''" class="ml-auto text-blue-400 hover:text-blue-700"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                  </div>
                </div>
                <div class="bg-white border border-slate-100 rounded-3xl p-4">
                  <h4 class="font-semibold text-gray-800 mb-3">Terapi Non-Farmakologis</h4>
                  <textarea x-model="form.therapy" rows="4" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Rencana terapi, tindakan, edukasi pasien..."></textarea>
                </div>
              </div>
              <div class="bg-white border border-slate-100 rounded-3xl p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Jadwal Kontrol Ulang</h4>
                <div class="grid sm:grid-cols-2 gap-3">
                  <div><label class="block text-xs text-gray-500 mb-1">Tanggal Kontrol</label><input type="date" x-model="form.follow_up_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-500 mb-1">Catatan</label><input type="text" x-model="form.follow_up_notes" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Tujuan kontrol ulang"></div>
                </div>
              </div>
            </div>
          </template>
          <!-- VAKSINASI SECTION -->
          <template x-if="visitType==='vaccination' || visitType==='both'">
            <div class="bg-white rounded-xl border-2 border-purple-200 shadow-sm p-4">
              <h4 class="font-semibold text-purple-800 mb-4 flex items-center gap-2"><span class="text-lg">💉</span> Data Vaksinasi</h4>
              <!-- Mode Selection -->
              <div class="mb-4 p-3 rounded-lg bg-purple-50 border border-purple-100">
                <label class="block text-xs text-purple-700 font-semibold mb-2">Tipe Vaksinasi</label>
                <div class="flex gap-2">
                  <button type="button" @click="vaxForm.vax_mode='series'; updateDoseSchedule()" :class="vaxForm.vax_mode==='series' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-200'" class="px-4 py-2 rounded-lg text-xs font-medium transition">
                    Seri Dosis <span class="opacity-70">(HPV, HepB, MR)</span>
                  </button>
                  <button type="button" @click="vaxForm.vax_mode='booster'" :class="vaxForm.vax_mode==='booster' ? 'bg-purple-600 text-white' : 'bg-white text-purple-700 border border-purple-200'" class="px-4 py-2 rounded-lg text-xs font-medium transition">
                    Booster Berkala <span class="opacity-70">(Influenza, Typhoid)</span>
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div><label class="block text-xs text-gray-500 mb-1">Nama Vaksin *</label><input type="text" x-model="vaxForm.vaccine_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="HPV, Influenza, Hepatitis B..."></div>
                <div><label class="block text-xs text-gray-500 mb-1">Merk Vaksin *</label><input type="text" x-model="vaxForm.vaccine_brand" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Gardasil 9, Influvac..."></div>
                <div><label class="block text-xs text-gray-500 mb-1">Batch Number *</label><input type="text" x-model="vaxForm.batch_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="GRD9-2026-XX"></div>
                <!-- Seri Dosis Fields -->
                <template x-if="vaxForm.vax_mode==='series'">
                  <div><label class="block text-xs text-gray-500 mb-1">Dosis Ke- *</label><input type="number" x-model="vaxForm.dose_number" min="1" @change="updateDoseSchedule()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                </template>
                <template x-if="vaxForm.vax_mode==='series'">
                  <div><label class="block text-xs text-gray-500 mb-1">Total Dosis *</label><input type="number" x-model="vaxForm.total_doses" min="1" max="10" @change="updateDoseSchedule()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                </template>
                <!-- Booster Fields -->
                <template x-if="vaxForm.vax_mode==='booster'">
                  <div><label class="block text-xs text-gray-500 mb-1">Interval Booster *</label>
                    <select x-model="vaxForm.booster_interval_months" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                      <option value="6">Setiap 6 bulan</option>
                      <option value="12">Setiap 1 tahun</option>
                      <option value="24">Setiap 2 tahun</option>
                      <option value="36">Setiap 3 tahun</option>
                      <option value="60">Setiap 5 tahun</option>
                      <option value="120">Setiap 10 tahun</option>
                    </select>
                  </div>
                </template>
                <div><label class="block text-xs text-gray-500 mb-1">Lokasi Vaksinasi</label><select x-model="vaxForm.location" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">${locations.map(l=>`<option>${l}</option>`).join('')}</select></div>
                <div class="col-span-2"><label class="block text-xs text-gray-500 mb-1">Catatan KIPI / Lainnya</label><input type="text" x-model="vaxForm.notes" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Reaksi pasca vaksinasi, dll"></div>
              </div>
              <!-- Dynamic Dose Schedule (Seri Dosis) -->
              <template x-if="vaxForm.vax_mode==='series' && vaxForm.dose_schedule.length > 0">
                <div class="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <label class="block text-xs text-blue-700 font-semibold mb-2">Jadwal Dosis Berikutnya</label>
                  <div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    <template x-for="(sched, si) in vaxForm.dose_schedule" :key="si">
                      <div>
                        <label class="block text-xs text-blue-600 mb-1" x-text="'Dosis ke-'+sched.dose+' *'"></label>
                        <input type="date" x-model="sched.date" class="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50">
                      </div>
                    </template>
                  </div>
                </div>
              </template>
              <!-- Booster Info -->
              <template x-if="vaxForm.vax_mode==='booster'">
                <div class="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p class="text-xs text-amber-700"><span class="font-semibold">Info:</span> Sistem akan otomatis membuat pengingat booster berikutnya setiap <span x-text="vaxForm.booster_interval_months"></span> bulan. Pengingat ini akan terus muncul di jadwal pasien secara berulang.</p>
                </div>
              </template>
            </div>
          </template>
        </div>
        <!-- Success overlay -->
        <div x-show="saved" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
            <h3 class="text-lg font-bold text-gray-800 mb-2">Rekam Medis Tersimpan!</h3>
            <p class="text-sm text-gray-500 mb-6">Apakah Anda ingin membuat e-resep untuk kunjungan ini?</p>
            <div class="flex gap-2">
              <a :href="savedRecordId ? '#/doctor/prescriptions/new/'+savedRecordId : '#/doctor/emr/${patient.id}'" class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white text-center" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Ya, Buat E-Resep</a>
              <a href="#/doctor/emr/${patient.id}" class="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 text-center">Nanti Saja</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorRecords() {
  const doc = getDoctor();
  const allRecords = store.getRecordsByDoctor(doc?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '' }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Rekam Medis Terbaru</h2>
          <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari pasien atau diagnosis..."></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="divide-y divide-gray-50">
            ${allRecords.length === 0 ? '<p class="p-8 text-center text-gray-400">Belum ada rekam medis</p>' :
            allRecords.map(r => {
              const patient = store.getPatient(r.patient_id);
              const pName = patient?.full_name || 'N/A';
              const searchStr = (pName + ' ' + (r.diagnosis||'')).toLowerCase();
              return `<template x-if="!search || '${searchStr}'.includes(search.toLowerCase())">
                <div class="p-4 hover:bg-gray-50 transition">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg ${r.visit_type === 'vaccination' ? 'bg-purple-50' : 'bg-teal-50'} flex items-center justify-center"><span class="text-lg">${r.visit_type === 'vaccination' ? '💉' : '🏥'}</span></div>
                      <div>
                        <p class="font-medium text-gray-800 text-sm">${pName}</p>
                        <p class="text-xs text-gray-500">${formatDate(r.visit_date)} — ${r.diagnosis || 'N/A'}${r.location ? ' — '+r.location : ''}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      ${r.follow_up_date ? `<span class="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">Kontrol: ${formatDate(r.follow_up_date)}</span>` : ''}
                      <a href="#/doctor/emr/${r.patient_id}" class="px-2 py-1 rounded text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Lihat EMR</a>
                    </div>
                  </div>
                </div>
              </template>`;
            }).join('')}
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorPrescriptions() {
  const doc = getDoctor();
  const prescriptions = store.getPrescriptionsByDoctor(doc?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${doctorSidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-6">Riwayat E-Resep</h2>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          ${prescriptions.length === 0 ? '<p class="p-8 text-center text-gray-400">Belum ada resep</p>' : `
          <div class="divide-y divide-gray-50">${prescriptions.map(rx => {
            const patient = store.getPatient(rx.patient_id);
            const pharmacy = store.getPharmacy(rx.pharmacy_id);
            const items = store.getPrescriptionItems(rx.id);
            const statusColors = { sent:'bg-blue-100 text-blue-700', received:'bg-indigo-100 text-indigo-700', preparing:'bg-amber-100 text-amber-700', ready:'bg-green-100 text-green-700', completed:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700', cancelled:'bg-gray-100 text-gray-500' };
            const canEdit = rx.status === 'sent' || rx.status === 'rejected';
            return `<div class="p-4 hover:bg-gray-50 transition ${rx.status === 'cancelled' ? 'opacity-60' : ''}" x-data="{open:false}">
              <div class="flex items-center justify-between cursor-pointer" @click="open=!open">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div>
                  <div><p class="font-medium text-gray-800 text-sm">${rx.rx_number} — ${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500">${formatDate(rx.created_at?.split('T')[0])} | ${pharmacy?.name || 'N/A'} | ${items.length} obat</p></div>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[rx.status] || 'bg-gray-100'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status] || rx.status}</span>
              </div>
              <div x-show="open" x-cloak class="mt-3 pl-13 text-sm space-y-2">
                ${items.map(i => i.is_compound ? `
                <div class="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5">
                  <div class="flex items-center gap-2 mb-1"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wide">RACIKAN</span><span class="font-medium text-gray-800">${i.drug_name}</span></div>
                  <p class="text-xs text-gray-700 whitespace-pre-line leading-relaxed">${(i.compound_details || '-').trim()}</p>
                  <p class="text-xs text-gray-500 mt-1">${i.frequency} ${i.time} — ${i.quantity} ${i.unit}</p>
                </div>` : `<div class="flex items-center gap-2 py-1 text-gray-600"><span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>${i.drug_name} ${i.dosage} — ${i.frequency} ${i.time} (${i.quantity} ${i.unit})</div>`).join('')}
                ${rx.notes ? `<p class="mt-2 text-xs text-gray-500 italic whitespace-pre-line">Catatan: ${rx.notes}</p>` : ''}
                ${rx.cancel_reason ? `<p class="mt-1 text-xs text-red-500 italic">Alasan batal: ${rx.cancel_reason}</p>` : ''}
                ${canEdit ? `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <a href="#/doctor/prescriptions/edit/${rx.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit Resep</a>
                  <button onclick="if(confirm('Batalkan resep ${rx.rx_number}?')){const r=prompt('Alasan pembatalan:'); if(r!==null){window.__store.cancelPrescription('${rx.id}',r); window.location.hash='/doctor/dashboard'; setTimeout(()=>window.location.hash='/doctor/prescriptions',50)}}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> Batalkan</button>
                </div>` : rx.status !== 'cancelled' ? `<p class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">Resep sudah diproses — tidak bisa diedit</p>` : ''}
              </div>
            </div>`;
          }).join('')}</div>`}
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorPrescriptionNew(params) {
  const doc = getDoctor();
  const record = store.data.medical_records.find(r => r.id === params.recordId);
  const patient = record ? store.getPatient(record.patient_id) : null;
  const pharmacies = store.getPharmacies();
  if (!record || !patient) return '<div class="p-8 text-center text-gray-500">Rekam medis tidak ditemukan</div>';

  const age = calculateAge(patient.birth_date);
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    items: [{drug_name:'',dosage:'',quantity:'',unit:'Tablet',frequency:'3 x 1',time:'Sesudah makan (PC)',duration:'',instructions:'',is_compound:false,compound_details:'',display_name:''}],
    pharmacy_id: '${pharmacies[0]?.id || ''}', notes: '', delivery_method: 'pickup', delivery_address: '${(patient.address || '').replace(/'/g, "\\'")}',
    sending: false, sent: false, error: '',
    async send() {
      this.sending = true; this.error = '';
      const result = await window.__store.createPrescription({record_id:'${record.id}',doctor_id:'${doc?.id}',patient_id:'${patient.id}',pharmacy_id:this.pharmacy_id,notes:this.notes,delivery_method:this.delivery_method,delivery_address:this.delivery_method==='delivery'?this.delivery_address:''}, this.items);
      this.sending = false;
      if (result.success) {
        this.sent = true;
        setTimeout(() => window.location.hash='/doctor/prescriptions', 1000);
      } else {
        this.error = result.error || 'Gagal menyimpan resep ke server. Coba lagi.';
      }
    }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Buat E-Resep</h2>
          <div class="flex gap-2">
            <button @click="send()" :disabled="sending || sent || items.some(i=>!i.drug_name) || (delivery_method==='delivery' && !delivery_address.trim())" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!sending && !sent">Kirim ke Apotek</span><span x-show="sending" x-cloak>Mengirim...</span><span x-show="sent" x-cloak>Terkirim!</span></button>
          </div>
        </div>
        <div x-show="error" x-cloak class="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium" x-text="error"></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div><span class="text-gray-500">Dokter:</span><p class="font-medium text-gray-800">${doc?.full_name}</p></div>
            <div><span class="text-gray-500">SIP:</span><p class="font-medium text-gray-800">${doc?.sip_number}</p></div>
            <div><span class="text-gray-500">Pasien:</span><p class="font-medium text-gray-800">${patient.full_name}</p></div>
            <div><span class="text-gray-500">Umur:</span><p class="font-medium text-gray-800">${age !== null ? age + ' tahun' : '-'}</p></div>
            <div><span class="text-gray-500">No. HP:</span><p class="font-medium text-gray-800">${patient.phone || '-'}</p></div>
            <div><span class="text-gray-500">Diagnosis:</span><p class="font-medium text-gray-800">${record.diagnosis}</p></div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <h4 class="font-semibold text-gray-800 mb-4">Daftar Obat</h4>
          <template x-for="(item, index) in items" :key="index">
            <div class="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50/50">
              <div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-gray-600" x-text="'R/ '+(index+1)"></span><button @click="items.splice(index,1)" x-show="items.length > 1" class="text-red-400 hover:text-red-600 text-xs transition">Hapus</button></div>
              <div class="flex items-center gap-2 mb-2"><input type="checkbox" x-model="item.is_compound" class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400/50"><label class="text-xs text-purple-700 font-medium">Obat Racikan / Compound</label></div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div><label class="block text-xs text-gray-500 mb-1" x-text="item.is_compound ? 'Nama Tampil Pasien *' : 'Nama Obat *'"></label><input type="text" x-model="item.drug_name" required class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" :placeholder="item.is_compound ? 'cth: Obat Batuk Pilek' : 'Nama obat'"></div>
                <div x-show="!item.is_compound"><label class="block text-xs text-gray-500 mb-1">Dosis</label><input type="text" x-model="item.dosage" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="500mg"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Jumlah</label><input type="number" x-model="item.quantity" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Satuan</label><select x-model="item.unit" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.DRUG_UNITS.map(u=>`<option>${u}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Signa (Frekuensi)</label><select x-model="item.frequency" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.SIGNA_OPTIONS.map(s=>`<option>${s}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Waktu</label><select x-model="item.time" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.SIGNA_TIME.map(s=>`<option>${s}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Durasi</label><input type="text" x-model="item.duration" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="5 hari"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Instruksi</label><input type="text" x-model="item.instructions" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional"></div>
              </div>
              <div x-show="item.is_compound" x-cloak class="mt-2 p-2 rounded-lg bg-purple-50 border border-purple-200">
                <label class="block text-xs text-purple-700 font-medium mb-1">Komposisi Racikan (hanya dilihat dokter & apotek)</label>
                <textarea x-model="item.compound_details" rows="2" class="w-full px-2 py-1.5 border border-purple-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none" placeholder="cth: Codein 10mg + GG 100mg + Salbutamol 2mg + CTM 2mg per kapsul"></textarea>
              </div>
            </div>
          </template>
          <button @click="items.push({drug_name:'',dosage:'',quantity:'',unit:'Tablet',frequency:'3 x 1',time:'Sesudah makan (PC)',duration:'',instructions:'',is_compound:false,compound_details:'',display_name:''})" class="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition">+ Tambah Obat</button>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-2">Keterangan Khusus</h4>
            <textarea x-model="notes" rows="3" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Instruksi khusus untuk apoteker..."></textarea>
          </div>
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-2">Kirim ke Apotek Mitra</h4>
            <select x-model="pharmacy_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
              ${pharmacies.map(ph => `<option value="${ph.id}">${ph.name} — ${ph.address}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
          <h4 class="font-semibold text-gray-800 mb-3">Pengambilan Obat</h4>
          <div class="flex gap-3 mb-3">
            <label class="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="delivery_method==='pickup' ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600'">
              <input type="radio" x-model="delivery_method" value="pickup" class="text-teal-600 focus:ring-teal-400/50"> Ambil di Klinik/Apotek
            </label>
            <label class="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="delivery_method==='delivery' ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600'">
              <input type="radio" x-model="delivery_method" value="delivery" class="text-teal-600 focus:ring-teal-400/50"> Dikirim ke Alamat Pasien
            </label>
          </div>
          <div x-show="delivery_method === 'delivery'" x-cloak>
            <label class="block text-xs text-gray-500 mb-1">Alamat Pengiriman *</label>
            <textarea x-model="delivery_address" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Alamat lengkap tujuan pengiriman"></textarea>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorPrescriptionEdit(params) {
  const doc = getDoctor();
  const rx = store.data.prescriptions.find(r => r.id === params.rxId);
  if (!rx) return '<div class="p-8 text-center text-gray-500">Resep tidak ditemukan</div>';
  const patient = store.getPatient(rx.patient_id);
  const existingItems = store.getPrescriptionItems(rx.id);
  const pharmacies = store.getPharmacies();
  const itemsJson = JSON.stringify(existingItems.map(i => ({drug_name:i.drug_name,dosage:i.dosage,quantity:i.quantity,unit:i.unit,frequency:i.frequency,time:i.time,duration:i.duration,instructions:i.instructions,is_compound:!!i.is_compound,compound_details:i.compound_details||'',display_name:i.display_name||''}))).replace(/'/g,"\\'");
  window.__editRxItems = existingItems.map(i => ({drug_name:i.drug_name,dosage:i.dosage,quantity:i.quantity,unit:i.unit,frequency:i.frequency,time:i.time,duration:i.duration,instructions:i.instructions,is_compound:!!i.is_compound,compound_details:i.compound_details||'',display_name:i.display_name||''}));

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    items: window.__editRxItems || [],
    pharmacy_id: '${rx.pharmacy_id}',
    notes: '${(rx.notes||'').replace(/'/g,"\\'")}',
    delivery_method: '${rx.delivery_method || 'pickup'}',
    delivery_address: '${(rx.delivery_address || patient?.address || '').replace(/'/g, "\\'")}',
    saving: false, saved: false,
    saveEdit() {
      this.saving = true;
      const self = this;
      setTimeout(function() {
        window.__store.updatePrescription('${rx.id}', { pharmacy_id: self.pharmacy_id, notes: self.notes, delivery_method: self.delivery_method, delivery_address: self.delivery_method==='delivery' ? self.delivery_address : '', status: 'sent' });
        window.__store.updatePrescriptionItems('${rx.id}', self.items);
        self.saving = false; self.saved = true;
        setTimeout(function(){ window.location.hash = '/doctor/prescriptions'; }, 800);
      }, 400);
    }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div><h2 class="text-xl font-bold text-gray-800">Edit E-Resep</h2><p class="text-sm text-gray-500">${rx.rx_number} — ${patient?.full_name || 'N/A'}</p></div>
          <div class="flex gap-2">
            <button @click="saveEdit()" :disabled="saving || saved" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving && !saved">Simpan Perubahan</span><span x-show="saving" x-cloak>Menyimpan...</span><span x-show="saved" x-cloak>Tersimpan!</span></button>
            <a href="#/doctor/prescriptions" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</a>
          </div>
        </div>
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2"><svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><p class="text-sm text-amber-800">Anda sedang mengedit resep yang sudah dikirim. Perubahan akan dikirim ulang ke apotek.</p></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <h4 class="font-semibold text-gray-800 mb-4">Daftar Obat</h4>
          <template x-for="(item, index) in items" :key="index">
            <div class="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50/50">
              <div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-gray-600" x-text="'R/ '+(index+1)"></span><button @click="items.splice(index,1)" x-show="items.length > 1" class="text-red-400 hover:text-red-600 text-xs transition">Hapus</button></div>
              <div class="flex items-center gap-2 mb-2"><input type="checkbox" x-model="item.is_compound" class="w-4 h-4 rounded border-gray-300 text-purple-600"><label class="text-xs text-purple-700 font-medium">Obat Racikan</label></div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div><label class="block text-xs text-gray-500 mb-1" x-text="item.is_compound ? 'Nama Tampil Pasien *' : 'Nama Obat *'"></label><input type="text" x-model="item.drug_name" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div x-show="!item.is_compound"><label class="block text-xs text-gray-500 mb-1">Dosis</label><input type="text" x-model="item.dosage" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Jumlah</label><input type="number" x-model="item.quantity" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Satuan</label><select x-model="item.unit" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.DRUG_UNITS.map(u=>`<option>${u}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Frekuensi</label><select x-model="item.frequency" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.SIGNA_OPTIONS.map(s=>`<option>${s}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Waktu</label><select x-model="item.time" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${CONFIG.SIGNA_TIME.map(s=>`<option>${s}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-500 mb-1">Durasi</label><input type="text" x-model="item.duration" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-500 mb-1">Instruksi</label><input type="text" x-model="item.instructions" class="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div x-show="item.is_compound" x-cloak class="mt-2 p-2 rounded-lg bg-purple-50 border border-purple-200"><label class="block text-xs text-purple-700 font-medium mb-1">Komposisi Racikan</label><textarea x-model="item.compound_details" rows="2" class="w-full px-2 py-1.5 border border-purple-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none"></textarea></div>
            </div>
          </template>
          <button @click="items.push({drug_name:'',dosage:'',quantity:'',unit:'Tablet',frequency:'3 x 1',time:'Sesudah makan (PC)',duration:'',instructions:'',is_compound:false,compound_details:'',display_name:''})" class="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition">+ Tambah Obat</button>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-4"><h4 class="font-semibold text-gray-800 mb-2">Keterangan Khusus</h4><textarea x-model="notes" rows="3" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
          <div class="bg-white border border-slate-100 rounded-3xl p-4"><h4 class="font-semibold text-gray-800 mb-2">Ganti Apotek Mitra</h4><select x-model="pharmacy_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${pharmacies.map(ph=>`<option value="${ph.id}">${ph.name} — ${ph.address}</option>`).join('')}</select></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
          <h4 class="font-semibold text-gray-800 mb-3">Pengambilan Obat</h4>
          <div class="flex gap-3 mb-3">
            <label class="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="delivery_method==='pickup' ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600'">
              <input type="radio" x-model="delivery_method" value="pickup" class="text-teal-600 focus:ring-teal-400/50"> Ambil di Klinik/Apotek
            </label>
            <label class="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="delivery_method==='delivery' ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium' : 'border-gray-200 text-gray-600'">
              <input type="radio" x-model="delivery_method" value="delivery" class="text-teal-600 focus:ring-teal-400/50"> Dikirim ke Alamat Pasien
            </label>
          </div>
          <div x-show="delivery_method === 'delivery'" x-cloak>
            <label class="block text-xs text-gray-500 mb-1">Alamat Pengiriman *</label>
            <textarea x-model="delivery_address" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Alamat lengkap tujuan pengiriman"></textarea>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorEMREdit(params) {
  const doc = getDoctor();
  const record = store.data.medical_records.find(r => r.id === params.recordId);
  if (!record) return '<div class="p-8 text-center text-gray-500">Rekam medis tidak ditemukan</div>';
  const patient = store.getPatient(record.patient_id);
  const locations = CONFIG.LOCATIONS || ['Klinik Utama Prima','Home Care','Telemedicine'];
  window.__icd10 = ICD10;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024, saving: false, saved: false,
    form: { anamnesis: '${(record.anamnesis||'').replace(/'/g,"\\'")}', diagnosis: '${(record.diagnosis||'').replace(/'/g,"\\'")}', diagnosis_secondary: '${(record.diagnosis_secondary||'').replace(/'/g,"\\'")}', therapy: '${(record.therapy||'').replace(/'/g,"\\'")}', location: '${record.location||locations[0]}', follow_up_date: '${record.follow_up_date||''}', follow_up_notes: '${(record.follow_up_notes||'').replace(/'/g,"\\'")}', notes: '${(record.notes||'').replace(/'/g,"\\'")}' },
    icdSearch: '${(record.diagnosis||'').replace(/'/g,"\\'")}', icdResults: [], icdOpen: false,
    icdSearch2: '${(record.diagnosis_secondary||'').replace(/'/g,"\\'")}', icdResults2: [], icdOpen2: false,
    searchICD(q, which) {
      if (!q || q.length < 2) { if(which===2){this.icdResults2=[];this.icdOpen2=false}else{this.icdResults=[];this.icdOpen=false}; return; }
      const s = q.toLowerCase();
      const results = (window.__icd10||[]).filter(d => d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s) || d.name_id.toLowerCase().includes(s)).slice(0, 8);
      if(which===2){this.icdResults2=results;this.icdOpen2=results.length>0}else{this.icdResults=results;this.icdOpen=results.length>0};
    },
    selectICD(item, which) {
      const val = item.code + ' - ' + item.name_id;
      if(which===2){this.form.diagnosis_secondary=val;this.icdSearch2=val;this.icdOpen2=false}else{this.form.diagnosis=val;this.icdSearch=val;this.icdOpen=false};
    },
    saveEdit() {
      this.saving = true;
      const self = this;
      setTimeout(function() {
        window.__store.updateRecord('${record.id}', self.form);
        self.saving = false; self.saved = true;
        setTimeout(function(){ window.location.hash = '/doctor/emr/${record.patient_id}'; }, 800);
      }, 400);
    }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div><h2 class="text-xl font-bold text-gray-800">Edit Rekam Medis</h2><p class="text-sm text-gray-500">${patient?.full_name || ''} — ${formatDate(record.visit_date)}</p></div>
          <div class="flex gap-2">
            <button @click="saveEdit()" :disabled="saving || saved || !form.anamnesis || !form.diagnosis" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving && !saved">Simpan Perubahan</span><span x-show="saving" x-cloak>Menyimpan...</span><span x-show="saved" x-cloak>Tersimpan!</span></button>
            <a href="#/doctor/emr/${record.patient_id}" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</a>
          </div>
        </div>
        <div class="space-y-4">
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <div class="grid sm:grid-cols-2 gap-3">
              <div><label class="block text-xs text-gray-500 mb-1">Lokasi / Tempat</label><select x-model="form.location" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${locations.map(l=>`<option>${l}</option>`).join('')}<option>Lainnya</option></select></div>
              <div><label class="block text-xs text-gray-500 mb-1">Jadwal Kontrol</label><input type="date" x-model="form.follow_up_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>
          </div>
          <div class="bg-white border border-slate-100 rounded-3xl p-4"><h4 class="font-semibold text-gray-800 mb-3">Anamnesis *</h4><textarea x-model="form.anamnesis" rows="4" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
          <div class="grid lg:grid-cols-2 gap-4">
            <div class="bg-white border border-slate-100 rounded-3xl p-4">
              <h4 class="font-semibold text-gray-800 mb-3">Diagnosis (ICD-10) *</h4>
              <div class="relative"><input type="text" x-model="icdSearch" @input="searchICD(icdSearch,1)" @focus="searchICD(icdSearch,1)" @click.away="icdOpen=false" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari ICD-10...">
                <div x-show="icdOpen" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"><template x-for="item in icdResults" :key="item.code"><button type="button" @mousedown.prevent="selectICD(item,1)" class="w-full text-left px-3 py-2 hover:bg-teal-50 transition border-b border-gray-50"><span class="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-xs font-mono font-bold" x-text="item.code"></span> <span class="text-sm text-gray-800" x-text="item.name_id"></span></button></template></div>
              </div>
              <div x-show="form.diagnosis" x-cloak class="mt-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800" x-text="form.diagnosis"></div>
              <label class="block text-xs text-gray-500 mt-3 mb-1">Diagnosis Sekunder</label>
              <div class="relative"><input type="text" x-model="icdSearch2" @input="searchICD(icdSearch2,2)" @focus="searchICD(icdSearch2,2)" @click.away="icdOpen2=false" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional">
                <div x-show="icdOpen2" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"><template x-for="item in icdResults2" :key="item.code"><button type="button" @mousedown.prevent="selectICD(item,2)" class="w-full text-left px-3 py-2 hover:bg-teal-50 transition border-b border-gray-50"><span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono font-bold" x-text="item.code"></span> <span class="text-sm" x-text="item.name_id"></span></button></template></div>
              </div>
            </div>
            <div class="bg-white border border-slate-100 rounded-3xl p-4"><h4 class="font-semibold text-gray-800 mb-3">Terapi Non-Farmakologis</h4><textarea x-model="form.therapy" rows="5" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorCalendar(params) {
  const doc = getDoctor();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const allAppts = store.data.appointments.filter(a => a.doctor_id === doc?.id);
  const allRecords = store.getRecordsByDoctor(doc?.id);

  const year = params?.year ? parseInt(params.year, 10) : today.getFullYear();
  const month = params?.month ? parseInt(params.month, 10) - 1 : today.getMonth();
  const viewDate = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const prevMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month + 1, 1);
  const prevHref = `/doctor/calendar/${prevMonthDate.getFullYear()}/${prevMonthDate.getMonth() + 1}`;
  const nextHref = `/doctor/calendar/${nextMonthDate.getFullYear()}/${nextMonthDate.getMonth() + 1}`;

  const calendarDays = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const apptsData = allAppts.map(a => {
    const p = store.getPatient(a.patient_id);
    return { ...a, patient_name: p?.full_name || a.patient_name || 'N/A', patient_id: a.patient_id };
  });
  window.__calendarAppts = apptsData;

  const recordsData = allRecords.map(r => {
    const p = store.getPatient(r.patient_id);
    return { id: r.id, patient_id: r.patient_id, patient_name: p?.full_name || 'N/A', visit_date: r.visit_date, diagnosis: r.diagnosis, visit_type: r.visit_type };
  });
  window.__calendarRecords = recordsData;

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    selectedDate: '${isCurrentMonth ? todayStr : `${year}-${String(month + 1).padStart(2, '0')}-01`}',
    allAppts: window.__calendarAppts || [],
    allRecords: window.__calendarRecords || [],
    get selectedAppts() { return this.allAppts.filter(a => a.date === this.selectedDate).sort((a,b) => (a.time_slot||'').localeCompare(b.time_slot||'')); },
    get selectedRecords() { return this.allRecords.filter(r => r.visit_date === this.selectedDate); },
    get selectedDateFormatted() { const d = new Date(this.selectedDate); return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}); },
    typeIcons: { visit:'🏥', vaccination:'💉', follow_up:'🔄', telemedicine:'📹' },
    statusLabels: { waiting:'Menunggu', completed:'Selesai', scheduled:'Terjadwal' },
    statusColors: { waiting:'bg-amber-100 text-amber-700', completed:'bg-green-100 text-green-700', scheduled:'bg-blue-100 text-blue-700' }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('calendar')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-6">Kalender & Jadwal</h2>
        <div class="grid lg:grid-cols-5 gap-6">
          <div class="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-4">
            <div class="flex items-center justify-between mb-4">
              <a href="#${prevHref}" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></a>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-800">${monthName}</h3>
                ${!isCurrentMonth ? `<a href="#/doctor/calendar" class="text-xs text-teal-600 hover:text-teal-700 font-medium">Hari Ini</a>` : ''}
              </div>
              <a href="#${nextHref}" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs">
              ${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>`<div class="font-semibold text-gray-500 py-2">${d}</div>`).join('')}
              ${calendarDays.map(d => {
                if (!d) return '<div></div>';
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const recordCount = allRecords.filter(r => r.visit_date === dateStr).length;
                const apptCount = allAppts.filter(a => a.date === dateStr).length;
                const isToday = isCurrentMonth && d === today.getDate();
                const dotColors = [
                  ...Array(Math.min(recordCount, 3)).fill('bg-green-500'),
                  ...Array(Math.max(0, Math.min(apptCount, 3 - Math.min(recordCount, 3)))).fill('bg-teal-500'),
                ];
                const dotsHtml = dotColors.map(c => `<span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : c}"></span>`).join('');
                return `<button @click="selectedDate='${dateStr}'" :class="selectedDate==='${dateStr}' && !${isToday} ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-400' : ''" class="relative py-2.5 rounded-lg transition hover:bg-teal-50 cursor-pointer ${isToday ? 'bg-teal-600 text-white hover:bg-teal-700 font-bold' : ''}"><span>${d}</span>${dotColors.length > 0 ? `<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">${dotsHtml}</span>` : ''}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-4">
            <h3 class="font-semibold text-gray-800 mb-1">Jadwal</h3>
            <p class="text-xs text-gray-500 mb-4" x-text="selectedDateFormatted"></p>
            <div class="space-y-2">
              <template x-if="selectedAppts.length === 0 && selectedRecords.length === 0"><p class="text-gray-400 text-sm text-center py-8">Tidak ada jadwal atau rekam medis di tanggal ini</p></template>
              <template x-for="apt in selectedAppts" :key="apt.id">
                <div class="p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-teal-200 transition">
                  <div class="flex items-center gap-3">
                    <span class="text-lg" x-text="typeIcons[apt.type] || '📋'"></span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800"><span x-text="apt.time_slot"></span> — <span x-text="apt.patient_name"></span></p>
                      <p class="text-xs text-gray-500" x-text="apt.notes || apt.type"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusColors[apt.status] || 'bg-gray-100 text-gray-600'" x-text="statusLabels[apt.status] || apt.status"></span>
                  </div>
                  <div class="flex gap-1 mt-2" x-show="apt.status === 'waiting' || apt.status === 'scheduled'">
                    <a :href="'#/doctor/emr/'+apt.patient_id+'/new'" class="px-2 py-1 rounded text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Mulai Konsultasi</a>
                  </div>
                </div>
              </template>
              <template x-if="selectedRecords.length > 0">
                <p class="text-xs font-semibold text-gray-500 uppercase pt-2" x-show="selectedAppts.length > 0">Rekam Medis</p>
              </template>
              <template x-for="rec in selectedRecords" :key="rec.id">
                <a :href="'#/doctor/emr/'+rec.patient_id" class="block p-3 rounded-lg bg-green-50/50 border border-green-100 hover:border-green-300 transition">
                  <div class="flex items-center gap-3">
                    <span class="text-lg">🩺</span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800" x-text="rec.patient_name"></p>
                      <p class="text-xs text-gray-500" x-text="rec.diagnosis || rec.visit_type"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Selesai</span>
                  </div>
                </a>
              </template>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorHomeCareNew() {
  const doc = getDoctor();
  return homeCareNewPage({
    role: 'doctor',
    sidebar: doctorSidebar('homecare'),
    header: doctorHeader(doc),
    doctorId: doc?.id,
    patients: store.getPatients(),
    historyPath: '/doctor/homecare/history',
  });
}

export function doctorHomeCareHistory() {
  const doc = getDoctor();
  const claims = store.getHomeCareClaims({ doctorId: doc?.id });
  const claimItemsMap = {};
  claims.forEach(c => { claimItemsMap[c.id] = store.getHomeCareClaimItems(c.id); });
  return homeCareHistoryPage({
    role: 'doctor',
    sidebar: doctorSidebar('homecare'),
    header: doctorHeader(doc),
    claims, claimItemsMap, doctorId: doc?.id,
    newPath: '/doctor/homecare/new',
    editPath: '/doctor/homecare/edit',
  });
}

export function doctorHomeCareEdit(params) {
  const doc = getDoctor();
  const claim = store.getHomeCareClaim(params.claimId);
  if (!claim) return '<div class="p-8 text-center text-gray-500">Klaim tidak ditemukan</div>';
  return homeCareNewPage({
    role: 'doctor',
    sidebar: doctorSidebar('homecare'),
    header: doctorHeader(doc),
    doctorId: doc?.id,
    patients: store.getPatients(),
    historyPath: '/doctor/homecare/history',
    claimId: claim.id,
    existingClaim: claim,
    existingItems: store.getHomeCareClaimItems(claim.id),
  });
}

function doctorSidebar(active) {
  const doc = getDoctor();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const unreadChat = doc ? store.getConsultationsForDoctor(doc.id).reduce((s, c) => s + (c.unread_count || 0), 0) : 0;
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', href: '#/doctor/dashboard' },
    { id: 'patients', label: 'Pasien', icon: 'groups', href: '#/doctor/patients' },
    { id: 'emr', label: 'Rekam Medis', icon: 'clinical_notes', href: '#/doctor/records' },
    { id: 'prescriptions', label: 'E-Resep', icon: 'prescriptions', href: '#/doctor/prescriptions' },
    { id: 'chat', label: 'Pesan', icon: 'forum', href: '#/doctor/chat', badge: unreadChat },
    { id: 'homecare', label: 'BMHP & Jasa', icon: 'home_health', href: '#/doctor/homecare/history' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_month', href: '#/doctor/calendar' },
  ];
  return `
  <div x-show="sideOpen" x-cloak x-transition.opacity @click="sideOpen=false" class="fixed inset-0 bg-black/40 z-[35] lg:hidden"></div>
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-white border-r border-slate-100 z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-2"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto"></div>
      <button @click="sideOpen=false" class="lg:hidden text-faint hover:text-ink"><span class="ms text-[20px]">close</span></button>
    </div>
    <nav class="p-3 space-y-1 flex-1">${items.map(i => `<a href="${i.href}" @click="sideOpen=window.innerWidth>1024" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active === i.id ? 'bg-tint text-brand font-bold' : 'text-muted font-semibold hover:bg-slate-50'}"><span class="ms ${active === i.id ? 'ms-fill' : ''} text-[20px] ${active === i.id ? 'text-brand' : 'text-faint'}">${i.icon}</span><span class="flex-1">${i.label}</span>${i.badge ? `<span class="w-5 h-5 rounded-full bg-[#ff5436] text-white text-[10.5px] font-bold flex items-center justify-center">${i.badge}</span>` : ''}</a>`).join('')}</nav>
    ${user?.role === 'owner' ? `<div class="p-3 border-t border-slate-100"><a href="#/admin/dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-brand hover:bg-slate-50 transition w-full"><span class="ms text-[20px]">shield_person</span>Lihat sebagai SuperAdmin</a></div>` : ''}
    <div class="p-3 border-t border-slate-100"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">logout</span>Keluar</button></div>
  </aside>`;
}

export function doctorChatList() {
  const doc = getDoctor();
  const conversations = store.getConsultationsForDoctor(doc?.id);
  return chatListPage({ sidebar: doctorSidebar('chat'), header: doctorHeader(doc), conversations, viewerRole: 'doctor', viewerId: doc?.id, threadPathPrefix: '#/doctor/chat/' });
}

export function doctorChatThread(params) {
  const doc = getDoctor();
  const consultation = store.getConsultation(params.conversationId);
  if (!consultation) return '<div class="min-h-screen flex items-center justify-center text-gray-400">Percakapan tidak ditemukan</div>';
  const patient = store.getPatient(consultation.patient_id);
  return chatThreadPage({ sidebar: doctorSidebar('chat'), header: doctorHeader(doc), consultationId: consultation.id, otherName: patient?.full_name || 'Pasien', messages: store.getMessages(consultation.id), viewerRole: 'doctor', listPath: '#/doctor/chat' });
}

export function doctorChatStart(params) {
  const doc = getDoctor();
  window.__chatStartArgs = { doctorId: doc?.id, patientId: params.patientId };
  return `<div x-data="{}" x-init="(async () => { const c = await window.__store.getOrCreateConsultation(window.__chatStartArgs.patientId, window.__chatStartArgs.doctorId); window.location.hash = '/doctor/chat/' + c.id; })()" class="min-h-screen flex items-center justify-center bg-wash"><p class="text-sm text-faint">Membuka percakapan...</p></div>`;
}

function doctorHeader(doc) {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  const unread = store.getUnreadCount(user?.id);
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
    <div class="flex items-center gap-3">
      <a href="#/doctor/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span>${unread > 0 ? `<span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#ff5436] border-2 border-white"></span>` : ''}</a>
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(doc?.full_name || 'D').split(' ').map(n=>n[0]).join('').slice(0,2)}</div><span class="text-sm font-medium text-ink hidden sm:block">${doc?.full_name || 'Dokter'}</span></div>
    </div>
  </header>`;
}
