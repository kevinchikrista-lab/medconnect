import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { ICD10 } from '../icd10.js';
import { homeCareNewPage, homeCareHistoryPage } from './homecare.js';
import { chatListPage, chatThreadPage } from './chat.js';
import { waButton, waHref, waKontrolMsg, waVaksinMsg, waSentBadge, apptResponseBadge, waSapaMsg, waHariIniMsg, waMsgB64 } from '../wa.js';
import { crmSetup, crmXData, crmBody } from './crm.js';
import { calendarTasksSetup, calendarTasksXData, calendarTasksBlock } from './tasks.js';
import { vaxAnakXData, vaxAnakBody } from './vaksin.js';
import { LAB_PANEL, KELOMPOK, teksRujukan, susunHasil, kalimatNarkoba, CATATAN_NARKOBA } from '../lab-panel.js';

function getDoctor() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  return store.getDoctorByUserId(user?.id);
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// PRIVASI REKAM MEDIS
//
// Seorang dokter hanya membuka rekam medis pasien yang ia tangani. Yang
// menentukan bukan halaman ini melainkan store.recordAccess() — satu pintu
// yang juga dipakai layar lain, supaya halaman baru yang ditambahkan nanti
// tidak lupa memeriksanya dengan caranya sendiri.
// ---------------------------------------------------------------------------
function aksesRM(patientId) {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  return store.recordAccess(user, patientId) || { boleh: false, alasan: '' };
}

// Layar penolakan. Sesudah daftar pasien dibuka untuk seluruh dokter, layar
// ini TIDAK lagi muncul bagi dokter mana pun — yang tersisa hanya peran yang
// memang tidak berurusan dengan isi rekam medis (apotek, atau akun pasien yang
// mengetik alamat halaman dokter langsung).
//
// Formulir "buka akses & tulis alasan" ikut dibuang bersama penyaringannya:
// pintu darurat hanya berarti kalau ada pintu yang terkunci, dan sekarang
// tidak ada.
function rmTerkunci(patient) {
  const doc = getDoctor();
  const q = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-2xl mx-auto">
        <div class="bg-white rounded-2xl border border-slate-100 p-6">
          <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4"><span class="ms text-[26px] text-slate-500">lock</span></div>
          <h2 class="text-lg font-bold text-ink">Rekam medis ${q(patient.full_name || 'pasien ini')} tertutup untuk akun ini</h2>
          <p class="text-[12.5px] text-muted leading-relaxed mt-1.5">Isi rekam medis hanya terbuka untuk dokter dan pengelola klinik. Akun apotek melihat resepnya saja.</p>
          <div class="mt-4 flex gap-2">
            <a href="#/doctor/patients" class="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100">Kembali ke daftar pasien</a>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

// new Date().toISOString().split('T')[0] reads the UTC date — WIB is
// UTC+7, so from local midnight to 7am that's still "yesterday" in UTC,
// which is why a record entered right after midnight local time didn't
// show up under "today" for the rest of that actual day.
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

// ---- Pemeriksaan Fisik (SOAP "Objective") --------------------------------
// The exam state is passed to Alpine via globals (window.__peState etc.) rather
// than embedded in the x-data string, so free-text findings with quotes or
// newlines can't break the attribute (same approach as the record editor).
//
// To avoid a schema migration (and the deploy-ordering hazard where the code
// ships before a new column exists, which would fail every record insert), the
// structured exam is stored ONLY as the compiled summary in the existing
// `examination` text field and parsed back here on edit. Format per line:
//   "<System>: DBN"  (normal)  |  "<System>: <finding>"  (abnormal)
//   "Lain-lain: <catatan>"  (free text)
function buildPeState(record) {
  const systems = CONFIG.PHYSICAL_EXAM_SYSTEMS || [];
  const state = {};
  const labelToKey = {};
  systems.forEach(s => { state[s.key] = { normal: false, abn: false, detail: '' }; labelToKey[s.label] = s.key; });
  const others = [];
  const text = (record && record.examination) || '';
  text.split('\n').forEach(line => {
    if (!line.trim()) return;
    const idx = line.indexOf(':');
    if (idx === -1) { others.push(line.trim()); return; }
    const label = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (label === 'Lain-lain') { if (val) others.push(val); return; }
    const key = labelToKey[label];
    if (!key) { others.push(line.trim()); return; }
    if (val.toUpperCase() === 'DBN') state[key].normal = true;
    else if (val) { state[key].abn = true; state[key].detail = val; }
  });
  return { state, other: others.join('; ') };
}

// x-data fragment (methods + refs to the globals) shared by the new & edit forms.
function physicalExamXData() {
  return `pe: JSON.parse(JSON.stringify(window.__peState || {})), peOther: (window.__peOtherInit || ''), peSystems: (window.__peSystems || []),
    peAllNormal() { this.peSystems.forEach(s => { this.pe[s.key].normal = true; this.pe[s.key].abn = false; }); },
    peToggleNormal(k) { this.pe[k].normal = !this.pe[k].normal; if (this.pe[k].normal) this.pe[k].abn = false; },
    peSetAbn(k) { this.pe[k].abn = !this.pe[k].abn; if (this.pe[k].abn) this.pe[k].normal = false; },
    peCompile() { const parts = []; this.peSystems.forEach(s => { const v = this.pe[s.key]; if (v.abn && (v.detail||'').trim()) parts.push(s.label + ': ' + v.detail.trim()); else if (v.normal) parts.push(s.label + ': DBN'); }); if ((this.peOther||'').trim()) parts.push('Lain-lain: ' + this.peOther.trim()); return parts.join(String.fromCharCode(10)); },`;
}

// The card HTML, shared by both forms. Relies on the x-data fragment above.
function physicalExamCard() {
  return `<div class="bg-white border border-slate-100 rounded-3xl p-4">
    <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
      <h4 class="font-semibold text-gray-800 flex items-center gap-2"><svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> Pemeriksaan Fisik (Objektif) <span class="text-xs font-normal text-gray-400">— opsional</span></h4>
      <button type="button" @click="peAllNormal()" class="text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition font-medium">Semua Dalam Batas Normal</button>
    </div>
    <div class="space-y-2">
      <template x-for="sys in peSystems" :key="sys.key">
        <div class="border border-gray-100 rounded-lg p-2.5" :class="(pe[sys.key].normal || pe[sys.key].abn) ? 'bg-gray-50/60' : ''">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-gray-700 flex-1 min-w-[120px]" x-text="sys.label"></span>
            <button type="button" @click="peToggleNormal(sys.key)" class="text-xs px-2.5 py-1 rounded-lg border transition" :class="pe[sys.key].normal ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-500 border-gray-200 hover:border-teal-300'">DBN</button>
            <button type="button" @click="peSetAbn(sys.key)" class="text-xs px-2.5 py-1 rounded-lg border transition" :class="pe[sys.key].abn ? 'bg-amber-500 text-white border-amber-500' : 'text-gray-500 border-gray-200 hover:border-amber-300'">Ada kelainan</button>
          </div>
          <div x-show="pe[sys.key].abn" x-cloak class="mt-2">
            <input type="text" x-model="pe[sys.key].detail" class="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40" placeholder="Deskripsi temuan (mis. ronki basah basal bilateral)...">
          </div>
        </div>
      </template>
    </div>
    <div class="mt-3">
      <label class="block text-xs text-gray-500 mb-1">Pemeriksaan lain / catatan</label>
      <textarea x-model="peOther" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Temuan lain yang belum tercakup di atas..."></textarea>
    </div>
  </div>`;
}

// Escape a value for safe interpolation into rendered HTML text — a stray '<'
// in free-text patient data (name, allergies, address) would otherwise break the
// surrounding markup and can make later controls unclickable.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Escape for a single-quoted JS string sitting inside a (double-quoted) x-data /
// x-if attribute — handles backslash, both quote types, and newlines. Without
// this, a patient whose name/NIK contains a quote breaks the whole page's Alpine.
function qAttr(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
}

// Secondary diagnoses are stored in the single existing `diagnosis_secondary`
// text column joined by '; ' — so multiple entries need NO database migration.
// Parse the stored text back into an array (handles legacy single values too).
function parseSecondaries(text) {
  return String(text || '').split(/;\s*|\n/).map(s => s.trim()).filter(Boolean);
}

// x-data methods shared by the new & edit EMR forms. Expects `secondaries` (array),
// `icdSearch2`, `icdResults2`, `icdOpen2`, and `selectICD` to exist on the scope.
function secondaryDxMethods() {
  return `addSecondary() { const v=(this.icdSearch2||'').trim(); if(!v) return; if(!this.secondaries.includes(v)) this.secondaries.push(v); this.icdSearch2=''; this.icdResults2=[]; this.icdOpen2=false; },
    removeSecondary(i) { this.secondaries.splice(i,1); },`;
}

// The secondary-diagnosis UI: search + "Tambah" button + a removable chip list.
function secondaryDxCard() {
  return `<label class="block text-xs text-gray-500 mt-3 mb-1">Diagnosis Sekunder (ICD-10) <span class="text-gray-400">— boleh lebih dari satu</span></label>
    <div class="relative">
      <div class="flex gap-2">
        <input type="text" x-model="icdSearch2" @input="searchICD(icdSearch2,2)" @focus="searchICD(icdSearch2,2)" @keydown.enter.prevent="addSecondary()" @click.away="icdOpen2=false" class="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari ICD-10 lalu pilih, atau ketik lalu Tambah...">
        <button type="button" @click="addSecondary()" class="px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 whitespace-nowrap flex-shrink-0">+ Tambah</button>
      </div>
      <div x-show="icdOpen2" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
        <template x-for="item in icdResults2" :key="item.code">
          <button type="button" @mousedown.prevent="selectICD(item,2)" class="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition border-b border-gray-50">
            <div class="flex items-center gap-2"><span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-mono font-bold flex-shrink-0" x-text="item.code"></span><span class="text-sm text-gray-800" x-text="item.name_id"></span></div>
          </button>
        </template>

        <!-- Tidak ketemu bukan jalan buntu. Daftar bawaan
             bukan ICD-10 utuh, jadi kode yang hilang ditambahkan
             di sini juga — sekali, lalu tersedia untuk seluruh
             klinik. -->
        <template x-if="icdKosong">
          <div class="p-3 border-t border-slate-100 bg-slate-50">
            <p class="text-[11.5px] text-slate-600">Tidak ada kode yang cocok dengan <b x-text="icdKosong"></b>.</p>
            <div class="grid grid-cols-[110px_1fr] gap-2 mt-2">
              <input type="text" x-model="icdKodeBaru" @focus="!icdKodeBaru && !icdNamaBaru && siapkanIcdBaru()" placeholder="G40.9"
                class="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px] font-mono uppercase">
              <input type="text" x-model="icdNamaBaru" @focus="!icdKodeBaru && !icdNamaBaru && siapkanIcdBaru()" placeholder="Nama diagnosis"
                class="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px]">
            </div>
            <p x-show="icdGalat" x-cloak class="mt-1.5 text-[11px] text-red-700" x-text="icdGalat"></p>
            <button type="button" @mousedown.prevent="simpanIcdBaru(2)" :disabled="icdSibuk"
              class="mt-2 w-full px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">Tambahkan ke Daftar Klinik</button>
            <p class="mt-1 text-[10.5px] text-slate-400">Periksa dulu kodenya dengan buku ICD-10 bila akan dipakai untuk klaim.</p>
          </div>
        </template>
      </div>
    </div>
    <div class="mt-2 space-y-1.5">
      <template x-for="(s, i) in secondaries" :key="i">
        <div class="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
          <span x-text="s"></span>
          <button type="button" @click="removeSecondary(i)" class="ml-auto text-blue-400 hover:text-blue-700 flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      </template>
    </div>`;
}

// Shared "Riwayat Rekam Medis" reference panel — a dropdown to pick an old
// visit plus a read-only summary, used on the Kunjungan Baru page so the
// doctor can check prior records without leaving the form. All values render
// via x-text (Alpine-escaped), so free text in old notes can't break anything.
function oldRecordsPanelInner() {
  return `
    <select x-model="selectedOldId" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 mb-3">
      <option value="">— Pilih kunjungan lama —</option>
      <template x-for="r in oldRecords" :key="r.id">
        <option :value="r.id" x-text="fmtOldDate(r.visit_date) + ' — ' + (r.diagnosis || 'tanpa diagnosis')"></option>
      </template>
    </select>
    <p x-show="oldRecords.length===0" class="text-xs text-gray-400">Belum ada riwayat kunjungan sebelumnya.</p>
    <template x-if="selectedOld">
      <div class="space-y-2.5 text-sm border-t border-gray-100 pt-3">
        <div><p class="text-xs text-gray-400 font-medium">Diagnosis</p><p class="text-gray-800" x-text="selectedOld.diagnosis || '-'"></p></div>
        <div x-show="selectedOld.anamnesis"><p class="text-xs text-gray-400 font-medium">Anamnesis</p><p class="text-gray-700 whitespace-pre-line" x-text="selectedOld.anamnesis"></p></div>
        <div x-show="selectedOld.examination"><p class="text-xs text-gray-400 font-medium">Pemeriksaan Fisik</p><p class="text-gray-700 whitespace-pre-line" x-text="selectedOld.examination"></p></div>
        <div x-show="Object.values(selectedOld.vital_signs||{}).some(v=>v)">
          <p class="text-xs text-gray-400 font-medium mb-1">Vital Signs</p>
          <div class="flex flex-wrap gap-1.5">
            <template x-for="(v,k) in selectedOld.vital_signs" :key="k"><span x-show="v" class="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-xs text-gray-600" x-text="k.toUpperCase()+': '+v"></span></template>
          </div>
        </div>
        <div x-show="selectedOld.therapy"><p class="text-xs text-gray-400 font-medium">Terapi</p><p class="text-gray-700 whitespace-pre-line" x-text="selectedOld.therapy"></p></div>
        <div x-show="selectedOld.follow_up_date"><p class="text-xs text-gray-400 font-medium">Kontrol Berikutnya</p><p class="text-gray-700" x-text="fmtOldDate(selectedOld.follow_up_date) + (selectedOld.follow_up_notes ? ' — '+selectedOld.follow_up_notes : '')"></p></div>
        <div x-show="selectedOld.notes"><p class="text-xs text-gray-400 font-medium">Catatan</p><p class="text-gray-700 whitespace-pre-line" x-text="selectedOld.notes"></p></div>
      </div>
    </template>`;
}

export function doctorDashboard() {
  const doc = getDoctor();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  const today = todayLocal();
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
                const waToday = waButton(patient?.phone, waHariIniMsg(patient?.full_name, apt.time_slot, apt.queue_number), 'WA', { patientId: apt.patient_id });
                return `<div class="p-4 hover:bg-gray-50 transition flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${apt.queue_number || '-'}</div>
                    <div><p class="font-medium text-gray-800 text-sm">${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500">${apt.time_slot} — ${apt.notes || apt.type}</p></div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[apt.status] || 'bg-gray-100 text-gray-600'}">${statusLabels[apt.status] || apt.status}</span>
                    ${waToday}
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
                const confirmUrl = window.location.origin + '/#/konfirmasi/' + apt.id;
                const wa = waButton(patient?.phone, waKontrolMsg(patient?.full_name, formatDate(apt.date) + (apt.time_slot ? ' jam ' + apt.time_slot : ''), apt.notes, confirmUrl), 'Ingatkan', { logTable: 'appointments', logId: apt.id, patientId: apt.patient_id });
                return `<div class="p-4 hover:bg-gray-50 transition flex items-center justify-between gap-2">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><span class="text-blue-600 text-xs font-bold text-center leading-tight">${new Date(apt.date).getDate()}<br>${new Date(apt.date).toLocaleDateString('id-ID',{month:'short'})}</span></div>
                    <div class="min-w-0"><p class="font-medium text-gray-800 text-sm truncate">${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500 truncate">${apt.notes || 'Kontrol ulang'}${apt.time_slot ? ' • '+apt.time_slot : ''}</p><div class="flex items-center gap-2 flex-wrap mt-0.5">${apptResponseBadge(apt.patient_response, apt.proposed_date)}${waSentBadge(apt.wa_reminder_count, apt.wa_last_sent_at)}</div></div>
                  </div>
                  ${wa || `<span class="text-xs text-gray-300">no HP</span>`}
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
  // HANYA pasien yang memang ditangani dokter ini. Daftar yang memuat seluruh
  // isi klinik bukan cuma bocor saat dibuka — ia juga membuat pencarian nama
  // menjadi cara mengetahui siapa saja yang pernah datang ke klinik ini, dan
  // itu sendiri sudah keterangan yang tidak berhak ia miliki.
  // SELURUH pasien klinik. Menyaringnya per dokter membuat pasien yang baru
  // datang tidak bisa dipilih untuk diperiksa — padahal memilihnya untuk
  // diperiksa itulah yang membuatnya jadi pasien dokter tersebut.
  const patients = store.getPatients();
  // Pasien yang punya jejak dengan dokter ini; dipakai hanya untuk menandai,
  // bukan untuk menyaring.
  const miliknya = store.patientIdsForDoctor(doc && doc.id);
  const jumlahSaya = patients.filter(p => miliknya.has(p.id)).length;
  window.__patientsMine = Array.from(miliknya);
  // Editable snapshot keyed by id — the modal looks patients up by id (safe:
  // no free-text embedded in attributes), avoiding the special-char break.
  window.__patientsForEdit = patients.map(p => ({ id: p.id, full_name: p.full_name || '', nik: p.nik || '', birth_date: p.birth_date || '', gender: p.gender || '', phone: p.phone || '', address: p.address || '', blood_type: p.blood_type || '', allergies: p.allergies || '', family_name: p.family_name || '', family_phone: p.family_phone || '', family_relation: p.family_relation || '' }));
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '', showNewForm: false,
    saya: window.__patientsMine || [],
    pernahSaya(id) { return this.saya.indexOf(id) !== -1; },
    newPatient: { full_name:'',nik:'',birth_date:'',gender:'',phone:'',address:'',blood_type:'',allergies:'',family_name:'',family_phone:'',family_relation:'',email:'',password:'pasien123' },
    regSaving: false, regMsg: '', regMsgErr: false,
    async registerPatient() {
      this.regSaving = true; this.regMsg = ''; this.regMsgErr = false;
      const hadEmail = !!(this.newPatient.email && this.newPatient.email.trim());
      try {
        const r = await window.__store.register({ ...this.newPatient });
        if (r && r.error) { this.regMsg = r.error; this.regMsgErr = true; this.regSaving = false; return; }
        window.__showToast && window.__showToast('Pasien tersimpan', hadEmail ? 'Pasien berhasil didaftarkan (tersimpan di cloud).' : 'Pasien didaftarkan tanpa email. Admin bisa menambahkan email nanti untuk login.');
        this.newPatient = { full_name:'',nik:'',birth_date:'',gender:'',phone:'',address:'',blood_type:'',allergies:'',family_name:'',family_phone:'',family_relation:'',email:'',password:'pasien123' };
        this.showNewForm = false; this.regSaving = false;
        setTimeout(function(){ window.__rerender && window.__rerender(); }, 200);
      } catch (e) {
        this.regMsg = 'Terjadi kesalahan tak terduga: ' + (e && e.message ? e.message : e);
        this.regMsgErr = true; this.regSaving = false;
      }
    },
    editPatient: null, savingEdit: false, editMsg: '',
    startEdit(id) { const p = (window.__patientsForEdit||[]).find(x=>x.id===id); this.editPatient = p ? JSON.parse(JSON.stringify(p)) : null; this.editMsg=''; },
    async saveEdit() {
      if (!this.editPatient || !this.editPatient.full_name.trim()) { this.editMsg='Nama lengkap wajib diisi.'; return; }
      this.savingEdit = true;
      const r = await window.__store.updatePatientProfile(this.editPatient.id, this.editPatient);
      this.savingEdit = false;
      if (r && r.error) { this.editMsg = r.error; return; }
      const g = (window.__patientsForEdit||[]).find(x=>x.id===this.editPatient.id); if (g) Object.assign(g, this.editPatient);
      this.editPatient = null;
      window.__showToast && window.__showToast('Tersimpan', 'Data pasien diperbarui.');
      setTimeout(function(){ window.__rerender && window.__rerender(); }, 150);
    }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('patients')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-800">Pasien Klinik</h2>
            <p class="text-[12px] text-muted mt-0.5">${patients.length} pasien${jumlahSaya > 0 ? ` &middot; ${jumlahSaya} pernah Anda tangani` : ''}</p>
          </div>
          <div class="flex gap-2">
            <div class="relative flex-1"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari nama, NIK, telepon..."></div>
            <button @click="showNewForm = !showNewForm" class="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Pasien Baru</button>
          </div>
        </div>
        <div x-show="showNewForm" x-cloak class="bg-white border border-slate-100 rounded-3xl p-6 mb-6">
          <h3 class="font-semibold text-gray-800 mb-4">Registrasi Pasien Baru</h3>
          <div x-show="regMsg" x-cloak class="mb-3 p-2 rounded-lg text-sm" :class="regMsgErr ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'" x-text="regMsg"></div>
          <form @submit.prevent="registerPatient()">
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div><label class="block text-xs text-gray-600 mb-1">Nama Lengkap *</label><input type="text" x-model="newPatient.full_name" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">NIK <span class="text-gray-400">(opsional)</span></label><input type="text" x-model="newPatient.nik" maxlength="16" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Tanggal Lahir <span class="text-gray-400">(opsional)</span></label><input type="date" x-model="newPatient.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label><select x-model="newPatient.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></div>
              <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="newPatient.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Email <span class="text-gray-400">(opsional)</span></label><input type="email" x-model="newPatient.email" placeholder="Kosongkan jika tanpa login" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="newPatient.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Gol. Darah</label><select x-model="newPatient.blood_type" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">-</option><option>A</option><option>B</option><option>AB</option><option>O</option></select></div>
              <div class="col-span-2 lg:col-span-3 pt-2 border-t border-gray-100"><p class="text-xs font-semibold text-gray-600">Kontak Keluarga / Wali <span class="font-normal text-gray-400">— untuk pasien anak, lansia, atau yang tidak memegang HP sendiri</span></p></div>
              <div><label class="block text-xs text-gray-600 mb-1">Nama Keluarga / Wali</label><input type="text" x-model="newPatient.family_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">No. HP Keluarga</label><input type="tel" x-model="newPatient.family_phone" placeholder="0812..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Hubungan dengan Pasien</label><select x-model="newPatient.family_relation" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option>${(CONFIG.FAMILY_RELATIONS||[]).map(r=>`<option>${r}</option>`).join('')}</select></div>
            </div>
            <div class="flex gap-2"><button type="submit" :disabled="regSaving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-text="regSaving ? 'Menyimpan...' : 'Simpan'"></span></button><button type="button" @click="showNewForm=false" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</button></div>
          </form>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">NIK</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Gender</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Telepon</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th></tr></thead>
              <tbody class="divide-y divide-gray-50">
                ${patients.map(p => `
                <template x-if="!search || window.__store.patientMatches(window.__store.getPatient('${p.id}'), search)">
                  <tr class="hover:bg-gray-50 transition">
                    <td class="px-4 py-3"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${escHtml((p.full_name||'').split(' ').map(n=>n[0]).join('').slice(0,2))}</div><div><p class="font-medium text-gray-800 text-sm">${escHtml(p.full_name)}${miliknya.has(p.id) ? ` <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-teal-700 bg-teal-50 align-middle">pasien Anda</span>` : ''}</p><p class="text-xs text-gray-400">${p.blood_type ? 'Gol. '+escHtml(p.blood_type) : ''} ${p.allergies && p.allergies !== '-' ? '| Alergi: '+escHtml(p.allergies) : ''}</p></div></div></td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${escHtml(p.nik)}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">${escHtml(p.gender)}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">${escHtml(p.phone)}</td>
                    <td class="px-4 py-3"><div class="flex gap-1 items-center flex-wrap"><a href="#/doctor/emr/${p.id}" class="px-2 py-1 rounded text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Rekam Medis</a><a href="#/doctor/emr/${p.id}/new" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">+ Kunjungan</a><a href="#/doctor/chat/start/${p.id}" class="px-2 py-1 rounded text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition">Chat</a><button @click="startEdit('${p.id}')" class="px-2 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Edit</button>${waButton(p.phone, waSapaMsg(p.full_name), 'WA', { patientId: p.id })}</div></td>
                  </tr>
                </template>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Edit Data Pasien -->
        <div x-show="editPatient" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="editPatient=null">
          <div class="bg-white rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-800">Edit Data Pasien</h3>
              <button @click="editPatient=null" class="text-gray-400 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <template x-if="editPatient">
              <div>
                <div x-show="editMsg" class="mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm" x-text="editMsg"></div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Nama Lengkap *</label><input type="text" x-model="editPatient.full_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">NIK</label><input type="text" x-model="editPatient.nik" maxlength="16" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Tanggal Lahir</label><input type="date" x-model="editPatient.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label><select x-model="editPatient.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="editPatient.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="editPatient.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Gol. Darah</label><select x-model="editPatient.blood_type" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">-</option><option>A</option><option>B</option><option>AB</option><option>O</option></select></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Alergi</label><input type="text" x-model="editPatient.allergies" placeholder="- bila tidak ada" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div class="col-span-2 pt-2 border-t border-gray-100"><p class="text-xs font-semibold text-gray-600">Kontak Keluarga / Wali</p></div>
                  <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Nama Keluarga / Wali</label><input type="text" x-model="editPatient.family_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">No. HP Keluarga</label><input type="tel" x-model="editPatient.family_phone" placeholder="0812..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Hubungan dgn Pasien</label><select x-model="editPatient.family_relation" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option>${(CONFIG.FAMILY_RELATIONS||[]).map(r=>`<option>${r}</option>`).join('')}</select></div>
                </div>
                <div class="flex gap-2 mt-5">
                  <button @click="saveEdit()" :disabled="savingEdit" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-text="savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'"></span></button>
                  <button @click="editPatient=null" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorEMR(params) {
  const doc = getDoctor();
  const patient = store.getPatient(params.patientId);
  if (!patient) return `<div class="min-h-screen flex items-center justify-center"><p class="text-gray-500">Pasien tidak ditemukan</p></div>`;
  // Diperiksa SEBELUM satu pun baris rekam medis dibaca — bukan sesudahnya
  // lalu disembunyikan di tampilan, karena data yang sudah masuk ke halaman
  // tetap bisa dibaca dari sumber halamannya.
  const akses = aksesRM(params.patientId);
  if (!akses.boleh) return rmTerkunci(patient);
  const records = store.getRecords(params.patientId);
  const vaccinations = store.getVaccinations(params.patientId);

  // Prefill the Surat Keterangan form from the latest visit's vital signs +
  // diagnosis, so the doctor rarely has to retype anything (all still editable).
  const q = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
  // Katalog pemeriksaan + penolongnya dibuka lewat window, bukan disalin ke
  // dalam atribut x-data: namanya memuat tanda kurung dan garis miring, dan
  // satu tanda kutip ganda di dalam x-data akan memotong atributnya.
  window.__labPanel = LAB_PANEL.map(t => ({ key: t.key, nama: t.nama, kelompok: t.kelompok,
    jenis: t.jenis, satuan: t.satuan || '', pilihan: t.pilihan || [], catatan: t.catatan || '' }));
  window.__labKelompok = KELOMPOK;
  window.__labRujukan = (key, gender) => teksRujukan(LAB_PANEL.find(t => t.key === key), gender);
  window.__labSusun = (pilihan, gender) => susunHasil(pilihan, gender);
  window.__labKalimatNarkoba = (items) => kalimatNarkoba(items);
  window.__labCatatanNarkoba = CATATAN_NARKOBA;

  const latestVs = (records[0] && records[0].vital_signs) || {};
  const skdPrefill = {
    no_rm: q(patient.rm_number || ''),
    bb: q(latestVs.bb || ''), tb: q(latestVs.tb || ''), td: q(latestVs.td || ''), nadi: q(latestVs.nadi || ''),
    diagnosis: q(records[0] && records[0].diagnosis || ''), today: todayLocal(),
    birth_date: patient.birth_date || '', gender: q(patient.gender || ''), address: q(patient.address || ''),
    golongan_darah: q(patient.blood_type || ''),
  };

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, activeTab: 'records',
    kedatangan: null,
    async cekKedatangan() { try { this.kedatangan = await window.__store.fetchCheckinForPatientToday('${patient.id}'); } catch (e) { this.kedatangan = null; } },
    skdOpen: false, skdType: 'sehat',
    // KUNJUNGAN YANG MENDASARI SURAT INI. Surat keterangan sakit tanpa rekam
    // medis adalah pernyataan tentang pemeriksaan yang tidak ada catatannya —
    // dan itu yang pertama dicari saat suratnya dipertanyakan. Diisi saat
    // surat dibuka DARI kartu kunjungan; kosong bila dibuka dari tombol umum
    // di atas, dan surat itu langsung masuk daftar Kewajiban RM.
    skdRecordId: '',
    skd: { no_rm: '${skdPrefill.no_rm}', letter_date: '${skdPrefill.today}',
      birth_date: '${skdPrefill.birth_date}', gender: '${skdPrefill.gender}', address: '${skdPrefill.address}',
      berat_badan: '${skdPrefill.bb}', tinggi_badan: '${skdPrefill.tb}', tekanan_darah: '${skdPrefill.td}', nadi: '${skdPrefill.nadi}',
      golongan_darah: '${skdPrefill.golongan_darah}', buta_warna: '',
      keperluan: '', kesimpulan: 'SEHAT FISIK DAN MENTAL',
      diagnosis: '${skdPrefill.diagnosis}', rest_days: '', from_date: '${skdPrefill.today}', to_date: '',
      tujuan_faskes: '', tujuan_dokter: '', anamnesis: '', pemeriksaan: '', penunjang: '',
      terapi: '', alasan: '', harapan: 'Mohon pemeriksaan dan penanganan lebih lanjut sesuai kompetensi.',
      icd10: '', suhu: '', rr: '',
      lab_keperluan: '', lab_metode: '', lab_catatan: '' },

    // ---- Surat hasil pemeriksaan -----------------------------------------
    // Dicentang dulu, baru diisi hasilnya. Yang dicentang tanpa diisi TIDAK
    // ikut tercetak: barisnya yang kosong akan terbaca sebagai 'diperiksa,
    // hasilnya tidak ada', padahal yang benar adalah belum diperiksa.
    labPilih: {},
    labHasil: {},
    labRujukan: {},
    labPanel: window.__labPanel || [],
    labKelompok: window.__labKelompok || [],
    labCentang(key) {
      this.labPilih[key] = !this.labPilih[key];
      if (!this.labPilih[key]) { this.labHasil[key] = ''; return; }
      // Rujukan bawaan diisikan supaya bisa langsung disunting kalau reagen
      // kliniknya berbeda — bukan disembunyikan lalu tercetak diam-diam.
      if (!this.labRujukan[key]) this.labRujukan[key] = window.__labRujukan(key, this.skd.gender);
    },
    labTerpilih() { return this.labPanel.filter(t => this.labPilih[t.key]); },
    get labJumlah() { return this.labTerpilih().length; },
    // Yang sudah dicentang DAN sudah ada hasilnya — inilah yang akan tercetak.
    labSiap() {
      return this.labTerpilih().filter(t => String(this.labHasil[t.key] || '').trim()).length;
    },
    labSusun() {
      return window.__labSusun(this.labTerpilih().map(t => ({
        key: t.key, hasil: this.labHasil[t.key], rujukan: this.labRujukan[t.key],
      })), this.skd.gender);
    },
    // Tanda H / L / * dihitung dari nilai yang sedang diketik, jadi kelainannya
    // terlihat SEBELUM suratnya terbit — bukan baru ketahuan sesudah dicetak.
    labTanda(key) {
      const it = window.__labSusun([{ key, hasil: this.labHasil[key], rujukan: this.labRujukan[key] }], this.skd.gender)[0];
      return it ? it.tanda : '';
    },
    get labKesimpulan() {
      if (this.skdType !== 'narkoba') return '';
      return window.__labKalimatNarkoba(this.labSusun());
    },
    // Membuka formulir surat DARI sebuah kunjungan: isinya diambil dari
    // kunjungan itu, bukan dari kunjungan terakhir. Rujukan yang memuat
    // anamnesis kunjungan lain lebih berbahaya daripada rujukan yang kosong.
    suratDari(rec, jenis) {
      this.skdRecordId = rec.id || '';
      this.skdType = jenis;
      const v = rec.vital_signs || {};
      this.skd.diagnosis = rec.diagnosis || '';
      this.skd.anamnesis = rec.anamnesis || '';
      this.skd.pemeriksaan = rec.examination || '';
      this.skd.terapi = rec.therapy || '';
      this.skd.icd10 = rec.icd10_code || '';
      this.skd.berat_badan = v.bb || ''; this.skd.tinggi_badan = v.tb || '';
      this.skd.tekanan_darah = v.td || ''; this.skd.nadi = v.nadi || '';
      this.skd.suhu = v.suhu || ''; this.skd.rr = v.rr || '';
      if (jenis === 'sakit') { this.skd.from_date = rec.visit_date || this.skd.from_date; this.syncSuratDate(); }
      this.skdOpen = true;
    },
    // Tombol umum di atas halaman: tidak terikat kunjungan mana pun.
    suratLepas() { this.skdRecordId = ''; this.skdType = 'sehat'; this.skdOpen = true; },
    submitSKD() {
      // Merge the identity fields back into the patient record (and persist)
      // so they're saved for next time, then print the letter. The RM number is
      // assigned automatically by the system (see ensureRmNumber), not typed.
      window.__store.updatePatientProfile('${patient.id}', { birth_date: this.skd.birth_date, gender: this.skd.gender, address: this.skd.address });
      const surat = { patientId: '${patient.id}', type: this.skdType, recordId: this.skdRecordId, ...this.skd };
      if (this.skdType === 'lab' || this.skdType === 'narkoba') {
        const items = this.labSusun();
        // Surat hasil pemeriksaan tanpa satu pun hasil adalah surat yang
        // menyatakan sesuatu yang tidak dikerjakan. Ditahan di sini, bukan
        // dibiarkan terbit lalu ketahuan sesudah dicetak.
        if (!items.length) { alert('Belum ada pemeriksaan yang dicentang DAN diisi hasilnya. Surat hasil pemeriksaan tidak bisa diterbitkan tanpa hasil.'); return; }
        surat.lab_items = items;
        if (this.skdType === 'narkoba') {
          surat.lab_kesimpulan = this.labKesimpulan;
          // Kalimat penapisan SELALU ikut. Dokter boleh menambahkan catatan
          // sendiri, tapi tidak menghilangkan yang ini: surat yang menyimpulkan
          // tanpa menyebut batas pemeriksaannya menyatakan lebih daripada yang
          // bisa dibuktikan alatnya.
          surat.lab_catatan = [window.__labCatatanNarkoba, String(this.skd.lab_catatan || '').trim()].filter(Boolean).join(' ');
        }
      }
      window.__generateSKD(surat);
      this.skdOpen = false;
      this.skdRecordId = '';
      setTimeout(() => this.loadSKD && this.loadSKD(), 600);
    },
    labList: [], labLoading: true, labOpen: false, labFile: null, labSaving: false,
    lab: { category: 'lab', test_name: '', result_date: '${skdPrefill.today}', interpretation: '', notes: '', params: [{name:'',value:'',unit:'',ref:''}] },
    async loadLab() { try { this.labList = await window.__store.getLabResults('${patient.id}'); } catch(e) { this.labList = []; } this.labLoading = false; },
    labAddParam() { this.lab.params.push({name:'',value:'',unit:'',ref:''}); },
    resetLab() { this.lab = { category: 'lab', test_name: '', result_date: '${skdPrefill.today}', interpretation: '', notes: '', params: [{name:'',value:'',unit:'',ref:''}] }; this.labFile = null; },
    async submitLab() {
      if (!this.lab.test_name.trim()) { alert('Isi nama pemeriksaan dulu.'); return; }
      this.labSaving = true;
      const params = this.lab.params.filter(p => (p.name||'').trim() || (p.value||'').trim());
      const res = await window.__store.addLabResult({ patient_id:'${patient.id}', doctor_id:'${doc?.id}', category:this.lab.category, test_name:this.lab.test_name, result_date:this.lab.result_date, parameters: params, interpretation:this.lab.interpretation, notes:this.lab.notes }, this.labFile);
      this.labSaving = false;
      if (res.error) { alert('Gagal menyimpan: ' + res.error); return; }
      this.labOpen = false; this.resetLab(); this.loadLab();
    },
    // Berkas dibuka DI DALAM halaman, bukan di tab baru.
    //
    // Sebelumnya window.open dipanggil SESUDAH await — dan peramban memblokir
    // jendela yang dibuka bukan langsung dari klik, jadi berkasnya tidak
    // pernah terbuka sama sekali. Penampil di halaman sekaligus menghapus
    // masalah itu: tidak ada jendela baru yang perlu diizinkan.
    labViewOpen: false, labViewUrl: '', labViewName: '', labViewErr: '', labViewLoading: false,
    labIsImage(nama) { return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(String(nama || '')); },
    async viewLabFile(item) {
      this.labViewOpen = true;
      this.labViewLoading = true;
      this.labViewErr = '';
      this.labViewUrl = '';
      this.labViewName = (item && (item.file_name || item.test_name)) || 'Berkas';
      try {
        const url = await window.__store.getLabFileUrl(item && item.file_path);
        if (url) this.labViewUrl = url;
        else this.labViewErr = 'Berkas tidak bisa dibuka. Pastikan supabase-lab-results.sql sudah dijalankan (tabel & bucket lab-files), lalu unggah ulang berkasnya.';
      } catch (e) {
        this.labViewErr = (e && e.message) || 'Berkas tidak bisa dibuka.';
      }
      this.labViewLoading = false;
    },
    async delLab(item) { if (!confirm('Hapus hasil penunjang ini?')) return; await window.__store.deleteLabResult(item.id, item.file_path); this.loadLab(); },
    skdList: [], skdLoading: true,
    // Surat sakit bertanggal sesuai hari pertama sakitnya, bukan hari
    // pencetakannya — lihat js/skd.js. Disetel di sini juga supaya yang
    // terlihat di layar sama dengan yang nanti tercetak.
    syncSuratDate() { if (this.skdType !== 'sehat' && this.skd.from_date) this.skd.letter_date = this.skd.from_date; },
    async loadSKD() { try { this.skdList = await window.__store.getSKDForPatient('${patient.id}'); } catch(e) { this.skdList = []; } this.skdLoading = false; },
    skdStat(s) { return (s.details && s.details.approval && s.details.approval.status) || 'approved'; },
    async cancelSKD(id) {
      const s = (this.skdList || []).find(x => x.id === id);
      const nomor = s ? s.cert_number : '';
      if (!confirm('Batalkan surat ' + (nomor || 'ini') + '?\\n\\nNomor surat ini akan dianggap DIBATALKAN, dan saat QR-nya dipindai akan tampil “Dibatalkan / Tidak Valid”.')) return;
      const r = await window.__store.cancelSKD(id);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      window.__showToast && window.__showToast('Dibatalkan', 'Surat ' + (nomor || '') + ' telah dibatalkan.');
      await this.loadSKD();
    }
  }" x-init="loadLab(); loadSKD(); cekKedatangan(); if (!skd.no_rm) window.__store.ensureRmNumber('${patient.id}').then(rm => { skd.no_rm = rm; })" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center gap-2 mb-4 text-sm text-gray-500"><a href="#/doctor/patients" class="hover:text-teal-600 transition">Pasien</a><span>/</span><span class="text-gray-800 font-medium">${escHtml(patient.full_name)}</span></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${escHtml(patient.full_name.split(' ').map(n=>n[0]).join('').slice(0,2))}</div>
              <div>
                <h2 class="text-lg font-bold text-gray-800">${escHtml(patient.full_name)}</h2>
                <p class="text-sm text-gray-500">${escHtml(patient.gender)}, ${patient.birth_date ? Math.floor((Date.now()-new Date(patient.birth_date))/(365.25*24*60*60*1000)) + ' thn' : '-'} | NIK: ${escHtml(patient.nik)}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 text-xs">
              <span class="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 font-medium">Gol. Darah: ${escHtml(patient.blood_type || '-')}</span>
              <span class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-medium">Alergi: ${escHtml(patient.allergies || '-')}</span>
              <span class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium">Telp: ${escHtml(patient.phone || '-')}</span>
              ${patient.family_phone || patient.family_name ? `<span class="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 font-medium">Keluarga: ${escHtml(patient.family_name || '-')}${patient.family_relation ? ' (' + escHtml(patient.family_relation) + ')' : ''}${patient.family_phone ? ' — ' + escHtml(patient.family_phone) : ''}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex gap-2 mb-4">
          <button @click="activeTab='records'" :class="activeTab==='records' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Rekam Medis (${records.length})</button>
          <button @click="activeTab='vaccinations'" :class="activeTab==='vaccinations' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Vaksinasi (${vaccinations.length})</button>
          <button @click="activeTab='penunjang'" :class="activeTab==='penunjang' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Penunjang (<span x-text="labList.length"></span>)</button>
          <button @click="activeTab='surat'" :class="activeTab==='surat' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-4 py-2 rounded-lg text-sm font-medium transition">Surat (<span x-text="skdList.length"></span>)</button>
          <span class="ml-auto flex items-center gap-2">
            <span x-show="kedatangan" x-cloak class="px-2.5 py-1 rounded-full text-[11px] font-bold" :class="kedatangan && kedatangan.payment_type === 'bpjs' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'" x-text="kedatangan && kedatangan.payment_type === 'bpjs' ? 'Kunjungan BPJS' : 'Kunjungan Umum'"></span>
            ${waButton(patient.phone, waSapaMsg(patient.full_name), 'WhatsApp', { patientId: patient.id })}
          </span>
          <button @click="suratLepas()" class="px-4 py-2 rounded-lg text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition">Surat Keterangan</button>
          <a href="#/doctor/emr/${patient.id}/new" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Kunjungan Baru</a>
        </div>
        <div x-show="activeTab==='records'">
          ${records.length === 0 ? '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">Belum ada rekam medis</div>' :
          records.map(r => {
            const doctor = store.getDoctor(r.doctor_id);
            const rxList = store.getPrescriptionsByRecord(r.id);
            const suratList = store.getCertificatesByRecord(r.id);
            // Dikirim ke suratDari() lewat window, bukan ditulis ke dalam
            // atribut x-data: isinya teks bebas dari rekam medis, dan satu
            // tanda kutip ganda di dalam x-data memutus atributnya sehingga
            // Alpine mati untuk seluruh halaman.
            window.__recForSurat = window.__recForSurat || {};
            window.__recForSurat[r.id] = {
              id: r.id, visit_date: r.visit_date || '', diagnosis: r.diagnosis || '',
              anamnesis: r.anamnesis || '', examination: r.examination || '',
              therapy: r.therapy || '', icd10_code: r.icd10_code || '',
              vital_signs: r.vital_signs || {},
            };
            return `<div class="bg-white border border-slate-100 rounded-3xl mb-4 overflow-hidden" x-data="{open:false}">
              <div class="p-4 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between" @click="open=!open">
                <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><svg class="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div><p class="font-medium text-gray-800">${formatDate(r.visit_date)}</p><p class="text-sm text-gray-500">${r.diagnosis} — ${doctor?.full_name || ''}</p></div></div>
                <div class="flex items-center gap-2">${r.follow_up_date ? `<span class="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">Kontrol: ${formatDate(r.follow_up_date)}</span>` : ''}<svg class="w-5 h-5 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></div>
              </div>
              <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50">
                <div class="grid lg:grid-cols-2 gap-4 text-sm">
                  <div><h4 class="font-semibold text-gray-700 mb-1">Anamnesis</h4><p class="text-gray-600">${r.anamnesis}</p></div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Pemeriksaan Fisik</h4><p class="text-gray-600 whitespace-pre-line">${r.examination || '-'}</p>${r.vital_signs ? `<div class="flex flex-wrap gap-2 mt-2">${Object.entries(r.vital_signs).map(([k,v])=>`<span class="px-2 py-1 rounded bg-white border border-gray-200 text-xs">${k.toUpperCase()}: ${v}</span>`).join('')}</div>` : ''}</div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Diagnosis</h4><p class="text-gray-600 font-medium">${r.diagnosis}</p>${r.diagnosis_secondary ? `<p class="text-gray-500 text-xs mt-1">Sekunder: ${r.diagnosis_secondary}</p>` : ''}</div>
                  <div><h4 class="font-semibold text-gray-700 mb-1">Terapi Non-Farmakologis</h4><p class="text-gray-600">${r.therapy || '-'}</p></div>
                </div>
                ${r.follow_up_date ? `<div class="mt-4 pt-4 border-t border-gray-100"><div class="flex items-start justify-between gap-2 flex-wrap"><div><h4 class="font-semibold text-gray-700 mb-1 text-sm">Jadwal Kontrol Ulang</h4><p class="text-sm text-blue-700 font-medium">${formatDate(r.follow_up_date)}</p>${r.follow_up_notes ? `<p class="text-sm text-gray-500 mt-0.5">${r.follow_up_notes}</p>` : ''}${waSentBadge(r.wa_reminder_count, r.wa_last_sent_at)}</div><div>${waButton(patient.phone, waKontrolMsg(patient.full_name, formatDate(r.follow_up_date), r.follow_up_notes), 'Ingatkan via WA', { logTable: 'medical_records', logId: r.id })}</div></div></div>` : ''}
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
                      ${rx.status === 'rejected' && rx.reject_reason ? `<p class="text-xs text-red-600 mb-1">Ditolak: ${escHtml(rx.reject_reason)}</p>` : ''}
                      <div class="space-y-1.5">${rxItems.map(i => i.is_compound ? `
                        <div class="rounded-lg border border-purple-200 bg-purple-50/60 p-2">
                          <p class="text-xs font-semibold text-purple-700 mb-1">${i.display_name || i.drug_name} (Racikan)</p>
                          <p class="text-xs text-gray-700 whitespace-pre-line leading-relaxed">${(i.compound_details || '-').trim()}</p>
                          <p class="text-xs text-gray-500 mt-1">${i.frequency||''} ${i.time||''} (${i.quantity||'-'} ${i.unit||''})</p>
                        </div>` : `<p class="text-xs text-gray-600">• ${escHtml(i.drug_name)} ${escHtml(i.dosage||'')} — ${escHtml(i.frequency||'')} ${escHtml(i.time||'')} (${escHtml(String(i.quantity||'-'))} ${escHtml(i.unit||'')})</p>`).join('')}</div>
                    </div>`;
                  }).join('')}
                </div>
                <!-- SURAT YANG SUDAH TERBIT DARI KUNJUNGAN INI. Ditampilkan
                     di sini, bukan hanya di tab Surat, supaya dokter tidak
                     menerbitkan surat sakit kedua hanya karena yang pertama
                     tidak terlihat di layar yang sedang dibukanya. -->
                <div class="mt-4 pt-4 border-t border-gray-100">
                  <h4 class="font-semibold text-gray-700 mb-2 text-sm">Surat dari Kunjungan Ini</h4>
                  ${suratList.length === 0
                    ? '<p class="text-sm text-gray-400">Belum ada surat diterbitkan dari kunjungan ini</p>'
                    : `<div class="space-y-1.5">${suratList.map(c => {
                        const st = (c.details && c.details.approval && c.details.approval.status) || 'approved';
                        const warna = st === 'approved' ? 'bg-green-100 text-green-700' : (st === 'rejected' ? 'bg-red-100 text-red-700' : (st === 'cancelled' ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-700'));
                        const label = { approved: 'Sah', pending: 'Menunggu ACC', rejected: 'Ditolak', cancelled: 'Dibatalkan' }[st] || st;
                        const jenis = store.suratJenisLabel(c);
                        const jw = jenis === 'Rujukan' ? 'bg-indigo-100 text-indigo-700' : (jenis === 'Sehat' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700');
                        return `<div class="bg-white border border-gray-100 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="px-2 py-0.5 rounded-full text-xs font-medium ${jw}">Surat ${jenis}</span>
                              <span class="px-2 py-0.5 rounded-full text-xs font-medium ${warna}">${label}</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-0.5">No. ${escHtml(c.cert_number || '-')}</p>
                          </div>
                          <button onclick="window.__printSKD('${c.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition shrink-0">${st === 'approved' ? 'Cetak Ulang' : 'Lihat'}</button>${st === 'approved' ? `<button onclick="window.__batalkanSKD('${c.id}', function(){ window.__rerender && window.__rerender() })" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition shrink-0">Batalkan</button>` : ''}
                        </div>`;
                      }).join('')}</div>`}
                </div>

                <!-- TITIK BERANGKAT. Surat & resep lahir DARI kunjungan, bukan
                     berdiri sendiri lalu ditagih rekam medisnya belakangan —
                     tombol-tombol ini yang membuat urutan itu menjadi jalan
                     yang paling mudah, bukan sekadar yang dianjurkan. -->
                <div class="mt-4 pt-4 border-t border-gray-100">
                  <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Terbitkan dari kunjungan ini</p>
                  <div class="flex gap-2 flex-wrap">
                    <a href="#/doctor/prescriptions/new/${r.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 transition inline-flex items-center gap-1"><span class="ms text-[15px]">prescriptions</span>E-Resep</a>
                    <button @click="suratDari(window.__recForSurat['${r.id}'], 'sehat')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Surat Sehat</button>
                    <button @click="suratDari(window.__recForSurat['${r.id}'], 'sakit')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Surat Sakit</button>
                    <button @click="suratDari(window.__recForSurat['${r.id}'], 'rujukan')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition inline-flex items-center gap-1"><span class="ms text-[15px]">forward_to_inbox</span>Surat Rujukan</button>
                  </div>
                </div>

                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap"><a href="#/doctor/emr/edit/${r.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit Rekam Medis</a><button onclick="window.__hapusRekam('${r.id}', '${qAttr(formatDate(r.visit_date))}')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition ml-auto">Hapus Kunjungan</button></div>
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
                  ${doses.map(d => `<div x-data="{editing:false}">
                  <div class="flex items-center gap-3 p-3 rounded-lg ${d.date_given ? 'bg-green-50' : 'bg-gray-50'}">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${d.date_given ? 'bg-green-500' : 'bg-gray-300'} text-white text-xs font-bold">${d.dose_number}</div>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800">Dosis ${d.dose_number}/${d.total_doses} ${d.date_given ? '— Selesai' : '— Terjadwal'}${d.vaccine_brand ? ' | '+d.vaccine_brand : ''}</p>
                      <p class="text-xs text-gray-500">${d.date_given ? formatDate(d.date_given) + (d.batch_number ? ' | Batch: '+d.batch_number : '') + (d.location ? ' | '+d.location : '') : 'Jadwal: ' + formatDate(d.next_dose_date)}</p>
                    </div>
                    <div class="flex gap-1">
                      <button @click="editing=!editing" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit</button>
                      <button onclick="if(confirm('Hapus data vaksinasi dosis ini?')){window.__store.deleteVaccination('${d.id}'); setTimeout(function(){ window.__rerender && window.__rerender() }, 150)}" class="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
                    </div>
                  </div>
                  <template x-if="editing"><div class="ml-11 mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm" x-data="{
                    ef: { dose_number: ${d.dose_number}, total_doses: ${d.total_doses}, vaccine_brand:'${qAttr(d.vaccine_brand)}', batch_number:'${qAttr(d.batch_number)}', location:'${qAttr(d.location)}', date_given:'${d.date_given||''}', next_dose_date:'${d.next_dose_date||''}' },
                    saveVax() {
                      const r = window.__store.updateVaccination('${d.id}', this.ef);
                      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
                      this.editing = false;
                      window.__showToast && window.__showToast('Tersimpan', 'Data vaksinasi diperbarui.');
                      setTimeout(function(){ window.__rerender && window.__rerender() }, 150);
                    }
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
                      <div class="flex items-end gap-1">
                        <button @click="saveVax()" class="px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition flex-1">Simpan</button>
                        <button @click="editing=false" class="px-3 py-1.5 rounded text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Batal</button>
                      </div>
                    </div>
                  </div></template>
                  </div>
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
                    const activeLocs = store.getLocationNames();
                    const loc = lastDose.location || activeLocs[0];
                    const boosterInterval = doses[0]?.booster_interval_months || 12;
                    const label = isBooster ? 'Berikan Booster' : `Berikan Dosis ${nextDoseNum}/${totalD}`;
                    // Tempat dosis sebelumnya ikut jadi opsi walau sudah dihapus
                    // dari master, supaya nilai awal select-nya tetap cocok.
                    const locations = (loc && !activeLocs.includes(loc)) ? [loc].concat(activeLocs) : activeLocs;

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
                            vaccine_name: '${qAttr(name)}',
                            vaccine_brand: '${qAttr(brand)}',
                            vax_mode: '${isBooster ? 'booster' : 'series'}',
                            dose_number: ${isBooster ? lastDose.dose_number + 1 : nextDoseNum},
                            total_doses: ${totalD},
                            batch_number: '',
                            date_given: new Date().toLocaleDateString('en-CA'),
                            next_dose_date: '',
                            location: '${qAttr(loc)}',
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
                            self.af.next_dose_date = next.toLocaleDateString('en-CA');
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
                              setTimeout(function(){ window.__rerender && window.__rerender() }, 150);
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

        <!-- PENUNJANG (Lab & Radiologi) -->
        <div x-show="activeTab==='penunjang'" x-cloak>
          <div class="flex justify-end mb-3">
            <button @click="labOpen=true" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah Hasil Penunjang</button>
          </div>
          <div x-show="labLoading" class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Memuat...</div>
          <template x-if="!labLoading && labList.length===0"><div class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Belum ada hasil lab / radiologi</div></template>
          <div class="space-y-3">
            <template x-for="item in labList" :key="item.id">
              <div class="bg-white border border-slate-100 rounded-3xl p-4">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="item.category==='radiologi' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'" x-text="item.category==='radiologi' ? 'Radiologi' : 'Laboratorium'"></span>
                      <span class="font-semibold text-gray-800" x-text="item.test_name"></span>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5" x-text="item.result_date || ''"></p>
                    <p x-show="item.file_name" x-cloak class="text-[11px] text-blue-600 mt-0.5 flex items-center gap-1"><span class="ms text-[13px]">attach_file</span><span x-text="item.file_name"></span></p>
                  </div>
                  <div class="flex gap-2">
                    <button x-show="item.file_path" @click="viewLabFile(item)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition flex items-center gap-1"><span class="ms text-[14px]">description</span>Baca Berkas</button>
                    <button @click="delLab(item)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
                  </div>
                </div>
                <div x-show="item.parameters && item.parameters.length" class="mt-3 overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead><tr class="text-xs text-gray-400 text-left"><th class="py-1 pr-3 font-medium">Parameter</th><th class="py-1 pr-3 font-medium">Hasil</th><th class="py-1 pr-3 font-medium">Satuan</th><th class="py-1 font-medium">Rujukan</th></tr></thead>
                    <tbody>
                      <template x-for="(p,pi) in item.parameters" :key="pi">
                        <tr class="border-t border-gray-50"><td class="py-1 pr-3 text-gray-700" x-text="p.name"></td><td class="py-1 pr-3 font-semibold text-gray-800" x-text="p.value"></td><td class="py-1 pr-3 text-gray-500" x-text="p.unit"></td><td class="py-1 text-gray-500" x-text="p.ref"></td></tr>
                      </template>
                    </tbody>
                  </table>
                </div>
                <p x-show="item.interpretation" class="mt-2 text-sm text-gray-700"><span class="font-semibold">Kesan/Interpretasi:</span> <span x-text="item.interpretation"></span></p>
                <p x-show="item.notes" class="mt-1 text-xs text-gray-500" x-text="'Catatan: '+item.notes"></p>
              </div>
            </template>
          </div>
        </div>

        <!-- SURAT KETERANGAN (daftar + edit) -->
        <div x-show="activeTab==='surat'" x-cloak>
          <div class="flex justify-end mb-3">
            <button @click="suratLepas()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Buat Surat Keterangan</button>
          </div>
          <div x-show="skdLoading" class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Memuat surat...</div>
          <template x-if="!skdLoading && skdList.length===0"><div class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Belum ada surat keterangan untuk pasien ini.</div></template>
          <div class="space-y-2">
            <template x-for="s in skdList" :key="s.id">
              <div class="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="((s.perihal||'')==='RUJUKAN')?'bg-indigo-100 text-indigo-700':(((s.perihal||'')==='SEHAT')?'bg-teal-100 text-teal-700':'bg-amber-100 text-amber-700')" x-text="'Surat '+((s.perihal||'').charAt(0)+(s.perihal||'').slice(1).toLowerCase())"></span>
                    <!-- Surat tanpa rekam medis ditandai DI DAFTARNYA, bukan
                         hanya di halaman Kewajiban RM: yang membuka daftar ini
                         adalah orang yang sedang memeriksa suratnya. -->
                    <span x-show="!s.record_id && !(s.details && s.details.record_id)" x-cloak class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-white" title="Surat ini belum tertaut ke kunjungan mana pun">tanpa RM</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="{ 'bg-green-100 text-green-700': skdStat(s)==='approved', 'bg-orange-100 text-orange-700': skdStat(s)==='pending', 'bg-red-100 text-red-700': skdStat(s)==='rejected', 'bg-slate-200 text-slate-600': skdStat(s)==='cancelled' }" x-text="({ approved:'Sah', pending:'Menunggu ACC', rejected:'Ditolak', cancelled:'Dibatalkan' })[skdStat(s)]"></span>
                  </div>
                  <p class="text-sm font-medium text-gray-800 mt-1" x-text="'No. '+s.cert_number"></p>
                  <p class="text-xs text-gray-500" x-text="'Dokter: '+(s.doctor_name||'-')"></p>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="window.__editSKD(s.id, () => loadSKD())" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Edit</button>
                  <button @click="window.__printSKD(s.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition" x-text="skdStat(s)==='approved' ? 'Cetak Ulang' : 'Lihat'"></button>
                  <button x-show="skdStat(s)==='approved'" @click="cancelSKD(s.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Batalkan</button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Penampil berkas penunjang. Dibuka di dalam halaman supaya hasil lab
             bisa langsung dibaca tanpa berpindah tab — dan tanpa berurusan
             dengan pemblokir popup. -->
        <div x-show="labViewOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70" @click.self="labViewOpen=false" @keydown.escape.window="labViewOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <span class="ms text-[20px] text-blue-600">description</span>
              <p class="font-semibold text-gray-800 text-sm truncate flex-1" x-text="labViewName"></p>
              <a :href="labViewUrl" x-show="labViewUrl" x-cloak target="_blank" rel="noopener" class="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Buka di tab baru</a>
              <a :href="labViewUrl" :download="labViewName" x-show="labViewUrl" x-cloak class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">Unduh</a>
              <button @click="labViewOpen=false" class="w-8 h-8 rounded-lg hover:bg-slate-100 text-gray-400 hover:text-gray-700 flex items-center justify-center"><span class="ms text-[20px]">close</span></button>
            </div>
            <div class="flex-1 min-h-0 bg-slate-100">
              <div x-show="labViewLoading" class="h-full flex items-center justify-center text-sm text-gray-500">Membuka berkas...</div>
              <div x-show="labViewErr" x-cloak class="h-full flex items-center justify-center p-8">
                <p class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-4 max-w-lg leading-relaxed" x-text="labViewErr"></p>
              </div>
              <template x-if="labViewUrl && labIsImage(labViewName)">
                <div class="h-full overflow-auto p-3 flex items-start justify-center"><img :src="labViewUrl" :alt="labViewName" class="max-w-full rounded-lg shadow"></div>
              </template>
              <template x-if="labViewUrl && !labIsImage(labViewName)">
                <iframe :src="labViewUrl" class="w-full h-full border-0" title="Hasil penunjang"></iframe>
              </template>
            </div>
          </div>
        </div>

        <!-- Modal tambah hasil penunjang -->
        <div x-show="labOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="labOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold text-gray-800">Tambah Hasil Penunjang</h3><button @click="labOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div><label class="block text-xs text-gray-600 mb-1">Jenis</label><select x-model="lab.category" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="lab">Laboratorium</option><option value="radiologi">Radiologi</option></select></div>
              <div><label class="block text-xs text-gray-600 mb-1">Tanggal</label><input type="date" x-model="lab.result_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Nama Pemeriksaan *</label><input type="text" x-model="lab.test_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Darah Lengkap, Rontgen Thorax PA"></div>
            </div>
            <div class="mb-3">
              <div class="flex items-center justify-between mb-1"><label class="block text-xs text-gray-600">Parameter Hasil (isi manual sesuai yang diperiksa)</label><button type="button" @click="labAddParam()" class="text-xs text-teal-600 font-medium">+ Tambah baris</button></div>
              <div class="space-y-2">
                <template x-for="(p,pi) in lab.params" :key="pi">
                  <div class="grid grid-cols-12 gap-2 items-center">
                    <input type="text" x-model="p.name" placeholder="Parameter (mis. Hb)" class="col-span-4 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                    <input type="text" x-model="p.value" placeholder="Nilai" class="col-span-3 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                    <input type="text" x-model="p.unit" placeholder="Satuan" class="col-span-2 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                    <input type="text" x-model="p.ref" placeholder="Rujukan" class="col-span-2 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                    <button type="button" @click="lab.params.splice(pi,1)" x-show="lab.params.length>1" class="col-span-1 text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                </template>
              </div>
            </div>
            <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Kesan / Interpretasi</label><textarea x-model="lab.interpretation" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Cor & pulmo dalam batas normal / kesan hasil lab..."></textarea></div>
            <div class="mb-3">
              <label class="block text-xs text-gray-600 mb-1">Upload Berkas (PDF/gambar, opsional)</label>
              <input type="file" accept=".pdf,image/*" @change="labFile = $event.target.files[0]" class="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-sm file:font-medium">
              <p x-show="labFile" x-cloak class="text-xs text-gray-500 mt-1" x-text="labFile ? 'Terpilih: '+labFile.name : ''"></p>
            </div>
            <div class="flex gap-2 justify-end mt-5">
              <button @click="labOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="submitLab()" :disabled="labSaving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!labSaving">Simpan Hasil</span><span x-show="labSaving" x-cloak>Menyimpan...</span></button>
            </div>
          </div>
        </div>

        <!-- Surat Keterangan Dokter (SKD) modal -->
        <div x-show="skdOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="skdOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-gray-800">Terbitkan Surat Keterangan</h3>
              <button @click="skdOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p class="text-xs text-gray-500 mb-4">Untuk pasien: <span class="font-medium text-gray-700">${patient.full_name}</span>. Data terisi otomatis dari kunjungan terakhir &mdash; silakan periksa & edit sebelum cetak.</p>

            <div class="flex gap-2 mb-3 flex-wrap">
              <button @click="skdType='sehat'" :class="skdType==='sehat' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-medium transition">Keterangan Sehat</button>
              <button @click="skdType='sakit'; syncSuratDate()" :class="skdType==='sakit' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-medium transition">Keterangan Sakit</button>
              <button @click="skdType='rujukan'" :class="skdType==='rujukan' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-medium transition">Surat Rujukan</button>
              <button @click="skdType='lab'" :class="skdType==='lab' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-medium transition">Hasil Laboratorium</button>
              <button @click="skdType='narkoba'" :class="skdType==='narkoba' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-medium transition">Bebas Narkoba</button>
            </div>

            <!-- KUNJUNGAN YANG MENDASARI SURAT INI. Ditampilkan apa adanya,
                 termasuk saat kosong: surat keterangan sakit tanpa rekam medis
                 adalah pernyataan tentang pemeriksaan yang tidak ada
                 catatannya, dan itu harus terlihat SEBELUM dicetak, bukan baru
                 ketahuan saat suratnya dipertanyakan. -->
            <div class="mb-4 px-3 py-2 rounded-lg border text-[11.5px] leading-relaxed"
                 :class="skdRecordId ? 'bg-teal-50 border-teal-200 text-teal-900' : 'bg-amber-50 border-amber-200 text-amber-900'">
              <template x-if="skdRecordId">
                <span>Surat ini akan tertaut ke kunjungan yang Anda pilih. Rekam medisnya sudah ada.</span>
              </template>
              <template x-if="!skdRecordId">
                <span><b>Belum tertaut kunjungan.</b> Surat tetap bisa terbit, tapi akan masuk daftar <b>Kewajiban RM</b> Anda sampai ditautkan ke sebuah kunjungan. Untuk menautkannya sejak awal, tutup jendela ini lalu tekan tombol surat pada kartu kunjungannya.</span>
              </template>
            </div>

            <div class="grid grid-cols-2 gap-3 mb-3">
              <div><label class="block text-xs text-gray-600 mb-1">No. RM <span class="text-gray-400">(otomatis)</span></label><input type="text" x-model="skd.no_rm" readonly class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 focus:outline-none" placeholder="Dibuat otomatis oleh sistem"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Tanggal Surat</label><input type="date" x-model="skd.letter_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>
            <div class="p-3 mb-3 rounded-lg bg-gray-50 border border-gray-100">
              <p class="text-xs font-semibold text-gray-500 mb-2">Data Pasien <span class="font-normal text-gray-400">(otomatis tersimpan ke data pasien)</span></p>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Tanggal Lahir</label><input type="date" x-model="skd.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label><select x-model="skd.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></div>
                <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="skd.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Alamat pasien"></div>
              </div>
            </div>

            <!-- Sehat -->
            <div x-show="skdType==='sehat'" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Berat Badan (KG)</label><input type="text" x-model="skd.berat_badan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Tinggi Badan (CM)</label><input type="text" x-model="skd.tinggi_badan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Tekanan Darah (MMHG)</label><input type="text" x-model="skd.tekanan_darah" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="120/80"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Nadi (X/MIN)</label><input type="text" x-model="skd.nadi" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Golongan Darah</label><select x-model="skd.golongan_darah" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">&mdash; pilih &mdash;</option><option>A</option><option>B</option><option>AB</option><option>O</option></select></div>
                <div><label class="block text-xs text-gray-600 mb-1">Pemeriksaan Buta Warna</label><select x-model="skd.buta_warna" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">&mdash; pilih &mdash;</option><option>Normal</option><option>Buta warna parsial (defisiensi merah-hijau)</option><option>Buta warna total</option></select></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">Dipergunakan untuk</label><input type="text" x-model="skd.keperluan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Melamar pekerjaan"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Kesimpulan</label><input type="text" x-model="skd.kesimpulan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>

            <!-- Sakit -->
            <div x-show="skdType==='sakit'" x-cloak class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Diagnosis</label><input type="text" x-model="skd.diagnosis" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Febris"></div>
              <div class="grid grid-cols-3 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Istirahat (hari)</label><input type="number" min="1" x-model="skd.rest_days" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Dari Tanggal</label><input type="date" x-model="skd.from_date" @change="syncSuratDate()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div><p class="text-[11px] text-teal-700 mt-1 sm:col-span-3" x-show="skdType==='sakit' && skd.from_date" x-cloak>Tanggal surat mengikuti hari pertama sakit (<span x-text="skd.from_date"></span>) &mdash; supaya tanggal suratnya tidak jatuh sesudah izin yang diterangkannya.</p>
                <div><label class="block text-xs text-gray-600 mb-1">Hingga Tanggal</label><input type="date" x-model="skd.to_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
            </div>

            <!-- SURAT HASIL PEMERIKSAAN. Dicentang dulu, baru diisi hasilnya.
                 Nilai rujukannya ikut tampil dan bisa disunting: rentangnya
                 bergantung reagen yang dipakai, dan yang tercetak harus
                 rentang alat klinik ini, bukan angka umum. -->
            <div x-show="skdType==='lab' || skdType==='narkoba'" x-cloak class="space-y-3">
              <div class="p-3 rounded-lg bg-purple-50 border border-purple-100">
                <p class="text-[11.5px] text-purple-900 leading-relaxed">
                  Centang pemeriksaan yang <b>benar-benar dikerjakan</b>, lalu isi hasilnya.
                  Yang dicentang tanpa hasil tidak ikut tercetak &mdash; baris kosong pada surat
                  terbaca sebagai &ldquo;diperiksa, hasilnya tidak ada&rdquo;.
                </p>
                <p class="text-[11.5px] text-purple-800 mt-1.5" x-show="!skd.gender" x-cloak>
                  <b>Jenis kelamin pasien belum terisi.</b> Asam urat, Hb, kreatinin, dan HDL
                  punya rentang berbeda untuk laki-laki dan perempuan &mdash; tanpa itu,
                  nilai rujukannya tidak bisa ditentukan dan dikosongkan.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Metode / keterangan pemeriksaan</label>
                  <input type="text" x-model="skd.lab_metode" placeholder="Mis. rapid test, stik, atau nama alat"
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Dipergunakan untuk</label>
                  <input type="text" x-model="skd.lab_keperluan" placeholder="Mis. melamar pekerjaan"
                    class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
              </div>

              <template x-for="kel in labKelompok" :key="kel">
                <div x-show="labPanel.some(t => t.kelompok === kel)">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500 mt-2 mb-1" x-text="kel"></p>
                  <div class="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    <template x-for="t in labPanel.filter(x => x.kelompok === kel)" :key="t.key">
                      <div class="p-2.5" :class="labPilih[t.key] ? 'bg-purple-50/40' : 'bg-white'">
                        <label class="flex items-start gap-2.5 cursor-pointer">
                          <input type="checkbox" :checked="labPilih[t.key]" @change="labCentang(t.key)"
                            class="mt-0.5 w-4 h-4 rounded border-slate-300 text-purple-600">
                          <span class="min-w-0 flex-1">
                            <span class="text-[13px] font-medium text-slate-800" x-text="t.nama"></span>
                            <span class="text-[11px] text-slate-400" x-show="t.catatan" x-cloak x-text="' \u00b7 ' + t.catatan"></span>
                          </span>
                        </label>
                        <div x-show="labPilih[t.key]" x-cloak class="mt-2 ml-6.5 pl-1 flex flex-wrap items-end gap-2">
                          <div x-show="t.jenis === 'angka'" class="flex items-end gap-1.5">
                            <div>
                              <label class="block text-[10.5px] text-gray-500 mb-0.5">Hasil</label>
                              <input type="text" inputmode="decimal" :value="labHasil[t.key] || ''" @input="labHasil[t.key] = $event.target.value"
                                class="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                            </div>
                            <span class="text-[12px] text-slate-500 pb-2" x-text="t.satuan"></span>
                          </div>
                          <div x-show="t.jenis === 'pilihan'">
                            <label class="block text-[10.5px] text-gray-500 mb-0.5">Hasil</label>
                            <select :value="labHasil[t.key] || ''" @change="labHasil[t.key] = $event.target.value"
                              class="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                              <option value="">&mdash; pilih &mdash;</option>
                              <template x-for="p in t.pilihan" :key="p"><option :value="p" x-text="p"></option></template>
                            </select>
                          </div>
                          <div>
                            <label class="block text-[10.5px] text-gray-500 mb-0.5">Nilai rujukan</label>
                            <input type="text" :value="labRujukan[t.key] || ''" @input="labRujukan[t.key] = $event.target.value"
                              class="w-32 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">
                          </div>
                          <!-- Kelainannya terlihat SEBELUM suratnya terbit,
                               bukan baru ketahuan sesudah dicetak. -->
                          <span x-show="labTanda(t.key)" x-cloak
                            class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 mb-1.5"
                            x-text="labTanda(t.key) === 'H' ? 'di atas rujukan' : (labTanda(t.key) === 'L' ? 'di bawah rujukan' : 'perlu perhatian')"></span>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </template>

              <div x-show="skdType==='narkoba'" x-cloak class="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p class="text-[12px] font-bold text-amber-900">Kesimpulan surat</p>
                <p class="text-[13px] font-semibold text-amber-900 mt-0.5" x-text="labKesimpulan || 'Belum ada golongan narkoba yang dicentang dan diisi hasilnya.'"></p>
                <p class="text-[11px] text-amber-800 leading-relaxed mt-1.5">
                  Kalimat penapisan ikut tercetak pada suratnya. Rapid test urin adalah
                  pemeriksaan skrining: hasil positif perlu konfirmasi laboratorium rujukan,
                  dan hasil negatif tidak meniadakan pemakaian di luar rentang waktu deteksi.
                </p>
              </div>

              <div>
                <label class="block text-xs text-gray-600 mb-1">Catatan tambahan pada surat (opsional)</label>
                <textarea x-model="skd.lab_catatan" rows="2" placeholder="Mis. pasien dianjurkan kontrol ulang 2 minggu"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none"></textarea>
              </div>

              <p class="text-[11.5px] text-slate-500" x-text="labSiap() + ' dari ' + labJumlah + ' pemeriksaan yang dicentang sudah ada hasilnya.'"></p>
            </div>

            <!-- Rujukan. Empat kelompok, mengikuti apa yang benar-benar
                 dibaca dokter penerima: ke mana ditujukan, apa yang sudah
                 diketahui, apa yang sudah dikerjakan, dan apa yang diharapkan.
                 Rujukan tanpa kelompok ketiga membuat dokter penerima
                 mengulang dari nol — termasuk mengulang obat yang sudah
                 masuk. -->
            <div x-show="skdType==='rujukan'" x-cloak class="space-y-3">
              <div class="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                <p class="text-xs font-semibold text-indigo-900 mb-2">Tujuan Rujukan</p>
                <div class="grid sm:grid-cols-2 gap-3">
                  <div><label class="block text-xs text-gray-600 mb-1">Fasilitas / Rumah Sakit</label><input type="text" x-model="skd.tujuan_faskes" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50" placeholder="cth: RSUD Sultan Syarif Mohamad Alkadrie"></div>
                  <div><label class="block text-xs text-gray-600 mb-1">Kepada (dokter / bagian)</label><input type="text" x-model="skd.tujuan_dokter" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50" placeholder="cth: TS dr. Sp.PD"></div>
                </div>
              </div>

              <div><label class="block text-xs text-gray-600 mb-1">Anamnesis</label><textarea x-model="skd.anamnesis" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Keluhan utama & perjalanan penyakit"></textarea></div>

              <div>
                <p class="text-xs text-gray-600 mb-1">Tanda Vital <span class="text-gray-400">(yang kosong tidak ikut dicetak)</span></p>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <input type="text" x-model="skd.tekanan_darah" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="TD">
                  <input type="text" x-model="skd.nadi" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nadi">
                  <input type="text" x-model="skd.rr" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="RR">
                  <input type="text" x-model="skd.suhu" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Suhu">
                  <input type="text" x-model="skd.berat_badan" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="BB">
                  <input type="text" x-model="skd.tinggi_badan" class="px-2 py-2 border border-gray-200 rounded-lg text-sm" placeholder="TB">
                </div>
              </div>

              <div><label class="block text-xs text-gray-600 mb-1">Pemeriksaan Fisik</label><textarea x-model="skd.pemeriksaan" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Temuan pemeriksaan"></textarea></div>
              <div><label class="block text-xs text-gray-600 mb-1">Pemeriksaan Penunjang <span class="text-gray-400">(bila ada)</span></label><textarea x-model="skd.penunjang" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="cth: Hb 9,2 g/dL; Rontgen thorax: infiltrat lapang paru kanan"></textarea></div>

              <div class="grid sm:grid-cols-3 gap-3">
                <div class="sm:col-span-2"><label class="block text-xs text-gray-600 mb-1">Diagnosis Kerja</label><input type="text" x-model="skd.diagnosis" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Anemia gravis suspek perdarahan saluran cerna"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Kode ICD-10</label><input type="text" x-model="skd.icd10" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: D50.0"></div>
              </div>

              <div><label class="block text-xs text-gray-600 mb-1">Terapi yang Sudah Diberikan</label><textarea x-model="skd.terapi" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Obat & tindakan yang sudah dikerjakan sebelum dirujuk"></textarea></div>
              <div><label class="block text-xs text-gray-600 mb-1">Alasan Rujukan</label><textarea x-model="skd.alasan" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="cth: Keterbatasan sarana pemeriksaan endoskopi"></textarea></div>
              <div><label class="block text-xs text-gray-600 mb-1">Harapan Kami</label><input type="text" x-model="skd.harapan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>

            <div class="flex gap-2 justify-end mt-5">
              <button @click="skdOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="submitSKD()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Buat &amp; Cetak Surat</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorEMRNew(params) {
  const doc = getDoctor();
  const patient = store.getPatient(params.patientId);
  if (!patient) return '<div class="p-8 text-center text-gray-500">Pasien tidak ditemukan</div>';
  // Halaman ini menampilkan panel rujukan berisi kunjungan-kunjungan lama,
  // jadi ia sama terbukanya dengan halaman rekam medis dan dijaga sama.
  if (!aksesRM(params.patientId).boleh) return rmTerkunci(patient);
  const locations = store.getLocationNames();
  window.__icd10 = store.icdAll(ICD10);
  window.__peSystems = CONFIG.PHYSICAL_EXAM_SYSTEMS || [];
  window.__peState = buildPeState(null).state;
  window.__peOtherInit = '';
  // Old visits for the reference panel — passed via a global (not embedded in
  // x-data) so free text (anamnesis/therapy/notes) can never break the page.
  // Bila halaman ini dibuka dari daftar Kewajiban Rekam Medis, resep/surat
  // yang sedang dilunasi ikut dibawa supaya tautannya terpasang begitu rekam
  // medisnya tersimpan — bukan menyisakan pekerjaan kedua yang mudah terlupa.
  window.__rmDebt = (params.debtKind && params.debtId) ? { kind: params.debtKind, id: params.debtId } : null;
  const hutangIni = window.__rmDebt
    ? store.rmDebtsForDoctor(doc && doc.id).find(h => h.kind === params.debtKind && h.id === params.debtId)
    : null;
  const oldRecords = store.getRecords(patient.id);
  window.__oldRecords = oldRecords.map(r => ({
    id: r.id, visit_date: r.visit_date || '', diagnosis: r.diagnosis || '', anamnesis: r.anamnesis || '',
    examination: r.examination || '', therapy: r.therapy || '', follow_up_date: r.follow_up_date || '',
    follow_up_notes: r.follow_up_notes || '', notes: r.notes || '',
    vital_signs: r.vital_signs || {},
  }));
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    visitType: 'consultation',
    visitDate: '${todayLocal()}',
    form: { anamnesis:'', examination:'', diagnosis:'', diagnosis_code:'', diagnosis_secondary:'', therapy:'', follow_up_date:'', follow_up_notes:'', vital_signs: {td:'',nadi:'',suhu:'',rr:'',spo2:'',bb:'',tb:''}, notes:'', location:'${locations[0]}', visit_type:'consultation' },
    ${physicalExamXData()}
    icdSearch: '', icdResults: [], icdOpen: false, icdSearch2: '', icdResults2: [], icdOpen2: false, secondaries: [],
    searchICD(q, which) {
      if (!q || q.length < 2) { if(which===2){this.icdResults2=[];this.icdOpen2=false}else{this.icdResults=[];this.icdOpen=false}; this.icdKosong=''; return; }
      const s = q.toLowerCase();
      const results = (window.__icd10||[]).filter(d => d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s) || d.name_id.toLowerCase().includes(s)).slice(0, 8);
      // Daftar bawaan bukan ICD-10 utuh, jadi tidak ketemu adalah keadaan yang
      // WAJAR dan harus punya jalan keluar — bukan jalan buntu yang memaksa
      // dokter mengetik diagnosis tanpa kode.
      this.icdKosong = results.length ? '' : q.trim();
      if(which===2){this.icdResults2=results;this.icdOpen2=true}else{this.icdResults=results;this.icdOpen=true};
    },
    icdKosong: '', icdKodeBaru: '', icdNamaBaru: '', icdGalat: '', icdSibuk: false,
    siapkanIcdBaru() {
      // Yang diketik dokter bisa berupa kode ('G40.9') atau nama ('Epilepsi').
      // Dibedakan supaya kotak isiannya sudah terisi sebagian, bukan kosong
      // lagi setelah ia baru saja mengetik.
      const t = (this.icdKosong || '').trim();
      if (/^[A-Za-z][0-9]{2}(\.[0-9]{1,2})?$/.test(t)) { this.icdKodeBaru = t.toUpperCase(); this.icdNamaBaru = ''; }
      else { this.icdKodeBaru = ''; this.icdNamaBaru = t; }
      this.icdGalat = '';
    },
    async simpanIcdBaru(which) {
      if (this.icdSibuk) return;
      this.icdSibuk = true; this.icdGalat = '';
      const r = await window.__store.addCustomIcd(this.icdKodeBaru, this.icdNamaBaru);
      this.icdSibuk = false;
      if (r && r.error) { this.icdGalat = r.error; return; }
      window.__icd10 = window.__store.icdAll(window.__icd10);
      this.icdKosong = ''; this.icdKodeBaru = ''; this.icdNamaBaru = '';
      this.selectICD(r.item, which || 1);
      window.__showToast && window.__showToast('Kode ditambahkan', r.item.code + ' kini tersedia untuk seluruh klinik.');
    },
    selectICD(item, which) {
      const val = item.code + ' - ' + item.name_id;
      if(which===2){ if(!this.secondaries.includes(val)) this.secondaries.push(val); this.icdSearch2=''; this.icdResults2=[]; this.icdOpen2=false; }
      else {
        this.form.diagnosis=val; this.icdSearch=val; this.icdOpen=false;
        // Kodenya disimpan TERPISAH, bukan cuma menempel di depan teksnya.
        // Kode yang hanya ada sebagai awalan teks akan hilang begitu ada yang
        // menyunting kalimatnya, dan tidak pernah ada sama sekali kalau
        // diagnosisnya diketik dengan tangan. SATUSEHAT (resource Condition)
        // dan klaim BPJS sama-sama menuntut kodenya, bukan kalimatnya.
        this.form.diagnosis_code = item.code;
      }
    },
    // Diagnosis yang diketik tangan tidak punya kode. Dibiarkan kosong, BUKAN
    // ditebak dari kalimatnya — tebakan kode diagnosis yang salah lebih
    // berbahaya daripada kode yang kosong, karena yang kosong kelihatan.
    ketikDiagnosis() {
      const p = window.__store.pisahDiagnosis(this.form.diagnosis);
      this.form.diagnosis_code = p.code;
    },
    ${secondaryDxMethods()}
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
      setTimeout(async function() {
        self.form.visit_type = self.visitType;
        self.form.diagnosis_secondary = self.secondaries.join('; ');
        var result = null;
        if (self.visitType === 'consultation' || self.visitType === 'both') {
          self.form.examination = self.peCompile();
          result = await window.__store.createRecord({patient_id:'${patient.id}', doctor_id:'${doc?.id}', ...self.form, visit_date: self.visitDate});
        }
        if (self.visitType === 'vaccination' || self.visitType === 'both') {
          const vd = {...self.vaxForm};
          if (vd.vax_mode === 'booster') {
            const given = new Date(self.visitDate);
            const next = new Date(given);
            next.setMonth(next.getMonth() + parseInt(vd.booster_interval_months));
            vd.next_dose_date = next.toLocaleDateString('en-CA');
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
        // Only offer the E-Resep shortcut with a real synced UUID. If the record
        // insert did not reach the server (still an id- placeholder, e.g.
        // offline), fall back to the EMR list — creating a prescription with a
        // placeholder record_id would be rejected by Supabase UUID column.
        const savedId = result && result.id ? String(result.id) : '';
        // Melunasi kewajiban rekam medis: tautkan resep/suratnya sekarang juga.
        if (window.__rmDebt && savedId) {
          const t = await window.__store.linkRecordTo(window.__rmDebt.kind, window.__rmDebt.id, result.id);
          if (t && t.error) window.__showToast && window.__showToast('Belum tertaut', t.error);
          else window.__showToast && window.__showToast('Tertaut', 'Rekam medis ini menjadi dasar dokumen tersebut.');
        }
        self.saving = false; self.saved = true; self.savedRecordId = savedId && !savedId.startsWith('id_') ? savedId : null;
      }, 400);
    },
    savedRecordId: null,
    oldRecords: window.__oldRecords || [], selectedOldId: '', oldPanelOpen: window.innerWidth > 1024,
    get selectedOld() { return this.oldRecords.find(r => r.id === this.selectedOldId) || null; },
    fmtOldDate(d) { if (!d) return '-'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); },
    kedatangan: null,
    // TTV yang sudah diambil di depan (mis. oleh perawat) dituangkan ke
    // formulir supaya dokter tidak mengetik ulang -- tapi HANYA kalau
    // formnya masih kosong. Dokter yang sudah mulai mengisi sendiri tidak
    // boleh ditimpa diam-diam oleh data yang datang belakangan.
    async cekKedatangan() {
      try { this.kedatangan = await window.__store.fetchCheckinForPatientToday('${patient.id}'); } catch (e) { this.kedatangan = null; }
      if (this.kedatangan) {
        if (this.kedatangan.td && !this.form.vital_signs.td) this.form.vital_signs.td = this.kedatangan.td;
        if (this.kedatangan.nadi && !this.form.vital_signs.nadi) this.form.vital_signs.nadi = this.kedatangan.nadi;
        if (this.kedatangan.suhu && !this.form.vital_signs.suhu) this.form.vital_signs.suhu = this.kedatangan.suhu;
      }
    }
  }" x-init="cekKedatangan()" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2 text-sm text-gray-500"><a href="#/doctor/emr/${patient.id}" class="hover:text-teal-600 transition">${escHtml(patient.full_name)}</a><span>/</span><span class="text-gray-800 font-medium">Kunjungan Baru</span>
            <span x-show="kedatangan" x-cloak class="px-2.5 py-1 rounded-full text-[11px] font-bold" :class="kedatangan && kedatangan.payment_type === 'bpjs' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'" x-text="kedatangan && (kedatangan.payment_type === 'bpjs' ? 'BPJS' : 'Umum')"></span>
          </div>

          <div class="flex gap-2">
            <button @click="saveRecord()" :disabled="saving || saved || (visitType!=='vaccination' && (!form.anamnesis || !form.diagnosis)) || ((visitType==='vaccination'||visitType==='both') && !vaxForm.vaccine_name)" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving && !saved">Simpan Rekam Medis</span><span x-show="saving" x-cloak>Menyimpan...</span><span x-show="saved" x-cloak>Tersimpan!</span></button>
            <a href="#/doctor/emr/${patient.id}" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</a>
          </div>
        </div>
        ${hutangIni ? `
        <div class="mb-4 px-4 py-3 rounded-2xl bg-amber-50 border-2 border-amber-200">
          <p class="text-sm font-bold text-amber-900">Melunasi kewajiban rekam medis</p>
          <p class="text-[12px] text-amber-800 leading-relaxed mt-0.5">Rekam medis yang Anda simpan di sini akan menjadi dasar tertulis untuk <b>${escHtml(hutangIni.label)}</b> (${escHtml(hutangIni.detail)}). Tautannya dipasang otomatis begitu tersimpan.</p>
        </div>` : ''}
        <div class="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div class="min-w-0">
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <div class="flex items-center gap-4"><div class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${patient.full_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div><div><h3 class="font-bold text-gray-800">${escHtml(patient.full_name)}</h3><p class="text-sm text-gray-500">${escHtml(patient.gender)}, ${patient.birth_date ? Math.floor((Date.now()-new Date(patient.birth_date))/(365.25*24*60*60*1000))+' thn' : '-'} | Gol. ${escHtml(patient.blood_type || '-')} | Alergi: ${escHtml(patient.allergies || '-')}</p></div></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4 lg:hidden">
          <button type="button" @click="oldPanelOpen=!oldPanelOpen" class="w-full flex items-center justify-between text-sm font-semibold text-gray-800"><span>📋 Riwayat Rekam Medis (<span x-text="oldRecords.length"></span>)</span><svg class="w-4 h-4 text-gray-400 transition" :class="oldPanelOpen && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>
          <div x-show="oldPanelOpen" x-cloak class="mt-3">${oldRecordsPanelInner()}</div>
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
          <!-- PEMERIKSAAN FISIK (Objektif) — setelah TTV -->
          <template x-if="visitType==='consultation' || visitType==='both'">
            ${physicalExamCard()}
          </template>
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

                      <!-- Tidak ketemu bukan jalan buntu. Daftar bawaan
                           bukan ICD-10 utuh, jadi kode yang hilang ditambahkan
                           di sini juga — sekali, lalu tersedia untuk seluruh
                           klinik. -->
                      <template x-if="icdKosong">
                        <div class="p-3 border-t border-slate-100 bg-slate-50">
                          <p class="text-[11.5px] text-slate-600">Tidak ada kode yang cocok dengan <b x-text="icdKosong"></b>.</p>
                          <div class="grid grid-cols-[110px_1fr] gap-2 mt-2">
                            <input type="text" x-model="icdKodeBaru" @focus="!icdKodeBaru && !icdNamaBaru && siapkanIcdBaru()" placeholder="G40.9"
                              class="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px] font-mono uppercase">
                            <input type="text" x-model="icdNamaBaru" @focus="!icdKodeBaru && !icdNamaBaru && siapkanIcdBaru()" placeholder="Nama diagnosis"
                              class="px-2 py-1.5 border border-slate-200 rounded-lg text-[12.5px]">
                          </div>
                          <p x-show="icdGalat" x-cloak class="mt-1.5 text-[11px] text-red-700" x-text="icdGalat"></p>
                          <button type="button" @mousedown.prevent="simpanIcdBaru(1)" :disabled="icdSibuk"
                            class="mt-2 w-full px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50">Tambahkan ke Daftar Klinik</button>
                          <p class="mt-1 text-[10.5px] text-slate-400">Periksa dulu kodenya dengan buku ICD-10 bila akan dipakai untuk klaim.</p>
                        </div>
                      </template>
                    </div>
                  </div>
                  <div x-show="form.diagnosis" x-cloak class="mt-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-center gap-2">
                    <svg class="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span x-text="form.diagnosis" class="font-medium"></span>
                    <button type="button" @click="form.diagnosis='';icdSearch=''" class="ml-auto text-teal-400 hover:text-teal-700"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                  </div>
                  ${secondaryDxCard()}
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
        </div>
        <aside class="hidden lg:block bg-white border border-slate-100 rounded-3xl p-4 sticky top-4">
          <h4 class="font-semibold text-gray-800 mb-3">📋 Riwayat Rekam Medis (<span x-text="oldRecords.length"></span>)</h4>
          ${oldRecordsPanelInner()}
        </aside>
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
  // Pemilih pasien di tombol "+ Kunjungan Baru" memuat SELURUH pasien klinik.
  // Inilah tempat seorang dokter memilih siapa yang akan ia periksa; daftar
  // yang disaring per dokter membuat pasien dokter lain tidak bisa dipilih
  // sama sekali.
  //
  // Daftar KUNJUNGAN di bawah tetap hanya milik dokter ini
  // (store.getRecordsByDoctor di atas) — yang dibuka adalah pintunya, bukan
  // isi panel rekam medisnya.
  window.__recordPatients = store.getPatients()
    .map(p => ({ id: p.id, full_name: p.full_name || '', rm_number: p.rm_number || '', nik: p.nik || '' }));
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '', pickOpen: false, pickSearch: '', patients: window.__recordPatients || [],
    get pickList() { const s=(this.pickSearch||'').toLowerCase(); return s ? this.patients.filter(p => (p.full_name+' '+p.rm_number+' '+p.nik).toLowerCase().includes(s)) : this.patients; },
    goNew(id) { this.pickOpen=false; window.location.hash = '#/doctor/emr/'+id+'/new'; }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('emr')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Rekam Medis Terbaru</h2>
          <div class="flex gap-2">
            <div class="relative flex-1"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari pasien atau diagnosis..."></div>
            <button @click="pickOpen=true; pickSearch=''" class="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Kunjungan Baru</button>
          </div>
        </div>

        <!-- Pilih pasien untuk kunjungan baru -->
        <div x-show="pickOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="pickOpen=false">
          <div class="bg-white rounded-3xl w-full max-w-md p-5 max-h-[85vh] flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-800">Pilih Pasien</h3>
              <button @click="pickOpen=false" class="text-gray-400 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <input type="text" x-model="pickSearch" placeholder="Cari nama / No. RM / NIK..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 mb-3">
            <div class="overflow-y-auto flex-1 space-y-1">
              <template x-for="p in pickList" :key="p.id">
                <button @click="goNew(p.id)" class="w-full text-left px-3 py-2.5 rounded-xl hover:bg-teal-50 border border-gray-100 transition flex items-center justify-between gap-2">
                  <span class="text-sm font-medium text-gray-800 truncate" x-text="p.full_name"></span>
                  <span class="text-xs text-gray-400 flex-shrink-0" x-text="p.rm_number ? 'RM '+p.rm_number : ''"></span>
                </button>
              </template>
              <template x-if="pickList.length===0"><p class="text-center text-gray-400 text-sm py-6">Pasien tidak ditemukan</p></template>
            </div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="divide-y divide-gray-50">
            ${allRecords.length === 0 ? '<p class="p-8 text-center text-gray-400">Belum ada rekam medis</p>' :
            allRecords.map(r => {
              const patient = store.getPatient(r.patient_id);
              const pName = patient?.full_name || 'N/A';
              const searchStr = (pName + ' ' + (r.diagnosis||'')).toLowerCase();
              return `<template x-if="!search || '${qAttr(searchStr)}'.includes(search.toLowerCase())">
                <div class="p-4 hover:bg-gray-50 transition">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg ${r.visit_type === 'vaccination' ? 'bg-purple-50' : 'bg-teal-50'} flex items-center justify-center"><span class="text-lg">${r.visit_type === 'vaccination' ? '💉' : '🏥'}</span></div>
                      <div>
                        <p class="font-medium text-gray-800 text-sm">${escHtml(pName)}</p>
                        <p class="text-xs text-gray-500">${formatDate(r.visit_date)} — ${escHtml(r.diagnosis || 'N/A')}${r.location ? ' — '+escHtml(r.location) : ''}</p>
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
  // Resep yang disusun apotek berizin dan menunggu ACC dokter ini. Ditaruh di
  // ATAS riwayat karena ini pekerjaan yang menunggu keputusan, bukan arsip —
  // dan selama belum diputuskan, resepnya tidak berlaku bagi siapa pun.
  const pending = store.getPendingRxForDoctor(doc?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${doctorSidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <!-- Kotak "menunggu ACC" pindah ke halaman Menunggu ACC, supaya semua
             yang menunggu keputusan dokter ada di SATU tempat beserta
             angkanya. Yang tertinggal di sini hanya penunjuk arah, karena
             dokter yang sedang membuka halaman resep juga harus tahu. -->
        ${pending.length ? `
        <a href="#/doctor/skd-approval" class="flex items-center gap-3 mb-5 px-4 py-3 rounded-2xl bg-amber-50 border-2 border-amber-200 hover:bg-amber-100 transition">
          <span class="ms text-[22px] text-amber-700">assignment_late</span>
          <span class="flex-1">
            <span class="block text-sm font-bold text-amber-900">${pending.length} resep dari apotek menunggu ACC Anda</span>
            <span class="block text-[11.5px] text-amber-800">Selama belum Anda setujui, resepnya tidak berlaku dan apotek tidak boleh melayaninya. Buka halaman <b>Menunggu ACC</b> untuk memutuskan.</span>
          </span>
          <span class="ms text-[20px] text-amber-600">chevron_right</span>
        </a>` : ''}
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
                  <div><p class="font-medium text-gray-800 text-sm">${rx.rx_number} — ${escHtml(patient?.full_name || 'N/A')}${rx.rx_target === 'luar' ? ' <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 align-middle">RESEP LUAR</span>' : ''}</p><p class="text-xs text-gray-500">${formatDate(rx.created_at?.split('T')[0])} | ${rx.rx_target === 'luar' ? 'Tebus di apotek pilihan pasien' : escHtml(pharmacy?.name || 'N/A')} | ${items.length} obat</p></div>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${rx.rx_target === 'luar' ? 'bg-amber-100 text-amber-700' : (statusColors[rx.status] || 'bg-gray-100')}">${rx.rx_target === 'luar' ? 'Resep Luar' : (CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status] || rx.status)}</span>
              </div>
              <div x-show="open" x-cloak class="mt-3 pl-13 text-sm space-y-2">
                ${items.map(i => i.is_compound ? `
                <div class="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5">
                  <div class="flex items-center gap-2 mb-1"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wide">RACIKAN</span><span class="font-medium text-gray-800">${escHtml(i.drug_name)}</span></div>
                  <p class="text-xs text-gray-700 whitespace-pre-line leading-relaxed">${(i.compound_details || '-').trim()}</p>
                  <p class="text-xs text-gray-500 mt-1">${i.frequency} ${i.time} — ${i.quantity} ${i.unit}</p>
                </div>` : `<div class="flex items-center gap-2 py-1 text-gray-600"><span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>${escHtml(i.drug_name)} ${escHtml(i.dosage)} — ${escHtml(i.frequency)} ${escHtml(i.time)} (${escHtml(String(i.quantity))} ${escHtml(i.unit)})</div>`).join('')}
                ${rx.notes ? `<p class="mt-2 text-xs text-gray-500 italic whitespace-pre-line">Catatan: ${escHtml(rx.notes)}</p>` : ''}
                ${rx.service_fee_enabled ? `<p class="mt-1 text-xs font-semibold text-green-700">💰 Jasa Dokter: Rp ${Number(rx.service_fee || 0).toLocaleString('id-ID')}</p>` : ''}
                ${rx.cancel_reason ? `<p class="mt-1 text-xs text-red-500 italic">Alasan batal: ${escHtml(rx.cancel_reason)}</p>` : ''}
                <div class="mt-3 pt-3 border-t border-gray-100"><button onclick="window.__printResep && window.__printResep('${rx.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition inline-flex items-center gap-1"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg> Cetak Kertas Resep</button></div>
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
  // Pilihan kop untuk dokter ini; tempat praktiknya sendiri ditaruh di depan.
  window.__kopChoices = store.getKopChoicesForDoctor(doc && doc.id);
  // Bawaannya: tempat kunjungan ini bila terdaftar, kalau tidak kop bawaan
  // dokternya — jadi yang paling sering benar sudah terpilih sejak awal.
  const tempatKunjungan = record ? store.findLocationByName(record.location) : null;
  window.__kopDefault = (tempatKunjungan && tempatKunjungan.id) || (doc && doc.kop_location_id) || '';
  const patient = record ? store.getPatient(record.patient_id) : null;
  const pharmacies = store.getPharmacies();
  if (!record || !patient) return '<div class="p-8 text-center text-gray-500">Rekam medis tidak ditemukan</div>';

  const age = calculateAge(patient.birth_date);
  // Parse the patient's recorded allergies into match terms (skip the "-"
  // placeholder and very short tokens to avoid false positives). Passed via a
  // global so quotes/commas can't break the x-data attribute.
  window.__allergyTerms = (patient.allergies || '').split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(t => t && t !== '-' && t.length >= 3);
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    items: [{drug_name:'',dosage:'',quantity:'',unit:'Tablet',frequency:'3 x 1',time:'Sesudah makan (PC)',duration:'',instructions:'',is_compound:false,compound_details:'',display_name:''}],
    pharmacy_id: '${pharmacies[0]?.id || ''}', notes: '', delivery_method: 'pickup', delivery_address: '${qAttr(patient.address)}',
    rxTarget: 'apotek',
    // Kop resep. Satu dokter bisa praktik di lebih dari satu tempat, jadi
    // kopnya dipilih di sini — bukan dipaku sekali untuk selamanya.
    kopId: window.__kopDefault || '', kopChoices: window.__kopChoices || [],
    serviceFeeEnabled: false, serviceFee: '',
    sending: false, sent: false, error: '',
    allergyTerms: window.__allergyTerms || [],
    drugAllergyHit(item) {
      const hay = ((item.drug_name||'') + ' ' + (item.compound_details||'')).toLowerCase();
      return this.allergyTerms.find(t => hay.includes(t)) || '';
    },
    get allergyConflicts() { return this.items.map((it,i)=>({i, term: this.drugAllergyHit(it)})).filter(x=>x.term); },
    copyOpen: false, copyLoading: false, copyList: [],
    openCopy() {
      this.copyOpen = true; this.copyLoading = true;
      const list = window.__store.getPrescriptionsByPatient('${patient.id}') || [];
      this.copyList = list.map(function(rx) {
        const its = window.__store.getPrescriptionItems(rx.id) || [];
        return { id: rx.id, rx_number: rx.rx_number, created_at: rx.created_at, summary: its.map(function(i){ return i.drug_name; }).filter(Boolean).join(', ') };
      });
      this.copyLoading = false;
    },
    useCopy(rxId) {
      const its = window.__store.getPrescriptionItems(rxId) || [];
      if (!its.length) { alert('Resep ini tidak memiliki data obat untuk disalin.'); return; }
      this.items = its.map(function(i) {
        return { drug_name: i.drug_name || '', dosage: i.dosage || '', quantity: i.quantity || '', unit: i.unit || 'Tablet', frequency: i.frequency || '3 x 1', time: i.time || 'Sesudah makan (PC)', duration: i.duration || '', instructions: i.instructions || '', is_compound: !!i.is_compound, compound_details: i.compound_details || '', display_name: i.display_name || '' };
      });
      this.copyOpen = false;
      window.__showToast && window.__showToast('Disalin', its.length + ' obat disalin dari resep lama. Sesuaikan bila perlu lalu kirim.');
    },
    fmtRxDate(d) { if (!d) return '-'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); },
    async send() {
      if (this.allergyConflicts.length && !confirm('PERINGATAN ALERGI\\n\\nAda obat yang cocok dengan alergi pasien (' + this.allergyConflicts.map(c=>'R/'+(c.i+1)+': '+c.term).join(', ') + ').\\n\\nTetap kirim resep ini?')) return;
      this.sending = true; this.error = '';
      const isLuar = this.rxTarget === 'luar';
      const result = await window.__store.createPrescription({record_id:'${record.id}',doctor_id:'${doc?.id}',patient_id:'${patient.id}',pharmacy_id:isLuar?null:this.pharmacy_id,notes:this.notes,rx_target:this.rxTarget,delivery_method:isLuar?'pickup':this.delivery_method,delivery_address:(!isLuar&&this.delivery_method==='delivery')?this.delivery_address:'',service_fee_enabled:this.serviceFeeEnabled,service_fee:this.serviceFeeEnabled?(parseInt(this.serviceFee)||0):0,kop_location_id:this.kopId||null}, this.items);
      this.sending = false;
      if (result.success) {
        this.sent = true;
        if (isLuar) window.__showToast && window.__showToast('Resep luar dibuat', 'Klik tombol Cetak Kertas Resep pada daftar untuk mencetaknya.');
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
            <button @click="openCopy()" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Salin dari Resep Lama</button>
            <button @click="send()" :disabled="sending || sent || items.some(i=>!i.drug_name) || (rxTarget==='apotek' && delivery_method==='delivery' && !delivery_address.trim())" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!sending && !sent" x-text="rxTarget==='luar' ? 'Simpan Resep Luar' : 'Kirim ke Apotek'"></span><span x-show="sending" x-cloak>Menyimpan...</span><span x-show="sent" x-cloak>Tersimpan!</span></button>
          </div>
        </div>

        <!-- Modal: pilih resep lama untuk disalin -->
        <div x-show="copyOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="copyOpen=false">
          <div class="bg-white rounded-3xl w-full max-w-lg p-5 max-h-[80vh] flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-800">Salin dari Resep Lama</h3>
              <button @click="copyOpen=false" class="text-gray-400 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <p class="text-xs text-gray-500 mb-3">Obat pada resep terpilih akan disalin ke form ini (tanggal kunjungan tetap hari ini). Anda bisa menyesuaikan sebelum mengirim.</p>
            <div x-show="copyLoading" class="text-center text-gray-400 text-sm py-6">Memuat riwayat resep...</div>
            <template x-if="!copyLoading && copyList.length===0"><p class="text-center text-gray-400 text-sm py-6">Pasien ini belum punya riwayat resep.</p></template>
            <div class="overflow-y-auto space-y-2">
              <template x-for="rx in copyList" :key="rx.id">
                <button @click="useCopy(rx.id)" class="w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-teal-50 hover:border-teal-200 transition">
                  <div class="flex items-center justify-between gap-2"><span class="text-sm font-medium text-gray-800" x-text="fmtRxDate(rx.created_at)"></span><span class="text-xs text-gray-400" x-text="rx.rx_number"></span></div>
                  <p class="text-xs text-gray-500 mt-0.5 line-clamp-2" x-text="rx.summary || '(tanpa detail obat)'"></p>
                </button>
              </template>
            </div>
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
            <div><span class="text-gray-500">Tanggal Kunjungan:</span><p class="font-medium text-gray-800">${formatDate(record.visit_date)}</p></div>
            <div><span class="text-gray-500">Diagnosis:</span><p class="font-medium text-gray-800">${record.diagnosis}</p></div>
            <div class="col-span-2 lg:col-span-4"><span class="text-gray-500">Alergi:</span> <span class="font-semibold ${patient.allergies && patient.allergies !== '-' ? 'text-red-600' : 'text-gray-800'}">${patient.allergies || '-'}</span></div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <h4 class="font-semibold text-gray-800 mb-4">Daftar Obat</h4>
          <div x-show="allergyConflicts.length" x-cloak class="mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm font-medium flex items-start gap-2">
            <span class="text-base leading-none">⚠️</span>
            <span>Peringatan alergi: <span class="font-bold" x-text="allergyConflicts.map(c=>'R/'+(c.i+1)+' ('+c.term+')').join(', ')"></span> cocok dengan riwayat alergi pasien. Periksa kembali sebelum mengirim.</span>
          </div>
          <template x-for="(item, index) in items" :key="index">
            <div class="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50/50">
              <div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-gray-600" x-text="'R/ '+(index+1)"></span><button @click="items.splice(index,1)" x-show="items.length > 1" class="text-red-400 hover:text-red-600 text-xs transition">Hapus</button></div>
              <div class="flex items-center gap-2 mb-2"><input type="checkbox" x-model="item.is_compound" class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-400/50"><label class="text-xs text-purple-700 font-medium">Obat Racikan / Compound</label></div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div><label class="block text-xs text-gray-500 mb-1" x-text="item.is_compound ? 'Nama Tampil Pasien *' : 'Nama Obat *'"></label><input type="text" x-model="item.drug_name" required class="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2" :class="drugAllergyHit(item) ? 'border-red-400 focus:ring-red-400/50 bg-red-50' : 'border-gray-200 focus:ring-teal-400/50'" :placeholder="item.is_compound ? 'cth: Obat Batuk Pilek' : 'Nama obat'"><p x-show="drugAllergyHit(item)" x-cloak class="text-xs text-red-600 font-medium mt-1" x-text="'⚠️ Cocok alergi pasien: '+drugAllergyHit(item)"></p></div>
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
            <h4 class="font-semibold text-gray-800 mb-2">Tujuan Resep</h4>
            <div class="space-y-2 mb-3">
              <label class="flex items-start gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="rxTarget==='apotek' ? 'border-teal-400 bg-teal-50' : 'border-gray-200'">
                <input type="radio" x-model="rxTarget" value="apotek" class="mt-0.5 text-teal-600 focus:ring-teal-400/50">
                <span><span class="font-medium text-gray-800">Kirim ke Apotek Mitra</span><span class="block text-xs text-gray-500">Obat disiapkan apotek mitra klinik.</span></span>
              </label>
              <label class="flex items-start gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="rxTarget==='luar' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'">
                <input type="radio" x-model="rxTarget" value="luar" class="mt-0.5 text-amber-600 focus:ring-amber-400/50">
                <span><span class="font-medium text-gray-800">Resep Luar</span><span class="block text-xs text-gray-500">Pasien menebus di apotek pilihannya. Tidak dikirim ke apotek mitra — cukup dicetak.</span></span>
              </label>
            </div>
            <div x-show="rxTarget==='apotek'" x-cloak>
              <label class="block text-xs text-gray-500 mb-1">Apotek Mitra Tujuan</label>
              <select x-model="pharmacy_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                ${pharmacies.map(ph => `<option value="${ph.id}">${ph.name} — ${ph.address}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
                        <div class="bg-white border border-slate-100 rounded-3xl p-5 mb-4">
          <label class="block text-sm font-semibold text-gray-800 mb-1">Kop Resep</label>
          <p class="text-[11.5px] text-gray-500 mb-2 leading-relaxed">Kop menyatakan <b>di mana Anda menulis resep ini</b>. Satu dokter bisa berpraktik di lebih dari satu tempat, jadi pilih yang sesuai &mdash; pilihan ini menempel pada resep tersebut selamanya. Tidak ada hubungannya dengan apotek tujuan: resep ini tetap bisa ditebus di apotek mana pun.</p>
          <select x-model="kopId" class="w-full sm:max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/50">
            <option value="">Bawaan (ikut tempat kunjungan / Klinik Prima)</option>
            <template x-for="k in kopChoices" :key="k.id">
              <option :value="k.id" x-text="(k.mine ? '\u2605 ' : '') + k.name + (k.kop_name ? ' — ' + k.kop_name : ' (kop belum diisi)')"></option>
            </template>
          </select>
          <p class="text-[11px] text-gray-400 mt-1">&#9733; = tempat praktik Anda.</p>
        </div>

<div class="bg-white border border-slate-100 rounded-3xl p-5 mb-4">
          <label class="block text-sm font-semibold text-gray-800 mb-1">Kop Resep</label>
          <p class="text-[11.5px] text-gray-500 mb-2 leading-relaxed">Kop menyatakan <b>di mana Anda menulis resep ini</b>. Satu dokter bisa berpraktik di lebih dari satu tempat, jadi pilih yang sesuai &mdash; pilihan ini menempel pada resep tersebut selamanya. Tidak ada hubungannya dengan apotek tujuan: resep ini tetap bisa ditebus di apotek mana pun.</p>
          <select x-model="kopId" class="w-full sm:max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/50">
            <option value="">Bawaan (ikut tempat kunjungan / Klinik Prima)</option>
            <template x-for="k in kopChoices" :key="k.id">
              <option :value="k.id" x-text="(k.mine ? '\u2605 ' : '') + k.name + (k.kop_name ? ' — ' + k.kop_name : ' (kop belum diisi)')"></option>
            </template>
          </select>
          <p class="text-[11px] text-gray-400 mt-1">&#9733; = tempat praktik Anda.</p>
        </div>

<div class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
          <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" x-model="serviceFeeEnabled" class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400/50"><span class="font-semibold text-gray-800">Sertakan Jasa Dokter (jasa peresepan)</span></label>
          <p class="text-xs text-gray-400 mt-1 ml-6">Bila dicentang, apotek akan diminta menarik biaya jasa dokter dari pasien saat pengambilan obat.</p>
          <div x-show="serviceFeeEnabled" x-cloak class="mt-3 ml-6 max-w-xs">
            <label class="block text-xs text-gray-500 mb-1">Nominal Jasa Dokter (Rp)</label>
            <input type="number" x-model="serviceFee" min="0" step="1000" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: 50000">
          </div>
        </div>
        <div x-show="rxTarget==='apotek'" x-cloak class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
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
  window.__kopChoices = store.getKopChoicesForDoctor((getDoctor() || {}).id);
  const doc = getDoctor();
  const rx = store.data.prescriptions.find(r => r.id === params.rxId);
  if (!rx) return '<div class="p-8 text-center text-gray-500">Resep tidak ditemukan</div>';
  const patient = store.getPatient(rx.patient_id);
  const existingItems = store.getPrescriptionItems(rx.id);
  const pharmacies = store.getPharmacies();
  window.__editRxItems = existingItems.map(i => ({drug_name:i.drug_name,dosage:i.dosage,quantity:i.quantity,unit:i.unit,frequency:i.frequency,time:i.time,duration:i.duration,instructions:i.instructions,is_compound:!!i.is_compound,compound_details:i.compound_details||'',display_name:i.display_name||''}));
  window.__allergyTerms = ((patient && patient.allergies) || '').split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(t => t && t !== '-' && t.length >= 3);

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    items: window.__editRxItems || [],
    pharmacy_id: '${rx.pharmacy_id}',
    notes: '${qAttr(rx.notes)}',
    delivery_method: '${rx.delivery_method || 'pickup'}',
    delivery_address: '${qAttr(rx.delivery_address || patient?.address)}',
    rxTarget: '${rx.rx_target === 'luar' ? 'luar' : 'apotek'}',
    kopId: '${rx.kop_location_id || ''}', kopChoices: window.__kopChoices || [],
    serviceFeeEnabled: ${rx.service_fee_enabled ? 'true' : 'false'}, serviceFee: '${rx.service_fee ? String(parseInt(rx.service_fee) || 0) : ''}',
    saving: false, saved: false, error: '',
    allergyTerms: window.__allergyTerms || [],
    drugAllergyHit(item) { const hay = ((item.drug_name||'') + ' ' + (item.compound_details||'')).toLowerCase(); return this.allergyTerms.find(t => hay.includes(t)) || ''; },
    get allergyConflicts() { return this.items.map((it,i)=>({i, term: this.drugAllergyHit(it)})).filter(x=>x.term); },
    async saveEdit() {
      if (this.allergyConflicts.length && !confirm('PERINGATAN ALERGI\\n\\nAda obat yang cocok dengan alergi pasien (' + this.allergyConflicts.map(c=>'R/'+(c.i+1)+': '+c.term).join(', ') + ').\\n\\nTetap simpan resep ini?')) return;
      this.saving = true; this.error = '';
      const isLuar = this.rxTarget === 'luar';
      const rxResult = await window.__store.updatePrescription('${rx.id}', { pharmacy_id: isLuar ? null : this.pharmacy_id, notes: this.notes, rx_target: this.rxTarget, delivery_method: isLuar ? 'pickup' : this.delivery_method, delivery_address: (!isLuar && this.delivery_method==='delivery') ? this.delivery_address : '', service_fee_enabled: this.serviceFeeEnabled, service_fee: this.serviceFeeEnabled ? (parseInt(this.serviceFee)||0) : 0, kop_location_id: this.kopId || null, status: 'sent' });
      if (rxResult.error) { this.saving = false; this.error = rxResult.error; return; }
      const itemsResult = await window.__store.updatePrescriptionItems('${rx.id}', this.items);
      this.saving = false;
      if (!itemsResult.success) { this.error = itemsResult.error; return; }
      this.saved = true;
      setTimeout(() => window.location.hash = '/doctor/prescriptions', 800);
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
        <div x-show="error" x-cloak class="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium" x-text="error"></div>
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2"><svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><p class="text-sm text-amber-800">Anda sedang mengedit resep yang sudah dikirim. Perubahan akan dikirim ulang ke apotek.</p></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <h4 class="font-semibold text-gray-800 mb-1">Daftar Obat</h4>
          <p class="text-xs text-gray-500 mb-4">Alergi pasien: <span class="font-semibold ${patient && patient.allergies && patient.allergies !== '-' ? 'text-red-600' : 'text-gray-600'}">${(patient && patient.allergies) || '-'}</span></p>
          <div x-show="allergyConflicts.length" x-cloak class="mb-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm font-medium flex items-start gap-2">
            <span class="text-base leading-none">⚠️</span>
            <span>Peringatan alergi: <span class="font-bold" x-text="allergyConflicts.map(c=>'R/'+(c.i+1)+' ('+c.term+')').join(', ')"></span> cocok dengan riwayat alergi pasien.</span>
          </div>
          <template x-for="(item, index) in items" :key="index">
            <div class="border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50/50">
              <div class="flex items-center justify-between mb-2"><span class="text-sm font-semibold text-gray-600" x-text="'R/ '+(index+1)"></span><button @click="items.splice(index,1)" x-show="items.length > 1" class="text-red-400 hover:text-red-600 text-xs transition">Hapus</button></div>
              <div class="flex items-center gap-2 mb-2"><input type="checkbox" x-model="item.is_compound" class="w-4 h-4 rounded border-gray-300 text-purple-600"><label class="text-xs text-purple-700 font-medium">Obat Racikan</label></div>
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div><label class="block text-xs text-gray-500 mb-1" x-text="item.is_compound ? 'Nama Tampil Pasien *' : 'Nama Obat *'"></label><input type="text" x-model="item.drug_name" class="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2" :class="drugAllergyHit(item) ? 'border-red-400 focus:ring-red-400/50 bg-red-50' : 'border-gray-200 focus:ring-teal-400/50'"><p x-show="drugAllergyHit(item)" x-cloak class="text-xs text-red-600 font-medium mt-1" x-text="'⚠️ Cocok alergi pasien: '+drugAllergyHit(item)"></p></div>
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
          <div class="bg-white border border-slate-100 rounded-3xl p-4">
            <h4 class="font-semibold text-gray-800 mb-2">Tujuan Resep</h4>
            <div class="space-y-2 mb-3">
              <label class="flex items-start gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="rxTarget==='apotek' ? 'border-teal-400 bg-teal-50' : 'border-gray-200'">
                <input type="radio" x-model="rxTarget" value="apotek" class="mt-0.5 text-teal-600 focus:ring-teal-400/50">
                <span><span class="font-medium text-gray-800">Kirim ke Apotek Mitra</span></span>
              </label>
              <label class="flex items-start gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition" :class="rxTarget==='luar' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'">
                <input type="radio" x-model="rxTarget" value="luar" class="mt-0.5 text-amber-600 focus:ring-amber-400/50">
                <span><span class="font-medium text-gray-800">Resep Luar</span><span class="block text-xs text-gray-500">Pasien menebus di apotek pilihannya.</span></span>
              </label>
            </div>
            <div x-show="rxTarget==='apotek'" x-cloak>
              <label class="block text-xs text-gray-500 mb-1">Apotek Mitra Tujuan</label>
              <select x-model="pharmacy_id" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${pharmacies.map(ph=>`<option value="${ph.id}">${ph.name} — ${ph.address}</option>`).join('')}</select>
            </div>
          </div>
        </div>
        <div x-show="rxTarget==='apotek'" x-cloak class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
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
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mt-4">
          <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" x-model="serviceFeeEnabled" class="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400/50"><span class="font-semibold text-gray-800">Sertakan Jasa Dokter (jasa peresepan)</span></label>
          <p class="text-xs text-gray-400 mt-1 ml-6">Bila dicentang, apotek akan diminta menarik biaya jasa dokter dari pasien saat pengambilan obat.</p>
          <div x-show="serviceFeeEnabled" x-cloak class="mt-3 ml-6 max-w-xs">
            <label class="block text-xs text-gray-500 mb-1">Nominal Jasa Dokter (Rp)</label>
            <input type="number" x-model="serviceFee" min="0" step="1000" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: 50000">
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
  if (patient && !aksesRM(record.patient_id).boleh) return rmTerkunci(patient);
  // Tempat yang tersimpan di rekam medis ini bisa saja sudah dihapus /
  // dinonaktifkan dari master lokasi. Kalau tidak ikut dimasukkan sebagai
  // pilihan, <select> tidak punya opsi yang cocok dan lokasi kunjungan lama
  // akan tertimpa diam-diam saat dokter menyimpan hasil edit.
  const activeLocations = store.getLocationNames();
  const locations = (record.location && !activeLocations.includes(record.location))
    ? [record.location].concat(activeLocations)
    : activeLocations;
  window.__icd10 = store.icdAll(ICD10);
  // Pass the existing record into Alpine via a global instead of embedding each
  // field inside the x-data string — a newline, double-quote or backslash in
  // any free-text field (anamnesis/therapy/notes) would otherwise break the
  // x-data expression, so Alpine never initialized and the whole page rendered
  // broken (content slid under the sidebar, buttons blank).
  window.__emrEdit = {
    anamnesis: record.anamnesis || '', diagnosis: record.diagnosis || '',
    // Baris lama belum punya kolomnya; kodenya dipotong dari teks diagnosisnya
    // supaya menyunting rekam medis lama sekaligus melengkapinya.
    diagnosis_code: store.kodeDiagnosis(record),
    diagnosis_secondary: record.diagnosis_secondary || '',
    therapy: record.therapy || '', location: record.location || locations[0], follow_up_date: record.follow_up_date || '',
    follow_up_notes: record.follow_up_notes || '', notes: record.notes || ''
  };
  window.__emrSecondaries = parseSecondaries(record.diagnosis_secondary);
  window.__peSystems = CONFIG.PHYSICAL_EXAM_SYSTEMS || [];
  const __pe = buildPeState(record);
  window.__peState = __pe.state;
  window.__peOtherInit = __pe.other;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024, saving: false, saved: false,
    form: JSON.parse(JSON.stringify(window.__emrEdit)),
    ${physicalExamXData()}
    icdSearch: window.__emrEdit.diagnosis, icdResults: [], icdOpen: false,
    icdSearch2: '', icdResults2: [], icdOpen2: false, secondaries: JSON.parse(JSON.stringify(window.__emrSecondaries)),
    searchICD(q, which) {
      if (!q || q.length < 2) { if(which===2){this.icdResults2=[];this.icdOpen2=false}else{this.icdResults=[];this.icdOpen=false}; this.icdKosong=''; return; }
      const s = q.toLowerCase();
      const results = (window.__icd10||[]).filter(d => d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s) || d.name_id.toLowerCase().includes(s)).slice(0, 8);
      // Daftar bawaan bukan ICD-10 utuh, jadi tidak ketemu adalah keadaan yang
      // WAJAR dan harus punya jalan keluar — bukan jalan buntu yang memaksa
      // dokter mengetik diagnosis tanpa kode.
      this.icdKosong = results.length ? '' : q.trim();
      if(which===2){this.icdResults2=results;this.icdOpen2=true}else{this.icdResults=results;this.icdOpen=true};
    },
    icdKosong: '', icdKodeBaru: '', icdNamaBaru: '', icdGalat: '', icdSibuk: false,
    siapkanIcdBaru() {
      // Yang diketik dokter bisa berupa kode ('G40.9') atau nama ('Epilepsi').
      // Dibedakan supaya kotak isiannya sudah terisi sebagian, bukan kosong
      // lagi setelah ia baru saja mengetik.
      const t = (this.icdKosong || '').trim();
      if (/^[A-Za-z][0-9]{2}(\.[0-9]{1,2})?$/.test(t)) { this.icdKodeBaru = t.toUpperCase(); this.icdNamaBaru = ''; }
      else { this.icdKodeBaru = ''; this.icdNamaBaru = t; }
      this.icdGalat = '';
    },
    async simpanIcdBaru(which) {
      if (this.icdSibuk) return;
      this.icdSibuk = true; this.icdGalat = '';
      const r = await window.__store.addCustomIcd(this.icdKodeBaru, this.icdNamaBaru);
      this.icdSibuk = false;
      if (r && r.error) { this.icdGalat = r.error; return; }
      window.__icd10 = window.__store.icdAll(window.__icd10);
      this.icdKosong = ''; this.icdKodeBaru = ''; this.icdNamaBaru = '';
      this.selectICD(r.item, which || 1);
      window.__showToast && window.__showToast('Kode ditambahkan', r.item.code + ' kini tersedia untuk seluruh klinik.');
    },
    selectICD(item, which) {
      const val = item.code + ' - ' + item.name_id;
      if(which===2){ if(!this.secondaries.includes(val)) this.secondaries.push(val); this.icdSearch2=''; this.icdResults2=[]; this.icdOpen2=false; }
      else {
        this.form.diagnosis=val; this.icdSearch=val; this.icdOpen=false;
        // Kodenya disimpan TERPISAH, bukan cuma menempel di depan teksnya.
        // Kode yang hanya ada sebagai awalan teks akan hilang begitu ada yang
        // menyunting kalimatnya, dan tidak pernah ada sama sekali kalau
        // diagnosisnya diketik dengan tangan. SATUSEHAT (resource Condition)
        // dan klaim BPJS sama-sama menuntut kodenya, bukan kalimatnya.
        this.form.diagnosis_code = item.code;
      }
    },
    // Diagnosis yang diketik tangan tidak punya kode. Dibiarkan kosong, BUKAN
    // ditebak dari kalimatnya — tebakan kode diagnosis yang salah lebih
    // berbahaya daripada kode yang kosong, karena yang kosong kelihatan.
    ketikDiagnosis() {
      const p = window.__store.pisahDiagnosis(this.form.diagnosis);
      this.form.diagnosis_code = p.code;
    },
    ${secondaryDxMethods()}
    saveEdit() {
      this.saving = true;
      const self = this;
      setTimeout(function() {
        self.form.examination = self.peCompile();
        self.form.diagnosis_secondary = self.secondaries.join('; ');
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
          ${physicalExamCard()}
          <div class="grid lg:grid-cols-2 gap-4">
            <div class="bg-white border border-slate-100 rounded-3xl p-4">
              <h4 class="font-semibold text-gray-800 mb-3">Diagnosis (ICD-10) *</h4>
              <div class="relative"><input type="text" x-model="icdSearch" @input="searchICD(icdSearch,1)" @focus="searchICD(icdSearch,1)" @click.away="icdOpen=false" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari ICD-10...">
                <div x-show="icdOpen" x-cloak class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"><template x-for="item in icdResults" :key="item.code"><button type="button" @mousedown.prevent="selectICD(item,1)" class="w-full text-left px-3 py-2 hover:bg-teal-50 transition border-b border-gray-50"><span class="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-xs font-mono font-bold" x-text="item.code"></span> <span class="text-sm text-gray-800" x-text="item.name_id"></span></button></template></div>
              </div>
              <div x-show="form.diagnosis" x-cloak class="mt-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800" x-text="form.diagnosis"></div>
              ${secondaryDxCard()}
            </div>
            <div class="bg-white border border-slate-100 rounded-3xl p-4"><h4 class="font-semibold text-gray-800 mb-3">Terapi Non-Farmakologis</h4><textarea x-model="form.therapy" rows="5" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

// Doctor's queue of admin-drafted Surat Keterangan awaiting ACC.
export function doctorSKDApproval() {
  const doc = getDoctor();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, loading: true, items: [], vaxItems: [], rxItems: [],
    docId: '${doc?.id || ''}',
    async load() {
      this.loading = true;
      try { this.items = await window.__store.getPendingSKDForDoctor(this.docId); } catch(e) { this.items = []; }
      try { this.vaxItems = await window.__store.getPendingVaccinationsForDoctor(this.docId); } catch(e) { this.vaxItems = []; }
      // Resep yang disusun apotek ikut di sini, bukan hanya di halaman
      // E-Resep. Selama tersebar di dua tempat, yang terlewat di salah satunya
      // menahan apotek dan pasien tanpa ada yang tahu di mana tertahannya.
      try { this.rxItems = window.__store.getPendingRxForDoctor(this.docId); } catch(e) { this.rxItems = []; }
      this.loading = false;
    },
    get totalMenunggu() { return this.items.length + this.vaxItems.length + this.rxItems.length; },
    rxObat(id) { return window.__store.getPrescriptionItems(id); },
    // Riwayat obat pasien — dasar untuk menilai PENGULANGAN, yang justru jenis
    // resep paling sering datang lewat apotek. Resep yang sedang dinilai
    // dikeluarkan dari riwayatnya sendiri supaya tidak terbaca sebagai
    // 'pernah diberikan'.
    riwayatBulan: 6,
    rxRiwayat(rx) {
      return window.__store.patientDrugHistory(rx.patient_id, { months: this.riwayatBulan, excludeRxId: rx.id });
    },
    rxTumpang(rx) {
      return window.__store.recentDrugOverlap(rx.patient_id, this.rxObat(rx.id), { months: this.riwayatBulan, excludeRxId: rx.id });
    },
    riwayatRingkas(h) {
      const isi = h.is_compound ? (h.compound_details || '').trim() : ((h.drug_name || '') + (h.dosage ? ' ' + h.dosage : ''));
      const jml = h.quantity ? (' — ' + h.quantity + ' ' + (h.unit || '')) : '';
      return isi + jml + (h.duration ? ' · ' + h.duration : '');
    },
    rxPasien(rx) { return (window.__store.getPatient(rx.patient_id) || {}).full_name || 'Pasien'; },
    rxApotek(rx) { return (window.__store.getPharmacy(rx.drafted_by_pharmacy || rx.pharmacy_id) || {}).name || 'Apotek'; },
    async accRx(rx, jasa, nominal) {
      const nilai = jasa ? Math.max(0, Math.round(Number(nominal) || 0)) : 0;
      const kalimatJasa = nilai > 0 ? ' Jasa dokter Rp' + nilai.toLocaleString('id-ID') + ' akan ditarik apotek dari pasien.' : '';
      if (!confirm('Setujui resep ' + rx.rx_number + '? Setelah di-ACC, resep ini berlaku dan masuk antrean apotek.' + kalimatJasa)) return;
      const r = await window.__store.approvePrescription(rx.id, this.docId, '', { service_fee_enabled: nilai > 0, service_fee: nilai });
      if (r && r.error) { alert(r.error); return; }
      window.__showToast && window.__showToast('Disetujui', 'Resep ' + rx.rx_number + ' kini berlaku.');
      this.load();
    },
    async tolakRx(rx) {
      const alasan = prompt('Alasan menolak resep ' + rx.rx_number + ' (wajib diisi, dikirim ke apotek):', '');
      if (alasan === null) return;
      const r = await window.__store.rejectPrescription(rx.id, this.docId, alasan);
      if (r && r.error) { alert(r.error); return; }
      window.__showToast && window.__showToast('Ditolak', 'Apotek diberi tahu beserta alasannya.');
      this.load();
    },
    patientName(id) { return (window.__store.getPatient(id) || {}).full_name || 'Pasien'; },
    vaxDose(v) { return v.vax_mode === 'booster' ? ('Booster ke-' + (v.dose_number || 1)) : ('Dosis ' + (v.dose_number || 1) + '/' + (v.total_doses || 1)); },
    previewVax(v) { window.__generateVaxCert(v.patient_id, v.vaccine_name, { draft: true }); },
    async approveVax(v) {
      if (!confirm('Setujui catatan vaksinasi ' + v.vaccine_name + ' untuk ' + this.patientName(v.patient_id) + '?\\n\\nSetelah disetujui, sertifikat vaksin bisa dicetak.')) return;
      const r = await window.__store.approveVaccination(v.id);
      if (r && r.error) { alert(r.error); return; }
      this.load();
    },
    async rejectVax(v) {
      const reason = prompt('Alasan menolak catatan vaksinasi ' + v.vaccine_name + ' untuk ' + this.patientName(v.patient_id) + ':');
      if (reason === null) return;
      const r = await window.__store.rejectVaccination(v.id, reason || '');
      if (r && r.error) { alert(r.error); return; }
      this.load();
    },
    preview(id) { window.__printSKD(id); },
    async approve(item) {
      if (!confirm('Setujui & sahkan surat ' + item.cert_number + ' untuk ' + item.patient_name + '?')) return;
      // Open the print window now (still inside the click) so it isn't blocked
      // after the async approve; fill it with the finalized letter afterwards.
      const w = window.open('', '_blank');
      if (w) w.document.write(window.__skdLoadingDoc);
      await window.__store.approveSKD(item.id);
      const cert = await window.__store.getCertificateById(item.id);
      window.__renderSKDInto(w, cert);
      this.load();
    },
    async reject(item) {
      const r = prompt('Alasan penolakan surat untuk ' + item.patient_name + ':');
      if (r === null) return;
      await window.__store.rejectSKD(item.id, r || '');
      this.load();
    }
  }" x-init="load()" class="min-h-screen bg-wash">
    ${doctorSidebar('skd-approval')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-4xl mx-auto">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h2 class="text-xl font-bold text-gray-800">Menunggu ACC</h2>
          <span x-show="!loading && totalMenunggu > 0" x-cloak class="px-2 py-0.5 rounded-full bg-[#ff5436] text-white text-xs font-bold" x-text="totalMenunggu"></span>
        </div>
        <p class="text-sm text-gray-500 mb-6">Semua yang menunggu keputusan Anda dikumpulkan di sini: <b>resep yang disusun apotek</b>, surat keterangan, dan catatan vaksinasi. Selama belum Anda setujui, tidak satu pun dari ini berlaku.</p>
        <div x-show="loading" class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Memuat...</div>

        <!-- Resep yang disusun apotek. Ditaruh paling atas karena inilah yang
             paling menahan orang lain: selama belum diputuskan, apoteknya
             tidak boleh melayani dan pasiennya tidak dapat obat. -->
        <template x-if="!loading && rxItems.length > 0">
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Resep dari Apotek <span x-text="'(' + rxItems.length + ')'"></span></h3>
            <div class="space-y-3">
              <template x-for="rx in rxItems" :key="rx.id">
                <div class="bg-white border border-slate-100 rounded-3xl p-4" x-data="{ jasa: false, nominal: '', riwayatBuka: false }">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="min-w-[220px]">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Resep</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Menunggu ACC</span>
                      </div>
                      <p class="font-semibold text-gray-800 mt-2" x-text="rxPasien(rx)"></p>
                      <p class="text-xs text-gray-500" x-text="rx.rx_number + ' · disusun ' + rxApotek(rx)"></p>
                      <p class="text-xs text-gray-500" x-show="rx.repeat_of" x-cloak>Resep ulang dari resep sebelumnya</p>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                      <button @click="tolakRx(rx)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition">Tolak</button>
                      <button @click="accRx(rx, jasa, nominal)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">Setujui &amp; Berlakukan</button>
                    </div>
                  </div>
                  <div class="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-1.5">
                    <template x-for="(it, ix) in rxObat(rx.id)" :key="ix">
                      <div>
                        <template x-if="it.is_compound">
                          <div class="rounded-lg border border-purple-200 bg-purple-50/60 p-2">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wide">RACIKAN</span>
                              <span class="text-xs font-semibold text-gray-800" x-text="it.drug_name"></span>
                            </div>
                            <p class="text-xs text-gray-500 mb-0.5">Komposisi:</p>
                            <p class="text-xs text-gray-800 whitespace-pre-line leading-relaxed bg-white rounded border border-purple-100 p-1.5" x-text="(it.compound_details || '-').trim()"></p>
                            <p class="text-[11px] text-gray-500 mt-1" x-text="(it.frequency||'') + ' ' + (it.time||'') + ' — ' + (it.quantity||'-') + ' ' + (it.unit||'') + (it.duration ? ' · ' + it.duration : '')"></p>
                          </div>
                        </template>
                        <template x-if="!it.is_compound">
                          <p class="text-xs text-gray-700">&bull; <b x-text="it.drug_name"></b> <span x-text="(it.dosage||'') + ' — ' + (it.frequency||'') + ' ' + (it.time||'') + ' (' + (it.quantity||'-') + ' ' + (it.unit||'') + ')' + (it.instructions ? ' · ' + it.instructions : '')"></span></p>
                        </template>
                      </div>
                    </template>
                  </div>
                  <p x-show="rx.notes" x-cloak class="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 whitespace-pre-line" x-text="'Catatan apotek: ' + (rx.notes || '')"></p>
                  <!-- YANG PALING PERLU DILIHAT SEBELUM MENEKAN SETUJUI:
                       obat pada resep ini yang ternyata baru saja diterima
                       pasiennya. Ditaruh di atas riwayat lengkapnya, karena
                       riwayat yang harus dibuka dulu sama saja tidak ada. -->
                  <template x-if="rxTumpang(rx).length">
                    <div class="mt-2 rounded-xl bg-red-50 border-2 border-red-200 p-2.5">
                      <p class="text-[11.5px] font-bold text-red-900 mb-1">Sudah pernah diterima pasien ini belakangan:</p>
                      <template x-for="t in rxTumpang(rx)" :key="t.nama + t.date + t.where">
                        <p class="text-[11.5px] text-red-800" x-text="'• ' + t.nama + ' — ' + (t.hari === 0 ? 'hari ini' : t.hari + ' hari lalu') + ' (' + (t.rx_number || 'resep sebelumnya') + (t.where === 'racikan' ? ', sebagai bahan racikan' : '') + (t.lewat_apotek ? ', lewat apotek' : '') + ')'"></p>
                      </template>
                    </div>
                  </template>

                  <div class="mt-2 rounded-xl border border-slate-100 overflow-hidden">
                    <button type="button" @click="riwayatBuka = !riwayatBuka" class="w-full px-2.5 py-2 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between gap-2">
                      <span class="text-[11.5px] font-semibold text-slate-700">Riwayat obat pasien <span class="font-normal text-slate-500" x-text="'(' + riwayatBulan + ' bulan terakhir: ' + rxRiwayat(rx).length + ' obat)'"></span></span>
                      <span class="ms text-[16px] text-slate-400" x-text="riwayatBuka ? 'expand_less' : 'expand_more'"></span>
                    </button>
                    <div x-show="riwayatBuka" x-cloak class="p-2.5 space-y-1.5 bg-white">
                      <template x-if="!rxRiwayat(rx).length">
                        <p class="text-[11.5px] text-slate-400">Belum ada resep sah untuk pasien ini dalam <span x-text="riwayatBulan"></span> bulan terakhir. Kalau ini pengulangan, resep asalnya di luar rentang itu &mdash; atau memang belum pernah ada.</p>
                      </template>
                      <template x-for="(h, hi) in rxRiwayat(rx)" :key="hi">
                        <div class="text-[11.5px] leading-relaxed">
                          <span class="text-slate-400" x-text="h.date"></span>
                          <span x-show="h.is_compound" x-cloak class="px-1 py-0.5 rounded text-[9.5px] font-bold bg-purple-600 text-white align-middle">RACIKAN</span>
                          <span class="text-slate-800" x-text="' ' + riwayatRingkas(h)"></span>
                          <span class="text-slate-400" x-text="(h.rx_number ? ' · ' + h.rx_number : '') + (h.doctor_name ? ' · ' + h.doctor_name : '') + (h.from_pharmacy ? ' · lewat apotek' : '')"></span>
                        </div>
                      </template>
                    </div>
                  </div>
                  <!-- Jasa dokter ditentukan di sini, saat menyetujui — bukan
                       oleh apotek saat menyusun. -->
                  <div class="mt-2 rounded-xl bg-green-50/70 border border-green-100 p-2.5">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" x-model="jasa" class="rounded border-green-300">
                      <span class="text-xs font-semibold text-green-900">Cantumkan jasa dokter pada resep ini</span>
                    </label>
                    <div x-show="jasa" x-cloak class="mt-2 flex items-center gap-2 flex-wrap">
                      <span class="text-xs text-green-800">Rp</span>
                      <input type="number" min="0" step="5000" x-model="nominal" placeholder="0" class="w-32 px-2 py-1 border border-green-200 rounded-lg text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-green-400/50">
                      <span class="text-[11px] text-green-700">Ditarik apotek dari pasien saat pengambilan obat.</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Vaksinasi yang diinput admin -->
        <template x-if="!loading && vaxItems.length > 0">
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Vaksinasi <span x-text="'(' + vaxItems.length + ')'"></span></h3>
            <div class="space-y-3">
              <template x-for="v in vaxItems" :key="v.id">
                <div class="bg-white border border-slate-100 rounded-3xl p-4">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Vaksinasi</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Menunggu ACC</span>
                      </div>
                      <p class="font-semibold text-gray-800 mt-2" x-text="patientName(v.patient_id)"></p>
                      <p class="text-sm text-gray-700" x-text="v.vaccine_name + (v.vaccine_brand ? ' — ' + v.vaccine_brand : '')"></p>
                      <p class="text-xs text-gray-500" x-text="vaxDose(v) + (v.date_given ? ' | ' + v.date_given : '') + (v.batch_number ? ' | Batch: ' + v.batch_number : '')"></p>
                      <p class="text-xs text-gray-500" x-show="v.location" x-text="'Lokasi: ' + v.location"></p>
                      <p class="text-xs text-gray-500" x-show="v.notes" x-text="'Catatan: ' + v.notes"></p>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                      <button @click="previewVax(v)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Lihat Draft</button>
                      <button @click="rejectVax(v)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition">Tolak</button>
                      <button @click="approveVax(v)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">Setujui &amp; Sahkan</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>

        <template x-if="!loading && totalMenunggu === 0">
          <div class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Tidak ada dokumen yang menunggu persetujuan.</div>
        </template>
        <template x-if="!loading && items.length > 0">
          <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Surat Keterangan <span x-text="'(' + items.length + ')'"></span></h3>
        </template>
        <div class="space-y-3">
          <template x-for="item in items" :key="item.id">
            <div class="bg-white border border-slate-100 rounded-3xl p-4">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="(item.perihal||'')==='SEHAT' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'" x-text="'Surat ' + ((item.perihal||'').charAt(0)+(item.perihal||'').slice(1).toLowerCase())"></span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Menunggu ACC</span>
                  </div>
                  <p class="font-semibold text-gray-800 mt-2" x-text="item.patient_name"></p>
                  <p class="text-xs text-gray-500" x-text="'No. ' + item.cert_number"></p>
                  <p class="text-xs text-gray-500" x-show="item.details && item.details.diagnosis" x-text="'Diagnosis: ' + (item.details && item.details.diagnosis)"></p>
                  <p class="text-xs text-gray-500" x-show="item.details && item.details.keperluan" x-text="'Keperluan: ' + (item.details && item.details.keperluan)"></p>
                </div>
                <div class="flex gap-2 flex-wrap">
                  <button @click="preview(item.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Lihat Draft</button>
                  <button @click="reject(item)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition">Tolak</button>
                  <button @click="approve(item)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Setujui &amp; Sahkan</button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>`;
}

// ===========================================================================
// KEWAJIBAN REKAM MEDIS.
//
// Resep dan surat keterangan adalah tindakan medis. Begitu dokter meng-ACC
// salah satunya, ia sudah membuat keputusan klinis atas nama pasien itu — dan
// keputusan klinis harus ada rekam medisnya. Resep atau surat tanpa rekam
// medis adalah tindakan tanpa dasar tertulis: tidak bisa ditelusuri, tidak
// bisa dipertanggungjawabkan bila dipersoalkan, dan membuat riwayat pasiennya
// bolong justru di bagian yang paling penting.
//
// DUA JALAN MELUNASINYA, dan yang kedua sama pentingnya dengan yang pertama:
// membuat rekam medis baru, ATAU menautkan ke kunjungan yang memang sudah
// tercatat. Tanpa jalan kedua, dokter yang resepnya cuma lupa tertaut akan
// membuat rekam medis kembar — dan riwayat pasien yang penuh kembaran sama
// tidak bisa dibacanya dengan yang bolong.
// ===========================================================================
// Kartu vaksin anak dari sisi dokter. Isinya sama persis dengan yang dilihat
// admin — dirakit dari potongan yang sama di js/pages/vaksin.js, supaya
// keduanya tidak pelan-pelan menjadi dua perilaku yang berbeda.
export function doctorVaksin() {
  const doc = getDoctor();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${vaxAnakXData('doctor')} }" class="min-h-screen bg-wash">
    ${doctorSidebar('vaksin')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-[236px]' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto pb-24 lg:pb-6">
        <h2 class="text-2xl font-bold text-ink mb-1">Vaksin Anak</h2>
        <p class="text-[12.5px] text-muted mb-5">Tanggalnya dihitung dari tanggal lahir dan dosis terakhir &mdash; anak yang vaksinnya tertunda karena demam tidak perlu lagi dijadwalkan ulang satu per satu.</p>
        ${vaxAnakBody()}
      </main>
    </div>
  </div>`;
}

export function doctorRmDebt() {
  const doc = getDoctor();
  const hutang = store.rmDebtsForDoctor(doc?.id);
  // Kunjungan yang sudah tercatat untuk tiap pasien pada daftar ini —
  // dipakai pilihan "tautkan ke kunjungan yang sudah ada".
  const kunjungan = {};
  [...new Set(hutang.map(h => h.patient_id))].forEach(pid => {
    kunjungan[pid] = store.getRecords(pid).map(r => ({
      id: r.id,
      label: (r.visit_date || '') + ' — ' + (r.diagnosis || r.anamnesis || 'Kunjungan'),
    }));
  });
  window.__rmHutang = hutang;
  window.__rmKunjungan = kunjungan;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    docId: '${doc?.id || ''}',
    hutang: window.__rmHutang || [],
    kunjungan: window.__rmKunjungan || {},
    pilihan: {},
    sibuk: '',
    kunjunganUntuk(h) { return this.kunjungan[h.patient_id] || []; },
    urlBuatRm(h) { return '#/doctor/emr/' + h.patient_id + '/new/' + h.kind + '/' + h.id; },
    lamaHari(h) {
      if (!h.date) return null;
      const d = Math.floor((Date.now() - new Date(h.date).getTime()) / 86400000);
      return isNaN(d) ? null : Math.max(0, d);
    },
    async tautkan(h) {
      const recId = this.pilihan[h.kind + ':' + h.id];
      if (!recId) return;
      this.sibuk = h.kind + ':' + h.id;
      const r = await window.__store.linkRecordTo(h.kind, h.id, recId);
      this.sibuk = '';
      if (r && r.error) { window.__showToast && window.__showToast('Belum tertaut', r.error); return; }
      this.hutang = this.hutang.filter(x => !(x.kind === h.kind && x.id === h.id));
      window.__showToast && window.__showToast('Tertaut', h.label + ' kini punya dasar rekam medis.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 400);
    }
  }" class="min-h-screen bg-wash">
    ${doctorSidebar('rm-debt')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-4xl mx-auto">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h2 class="text-xl font-bold text-gray-800">Kewajiban Rekam Medis</h2>
          <span x-show="hutang.length > 0" x-cloak class="px-2 py-0.5 rounded-full bg-[#ff5436] text-white text-xs font-bold" x-text="hutang.length"></span>
        </div>
        <p class="text-sm text-gray-500 mb-6">Resep dan surat keterangan yang sudah <b>sah atas nama Anda</b> tetapi belum punya rekam medis. Setiap tindakan medis perlu dasar tertulis &mdash; tanpa itu, resep atau suratnya tidak bisa dipertanggungjawabkan bila dipersoalkan.</p>

        <template x-if="hutang.length === 0">
          <div class="bg-white rounded-3xl border border-slate-100 p-8 text-center">
            <p class="text-sm font-semibold text-green-700">Tidak ada kewajiban yang tertunggak.</p>
            <p class="text-xs text-gray-400 mt-1">Semua resep &amp; surat keterangan Anda sudah punya rekam medisnya.</p>
          </div>
        </template>

        <div class="space-y-3">
          <template x-for="h in hutang" :key="h.kind + ':' + h.id">
            <div class="bg-white border border-slate-100 rounded-3xl p-4">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-[220px]">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="h.kind === 'rx' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'" x-text="h.kind === 'rx' ? 'Resep' : 'Surat'"></span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Belum ada RM</span>
                    <span x-show="h.from_pharmacy" x-cloak class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">dari apotek</span>
                  </div>
                  <p class="font-semibold text-gray-800 mt-2" x-text="h.patient_name"></p>
                  <p class="text-xs text-gray-500" x-text="h.label + (h.date ? ' · ' + h.date : '')"></p>
                  <p class="text-xs text-gray-500 mt-0.5" x-text="h.detail"></p>
                  <!-- Umur hutangnya disebut: yang menua paling sulit ditulis,
                       karena kejadiannya sudah tidak diingat lagi. -->
                  <p x-show="lamaHari(h) !== null && lamaHari(h) >= 7" x-cloak class="text-[11px] font-semibold text-red-600 mt-1" x-text="'Tertunggak ' + lamaHari(h) + ' hari'"></p>
                </div>
                <a :href="urlBuatRm(h)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition shrink-0" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Buat Rekam Medis</a>
              </div>

              <!-- Jalan kedua: kunjungannya mungkin memang sudah tercatat dan
                   yang kurang cuma tautannya. Memaksa membuat RM baru untuk
                   kasus itu justru menghasilkan rekam medis kembar. -->
              <template x-if="kunjunganUntuk(h).length">
                <div class="mt-3 pt-3 border-t border-slate-100">
                  <p class="text-[11px] text-slate-500 mb-1.5">Atau tautkan ke kunjungan yang sudah tercatat:</p>
                  <div class="flex gap-2 flex-wrap">
                    <select x-model="pilihan[h.kind + ':' + h.id]" class="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                      <option value="">Pilih kunjungan...</option>
                      <template x-for="k in kunjunganUntuk(h)" :key="k.id"><option :value="k.id" x-text="k.label"></option></template>
                    </select>
                    <button @click="tautkan(h)" :disabled="!pilihan[h.kind + ':' + h.id] || sibuk === (h.kind + ':' + h.id)" class="px-3 py-2 rounded-lg text-xs font-semibold text-teal-800 bg-teal-100 hover:bg-teal-200 transition disabled:opacity-40">Tautkan</button>
                  </div>
                </div>
              </template>
              <template x-if="!kunjunganUntuk(h).length">
                <p class="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">Pasien ini belum punya kunjungan tercatat sama sekali &mdash; rekam medisnya harus dibuat baru.</p>
              </template>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>`;
}

export function doctorCalendar(params) {
  const doc = getDoctor();
  const today = new Date();
  const todayStr = todayLocal();
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
    const name = p?.full_name || a.patient_name || 'N/A';
    const dateLabel = formatDate(a.date) + (a.time_slot ? ' jam ' + a.time_slot : '');
    const confirmUrl = window.location.origin + '/#/konfirmasi/' + a.id;
    const _m = waKontrolMsg(name, dateLabel, a.notes, confirmUrl);
    return { ...a, patient_name: name, patient_id: a.patient_id, wa: waHref(p?.phone, _m), wa_msg: waMsgB64(_m) };
  });
  window.__calendarAppts = apptsData;

  const recordsData = allRecords.map(r => {
    const p = store.getPatient(r.patient_id);
    return { id: r.id, patient_id: r.patient_id, patient_name: p?.full_name || 'N/A', visit_date: r.visit_date, diagnosis: r.diagnosis, visit_type: r.visit_type };
  });
  window.__calendarRecords = recordsData;

  // Tugas pribadi pemilik akun yang sedang login — bukan milik dokter lain.
  const calUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const calTasks = calendarTasksSetup(calUser && calUser.id);

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    selectedDate: '${isCurrentMonth ? todayStr : `${year}-${String(month + 1).padStart(2, '0')}-01`}',
    allAppts: window.__calendarAppts || [],
    allRecords: window.__calendarRecords || [],
    ${calendarTasksXData()},
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
                const taskCount = calTasks.filter(t => t.due_date === dateStr && t.status !== 'done').length;
                const base = [
                  ...Array(Math.min(recordCount, 3)).fill('bg-green-500'),
                  ...Array(Math.max(0, Math.min(apptCount, 3 - Math.min(recordCount, 3)))).fill('bg-teal-500'),
                ];
                // Titik ungu = ada tugas pribadi jatuh tempo hari itu. Selalu
                // diberi tempat (menggeser titik terakhir bila kuota 3 penuh)
                // supaya tanggal yang ada tugasnya tidak pernah terlihat kosong.
                const dotColors = taskCount ? base.slice(0, 2).concat('bg-indigo-500') : base;
                const dotsHtml = dotColors.map(c => `<span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : c}"></span>`).join('');
                return `<button @click="selectedDate='${dateStr}'" :class="selectedDate==='${dateStr}' && !${isToday} ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-400' : ''" class="relative py-2.5 rounded-lg transition hover:bg-teal-50 cursor-pointer ${isToday ? 'bg-teal-600 text-white hover:bg-teal-700 font-bold' : ''}"><span>${d}</span>${dotColors.length > 0 ? `<span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">${dotsHtml}</span>` : ''}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-4">
            <h3 class="font-semibold text-gray-800 mb-1">Jadwal</h3>
            <p class="text-xs text-gray-500 mb-4" x-text="selectedDateFormatted"></p>
            <div class="space-y-2">
              <template x-if="selectedAppts.length === 0 && selectedRecords.length === 0 && selectedTasks.length === 0"><p class="text-gray-400 text-sm text-center py-8">Tidak ada jadwal, rekam medis, atau tugas di tanggal ini</p></template>
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
                  <div class="flex gap-2 mt-2 flex-wrap items-center">
                    <a x-show="apt.status === 'waiting' || apt.status === 'scheduled'" :href="'#/doctor/emr/'+apt.patient_id+'/new'" class="px-2 py-1 rounded text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Mulai Konsultasi</a>
                    <a x-show="apt.wa" :href="apt.wa" target="_blank" rel="noopener" @click="window.__logWaReminder('appointments', apt.id); apt.wa_reminder_count=(apt.wa_reminder_count||0)+1" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2zm0 18.1a8.2 8.2 0 01-4.2-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.1zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2-1.4-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4 0-.7.3-.2.2-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>Ingatkan via WA</a>
                    <button x-show="!apt.wa && apt.patient_id" @click.stop="window.__waAddPhone(apt.patient_id, apt.wa_msg, 'appointments', apt.id)" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366]/70 hover:bg-[#25D366] transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2z"/></svg>Isi No. HP &amp; WA</button>
                    <span x-show="apt.wa_reminder_count" x-cloak class="text-[11px] text-gray-400" x-text="'📤 Sudah di-WA '+apt.wa_reminder_count+'x'"></span>
                  </div>
                  <div class="mt-1.5">
                    <span x-show="apt.patient_response==='confirmed'" x-cloak class="text-[11px] font-medium text-green-600">🟢 Hadir dikonfirmasi pasien</span>
                    <span x-show="apt.patient_response==='reschedule'" x-cloak class="text-[11px] font-medium text-amber-600" x-text="'🟡 Pasien minta ganti hari'+(apt.proposed_date ? ': '+new Date(apt.proposed_date).toLocaleDateString('id-ID',{day:'numeric',month:'short'})+(apt.proposed_time ? ' '+apt.proposed_time : '') : '')"></span>
                    <span x-show="!apt.patient_response" class="text-[11px] text-gray-400">⚪ Belum dikonfirmasi</span>
                    <button x-show="apt.patient_response==='reschedule' && apt.proposed_date" x-cloak @click="if(confirm('Geser jadwal '+apt.patient_name+' ke '+new Date(apt.proposed_date).toLocaleDateString('id-ID')+(apt.proposed_time?' '+apt.proposed_time:'')+'?')){ window.__store.approveReschedule(apt.id); window.__showToast&&window.__showToast('Jadwal digeser', apt.patient_name+' → '+new Date(apt.proposed_date).toLocaleDateString('id-ID')); apt.date=apt.proposed_date; apt.time_slot=apt.proposed_time||apt.time_slot; apt.patient_response='confirmed'; apt.proposed_date=null; apt.proposed_time=null }" class="ml-2 px-2 py-0.5 rounded text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition">✔ Setujui & geser</button>
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
              ${calendarTasksBlock('selectedAppts.length > 0 || selectedRecords.length > 0')}
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

export function doctorCrm() {
  const doc = getDoctor();
  crmSetup();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${crmXData()} }" x-init="load()" class="min-h-screen bg-wash">
    ${doctorSidebar('crm')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${doctorHeader(doc)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        ${crmBody()}
      </main>
    </div>
  </div>`;
}

// Jumlah tugas terbuka yang didelegasikan ke akun ini — jadi lencana di menu
// "Tugas Saya". Dibungkus try/catch supaya sidebar tetap tampil kalau tabel
// tasks belum ada (SQL-nya belum dijalankan).
function openTaskCount(user) {
  if (!user) return 0;
  try { return store.getTasksForUser(user.id).filter(t => t.status !== 'done').length; }
  catch (e) { return 0; }
}

function doctorSidebar(active) {
  const doc = getDoctor();
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const unreadChat = doc ? store.getConsultationsForDoctor(doc.id).reduce((s, c) => s + (c.unread_count || 0), 0) : 0;
  // Angka pada "Menunggu ACC": resep + surat + vaksinasi yang menunggu
  // keputusan dokter ini. Tanpa angka, satu-satunya cara mengetahuinya adalah
  // membuka halamannya — dan yang tidak dibuka menahan apotek serta pasien.
  let accMenunggu = 0;
  try { accMenunggu = doc ? store.pendingAccCounts(doc.id).total : 0; } catch (e) { accMenunggu = 0; }
  // Resep & surat sah yang belum punya rekam medis. Angkanya sengaja terpisah
  // dari "Menunggu ACC": yang satu pekerjaan memutuskan, yang satu pekerjaan
  // mencatat — menggabungkannya membuat keduanya sama-sama kabur.
  let rmHutang = 0;
  try { rmHutang = doc ? store.rmDebtCount(doc.id) : 0; } catch (e) { rmHutang = 0; }
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', href: '#/doctor/dashboard' },
    { id: 'patients', label: 'Pasien', icon: 'groups', href: '#/doctor/patients' },
    { id: 'emr', label: 'Rekam Medis', icon: 'clinical_notes', href: '#/doctor/records' },
    { id: 'prescriptions', label: 'E-Resep', icon: 'prescriptions', href: '#/doctor/prescriptions' },
    { id: 'skd-approval', label: 'Menunggu ACC', icon: 'assignment_turned_in', href: '#/doctor/skd-approval', badge: accMenunggu },
    { id: 'rm-debt', label: 'Kewajiban RM', icon: 'assignment_late', href: '#/doctor/rm-debt', badge: rmHutang },
    { id: 'vaksin', label: 'Vaksin Anak', icon: 'vaccines', href: '#/doctor/vaksin' },
    { id: 'crm', label: 'CRM Prospek', icon: 'contacts', href: '#/doctor/crm' },
    { id: 'chat', label: 'Pesan', icon: 'forum', href: '#/doctor/chat', badge: unreadChat },
    { id: 'homecare', label: 'BMHP & Jasa', icon: 'home_health', href: '#/doctor/homecare/history' },
    { id: 'calendar', label: 'Kalender', icon: 'calendar_month', href: '#/doctor/calendar' },
    // Pemegang panel (Super Admin & pemilik klinik) mendapat panel penuh di
    // sini juga, supaya bisa membuat & mendelegasikan tugas tanpa harus pindah
    // dulu ke tampilan SuperAdmin. Dokter lain hanya melihat tugasnya sendiri.
    { id: 'tugas', label: store.canManageTasks(user) ? 'To-Do & Tugas' : 'Tugas Saya', icon: 'checklist', href: '#/tugas', badge: openTaskCount(user) },
    // Catatan Bisnis — pribadi, hanya muncul untuk akun pemilik klinik.
    ...((store.canManageNotes(user) || store.canViewSharedNotes(user)) ? [{ id: 'catatan', label: 'Catatan Bisnis', icon: 'menu_book', href: '#/catatan' }] : []),
  ];
  return `
  <div x-show="sideOpen" x-cloak x-transition.opacity @click="sideOpen=false" class="fixed inset-0 bg-black/40 z-[35] lg:hidden"></div>
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-white border-r border-slate-100 z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-100 flex items-center justify-between" style="flex-shrink:0">
      <div class="flex items-center gap-2"><img src="assets/logos/medconnect-logo.svg" alt="MedConnect" class="h-7 w-auto"><div><span class="font-extrabold text-[13.5px] block leading-none">MedConnect</span><span class="block text-[10.5px] text-faint font-semibold mt-0.5">Ruang Dokter</span></div></div>
      <button @click="sideOpen=false" class="lg:hidden text-faint hover:text-ink"><span class="ms text-[20px]">close</span></button>
    </div>
    <nav class="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain side-scroll">${items.map(i => `<a href="${i.href}" @click="sideOpen=window.innerWidth>1024" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active === i.id ? 'bg-tint text-brand font-bold' : 'text-muted font-semibold hover:bg-slate-50'}"><span class="ms ${active === i.id ? 'ms-fill' : ''} text-[20px] ${active === i.id ? 'text-brand' : 'text-faint'}">${i.icon}</span><span class="flex-1">${i.label}</span>${i.badge ? `<span class="w-5 h-5 rounded-full bg-[#ff5436] text-white text-[10.5px] font-bold flex items-center justify-center">${i.badge}</span>` : ''}</a>`).join('')}</nav>
    ${user?.role === 'owner' ? `<div class="p-3 border-t border-slate-100" style="flex-shrink:0"><a href="#/admin/dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-brand hover:bg-slate-50 transition w-full"><span class="ms text-[20px]">shield_person</span>Lihat sebagai SuperAdmin</a></div>` : ''}
    <div class="px-3 pt-3" style="flex-shrink:0"><button onclick="window.__laporBug&&window.__laporBug()" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">bug_report</span>Lapor Bug</button></div>
    <div class="p-3 border-t border-slate-100" style="flex-shrink:0"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">logout</span>Keluar</button></div>
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
      <a href="#/doctor/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span><span data-notif-count class="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#ff5436] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white" style="${unread > 0 ? '' : 'display:none'}">${unread > 99 ? '99+' : unread}</span></a>
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(doc?.full_name || 'D').split(' ').map(n=>n[0]).join('').slice(0,2)}</div><span class="text-sm font-medium text-ink hidden sm:block">${doc?.full_name || 'Dokter'}</span></div>
    </div>
  </header>`;
}
