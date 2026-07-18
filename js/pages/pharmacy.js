import { store } from '../store.js';
import { CONFIG } from '../config.js';

function getPharmacy() {
  const user = JSON.parse(sessionStorage.getItem('medconnect_user'));
  return store.getPharmacyByUserId(user?.id);
}
function getUser() { return JSON.parse(sessionStorage.getItem('medconnect_user')); }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + ' menit lalu';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' jam lalu';
  return Math.floor(hrs / 24) + ' hari lalu';
}

export function pharmacyDashboard() {
  const pharmacy = getPharmacy();
  const user = getUser();
  const prescriptions = store.getPrescriptionsByPharmacy(pharmacy?.id);
  const incoming = prescriptions.filter(rx => rx.status === 'sent');
  const processing = prescriptions.filter(rx => ['received','preparing','delivering'].includes(rx.status));
  const ready = prescriptions.filter(rx => rx.status === 'ready');
  const completed = prescriptions.filter(rx => rx.status === 'completed');
  const inventory = store.getInventory(pharmacy?.id);
  const lowStock = inventory.filter(i => i.stock <= i.min_stock);
  const unread = store.getUnreadCount(user?.id);

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-wash">
    ${pharmacySidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy, unread)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">${pharmacy?.name || 'Apotek'}</h2><p class="text-sm text-gray-500">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-green flex items-center justify-center"><span class="ms text-[22px] text-white">prescriptions</span></div><div><p class="text-2xl font-bold text-ink">${incoming.length}</p><p class="text-xs text-faint">Resep Masuk</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:#e0a112"><span class="ms text-[22px] text-white">pending_actions</span></div><div><p class="text-2xl font-bold text-ink">${processing.length}</p><p class="text-xs text-faint">Sedang Proses</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#22b573,#158a54)"><span class="ms text-[22px] text-white">task_alt</span></div><div><p class="text-2xl font-bold text-ink">${completed.length}</p><p class="text-xs text-faint">Selesai Hari Ini</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background:${lowStock.length > 0 ? '#e8452c' : '#1b6fd6'}"><span class="ms text-[22px] text-white">warning</span></div><div><p class="text-2xl font-bold text-ink">${lowStock.length}</p><p class="text-xs text-faint">Stok Rendah</p></div></div></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl mb-6">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">Resep Masuk (Real-time)</h3><a href="#/pharmacy/prescriptions" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
          <div class="divide-y divide-gray-50">
            ${[...incoming, ...processing, ...ready].length === 0 ? '<p class="p-6 text-center text-gray-400 text-sm">Tidak ada resep aktif</p>' :
            [...incoming, ...processing, ...ready].map(rx => {
              const patient = store.getPatient(rx.patient_id);
              const doctor = store.getDoctor(rx.doctor_id);
              const items = store.getPrescriptionItems(rx.id);
              const statusColors = { sent: 'border-l-red-500 bg-red-50/30', received: 'border-l-indigo-500', preparing: 'border-l-amber-500 bg-amber-50/30', ready: 'border-l-green-500 bg-green-50/30', delivering: 'border-l-blue-500 bg-blue-50/30' };
              const statusDots = { sent: 'bg-red-500', received: 'bg-indigo-500', preparing: 'bg-amber-500', ready: 'bg-green-500', delivering: 'bg-blue-500' };
              const isDelivery = rx.delivery_method === 'delivery';
              return `<div class="p-4 border-l-4 ${statusColors[rx.status] || ''} hover:bg-gray-50 transition">
                <div class="flex items-start justify-between mb-2">
                  <div><div class="flex items-center gap-2 mb-1"><span class="w-2 h-2 rounded-full ${statusDots[rx.status] || 'bg-gray-400'} animate-pulse"></span><span class="font-medium text-sm text-gray-800">${rx.rx_number}</span>${isDelivery ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">🚚 Dikirim</span>` : ''}<span class="text-xs text-gray-400">${timeAgo(rx.created_at)}</span></div><p class="text-sm text-gray-700">Pasien: <span class="font-medium">${patient?.full_name || 'N/A'}</span></p><p class="text-xs text-gray-500">Dokter: ${doctor?.full_name || 'N/A'} | ${items.length} obat</p></div>
                  <div class="flex gap-1 flex-shrink-0">
                    ${rx.status === 'sent' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','preparing'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Terima</button><button onclick="const r=prompt('Alasan penolakan resep ${rx.rx_number}:'); if(r===null)return; if(!r.trim()){alert('Alasan penolakan wajib diisi'); return;} window.__store.updatePrescriptionStatus('${rx.id}','rejected', r.trim()); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">Tolak</button>` : ''}
                    ${rx.status === 'preparing' ? (isDelivery
                      ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','delivering'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition">Kirim Sekarang</button>`
                      : `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','ready'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Siap Diambil</button>`) : ''}
                    ${rx.status === 'ready' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Selesai</button>` : ''}
                    ${rx.status === 'delivering' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Selesai (Diterima)</button>` : ''}
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        ${lowStock.length > 0 ? `
        <div class="bg-white rounded-xl border border-red-200 shadow-sm">
          <div class="p-4 border-b border-red-100 bg-red-50/50"><h3 class="font-semibold text-red-800 text-sm">Peringatan Stok Rendah</h3></div>
          <div class="divide-y divide-gray-50">${lowStock.map(i => `<div class="p-3 flex items-center justify-between"><div><p class="text-sm font-medium text-gray-800">${i.drug_name}</p><p class="text-xs text-gray-500">Min. stok: ${i.min_stock} ${i.unit}</p></div><span class="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Sisa: ${i.stock}</span></div>`).join('')}</div>
        </div>` : ''}
      </main>
    </div>
  </div>`;
}

export function pharmacyPrescriptions() {
  const pharmacy = getPharmacy();
  const prescriptions = store.getPrescriptionsByPharmacy(pharmacy?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, filter: '' }" class="min-h-screen bg-wash">
    ${pharmacySidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Semua E-Resep</h2>
        <div class="flex flex-wrap gap-2 mb-4">
          ${['','sent','preparing','ready','delivering','completed','rejected'].map(s => `<button @click="filter='${s}'" :class="filter==='${s}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">${s ? CONFIG.PRESCRIPTION_STATUS_LABELS[s] : 'Semua'}</button>`).join('')}
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="divide-y divide-gray-50">
            ${prescriptions.map(rx => {
              const patient = store.getPatient(rx.patient_id);
              const doctor = store.getDoctor(rx.doctor_id);
              const items = store.getPrescriptionItems(rx.id);
              const isDelivery = rx.delivery_method === 'delivery';
              return `<template x-if="!filter || filter === '${rx.status}'">
                <div class="p-4 hover:bg-gray-50 transition" x-data="{open:false}">
                  <div class="flex items-center justify-between cursor-pointer" @click="open=!open">
                    <div><p class="font-medium text-sm text-gray-800">${rx.rx_number} — ${patient?.full_name || 'N/A'}${isDelivery ? ` <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 align-middle">🚚 Dikirim</span>` : ''}</p><p class="text-xs text-gray-500">${doctor?.full_name || ''} | ${formatDate(rx.created_at?.split('T')[0])} | ${items.length} obat</p></div>
                    <div class="flex items-center gap-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${{sent:'bg-blue-100 text-blue-700',preparing:'bg-amber-100 text-amber-700',ready:'bg-green-100 text-green-700',delivering:'bg-blue-100 text-blue-700',completed:'bg-green-100 text-green-700',rejected:'bg-red-100 text-red-700',received:'bg-indigo-100 text-indigo-700'}[rx.status] || 'bg-gray-100'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span><svg class="w-4 h-4 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></div>
                  </div>
                  <div x-show="open" x-cloak class="mt-3 text-sm border-t border-gray-100 pt-3 space-y-3">
                    <div class="space-y-2">
                      ${items.map((i, idx) => i.is_compound ? `
                      <div class="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                        <div class="flex items-center gap-2 mb-1.5">
                          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-600 text-white tracking-wide">RACIKAN</span>
                          <span class="font-semibold text-gray-800">${i.drug_name || `R/${idx + 1}`}</span>
                        </div>
                        <p class="text-xs text-gray-500 font-medium mb-0.5">Komposisi:</p>
                        <p class="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-white rounded-lg border border-purple-100 p-2">${(i.compound_details || '-').trim()}</p>
                        <p class="text-xs text-gray-500 mt-2">${i.frequency || ''} ${i.time || ''} — ${i.quantity || '-'} ${i.unit || ''}${i.duration ? ' · ' + i.duration : ''}</p>
                        ${i.instructions ? `<p class="text-xs text-gray-500 italic mt-1">Instruksi: ${i.instructions}</p>` : ''}
                      </div>` : `
                      <div class="rounded-xl border border-gray-100 p-3">
                        <p class="font-semibold text-gray-800">${i.drug_name}${i.dosage ? ' — ' + i.dosage : ''}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${i.frequency || ''} ${i.time || ''} — ${i.quantity || '-'} ${i.unit || ''}${i.duration ? ' · ' + i.duration : ''}</p>
                        ${i.instructions ? `<p class="text-xs text-gray-500 italic mt-1">Instruksi: ${i.instructions}</p>` : ''}
                      </div>`).join('')}
                    </div>
                    ${isDelivery ? `<div class="rounded-xl border border-blue-200 bg-blue-50 p-3"><p class="text-xs font-semibold text-blue-800 mb-1">🚚 Alamat Pengiriman</p><p class="text-sm text-blue-900 whitespace-pre-line leading-relaxed">${(rx.delivery_address || '-').trim()}</p></div>` : ''}
                    ${rx.notes ? `<div class="rounded-xl border border-amber-200 bg-amber-50 p-3"><p class="text-xs font-semibold text-amber-800 mb-1">Catatan untuk Apoteker</p><p class="text-sm text-amber-900 whitespace-pre-line leading-relaxed">${rx.notes.trim()}</p></div>` : ''}
                    ${rx.status === 'rejected' && rx.reject_reason ? `<div class="rounded-xl border border-red-200 bg-red-50 p-3"><p class="text-xs font-semibold text-red-800 mb-1">Alasan Ditolak</p><p class="text-sm text-red-900 whitespace-pre-line leading-relaxed">${rx.reject_reason.trim()}</p></div>` : ''}
                    <div class="flex gap-1 flex-wrap">
                      ${rx.status === 'sent' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','preparing');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Terima</button><button onclick="const r=prompt('Alasan penolakan resep ${rx.rx_number}:'); if(r===null)return; if(!r.trim()){alert('Alasan penolakan wajib diisi'); return;} window.__store.updatePrescriptionStatus('${rx.id}','rejected', r.trim());window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200">Tolak</button>` : ''}
                      ${rx.status === 'preparing' ? (isDelivery
                        ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','delivering');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600">Kirim Sekarang</button>`
                        : `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','ready');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Siap Diambil</button>`) : ''}
                      ${rx.status === 'ready' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600">Selesai</button>` : ''}
                      ${rx.status === 'delivering' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/prescriptions',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600">Selesai (Diterima)</button>` : ''}
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

export function pharmacyInventory() {
  const pharmacy = getPharmacy();
  const inventory = store.getInventory(pharmacy?.id);
  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '' }" class="min-h-screen bg-wash">
    ${pharmacySidebar('inventory')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6"><h2 class="text-xl font-bold text-gray-800">Inventaris Obat</h2>
          <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari obat..."></div>
        </div>
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <div class="overflow-x-auto"><table class="w-full"><thead><tr class="bg-gray-50 border-b border-gray-100"><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Nama Obat</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Stok</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Min. Stok</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Kadaluarsa</th><th class="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th></tr></thead>
          <tbody class="divide-y divide-gray-50">
            ${inventory.map(i => `
            <template x-if="!search || '${i.drug_name.toLowerCase()}'.includes(search.toLowerCase())">
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-sm font-medium text-gray-800">${i.drug_name}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${i.stock} ${i.unit}</td>
                <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${i.min_stock} ${i.unit}</td>
                <td class="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">${formatDate(i.expiry_date)}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${i.stock <= i.min_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${i.stock <= i.min_stock ? 'Rendah' : 'Cukup'}</span></td>
              </tr>
            </template>`).join('')}
          </tbody></table></div>
        </div>
      </main>
    </div>
  </div>`;
}

function pharmacySidebar(active) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', href: '#/pharmacy/dashboard' },
    { id: 'prescriptions', label: 'E-Resep', icon: 'prescriptions', href: '#/pharmacy/prescriptions' },
    { id: 'inventory', label: 'Inventaris', icon: 'inventory_2', href: '#/pharmacy/inventory' },
  ];
  return `
  <aside class="fixed top-0 left-0 h-full w-[236px] bg-white border-r border-slate-100 z-40 transform transition-transform duration-300 flex flex-col" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-100 flex items-center justify-between"><div class="flex items-center gap-2"><img src="assets/logos/klinik-prima-logo.png" alt="Klinik Prima" class="h-7 w-auto"><div><span class="font-extrabold text-[13.5px] leading-none block">Klinik Prima</span><span class="block text-[10.5px] text-faint font-semibold mt-0.5">Apotek Mitra</span></div></div><button @click="sideOpen=false" class="lg:hidden text-faint hover:text-ink"><span class="ms text-[20px]">close</span></button></div>
    <nav class="p-3 space-y-1 flex-1">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition ${active===i.id ? 'bg-[#e9f7f1] text-green font-bold' : 'text-muted font-semibold hover:bg-slate-50'}"><span class="ms ${active===i.id ? 'ms-fill' : ''} text-[20px] ${active===i.id ? 'text-green' : 'text-faint'}">${i.icon}</span>${i.label}</a>`).join('')}</nav>
    <div class="p-3 border-t border-slate-100"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-muted hover:bg-slate-50 hover:text-ink transition w-full"><span class="ms text-[20px] text-faint">logout</span>Keluar</button></div>
  </aside>`;
}

function pharmacyHeader(pharmacy, unread = 0) {
  return `<header class="sticky top-0 z-30 h-[66px] bg-white border-b border-slate-100 px-4 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-xl hover:bg-wash transition"><span class="ms text-[21px] text-muted">menu</span></button>
    <div class="flex items-center gap-3">
      <a href="#/pharmacy/notifications" class="relative w-10 h-10 rounded-xl bg-wash flex items-center justify-center hover:bg-slate-100 transition"><span class="ms text-[21px] text-slate-600">notifications</span>${unread > 0 ? `<span class="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-green border-2 border-white"></span>` : ''}</a>
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-[#e9f7f1] flex items-center justify-center text-xs font-bold text-green">${(pharmacy?.name || 'A').charAt(0)}</div><span class="text-sm font-medium text-ink hidden sm:block">${pharmacy?.name || 'Apotek'}</span></div>
    </div>
  </header>`;
}
