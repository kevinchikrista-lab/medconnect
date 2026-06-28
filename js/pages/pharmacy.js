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
  const processing = prescriptions.filter(rx => ['received','preparing'].includes(rx.status));
  const ready = prescriptions.filter(rx => rx.status === 'ready');
  const completed = prescriptions.filter(rx => rx.status === 'completed');
  const inventory = store.getInventory(pharmacy?.id);
  const lowStock = inventory.filter(i => i.stock <= i.min_stock);
  const unread = store.getUnreadCount(user?.id);

  return `
  <div x-data="{ sideOpen: window.innerWidth > 1024 }" class="min-h-screen bg-gray-50">
    ${pharmacySidebar('dashboard')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy, unread)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">${pharmacy?.name || 'Apotek'}</h2><p class="text-sm text-gray-500">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${incoming.length}</p><p class="text-xs text-gray-500">Resep Masuk</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${processing.length}</p><p class="text-xs text-gray-500">Sedang Proses</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${completed.length}</p><p class="text-xs text-gray-500">Selesai Hari Ini</p></div></div></div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg ${lowStock.length > 0 ? 'bg-red-500' : 'bg-blue-500'} flex items-center justify-center"><svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><p class="text-2xl font-bold text-gray-800">${lowStock.length}</p><p class="text-xs text-gray-500">Stok Rendah</p></div></div></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
          <div class="p-4 border-b border-gray-100 flex justify-between items-center"><h3 class="font-semibold text-gray-800">Resep Masuk (Real-time)</h3><a href="#/pharmacy/prescriptions" class="text-xs text-teal-600 hover:text-teal-700">Lihat Semua</a></div>
          <div class="divide-y divide-gray-50">
            ${[...incoming, ...processing, ...ready].length === 0 ? '<p class="p-6 text-center text-gray-400 text-sm">Tidak ada resep aktif</p>' :
            [...incoming, ...processing, ...ready].map(rx => {
              const patient = store.getPatient(rx.patient_id);
              const doctor = store.getDoctor(rx.doctor_id);
              const items = store.getPrescriptionItems(rx.id);
              const statusColors = { sent: 'border-l-red-500 bg-red-50/30', received: 'border-l-indigo-500', preparing: 'border-l-amber-500 bg-amber-50/30', ready: 'border-l-green-500 bg-green-50/30' };
              const statusDots = { sent: 'bg-red-500', received: 'bg-indigo-500', preparing: 'bg-amber-500', ready: 'bg-green-500' };
              return `<div class="p-4 border-l-4 ${statusColors[rx.status] || ''} hover:bg-gray-50 transition">
                <div class="flex items-start justify-between mb-2">
                  <div><div class="flex items-center gap-2 mb-1"><span class="w-2 h-2 rounded-full ${statusDots[rx.status] || 'bg-gray-400'} animate-pulse"></span><span class="font-medium text-sm text-gray-800">${rx.rx_number}</span><span class="text-xs text-gray-400">${timeAgo(rx.created_at)}</span></div><p class="text-sm text-gray-700">Pasien: <span class="font-medium">${patient?.full_name || 'N/A'}</span></p><p class="text-xs text-gray-500">Dokter: ${doctor?.full_name || 'N/A'} | ${items.length} obat</p></div>
                  <div class="flex gap-1 flex-shrink-0">
                    ${rx.status === 'sent' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','preparing'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Terima</button><button onclick="window.__store.updatePrescriptionStatus('${rx.id}','rejected'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">Tolak</button>` : ''}
                    ${rx.status === 'preparing' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','ready'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 transition">Siap Diambil</button>` : ''}
                    ${rx.status === 'ready' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed'); window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 transition">Selesai</button>` : ''}
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
  <div x-data="{ sideOpen: window.innerWidth > 1024, filter: '' }" class="min-h-screen bg-gray-50">
    ${pharmacySidebar('prescriptions')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Semua E-Resep</h2>
        <div class="flex flex-wrap gap-2 mb-4">
          ${['','sent','preparing','ready','completed','rejected'].map(s => `<button @click="filter='${s}'" :class="filter==='${s}' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'" class="px-3 py-1.5 rounded-lg text-xs font-medium transition">${s ? CONFIG.PRESCRIPTION_STATUS_LABELS[s] : 'Semua'}</button>`).join('')}
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="divide-y divide-gray-50">
            ${prescriptions.map(rx => {
              const patient = store.getPatient(rx.patient_id);
              const doctor = store.getDoctor(rx.doctor_id);
              const items = store.getPrescriptionItems(rx.id);
              return `<template x-if="!filter || filter === '${rx.status}'">
                <div class="p-4 hover:bg-gray-50 transition" x-data="{open:false}">
                  <div class="flex items-center justify-between cursor-pointer" @click="open=!open">
                    <div><p class="font-medium text-sm text-gray-800">${rx.rx_number} — ${patient?.full_name || 'N/A'}</p><p class="text-xs text-gray-500">${doctor?.full_name || ''} | ${formatDate(rx.created_at?.split('T')[0])} | ${items.length} obat</p></div>
                    <div class="flex items-center gap-2"><span class="px-2 py-1 rounded-full text-xs font-medium ${{sent:'bg-blue-100 text-blue-700',preparing:'bg-amber-100 text-amber-700',ready:'bg-green-100 text-green-700',completed:'bg-green-100 text-green-700',rejected:'bg-red-100 text-red-700',received:'bg-indigo-100 text-indigo-700'}[rx.status] || 'bg-gray-100'}">${CONFIG.PRESCRIPTION_STATUS_LABELS[rx.status]}</span><svg class="w-4 h-4 text-gray-400 transition" :class="open && 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></div>
                  </div>
                  <div x-show="open" x-cloak class="mt-3 text-sm border-t border-gray-100 pt-3">
                    <div class="grid lg:grid-cols-2 gap-3">
                      <div>${items.map(i => `<div class="flex gap-2 py-1"><span class="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5"></span><div><p class="text-gray-800">${i.drug_name} ${i.dosage}</p><p class="text-xs text-gray-500">${i.frequency} ${i.time} — ${i.quantity} ${i.unit}</p></div></div>`).join('')}</div>
                      <div>${rx.notes ? `<p class="text-xs text-gray-500 mb-2"><span class="font-semibold">Catatan:</span> ${rx.notes}</p>` : ''}<div class="flex gap-1 flex-wrap">${rx.status === 'sent' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','preparing');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Terima</button>` : ''}${rx.status === 'preparing' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','ready');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600">Siap Diambil</button>` : ''}${rx.status === 'ready' ? `<button onclick="window.__store.updatePrescriptionStatus('${rx.id}','completed');window.location.hash='/pharmacy/dashboard'; setTimeout(()=>window.location.hash='/pharmacy/dashboard',50)" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-teal-600">Selesai</button>` : ''}</div></div>
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
  <div x-data="{ sideOpen: window.innerWidth > 1024, search: '' }" class="min-h-screen bg-gray-50">
    ${pharmacySidebar('inventory')}
    <div class="transition-all duration-300" :class="sideOpen ? 'lg:ml-64' : 'ml-0'">
      ${pharmacyHeader(pharmacy)}
      <main class="p-4 lg:p-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6"><h2 class="text-xl font-bold text-gray-800">Inventaris Obat</h2>
          <div class="relative"><svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg><input type="text" x-model="search" class="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50" placeholder="Cari obat..."></div>
        </div>
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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
    { id: 'dashboard', label: 'Dashboard', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>', href: '#/pharmacy/dashboard' },
    { id: 'prescriptions', label: 'E-Resep', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>', href: '#/pharmacy/prescriptions' },
    { id: 'inventory', label: 'Inventaris', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>', href: '#/pharmacy/inventory' },
  ];
  return `
  <aside class="fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-40 transform transition-transform duration-300" :class="sideOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="p-4 border-b border-slate-700/50 flex items-center justify-between"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#0d9488,#0891b2)"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg></div><div><span class="font-bold text-sm">MedConnect</span><span class="block text-xs text-slate-400">Apotek Mitra</span></div></div><button @click="sideOpen=false" class="lg:hidden text-slate-400 hover:text-white"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
    <nav class="p-3 space-y-1">${items.map(i=>`<a href="${i.href}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active===i.id ? 'bg-teal-600/20 text-teal-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${i.icon}</svg>${i.label}</a>`).join('')}</nav>
    <div class="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700/50"><button onclick="sessionStorage.clear();window.location.hash='/login';window.dispatchEvent(new CustomEvent('auth-changed'))" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition w-full"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>Keluar</button></div>
  </aside>`;
}

function pharmacyHeader(pharmacy, unread = 0) {
  return `<header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
    <button @click="sideOpen=!sideOpen" class="p-2 rounded-lg hover:bg-gray-100 transition"><svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    <div class="flex items-center gap-3">
      <a href="#/pharmacy/notifications" class="relative p-1 hover:bg-gray-100 rounded-lg transition"><svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>${unread > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">${unread}</span>` : ''}</a>
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">${(pharmacy?.name || 'A').charAt(0)}</div><span class="text-sm font-medium text-gray-700 hidden sm:block">${pharmacy?.name || 'Apotek'}</span></div>
    </div>
  </header>`;
}
