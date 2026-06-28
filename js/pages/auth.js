import { store } from '../store.js';
import { CONFIG } from '../config.js';
import { supabase } from '../supabase.js';

export function loginPage() {
  return `
  <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0f172a 0%, #0d3b66 50%, #0d9488 100%);">
    <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22white%22/></svg>');"></div>
    <div class="relative w-full max-w-md" x-data="{ email: '', password: '', showPass: false, loading: false, error: '',
      fillDemo(e, p) { this.email = e; this.password = p; this.error = ''; },
      async handleLogin() {
        this.loading = true; this.error = '';
        const self = this;
        const demoMode = ${CONFIG.DEMO_MODE};
        if (!demoMode) {
          try {
            const authResult = await fetch('${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password', {
              method: 'POST',
              headers: { 'apikey': '${CONFIG.SUPABASE_ANON_KEY}', 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: self.email, password: self.password })
            }).then(r => r.json());
            if (authResult.error) { self.error = authResult.error_description || 'Email atau password salah.'; self.loading = false; return; }
            sessionStorage.setItem('sb_token', authResult.access_token);
            await window.__store.loadFromSupabase();
            const result = window.__store.login(self.email, self.password);
            if (!result) { self.error = 'Akun tidak ditemukan atau tidak aktif.'; self.loading = false; return; }
            sessionStorage.setItem('medconnect_user', JSON.stringify(result.user));
            sessionStorage.setItem('medconnect_profile', JSON.stringify(result.profile));
            self.loading = false;
            const routes = { superadmin: '#/admin/dashboard', doctor: '#/doctor/dashboard', patient: '#/patient/dashboard', pharmacy: '#/pharmacy/dashboard' };
            window.location.hash = routes[result.user.role] || '#/login';
          } catch(e) { self.error = 'Gagal terhubung ke server. Coba lagi.'; self.loading = false; }
          return;
        }
        setTimeout(function() {
          const result = window.__store.login(self.email, self.password);
          if (!result) { self.error = 'Email atau password salah, atau akun tidak aktif.'; self.loading = false; return; }
          sessionStorage.setItem('medconnect_user', JSON.stringify(result.user));
          sessionStorage.setItem('medconnect_profile', JSON.stringify(result.profile));
          self.loading = false;
          const routes = { superadmin: '#/admin/dashboard', doctor: '#/doctor/dashboard', patient: '#/patient/dashboard', pharmacy: '#/pharmacy/dashboard' };
          window.location.hash = routes[result.user.role] || '#/login';
        }, 400);
      }
    }">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
          <svg class="w-8 h-8 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        </div>
        <h1 class="text-3xl font-bold text-white tracking-tight">MedConnect</h1>
        <p class="text-teal-200/70 mt-1">Platform Kesehatan Digital</p>
      </div>
      <div class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
        <h2 class="text-xl font-semibold text-white mb-6">Masuk ke Akun</h2>
        <div x-show="error" x-cloak class="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-sm" x-text="error"></div>
        <form @submit.prevent="handleLogin">
          <div class="mb-4">
            <label class="block text-teal-100 text-sm font-medium mb-2">Alamat Email</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-teal-300/50"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></span>
              <input type="email" x-model="email" required class="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/50 transition" placeholder="email@contoh.com">
            </div>
          </div>
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-teal-100 text-sm font-medium">Password</label>
              <a href="#/forgot-password" class="text-xs text-teal-300 hover:text-teal-200 transition">Lupa password?</a>
            </div>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-teal-300/50"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></span>
              <input :type="showPass ? 'text' : 'password'" x-model="password" required class="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400/50 transition" placeholder="••••••••">
              <button type="button" @click="showPass = !showPass" class="absolute right-3 top-1/2 -translate-y-1/2 text-teal-300/50 hover:text-teal-200 transition">
                <svg x-show="!showPass" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg x-show="showPass" x-cloak class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </div>
          </div>
          <div class="flex items-center mb-6">
            <input type="checkbox" id="remember" class="w-4 h-4 rounded border-white/30 bg-white/10 text-teal-500 focus:ring-teal-400/50">
            <label for="remember" class="ml-2 text-sm text-teal-100/70">Ingat saya</label>
          </div>
          <button type="submit" :disabled="loading" class="w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50" style="background: linear-gradient(135deg, #0d9488, #0891b2); box-shadow: 0 4px 15px rgba(13,148,136,0.4);">
            <span x-show="!loading" class="text-white">Masuk ke Akun</span>
            <span x-show="loading" x-cloak class="flex items-center justify-center"><svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Memproses...</span>
          </button>
        </form>
        <p class="text-center text-teal-100/50 text-sm mt-6">Belum punya akun? <a href="#/register" class="text-teal-300 hover:text-teal-200 font-medium transition">Daftar sekarang</a></p>
      </div>
      <div class="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <p class="text-teal-200/60 text-xs font-medium mb-2">Demo Accounts:</p>
        <div class="grid grid-cols-2 gap-2 text-xs text-teal-100/50">
          <button @click="fillDemo('superadmin@prima.id','admin12345')" class="text-left hover:text-teal-200 transition p-1 rounded hover:bg-white/5">Admin: superadmin@prima.id</button>
          <button @click="fillDemo('dr.kevin@prima.id','dokter123')" class="text-left hover:text-teal-200 transition p-1 rounded hover:bg-white/5">Dokter: dr.kevin@prima.id</button>
          <button @click="fillDemo('budi@email.com','pasien123')" class="text-left hover:text-teal-200 transition p-1 rounded hover:bg-white/5">Pasien: budi@email.com</button>
          <button @click="fillDemo('apotek@sehatfarma.com','apotek123')" class="text-left hover:text-teal-200 transition p-1 rounded hover:bg-white/5">Apotek: apotek@sehatfarma.com</button>
        </div>
      </div>
    </div>
  </div>`;
}

export function loginFormData() {
  return {};
}

export function registerPage() {
  return `
  <div class="min-h-screen flex items-center justify-center p-4 py-12" style="background: linear-gradient(135deg, #0f172a 0%, #0d3b66 50%, #0d9488 100%);">
    <div class="absolute inset-0 opacity-10" style="background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><circle cx=%2230%22 cy=%2230%22 r=%221%22 fill=%22white%22/></svg>');"></div>
    <div class="relative w-full max-w-lg" x-data="{
      form: { full_name: '', nik: '', birth_date: '', gender: '', phone: '', address: '', blood_type: '', allergies: '', email: '', password: '' },
      confirmPass: '', agreed: false, loading: false, error: '', success: false,
      async handleRegister() {
        this.error = '';
        if (this.form.password !== this.confirmPass) { this.error = 'Password tidak cocok'; return; }
        if (this.form.password.length < 8) { this.error = 'Password minimal 8 karakter'; return; }
        if (this.form.nik.length !== 16) { this.error = 'NIK harus 16 digit'; return; }
        this.loading = true;
        const self = this;
        const demoMode = ${CONFIG.DEMO_MODE};
        if (!demoMode) {
          try {
            const authResult = await fetch('${CONFIG.SUPABASE_URL}/auth/v1/signup', {
              method: 'POST',
              headers: { 'apikey': '${CONFIG.SUPABASE_ANON_KEY}', 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: self.form.email, password: self.form.password })
            }).then(r => r.json());
            if (authResult.error) { self.error = authResult.error.message || authResult.msg || 'Registrasi gagal'; self.loading = false; return; }
            // Create profile + patient in Supabase
            const profileRes = await fetch('${CONFIG.SUPABASE_URL}/rest/v1/profiles', {
              method: 'POST', headers: { 'apikey': '${CONFIG.SUPABASE_ANON_KEY}', 'Authorization': 'Bearer ${CONFIG.SUPABASE_ANON_KEY}', 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
              body: JSON.stringify({ auth_id: authResult.user?.id || null, email: self.form.email, role: 'patient', is_active: true })
            }).then(r => r.json());
            const profileId = profileRes[0]?.id || profileRes?.id;
            if (profileId) {
              await fetch('${CONFIG.SUPABASE_URL}/rest/v1/patients', {
                method: 'POST', headers: { 'apikey': '${CONFIG.SUPABASE_ANON_KEY}', 'Authorization': 'Bearer ${CONFIG.SUPABASE_ANON_KEY}', 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id: profileId, full_name: self.form.full_name, nik: self.form.nik, birth_date: self.form.birth_date, gender: self.form.gender, phone: self.form.phone, address: self.form.address, blood_type: self.form.blood_type, allergies: self.form.allergies || '-' })
              });
            }
            self.loading = false; self.success = true;
          } catch(e) { self.error = 'Gagal terhubung ke server.'; self.loading = false; }
          return;
        }
        setTimeout(function() {
          const result = window.__store.register(self.form);
          if (result.error) { self.error = result.error; self.loading = false; return; }
          self.loading = false; self.success = true;
        }, 400);
      }
    }">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-white tracking-tight">Daftar Akun Pasien</h1>
        <p class="text-teal-200/70 mt-1">Buat akun untuk mengakses layanan kesehatan</p>
      </div>
      <div class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl">
        <div x-show="error" x-cloak class="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200 text-sm" x-text="error"></div>
        <div x-show="success" x-cloak class="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-400/30 text-green-200 text-sm">Registrasi berhasil! Silakan <a href="#/login" class="underline font-medium">login</a>.</div>
        <form @submit.prevent="handleRegister" x-show="!success">
          <p class="text-teal-100 text-xs font-semibold uppercase tracking-wider mb-3 pb-2 border-b border-white/10">Data Pribadi</p>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="col-span-2"><label class="block text-teal-100 text-xs mb-1">Nama Lengkap *</label><input type="text" x-model="form.full_name" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="Nama lengkap sesuai KTP"></div>
            <div><label class="block text-teal-100 text-xs mb-1">NIK (16 digit) *</label><input type="text" x-model="form.nik" maxlength="16" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="16 digit"></div>
            <div><label class="block text-teal-100 text-xs mb-1">Tanggal Lahir *</label><input type="date" x-model="form.birth_date" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition"></div>
            <div><label class="block text-teal-100 text-xs mb-1">Jenis Kelamin *</label><select x-model="form.gender" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition"><option value="" class="text-gray-900">Pilih</option><option value="Laki-laki" class="text-gray-900">Laki-laki</option><option value="Perempuan" class="text-gray-900">Perempuan</option></select></div>
            <div><label class="block text-teal-100 text-xs mb-1">No. Telepon *</label><input type="tel" x-model="form.phone" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="+62"></div>
            <div class="col-span-2"><label class="block text-teal-100 text-xs mb-1">Alamat *</label><textarea x-model="form.address" required rows="2" class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition resize-none" placeholder="Alamat lengkap"></textarea></div>
            <div><label class="block text-teal-100 text-xs mb-1">Golongan Darah</label><select x-model="form.blood_type" class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition"><option value="" class="text-gray-900">Pilih</option><option value="A" class="text-gray-900">A</option><option value="B" class="text-gray-900">B</option><option value="AB" class="text-gray-900">AB</option><option value="O" class="text-gray-900">O</option></select></div>
            <div><label class="block text-teal-100 text-xs mb-1">Riwayat Alergi</label><input type="text" x-model="form.allergies" class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="Jika ada"></div>
          </div>
          <p class="text-teal-100 text-xs font-semibold uppercase tracking-wider mb-3 mt-4 pb-2 border-b border-white/10">Akun</p>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="col-span-2"><label class="block text-teal-100 text-xs mb-1">Email *</label><input type="email" x-model="form.email" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="email@contoh.com"></div>
            <div><label class="block text-teal-100 text-xs mb-1">Password *</label><input type="password" x-model="form.password" required minlength="8" class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="Min 8 karakter"></div>
            <div><label class="block text-teal-100 text-xs mb-1">Konfirmasi Password *</label><input type="password" x-model="confirmPass" required class="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="Ulangi password"></div>
          </div>
          <div class="flex items-start mb-4">
            <input type="checkbox" x-model="agreed" required class="w-4 h-4 mt-0.5 rounded border-white/30 bg-white/10 text-teal-500 focus:ring-teal-400/50">
            <label class="ml-2 text-xs text-teal-100/70">Saya menyetujui <span class="text-teal-300 cursor-pointer">Syarat & Ketentuan</span> serta <span class="text-teal-300 cursor-pointer">Kebijakan Privasi</span></label>
          </div>
          <button type="submit" :disabled="loading" class="w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50" style="background: linear-gradient(135deg, #0d9488, #0891b2); box-shadow: 0 4px 15px rgba(13,148,136,0.4);">
            <span x-show="!loading">Daftar Sekarang</span>
            <span x-show="loading" x-cloak>Memproses...</span>
          </button>
        </form>
        <p class="text-center text-teal-100/50 text-sm mt-4">Sudah punya akun? <a href="#/login" class="text-teal-300 hover:text-teal-200 font-medium transition">Masuk di sini</a></p>
      </div>
    </div>
  </div>`;
}

export function registerFormData() {
  return {};
}

export function forgotPasswordPage() {
  return `
  <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0f172a 0%, #0d3b66 50%, #0d9488 100%);">
    <div class="relative w-full max-w-md" x-data="{ email: '', sent: false }">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-white">Reset Password</h1>
        <p class="text-teal-200/70 mt-1">Masukkan email Anda untuk menerima link reset</p>
      </div>
      <div class="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
        <div x-show="!sent">
          <div class="mb-4">
            <label class="block text-teal-100 text-sm font-medium mb-2">Alamat Email</label>
            <input type="email" x-model="email" required class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition" placeholder="email@contoh.com">
          </div>
          <button @click="fetch('${CONFIG.SUPABASE_URL}/auth/v1/recover', { method:'POST', headers:{'apikey':'${CONFIG.SUPABASE_ANON_KEY}','Content-Type':'application/json'}, body:JSON.stringify({email:email}) }).catch(()=>{}); sent=true" class="w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]" style="background: linear-gradient(135deg, #0d9488, #0891b2); box-shadow: 0 4px 15px rgba(13,148,136,0.4);">Kirim Link Reset</button>
        </div>
        <div x-show="sent" x-cloak class="text-center">
          <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
          <h3 class="text-lg font-semibold text-white mb-2">Permintaan Terkirim</h3>
          <p class="text-teal-100/70 text-sm mb-3">Jika email <span class="text-teal-300" x-text="email"></span> terdaftar, Anda akan menerima link reset. Cek inbox dan folder spam.</p>
          <p class="text-teal-100/50 text-xs">Tidak menerima email? Hubungi admin klinik untuk reset password secara manual.</p>
        </div>
        <p class="text-center text-teal-100/50 text-sm mt-6"><a href="#/login" class="text-teal-300 hover:text-teal-200 font-medium transition">Kembali ke Login</a></p>
      </div>
    </div>
  </div>`;
}
