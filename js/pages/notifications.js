import { store } from '../store.js';

function getUser() { return JSON.parse(sessionStorage.getItem('medconnect_user')); }
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + ' menit lalu';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' jam lalu';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + ' hari lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function notificationsPage() {
  const user = getUser();
  const notifications = store.getNotifications(user?.id);
  const unread = notifications.filter(n => !n.is_read).length;
  const rolePrefix = { superadmin: 'admin', doctor: 'doctor', patient: 'patient', pharmacy: 'pharmacy' }[user?.role] || 'patient';
  const backLink = `#/${rolePrefix}/dashboard`;

  const typeIcons = {
    prescription: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    appointment: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    patient: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    system: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  };
  const typeColors = {
    prescription: 'bg-purple-100 text-purple-600',
    appointment: 'bg-blue-100 text-blue-600',
    patient: 'bg-teal-100 text-teal-600',
    system: 'bg-gray-100 text-gray-600',
  };

  return `
  <div x-data="{ notifications: ${JSON.stringify(notifications).replace(/'/g, "\\'")} }" class="min-h-screen bg-gray-50 ${user?.role === 'patient' ? 'pb-20' : ''}">
    <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="${backLink}" class="p-2 rounded-lg hover:bg-gray-100 transition"><svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></a>
        <h1 class="font-bold text-gray-800">Notifikasi</h1>
        ${unread > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">${unread} baru</span>` : ''}
      </div>
      ${unread > 0 ? `<button onclick="window.__store.markAllRead('${user?.id}'); window.location.hash='${backLink.slice(1)}'; setTimeout(()=>window.location.hash='/${rolePrefix}/notifications',100)" class="text-xs text-teal-600 hover:text-teal-700 font-medium">Tandai semua dibaca</button>` : ''}
    </header>
    <main class="p-4 max-w-2xl mx-auto">
      ${notifications.length === 0 ? `
        <div class="text-center py-16">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
          <p class="text-gray-400 text-sm">Belum ada notifikasi</p>
        </div>` :
      `<div class="space-y-2">
        ${notifications.map(n => `
          <div class="bg-white rounded-xl border ${n.is_read ? 'border-gray-100' : 'border-teal-200 bg-teal-50/30'} shadow-sm p-4 transition hover:shadow-md cursor-pointer" onclick="window.__store.markNotificationRead('${n.id}')">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg ${typeColors[n.type] || typeColors.system} flex items-center justify-center flex-shrink-0">${typeIcons[n.type] || typeIcons.system}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold ${n.is_read ? 'text-gray-700' : 'text-gray-900'}">${n.title}</h3>
                  ${!n.is_read ? '<span class="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0"></span>' : ''}
                </div>
                <p class="text-sm ${n.is_read ? 'text-gray-500' : 'text-gray-700'} mt-0.5">${n.message}</p>
                <p class="text-xs text-gray-400 mt-1">${formatTime(n.created_at)}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`}
    </main>
    ${user?.role === 'patient' ? `
    <nav class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-2 py-1 max-w-lg mx-auto">
      <div class="flex justify-around">
        <a href="#/patient/dashboard" class="flex flex-col items-center py-2 px-3 rounded-lg text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg><span class="text-xs mt-0.5 font-medium">Home</span></a>
        <a href="#/patient/history" class="flex flex-col items-center py-2 px-3 rounded-lg text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span class="text-xs mt-0.5 font-medium">Riwayat</span></a>
        <a href="#/patient/prescriptions" class="flex flex-col items-center py-2 px-3 rounded-lg text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><span class="text-xs mt-0.5 font-medium">Resep</span></a>
        <a href="#/patient/profile" class="flex flex-col items-center py-2 px-3 rounded-lg text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg><span class="text-xs mt-0.5 font-medium">Profil</span></a>
      </div>
    </nav>` : ''}
  </div>`;
}
