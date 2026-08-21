import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { supabase } from '../supabase.js';
import { homeCareNewPage, homeCareHistoryPage } from './homecare.js';
import { waHref, waKontrolMsg, waButton, waSapaMsg, waMsgB64 } from '../wa.js';
import { crmSetup, crmXData, crmBody } from './crm.js';
import { stockXData, stockBody } from './stock.js';
import { tasksSetup, tasksXData, tasksBody, calendarTasksSetup, calendarTasksXData, calendarTasksBlock } from './tasks.js';
import { umrohSetup, umrohXData, umrohBody } from './umroh.js';
import { vaxAnakXData, vaxAnakBody, vaxScheduleXData, vaxScheduleBody } from './vaksin.js';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Escape untuk teks bebas yang dirender sebagai HTML — '<' pada data pasien
// bisa merusak markup di sekitarnya bila tidak di-escape.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// new Date().toISOString().split('T')[0] reads the UTC date — WIB is
// UTC+7, so from local midnight to 7am that's still "yesterday" in UTC.
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function adminDashboard() {
  const stats = store.getStats();
  const users = store.getUsers();
  const recentUsers = users.slice(-5).reverse();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${adminSidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Dashboard SuperAdmin</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-brand flex items-center justify-center"><span class="ms text-[22px] text-white">group</span></div><div><p class="text-2xl font-bold text-ink">${stats.totalPatients}</p><p class="text-xs text-faint">Total Pasien</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span class="ms text-[22px] text-white">stethoscope</span></div><div><p class="text-2xl font-bold text-ink">${stats.totalDoctors}</p><p class="text-xs text-faint">Dokter Aktif</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#7b52c4"><span class="ms text-[22px] text-white">local_pharmacy</span></div><div><p class="text-2xl font-bold text-ink">${stats.totalPharmacies}</p><p class="text-xs text-faint">Apotek Mitra</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#e0a112"><span class="ms text-[22px] text-white">clinical_notes</span></div><div><p class="text-2xl font-bold text-ink">${stats.totalRecords}</p><p class="text-xs text-faint">Rekam Medis</p></div></div></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">User Terbaru</h3><a href="#/admin/users" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
          <div class="divide-y divide-gray-50">${recentUsers.map(u => {
            const roleLabels = { superadmin: 'Super Admin', doctor: 'Dokter', owner: 'Owner', patient: 'Pasien', pharmacy: 'Apotek' };
            const roleColors = { superadmin: 'bg-slate-800 text-white', doctor: 'bg-teal-100 text-teal-700', owner: 'bg-amber-100 text-amber-700', patient: 'bg-blue-100 text-blue-700', pharmacy: 'bg-purple-100 text-purple-700' };
            return `<div class="p-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(u.profile?.full_name || u.profile?.name || u.email).charAt(0).toUpperCase()}</div><div><p class="text-sm font-medium text-gray-800">${u.profile?.full_name || u.profile?.name || u.email}</p><p class="text-xs text-gray-500">${u.email}</p></div></div>
              <div class="flex items-center gap-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || 'bg-gray-100'}">${roleLabels[u.role] || u.role}</span><span class="w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}"></span></div>
            </div>`;
          }).join('')}</div>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminUsers() {
  // Hanya pemilik klinik yang boleh mengatur akses Catatan Bisnis. Ditaruh di
  // window, bukan di dalam atribut x-data, mengikuti aturan berkas ini.
  const _u = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  window.__bolehAturCatatan = store.canMakeTaskPrivate(_u);
  const currentUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  // Bootstrap case: before any Owner account exists at all, a plain SuperAdmin
  // may create the first one. Once at least one exists, only an existing
  // Owner can create another.
  const ownerExists = store.getUsers('owner').length > 0;
  const canCreateOwner = currentUser?.role === 'owner' || !ownerExists;
  // Daftar tempat praktik untuk menautkan akun apotek — lihat bukaTempatApotek.
  window.__lokasiPraktik = (store.data.practice_locations || [])
    .filter(l => l.is_active !== false)
    .map(l => ({ id: l.id, name: l.name || '' }));
  return `
  <div x-data="adminUsersData()" class="min-h-screen bg-wash">
    ${adminSidebar('users')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Manajemen User</h2>
          <button @click="showCreate=true" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah User</button>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button @click="filter=''" :class="!filter ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Semua</button>
          <button @click="filter='superadmin'" :class="filter==='superadmin' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Super Admin</button>
          <button @click="filter='doctor'" :class="filter==='doctor' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Dokter</button>
          <button @click="filter='owner'" :class="filter==='owner' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Owner</button>
          <button @click="filter='patient'" :class="filter==='patient' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Pasien</button>
          <button @click="filter='pharmacy'" :class="filter==='pharmacy' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Apotek</button>
          <div class="relative flex-1 min-w-[200px]"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari..."></div>
        </div>
        <!-- Create User Modal -->
        <div x-show="showCreate" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showCreate=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Tambah User Baru</h3>
            <div x-show="createMsg" class="mb-3 p-2 rounded-lg text-sm" :class="createMsg.includes('berhasil') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'" x-text="createMsg"></div>
            <form @submit.prevent="createUser">
              <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Role *</label><select x-model="newUser.role" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih Role</option><option value="superadmin">Super Admin</option><option value="doctor">Dokter</option>${canCreateOwner ? `<option value="owner">Owner (SuperAdmin + Dokter)</option>` : ''}<option value="patient">Pasien</option><option value="pharmacy">Apotek Mitra</option></select><p x-show="newUser.role==='superadmin'" x-cloak class="text-[11px] text-gray-400 mt-1">Super Admin bisa lebih dari satu. Setiap Super Admin punya akses penuh ke konsol admin, termasuk panel To-Do &amp; Tugas.</p></div>
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1" x-text="newUser.role==='pharmacy' ? 'Nama Apotek *' : 'Nama Lengkap *'"></label><input type="text" x-model="newUser.full_name" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Email <span class="text-gray-400">(opsional)</span></label><input type="email" x-model="newUser.email" placeholder="Kosongkan jika tanpa login" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Password <span class="text-gray-400" x-text="newUser.email && newUser.email.trim() ? '' : '(diabaikan tanpa email)'"></span></label><input type="text" x-model="newUser.password" :disabled="!(newUser.email && newUser.email.trim())" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 disabled:bg-gray-50 disabled:text-gray-400"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="newUser.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <template x-if="newUser.role==='doctor' || newUser.role==='owner'"><div><label class="block text-xs text-gray-600 mb-1">SIP</label><input type="text" x-model="newUser.sip_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='doctor' || newUser.role==='owner'"><div><label class="block text-xs text-gray-600 mb-1">Spesialisasi</label><input type="text" x-model="newUser.specialization" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">NIK</label><input type="text" x-model="newUser.nik" maxlength="16" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">Tanggal Lahir</label><input type="date" x-model="newUser.birth_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">Jenis Kelamin</label><select x-model="newUser.gender" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">Nama Keluarga / Wali</label><input type="text" x-model="newUser.family_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">No. HP Keluarga</label><input type="tel" x-model="newUser.family_phone" placeholder="0812..." class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">Hubungan dgn Pasien</label><select x-model="newUser.family_relation" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih</option>${(CONFIG.FAMILY_RELATIONS||[]).map(r=>`<option>${r}</option>`).join('')}</select></div></template>
                <template x-if="newUser.role==='pharmacy'"><div><label class="block text-xs text-gray-600 mb-1">No. SIPA</label><input type="text" x-model="newUser.license_no" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='pharmacy'"><div class="col-span-2 rounded-xl bg-purple-50 border border-purple-100 p-3">
                  <label class="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" x-model="newUser.can_prescribe" class="mt-0.5 rounded border-purple-300">
                    <span>
                      <span class="block text-[13px] font-semibold text-purple-900">Boleh menyusun resep sendiri</span>
                      <span class="block text-[11px] text-purple-700 leading-relaxed mt-0.5">Apotek ini boleh menyusun resep untuk pasien. Resepnya <b>tidak berlaku</b> sampai di-ACC dokter &mdash; sebelum disetujui, resep itu tidak masuk antrean pelayanan apotek mana pun. Biarkan mati bila apotek hanya melayani resep dari dokter.</span>
                    </span>
                  </label>
                </div></template>
                <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="newUser.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div class="flex gap-2 justify-end"><button type="button" @click="showCreate=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button type="submit" :disabled="creating" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!creating">Buat Akun</span><span x-show="creating" x-cloak>Memproses...</span></button></div>
            </form>
          </div>
        </div>
        <!-- Edit Email Modal -->
        <div x-show="editingUser" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="editingUser=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Ganti Email</h3>
            <div x-show="editMsg" class="mb-3 p-2 rounded-lg text-sm" :class="editMsg.includes('berhasil')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'" x-text="editMsg"></div>
            <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Email Baru</label><input type="email" x-model="newEmail" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            <div class="flex gap-2 justify-end"><button @click="editingUser=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="saveEmail" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Simpan</button></div>
          </div>
        </div>
        <!-- Edit Doctor / SIP Modal -->
        <div x-show="editDoc" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="editDoc=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-1">Edit Data Dokter</h3>
            <p class="text-xs text-gray-500 mb-4">SIP yang tercetak di surat & sertifikat diambil dari sini.</p>
            <div x-show="docMsg" class="mb-3 p-2 rounded-lg text-sm" :class="docMsg.includes('berhasil')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'" x-text="docMsg"></div>
            <div class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Nama Lengkap</label><input type="text" x-model="docForm.full_name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div><label class="block text-xs text-gray-600 mb-1">No. SIP / SIPD</label><input type="text" x-model="docForm.sip_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: 500.16/1540/SIPD/..."></div>
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <label class="block text-xs font-semibold text-slate-800 mb-1">Tempat Praktik Dokter Ini</label>
                <p class="text-[11px] text-slate-600 mb-2 leading-relaxed">Boleh lebih dari satu, <b>masing-masing dengan nomor SIP-nya sendiri</b> &mdash; SIP memang diterbitkan per tempat praktik. Yang tercetak di resep adalah SIP di tempat resep itu ditulis. Dikosongkan berarti memakai No. SIP utama di atas.</p>
                <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  ${store.getAllLocations().map(l => `<div class="rounded-lg bg-white border border-slate-200 p-2">
                    <label class="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                      <input type="checkbox" @change="togglePlace('${escHtml(l.id)}')" :checked="hasPlace('${escHtml(l.id)}')" class="rounded border-slate-300">
                      <span class="flex-1">${escHtml(l.name)}</span>
                    </label>
                    <input type="text" x-show="hasPlace('${escHtml(l.id)}')" x-cloak
                      :value="placeSip('${escHtml(l.id)}')" @input="setPlaceSip('${escHtml(l.id)}', $event.target.value)"
                      placeholder="No. SIP di tempat ini (kosong = pakai SIP utama)"
                      class="mt-1.5 w-full px-2 py-1.5 border border-slate-200 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-400/50">
                  </div>`).join('')}
                </div>
              </div>
              <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <label class="block text-xs font-semibold text-indigo-900 mb-1">Kop Resep Bawaan</label>
                <select x-model="docForm.kop_location_id" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50">
                  <option value="">Ikut tempat praktik / Klinik Prima (bawaan)</option>
                  ${store.getAllLocations().map(l => `<option value="${escHtml(l.id)}">${escHtml(l.name)}${l.kop_name ? ' — ' + escHtml(l.kop_name) : ' (kop belum diisi)'}</option>`).join('')}
                </select>
                <p class="text-[11px] text-indigo-700 mt-1 leading-relaxed">Ini hanya <b>bawaannya</b>. Saat menulis resep, dokter tetap bisa memilih kop lain &mdash; pilihan pada resep itu yang berlaku. Kop menyatakan <b>di mana resep ditulis</b>, bukan ke mana resepnya dikirim: resepnya tetap bisa ditebus di apotek mana pun. Identitas kop tiap tempat (nama besar, e-mail, logo) diisi di menu <b>Lokasi Praktik</b>.</p>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">Spesialisasi</label><input type="text" x-model="docForm.specialization" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Dokter Umum"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="docForm.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>
            <div class="flex gap-2 justify-end mt-5"><button @click="editDoc=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="saveDoctor()" :disabled="savingDoc" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!savingDoc">Simpan</span><span x-show="savingDoc" x-cloak>Menyimpan...</span></button></div>
          </div>
        </div>
        <!-- Reset Password Modal -->
        <div x-show="resetUser" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="resetUser=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Reset Password</h3>
            <p class="text-sm text-gray-500 mb-4">Set password baru untuk <span class="font-medium text-gray-800" x-text="resetUser?.email"></span></p>
            <div x-show="resetMsg" class="mb-3 p-2 rounded-lg text-sm" :class="resetMsg.includes('berhasil')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'" x-text="resetMsg"></div>
            <div class="mb-4">
              <label class="block text-xs text-gray-600 mb-1">Password Baru (min 8 karakter)</label>
              <input type="text" x-model="resetNewPass" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Password baru">
            </div>
            <div class="flex gap-2 justify-end">
              <button @click="resetUser=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="doResetPassword()" :disabled="resetting" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!resetting">Set Password Baru</span><span x-show="resetting" x-cloak>Memproses...</span></button>
            </div>
          </div>
        </div>
        <!-- Tempat praktik apotek -->
        <div x-show="tempatUser" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="tempatUser=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-1">Tempat Praktik Apotek</h3>
            <p class="text-sm text-gray-500 mb-4"><span class="font-medium text-gray-800" x-text="tempatUser?.profile?.name || tempatUser?.profile?.full_name || ''"></span></p>
            <div class="mb-3 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
              <p class="text-[11.5px] text-blue-900 leading-relaxed">Tautan ini menentukan <b>dokter mana yang boleh dijadikan penanggung jawab surat keterangan</b> yang disusun apotek ini &mdash; hanya dokter yang berpraktik di tempat yang sama. Tidak berpengaruh pada resep.</p>
            </div>
            <div x-show="tempatMsg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="tempatMsg"></div>
            <label class="block text-xs text-gray-600 mb-1">Tempat praktik</label>
            <select x-model="tempatPilih" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/50">
              <option value="">— belum ditautkan —</option>
              <template x-for="l in lokasiList" :key="l.id"><option :value="l.id" x-text="l.name"></option></template>
            </select>
            <p class="text-[11px] mt-2" x-show="tempatPilih" x-cloak
               :class="dokterDiTempat(tempatPilih).length ? 'text-slate-500' : 'text-amber-700'"
               x-text="dokterDiTempat(tempatPilih).length ? ('Dokter di sini: ' + dokterDiTempat(tempatPilih).join(', ')) : 'Belum ada dokter yang terdaftar berpraktik di sini — apotek ini belum bisa membuat surat keterangan sampai ada. Atur di halaman Tempat Praktik & Kop.'"></p>
            <div class="flex gap-2 justify-end mt-4">
              <button @click="tempatUser=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="simpanTempatApotek()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Simpan</button>
            </div>
          </div>
        </div>
        <!-- Certificate Download Modal -->
        <div x-show="certUser" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="certUser=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-1">Sertifikat Vaksinasi</h3>
            <p class="text-sm text-gray-500 mb-4">Unduhkan sertifikat untuk <span class="font-medium text-gray-800" x-text="certUser?.profile?.full_name"></span></p>
            <div class="space-y-2 max-h-72 overflow-y-auto">
              <template x-for="vname in vaccineNamesFor(certUser)" :key="vname">
                <button @click="window.__generateVaxCert(certUser.profile.id, vname)" class="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition text-left">
                  <span class="text-sm font-medium text-gray-800" x-text="vname"></span>
                  <span class="text-xs text-purple-600 font-medium">Unduh &rarr;</span>
                </button>
              </template>
              <template x-if="vaccineNamesFor(certUser).length === 0"><p class="text-sm text-gray-400 text-center py-6">Pasien ini belum memiliki riwayat vaksinasi</p></template>
            </div>
            <button @click="certUser=null" class="w-full mt-4 px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Tutup</button>
          </div>
        </div>
        <!-- Users Table -->
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Role</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Email</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Status</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th></tr></thead>
          <tbody class="divide-y divide-gray-50">
            <template x-for="user in filteredUsers" :key="user.id">
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium" :class="{'bg-teal-100 text-teal-700': user.role==='doctor', 'bg-amber-100 text-amber-700': user.role==='owner', 'bg-blue-100 text-blue-700': user.role==='patient', 'bg-purple-100 text-purple-700': user.role==='pharmacy', 'bg-slate-800 text-white': user.role==='superadmin'}" x-text="user.role==='superadmin'?'Super Admin':user.role==='doctor'?'Dokter':user.role==='owner'?'Owner':user.role==='patient'?'Pasien':'Apotek'"></span></td>
                <td class="px-4 py-3 text-sm font-medium text-gray-800" x-text="user.profile?.full_name || user.profile?.name || '-'"></td>
                <td class="px-4 py-3 text-sm hidden sm:table-cell"><span x-show="!user.no_email" class="text-gray-600" x-text="user.email"></span><span x-show="user.no_email" x-cloak class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Tanpa email — belum bisa login</span></td>
                <td class="px-4 py-3 hidden md:table-cell"><span class="w-2 h-2 rounded-full inline-block" :class="user.is_active ? 'bg-green-500' : 'bg-red-500'"></span><span class="text-xs ml-1" x-text="user.is_active ? 'Aktif' : 'Nonaktif'"></span></td>
                <td class="px-4 py-3"><div class="flex gap-1">
                  <button @click="editingUser=user; newEmail=user.email; editMsg=''" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Email</button>
                  <button @click="toggleActive(user.id)" class="px-2 py-1 rounded text-xs font-medium" :class="user.is_active ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'" x-text="user.is_active ? 'Nonaktifkan' : 'Aktifkan'"></button>
                  <button @click="resetUser=user; resetNewPass=''; resetMsg=''" class="px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Reset Pass</button>
                  <template x-if="user.role==='patient'"><button @click="certUser=user" class="px-2 py-1 rounded text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition">Sertifikat</button></template>
                  <template x-if="user.role==='doctor' || user.role==='owner'"><button @click="openEditDoc(user)" class="px-2 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition">Edit Dokter/SIP</button></template>
                  <template x-if="user.role==='pharmacy'"><button @click="bukaTempatApotek(user)" title="Tautkan apotek ini ke tempat praktik — menentukan dokter mana yang boleh dijadikan penanggung jawab surat keterangannya" class="px-2 py-1 rounded text-xs font-medium" :class="tempatApotek(user) ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'" x-text="tempatApotek(user) || 'Tempat Praktik: belum diatur'"></button></template>
                  <template x-if="bolehAturCatatan && user.role !== 'patient'"><button @click="toggleCatatan(user)" :title="punyaCatatan(user) ? 'Tutup akses Catatan Bisnis' : 'Beri akses Catatan Bisnis sendiri'" class="px-2 py-1 rounded text-xs font-medium" :class="punyaCatatan(user) ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'" x-text="punyaCatatan(user) ? 'Punya Catatan' : 'Tanpa Catatan'"></button></template>
                  <template x-if="user.role==='pharmacy'"><button @click="toggleRxIzin(user)" :title="user.profile?.can_prescribe ? 'Cabut izin menyusun resep' : 'Izinkan apotek ini menyusun resep (tetap harus di-ACC dokter)'" class="px-2 py-1 rounded text-xs font-medium" :class="user.profile?.can_prescribe ? 'text-purple-700 bg-purple-100 hover:bg-purple-200' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'" x-text="user.profile?.can_prescribe ? 'Boleh Tulis Resep' : 'Tidak Boleh Tulis Resep'"></button></template>
                  <template x-if="user.role==='doctor'"><button @click="toggleDoctorListing(user)" class="px-2 py-1 rounded text-xs font-medium" :class="user.profile?.is_public_listed ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'" x-text="user.profile?.is_public_listed ? 'Sembunyikan dari Beranda' : 'Tampilkan di Beranda'"></button></template>
                  <button @click="deleteUser(user)" class="px-2 py-1 rounded text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition">Hapus</button>
                </div></td>
              </tr>
            </template>
          </tbody></table></div>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminUsersData() {
  return {
    sideOpen: window.innerWidth > 1024,
    filter: '', search: '',
    showCreate: false, createMsg: '', creating: false,
    editingUser: null, newEmail: '', editMsg: '',
    editDoc: null, docForm: { full_name: '', sip_number: '', specialization: '', phone: '' }, docMsg: '', savingDoc: false,
    resetUser: null, resetNewPass: '', resetMsg: '', resetting: false,
    certUser: null,
    docPlaces: [],
    hasPlace(id) { return this.docPlaces.some(p => p.location_id === id); },
    placeSip(id) { const p = this.docPlaces.find(x => x.location_id === id); return p ? p.sip_number : ''; },
    setPlaceSip(id, v) { const p = this.docPlaces.find(x => x.location_id === id); if (p) p.sip_number = v; },
    togglePlace(id) {
      const i = this.docPlaces.findIndex(p => p.location_id === id);
      if (i === -1) this.docPlaces.push({ location_id: id, sip_number: '' });
      else this.docPlaces.splice(i, 1);
    },
    openEditDoc(user) {
      this.docMsg = '';
      const p = user.profile || {};
      this.docForm = { full_name: p.full_name || '', sip_number: p.sip_number || '', specialization: p.specialization || '', phone: p.phone || '', kop_location_id: p.kop_location_id || '' };
      this.docPlaces = window.__store.doctorPracticePlaces(p.id).slice();
      this.editDoc = user;
    },
    async saveDoctor() {
      if (!this.editDoc || !this.editDoc.profile) { this.docMsg = 'Data dokter tidak ditemukan'; return; }
      this.savingDoc = true; this.docMsg = '';
      const { kop_location_id, ...profil } = this.docForm;
      const result = store.updateDoctorProfile(this.editDoc.profile.id, profil);
      this.savingDoc = false;
      if (result && result.error) { this.docMsg = result.error; return; }
      // Kop resep disimpan lewat jalurnya sendiri karena ia menyentuh kolom
      // yang bukan bagian dari profil dokter.
      const kop = await store.setDoctorKop(this.editDoc.profile.id, kop_location_id || null);
      if (kop && kop.error) { this.docMsg = kop.error; return; }
      this.editDoc.profile.kop_location_id = kop_location_id || null;
      const tp = await store.setDoctorPracticePlaces(this.editDoc.profile.id, this.docPlaces);
      if (tp && tp.error) { this.docMsg = tp.error; return; }
      // If the admin edited their own (owner) doctor record, refresh the cached
      // session profile so the new SIP shows on letters without re-login.
      const cur = JSON.parse(sessionStorage.getItem('medconnect_profile') || 'null');
      if (cur && cur.id === this.editDoc.profile.id) sessionStorage.setItem('medconnect_profile', JSON.stringify({ ...cur, ...this.docForm }));
      this.docMsg = 'Data dokter berhasil disimpan!';
      setTimeout(() => { this.editDoc = null; }, 900);
    },
    vaccineNamesFor(user) {
      if (!user || !user.profile || !user.profile.id) return [];
      const vax = window.__store.getVaccinations(user.profile.id);
      return [...new Set(vax.map(v => v.vaccine_name))];
    },
    // Izin apotek menyusun resep. Konfirmasinya menyebut nama apoteknya dan
    // menegaskan bahwa resepnya tetap harus di-ACC dokter — supaya izin ini
    // tidak diberikan karena salah paham bahwa apotek jadi bisa meresepkan
    // sendiri tanpa dokter.
    // ---- Tempat praktik apotek ----
    // Menentukan dokter mana yang boleh dijadikan penanggung jawab surat
    // keterangan yang disusun apotek itu: hanya dokter yang berpraktik di
    // tempat yang sama. Tanpa tautan ini apotek tidak bisa membuat surat sama
    // sekali — bukan bisa memilih dokter mana pun.
    lokasiList: window.__lokasiPraktik || [],
    tempatUser: null, tempatPilih: '', tempatMsg: '',
    tempatApotek(user) {
      const ph = user && user.profile;
      if (!ph || !ph.id) return '';
      const id = window.__store.pharmacyLocationId(ph.id);
      const l = (this.lokasiList || []).find(x => x.id === id);
      return l ? l.name : '';
    },
    bukaTempatApotek(user) {
      const ph = user && user.profile;
      if (!ph || !ph.id) { window.__showToast && window.__showToast('Gagal', 'Data apotek tidak ditemukan.'); return; }
      this.tempatMsg = '';
      this.tempatPilih = ph.location_id || window.__store.pharmacyLocationId(ph.id) || '';
      this.tempatUser = user;
    },
    dokterDiTempat(id) {
      return window.__store.doctorsAtLocation(id).map(d => d.full_name || 'Dokter');
    },
    async simpanTempatApotek() {
      const ph = this.tempatUser && this.tempatUser.profile;
      if (!ph) return;
      const r = await window.__store.setPharmacyLocation(ph.id, this.tempatPilih || null);
      if (r && r.error) { this.tempatMsg = r.error; return; }
      ph.location_id = r.location_id;
      this.tempatUser = null;
      window.__showToast && window.__showToast('Tersimpan', (ph.name || 'Apotek') + ' ditautkan ke tempat praktik.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 200);
    },
    // Siapa yang boleh punya Catatan Bisnis sendiri. Dulu daftarnya dipaku di
    // dalam kode: menambah satu orang berarti mengubah kode dan menerbitkan
    // ulang aplikasinya. Sekarang saklar per akun — dan hanya pemilik klinik
    // yang bisa menekannya, karena Catatan Bisnis memang lebih tertutup
    // daripada panel tugas.
    bolehAturCatatan: window.__bolehAturCatatan === true,
    punyaCatatan(user) { return !!(user && (user.can_notes === true || (user.profile && user.profile.can_notes === true))); },
    async toggleCatatan(user) {
      const nyala = this.punyaCatatan(user);
      const nama = (user.profile && (user.profile.full_name || user.profile.name)) || user.email || 'akun ini';
      const tanya = nyala
        ? 'Tutup akses Catatan Bisnis untuk ' + nama + '? Catatan yang sudah ditulisnya TIDAK terhapus, hanya tidak bisa dibuka lagi olehnya.'
        : 'Beri ' + nama + ' akses Catatan Bisnis sendiri? Dia bisa membuat catatannya sendiri; catatan Anda tetap tidak terlihat olehnya kecuali Anda bagikan.';
      if (!confirm(tanya)) return;
      const r = await window.__store.setNotesAccess(user.id, !nyala);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      user.can_notes = !nyala;
      if (user.profile) user.profile.can_notes = !nyala;
      window.__showToast && window.__showToast(!nyala ? 'Akses diberikan' : 'Akses ditutup',
        nama + (!nyala ? ' kini bisa punya Catatan Bisnis sendiri.' : ' tidak lagi bisa membuka Catatan Bisnis.'));
      setTimeout(function(){ window.__rerender && window.__rerender() }, 200);
    },
    async toggleRxIzin(user) {
      const ph = user && user.profile;
      if (!ph || !ph.id) { window.__showToast && window.__showToast('Gagal', 'Data apotek tidak ditemukan.'); return; }
      const nyala = ph.can_prescribe === true;
      const nama = ph.name || ph.full_name || 'apotek ini';
      const tanya = nyala
        ? 'Cabut izin menyusun resep untuk ' + nama + '? Resep yang sudah di-ACC dokter tetap berlaku.'
        : 'Izinkan ' + nama + ' menyusun resep? Setiap resep yang disusunnya TIDAK berlaku sampai di-ACC dokter, dan sebelum disetujui tidak masuk antrean pelayanan apotek mana pun.';
      if (!confirm(tanya)) return;
      const r = window.__store.setPharmacyCanPrescribe(ph.id, !nyala);
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      ph.can_prescribe = r.can_prescribe;
      window.__showToast && window.__showToast(
        r.can_prescribe ? 'Izin diberikan' : 'Izin dicabut',
        nama + (r.can_prescribe ? ' kini boleh menyusun resep (tetap perlu ACC dokter).' : ' tidak lagi boleh menyusun resep.'));
      setTimeout(function(){ window.__rerender && window.__rerender() }, 200);
    },
    newUser: { role: '', full_name: '', email: '', password: 'default123', phone: '', sip_number: '', specialization: '', nik: '', birth_date: '', gender: '', license_no: '', address: '', family_name: '', family_phone: '', family_relation: '', can_prescribe: false },
    get filteredUsers() {
      let users = store.getUsers(this.filter || undefined);
      if (this.search) {
        const q = this.search.toLowerCase();
        users = users.filter(u => (u.profile?.full_name || u.profile?.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      }
      return users;
    },
    async createUser() {
      this.createMsg = ''; this.creating = true;
      // Only Role and Nama Lengkap are mandatory now — email (and everything
      // else) is optional. A blank email means a login-less account.
      if (!this.newUser.role || !this.newUser.full_name) { this.createMsg = 'Role dan Nama Lengkap wajib diisi'; this.creating = false; return; }
      const hasEmail = !!(this.newUser.email && this.newUser.email.trim());
      const email = hasEmail ? this.newUser.email.trim() : store.makePlaceholderEmail();
      // Defense in depth: the role dropdown already hides "Owner" for non-Owner
      // accounts, but this blocks it here too in case someone forces the value
      // via devtools — only an existing Owner may create another Owner, except
      // for the very first one (bootstrap case, no Owner exists yet).
      const currentUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      const ownerAlreadyExists = store.getUsers('owner').length > 0;
      if (this.newUser.role === 'owner' && currentUser?.role !== 'owner' && ownerAlreadyExists) { this.createMsg = 'Hanya akun Owner yang bisa membuat akun Owner baru'; this.creating = false; return; }
      if (!CONFIG.DEMO_MODE) {
        try {
          // Create an auth login only when an email was provided. Without one,
          // there's nothing to log in with (and a synthetic address can't
          // receive Supabase's confirmation mail), so we skip signup and leave
          // auth_id null — an admin can add the email later to enable login.
          let authId = null;
          if (hasEmail) {
            const authRes = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/signup', {
              method: 'POST', headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: this.newUser.password || 'default123' })
            }).then(r => r.json());
            if (authRes.error) { this.createMsg = authRes.error.message || authRes.msg || 'Gagal buat auth user'; this.creating = false; return; }
            authId = authRes.user?.id || null;
          }
          // full_name/phone ikut ditulis ke profiles: Super Admin tidak punya
          // tabel profil tersendiri, jadi di sinilah namanya tersimpan. Untuk
          // peran lain kolom ini hanya cadangan (namanya tetap dibaca dari
          // doctors/patients/pharmacies). Butuh supabase-superadmin-staff.sql.
          const profileData = { email, role: this.newUser.role, is_active: true, full_name: this.newUser.full_name, phone: this.newUser.phone || '' };
          if (authId) profileData.auth_id = authId;
          const profileRes = await supabase.insert('profiles', profileData);
          if (profileRes.error) { this.createMsg = profileRes.error; this.creating = false; return; }
          const profileId = profileRes.id;
          if (this.newUser.role === 'doctor' || this.newUser.role === 'owner') {
            await supabase.insert('doctors', { profile_id: profileId, full_name: this.newUser.full_name, sip_number: this.newUser.sip_number || '', specialization: this.newUser.specialization || '', phone: this.newUser.phone || '', is_available: true });
          } else if (this.newUser.role === 'patient') {
            await supabase.insert('patients', { profile_id: profileId, full_name: this.newUser.full_name, nik: this.newUser.nik || '', birth_date: this.newUser.birth_date || null, gender: this.newUser.gender || '', phone: this.newUser.phone || '', address: this.newUser.address || '', allergies: '-', emergency_contact: '', family_name: this.newUser.family_name || '', family_phone: this.newUser.family_phone || '', family_relation: this.newUser.family_relation || '' });
          } else if (this.newUser.role === 'pharmacy') {
            await supabase.insert('pharmacies', { profile_id: profileId, name: this.newUser.full_name, phone: this.newUser.phone || '', address: this.newUser.address || '', license_no: this.newUser.license_no || '', operating_hours: '' });
            // Fasilitas berakun HARUS punya tempat praktik. Dimuat ulang dulu
            // supaya baris apoteknya sudah ada di data lokal, lalu dibuatkan
            // tempatnya — bukan diserahkan sebagai pekerjaan susulan yang
            // mudah terlupa.
            await window.__store.loadFromSupabase();
            const phBaru = (window.__store.data.pharmacies || []).find(x => x.user_id === profileId);
            if (phBaru) await window.__store.ensureLocationForPharmacy(phBaru.id);
          }
          await window.__store.loadFromSupabase();
          this.createMsg = hasEmail ? 'User berhasil dibuat! (tersimpan di cloud)' : 'Akun dibuat tanpa email — belum bisa login. Tambahkan email lewat tombol "Email" pada baris user untuk mengaktifkan login.';
        } catch(e) { this.createMsg = 'Error: ' + e.message; this.creating = false; return; }
      } else {
        const result = store.createUser({ ...this.newUser, name: this.newUser.full_name });
        if (result.error) { this.createMsg = result.error; this.creating = false; return; }
        this.createMsg = 'User berhasil dibuat!';
      }
      this.creating = false;
      this.newUser = { role: '', full_name: '', email: '', password: 'default123', phone: '', sip_number: '', specialization: '', nik: '', birth_date: '', gender: '', license_no: '', address: '', family_name: '', family_phone: '', family_relation: '' };
      // filteredUsers reads from `store` directly (not an Alpine-reactive proxy),
      // so the list won't refresh on its own after a create — force a re-render.
      window.__showToast && window.__showToast('Tersimpan', this.createMsg);
      setTimeout(function(){ window.__rerender && window.__rerender() }, 200);
    },
    async saveEmail() {
      this.editMsg = '';
      const newEmail = (this.newEmail || '').trim();
      if (!newEmail) { this.editMsg = 'Email tidak boleh kosong'; return; }
      if (!CONFIG.DEMO_MODE) {
        try {
          // If this account has no auth login yet — created without an email —
          // create the Supabase Auth user now (with a temporary password) and
          // link it, so the person can actually log in. Accounts that already
          // have a login just get their profile email updated.
          const needsLogin = !this.editingUser.auth_id || this.editingUser.no_email;
          const update = { email: newEmail };
          if (needsLogin) {
            const authRes = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/signup', {
              method: 'POST', headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, password: 'default123' })
            }).then(r => r.json());
            if (authRes.error) { this.editMsg = authRes.error.message || authRes.msg || 'Gagal mengaktifkan login'; return; }
            if (authRes.user?.id) update.auth_id = authRes.user.id;
          }
          const res = await supabase.update('profiles', this.editingUser.id, update);
          if (res && res.error) { this.editMsg = res.error; return; }
          await window.__store.loadFromSupabase();
          this.editMsg = needsLogin ? 'Email diset & login diaktifkan. Password sementara: default123 — gunakan "Reset Pass" untuk menggantinya.' : 'Email berhasil diubah! (tersimpan di cloud)';
          this.editingUser.email = newEmail;
        } catch(e) { this.editMsg = 'Error: ' + e.message; }
      } else {
        const result = store.updateUserEmail(this.editingUser.id, newEmail);
        if (result.error) { this.editMsg = result.error; return; }
        this.editMsg = 'Email berhasil diubah!';
        this.editingUser.email = newEmail;
      }
    },
    toggleDoctorListing(user) {
      if (!user.profile?.id) return;
      window.__store.toggleDoctorPublicListing(user.profile.id);
      window.location.hash = '/admin/dashboard';
      setTimeout(() => window.location.hash = '/admin/users', 50);
    },
    async toggleActive(userId) {
      const result = store.toggleUserActive(userId);
      if (result?.error) { alert(result.error); return; }
      if (!CONFIG.DEMO_MODE) {
        const user = store.data.users.find(u => u.id === userId);
        await supabase.update('profiles', userId, { is_active: user?.is_active ?? false });
      }
    },
    async doResetPassword() {
      this.resetMsg = '';
      if (!this.resetNewPass || this.resetNewPass.length < 8) { this.resetMsg = 'Password minimal 8 karakter'; return; }
      this.resetting = true;
      if (!CONFIG.DEMO_MODE) {
        try {
          const res = await supabase.rpc('admin_reset_password', {
            target_email: this.resetUser.email,
            new_password: this.resetNewPass
          });
          if (res.success) {
            this.resetMsg = 'Password berhasil diubah di cloud!';
          } else {
            this.resetMsg = res.error || 'Gagal reset password';
          }
        } catch(e) { this.resetMsg = 'Error: ' + e.message; }
      } else {
        const user = store.data.users.find(u => u.id === this.resetUser.id);
        if (user) { user.password = this.resetNewPass; store._save(store.data); }
        this.resetMsg = 'Password berhasil diubah!';
      }
      this.resetting = false;
    },
    async deleteUser(user) {
      const name = user.profile?.full_name || user.profile?.name || user.email;
      if (user.role === 'owner' && store.getUsers('owner').length <= 1) { alert('Tidak bisa menghapus — minimal harus ada 1 akun Owner.'); return; }
      if (user.role === 'superadmin' && store.getUsers('superadmin').length <= 1) { alert('Tidak bisa menghapus — minimal harus ada 1 akun Super Admin.'); return; }
      const me = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      if (me && me.id === user.id) { alert('Tidak bisa menghapus akun Anda sendiri.'); return; }
      if (!confirm('Hapus user "' + name + '" (' + user.email + ')?\n\nSemua data terkait (rekam medis, resep, vaksinasi) juga akan terhapus. Tindakan ini TIDAK bisa dibatalkan.')) return;
      if (!confirm('Anda YAKIN ingin menghapus "' + name + '"? Ketik OK untuk konfirmasi.')) return;

      if (!CONFIG.DEMO_MODE) {
        try {
          // Delete from role table
          if (user.role === 'doctor' || user.role === 'owner') await supabase.deleteWhere('doctors', { profile_id: user.id });
          else if (user.role === 'patient') await supabase.deleteWhere('patients', { profile_id: user.id });
          else if (user.role === 'pharmacy') await supabase.deleteWhere('pharmacies', { profile_id: user.id });

          // Delete auth user via SQL function
          await supabase.rpc('admin_delete_user', { target_email: user.email });

          // Delete profile
          await supabase.delete('profiles', user.id);

          // Reload data
          await window.__store.loadFromSupabase();
          alert(name + ' berhasil dihapus.');
          window.location.hash = '/admin/dashboard';
          setTimeout(() => window.location.hash = '/admin/users', 50);
        } catch(e) { alert('Error: ' + e.message); }
      } else {
        // Demo mode: hapus dari localStorage
        store.data.users = store.data.users.filter(u => u.id !== user.id);
        store.data.doctors = store.data.doctors.filter(d => d.user_id !== user.id);
        store.data.patients = store.data.patients.filter(p => p.user_id !== user.id);
        store.data.pharmacies = store.data.pharmacies.filter(p => p.user_id !== user.id);
        store._save(store.data);
        alert(name + ' berhasil dihapus.');
        window.location.hash = '/admin/dashboard';
        setTimeout(() => window.location.hash = '/admin/users', 50);
      }
    }
  };
}

export function adminServices() {
  const services = store.getAllServices();
  const cats = [...new Set(services.map(s => s.category))];
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    showForm: false, editing: null, msg: '',
    form: { name:'', description:'', category:'Vaksinasi', price:0, image_url:'https://placehold.co/400x250/0d9488/white?text=Layanan', is_promo:false, promo_original_price:0 },
    openNew() { this.editing = null; this.form = { name:'', description:'', category:'Vaksinasi', price:0, image_url:'https://placehold.co/400x250/0d9488/white?text=Layanan', is_promo:false, promo_original_price:0 }; this.showForm = true; this.msg = ''; },
    openEdit(s) { this.editing = s.id; this.form = { name:s.name, description:s.description, category:s.category, price:s.price, image_url:s.image_url, is_promo:!!s.is_promo, promo_original_price:s.promo_original_price||0 }; this.showForm = true; this.msg = ''; },
    save() {
      if (!this.form.name) { this.msg = 'Nama layanan wajib diisi'; return; }
      if (this.editing) { window.__store.updateService(this.editing, this.form); this.msg = 'Layanan berhasil diperbarui!'; }
      else { window.__store.createService(this.form); this.msg = 'Layanan berhasil ditambahkan!'; }
      setTimeout(() => { window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); }, 600);
    },
    toggleActive(id) { window.__store.toggleServiceActive(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); },
    remove(id) { if (confirm('Hapus layanan ini?')) { window.__store.deleteService(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); } }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('services')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Manajemen Layanan</h2>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah Layanan</button>
        </div>
        <!-- Add/Edit Modal -->
        <div x-show="showForm" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showForm=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4" x-text="editing ? 'Edit Layanan' : 'Tambah Layanan Baru'"></h3>
            <div x-show="msg" class="mb-3 p-2 rounded-lg text-sm" :class="msg.includes('berhasil') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'" x-text="msg"></div>
            <div class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Nama Layanan *</label><input type="text" x-model="form.name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Nama layanan"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Deskripsi</label><textarea x-model="form.description" rows="3" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Deskripsi layanan"></textarea></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Kategori</label><select x-model="form.category" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">${['Vaksinasi','Infus','Check-up','HomeCare','Telemedicine','Lainnya'].map(c=>`<option>${c}</option>`).join('')}</select></div>
                <div><label class="block text-xs text-gray-600 mb-1">Harga (Rp)</label><input type="number" x-model="form.price" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">URL Gambar</label><input type="text" x-model="form.image_url" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              <div class="pt-2 border-t border-gray-100">
                <label class="flex items-center gap-2 text-sm text-gray-700 font-medium"><input type="checkbox" x-model="form.is_promo" class="rounded border-gray-300 text-teal-600 focus:ring-teal-400/50">Jadikan Promo (tampil terhighlight di halaman depan)</label>
                <div x-show="form.is_promo" x-cloak class="mt-2"><label class="block text-xs text-gray-600 mb-1">Harga Coret (harga sebelum diskon)</label><input type="number" x-model="form.promo_original_price" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: 600000"><p class="text-xs text-gray-400 mt-1">Harga di kolom "Harga (Rp)" di atas akan jadi harga promonya.</p></div>
              </div>
            </div>
            <div class="flex gap-2 justify-end mt-4"><button @click="showForm=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="save()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Simpan</button></div>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${services.map(s => `<div class="bg-white border border-slate-100 rounded-3xl overflow-hidden group">
            <div class="relative"><img src="${s.image_url}" alt="${s.name}" class="w-full h-40 object-cover">
              ${s.is_promo ? `<span class="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-[#ffd23f] text-ink">PROMO</span>` : ''}
              <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onclick="Alpine.$data(document.querySelector('[x-data]')).openEdit(${JSON.stringify(s).replace(/"/g,'&quot;')})" class="w-8 h-8 rounded-lg bg-white/90 shadow flex items-center justify-center hover:bg-white transition"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
              </div>
            </div>
            <div class="p-4">
              <h4 class="font-semibold text-gray-800">${s.name}</h4>
              <p class="text-xs text-gray-500 mt-1">${(s.description||'').slice(0,80)}...</p>
              <div class="flex items-center justify-between mt-3">
                <span class="text-sm font-bold text-teal-600">${s.is_promo && s.promo_original_price ? `<span class="text-xs text-gray-400 line-through font-normal mr-1">Rp ${Number(s.promo_original_price).toLocaleString('id-ID')}</span>` : ''}Rp ${(s.price||0).toLocaleString('id-ID')}</span>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${s.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </div>
              </div>
              <div class="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                <button onclick="window.__store.toggleServiceActive('${s.id}'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/services',50)" class="px-2 py-1 rounded text-xs font-medium ${s.is_active ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-600 bg-green-50 hover:bg-green-100'} transition">${s.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button onclick="if(confirm('Hapus layanan ${s.name}?')){window.__store.deleteService('${s.id}'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/services',50)}" class="px-2 py-1 rounded text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition">Hapus</button>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </main>
    </div>
  </div>`;
}

export function adminArticles() {
  const articles = store.getAllArticles();
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    showForm: false, editing: null, msg: '',
    form: { title:'', excerpt:'', body:'', category:'', image_url:'https://placehold.co/400x250/1b6fd6/white?text=Artikel', sort_order:0 },
    openNew() { this.editing = null; this.form = { title:'', excerpt:'', body:'', category:'', image_url:'https://placehold.co/400x250/1b6fd6/white?text=Artikel', sort_order:0 }; this.showForm = true; this.msg = ''; },
    openEdit(a) { this.editing = a.id; this.form = { title:a.title, excerpt:a.excerpt||'', body:a.body||'', category:a.category||'', image_url:a.image_url||'', sort_order:a.sort_order||0 }; this.showForm = true; this.msg = ''; },
    save() {
      if (!this.form.title) { this.msg = 'Judul artikel wajib diisi'; return; }
      if (this.editing) { window.__store.updateArticle(this.editing, this.form); this.msg = 'Artikel berhasil diperbarui!'; }
      else { window.__store.createArticle(this.form); this.msg = 'Artikel berhasil ditambahkan!'; }
      setTimeout(() => { window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/articles', 50); }, 600);
    },
    toggleActive(id) { window.__store.toggleArticlePublished(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/articles', 50); },
    remove(id) { if (confirm('Hapus artikel ini?')) { window.__store.deleteArticle(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/articles', 50); } }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('articles')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Artikel Kesehatan</h2>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah Artikel</button>
        </div>
        <p class="text-sm text-gray-500 mb-4">Artikel yang dipublikasikan akan tampil di halaman depan publik (myprima.id).</p>
        <!-- Add/Edit Modal -->
        <div x-show="showForm" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showForm=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-gray-800 mb-4" x-text="editing ? 'Edit Artikel' : 'Tambah Artikel Baru'"></h3>
            <div x-show="msg" class="mb-3 p-2 rounded-lg text-sm" :class="msg.includes('berhasil') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'" x-text="msg"></div>
            <div class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Judul *</label><input type="text" x-model="form.title" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: Kapan demam anak perlu dibawa ke dokter?"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Ringkasan (tampil di kartu)</label><textarea x-model="form.excerpt" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none"></textarea></div>
              <div><label class="block text-xs text-gray-600 mb-1">Isi Artikel Lengkap</label><textarea x-model="form.body" rows="6" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></textarea></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Kategori</label><input type="text" x-model="form.category" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: Anak, Vaksinasi"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Urutan Tampil</label><input type="number" x-model="form.sort_order" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">URL Gambar</label><input type="text" x-model="form.image_url" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>
            <div class="flex gap-2 justify-end mt-4"><button @click="showForm=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="save()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Simpan</button></div>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${articles.length === 0 ? '<p class="text-sm text-gray-400 col-span-full text-center py-8">Belum ada artikel. Tambah artikel untuk menampilkannya di halaman depan.</p>' : articles.map(a => `<div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
            <img src="${a.image_url || 'https://placehold.co/400x250/1b6fd6/white?text=Artikel'}" alt="${a.title}" class="w-full h-32 object-cover">
            <div class="p-4">
              <div class="flex items-center justify-between mb-2">${a.category ? `<span class="px-2 py-0.5 rounded-full text-xs bg-tint text-brand-dark font-medium">${a.category}</span>` : '<span></span>'}<span class="px-2 py-1 rounded-full text-xs font-medium ${a.is_published ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${a.is_published ? 'Terbit' : 'Draf'}</span></div>
              <h4 class="font-semibold text-gray-800">${a.title}</h4>
              <p class="text-xs text-gray-500 mt-1">${(a.excerpt || '').slice(0, 90)}</p>
              <div class="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                <button onclick="Alpine.$data(document.querySelector('[x-data]')).openEdit(${JSON.stringify(a).replace(/"/g,'&quot;')})" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit</button>
                <button onclick="window.__store.toggleArticlePublished('${a.id}'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/articles',50)" class="px-2 py-1 rounded text-xs font-medium ${a.is_published ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-green-600 bg-green-50 hover:bg-green-100'} transition">${a.is_published ? 'Jadikan Draf' : 'Terbitkan'}</button>
                <button onclick="if(confirm('Hapus artikel ini?')){window.__store.deleteArticle('${a.id}'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/articles',50)}" class="px-2 py-1 rounded text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition">Hapus</button>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </main>
    </div>
  </div>`;
}

export function adminBookings() {
  window.__bookingsInitial = store.getBookings();
  window.__bookingDoctors = store.getDoctors().map(d => ({ id: d.id, full_name: d.full_name }));
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024, filter: '',
    bookings: window.__bookingsInitial || [],
    doctors: window.__bookingDoctors || [],
    confirming: null, confirmDoctorId: '', confirmTime: '',
    statusColors: { pending:'bg-amber-100 text-amber-700', confirmed:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', cancelled:'bg-red-100 text-red-700' },
    statusLabels: { pending:'Menunggu', confirmed:'Dikonfirmasi', completed:'Selesai', cancelled:'Dibatalkan' },
    get filteredBookings() { return this.filter ? this.bookings.filter(b => b.status === this.filter) : this.bookings; },
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 6000);
    },
    async poll() { this.bookings = await window.__store.fetchBookings(); },
    openConfirm(bookingId) { this.confirming = bookingId; this.confirmDoctorId = ''; this.confirmTime = ''; },
    // Every action below re-fetches straight from Supabase right after writing
    // (instead of trusting the local cache) so the admin immediately sees the
    // real, confirmed state rather than an optimistic value that could later
    // flip back and look like a glitch (this is exactly what happened with the
    // payment toggle before the missing 'is_paid' column was added).
    async submitConfirm() {
      if (!this.confirmDoctorId || !this.confirmTime) { alert('Pilih dokter dan jam terlebih dahulu'); return; }
      const result = await window.__store.confirmBookingWithAppointment(this.confirming, this.confirmDoctorId, this.confirmTime);
      if (result.error) { alert(result.error); return; }
      this.confirming = null;
      await this.poll();
    },
    async reject(id) { await window.__store.updateBookingStatus(id, 'cancelled'); await this.poll(); },
    async complete(id) { await window.__store.updateBookingStatus(id, 'completed'); await this.poll(); },
    async togglePaid(id) { await window.__store.toggleBookingPaid(id); await this.poll(); },
    async remove(id) {
      if (!confirm('Hapus pendaftaran ini secara permanen?')) return;
      const result = await window.__store.deleteBooking(id);
      if (result.error) { alert(result.error); return; }
      await this.poll();
    },
    waLink(phone) { return 'https://wa.me/62' + (phone || '').replace(/^0/, ''); }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('bookings')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Pendaftaran Layanan Masuk</h2>
        <div class="flex gap-2 mb-4">
          ${['','pending','confirmed','completed','cancelled'].map(s => `<button @click="filter='${s}'" :class="filter==='${s}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">${{'' :'Semua', pending:'Menunggu', confirmed:'Dikonfirmasi', completed:'Selesai', cancelled:'Dibatalkan'}[s]}</button>`).join('')}
        </div>
        <!-- Confirm Modal: pick doctor + exact time, creates a real calendar appointment -->
        <div x-show="confirming" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="confirming=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-1">Konfirmasi Jadwal</h3>
            <p class="text-sm text-gray-500 mb-4">Pilih dokter yang menangani dan jam pastinya — otomatis masuk ke kalender dokter tersebut.</p>
            <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Dokter *</label><select x-model="confirmDoctorId" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih Dokter</option><template x-for="d in doctors" :key="d.id"><option :value="d.id" x-text="d.full_name"></option></template></select></div>
            <div class="mb-4"><label class="block text-xs text-gray-600 mb-1">Jam Pasti *</label><input type="time" x-model="confirmTime" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            <div class="flex gap-2 justify-end"><button @click="confirming=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="submitConfirm()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">Konfirmasi</button></div>
          </div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <template x-if="filteredBookings.length === 0"><p class="p-8 text-center text-gray-400 text-sm">Belum ada pendaftaran</p></template>
          <template x-if="filteredBookings.length > 0">
            <div class="divide-y divide-gray-50">
              <template x-for="b in filteredBookings" :key="b.id">
                <div class="p-4 hover:bg-gray-50 transition">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <p class="font-medium text-gray-800 text-sm">
                        <span x-text="b.patient_name || 'Pasien'"></span>
                        <template x-if="b.is_guest"><span class="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 align-middle">Tamu</span></template>
                      </p>
                      <p class="text-xs text-gray-500" x-text="(b.item_name || b.service_name) + ' — Rp ' + (b.price||0).toLocaleString('id-ID')"></p>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="px-2 py-1 rounded-full text-xs font-medium" :class="b.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'" x-text="b.is_paid ? 'Sudah Bayar' : 'Belum Bayar'"></span>
                      <span class="px-2 py-1 rounded-full text-xs font-medium" :class="statusColors[b.status] || 'bg-gray-100'" x-text="statusLabels[b.status] || b.status"></span>
                    </div>
                  </div>
                  <div class="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                    <span>Tanggal: <span class="font-medium text-gray-700" x-text="b.preferred_date || '-'"></span></span>
                    <span>Waktu: <span class="font-medium text-gray-700" x-text="b.preferred_time || '-'"></span></span>
                    <template x-if="b.is_guest && b.patient_phone"><span>Telepon: <a :href="waLink(b.patient_phone)" target="_blank" class="font-medium text-teal-600" x-text="b.patient_phone"></a></span></template>
                    <template x-if="b.notes"><span x-text="'Catatan: ' + b.notes"></span></template>
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    <template x-if="b.status === 'pending'">
                      <button @click="openConfirm(b.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Konfirmasi</button>
                    </template>
                    <template x-if="b.status === 'pending'">
                      <button @click="reject(b.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">Tolak</button>
                    </template>
                    <template x-if="b.status === 'confirmed'">
                      <button @click="complete(b.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Tandai Selesai</button>
                    </template>
                    <button @click="togglePaid(b.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent transition" :class="b.is_paid ? 'text-gray-600 bg-gray-50 hover:bg-gray-100' : 'text-green-700 bg-green-50 hover:bg-green-100'" x-text="b.is_paid ? 'Batalkan Status Bayar' : 'Tandai Sudah Bayar'"></button>
                    <template x-if="b.status === 'cancelled'">
                      <button @click="remove(b.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition">Hapus</button>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminConsultations() {
  window.__consultationsInitial = store.getAllConsultations();
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    consultations: window.__consultationsInitial || [],
    init() {
      if (window.__pagePollInterval) clearInterval(window.__pagePollInterval);
      window.__pagePollInterval = setInterval(() => this.poll(), 6000);
    },
    async poll() { this.consultations = await window.__store.fetchAllConsultations(); }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('consultations')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-1">Riwayat Konsultasi</h2>
        <p class="text-sm text-gray-500 mb-4">Daftar percakapan chat antara Pasien dan Dokter (hanya untuk dilihat).</p>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <template x-if="consultations.length === 0"><p class="p-8 text-center text-gray-400 text-sm">Belum ada percakapan</p></template>
          <template x-if="consultations.length > 0">
            <div class="divide-y divide-gray-50">
              <template x-for="c in consultations" :key="c.id">
                <a :href="'#/admin/consultations/' + c.id" class="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                  <div>
                    <p class="font-medium text-gray-800 text-sm" x-text="c.patient_name + ' ↔ ' + c.doctor_name"></p>
                    <p class="text-xs text-gray-500 mt-0.5" x-text="(c.last_message || 'Belum ada pesan').slice(0, 80)"></p>
                  </div>
                  <div class="text-right shrink-0 ml-3">
                    <p class="text-xs text-gray-400" x-text="c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '-'"></p>
                    <p class="text-xs text-gray-400 mt-0.5" x-text="c.message_count + ' pesan'"></p>
                  </div>
                </a>
              </template>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminConsultationDetail(params) {
  const consultations = store.getAllConsultations();
  const c = consultations.find(x => x.id === params.id);
  if (!c) return '<div class="min-h-screen flex items-center justify-center text-gray-400">Percakapan tidak ditemukan</div>';
  const messages = store.getMessages(c.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${adminSidebar('consultations')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-2xl mx-auto">
        <a href="#/admin/consultations" class="inline-flex items-center gap-2 text-sm text-gray-500 mb-4 hover:text-gray-700"><span class="ms text-[18px]">arrow_back</span>Kembali ke Riwayat Konsultasi</a>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-4">
          <p class="font-bold text-gray-800">${c.patient_name} &harr; ${c.doctor_name}</p>
          <p class="text-xs text-gray-500 mt-1">${messages.length} pesan · dibaca-saja (read-only), SuperAdmin bukan bagian dari percakapan ini</p>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 space-y-2.5">
          ${messages.length === 0 ? '<p class="text-center text-sm text-gray-400 py-8">Belum ada pesan</p>' : messages.map(m => `
          <div class="flex ${m.sender_role === 'doctor' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[75%]">
              <p class="text-[10.5px] text-gray-400 mb-0.5 ${m.sender_role === 'doctor' ? 'text-right' : ''}">${m.sender_role === 'doctor' ? c.doctor_name : c.patient_name} &middot; ${new Date(m.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
              <div class="px-3.5 py-2.5 rounded-2xl text-sm ${m.sender_role === 'doctor' ? 'bg-gradient-to-br from-[#2b7ee0] to-brand-dark text-white rounded-br-md' : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md'}">
                <p class="whitespace-pre-wrap break-words">${m.message.replace(/</g, '&lt;')}</p>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </main>
    </div>
  </div>`;
}

export function adminCalendar(params) {
  const today = new Date();
  const todayStr = todayLocal();
  const doctors = store.getDoctors();
  window.__adminCalendarDoctors = doctors.map(d => ({ id: d.id, full_name: d.full_name }));

  const year = params?.year ? parseInt(params.year, 10) : today.getFullYear();
  const month = params?.month ? parseInt(params.month, 10) - 1 : today.getMonth();
  const viewDate = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const prevMonthDate = new Date(year, month - 1, 1);
  const nextMonthDate = new Date(year, month + 1, 1);
  const prevHref = `/admin/calendar/${prevMonthDate.getFullYear()}/${prevMonthDate.getMonth() + 1}`;
  const nextHref = `/admin/calendar/${nextMonthDate.getFullYear()}/${nextMonthDate.getMonth() + 1}`;

  const calendarDays = [];
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const apptsData = store.getAllAppointments().map(a => {
    const p = store.getPatient(a.patient_id);
    const doc = store.getDoctor(a.doctor_id);
    const name = p?.full_name || a.patient_name || 'N/A';
    const confirmUrl = window.location.origin + '/#/konfirmasi/' + a.id;
    const _m = waKontrolMsg(name, formatDate(a.date) + (a.time_slot ? ' jam ' + a.time_slot : ''), a.notes, confirmUrl);
    return { ...a, patient_name: name, doctor_name: doc?.full_name || '-', wa: waHref(p?.phone, _m), wa_msg: waMsgB64(_m) };
  });
  window.__adminCalendarAppts = apptsData;

  const recordsData = store.getAllRecords().filter(r => r.follow_up_date).map(r => {
    const p = store.getPatient(r.patient_id);
    const doc = store.getDoctor(r.doctor_id);
    const name = p?.full_name || 'N/A';
    const _m = waKontrolMsg(name, formatDate(r.follow_up_date), r.follow_up_notes);
    return { id: r.id, patient_id: r.patient_id, patient_name: name, doctor_name: doc?.full_name || '-', follow_up_date: r.follow_up_date, follow_up_notes: r.follow_up_notes, diagnosis: r.diagnosis, wa_reminder_count: r.wa_reminder_count || 0, wa: waHref(p?.phone, _m), wa_msg: waMsgB64(_m) };
  });
  window.__adminCalendarFollowUps = recordsData;

  const visitsData = store.getAllRecords().map(r => {
    const p = store.getPatient(r.patient_id);
    const doc = store.getDoctor(r.doctor_id);
    return { id: r.id, patient_id: r.patient_id, patient_name: p?.full_name || 'N/A', doctor_name: doc?.full_name || '-', visit_date: r.visit_date, diagnosis: r.diagnosis, visit_type: r.visit_type };
  });
  window.__adminCalendarVisits = visitsData;

  // Tugas pribadi pemilik akun yang sedang login — tidak ikut tersaring oleh
  // filter dokter, karena ini kalender pribadi, bukan jadwal klinik.
  const calUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  calendarTasksSetup(calUser && calUser.id);

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    doctorFilter: '',
    selectedDate: '${isCurrentMonth ? todayStr : `${year}-${String(month + 1).padStart(2, '0')}-01`}',
    doctors: window.__adminCalendarDoctors || [],
    allAppts: window.__adminCalendarAppts || [],
    allFollowUps: window.__adminCalendarFollowUps || [],
    allVisits: window.__adminCalendarVisits || [],
    ${calendarTasksXData()},
    get filteredAppts() { return this.doctorFilter ? this.allAppts.filter(a => a.doctor_id === this.doctorFilter) : this.allAppts; },
    get filteredFollowUps() { return this.doctorFilter ? this.allFollowUps.filter(f => f.doctor_id === this.doctorFilter) : this.allFollowUps; },
    get filteredVisits() { return this.doctorFilter ? this.allVisits.filter(v => v.doctor_id === this.doctorFilter) : this.allVisits; },
    get selectedAppts() { return this.filteredAppts.filter(a => a.date === this.selectedDate).sort((a,b) => (a.time_slot||'').localeCompare(b.time_slot||'')); },
    get selectedFollowUps() { return this.filteredFollowUps.filter(f => f.follow_up_date === this.selectedDate); },
    get selectedVisits() { return this.filteredVisits.filter(v => v.visit_date === this.selectedDate); },
    get selectedDateFormatted() { const d = new Date(this.selectedDate); return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}); },
    typeIcons: { visit:'🏥', vaccination:'💉', follow_up:'🔄', telemedicine:'📹' },
    statusLabels: { waiting:'Menunggu', completed:'Selesai', scheduled:'Terjadwal' },
    statusColors: { waiting:'bg-amber-100 text-amber-700', completed:'bg-green-100 text-green-700', scheduled:'bg-blue-100 text-blue-700' }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('calendar')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Kalender Klinik</h2>
          <select x-model="doctorFilter" class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50">
            <option value="">Semua Dokter</option>
            <template x-for="d in doctors" :key="d.id"><option :value="d.id" x-text="d.full_name"></option></template>
          </select>
        </div>
        <div class="grid lg:grid-cols-5 gap-6">
          <div class="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-4">
            <div class="flex items-center justify-between mb-4">
              <a href="#${prevHref}" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></a>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-800">${monthName}</h3>
                ${!isCurrentMonth ? `<a href="#/admin/calendar" class="text-xs text-teal-600 hover:text-teal-700 font-medium">Hari Ini</a>` : ''}
              </div>
              <a href="#${nextHref}" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs">
              ${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>`<div class="font-semibold text-gray-500 py-2">${d}</div>`).join('')}
              ${calendarDays.map(d => {
                if (!d) return '<div></div>';
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isToday = isCurrentMonth && d === today.getDate();
                return `<button @click="selectedDate='${dateStr}'" :class="selectedDate==='${dateStr}' && !${isToday} ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-400' : ''" class="relative py-2.5 rounded-lg transition hover:bg-teal-50 cursor-pointer ${isToday ? 'bg-teal-600 text-white hover:bg-teal-700 font-bold' : ''}">
                  <span>${d}</span>
                  <template x-if="filteredAppts.filter(a => a.date === '${dateStr}').length > 0 || filteredFollowUps.filter(f => f.follow_up_date === '${dateStr}').length > 0 || filteredVisits.filter(v => v.visit_date === '${dateStr}').length > 0 || taskCountOn('${dateStr}') > 0">
                    <span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      <template x-for="i in Math.min(filteredVisits.filter(v => v.visit_date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-green-500'}"></span></template>
                      <template x-for="i in Math.min(filteredAppts.filter(a => a.date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-teal-500'}"></span></template>
                      <template x-for="i in Math.min(filteredFollowUps.filter(f => f.follow_up_date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-orange-500'}"></span></template>
                      <template x-if="taskCountOn('${dateStr}') > 0"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-500'}"></span></template>
                    </span>
                  </template>
                </button>`;
              }).join('')}
            </div>
            <div class="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span>Riwayat Pelayanan</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-teal-500"></span>Janji Temu</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-orange-500"></span>Follow Up Pasien</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-indigo-500"></span>Tugas Saya</span>
            </div>
          </div>
          <div class="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-4">
            <h3 class="font-semibold text-gray-800 mb-1">Jadwal</h3>
            <p class="text-xs text-gray-500 mb-4" x-text="selectedDateFormatted"></p>
            <div class="space-y-2">
              <template x-if="selectedAppts.length === 0 && selectedFollowUps.length === 0 && selectedVisits.length === 0 && selectedTasks.length === 0"><p class="text-gray-400 text-sm text-center py-8">Tidak ada jadwal atau tugas di tanggal ini</p></template>
              <template x-if="selectedVisits.length > 0"><p class="text-xs font-semibold text-green-600 uppercase">Riwayat Pelayanan</p></template>
              <template x-for="v in selectedVisits" :key="v.id">
                <div class="p-3 rounded-lg bg-green-50/50 border border-green-100">
                  <div class="flex items-center gap-3">
                    <span class="text-lg">🩺</span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800" x-text="v.patient_name"></p>
                      <p class="text-xs text-gray-500" x-text="v.doctor_name + ' · ' + (v.diagnosis || v.visit_type || '-')"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Selesai</span>
                  </div>
                </div>
              </template>
              <template x-if="selectedAppts.length > 0"><p class="text-xs font-semibold text-teal-600 uppercase pt-2" x-show="selectedVisits.length > 0">Janji Temu</p></template>
              <template x-for="apt in selectedAppts" :key="apt.id">
                <div class="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div class="flex items-center gap-3">
                    <span class="text-lg" x-text="typeIcons[apt.type] || '📋'"></span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800"><span x-text="apt.time_slot"></span> — <span x-text="apt.patient_name"></span></p>
                      <p class="text-xs text-gray-500" x-text="apt.doctor_name + (apt.notes ? ' · ' + apt.notes : '')"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusColors[apt.status] || 'bg-gray-100 text-gray-600'" x-text="statusLabels[apt.status] || apt.status"></span>
                  </div>
                  <div class="mt-1.5">
                    <span x-show="apt.patient_response==='confirmed'" x-cloak class="text-[11px] font-medium text-green-600">🟢 Hadir dikonfirmasi pasien</span>
                    <span x-show="apt.patient_response==='reschedule'" x-cloak class="text-[11px] font-medium text-amber-600" x-text="'🟡 Pasien minta ganti hari'+(apt.proposed_date ? ': '+new Date(apt.proposed_date).toLocaleDateString('id-ID',{day:'numeric',month:'short'})+(apt.proposed_time ? ' '+apt.proposed_time : '') : '')"></span>
                    <span x-show="!apt.patient_response" class="text-[11px] text-gray-400">⚪ Belum dikonfirmasi</span>
                    <button x-show="apt.patient_response==='reschedule' && apt.proposed_date" x-cloak @click="if(confirm('Geser jadwal '+apt.patient_name+' ke '+new Date(apt.proposed_date).toLocaleDateString('id-ID')+(apt.proposed_time?' '+apt.proposed_time:'')+'?')){ window.__store.approveReschedule(apt.id); window.__showToast&&window.__showToast('Jadwal digeser', apt.patient_name+' → '+new Date(apt.proposed_date).toLocaleDateString('id-ID')); apt.date=apt.proposed_date; apt.time_slot=apt.proposed_time||apt.time_slot; apt.patient_response='confirmed'; apt.proposed_date=null; apt.proposed_time=null }" class="ml-2 px-2 py-0.5 rounded text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition">✔ Setujui & geser</button>
                  </div>
                  <div class="mt-2 flex items-center gap-2 flex-wrap" x-show="apt.wa"><a :href="apt.wa" target="_blank" rel="noopener" @click="window.__logWaReminder('appointments', apt.id); apt.wa_reminder_count=(apt.wa_reminder_count||0)+1" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2zm0 18.1a8.2 8.2 0 01-4.2-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.1zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2-1.4-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4 0-.7.3-.2.2-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>Ingatkan via WA</a><button x-show="!apt.wa && apt.patient_id" @click.stop="window.__waAddPhone(apt.patient_id, apt.wa_msg, 'appointments', apt.id)" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366]/70 hover:bg-[#25D366] transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2z"/></svg>Isi No. HP &amp; WA</button><span x-show="apt.wa_reminder_count" x-cloak class="text-[11px] text-gray-400" x-text="'📤 '+apt.wa_reminder_count+'x'"></span></div>
                </div>
              </template>
              <template x-if="selectedFollowUps.length > 0"><p class="text-xs font-semibold text-orange-600 uppercase pt-2" x-show="selectedAppts.length > 0 || selectedVisits.length > 0">Follow Up Pasien</p></template>
              <template x-for="f in selectedFollowUps" :key="f.id">
                <div class="p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                  <div class="flex items-center gap-3">
                    <span class="text-lg">🔄</span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800" x-text="f.patient_name"></p>
                      <p class="text-xs text-gray-500" x-text="f.doctor_name + ' · ' + (f.follow_up_notes || f.diagnosis || 'Kontrol ulang')"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Follow Up</span>
                  </div>
                  <div class="mt-2 flex items-center gap-2 flex-wrap" x-show="f.wa"><a :href="f.wa" target="_blank" rel="noopener" @click="window.__logWaReminder('medical_records', f.id); f.wa_reminder_count=(f.wa_reminder_count||0)+1" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2zm0 18.1a8.2 8.2 0 01-4.2-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.1zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2-1.4-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4 0-.7.3-.2.2-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>Ingatkan via WA</a><button x-show="!f.wa && f.patient_id" @click.stop="window.__waAddPhone(f.patient_id, f.wa_msg, 'medical_records', f.id)" class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white bg-[#25D366]/70 hover:bg-[#25D366] transition"><svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2z"/></svg>Isi No. HP &amp; WA</button><span x-show="f.wa_reminder_count" x-cloak class="text-[11px] text-gray-400" x-text="'📤 '+f.wa_reminder_count+'x'"></span></div>
                </div>
              </template>
              ${calendarTasksBlock('selectedAppts.length > 0 || selectedVisits.length > 0 || selectedFollowUps.length > 0')}
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminHomeCareNew() {
  return homeCareNewPage({
    role: 'superadmin',
    sidebar: adminSidebar('homecare'),
    header: adminHeader(),
    doctors: store.getDoctors(),
    patients: store.getPatients(),
    historyPath: '/admin/homecare/history',
  });
}

export function adminHomeCareHistory() {
  const claims = store.getHomeCareClaims().map(c => ({ ...c, doctor_name: store.getDoctor(c.doctor_id)?.full_name || '-' }));
  const claimItemsMap = {};
  claims.forEach(c => { claimItemsMap[c.id] = store.getHomeCareClaimItems(c.id); });
  return homeCareHistoryPage({
    role: 'superadmin',
    sidebar: adminSidebar('homecare'),
    header: adminHeader(),
    claims, claimItemsMap,
    doctors: store.getDoctors(),
    newPath: '/admin/homecare/new',
    editPath: '/admin/homecare/edit',
  });
}

export function adminHomeCareEdit(params) {
  const claim = store.getHomeCareClaim(params.claimId);
  if (!claim) return '<div class="p-8 text-center text-gray-500">Klaim tidak ditemukan</div>';
  return homeCareNewPage({
    role: 'superadmin',
    sidebar: adminSidebar('homecare'),
    header: adminHeader(),
    doctors: store.getDoctors(),
    patients: store.getPatients(),
    historyPath: '/admin/homecare/history',
    claimId: claim.id,
    existingClaim: claim,
    existingItems: store.getHomeCareClaimItems(claim.id),
  });
}

// Admin-side clinical patient list — read-only view of medical records plus
// the ability to issue a Surat Keterangan on a doctor's behalf.
export function adminPatients() {
  const patients = store.getPatients();
  const q = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
  // Editable snapshot keyed by id — the modal looks patients up by id (safe:
  // no free-text embedded in attributes), same pattern as the doctor panel.
  window.__patientsForEdit = patients.map(p => ({ id: p.id, full_name: p.full_name || '', nik: p.nik || '', birth_date: p.birth_date || '', gender: p.gender || '', phone: p.phone || '', address: p.address || '', blood_type: p.blood_type || '', allergies: p.allergies || '', family_name: p.family_name || '', family_phone: p.family_phone || '', family_relation: p.family_relation || '' }));
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '',
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
      setTimeout(function(){ window.__rerender && window.__rerender() }, 150);
    }
  }" class="min-h-screen bg-wash">
    ${adminSidebar('patients')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Rekam Medis Pasien</h2>
          <div class="relative flex-1 sm:max-w-xs"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari nama, NIK, No. RM..."></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto"><table class="w-full">
            <thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">No. RM</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">NIK</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Telepon</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th></tr></thead>
            <tbody class="divide-y divide-gray-50">
              ${patients.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 text-sm">Belum ada pasien</td></tr>' : patients.map(p => `
              <template x-if="!search || window.__store.patientMatches(window.__store.getPatient('${p.id}'), search)">
                <tr class="hover:bg-gray-50 transition">
                  <td class="px-4 py-3"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(p.full_name||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}</div><p class="font-medium text-gray-800 text-sm">${p.full_name||'-'}</p></div></td>
                  <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${p.rm_number || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">${p.nik || '-'}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">${p.phone || '-'}</td>
                  <td class="px-4 py-3"><div class="flex gap-1 items-center flex-wrap"><a href="#/admin/patients/${p.id}" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">Lihat Rekam Medis</a><button @click="startEdit('${p.id}')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Edit</button>${waButton(p.phone, waSapaMsg(p.full_name), 'WA', { patientId: p.id })}</div></td>
                </tr>
              </template>`).join('')}
            </tbody>
          </table></div>
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

export function adminPatientDetail(params) {
  const patient = store.getPatient(params.patientId);
  if (!patient) return '<div class="p-8 text-center text-gray-500">Pasien tidak ditemukan</div>';
  const records = store.getRecords(params.patientId);
  const vaccinations = store.getVaccinations(params.patientId);
  const doctors = (store.data.doctors || []).filter(d => d.full_name);
  window.__skdDoctors = doctors.map(d => ({ id: d.id, full_name: d.full_name, sip_number: d.sip_number || '' }));
  const q = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
  const latestVs = (records[0] && records[0].vital_signs) || {};
  const age = patient.birth_date ? Math.floor((Date.now() - new Date(patient.birth_date)) / (365.25*24*60*60*1000)) : null;
  const adminId = (JSON.parse(sessionStorage.getItem('medconnect_user') || 'null') || {}).id || '';
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024,
    skdOpen: false, skdType: 'sehat', skdDoctorId: '${doctors[0]?.id || ''}',
    skdList: [], skdLoading: true,
    skd: { letter_date: '${new Date().toISOString().split('T')[0]}',
      birth_date: '${patient.birth_date || ''}', gender: '${q(patient.gender||'')}', address: '${q(patient.address||'')}',
      berat_badan: '${q(latestVs.bb||'')}', tinggi_badan: '${q(latestVs.tb||'')}', tekanan_darah: '${q(latestVs.td||'')}', nadi: '${q(latestVs.nadi||'')}',
      keperluan: '', kesimpulan: 'SEHAT FISIK DAN MENTAL',
      diagnosis: '${q(records[0] && records[0].diagnosis || '')}', rest_days: '', from_date: '${new Date().toISOString().split('T')[0]}', to_date: '' },
    vaxOpen: false, vaxSaving: false, vaxMsg: '', vaxDoctorId: '${doctors[0]?.id || ''}',
    vax: { vaccine_name:'', vaccine_brand:'', vax_mode:'series', dose_number:1, total_doses:1, booster_interval_months:12, date_given:'${new Date().toISOString().split('T')[0]}', next_dose_date:'', batch_number:'', location:'${q(store.getLocationNames()[0] || '')}', notes:'', off_schedule_note:'' },
    // Pemeriksa ini hanya MEMBERI TAHU. Penegakannya ada di createVaccination,
    // yang dilewati semua jalur pencatatan — kalau ditaruh di sini saja,
    // formulir berikutnya yang dibuat orang lain akan lupa memanggilnya.
    vaxCek: { luarJadwal:false, dikenali:true, alasan:[] },
    periksaVax() {
      try {
        this.vaxCek = window.__store.vaxDoseCheck({
          patient_id: '${patient.id}', vaccine_name: this.vax.vaccine_name,
          vaccine_brand: this.vax.vaccine_brand, date_given: this.vax.date_given,
        });
      } catch(e) { this.vaxCek = { luarJadwal:false, dikenali:true, alasan:[] }; }
    },
    openVax() { this.vaxMsg = ''; this.vaxCek = { luarJadwal:false, dikenali:true, alasan:[] }; this.vaxOpen = true; },
    async submitVax() {
      if (this.vaxSaving) return;
      if (!this.vaxDoctorId) { this.vaxMsg = 'Pilih dokter penanggung jawab (yang meng-ACC) terlebih dahulu.'; return; }
      if (!(this.vax.vaccine_name || '').trim()) { this.vaxMsg = 'Nama vaksin wajib diisi.'; return; }
      if (!this.vax.date_given) { this.vaxMsg = 'Tanggal pemberian wajib diisi.'; return; }
      this.vaxSaving = true; this.vaxMsg = '';
      const r = await window.__store.addVaccinationByAdmin({
        patient_id: '${patient.id}', created_by: '${adminId}', approval_doctor_id: this.vaxDoctorId, ...this.vax,
      });
      this.vaxSaving = false;
      if (r && r.error) { this.vaxMsg = r.error; return; }
      this.vaxOpen = false;
      const dn = (window.__skdDoctors || []).find(d => d.id === this.vaxDoctorId);
      window.__showToast && window.__showToast('Terkirim untuk ACC', 'Catatan vaksinasi tersimpan di rekam medis dan menunggu persetujuan ' + ((dn && dn.full_name) || 'dokter') + '.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 300);
    },
    // Surat sakit bertanggal sesuai hari pertama sakitnya, bukan hari
    // pencetakannya — lihat js/skd.js. Disetel di sini juga supaya yang
    // terlihat di layar sama dengan yang nanti tercetak.
    syncSuratDate() { if (this.skdType !== 'sehat' && this.skd.from_date) this.skd.letter_date = this.skd.from_date; },
    skdStatus(s) { return (s.details && s.details.approval && s.details.approval.status) || 'approved'; },
    async loadSKD() { try { this.skdList = await window.__store.getSKDForPatient('${patient.id}'); } catch(e) { this.skdList = []; } this.skdLoading = false; },
    reprintSKD(id) { window.__printSKD(id); },
    async submitSKD() {
      const doc = (window.__skdDoctors||[]).find(d => d.id === this.skdDoctorId);
      if (!doc) { alert('Pilih dokter yang meng-ACC surat ini terlebih dahulu.'); return; }
      window.__store.updatePatientProfile('${patient.id}', { birth_date: this.skd.birth_date, gender: this.skd.gender, address: this.skd.address });
      // Admin-drafted → pending; the chosen doctor must ACC before it's valid.
      const cert = await window.__issueSKD({ patientId: '${patient.id}', type: this.skdType, status: 'pending', approvalDoctorId: doc.id, createdBy: '${adminId}', doctor: { full_name: doc.full_name, sip_number: doc.sip_number }, ...this.skd });
      this.skdOpen = false;
      if (cert) this.skdList.unshift(cert);
      alert('Draft surat dibuat & dikirim ke ' + doc.full_name + ' untuk persetujuan (ACC).\\n\\nSurat baru SAH setelah dokter menyetujui. Sementara ini yang tercetak adalah draft bertanda air.');
    },
    editOpen: false, savingEdit: false, editMsg: '',
    editPatient: { full_name: '${q(patient.full_name)}', nik: '${q(patient.nik||'')}', birth_date: '${patient.birth_date || ''}', gender: '${q(patient.gender||'')}', phone: '${q(patient.phone||'')}', address: '${q(patient.address||'')}', blood_type: '${q(patient.blood_type||'')}', allergies: '${q(patient.allergies||'')}', family_name: '${q(patient.family_name||'')}', family_phone: '${q(patient.family_phone||'')}', family_relation: '${q(patient.family_relation||'')}' },
    async saveEditPatient() {
      if (!this.editPatient.full_name.trim()) { this.editMsg='Nama lengkap wajib diisi.'; return; }
      this.savingEdit = true;
      const r = await window.__store.updatePatientProfile('${patient.id}', this.editPatient);
      this.savingEdit = false;
      if (r && r.error) { this.editMsg = r.error; return; }
      this.editOpen = false;
      window.__showToast && window.__showToast('Tersimpan', 'Data pasien diperbarui.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 150);
    }
  }" x-init="loadSKD()" class="min-h-screen bg-wash">
    ${adminSidebar('patients')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center gap-2 mb-4 text-sm text-gray-500"><a href="#/admin/patients" class="hover:text-teal-600 transition">Rekam Medis Pasien</a><span>/</span><span class="text-gray-800 font-medium">${patient.full_name}</span></div>
        <div class="bg-white border border-slate-100 rounded-3xl p-4 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">${(patient.full_name||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
            <div>
              <h2 class="text-lg font-bold text-gray-800">${patient.full_name}</h2>
              <p class="text-sm text-gray-500">${patient.gender || '-'}${age !== null ? ', '+age+' thn' : ''} | No. RM: ${patient.rm_number || '-'} | NIK: ${patient.nik || '-'}</p>
              ${patient.family_phone || patient.family_name ? `<p class="text-xs text-violet-700 mt-0.5">Keluarga: ${escHtml(patient.family_name || '-')}${patient.family_relation ? ' (' + escHtml(patient.family_relation) + ')' : ''}${patient.family_phone ? ' — ' + escHtml(patient.family_phone) : ''}</p>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 self-start lg:self-auto">
            ${waButton(patient.phone, waSapaMsg(patient.full_name), 'WhatsApp', { patientId: patient.id })}
            <button @click="editOpen=true; editMsg=''" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Edit Data</button>
            <button @click="skdOpen=true" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Buat Surat Keterangan</button>
          </div>
        </div>

        <!-- Modal Edit Data Pasien -->
        <div x-show="editOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" @click.self="editOpen=false">
          <div class="bg-white rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-800">Edit Data Pasien</h3>
              <button @click="editOpen=false" class="text-gray-400 hover:text-gray-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
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
              <button @click="saveEditPatient()" :disabled="savingEdit" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-text="savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'"></span></button>
              <button @click="editOpen=false" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200">Batal</button>
            </div>
          </div>
        </div>

        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Surat Keterangan (<span x-text="skdList.length"></span>)</h3>
        <div x-show="skdLoading" class="bg-white rounded-3xl border border-slate-100 p-4 text-center text-gray-400 text-sm mb-6">Memuat surat...</div>
        <template x-if="!skdLoading && skdList.length === 0"><div class="bg-white rounded-3xl border border-slate-100 p-4 text-center text-gray-400 text-sm mb-6">Belum ada surat keterangan untuk pasien ini.</div></template>
        <div class="space-y-2 mb-6">
          <template x-for="s in skdList" :key="s.id">
            <div class="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="((s.perihal||'')==='SEHAT')?'bg-teal-100 text-teal-700':'bg-amber-100 text-amber-700'" x-text="'Surat '+((s.perihal||'').charAt(0)+(s.perihal||'').slice(1).toLowerCase())"></span>
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="{ 'bg-green-100 text-green-700': skdStatus(s)==='approved', 'bg-orange-100 text-orange-700': skdStatus(s)==='pending', 'bg-red-100 text-red-700': skdStatus(s)==='rejected' }" x-text="({ approved:'Sah', pending:'Menunggu ACC', rejected:'Ditolak' })[skdStatus(s)]"></span>
                </div>
                <p class="text-sm font-medium text-gray-800 mt-1" x-text="'No. '+s.cert_number"></p>
                <p class="text-xs text-gray-500" x-text="'Dokter: '+(s.doctor_name||'-')"></p>
                <p class="text-xs text-red-500" x-show="skdStatus(s)==='rejected' && s.details && s.details.approval && s.details.approval.reject_reason" x-text="'Alasan: '+(s.details && s.details.approval && s.details.approval.reject_reason)"></p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="window.__editSKD(s.id, () => loadSKD())" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition">Edit</button>
                <button @click="reprintSKD(s.id)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition" x-text="skdStatus(s)==='approved' ? 'Cetak Ulang' : 'Lihat'"></button>
              </div>
            </div>
          </template>
        </div>

        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Riwayat Rekam Medis (${records.length})</h3>
        ${records.length === 0 ? '<div class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Belum ada rekam medis</div>' : records.map(r => {
          const doctor = store.getDoctor(r.doctor_id);
          return `<div class="bg-white border border-slate-100 rounded-3xl mb-3 overflow-hidden" x-data="{open:false}">
            <div class="p-4 cursor-pointer hover:bg-gray-50 transition flex items-center justify-between" @click="open=!open">
              <div><p class="font-medium text-gray-800">${formatDate(r.visit_date)}</p><p class="text-sm text-gray-500">${r.diagnosis || '-'}${doctor ? ' — '+doctor.full_name : ''}</p></div>
              <svg class="w-5 h-5 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div x-show="open" x-cloak class="border-t border-gray-100 p-4 bg-gray-50/50 text-sm space-y-2">
              <div><span class="font-semibold text-gray-700">Anamnesis:</span> <span class="text-gray-600">${r.anamnesis || '-'}</span></div>
              <div><span class="font-semibold text-gray-700">Pemeriksaan Fisik:</span> <span class="text-gray-600 whitespace-pre-line">${r.examination || '-'}</span></div>
              ${r.vital_signs ? `<div class="flex flex-wrap gap-2">${Object.entries(r.vital_signs).filter(([k,v])=>v).map(([k,v])=>`<span class="px-2 py-1 rounded bg-white border border-gray-200 text-xs">${k.toUpperCase()}: ${v}</span>`).join('')}</div>` : ''}
              <div><span class="font-semibold text-gray-700">Terapi:</span> <span class="text-gray-600">${r.therapy || '-'}</span></div>
              ${r.follow_up_date ? `<div><span class="font-semibold text-gray-700">Kontrol:</span> <span class="text-blue-700">${formatDate(r.follow_up_date)}</span></div>` : ''}
            </div>
          </div>`;
        }).join('')}

        <div class="flex items-center justify-between mb-3 mt-6">
          <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">Vaksinasi (${vaccinations.length})</h3>
          <button @click="openVax()" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)">+ Catat Vaksinasi</button>
        </div>
        ${vaccinations.length === 0 ? '<div class="bg-white rounded-3xl border border-slate-100 p-6 text-center text-gray-400 text-sm">Belum ada data vaksinasi</div>' : `<div class="bg-white border border-slate-100 rounded-3xl divide-y divide-gray-50">${vaccinations.map(v => {
          const st = store.vaxApprovalStatus(v);
          const badge = st === 'pending'
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">Menunggu ACC</span>'
            : st === 'rejected'
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Ditolak</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Sah</span>';
          const dr = (store.getDoctor(v.approval_doctor_id || v.administered_by) || {}).full_name || '';
          return `<div class="p-3 flex items-center justify-between text-sm gap-3">
            <div class="min-w-0">
              <p class="font-medium text-gray-800 flex items-center gap-2 flex-wrap">${escHtml(v.vaccine_name)} ${escHtml(v.vaccine_brand || '')} ${badge}</p>
              <p class="text-xs text-gray-500">${v.vax_mode === 'booster' ? 'Booster ke-' + (v.dose_number || 1) : 'Dosis ' + (v.dose_number || '-') + '/' + (v.total_doses || '-')}${v.date_given ? ' — ' + formatDate(v.date_given) : ''}${v.batch_number ? ' | Batch: ' + escHtml(v.batch_number) : ''}${v.location ? ' | ' + escHtml(v.location) : ''}</p>
              ${dr ? `<p class="text-xs text-gray-400">Dokter: ${escHtml(dr)}</p>` : ''}
              ${st === 'rejected' && v.reject_reason ? `<p class="text-xs text-red-600 mt-0.5">Alasan ditolak: ${escHtml(v.reject_reason)}</p>` : ''}
            </div>
          </div>`;
        }).join('')}</div>`}
        ${vaccinations.some(v => store.vaxApprovalStatus(v) !== 'approved') ? `<div class="mt-2 p-3 rounded-xl bg-orange-50 border border-orange-100"><p class="text-xs text-orange-800">Sertifikat vaksin belum bisa dicetak selama masih ada dosis yang menunggu / ditolak ACC dokter.</p></div>` : ''}

        <!-- Modal: admin mencatat vaksinasi (butuh ACC dokter) -->
        <div x-show="vaxOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="vaxOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold text-gray-800">Catat Vaksinasi</h3><button @click="vaxOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <p class="text-xs text-gray-500 mb-4">Pasien: <span class="font-medium text-gray-700">${escHtml(patient.full_name)}</span>. Catatan ini juga otomatis tersimpan sebagai kunjungan di rekam medis.</p>
            <div x-show="vaxMsg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="vaxMsg"></div>
            <div class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <label class="block text-xs font-semibold text-amber-800 mb-1">Dokter penanggung jawab (yang meng-ACC) *</label>
              <select x-model="vaxDoctorId" class="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50">
                ${doctors.length === 0 ? '<option value="">Belum ada dokter terdaftar</option>' : doctors.map(d => `<option value="${d.id}">${escHtml(d.full_name)}</option>`).join('')}
              </select>
              <p class="text-[11px] text-amber-600 mt-1">Catatan ini berstatus menunggu ACC sampai dokter tersebut menyetujuinya. Sertifikat baru bisa dicetak setelah di-ACC.</p>
            </div>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Nama Vaksin *</label><input type="text" x-model="vax.vaccine_name" @change="periksaVax()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Contoh: Meningitis ACYW135"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Merk / Brand</label><input type="text" x-model="vax.vaccine_brand" @change="periksaVax()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Contoh: Menveo"></div>
              </div>
              <div class="flex gap-2">
                <button @click="vax.vax_mode='series'" :class="vax.vax_mode==='series' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition">Seri (berdosis)</button>
                <button @click="vax.vax_mode='booster'" :class="vax.vax_mode==='booster' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition">Booster / ulangan</button>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1" x-text="vax.vax_mode==='booster' ? 'Pemberian ke-' : 'Dosis ke-'"></label><input type="number" min="1" x-model="vax.dose_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                <div x-show="vax.vax_mode==='series'"><label class="block text-xs text-gray-600 mb-1">Total Dosis</label><input type="number" min="1" x-model="vax.total_doses" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                <div x-show="vax.vax_mode==='booster'" x-cloak><label class="block text-xs text-gray-600 mb-1">Interval Ulangan (bulan)</label><input type="number" min="1" x-model="vax.booster_interval_months" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Tanggal Pemberian *</label><input type="date" x-model="vax.date_given" @change="periksaVax()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Jadwal Berikutnya</label><input type="date" x-model="vax.next_dose_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"></div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">No. Batch</label><input type="text" x-model="vax.batch_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Contoh: MNV-2026-A1"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Lokasi</label><select x-model="vax.location" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50">${store.getLocationNames().map(l => `<option>${escHtml(l)}</option>`).join('')}</select></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">Catatan</label><input type="text" x-model="vax.notes" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50" placeholder="Mis. tidak ada KIPI"></div>

              <!-- Peringatan jadwal. Muncul SEBELUM disimpan, saat tanggalnya
                   masih bisa dibetulkan — bukan sesudahnya, saat yang tersisa
                   hanya menyesal. Tidak menghalangi penyimpanan: vaksinnya
                   mungkin memang sudah disuntik, dan riwayat yang bolong lebih
                   berbahaya daripada riwayat yang bertanda. -->
              <div x-show="vaxCek.luarJadwal" x-cloak class="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p class="text-xs font-bold text-amber-900">Dosis ini di luar jadwal IDAI</p>
                <ul class="mt-1 space-y-0.5">
                  <template x-for="a in vaxCek.alasan" :key="a">
                    <li class="text-[11.5px] text-amber-800 leading-relaxed" x-text="a"></li>
                  </template>
                </ul>
                <label class="block text-[11px] text-amber-900 font-semibold mt-2 mb-1">Keterangan dokter (kenapa tetap diberikan)</label>
                <input type="text" x-model="vax.off_schedule_note" class="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50" placeholder="Mis. mengejar keberangkatan, atas pertimbangan dr. ...">
                <p class="mt-1.5 text-[10.5px] text-amber-700">Tetap bisa disimpan. Dosisnya akan ditandai agar dokter meninjau apakah perlu diulang.</p>
              </div>

              <div x-show="!vaxCek.dikenali" x-cloak class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p class="text-[11.5px] text-slate-700 leading-relaxed" x-text="(vaxCek.alasan && vaxCek.alasan[0]) || ''"></p>
                <p class="mt-1 text-[10.5px] text-slate-500">Untuk vaksin di luar jadwal anak (mis. meningitis umroh) ini wajar. Untuk vaksin anak, periksa lagi ejaan namanya.</p>
              </div>
            </div>
            <div class="flex gap-2 justify-end mt-5">
              <button @click="vaxOpen=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="submitVax()" :disabled="vaxSaving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#7c3aed,#5b21b6)"><span x-show="!vaxSaving">Simpan &amp; Kirim untuk ACC</span><span x-show="vaxSaving" x-cloak>Menyimpan...</span></button>
            </div>
          </div>
        </div>

        <!-- SKD modal (admin, dengan pilih dokter ACC) -->
        <div x-show="skdOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="skdOpen=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold text-gray-800">Terbitkan Surat Keterangan</h3><button @click="skdOpen=false" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button></div>
            <p class="text-xs text-gray-500 mb-4">Pasien: <span class="font-medium text-gray-700">${patient.full_name}</span>. Data terisi otomatis dari kunjungan terakhir — periksa & edit sebelum cetak.</p>
            <div class="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <label class="block text-xs font-semibold text-amber-800 mb-1">Dokter yang meng-ACC / tanda tangan *</label>
              <select x-model="skdDoctorId" class="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50">
                ${doctors.length === 0 ? '<option value="">Belum ada dokter terdaftar</option>' : doctors.map(d => `<option value="${d.id}">${d.full_name}${d.sip_number ? ' — SIP '+d.sip_number : ' — (SIP belum diisi)'}</option>`).join('')}
              </select>
              <p class="text-[11px] text-amber-600 mt-1">Nama & SIP dokter ini yang akan tercetak di surat.</p>
            </div>
            <div class="flex gap-2 mb-4">
              <button @click="skdType='sehat'" :class="skdType==='sehat' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition">Surat Keterangan Sehat</button>
              <button @click="skdType='sakit'; syncSuratDate()" :class="skdType==='sakit' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'" class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition">Surat Keterangan Sakit</button>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div><label class="block text-xs text-gray-600 mb-1">No. RM <span class="text-gray-400">(otomatis)</span></label><input type="text" readonly value="${patient.rm_number || 'dibuat saat terbit'}" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"></div>
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
            <div x-show="skdType==='sehat'" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Berat Badan (KG)</label><input type="text" x-model="skd.berat_badan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Tinggi Badan (CM)</label><input type="text" x-model="skd.tinggi_badan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Tekanan Darah (MMHG)</label><input type="text" x-model="skd.tekanan_darah" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="120/80"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Nadi (X/MIN)</label><input type="text" x-model="skd.nadi" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">Dipergunakan untuk</label><input type="text" x-model="skd.keperluan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Melamar pekerjaan"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Kesimpulan</label><input type="text" x-model="skd.kesimpulan" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            </div>
            <div x-show="skdType==='sakit'" x-cloak class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Diagnosis</label><input type="text" x-model="skd.diagnosis" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="cth: Febris"></div>
              <div class="grid grid-cols-3 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">Istirahat (hari)</label><input type="number" min="1" x-model="skd.rest_days" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Dari Tanggal</label><input type="date" x-model="skd.from_date" @change="syncSuratDate()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div><p class="text-[11px] text-teal-700 mt-1 sm:col-span-3" x-show="skdType==='sakit' && skd.from_date" x-cloak>Tanggal surat mengikuti hari pertama sakit (<span x-text="skd.from_date"></span>) &mdash; supaya tanggal suratnya tidak jatuh sesudah izin yang diterangkannya.</p>
                <div><label class="block text-xs text-gray-600 mb-1">Hingga Tanggal</label><input type="date" x-model="skd.to_date" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
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

export function adminBugs() {
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, loading: true, reports: [], filter: 'open',
    async load() { this.loading = true; try { this.reports = await window.__store.getBugReports(); } catch(e) { this.reports = []; } this.loading = false; },
    get shown() { return this.filter === 'all' ? this.reports : this.reports.filter(r => (r.status||'open') === this.filter); },
    async setStatus(id, s) { await window.__store.setBugReportStatus(id, s); const r = this.reports.find(x=>x.id===id); if(r) r.status = s; },
    fmt(d) { if(!d) return '-'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleString('id-ID', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
  }" x-init="load()" class="min-h-screen bg-wash">
    ${adminSidebar('bugs')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-4xl mx-auto">
        <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h2 class="text-xl font-bold text-gray-800">Laporan Bug</h2>
          <div class="flex items-center gap-2">
            <button @click="load()" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition">Muat ulang</button>
            <div class="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
              <button @click="filter='open'" :class="filter==='open'?'bg-blue-600 text-white':'text-gray-600'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">Belum selesai</button>
              <button @click="filter='resolved'" :class="filter==='resolved'?'bg-green-600 text-white':'text-gray-600'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">Selesai</button>
              <button @click="filter='all'" :class="filter==='all'?'bg-gray-700 text-white':'text-gray-600'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">Semua</button>
            </div>
          </div>
        </div>
        <div x-show="loading" class="text-center py-10 text-gray-400 text-sm">Memuat laporan...</div>
        <template x-if="!loading && shown.length === 0">
          <div class="bg-white rounded-3xl border border-slate-100 p-10 text-center text-gray-400 text-sm">Tidak ada laporan pada filter ini.</div>
        </template>
        <div class="space-y-3">
          <template x-for="r in shown" :key="r.id">
            <div class="bg-white border border-slate-100 rounded-2xl p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="(r.status||'open')==='resolved'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'" x-text="(r.status||'open')==='resolved'?'Selesai':'Belum selesai'"></span>
                    <span class="text-xs text-gray-400" x-text="fmt(r.created_at)"></span>
                  </div>
                  <p class="text-sm text-gray-800 whitespace-pre-line" x-text="r.description"></p>
                  <div class="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span x-show="r.page">📍 <span x-text="r.page"></span></span>
                    <span x-show="r.reporter_email">👤 <span x-text="r.reporter_email + (r.reporter_role ? ' ('+r.reporter_role+')' : '')"></span></span>
                  </div>
                </div>
                <div class="flex-shrink-0">
                  <button x-show="(r.status||'open')!=='resolved'" @click="setStatus(r.id,'resolved')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition whitespace-nowrap">Tandai selesai</button>
                  <button x-show="(r.status||'open')==='resolved'" @click="setStatus(r.id,'open')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition whitespace-nowrap">Buka lagi</button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminCrm() {
  crmSetup();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${crmXData()} }" x-init="load()" class="min-h-screen bg-wash">
    ${adminSidebar('crm')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        ${crmBody()}
      </main>
    </div>
  </div>`;
}

export function adminStock() {
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${stockXData()} }" x-init="loadList()" class="min-h-screen bg-wash">
    ${adminSidebar('stock')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        ${stockBody()}
      </main>
    </div>
  </div>`;
}

// Kartu vaksin anak — jadwal IDAI yang dihitung, daftar anak yang lewat waktu,
// rujukan ke puskesmas saat stok kosong, dan pencatatan dosis dari luar.
export function adminVaksin() {
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${vaxAnakXData('admin')} }" class="min-h-screen bg-wash">
    ${adminSidebar('vaksin')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <h2 class="text-2xl font-bold text-ink mb-1">Vaksin Anak</h2>
        <p class="text-[12.5px] text-muted mb-5">Jadwal dihitung dari tanggal lahir dan dosis terakhir, jadi penundaan satu dosis otomatis menggeser sisanya.</p>
        ${vaxAnakBody()}
      </main>
    </div>
  </div>`;
}

// Tabel jadwal IDAI: dicocokkan dan diverifikasi dokter sebelum dipakai.
export function adminVaxSchedule() {
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${vaxScheduleXData()} }" class="min-h-screen bg-wash">
    ${adminSidebar('vaksin-jadwal')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <h2 class="text-2xl font-bold text-ink mb-1">Jadwal Vaksin IDAI</h2>
        <p class="text-[12.5px] text-muted mb-5">Usia minimum dan jarak minimum tiap dosis. Angka di sinilah yang menentukan tanggal pada kartu vaksin setiap anak.</p>
        ${vaxScheduleBody()}
      </main>
    </div>
  </div>`;
}

// To-Do / Daftar Tugas — rencana & jadwal kegiatan Super Admin/Owner, dengan
// delegasi ke staf. Isi halamannya ada di js/pages/tasks.js (dipakai juga oleh
// halaman "Tugas Saya" #/tugas milik staf penerima).
export function adminTasks() {
  tasksSetup();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${tasksXData('all')} }" x-init="load()" class="min-h-screen bg-wash">
    ${adminSidebar('tasks')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-[1500px] mx-auto">
        ${tasksBody('all')}
      </main>
    </div>
  </div>`;
}

// Umroh & Haji — laporan jemaah hasil unggahan berkas penjualan dari kasir
// apotek, beserta travel pengirimnya dan cashback-nya. Isi halamannya ada di
// js/pages/umroh.js.
export function adminUmroh() {
  umrohSetup();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, ${umrohXData()} }" x-init="load()" class="min-h-screen bg-wash">
    ${adminSidebar('umroh')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-[1500px] mx-auto">
        ${umrohBody()}
      </main>
    </div>
  </div>`;
}

// Bungkus sebuah nilai jadi literal string JS bertanda kutip TUNGGAL yang aman
// dipakai di dalam atribut HTML bertanda kutip ganda (mis. onclick="..."):
// kutip ganda pada datanya diubah jadi entity, jadi atributnya tidak terpotong.
function jsStr(s) {
  return "'" + String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;') + "'";
}

// Master data Lokasi / Tempat Praktik. Nama tempat di sini yang muncul di
// dropdown "Lokasi / Tempat" pada rekam medis & vaksinasi, dan yang tercetak
// sebagai "Tempat Praktik" di kertas resep (alamatnya ikut ke kop surat).
// ===========================================================================
// PENGINGAT: KONTROL ULANG & DOSIS VAKSIN BERIKUTNYA.
//
// Tanggalnya sudah lama dicatat di rekam medis dan catatan vaksinasi, tapi
// tidak ada layar yang menjawab pertanyaan yang sebenarnya: siapa yang jatuh
// tempo minggu ini. Jadi tanggal itu cuma tersimpan, dan pasien yang tidak
// kembali tidak pernah ketahuan tidak kembali.
//
// YANG SUDAH LEWAT DITARUH PALING ATAS, bukan dibuang. Justru itulah yang
// paling perlu dikejar — daftar yang hanya menampilkan "akan datang" diam-diam
// memaafkan semua yang telanjur terlewat.
// ===========================================================================
export function adminReminders() {
  const hariIni = todayLocal();
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    dari: '', sampai: '', jenis: '', dokter: '',
    daftar: [], hitung: { total: 0, lewat: 0, hariIni: 0, akan: 0 },
    hariIni: '${hariIni}',
    dokters: window.__store.getDoctors().map(d => ({ id: d.id, name: d.full_name || 'Dokter' })),
    muat() {
      const o = { kind: this.jenis, doctorId: this.dokter };
      if (this.dari) o.fromDate = this.dari;
      if (this.sampai) o.toDate = this.sampai;
      this.daftar = window.__store.dueReminders(o);
      this.hitung = window.__store.dueReminderCounts(o, this.daftar);
    },
    reset() { this.dari = ''; this.sampai = ''; this.jenis = ''; this.dokter = ''; this.muat(); },
    statusTeks(x) {
      if (x.due < this.hariIni) return 'Terlewat ' + x.days + ' hari';
      if (x.due === this.hariIni) return 'Jatuh tempo hari ini';
      return 'Dalam ' + Math.abs(x.days) + ' hari';
    },
    statusWarna(x) {
      if (x.due < this.hariIni) return 'bg-red-100 text-red-700';
      if (x.due === this.hariIni) return 'bg-amber-100 text-amber-800';
      return 'bg-slate-100 text-slate-600';
    },
    pesan(x, keKeluarga) {
      return window.__waPesanPengingat({
        kind: x.kind, patientName: x.patient_name, title: x.title, detail: x.detail,
        due: x.due, days: x.days, dueIsPast: x.due < this.hariIni,
        doctorName: x.doctor_name, toFamily: !!keKeluarga,
      });
    },
    tautan(x, keKeluarga) {
      const nomor = keKeluarga ? x.family_phone : x.phone;
      return nomor ? window.__waHref(nomor, this.pesan(x, keKeluarga)) : '';
    },
    async tandai(x) {
      await window.__store.markReminderSent(x.kind, x.id);
      this.muat();
    }
  }" x-init="muat()" class="min-h-screen bg-wash">
    ${adminSidebar('reminders')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-1">Pengingat Kontrol &amp; Vaksin</h2>
        <p class="text-sm text-gray-500 mb-5">Pasien yang jadwal <b>kontrol ulang</b> atau <b>dosis vaksin berikutnya</b> sudah dekat &mdash; atau sudah terlewat. Bawaannya menampilkan 60 hari ke belakang sampai 14 hari ke depan.</p>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <div class="bg-white rounded-2xl border border-slate-100 p-3">
            <p class="text-2xl font-bold text-red-600" x-text="hitung.lewat"></p>
            <p class="text-[11px] text-slate-500 font-semibold">Sudah terlewat</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-100 p-3">
            <p class="text-2xl font-bold text-amber-600" x-text="hitung.hariIni"></p>
            <p class="text-[11px] text-slate-500 font-semibold">Hari ini</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-100 p-3">
            <p class="text-2xl font-bold text-slate-700" x-text="hitung.akan"></p>
            <p class="text-[11px] text-slate-500 font-semibold">Akan datang</p>
          </div>
          <div class="bg-white rounded-2xl border border-slate-100 p-3">
            <p class="text-2xl font-bold text-brand-dark" x-text="hitung.total"></p>
            <p class="text-[11px] text-slate-500 font-semibold">Total</p>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-100 bg-white p-3 mb-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Saring</p>
            <button type="button" @click="reset()" class="text-[11px] font-semibold text-slate-500 hover:text-slate-700">Bersihkan</button>
          </div>
          <div class="grid sm:grid-cols-4 gap-2.5">
            <div>
              <label class="block text-[11px] text-gray-600 mb-1">Jenis</label>
              <select x-model="jenis" @change="muat()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Semua</option>
                <option value="kontrol">Kontrol ulang</option>
                <option value="vaksin">Dosis vaksin</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-gray-600 mb-1">Dokter</label>
              <select x-model="dokter" @change="muat()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Semua dokter</option>
                <template x-for="d in dokters" :key="d.id"><option :value="d.id" x-text="d.name"></option></template>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-gray-600 mb-1">Dari tanggal</label>
              <input type="date" x-model="dari" @change="muat()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            </div>
            <div>
              <label class="block text-[11px] text-gray-600 mb-1">Sampai</label>
              <input type="date" x-model="sampai" @change="muat()" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            </div>
          </div>
        </div>

        <template x-if="!daftar.length">
          <div class="bg-white rounded-3xl border border-slate-100 p-8 text-center">
            <p class="text-sm font-semibold text-green-700">Tidak ada yang perlu diingatkan pada rentang ini.</p>
            <p class="text-xs text-gray-400 mt-1">Coba perlebar rentang tanggalnya bila sedang mencari yang lebih lama.</p>
          </div>
        </template>

        <div class="space-y-2.5">
          <template x-for="x in daftar" :key="x.kind + ':' + x.id">
            <div class="bg-white border border-slate-100 rounded-2xl p-3.5">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-[200px]">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="x.kind === 'vaksin' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'" x-text="x.kind === 'vaksin' ? 'Vaksin' : 'Kontrol'"></span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold" :class="statusWarna(x)" x-text="statusTeks(x)"></span>
                    <!-- Sudah berapa kali diingatkan: yang sudah tiga kali
                         dihubungi tapi tetap tidak datang keadaannya berbeda
                         dari yang belum pernah dihubungi sama sekali. -->
                    <span x-show="x.sent_count" x-cloak class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500" x-text="'sudah di-WA ' + x.sent_count + 'x'"></span>
                    <!-- Dari mana tanggalnya berasal. Yang berlabel IDAI
                         dihitung ulang tiap kali halaman dibuka, jadi ia ikut
                         bergeser saat ada dosis yang tertunda; yang tanpa
                         label berasal dari kolom yang diketik tangan dan tidak
                         pernah bergeser sendiri. -->
                    <span x-show="x.sumber === 'idai'" x-cloak class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">jadwal IDAI</span>
                  </div>
                  <p class="font-semibold text-gray-800 mt-1.5" x-text="x.patient_name"></p>
                  <p class="text-xs text-gray-600" x-text="x.title + (x.detail ? ' — ' + x.detail : '')"></p>
                  <p class="text-[11px] text-gray-400" x-text="'Jadwal ' + x.due + (x.doctor_name ? ' · ' + x.doctor_name : '')"></p>
                </div>
                <div class="flex gap-1.5 flex-wrap shrink-0">
                  <template x-if="tautan(x, false)">
                    <a :href="tautan(x, false)" target="_blank" rel="noopener" @click="tandai(x)" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition">WA Pasien</a>
                  </template>
                  <template x-if="!tautan(x, false)">
                    <span class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-100">Tanpa No. HP</span>
                  </template>
                  <template x-if="tautan(x, true)">
                    <a :href="tautan(x, true)" target="_blank" rel="noopener" @click="tandai(x)" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#0b6b34] bg-[#d6f5e3] hover:brightness-95 transition" x-text="'WA ' + (x.family_relation || 'Keluarga')"></a>
                  </template>
                  <a :href="'#/admin/patients/' + x.patient_id" class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition">Rekam Medis</a>
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
// REKAP BULANAN untuk pemilik & Super Admin.
//
// Rekap umroh sudah ada, tapi belum ada gambaran keseluruhan. Sekarang
// angkanya bisa dipercaya justru karena resep dan surat sudah wajib punya
// rekam medis — yang dihitung bukan lagi sekumpulan catatan lepas.
//
// YANG DIHITUNG HANYA YANG SAH: resep yang menunggu ACC atau ditolak, dan
// surat yang belum disahkan, tidak masuk. Rekap yang memasukkannya akan
// melaporkan pekerjaan yang tidak pernah terjadi.
// ===========================================================================
export function adminRecap() {
  const bulanAda = store.monthsWithActivity(24);
  const bulanAwal = bulanAda[0] || todayLocal().slice(0, 7);
  window.__rekapBulanAda = bulanAda;
  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    bulanAda: window.__rekapBulanAda || [],
    bulan: '${bulanAwal}',
    r: null,
    muat() { this.r = window.__store.monthlyRecap(this.bulan); },
    rupiah(n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); },
    namaBulan(b) {
      if (!b) return '-';
      const [y, m] = b.split('-').map(Number);
      const nama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      return (nama[(m || 1) - 1] || '') + ' ' + y;
    }
  }" x-init="muat()" class="min-h-screen bg-wash">
    ${adminSidebar('recap')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-end justify-between gap-3 flex-wrap mb-1">
          <div>
            <h2 class="text-xl font-bold text-gray-800">Rekap Bulanan</h2>
            <p class="text-sm text-gray-500 mt-0.5" x-text="namaBulan(bulan)"></p>
          </div>
          <div>
            <label class="block text-[11px] text-gray-600 mb-1">Bulan</label>
            <select x-model="bulan" @change="muat()" class="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <template x-for="b in bulanAda" :key="b"><option :value="b" x-text="namaBulan(b)"></option></template>
            </select>
          </div>
        </div>
        <p class="text-[11.5px] text-gray-400 mb-5">Hanya menghitung yang <b>sudah sah</b>: resep yang menunggu ACC atau ditolak, dan surat yang belum disahkan, tidak ikut.</p>

        <template x-if="!bulanAda.length">
          <div class="bg-white rounded-3xl border border-slate-100 p-8 text-center text-gray-400 text-sm">Belum ada kegiatan yang bisa direkap.</div>
        </template>

        <template x-if="r">
          <div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-brand-dark" x-text="r.kunjungan"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Kunjungan</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-purple-700" x-text="r.resep"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Resep sah</p>
                <p class="text-[10.5px] text-slate-400 mt-0.5" x-show="r.resep_apotek" x-cloak x-text="r.resep_apotek + ' disusun apotek'"></p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-teal-700" x-text="r.vaksinasi"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Vaksinasi</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-amber-700" x-text="r.surat"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Surat keterangan</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-slate-700" x-text="r.pasien_dilayani"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Pasien dilayani</p>
                <p class="text-[10.5px] text-slate-400 mt-0.5">orang, bukan kunjungan</p>
              </div>
              <div class="bg-white rounded-2xl border border-slate-100 p-3.5">
                <p class="text-2xl font-bold text-green-700" x-text="rupiah(r.jasa_dokter)"></p>
                <p class="text-[11px] text-slate-500 font-semibold">Jasa dokter pada resep</p>
              </div>
            </div>

            <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Per Dokter</h3>
            <div class="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-5">
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th class="px-4 py-2.5 font-semibold">Dokter</th>
                  <th class="px-3 py-2.5 font-semibold">Kunjungan</th>
                  <th class="px-3 py-2.5 font-semibold">Resep</th>
                  <th class="px-3 py-2.5 font-semibold">Surat</th>
                  <th class="px-3 py-2.5 font-semibold">Vaksinasi</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-50">
                  <template x-for="d in r.per_dokter" :key="d.id">
                    <tr>
                      <td class="px-4 py-2.5 font-medium text-gray-800" x-text="d.nama"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="d.kunjungan"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="d.resep"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="d.surat"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="d.vaksinasi"></td>
                    </tr>
                  </template>
                  <template x-if="!r.per_dokter.length"><tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 text-sm">Tidak ada kegiatan bulan ini.</td></tr></template>
                </tbody>
              </table></div>
            </div>

            <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Per Tempat</h3>
            <div class="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <div class="overflow-x-auto"><table class="w-full text-sm">
                <thead><tr class="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th class="px-4 py-2.5 font-semibold">Tempat</th>
                  <th class="px-3 py-2.5 font-semibold">Kunjungan</th>
                  <th class="px-3 py-2.5 font-semibold">Vaksinasi</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-50">
                  <template x-for="t in r.per_tempat" :key="t.nama">
                    <tr>
                      <td class="px-4 py-2.5 font-medium text-gray-800" x-text="t.nama"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="t.kunjungan"></td>
                      <td class="px-3 py-2.5 text-gray-600" x-text="t.vaksinasi"></td>
                    </tr>
                  </template>
                  <template x-if="!r.per_tempat.length"><tr><td colspan="3" class="px-4 py-6 text-center text-gray-400 text-sm">Tidak ada kegiatan bulan ini.</td></tr></template>
                </tbody>
              </table></div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>`;
}

export function adminLocations() {
  const rows = store.getAllLocations();
  const fallback = CONFIG.LOCATIONS || [];
  const card = (l) => {
    const used = store.countLocationUsage(l.name);
    const off = l.is_active === false;
    // Siapa yang memakai tempat ini sebagai kop — supaya terlihat sebelum
    // sesuatu diubah atau dihapus.
    const dokterKop = store.getDoctors().filter(d =>
      d.kop_location_id === l.id || store.doctorPracticeLocationIds(d.id).indexOf(l.id) !== -1);
    const punyaKop = !!String(l.kop_name || '').trim();
    // Home Care & Telemedicine bukan tempat berakun — tidak punya kop sendiri
    // dan tidak boleh ikut ditagih kelengkapannya.
    const layananSaja = store.isServiceLocation(l);
    const akun = layananSaja ? null : (store.data.pharmacies || []).find(p => store.pharmacyLocationId(p.id) === l.id);
    return `<div class="bg-white border border-slate-100 rounded-2xl p-4 flex items-start gap-3 ${off ? 'opacity-60' : ''}">
      ${l.kop_logo_url
        ? `<img src="${escHtml(l.kop_logo_url)}" alt="Logo ${escHtml(l.name)}" class="w-10 h-10 rounded-xl object-contain bg-white border border-slate-100 shrink-0">`
        : `<span class="w-10 h-10 rounded-xl bg-[#2b7ee0]/10 flex items-center justify-center shrink-0"><span class="ms text-[20px] text-brand-dark">location_on</span></span>`}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="font-semibold text-gray-800 text-sm">${escHtml(l.name)}</h4>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${off ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}">${off ? 'Nonaktif' : 'Aktif'}</span>
          ${used ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">Dipakai ${used}x</span>` : ''}
          ${layananSaja
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">Cara layanan &mdash; tanpa kop</span>`
            : punyaKop
              ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">Punya kop sendiri</span>`
              : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Kop belum diisi</span>`}
          ${akun ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">Akun: ${escHtml(akun.name || '')}</span>` : ''}
        </div>
        <p class="text-xs text-gray-500 mt-1">${l.address ? escHtml(l.address) : '<span class="text-gray-300">Belum ada alamat &mdash; kop resep memakai alamat klinik</span>'}</p>
        ${(!layananSaja && !punyaKop) ? `<p class="text-[11px] text-red-700 mt-1 font-semibold">Resep &amp; surat dari sini akan tercetak memakai identitas Klinik Prima. Isi kop-nya agar tercetak sebagai ${escHtml(l.name)}.</p>` : ''}
        ${l.phone ? `<p class="text-xs text-gray-400 mt-0.5">Telp: ${escHtml(l.phone)}</p>` : ''}
        ${punyaKop ? `<p class="text-[11px] text-indigo-700 mt-1 font-semibold">Kop: ${escHtml(l.kop_name)}${l.kop_sub ? ' ' + escHtml(l.kop_sub) : ''}${l.kop_email ? ' &middot; ' + escHtml(l.kop_email) : ''}</p>` : ''}
        ${dokterKop.length ? `<p class="text-[11px] text-slate-500 mt-1"><span class="ms text-[12px] align-middle">stethoscope</span> Dipakai ${dokterKop.map(d => escHtml(d.full_name || 'Dokter')).join(', ')}</p>` : ''}
        ${l.notes ? `<p class="text-xs text-gray-400 mt-0.5 italic">${escHtml(l.notes)}</p>` : ''}
        <div class="flex gap-1.5 mt-3 flex-wrap">
          <button onclick="window.__locEdit(${jsStr(l.id)},${jsStr(l.name)},${jsStr(l.address)},${jsStr(l.phone)},${jsStr(l.notes)},${Number(l.sort_order) || 100},${jsStr(l.kop_name)},${jsStr(l.kop_sub)},${jsStr(l.kop_email)},${jsStr(l.kop_logo_url)})" class="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Edit</button>
          <button onclick="window.__locToggle(${jsStr(l.id)})" class="px-2.5 py-1 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">${off ? 'Aktifkan' : 'Nonaktifkan'}</button>
          <button onclick="window.__locDelete(${jsStr(l.id)},${jsStr(l.name)},${used})" class="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition">Hapus</button>
        </div>
      </div>
    </div>`;
  };

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    showForm: false, editing: null, msg: '', saving: false,
    form: { name:'', address:'', phone:'', notes:'', sort_order:100 },
    // Melengkapi yang kurang: tempat praktik untuk akun yang belum punya.
    sibukBuat: false,
    async buatkanTempat(pharmacyId) {
      if (this.sibukBuat) return;
      this.sibukBuat = true;
      const r = await window.__store.ensureLocationForPharmacy(pharmacyId);
      this.sibukBuat = false;
      if (r && r.error) { window.__showToast && window.__showToast('Gagal', r.error); return; }
      window.__showToast && window.__showToast('Dibuat', 'Tempat praktiknya sudah ada. Isi kop-nya supaya dokumen dari sana tidak berkop klinik lain.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 300);
    },
    async buatkanSemua() {
      if (this.sibukBuat) return;
      this.sibukBuat = true;
      for (const ph of window.__store.pharmaciesWithoutLocation()) {
        await window.__store.ensureLocationForPharmacy(ph.id);
      }
      this.sibukBuat = false;
      window.__showToast && window.__showToast('Selesai', 'Semua akun kini punya tempat praktik. Kop-nya masih perlu diisi satu per satu.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 300);
    },
    openNew() { this.editing = null; this.form = { name:'', address:'', phone:'', notes:'', sort_order:100, kop_name:'', kop_sub:'', kop_email:'', kop_logo_url:'' }; this.msg = ''; this.showForm = true; },
    logoBusy: false, logoErr: '',
    async unggahLogo(ev) {
      const file = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!file) return;
      this.logoBusy = true; this.logoErr = '';
      const r = await window.__store.uploadKopLogo(this.editing || 'baru', file);
      this.logoBusy = false;
      if (ev.target) ev.target.value = '';
      if (r && r.error) { this.logoErr = r.error; return; }
      if (!r.url) { this.logoErr = 'Mode demo: logo tidak benar-benar diunggah.'; return; }
      this.form.kop_logo_url = r.url;
    },
    async save() {
      if (this.saving) return;
      const name = (this.form.name || '').trim();
      if (!name) { this.msg = 'Nama tempat wajib diisi'; return; }
      this.saving = true; this.msg = '';
      const payload = { name: name, address: this.form.address, phone: this.form.phone, notes: this.form.notes, sort_order: Number(this.form.sort_order) || 100,
        kop_name: this.form.kop_name, kop_sub: this.form.kop_sub, kop_email: this.form.kop_email, kop_logo_url: this.form.kop_logo_url };
      const res = this.editing
        ? await window.__store.updateLocation(this.editing, payload)
        : await window.__store.createLocation(payload);
      this.saving = false;
      if (res && res.error) { this.msg = res.error; return; }
      this.showForm = false;
      window.__showToast && window.__showToast('Tersimpan', this.editing ? 'Tempat diperbarui.' : 'Tempat baru ditambahkan.');
      setTimeout(function(){ window.__rerender && window.__rerender() }, 200);
    }
  }" x-init="
    window.__locEdit = (id,name,address,phone,notes,sort,kn,ks,ke,kl) => { editing = id; form = { name: name, address: address, phone: phone, notes: notes, sort_order: sort, kop_name: kn || '', kop_sub: ks || '', kop_email: ke || '', kop_logo_url: kl || '' }; msg = ''; showForm = true; };
    window.__locToggle = async (id) => { const r = await window.__store.toggleLocationActive(id); if (r && r.error) { alert(r.error); return; } window.__rerender && window.__rerender(); };
    window.__locDelete = async (id,name,used) => {
      const warn = used ? ('\\n\\nTempat ini tercatat pada ' + used + ' rekam medis/vaksinasi. Riwayat lama TIDAK berubah, tapi tempat ini tidak lagi muncul di pilihan.') : '';
      if (!confirm('Hapus tempat: ' + name + '?' + warn)) return;
      const r = await window.__store.deleteLocation(id);
      if (r && r.error) { alert(r.error); return; }
      window.__showToast && window.__showToast('Terhapus', name + ' dihapus dari daftar tempat.');
      window.__rerender && window.__rerender();
    };
  " class="min-h-screen bg-wash">
    ${adminSidebar('locations')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-2">
          <div>
            <h2 class="text-xl font-bold text-gray-800">Tempat Praktik &amp; Kop Resep</h2>
            <p class="text-sm text-gray-500 mt-0.5">Daftarkan klinik maupun apotek tempat dokter berpraktik &mdash; beserta identitas kop resepnya.</p>
          </div>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)">+ Tambah Tempat</button>
        </div>
        <p class="text-sm text-gray-500 mb-4">Daftar ini yang muncul di pilihan <b>Lokasi / Tempat</b> pada rekam medis &amp; vaksinasi, dan yang tercetak sebagai <b>kop</b> di kertas resep &amp; surat keterangan. <b>Setiap akun apotek / klinik harus punya satu tempat di sini beserta kop-nya</b> &mdash; kalau tidak, dokumen dari sana tercetak memakai identitas klinik lain. Home Care dan Telemedicine dikecualikan: itu cara layanan, bukan tempat berakun.</p>

        <!-- Daftar kerja, bukan sekadar tampilan. Selama ada akun fasilitas
             tanpa tempat praktik atau tanpa kop, ada dokumen medis yang salah
             penerbitnya — dan itu tidak boleh cuma bisa ketahuan kalau
             seseorang kebetulan menelusuri satu per satu. -->
        ${(() => {
          const masalah = store.locationIssues();
          if (!masalah.length) {
            return `<div class="mb-6 px-4 py-3 rounded-2xl bg-green-50 border border-green-200">
              <p class="text-[12.5px] font-semibold text-green-800">Semua akun apotek / klinik sudah punya tempat praktik beserta kop-nya.</p>
            </div>`;
          }
          const tanpaTempat = masalah.filter(m => m.jenis === 'tanpa-tempat');
          const tanpaKop = masalah.filter(m => m.jenis === 'tanpa-kop');
          return `<div class="mb-6 px-4 py-3 rounded-2xl bg-amber-50 border-2 border-amber-200">
            <p class="text-sm font-bold text-amber-900 mb-1">${masalah.length} hal yang belum lengkap</p>
            ${tanpaTempat.length ? `
            <div class="mt-2">
              <p class="text-[12px] text-amber-900"><b>Akun tanpa tempat praktik</b> &mdash; belum bisa membuat surat keterangan, dan resepnya berkop klinik lain:</p>
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                ${tanpaTempat.map(m => `<button @click="buatkanTempat('${m.pharmacy_id}')" class="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 transition">Buatkan untuk ${escHtml(m.nama)}</button>`).join('')}
              </div>
              <button @click="buatkanSemua()" class="mt-2 px-2.5 py-1 rounded-lg text-[11.5px] font-bold text-white bg-amber-600 hover:bg-amber-700 transition">Buatkan semuanya sekaligus</button>
            </div>` : ''}
            ${tanpaKop.length ? `
            <p class="text-[12px] text-amber-900 mt-3"><b>Tempat yang kop-nya belum diisi</b> &mdash; dokumennya masih tercetak sebagai Klinik Prima: ${tanpaKop.map(m => escHtml(m.nama)).join(', ')}.</p>` : ''}
          </div>`;
        })()}

        <!-- Modal tambah / edit -->
        <div x-show="showForm" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="showForm=false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4" x-text="editing ? 'Edit Tempat' : 'Tambah Tempat Baru'"></h3>
            <div x-show="msg" x-cloak class="mb-3 p-2 rounded-lg text-sm bg-red-50 text-red-700" x-text="msg"></div>
            <div class="space-y-3">
              <div><label class="block text-xs text-gray-600 mb-1">Nama Tempat *</label><input type="text" x-model="form.name" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Contoh: Klinik Utama Prima"></div>
              <div><label class="block text-xs text-gray-600 mb-1">Alamat</label><textarea x-model="form.address" rows="2" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 resize-none" placeholder="Alamat lengkap (dicetak di kop kertas resep)"></textarea></div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs text-gray-600 mb-1">No. Telp / WA</label><input type="text" x-model="form.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="0812..."></div>
                <div><label class="block text-xs text-gray-600 mb-1">Urutan Tampil</label><input type="number" x-model="form.sort_order" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div><label class="block text-xs text-gray-600 mb-1">Catatan</label><input type="text" x-model="form.notes" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Opsional"></div>
              <div class="sm:col-span-2 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <p class="text-xs font-bold text-indigo-900 mb-1">Identitas Kop Resep</p>
                <p class="text-[11px] text-indigo-700 mb-2 leading-relaxed">Diisi bila tempat ini punya kop sendiri &mdash; misalnya apotek tempat seorang dokter berpraktik. <b>Dikosongkan berarti memakai identitas Klinik Prima</b>, jadi tempat lama tidak berubah tampilannya. Alamat &amp; telepon di atas yang dipakai pada kop ini.</p>
                <div class="grid sm:grid-cols-2 gap-2">
                  <div><label class="block text-[11px] text-indigo-800 mb-1">Nama besar di kop</label><input type="text" x-model="form.kop_name" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50" placeholder="cth: APOTEK MEDIKA RAYA"></div>
                  <div><label class="block text-[11px] text-indigo-800 mb-1">Baris kecil di bawahnya</label><input type="text" x-model="form.kop_sub" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50" placeholder="cth: (Medika Raya)"></div>
                  <div><label class="block text-[11px] text-indigo-800 mb-1">E-mail pada kop</label><input type="text" x-model="form.kop_email" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50" placeholder="Opsional"></div>
                  <div class="sm:col-span-2">
                    <label class="block text-[11px] text-indigo-800 mb-1">Logo kop</label>
                    <div class="flex items-start gap-3 flex-wrap">
                      <img :src="form.kop_logo_url" x-show="form.kop_logo_url" x-cloak alt="Logo kop"
                        class="h-14 w-auto max-w-[140px] object-contain rounded-lg bg-white border border-indigo-200 p-1">
                      <div class="flex-1 min-w-[220px]">
                        <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 transition cursor-pointer">
                          <span class="ms text-[16px]">upload</span>
                          <span x-text="logoBusy ? 'Mengunggah...' : (form.kop_logo_url ? 'Ganti logo' : 'Unggah logo')"></span>
                          <input type="file" accept="image/*" class="hidden" @change="unggahLogo($event)">
                        </label>
                        <button type="button" x-show="form.kop_logo_url" x-cloak @click="form.kop_logo_url = ''"
                          class="ml-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Hapus logo</button>
                        <p class="text-[11px] text-indigo-700 mt-1.5 leading-relaxed">PNG / JPG / WEBP, maksimal 2 MB. Dicetak setinggi ±20 mm di kop, jadi gambar besar tidak menambah ketajaman.</p>
                        <p x-show="logoErr" x-cloak class="text-[11px] text-red-600 mt-1" x-text="logoErr"></p>
                        <input type="text" x-model="form.kop_logo_url" placeholder="atau tempel URL logo di sini"
                          class="mt-1.5 w-full px-3 py-2 border border-indigo-200 rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50">
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Pratinjau kop. Menyusun kop tanpa melihat hasilnya berarti
                     baru ketahuan salah setelah selembar resep tercetak. -->
                <div class="mt-3 rounded-xl bg-white border border-indigo-200 p-3">
                  <p class="text-[10.5px] uppercase tracking-wide font-bold text-slate-400 mb-2">Pratinjau kop resep</p>
                  <div class="flex items-center gap-3 pb-2" style="border-bottom:3px double #1c3980">
                    <img :src="form.kop_logo_url" x-show="form.kop_logo_url" x-cloak alt="" class="h-10 w-auto max-w-[70px] object-contain shrink-0">
                    <div class="flex-1 text-center min-w-0">
                      <p class="font-extrabold text-[13px] leading-tight" style="color:#1c3980"
                        x-text="form.kop_name || 'KLINIK KASIH ANUGERAH PRIMA'"></p>
                      <p class="text-[10px] font-semibold text-slate-500" x-text="form.kop_sub || (form.kop_name ? '' : '(PRIMA KLINIK)')"></p>
                      <p class="text-[9.5px] text-slate-600 mt-0.5 leading-snug">
                        <span x-text="form.address || 'Alamat belum diisi'"></span><br>
                        No. HP / WA : <span x-text="form.phone || '-'"></span><span x-show="form.kop_email" x-cloak> &nbsp;|&nbsp; email: <span x-text="form.kop_email"></span></span>
                      </p>
                    </div>
                  </div>
                  <p class="text-[10.5px] text-slate-400 mt-2">Beginilah kop akan tercetak di kertas resep. Bagian yang dikosongkan memakai identitas Klinik Prima.</p>
                </div>
              </div>
            </div>
            <div class="flex gap-2 justify-end mt-5">
              <button @click="showForm=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button>
              <button @click="save()" :disabled="saving" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#2b7ee0,#0f4c9e)"><span x-show="!saving">Simpan</span><span x-show="saving" x-cloak>Menyimpan...</span></button>
            </div>
          </div>
        </div>

        ${rows.length === 0 ? `<div class="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <p class="text-sm text-gray-500 mb-2">Belum ada tempat tersimpan.</p>
          <p class="text-xs text-gray-400">Sementara ini pilihan lokasi memakai daftar bawaan: ${fallback.map(f => escHtml(f)).join(', ') || '-'}. Tambahkan tempat di sini untuk menggantikannya.</p>
        </div>` : `<div class="grid sm:grid-cols-2 gap-3">${rows.map(card).join('')}</div>`}

        <div class="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p class="text-xs text-blue-800 leading-relaxed"><b>Catatan:</b> menghapus sebuah tempat tidak mengubah rekam medis atau data vaksinasi yang sudah tersimpan &mdash; nama tempat di sana tersimpan sebagai teks, jadi riwayat lama tetap utuh. Tempat yang dihapus hanya berhenti muncul di pilihan. Kalau hanya ingin menyembunyikan sementara, pakai <b>Nonaktifkan</b>.</p>
        </div>
      </main>
    </div>
  </div>`;
}

// ===========================================================================
// KESIAPAN SATUSEHAT
//
// SATUSEHAT menolak data yang tidak lengkap: pasien tanpa NIK tervalidasi
// Dukcapil tidak mendapat IHS Number, dan tanpa IHS Number kunjungannya tidak
// bisa dikirim sama sekali.
//
// Halaman ini BUKAN laporan. Tiap angka menunjuk baris mana yang harus
// dilengkapi, dengan tautan langsung ke tempat memperbaikinya. Angka tanpa
// penunjuk hanya memberi tahu bahwa ada masalah — tanpa memberi tahu di mana,
// dan pekerjaan yang tidak bisa ditunjuk tidak akan pernah dikerjakan.
//
// Berguna walau pendaftaran SATUSEHAT belum selesai: NIK ganda dan diagnosis
// tanpa kode sama-sama merugikan klaim BPJS dan rekap bulanan.
// ===========================================================================
export function adminSatusehat() {
  const k = store.kesiapanSatusehat();
  const namaPasien = (id) => (store.getPatient(id) || {}).full_name || 'Pasien';

  // Isi rincian tiap bagian, dalam bentuk yang bisa langsung ditindak.
  const rincian = (b) => {
    if (!b.kurang) return '';
    const baris = [];
    if (b.key === 'nik_ganda') {
      b.rincian.slice(0, 20).forEach(g => baris.push(
        `<li class="py-1.5"><span class="font-mono text-[11.5px] text-red-700">${escHtml(g.nik)}</span>
         <span class="text-slate-500"> dipakai oleh </span>
         ${g.pasien.map(p => `<a href="#/doctor/emr/${p.id}" class="text-brand-dark font-medium hover:underline">${escHtml(p.full_name || 'Tanpa nama')}</a>`).join('<span class="text-slate-400"> dan </span>')}</li>`));
    } else if (b.key === 'pasien_nik') {
      b.rincian.slice(0, 40).forEach(p => baris.push(
        `<li class="py-1.5 flex items-center justify-between gap-2">
           <span>${escHtml(p.full_name || 'Tanpa nama')} <span class="text-slate-400 text-[11px]">${escHtml(p.rm_number || '')}</span></span>
           <a href="#/doctor/emr/${p.id}" class="text-[11.5px] font-semibold text-brand-dark hover:underline shrink-0">Lengkapi</a></li>`));
    } else if (b.key === 'dokter_nik') {
      b.rincian.slice(0, 40).forEach(d => baris.push(
        `<li class="py-1.5">${escHtml(d.full_name || 'Tanpa nama')} <span class="text-slate-400 text-[11px]">${escHtml(d.sip_number || 'tanpa SIP')}</span></li>`));
    } else if (b.key === 'diagnosis') {
      b.rincian.slice(0, 40).forEach(r => baris.push(
        `<li class="py-1.5 flex items-center justify-between gap-2">
           <span class="min-w-0"><span class="text-slate-500 text-[11px]">${escHtml(formatDate(r.visit_date))} &middot; ${escHtml(namaPasien(r.patient_id))}</span><br>${escHtml(r.diagnosis || '')}</span>
           <a href="#/doctor/emr/edit/${r.id}" class="text-[11.5px] font-semibold text-brand-dark hover:underline shrink-0">Beri kode</a></li>`));
    } else if (b.key === 'obat_kfa') {
      b.rincian.slice(0, 60).forEach(o => baris.push(
        `<li class="py-1.5 flex items-center justify-between gap-2">
           <span>${escHtml(o.nama)}${o.racikan ? ' <span class="text-[10.5px] text-amber-700">(racikan)</span>' : ''}</span>
           <span class="text-[11px] text-slate-400 shrink-0">${o.jumlah}&times; dipakai</span></li>`));
    } else if (b.key === 'tempat') {
      b.rincian.slice(0, 20).forEach(t => baris.push(
        `<li class="py-1.5">${escHtml(t.name || 'Tanpa nama')}</li>`));
    }
    const sisa = b.kurang - baris.length;
    return `<ul class="mt-2 divide-y divide-slate-100 text-[12.5px] text-slate-700">${baris.join('')}</ul>`
      + (sisa > 0 ? `<p class="mt-2 text-[11.5px] text-slate-400">&hellip; dan ${sisa} lagi.</p>` : '');
  };

  const kartu = k.bagian.map((b, i) => `
    <div class="bg-white rounded-2xl border ${b.gawat ? 'border-red-200' : 'border-slate-100'} overflow-hidden">
      <button type="button" @click="buka === ${i} ? buka = -1 : buka = ${i}"
        class="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition">
        <span class="ms text-[22px] mt-0.5 ${b.kurang === 0 ? 'text-green-600' : (b.gawat ? 'text-red-600' : 'text-amber-600')}">${b.kurang === 0 ? 'check_circle' : (b.gawat ? 'error' : 'pending')}</span>
        <span class="flex-1 min-w-0">
          <span class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-[13.5px] text-ink">${b.judul}</span>
            ${b.kurang === 0
              ? '<span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-green-50 text-green-700">lengkap</span>'
              : `<span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold ${b.gawat ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}">${b.kurang} perlu dilengkapi</span>`}
            ${b.total ? `<span class="text-[11px] text-slate-400">dari ${b.total}</span>` : ''}
          </span>
          <span class="block text-[11.5px] text-muted leading-relaxed mt-1">${b.pesan}</span>
        </span>
        <span class="ms text-[18px] text-slate-300 mt-0.5" x-text="buka === ${i} ? 'expand_less' : 'expand_more'"></span>
      </button>
      ${b.kurang ? `<div x-show="buka === ${i}" x-cloak class="px-4 pb-4 -mt-1">${rincian(b)}</div>` : ''}
    </div>`).join('');

  const persen = k.kunjungan.total ? Math.round((k.kunjungan.siap / k.kunjungan.total) * 100) : 0;

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, buka: ${k.bagian.findIndex(b => b.kurang > 0)} }" class="min-h-screen bg-wash">
    ${adminSidebar('satusehat')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-4xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800">Kesiapan SATUSEHAT</h2>
        <p class="text-[12.5px] text-muted mt-0.5 leading-relaxed">Yang harus lengkap sebelum rekam medis bisa dikirim ke SATUSEHAT. Tiap baris menunjuk tempat memperbaikinya.</p>

        <!-- Angka yang paling jujur. Persentase per bagian bisa terlihat bagus
             sementara tidak ada satu pun kunjungan yang utuh: pasiennya punya
             NIK tapi diagnosisnya tanpa kode, atau sebaliknya. -->
        <div class="mt-4 bg-white rounded-2xl border border-slate-100 p-5">
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">Kunjungan yang siap dikirim hari ini</p>
          <p class="mt-1 text-2xl font-extrabold ${persen === 100 ? 'text-green-700' : 'text-ink'}">${k.kunjungan.siap} <span class="text-base font-semibold text-slate-400">dari ${k.kunjungan.total} kunjungan</span></p>
          <div class="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div class="h-full rounded-full ${persen === 100 ? 'bg-green-500' : 'bg-brand-dark'}" style="width:${persen}%"></div>
          </div>
          <p class="mt-2 text-[11.5px] text-muted leading-relaxed">Sebuah kunjungan baru terhitung siap kalau pasiennya punya NIK 16 digit <b>dan</b> diagnosisnya punya kode ICD-10. Salah satu kurang, kunjungannya tidak bisa dikirim.</p>
        </div>

        <div class="mt-4 space-y-3">${kartu}</div>

        <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 class="font-bold text-[13.5px] text-ink">Yang belum bisa dikerjakan dari sini</h3>
          <p class="text-[11.5px] text-muted leading-relaxed mt-1">Tiga hal berikut keluar atas nama klinik, bukan atas nama aplikasi, jadi harus diurus pemilik klinik:</p>
          <ol class="mt-2 space-y-1.5 text-[12.5px] text-slate-700 list-decimal list-inside">
            <li>Kode faskes dari <span class="font-medium">registrasifasyankes.kemkes.go.id</span></li>
            <li>Pendaftaran MedConnect sebagai Sistem RME di portal SATUSEHAT</li>
            <li>client_id &amp; client_secret (sandbox dulu, produksi kemudian)</li>
          </ol>
          <p class="text-[11.5px] text-muted leading-relaxed mt-2">Selama ketiganya belum ada, halaman ini tetap berguna: yang dilengkapi di sini juga dipakai klaim BPJS dan rekap bulanan.</p>
        </div>
      </main>
    </div>
  </div>`;
}

function adminSidebar(active) {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'insights' },
    // Panel tugas hanya untuk Super Admin & pemilik klinik — lihat
    // store.canManageTasks(). Akun lain tidak melihat menunya sama sekali.
    ...(store.canManageTasks(user) ? [{ id: 'tasks', label: 'To-Do & Tugas', icon: 'checklist', href: '#/admin/tasks' }] : []),
    // Catatan Bisnis lebih tertutup: Super Admin tidak melihatnya sama sekali.
    ...((store.canManageNotes(user) || store.canViewSharedNotes(user)) ? [{ id: 'catatan', label: 'Catatan Bisnis', icon: 'menu_book', href: '#/catatan' }] : []),
    { id: 'users', label: 'Manajemen User', icon: 'group' },
    { id: 'patients', label: 'Rekam Medis Pasien', icon: 'clinical_notes', href: '#/admin/patients' },
    { id: 'reminders', label: 'Pengingat Kontrol', icon: 'notifications_active', href: '#/admin/reminders' },
    { id: 'vaksin', label: 'Vaksin Anak', icon: 'vaccines', href: '#/admin/vaksin' },
    { id: 'vaksin-jadwal', label: 'Jadwal Vaksin IDAI', icon: 'event_available', href: '#/admin/vaksin-jadwal' },
    { id: 'recap', label: 'Rekap Bulanan', icon: 'insights', href: '#/admin/recap' },
    { id: 'services', label: 'Layanan', icon: 'medical_services' },
    { id: 'articles', label: 'Artikel', icon: 'article' },
    { id: 'bookings', label: 'Pendaftaran', icon: 'calendar_month' },
    { id: 'calendar', label: 'Kalender', icon: 'event' },
    { id: 'consultations', label: 'Riwayat Konsultasi', icon: 'forum' },
    { id: 'crm', label: 'CRM Prospek', icon: 'contacts', href: '#/admin/crm' },
    { id: 'umroh', label: 'Umroh &amp; Haji', icon: 'travel_explore', href: '#/admin/umroh' },
    { id: 'stock', label: 'Stok Opening', icon: 'inventory_2', href: '#/admin/stock' },
    { id: 'locations', label: 'Tempat Praktik & Kop', icon: 'location_on', href: '#/admin/locations' },
    { id: 'homecare', label: 'BMHP & Jasa', icon: 'home_health', href: '#/admin/homecare/history' },
    { id: 'satusehat', label: 'Kesiapan SATUSEHAT', icon: 'cloud_sync', href: '#/admin/satusehat' },
    { id: 'bugs', label: 'Laporan Bug', icon: 'bug_report', href: '#/admin/bugs' },
  ].map(i => ({ ...i, href: i.href || `#/admin/${i.id === 'dashboard' ? 'dashboard' : i.id}` }));
  return `
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-night z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-white/10 flex items-center justify-between" style="flex-shrink:0"><div class="flex items-center gap-2"><img src="assets/logos/medconnect-logo.svg" alt="MedConnect" class="h-7 w-auto"><div><span class="font-extrabold text-[13.5px] text-white block leading-none">MedConnect</span><span class="block text-[10.5px] text-[#7b8ba8] font-semibold mt-0.5">Admin Console</span></div></div><button @click="sideOpen=false" class="lg:hidden text-[#7b8ba8] hover:text-white"><span class="ms text-[20px]">close</span></button></div>
    <nav class="p-3 space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain side-scroll">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active===i.id ? 'bg-[#2b7ee0]/[.22] text-white font-bold' : 'text-[#aab6cc] font-semibold hover:bg-white/5'}"><span class="ms ${active===i.id ? 'ms-fill text-[#7db4f5]' : 'text-[#7b8ba8]'} text-[20px]">${i.icon}</span>${i.label}</a>`).join('')}</nav>
    ${user?.role === 'owner' ? `<div class="p-3 border-t border-white/10" style="flex-shrink:0"><a href="#/doctor/dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#7db4f5] hover:bg-white/5 transition w-full"><span class="ms text-[20px]">stethoscope</span>Lihat sebagai Dokter</a></div>` : ''}
    <div class="px-3 pt-3" style="flex-shrink:0"><button onclick="window.__laporBug&&window.__laporBug()" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#aab6cc] hover:bg-white/5 hover:text-white transition w-full"><span class="ms text-[20px] text-[#7b8ba8]">bug_report</span>Lapor Bug</button></div>
    <div class="p-3 border-t border-white/10" style="flex-shrink:0"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#7b8ba8] hover:bg-white/5 hover:text-white transition w-full"><span class="ms text-[20px]">logout</span>Keluar</button></div>
  </aside>`;
}

function adminHeader() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const roleLabel = user?.role === 'owner' ? 'Owner' : 'Super Admin';
  // Nama pemakainya ikut ditampilkan. Dengan beberapa Super Admin memakai
  // konsol yang sama, label 'Super Admin' saja tidak memberi tahu siapa yang
  // sedang login — dan itu penting justru saat ada yang keliru menekan sesuatu.
  const prof = store.getProfile(user) || {};
  const nama = String(prof.full_name || prof.name || '').trim();
  const inisial = nama ? nama.charAt(0).toUpperCase() : '';
  const unread = store.getUnreadCount(user?.id);
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
    <div class="flex items-center gap-3">
      <a href="#/admin/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span><span data-notif-count class="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#ff5436] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white" style="${unread > 0 ? '' : 'display:none'}">${unread > 99 ? '99+' : unread}</span></a>
      <div class="flex items-center gap-2">
        <span class="w-8 h-8 rounded-full bg-[#2b7ee0]/20 flex items-center justify-center shrink-0">${inisial
          ? `<span class="text-[13px] font-bold text-brand-dark">${escHtml(inisial)}</span>`
          : '<span class="ms text-[18px] text-brand-dark">shield_person</span>'}</span>
        <span class="hidden sm:block leading-tight">
          <span class="block text-sm font-semibold text-ink">${nama ? escHtml(nama) : roleLabel}</span>
          ${nama ? `<span class="block text-[10.5px] text-faint">${roleLabel}</span>` : ''}
        </span>
      </div>
    </div>
  </header>`;
}
