import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { supabase } from '../supabase.js';
import { homeCareNewPage, homeCareHistoryPage } from './homecare.js';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
            const roleLabels = { doctor: 'Dokter', owner: 'Owner', patient: 'Pasien', pharmacy: 'Apotek' };
            const roleColors = { doctor: 'bg-teal-100 text-teal-700', owner: 'bg-amber-100 text-amber-700', patient: 'bg-blue-100 text-blue-700', pharmacy: 'bg-purple-100 text-purple-700' };
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
  const currentUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  // Bootstrap case: before any Owner account exists at all, a plain SuperAdmin
  // may create the first one. Once at least one exists, only an existing
  // Owner can create another.
  const ownerExists = store.getUsers('owner').length > 0;
  const canCreateOwner = currentUser?.role === 'owner' || !ownerExists;
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
              <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Role *</label><select x-model="newUser.role" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih Role</option><option value="doctor">Dokter</option>${canCreateOwner ? `<option value="owner">Owner (SuperAdmin + Dokter)</option>` : ''}<option value="patient">Pasien</option><option value="pharmacy">Apotek Mitra</option></select></div>
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
                <template x-if="newUser.role==='pharmacy'"><div><label class="block text-xs text-gray-600 mb-1">No. SIPA</label><input type="text" x-model="newUser.license_no" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
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
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium" :class="{'bg-teal-100 text-teal-700': user.role==='doctor', 'bg-amber-100 text-amber-700': user.role==='owner', 'bg-blue-100 text-blue-700': user.role==='patient', 'bg-purple-100 text-purple-700': user.role==='pharmacy'}" x-text="user.role==='doctor'?'Dokter':user.role==='owner'?'Owner':user.role==='patient'?'Pasien':'Apotek'"></span></td>
                <td class="px-4 py-3 text-sm font-medium text-gray-800" x-text="user.profile?.full_name || user.profile?.name || '-'"></td>
                <td class="px-4 py-3 text-sm hidden sm:table-cell"><span x-show="!user.no_email" class="text-gray-600" x-text="user.email"></span><span x-show="user.no_email" x-cloak class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Tanpa email — belum bisa login</span></td>
                <td class="px-4 py-3 hidden md:table-cell"><span class="w-2 h-2 rounded-full inline-block" :class="user.is_active ? 'bg-green-500' : 'bg-red-500'"></span><span class="text-xs ml-1" x-text="user.is_active ? 'Aktif' : 'Nonaktif'"></span></td>
                <td class="px-4 py-3"><div class="flex gap-1">
                  <button @click="editingUser=user; newEmail=user.email; editMsg=''" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Email</button>
                  <button @click="toggleActive(user.id)" class="px-2 py-1 rounded text-xs font-medium" :class="user.is_active ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'" x-text="user.is_active ? 'Nonaktifkan' : 'Aktifkan'"></button>
                  <button @click="resetUser=user; resetNewPass=''; resetMsg=''" class="px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Reset Pass</button>
                  <template x-if="user.role==='patient'"><button @click="certUser=user" class="px-2 py-1 rounded text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition">Sertifikat</button></template>
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
    resetUser: null, resetNewPass: '', resetMsg: '', resetting: false,
    certUser: null,
    vaccineNamesFor(user) {
      if (!user || !user.profile || !user.profile.id) return [];
      const vax = window.__store.getVaccinations(user.profile.id);
      return [...new Set(vax.map(v => v.vaccine_name))];
    },
    newUser: { role: '', full_name: '', email: '', password: 'default123', phone: '', sip_number: '', specialization: '', nik: '', birth_date: '', gender: '', license_no: '', address: '' },
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
          const profileData = { email, role: this.newUser.role, is_active: true };
          if (authId) profileData.auth_id = authId;
          const profileRes = await supabase.insert('profiles', profileData);
          if (profileRes.error) { this.createMsg = profileRes.error; this.creating = false; return; }
          const profileId = profileRes.id;
          if (this.newUser.role === 'doctor' || this.newUser.role === 'owner') {
            await supabase.insert('doctors', { profile_id: profileId, full_name: this.newUser.full_name, sip_number: this.newUser.sip_number || '', specialization: this.newUser.specialization || '', phone: this.newUser.phone || '', is_available: true });
          } else if (this.newUser.role === 'patient') {
            await supabase.insert('patients', { profile_id: profileId, full_name: this.newUser.full_name, nik: this.newUser.nik || '', birth_date: this.newUser.birth_date || null, gender: this.newUser.gender || '', phone: this.newUser.phone || '', address: this.newUser.address || '', allergies: '-', emergency_contact: '' });
          } else if (this.newUser.role === 'pharmacy') {
            await supabase.insert('pharmacies', { profile_id: profileId, name: this.newUser.full_name, phone: this.newUser.phone || '', address: this.newUser.address || '', license_no: this.newUser.license_no || '', operating_hours: '' });
          }
          await window.__store.loadFromSupabase();
          this.createMsg = hasEmail ? 'User berhasil dibuat! (tersimpan di cloud)' : 'Akun dibuat tanpa email — belum bisa login. Tambahkan email lewat tombol "Email" pada baris user untuk mengaktifkan login.';
        } catch(e) { this.createMsg = 'Error: ' + e.message; }
      } else {
        const result = store.createUser({ ...this.newUser, name: this.newUser.full_name });
        if (result.error) { this.createMsg = result.error; this.creating = false; return; }
        this.createMsg = 'User berhasil dibuat!';
      }
      this.creating = false;
      this.newUser = { role: '', full_name: '', email: '', password: 'default123', phone: '', sip_number: '', specialization: '', nik: '', license_no: '', address: '' };
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
                <button onclick="if(confirm('Hapus artikel ${(a.title||'').replace(/'/g,"\\'")}?')){window.__store.deleteArticle('${a.id}'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/articles',50)}" class="px-2 py-1 rounded text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition">Hapus</button>
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
    return { ...a, patient_name: p?.full_name || a.patient_name || 'N/A', doctor_name: doc?.full_name || '-' };
  });
  window.__adminCalendarAppts = apptsData;

  const recordsData = store.getAllRecords().filter(r => r.follow_up_date).map(r => {
    const p = store.getPatient(r.patient_id);
    const doc = store.getDoctor(r.doctor_id);
    return { id: r.id, patient_id: r.patient_id, patient_name: p?.full_name || 'N/A', doctor_name: doc?.full_name || '-', follow_up_date: r.follow_up_date, follow_up_notes: r.follow_up_notes, diagnosis: r.diagnosis };
  });
  window.__adminCalendarFollowUps = recordsData;

  const visitsData = store.getAllRecords().map(r => {
    const p = store.getPatient(r.patient_id);
    const doc = store.getDoctor(r.doctor_id);
    return { id: r.id, patient_id: r.patient_id, patient_name: p?.full_name || 'N/A', doctor_name: doc?.full_name || '-', visit_date: r.visit_date, diagnosis: r.diagnosis, visit_type: r.visit_type };
  });
  window.__adminCalendarVisits = visitsData;

  return `
  <div x-data="{
    sideOpen: window.innerWidth > 1024,
    doctorFilter: '',
    selectedDate: '${isCurrentMonth ? todayStr : `${year}-${String(month + 1).padStart(2, '0')}-01`}',
    doctors: window.__adminCalendarDoctors || [],
    allAppts: window.__adminCalendarAppts || [],
    allFollowUps: window.__adminCalendarFollowUps || [],
    allVisits: window.__adminCalendarVisits || [],
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
                  <template x-if="filteredAppts.filter(a => a.date === '${dateStr}').length > 0 || filteredFollowUps.filter(f => f.follow_up_date === '${dateStr}').length > 0 || filteredVisits.filter(v => v.visit_date === '${dateStr}').length > 0">
                    <span class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      <template x-for="i in Math.min(filteredVisits.filter(v => v.visit_date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-green-500'}"></span></template>
                      <template x-for="i in Math.min(filteredAppts.filter(a => a.date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-teal-500'}"></span></template>
                      <template x-for="i in Math.min(filteredFollowUps.filter(f => f.follow_up_date === '${dateStr}').length, 2)"><span class="w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-orange-500'}"></span></template>
                    </span>
                  </template>
                </button>`;
              }).join('')}
            </div>
            <div class="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span>Riwayat Pelayanan</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-teal-500"></span>Janji Temu</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-orange-500"></span>Follow Up Pasien</span>
            </div>
          </div>
          <div class="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-4">
            <h3 class="font-semibold text-gray-800 mb-1">Jadwal</h3>
            <p class="text-xs text-gray-500 mb-4" x-text="selectedDateFormatted"></p>
            <div class="space-y-2">
              <template x-if="selectedAppts.length === 0 && selectedFollowUps.length === 0 && selectedVisits.length === 0"><p class="text-gray-400 text-sm text-center py-8">Tidak ada jadwal di tanggal ini</p></template>
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
                </div>
              </template>
              <template x-if="selectedFollowUps.length > 0"><p class="text-xs font-semibold text-orange-600 uppercase pt-2" x-show="selectedAppts.length > 0 || selectedVisits.length > 0">Follow Up Pasien</p></template>
              <template x-for="f in selectedFollowUps" :key="f.id">
                <a :href="'#/admin/dashboard'" class="block p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                  <div class="flex items-center gap-3">
                    <span class="text-lg">🔄</span>
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-800" x-text="f.patient_name"></p>
                      <p class="text-xs text-gray-500" x-text="f.doctor_name + ' · ' + (f.follow_up_notes || f.diagnosis || 'Kontrol ulang')"></p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Follow Up</span>
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

function adminSidebar(active) {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'insights' },
    { id: 'users', label: 'Manajemen User', icon: 'group' },
    { id: 'services', label: 'Layanan', icon: 'medical_services' },
    { id: 'articles', label: 'Artikel', icon: 'article' },
    { id: 'bookings', label: 'Pendaftaran', icon: 'calendar_month' },
    { id: 'calendar', label: 'Kalender', icon: 'event' },
    { id: 'consultations', label: 'Riwayat Konsultasi', icon: 'forum' },
    { id: 'homecare', label: 'BMHP & Jasa', icon: 'home_health', href: '#/admin/homecare/history' },
  ].map(i => ({ ...i, href: i.href || `#/admin/${i.id === 'dashboard' ? 'dashboard' : i.id}` }));
  return `
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-night z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-white/10 flex items-center justify-between"><div class="flex items-center gap-2"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto"><div><span class="font-extrabold text-[13.5px] text-white block leading-none">Klinik Prima</span><span class="block text-[10.5px] text-[#7b8ba8] font-semibold mt-0.5">Admin Console</span></div></div><button @click="sideOpen=false" class="lg:hidden text-[#7b8ba8] hover:text-white"><span class="ms text-[20px]">close</span></button></div>
    <nav class="p-3 space-y-1 flex-1">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active===i.id ? 'bg-[#2b7ee0]/[.22] text-white font-bold' : 'text-[#aab6cc] font-semibold hover:bg-white/5'}"><span class="ms ${active===i.id ? 'ms-fill text-[#7db4f5]' : 'text-[#7b8ba8]'} text-[20px]">${i.icon}</span>${i.label}</a>`).join('')}</nav>
    ${user?.role === 'owner' ? `<div class="p-3 border-t border-white/10"><a href="#/doctor/dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#7db4f5] hover:bg-white/5 transition w-full"><span class="ms text-[20px]">stethoscope</span>Lihat sebagai Dokter</a></div>` : ''}
    <div class="p-3 border-t border-white/10"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#7b8ba8] hover:bg-white/5 hover:text-white transition w-full"><span class="ms text-[20px]">logout</span>Keluar</button></div>
  </aside>`;
}

function adminHeader() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const label = user?.role === 'owner' ? 'Owner' : 'Super Admin';
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
    <div class="flex items-center gap-2"><span class="w-8 h-8 rounded-full bg-[#2b7ee0]/20 flex items-center justify-center"><span class="ms text-[18px] text-brand-dark">shield_person</span></span><span class="text-sm font-medium text-ink hidden sm:block">${label}</span></div>
  </header>`;
}
