import { store } from '../store.js';
import { CONFIG } from '../config.js';

const CATEGORY_ICONS = {
  'Vaksinasi': { icon: 'vaccines', bg: 'bg-[#fdeee9]', fg: 'text-[#e8452c]' },
  'Infus': { icon: 'water_drop', bg: 'bg-tint', fg: 'text-brand' },
  'Check-up': { icon: 'science', bg: 'bg-[#f4eefb]', fg: 'text-[#7b52c4]' },
  'HomeCare': { icon: 'home_health', bg: 'bg-[#fff6e6]', fg: 'text-[#e0a112]' },
  'Konsultasi': { icon: 'forum', bg: 'bg-tint', fg: 'text-brand' },
  'Telemedicine': { icon: 'forum', bg: 'bg-tint', fg: 'text-brand' },
};
function iconFor(category) { return CATEGORY_ICONS[category] || { icon: 'medical_services', bg: 'bg-tint', fg: 'text-brand' }; }

function scrollTo(id) {
  return `document.getElementById('${id}').scrollIntoView({behavior:'smooth'})`;
}

export function publicLandingPage() {
  const services = store.getServices().slice(0, 6);
  const doctors = (store.getDoctors() || []).filter(d => d.is_public_listed);
  const promoServices = (store.getPromoServices ? store.getPromoServices() : []);
  const articles = (store.getPublishedArticles ? store.getPublishedArticles() : []);

  return `
  <div x-data="{ mobileNav: false }" class="bg-white text-ink antialiased">

    <!-- NAV -->
    <header class="h-[74px] border-b border-slate-100 flex items-center px-4 md:px-12 gap-6 sticky top-0 bg-white/90 backdrop-blur z-20">
      <a href="#/" class="flex items-center gap-3">
        <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-9 w-auto">
        <span class="hidden sm:block">
          <span class="block text-[15px] font-extrabold leading-tight">${CONFIG.APP_NAME}</span>
          <span class="block text-[11px] text-faint font-semibold">Pontianak</span>
        </span>
      </a>
      <nav class="hidden md:flex flex-1 items-center justify-center gap-8 text-sm font-semibold text-slate-600">
        <a href="#/" class="text-brand font-bold">Beranda</a>
        <a href="#" @click.prevent="${scrollTo('landing-layanan')}">Layanan</a>
        ${doctors.length ? `<a href="#" @click.prevent="${scrollTo('landing-dokter')}">Dokter</a>` : ''}
        ${articles.length ? `<a href="#" @click.prevent="${scrollTo('landing-artikel')}">Artikel</a>` : ''}
        <a href="#" @click.prevent="${scrollTo('landing-kontak')}">Kontak</a>
      </nav>
      <div class="flex-1 md:flex-none"></div>
      <div class="hidden md:flex items-center gap-4">
        <a href="#/login" class="text-sm font-bold text-slate-600">Masuk</a>
        <a href="#/booking-tamu" class="inline-flex items-center gap-2 text-sm font-extrabold text-white bg-gradient-to-br from-[#2b7ee0] to-brand-dark px-5 py-2.5 rounded-xl">
          <span class="ms text-[17px]">calendar_month</span>Booking
        </a>
      </div>
      <button @click="mobileNav = !mobileNav" class="md:hidden p-2 rounded-xl hover:bg-wash"><span class="ms text-[24px] text-ink">menu</span></button>
    </header>
    <div x-show="mobileNav" x-cloak @click.self="mobileNav=false" class="md:hidden border-b border-slate-100 px-4 py-3 flex flex-col gap-3 bg-white text-sm font-semibold text-slate-600">
      <a href="#" @click.prevent="mobileNav=false; ${scrollTo('landing-layanan')}">Layanan</a>
      ${doctors.length ? `<a href="#" @click.prevent="mobileNav=false; ${scrollTo('landing-dokter')}">Dokter</a>` : ''}
      ${articles.length ? `<a href="#" @click.prevent="mobileNav=false; ${scrollTo('landing-artikel')}">Artikel</a>` : ''}
      <a href="#" @click.prevent="mobileNav=false; ${scrollTo('landing-kontak')}">Kontak</a>
      <a href="#/login" class="text-brand font-bold">Masuk</a>
      <a href="#/booking-tamu" class="inline-flex items-center justify-center gap-2 text-sm font-extrabold text-white bg-gradient-to-br from-[#2b7ee0] to-brand-dark px-5 py-2.5 rounded-xl"><span class="ms text-[17px]">calendar_month</span>Booking</a>
    </div>

    <!-- HERO -->
    <section class="grid md:grid-cols-2 gap-12 px-4 md:px-12 py-14 md:py-16 bg-gradient-to-b from-[#f4f8fd] to-white items-center">
      <div>
        <span class="inline-flex items-center gap-2 text-[12.5px] font-bold text-brand-dark bg-tint px-4 py-2 rounded-full">
          <span class="w-2 h-2 rounded-full bg-[#1f9d63]"></span>${CONFIG.CLINIC_HOURS}
        </span>
        <h1 class="text-3xl md:text-[52px] leading-[1.1] font-extrabold tracking-tight mt-5">
          Kesehatan keluarga,<br>ditangani dengan <span class="text-brand">penuh kasih.</span>
        </h1>
        <p class="text-[15.5px] md:text-[17px] leading-relaxed text-muted font-medium mt-5 max-w-lg">
          Booking dokter, konsultasi online, dan vaksinasi resmi — semua dari satu aplikasi.
        </p>
        <div class="flex flex-wrap gap-3.5 mt-7">
          <a href="#/booking-tamu" class="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-white bg-gradient-to-br from-[#2b7ee0] to-brand-dark px-7 py-4 rounded-2xl shadow-lg shadow-brand-dark/40">
            <span class="ms text-[20px]">calendar_month</span>Buat Janji Temu
          </a>
          <a href="https://wa.me/${CONFIG.CLINIC_WHATSAPP}" target="_blank" class="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-brand-dark bg-white border-[1.5px] border-slate-200 px-7 py-4 rounded-2xl">
            <span class="ms text-[20px]">forum</span>Konsultasi Chat
          </a>
        </div>
      </div>
      <div class="relative hidden md:block">
        <div class="h-[420px] rounded-3xl bg-[repeating-linear-gradient(135deg,#e3ecf7,#e3ecf7_12px,#eaf1fa_12px,#eaf1fa_24px)] flex items-center justify-center">
          <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-20 w-auto opacity-70">
        </div>
      </div>
    </section>

    ${promoServices.length ? `
    <!-- PROMO -->
    <section class="px-4 md:px-12 py-10 md:py-12 flex flex-col gap-6">
      ${promoServices.map(s => `
      <div class="rounded-3xl bg-gradient-to-br from-[#2b7ee0] to-brand-dark px-6 md:px-12 py-9 md:py-11 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div class="absolute -right-10 -top-12 w-56 h-56 rounded-full bg-white/[.08]"></div>
        <div class="relative">
          <span class="inline-block text-xs font-bold tracking-wide text-ink bg-[#ffd23f] px-3 py-1.5 rounded-full">PROMO</span>
          <h2 class="text-2xl md:text-[32px] font-extrabold text-white tracking-tight mt-4 leading-tight">${s.name}</h2>
          ${s.description ? `<p class="text-white/75 text-sm font-medium mt-2">${s.description.slice(0, 90)}</p>` : ''}
          <div class="flex items-baseline gap-3.5 mt-4">
            ${s.promo_original_price ? `<span class="text-lg text-white/60 line-through font-semibold">Rp${Number(s.promo_original_price).toLocaleString('id-ID')}</span>` : ''}
            <span class="text-3xl md:text-4xl text-[#ffd23f] font-extrabold">Rp${Number(s.price || 0).toLocaleString('id-ID')}</span>
          </div>
        </div>
        <div class="relative text-center shrink-0">
          <a href="#/booking-tamu/${s.id}" class="inline-flex items-center gap-2.5 text-base font-extrabold text-brand-dark bg-white px-8 py-4 rounded-2xl shadow-xl">Daftar<span class="ms text-[20px]">arrow_forward</span></a>
        </div>
      </div>`).join('')}
    </section>` : ''}

    <!-- LAYANAN -->
    <section id="landing-layanan" class="px-4 md:px-12 py-14 md:py-16">
      <div class="flex items-end justify-between mb-8">
        <div>
          <div class="text-[13px] font-extrabold text-brand tracking-wide uppercase">Layanan Kami</div>
          <h2 class="text-2xl md:text-[34px] font-extrabold tracking-tight mt-1.5">Perawatan lengkap untuk keluarga</h2>
        </div>
      </div>
      ${services.length === 0 ? '<p class="text-sm text-faint">Layanan akan segera tersedia.</p>' : `
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${services.map(s => { const ic = iconFor(s.category); return `
        <a href="#/booking-tamu/${s.id}" class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition block">
          <div class="w-14 h-14 rounded-2xl ${ic.bg} flex items-center justify-center"><span class="ms text-[28px] ${ic.fg}">${ic.icon}</span></div>
          <div class="text-lg font-extrabold mt-4">${s.name}</div>
          <p class="text-[13.5px] text-muted leading-relaxed mt-2">${(s.description || '').slice(0, 110)}</p>
          <div class="text-[13px] font-bold text-brand mt-3 inline-flex items-center gap-1">Buat janji temu<span class="ms text-[16px]">arrow_forward</span></div>
        </a>`; }).join('')}
      </div>`}
    </section>

    ${doctors.length ? `
    <!-- DOKTER -->
    <section id="landing-dokter" class="px-4 md:px-12 py-14 md:py-16 bg-wash">
      <div class="text-center mb-9">
        <div class="text-[13px] font-extrabold text-brand tracking-wide uppercase">Tim Dokter</div>
        <h2 class="text-2xl md:text-[34px] font-extrabold tracking-tight mt-1.5">Ditangani tenaga medis tepercaya</h2>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-5">
        ${doctors.map(d => `
        <div class="bg-white border border-slate-100 rounded-3xl p-5 text-center shadow-sm">
          <div class="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto bg-tint flex items-center justify-center"><span class="ms text-[32px] text-brand">person</span></div>
          <div class="text-base font-extrabold mt-4">${d.full_name}</div>
          <div class="text-[12.5px] text-faint font-semibold">${d.specialization || '-'}</div>
          ${d.is_available ? `<span class="inline-flex items-center gap-1.5 mt-2.5 bg-[#e9f7f1] px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-[#1f9d63]"></span><span class="text-[11px] font-bold text-[#177a4d]">Online</span></span>`
          : `<span class="inline-flex items-center gap-1.5 mt-2.5 bg-slate-100 px-2.5 py-1 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span><span class="text-[11px] font-bold text-faint">Offline</span></span>`}
        </div>`).join('')}
      </div>
    </section>` : ''}

    ${articles.length ? `
    <!-- ARTIKEL -->
    <section id="landing-artikel" class="px-4 md:px-12 py-14 md:py-16 bg-wash">
      <div class="flex items-end justify-between mb-8">
        <div>
          <div class="text-[13px] font-extrabold text-brand tracking-wide uppercase">Artikel Kesehatan</div>
          <h2 class="text-2xl md:text-[34px] font-extrabold tracking-tight mt-1.5">Tips &amp; edukasi dari tim kami</h2>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${articles.map(a => `
        <a href="#/artikel/${a.id}" class="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition">
          <img src="${a.image_url || 'https://placehold.co/400x250/1b6fd6/white?text=Artikel'}" alt="${a.title}" class="w-full h-44 object-cover">
          <div class="p-5">
            ${a.category ? `<span class="text-[11px] font-bold text-brand bg-tint px-2.5 py-1 rounded-full">${a.category}</span>` : ''}
            <div class="text-[17px] font-extrabold mt-3 leading-snug">${a.title}</div>
            ${a.excerpt ? `<p class="text-[13px] text-muted mt-2 leading-relaxed">${a.excerpt.slice(0, 90)}</p>` : ''}
          </div>
        </a>`).join('')}
      </div>
    </section>` : ''}

    <!-- LOKASI & KONTAK -->
    <section id="landing-kontak" class="px-4 md:px-12 py-14 md:py-16">
      <div class="grid lg:grid-cols-[1.1fr_1fr] gap-7 bg-[#f4f8fd] rounded-3xl p-6 md:p-10">
        <div>
          <div class="text-[13px] font-extrabold text-brand tracking-wide uppercase">Lokasi &amp; Kontak</div>
          <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-1.5">Kunjungi kami di Pontianak</h2>
          <div class="flex flex-col gap-4 mt-7">
            <div class="flex gap-3.5"><span class="w-11 h-11 rounded-xl bg-tint flex items-center justify-center shrink-0"><span class="ms text-[22px] text-brand">location_on</span></span><div><div class="text-sm font-extrabold">Alamat</div><div class="text-[13.5px] text-muted font-medium">${CONFIG.CLINIC_ADDRESS}</div></div></div>
            <div class="flex gap-3.5"><span class="w-11 h-11 rounded-xl bg-[#e9f7f1] flex items-center justify-center shrink-0"><span class="ms text-[22px] text-[#1f9d63]">chat</span></span><div><div class="text-sm font-extrabold">WhatsApp</div><div class="text-[13.5px] text-muted font-medium">${CONFIG.CLINIC_WHATSAPP_DISPLAY}</div></div></div>
            <div class="flex gap-3.5"><span class="w-11 h-11 rounded-xl bg-[#fff6e6] flex items-center justify-center shrink-0"><span class="ms text-[22px] text-[#e0a112]">schedule</span></span><div><div class="text-sm font-extrabold">Jam Buka</div><div class="text-[13.5px] text-muted font-medium">${CONFIG.CLINIC_HOURS}</div></div></div>
          </div>
          <a href="https://wa.me/${CONFIG.CLINIC_WHATSAPP}" target="_blank" class="inline-flex items-center gap-2.5 text-[15px] font-extrabold text-white bg-[#25d366] px-6 py-3.5 rounded-xl mt-7"><span class="ms text-[20px]">chat</span>Chat via WhatsApp</a>
        </div>
        <div class="rounded-2xl bg-[repeating-linear-gradient(135deg,#e0e9f5,#e0e9f5_14px,#e8eff8_14px,#e8eff8_28px)] min-h-[240px] lg:min-h-[320px] flex items-center justify-center relative">
          <span class="ms text-[44px] text-[#e8452c]">location_on</span>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="bg-[#0d1b30] px-4 md:px-12 py-10">
      <div class="flex items-center gap-3">
        <img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-9 w-auto">
        <div class="text-sm font-extrabold text-white leading-tight">${CONFIG.APP_NAME}</div>
      </div>
      <p class="text-[13px] text-slate-400 leading-relaxed mt-4 max-w-sm">Pelayanan kesehatan keluarga yang modern, ramah, dan tepercaya di Pontianak.</p>
    </footer>
    <div class="bg-[#0a1526] py-4 px-6 md:px-12 text-xs text-[#5f7291] text-center">© ${new Date().getFullYear()} ${CONFIG.APP_NAME} · Pontianak</div>
  </div>`;
}

export function publicGuestBooking(params) {
  const services = store.getServices();
  const preselect = services.find(s => s.id === params?.serviceId);
  window.__guestBookingServices = services.map(s => ({ id: s.id, name: s.name, price: s.price || 0 }));

  return `
  <div x-data="{
    sideOpen: false,
    serviceId: '${preselect?.id || ''}',
    full_name: '', phone: '', preferred_date: '', preferred_time: 'Pagi (08:00-12:00)', notes: '',
    submitting: false, submitted: false,
    services: window.__guestBookingServices || [],
    get selectedService() { return this.services.find(s => s.id === this.serviceId); },
    submit() {
      if (!this.serviceId) { alert('Pilih layanan terlebih dahulu'); return; }
      if (!this.full_name || !this.phone) { alert('Nama dan nomor telepon wajib diisi'); return; }
      if (!this.preferred_date) { alert('Pilih tanggal yang diinginkan'); return; }
      this.submitting = true;
      const svc = this.selectedService;
      const self = this;
      setTimeout(function() {
        window.__store.createBooking({
          patient_id: null, patient_name: self.full_name, patient_phone: self.phone, is_guest: true,
          service_id: svc.id, service_name: svc.name, item_name: svc.name, price: svc.price,
          preferred_date: self.preferred_date, preferred_time: self.preferred_time, notes: self.notes
        });
        self.submitting = false; self.submitted = true;
      }, 500);
    },
    waLink() {
      return 'https://wa.me/${CONFIG.CLINIC_WHATSAPP}?text=' + encodeURIComponent('Halo ' + '${CONFIG.APP_NAME}' + ', saya ' + this.full_name + ' baru saja mendaftar layanan ' + (this.selectedService?.name || '') + ' pada tanggal ' + this.preferred_date + ' (' + this.preferred_time + '). Terima kasih.');
    }
  }" class="min-h-screen bg-wash">
    <header class="h-[66px] border-b border-slate-100 flex items-center px-4 md:px-12 sticky top-0 bg-white/90 backdrop-blur z-20">
      <a href="#/" class="flex items-center gap-2 text-sm font-bold text-muted"><span class="ms text-[20px]">arrow_back</span>Kembali ke Beranda</a>
    </header>
    <main class="max-w-lg mx-auto p-4 md:p-6 pb-16">
      <div class="bg-tint border border-brand/20 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3">
        <div class="text-[13px] text-brand-dark font-semibold">Sudah jadi pasien MedConnect?</div>
        <a href="#/login" class="text-[13px] font-extrabold text-white bg-brand px-4 py-2 rounded-xl whitespace-nowrap">Masuk / Daftar</a>
      </div>
      <h1 class="text-xl font-extrabold text-ink mb-1">Buat Janji Temu</h1>
      <p class="text-[13.5px] text-muted mb-5">Isi data di bawah ini tanpa perlu membuat akun. Tim kami akan menghubungi Anda untuk konfirmasi jadwal.</p>

      <div x-show="!submitted" class="bg-white border border-slate-100 rounded-3xl p-5 space-y-3.5">
        <div><label class="block text-xs text-muted font-semibold mb-1">Pilih Layanan *</label>
          <select x-model="serviceId" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
            <option value="">Pilih layanan</option>
            ${services.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div><label class="block text-xs text-muted font-semibold mb-1">Nama Lengkap *</label><input type="text" x-model="full_name" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" placeholder="Nama Anda"></div>
        <div><label class="block text-xs text-muted font-semibold mb-1">Nomor WhatsApp *</label><input type="tel" x-model="phone" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" placeholder="08xxxxxxxxxx"></div>
        <div><label class="block text-xs text-muted font-semibold mb-1">Tanggal yang Diinginkan *</label><input type="date" x-model="preferred_date" :min="new Date().toISOString().split('T')[0]" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"></div>
        <div><label class="block text-xs text-muted font-semibold mb-1">Waktu Preferensi</label>
          <div class="grid grid-cols-2 gap-2">
            ${['Pagi (08:00-12:00)','Siang (12:00-15:00)','Sore (15:00-18:00)','Fleksibel'].map(t => `<button type="button" @click="preferred_time='${t}'" :class="preferred_time==='${t}' ? 'bg-brand text-white border-brand' : 'bg-white text-muted border-slate-200'" class="px-3 py-2 rounded-xl text-xs font-semibold border transition">${t.split(' ')[0]}</button>`).join('')}
          </div>
        </div>
        <div><label class="block text-xs text-muted font-semibold mb-1">Catatan Tambahan</label><textarea x-model="notes" rows="2" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none" placeholder="Opsional: keluhan, permintaan khusus..."></textarea></div>
        <button @click="submit()" :disabled="submitting" class="w-full mt-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 bg-gradient-to-br from-[#2b7ee0] to-brand-dark"><span x-show="!submitting">Daftar Sekarang</span><span x-show="submitting" x-cloak>Memproses...</span></button>
      </div>

      <div x-show="submitted" x-cloak class="bg-white rounded-3xl border border-green-200 shadow-sm p-6 text-center">
        <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><span class="ms text-[32px] text-green-600">check_circle</span></div>
        <h3 class="text-lg font-bold text-ink mb-2">Pendaftaran Berhasil!</h3>
        <p class="text-sm text-muted mb-4">Tim kami akan segera menghubungi Anda via WhatsApp untuk konfirmasi jadwal.</p>
        <a :href="waLink()" target="_blank" class="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition mb-2">
          <span class="ms text-[18px]">chat</span>Konfirmasi via WhatsApp
        </a>
        <a href="#/" class="block w-full py-2.5 rounded-xl text-sm font-medium text-muted border border-slate-200 text-center">Kembali ke Beranda</a>
      </div>
    </main>
  </div>`;
}

export function publicArticleDetail(params) {
  const article = store.getArticle(params.id);
  if (!article || !article.is_published) {
    return `<div class="min-h-screen flex flex-col items-center justify-center bg-wash text-center px-4">
      <p class="text-faint text-sm mb-4">Artikel tidak ditemukan.</p>
      <a href="#/" class="text-brand font-bold text-sm">&larr; Kembali ke Beranda</a>
    </div>`;
  }
  const date = article.created_at ? new Date(article.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return `
  <div class="bg-white text-ink antialiased min-h-screen">
    <header class="h-[66px] border-b border-slate-100 flex items-center px-4 md:px-12 sticky top-0 bg-white/90 backdrop-blur z-20">
      <a href="#/" class="flex items-center gap-2 text-sm font-bold text-muted"><span class="ms text-[20px]">arrow_back</span>Kembali ke Beranda</a>
    </header>
    <article class="max-w-2xl mx-auto px-4 md:px-0 py-10">
      ${article.category ? `<span class="text-[11px] font-bold text-brand bg-tint px-2.5 py-1 rounded-full">${article.category}</span>` : ''}
      <h1 class="text-2xl md:text-[34px] font-extrabold tracking-tight mt-3 leading-tight">${article.title}</h1>
      ${date ? `<div class="text-[12.5px] text-faint font-semibold mt-3">${date}</div>` : ''}
      <img src="${article.image_url || 'https://placehold.co/800x450/1b6fd6/white?text=Artikel'}" alt="${article.title}" class="w-full rounded-3xl mt-6 object-cover max-h-[360px]">
      <div class="text-[15px] text-muted leading-relaxed mt-7 whitespace-pre-wrap">${(article.body || article.excerpt || '').replace(/</g, '&lt;')}</div>
    </article>
  </div>`;
}
