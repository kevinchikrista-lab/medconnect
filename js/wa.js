// Click-to-chat WhatsApp helpers. No gateway/provider needed — builds an
// official https://wa.me/<number>?text=<message> deep link that opens WhatsApp
// (app or web) with a pre-composed reminder, ready for staff to hit send.

const CLINIC = 'Klinik Kasih Anugerah Prima (Prima Klinik)';

// Normalize an Indonesian phone number to international form for wa.me:
// 08123..., 8123..., +62812..., 62812... → 62812...
export function normalizePhoneID(phone) {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

export function waHref(phone, message) {
  const p = normalizePhoneID(phone);
  if (!p) return '';
  return 'https://wa.me/' + p + '?text=' + encodeURIComponent(message || '');
}

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2zm0 18.1a8.2 8.2 0 01-4.2-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.1zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2-1.4-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4 0-.7.3-.2.2-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>';

// Ready-to-use green WhatsApp button (returns '' if there's no phone number).
// opts.logTable + opts.logId → record a "reminder sent" tick on click.
export function waButton(phone, message, label = 'WA', opts = {}) {
  const href = waHref(phone, message);
  if (!href) return '';
  const onclick = (opts.logTable && opts.logId) ? ` onclick="window.__logWaReminder&&window.__logWaReminder('${opts.logTable}','${opts.logId}')"` : '';
  return `<a href="${href}" target="_blank" rel="noopener"${onclick} @click.stop class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition" title="Kirim pengingat via WhatsApp">${WA_ICON}${label}</a>`;
}

// Small "sudah di-WA Nx" badge (server-rendered). Empty when never sent.
export function waSentBadge(count, lastAt) {
  if (!count) return '';
  const when = lastAt ? new Date(lastAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
  return `<span class="inline-flex items-center gap-1 text-[11px] text-gray-400" title="Terakhir diingatkan${when ? ': ' + when : ''}">📤 Sudah di-WA ${count}x</span>`;
}

// Clinic-side status label for a patient's confirmation response.
export function apptResponseBadge(response, proposedDate) {
  if (response === 'confirmed') return `<span class="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">🟢 Hadir dikonfirmasi</span>`;
  if (response === 'reschedule') return `<span class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">🟡 Minta ganti hari${proposedDate ? ': ' + new Date(proposedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}</span>`;
  return `<span class="inline-flex items-center gap-1 text-[11px] text-gray-400">⚪ Belum dikonfirmasi</span>`;
}

// ---- Message templates -----------------------------------------------------
export function waKontrolMsg(name, dateLabel, note, confirmUrl) {
  return `Halo ${name || 'Bapak/Ibu'},\n\nIni pengingat dari ${CLINIC}. Anda dijadwalkan *kontrol ulang* pada *${dateLabel}*.${note ? `\nCatatan: ${note}` : ''}${confirmUrl ? `\n\nMohon konfirmasi kehadiran Anda (atau minta ganti hari) di sini:\n${confirmUrl}` : ''}\n\nTerima kasih. 🙏`;
}

export function waVaksinMsg(name, dateLabel, vaccineName) {
  return `Halo ${name || 'Bapak/Ibu'},\n\nIni pengingat dari ${CLINIC}. Jadwal *vaksinasi${vaccineName ? ' ' + vaccineName : ''}* berikutnya Anda pada *${dateLabel}*.\n\nMohon hadir tepat waktu ya. Terima kasih. 🙏`;
}

export function waBookingMsg(name, serviceName, dateLabel) {
  return `Halo ${name || 'Bapak/Ibu'},\n\nIni pengingat dari ${CLINIC} untuk pendaftaran layanan *${serviceName || ''}*${dateLabel ? ` pada *${dateLabel}*` : ''}.\n\nMohon hadir tepat waktu ya. Terima kasih. 🙏`;
}

// Generic reminder (free-form purpose).
export function waGenericMsg(name, text) {
  return `Halo ${name || 'Bapak/Ibu'},\n\n${text}\n\nSalam, ${CLINIC}. 🙏`;
}
