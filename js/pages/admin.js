import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { supabase } from '../supabase.js';
import { homeCareNewPage, homeCareHistoryPage } from './homecare.js';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function adminDashboard() {
  const stats = store.getStats();
  const users = store.getUsers();
  const recentUsers = users.slice(-5).reverse();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-gray-50">
    ${adminSidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Dashboard SuperAdmin</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${stats.totalPatients}</p><p class="text-xs text-gray-500">Total Pasien</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${stats.totalDoctors}</p><p class="text-xs text-gray-500">Dokter Aktif</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${stats.totalPharmacies}</p><p class="text-xs text-gray-500">Apotek Mitra</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${stats.totalRecords}</p><p class="text-xs text-gray-500">Rekam Medis</p></div></div></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">User Terbaru</h3><a href="#/admin/users" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
          <div class="divide-y divide-gray-50">${recentUsers.map(u => {
            const roleLabels = { doctor: 'Dokter', patient: 'Pasien', pharmacy: 'Apotek' };
            const roleColors = { doctor: 'bg-teal-100 text-teal-700', patient: 'bg-blue-100 text-blue-700', pharmacy: 'bg-purple-100 text-purple-700' };
            return `<div class="p-4 flex items-center justify-between hover:bg-gray-50 transition">
              <div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)">${(u.profile?.full_name || u.profile?.name || u.email).charAt(0).toUpperCase()}</div><div><p class="text-sm font-medium text-gray-800">${u.profile?.full_name || u.profile?.name || u.email}</p><p class="text-xs text-gray-500">${u.email}</p></div></div>
              <div class="flex items-center gap-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || 'bg-gray-100'}">${roleLabels[u.role] || u.role}</span><span class="w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}"></span></div>
            </div>`;
          }).join('')}</div>
        </div>
      </main>
    </div>
  </div>`;
}

export function adminUsers() {
  return `
  <div x-data="adminUsersData()" class="min-h-screen bg-gray-50">
    ${adminSidebar('users')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 class="text-xl font-bold text-gray-800">Manajemen User</h2>
          <button @click="showCreate=true" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)">+ Tambah User</button>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button @click="filter=''" :class="!filter ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Semua</button>
          <button @click="filter='doctor'" :class="filter==='doctor' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-sm font-medium transition">Dokter</button>
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
              <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Role *</label><select x-model="newUser.role" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"><option value="">Pilih Role</option><option value="doctor">Dokter</option><option value="patient">Pasien</option><option value="pharmacy">Apotek Mitra</option></select></div>
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1" x-text="newUser.role==='pharmacy' ? 'Nama Apotek *' : 'Nama Lengkap *'"></label><input type="text" x-model="newUser.full_name" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Email *</label><input type="email" x-model="newUser.email" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Password *</label><input type="text" x-model="newUser.password" required class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <div><label class="block text-xs text-gray-600 mb-1">Telepon</label><input type="tel" x-model="newUser.phone" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
                <template x-if="newUser.role==='doctor'"><div><label class="block text-xs text-gray-600 mb-1">SIP</label><input type="text" x-model="newUser.sip_number" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='doctor'"><div><label class="block text-xs text-gray-600 mb-1">Spesialisasi</label><input type="text" x-model="newUser.specialization" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='patient'"><div><label class="block text-xs text-gray-600 mb-1">NIK</label><input type="text" x-model="newUser.nik" maxlength="16" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <template x-if="newUser.role==='pharmacy'"><div><label class="block text-xs text-gray-600 mb-1">No. SIPA</label><input type="text" x-model="newUser.license_no" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div></template>
                <div class="col-span-2"><label class="block text-xs text-gray-600 mb-1">Alamat</label><input type="text" x-model="newUser.address" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
              </div>
              <div class="flex gap-2 justify-end"><button type="button" @click="showCreate=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button type="submit" :disabled="creating" class="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)"><span x-show="!creating">Buat Akun</span><span x-show="creating" x-cloak>Memproses...</span></button></div>
            </form>
          </div>
        </div>
        <!-- Edit Email Modal -->
        <div x-show="editingUser" x-cloak class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="editingUser=null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">Ganti Email</h3>
            <div x-show="editMsg" class="mb-3 p-2 rounded-lg text-sm" :class="editMsg.includes('berhasil')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'" x-text="editMsg"></div>
            <div class="mb-3"><label class="block text-xs text-gray-600 mb-1">Email Baru</label><input type="email" x-model="newEmail" class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"></div>
            <div class="flex gap-2 justify-end"><button @click="editingUser=null" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="saveEmail" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)">Simpan</button></div>
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
              <button @click="doResetPassword()" :disabled="resetting" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)"><span x-show="!resetting">Set Password Baru</span><span x-show="resetting" x-cloak>Memproses...</span></button>
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
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Role</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Email</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Status</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Aksi</th></tr></thead>
          <tbody class="divide-y divide-gray-50">
            <template x-for="user in filteredUsers" :key="user.id">
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium" :class="{'bg-teal-100 text-teal-700': user.role==='doctor', 'bg-blue-100 text-blue-700': user.role==='patient', 'bg-purple-100 text-purple-700': user.role==='pharmacy'}" x-text="user.role==='doctor'?'Dokter':user.role==='patient'?'Pasien':'Apotek'"></span></td>
                <td class="px-4 py-3 text-sm font-medium text-gray-800" x-text="user.profile?.full_name || user.profile?.name || '-'"></td>
                <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell" x-text="user.email"></td>
                <td class="px-4 py-3 hidden md:table-cell"><span class="w-2 h-2 rounded-full inline-block" :class="user.is_active ? 'bg-green-500' : 'bg-red-500'"></span><span class="text-xs ml-1" x-text="user.is_active ? 'Aktif' : 'Nonaktif'"></span></td>
                <td class="px-4 py-3"><div class="flex gap-1">
                  <button @click="editingUser=user; newEmail=user.email; editMsg=''" class="px-2 py-1 rounded text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition">Email</button>
                  <button @click="toggleActive(user.id)" class="px-2 py-1 rounded text-xs font-medium" :class="user.is_active ? 'text-red-700 bg-red-50 hover:bg-red-100' : 'text-green-700 bg-green-50 hover:bg-green-100'" x-text="user.is_active ? 'Nonaktifkan' : 'Aktifkan'"></button>
                  <button @click="resetUser=user; resetNewPass=''; resetMsg=''" class="px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition">Reset Pass</button>
                  <template x-if="user.role==='patient'"><button @click="certUser=user" class="px-2 py-1 rounded text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition">Sertifikat</button></template>
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
    newUser: { role: '', full_name: '', email: '', password: 'default123', phone: '', sip_number: '', specialization: '', nik: '', license_no: '', address: '' },
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
      if (!this.newUser.role || !this.newUser.full_name || !this.newUser.email) { this.createMsg = 'Lengkapi data wajib'; this.creating = false; return; }
      if (!CONFIG.DEMO_MODE) {
        try {
          const authRes = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/signup', {
            method: 'POST', headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.newUser.email, password: this.newUser.password })
          }).then(r => r.json());
          const authId = authRes.user?.id || null;
          if (authRes.error) { this.createMsg = authRes.error.message || authRes.msg || 'Gagal buat auth user'; this.creating = false; return; }
          const profileData = { email: this.newUser.email, role: this.newUser.role, is_active: true };
          if (authId) profileData.auth_id = authId;
          const profileRes = await supabase.insert('profiles', profileData);
          if (profileRes.error) { this.createMsg = profileRes.error; this.creating = false; return; }
          const profileId = profileRes.id;
          if (this.newUser.role === 'doctor') {
            await supabase.insert('doctors', { profile_id: profileId, full_name: this.newUser.full_name, sip_number: this.newUser.sip_number || '', specialization: this.newUser.specialization || '', phone: this.newUser.phone || '', is_available: true });
          } else if (this.newUser.role === 'patient') {
            await supabase.insert('patients', { profile_id: profileId, full_name: this.newUser.full_name, nik: this.newUser.nik || '', phone: this.newUser.phone || '', address: this.newUser.address || '', allergies: '-', emergency_contact: '' });
          } else if (this.newUser.role === 'pharmacy') {
            await supabase.insert('pharmacies', { profile_id: profileId, name: this.newUser.full_name, phone: this.newUser.phone || '', address: this.newUser.address || '', license_no: this.newUser.license_no || '', operating_hours: '' });
          }
          await window.__store.loadFromSupabase();
          this.createMsg = 'User berhasil dibuat! (tersimpan di cloud)';
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
      if (!this.newEmail) { this.editMsg = 'Email tidak boleh kosong'; return; }
      if (!CONFIG.DEMO_MODE) {
        try {
          await supabase.update('profiles', this.editingUser.id, { email: this.newEmail });
          await window.__store.loadFromSupabase();
          this.editMsg = 'Email berhasil diubah! (tersimpan di cloud)';
          this.editingUser.email = this.newEmail;
        } catch(e) { this.editMsg = 'Error: ' + e.message; }
      } else {
        const result = store.updateUserEmail(this.editingUser.id, this.newEmail);
        if (result.error) { this.editMsg = result.error; return; }
        this.editMsg = 'Email berhasil diubah!';
        this.editingUser.email = this.newEmail;
      }
    },
    async toggleActive(userId) {
      store.toggleUserActive(userId);
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
      if (!confirm('Hapus user "' + name + '" (' + user.email + ')?\n\nSemua data terkait (rekam medis, resep, vaksinasi) juga akan terhapus. Tindakan ini TIDAK bisa dibatalkan.')) return;
      if (!confirm('Anda YAKIN ingin menghapus "' + name + '"? Ketik OK untuk konfirmasi.')) return;

      if (!CONFIG.DEMO_MODE) {
        try {
          // Delete from role table
          if (user.role === 'doctor') await supabase.deleteWhere('doctors', { profile_id: user.id });
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
    form: { name:'', description:'', category:'Vaksinasi', price:0, image_url:'https://placehold.co/400x250/0d9488/white?text=Layanan' },
    openNew() { this.editing = null; this.form = { name:'', description:'', category:'Vaksinasi', price:0, image_url:'https://placehold.co/400x250/0d9488/white?text=Layanan' }; this.showForm = true; this.msg = ''; },
    openEdit(s) { this.editing = s.id; this.form = { name:s.name, description:s.description, category:s.category, price:s.price, image_url:s.image_url }; this.showForm = true; this.msg = ''; },
    save() {
      if (!this.form.name) { this.msg = 'Nama layanan wajib diisi'; return; }
      if (this.editing) { window.__store.updateService(this.editing, this.form); this.msg = 'Layanan berhasil diperbarui!'; }
      else { window.__store.createService(this.form); this.msg = 'Layanan berhasil ditambahkan!'; }
      setTimeout(() => { window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); }, 600);
    },
    toggleActive(id) { window.__store.toggleServiceActive(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); },
    remove(id) { if (confirm('Hapus layanan ini?')) { window.__store.deleteService(id); window.location.hash = '/admin/dashboard'; setTimeout(() => window.location.hash = '/admin/services', 50); } }
  }" class="min-h-screen bg-gray-50">
    ${adminSidebar('services')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800">Manajemen Layanan</h2>
          <button @click="openNew()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)">+ Tambah Layanan</button>
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
            </div>
            <div class="flex gap-2 justify-end mt-4"><button @click="showForm=false" class="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200">Batal</button><button @click="save()" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:linear-gradient(135deg,#3A6FC9,#E03B27)">Simpan</button></div>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${services.map(s => `<div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
            <div class="relative"><img src="${s.image_url}" alt="${s.name}" class="w-full h-40 object-cover">
              <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onclick="document.querySelector('[x-data]').__x.$data.openEdit(${JSON.stringify(s).replace(/"/g,'&quot;')})" class="w-8 h-8 rounded-lg bg-white/90 shadow flex items-center justify-center hover:bg-white transition"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
              </div>
            </div>
            <div class="p-4">
              <h4 class="font-semibold text-gray-800">${s.name}</h4>
              <p class="text-xs text-gray-500 mt-1">${(s.description||'').slice(0,80)}...</p>
              <div class="flex items-center justify-between mt-3">
                <span class="text-sm font-bold text-teal-600">Rp ${(s.price||0).toLocaleString('id-ID')}</span>
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

export function adminBookings() {
  const bookings = store.getBookings();
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, filter: '' }" class="min-h-screen bg-gray-50">
    ${adminSidebar('bookings')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${adminHeader()}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Pendaftaran Layanan Masuk</h2>
        <div class="flex gap-2 mb-4">
          ${['','pending','confirmed','completed','cancelled'].map(s => `<button @click="filter='${s}'" :class="filter==='${s}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">${{'' :'Semua', pending:'Menunggu', confirmed:'Dikonfirmasi', completed:'Selesai', cancelled:'Dibatalkan'}[s]}</button>`).join('')}
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          ${bookings.length === 0 ? '<p class="p-8 text-center text-gray-400 text-sm">Belum ada pendaftaran</p>' : `
          <div class="divide-y divide-gray-50">
            ${bookings.map(b => {
              const statusColors = { pending:'bg-amber-100 text-amber-700', confirmed:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', cancelled:'bg-red-100 text-red-700' };
              const statusLabels = { pending:'Menunggu', confirmed:'Dikonfirmasi', completed:'Selesai', cancelled:'Dibatalkan' };
              return `<template x-if="!filter || filter==='${b.status}'">
                <div class="p-4 hover:bg-gray-50 transition">
                  <div class="flex items-center justify-between mb-2">
                    <div><p class="font-medium text-gray-800 text-sm">${b.patient_name || 'Pasien'}</p><p class="text-xs text-gray-500">${b.item_name || b.service_name} — Rp ${(b.price||0).toLocaleString('id-ID')}</p></div>
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100'}">${statusLabels[b.status] || b.status}</span>
                  </div>
                  <div class="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <span>Tanggal: <span class="font-medium text-gray-700">${b.preferred_date || '-'}</span></span>
                    <span>Waktu: <span class="font-medium text-gray-700">${b.preferred_time || '-'}</span></span>
                    ${b.notes ? `<span>Catatan: ${b.notes}</span>` : ''}
                  </div>
                  ${b.status === 'pending' ? `<div class="flex gap-2">
                    <button onclick="window.__store.updateBookingStatus('${b.id}','confirmed'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/bookings',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Konfirmasi</button>
                    <button onclick="window.__store.updateBookingStatus('${b.id}','cancelled'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/bookings',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">Tolak</button>
                  </div>` : ''}
                  ${b.status === 'confirmed' ? `<button onclick="window.__store.updateBookingStatus('${b.id}','completed'); window.location.hash='/admin/dashboard'; setTimeout(()=>window.location.hash='/admin/bookings',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Tandai Selesai</button>` : ''}
                </div>
              </template>`;
            }).join('')}
          </div>`}
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
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>', href: '#/admin/dashboard' },
    { id: 'users', label: 'Manajemen User', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>', href: '#/admin/users' },
    { id: 'services', label: 'Layanan', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>', href: '#/admin/services' },
    { id: 'bookings', label: 'Pendaftaran', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>', href: '#/admin/bookings' },
    { id: 'homecare', label: 'BMHP & Jasa', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/>', href: '#/admin/homecare/history' },
  ];
  return `
  <aside class="fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-40 transform transition-transform duration-300" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-700/50 flex items-center justify-between"><div class="flex items-center gap-2"><div class="bg-white rounded-lg px-1.5 py-1"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-6 w-auto"></div><div><span class="font-bold text-sm">Klinik Prima</span><span class="block text-xs text-slate-400">SuperAdmin</span></div></div><button @click="sideOpen=false" class="lg:hidden text-slate-400 hover:text-white"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <nav class="p-3 space-y-1">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active===i.id ? 'bg-teal-600/20 text-teal-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${i.icon}</svg>${i.label}</a>`).join('')}</nav>
    <div class="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700/50"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition w-full"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Keluar</button></div>
  </aside>`;
}

function adminHeader() {
  return `<header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-lg hover:bg-gray-100 transition"><svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">SA</div><span class="text-sm font-medium text-gray-700 hidden sm:block">Super Admin</span></div>
  </header>`;
}
