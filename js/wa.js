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

// ---------------------------------------------------------------------------
// PESAN "OBAT SIAP" UNTUK SEBUAH E-RESEP.
//
// Bunyinya mengikuti CARA SERAHNYA, karena yang diminta dari penerimanya
// memang berbeda: yang mengambil sendiri perlu tahu ke mana datang, sedangkan
// yang dikirim perlu STANDBY HP atau memastikan ada orang di rumah — kurir
// yang sampai ke rumah kosong berarti obatnya pulang lagi. Pesan yang salah
// arah membuat orang menunggu di tempat yang keliru.
//
// Ditulis di sini, bukan di dalam x-data halaman apotek: pesannya memuat
// baris baru, dan satu baris baru di dalam atribut x-data memutus string
// JS-nya sehingga Alpine mati untuk seluruh halaman.
// ---------------------------------------------------------------------------
export function waPesanObatSiap(o) {
  const d = o || {};
  const pasien = String(d.patientName || '').trim() || 'Bapak/Ibu';
  const apotek = String(d.pharmacyName || '').trim() || CLINIC;
  const nomor = String(d.rxNumber || '').trim();
  const dikirim = d.deliveryMethod === 'delivery';
  const alamat = String(d.deliveryAddress || '').trim();
  const jasa = Number(d.serviceFee || 0) > 0 ? Number(d.serviceFee) : 0;

  const baris = [];
  // Kalau yang dihubungi keluarga/wali, pasiennya disebut sebagai orang
  // ketiga — menyapa wali dengan nama pasien membuat pesannya salah alamat.
  baris.push(d.toFamily
    ? `Halo, ini dari ${apotek}.`
    : `Halo, Bapak/Ibu ${pasien}.`);
  baris.push('');
  const milik = d.toFamily ? ` atas nama ${pasien}` : '';
  if (dikirim) {
    baris.push(`Obat dari resep ${nomor}${milik} sudah siap dan akan segera kami *kirim* (Maxim).`);
    if (alamat) { baris.push(''); baris.push(`Alamat kirim:`); baris.push(alamat); }
    baris.push('');
    baris.push('Mohon *standby HP*, atau pastikan ada orang di rumah yang bisa menerima ya. Kurir akan menghubungi saat sampai.');
  } else {
    baris.push(`Obat dari resep ${nomor}${milik} sudah *siap diambil* di ${apotek}.`);
    baris.push('');
    baris.push('Mohon datang pada jam buka apotek dengan membawa identitas.');
  }
  if (jasa > 0) {
    baris.push('');
    baris.push(`Mohon disiapkan jasa dokter Rp${jasa.toLocaleString('id-ID')}${dikirim ? ' untuk dibayarkan ke kurir.' : '.'}`);
  }
  baris.push('');
  baris.push(`Terima kasih.\n— ${apotek}`);
  return baris.join('\n');
}

// Encode a message for safe transport through an inline onclick / Alpine handler
// (used by the "isi No. HP dulu" flow when a patient has no phone yet).
export function waMsgB64(message) {
  try { return btoa(encodeURIComponent(message || '')); } catch (e) { return ''; }
}

const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5"><path d="M12 2a9.9 9.9 0 00-8.5 15L2.2 21.7l4.8-1.3A9.9 9.9 0 1012 2zm0 18.1a8.2 8.2 0 01-4.2-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.1zm4.6-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-.7-.3-1.4-.6-2-1.4-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.4c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4 0-.7.3-.2.2-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>';

// Ready-to-use green WhatsApp button.
// opts.logTable + opts.logId → record a "reminder sent" tick on click.
// opts.patientId → when there's no phone yet, show a button that prompts for the
//   number, saves it to the patient, then opens WhatsApp (instead of hiding).
export function waButton(phone, message, label = 'WA', opts = {}) {
  const href = waHref(phone, message);
  if (href) {
    const onclick = (opts.logTable && opts.logId) ? ` onclick="window.__logWaReminder&&window.__logWaReminder('${opts.logTable}','${opts.logId}')"` : '';
    return `<a href="${href}" target="_blank" rel="noopener"${onclick} @click.stop class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#25D366] hover:brightness-95 transition" title="Kirim pengingat via WhatsApp">${WA_ICON}${label}</a>`;
  }
  // No phone number yet — but if we know the patient, offer to add it inline.
  if (opts.patientId) {
    let msgB64 = '';
    try { msgB64 = btoa(encodeURIComponent(message || '')); } catch (e) { msgB64 = ''; }
    const log = (opts.logTable && opts.logId) ? `,'${opts.logTable}','${opts.logId}'` : '';
    return `<button type="button" @click.stop onclick="window.__waAddPhone&&window.__waAddPhone('${opts.patientId}','${msgB64}'${log})" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#25D366]/70 hover:bg-[#25D366] transition" title="Nomor HP belum ada — klik untuk isi & kirim WhatsApp">${WA_ICON}${label}</button>`;
  }
  return '';
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

// General follow-up / greeting when there's no specific appointment attached
// (patient list & patient detail). Staff can edit before sending.
export function waSapaMsg(name) {
  return `Halo ${name || 'Bapak/Ibu'},\n\nSaya dari ${CLINIC}, ingin menindaklanjuti kondisi kesehatan Anda.\n\nBagaimana kabarnya? Bila ada keluhan atau perlu jadwal kontrol, silakan balas pesan ini ya. Terima kasih. 🙏`;
}

// First-touch outreach to a prospect/lead in the CRM pipeline.
export function waProspekMsg(name, interest) {
  return `Halo ${name || 'Kak'}, terima kasih sudah menghubungi ${CLINIC}.${interest ? ` Mengenai *${interest}*,` : ''} ada yang bisa kami bantu? Kami siap melayani Anda. 🙏`;
}

// Reminder for a patient scheduled TODAY (today's queue on the dashboard).
export function waHariIniMsg(name, timeLabel, queueNo) {
  return `Halo ${name || 'Bapak/Ibu'},\n\nIni pengingat dari ${CLINIC}. Anda memiliki jadwal *hari ini*${timeLabel ? ` pukul *${timeLabel}*` : ''}${queueNo ? ` (no. antrean ${queueNo})` : ''}.\n\nMohon hadir tepat waktu ya. Terima kasih. 🙏`;
}
