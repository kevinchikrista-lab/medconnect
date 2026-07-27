import { router } from './router.js';
import { store } from './store.js';
import { CONFIG } from './config.js';
import { loginPage, registerPage, forgotPasswordPage, resetPasswordPage } from './pages/auth.js';
import { adminDashboard, adminUsers, adminUsersData, adminServices, adminArticles, adminBookings, adminCalendar, adminConsultations, adminConsultationDetail, adminHomeCareNew, adminHomeCareHistory, adminHomeCareEdit, adminPatients, adminPatientDetail, adminBugs, adminCrm } from './pages/admin.js';
import { doctorDashboard, doctorPatients, doctorRecords, doctorEMR, doctorEMRNew, doctorEMREdit, doctorPrescriptions, doctorPrescriptionNew, doctorPrescriptionEdit, doctorCalendar, doctorHomeCareNew, doctorHomeCareHistory, doctorHomeCareEdit, doctorChatList, doctorChatThread, doctorChatStart, doctorSKDApproval, doctorCrm } from './pages/doctor.js';
import { patientDashboard, patientHistory, patientPrescriptions, patientServices, patientBooking, patientProfile, patientChatList, patientChatThread, patientChatStart } from './pages/patient.js';
import { pharmacyDashboard, pharmacyPrescriptions, pharmacyInventory } from './pages/pharmacy.js';
import { notificationsPage } from './pages/notifications.js';
import { verifyPage } from './pages/verify.js';
import { konfirmasiPage } from './pages/konfirmasi.js';
import { publicLandingPage, publicArticleDetail, publicGuestBooking } from './pages/landing.js';
import { issueSKD, printSKDById, renderSKDInto, SKD_LOADING_DOC } from './skd.js';
import { waHref, waProspekMsg } from './wa.js';

window.__store = store;
window.adminUsersData = adminUsersData;
window.__issueSKD = issueSKD;
window.__generateSKD = issueSKD; // backward-compatible alias
window.__printSKD = printSKDById;
window.__renderSKDInto = renderSKDInto;
window.__skdLoadingDoc = SKD_LOADING_DOC;
window.__logWaReminder = (table, id) => store.logWaReminder(table, id);
window.__rerender = () => { try { router.resolve(); } catch (e) {} };
window.__waHref = waHref;
window.__crmWaMsg = waProspekMsg;

// No phone on file: prompt for the WhatsApp number, save it to the patient, then
// open WhatsApp with the pre-composed message — all from one click. Opens the
// WA tab BEFORE the async save so popup blockers still see the user gesture.
window.__waAddPhone = function (patientId, msgB64, logTable, logId) {
  const patient = store.getPatient(patientId);
  const name = (patient && patient.full_name) || 'pasien';
  let msg = '';
  try { msg = decodeURIComponent(atob(msgB64 || '')); } catch (e) { msg = ''; }
  const input = window.prompt('Nomor WhatsApp ' + name + ' belum ada.\nMasukkan nomor (contoh: 081234567890):', (patient && patient.phone) || '');
  if (input === null) return;              // dibatalkan
  const phone = input.trim();
  if (!phone) return;
  const href = waHref(phone, msg);
  if (!href) { window.__showToast && window.__showToast('Nomor tidak valid', 'Periksa kembali nomor yang dimasukkan.'); return; }
  window.open(href, '_blank');             // buka WA dalam gesture klik (hindari popup blocker)
  store.updatePatientProfile(patientId, { phone });   // simpan (sinkron ke Supabase di latar)
  if (logTable && logId) store.logWaReminder(logTable, logId);
  window.__showToast && window.__showToast('Nomor HP tersimpan', 'Tersimpan untuk ' + name + '. Tombol WA kini aktif.');
  setTimeout(function () { try { router.resolve(); } catch (e) {} }, 300);  // refresh tampilan
};

// "Lapor Bug": a lightweight modal (injected into <body>, works from any page)
// that captures the current page + who's reporting, then sends the report to the
// clinic admin via WhatsApp. Migration-free — no new table needed.
window.__laporBug = function () {
  const page = location.hash || '(beranda)';
  const user = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
  const who = user ? ((user.email || '-') + ' · ' + (user.role || '-')) : 'belum login';
  const old = document.getElementById('__bug_overlay'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = '__bug_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
    + '<div style="font-weight:700;font-size:16px;color:#111827;margin-bottom:4px">🐞 Laporkan Bug / Masalah</div>'
    + '<div style="font-size:12px;color:#6b7280;margin-bottom:12px">Ceritakan masalah yang Anda temukan. Laporan tersimpan di aplikasi dan bisa dilihat Admin/Owner di menu <b>Laporan Bug</b>.</div>'
    + '<textarea id="__bug_text" rows="5" placeholder="Contoh: tombol Simpan pada halaman resep tidak berfungsi..." style="width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:10px;font-size:13px;resize:none;outline:none;box-sizing:border-box"></textarea>'
    + '<div style="font-size:11px;color:#9ca3af;margin-top:6px">Halaman: ' + page + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'
    + '<button id="__bug_cancel" style="padding:9px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;color:#4b5563;cursor:pointer">Batal</button>'
    + '<button id="__bug_send" style="padding:9px 16px;border-radius:9px;border:none;background:#2b7ee0;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Kirim Laporan</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('#__bug_cancel').onclick = close;
  ov.querySelector('#__bug_send').onclick = async () => {
    const ta = ov.querySelector('#__bug_text');
    const btn = ov.querySelector('#__bug_send');
    const txt = (ta.value || '').trim();
    if (!txt) { ta.focus(); return; }
    btn.disabled = true; btn.textContent = 'Mengirim...';
    const res = await store.addBugReport({
      page, description: txt,
      reporter_email: user ? (user.email || '') : '',
      reporter_role: user ? (user.role || '') : '',
      reporter_profile_id: user ? user.id : null,
    });
    if (res && res.error) {
      btn.disabled = false; btn.textContent = 'Kirim Laporan';
      window.__showToast && window.__showToast('Gagal mengirim', res.error);
      return;
    }
    close();
    window.__showToast && window.__showToast('Terima kasih', 'Laporan Anda tersimpan. Admin/Owner dapat melihatnya di menu Laporan Bug.');
  };
  setTimeout(() => { const t = ov.querySelector('#__bug_text'); if (t) t.focus(); }, 50);
};

function render(htmlFn, params) {
  // The hash router has no "unmount" hook, so this is the one chokepoint every
  // page change passes through — clearing any page-level polling interval
  // (chat, bookings, consultations, ...) here means it always stops, no
  // matter how the user navigated away.
  if (window.__pagePollInterval) { clearInterval(window.__pagePollInterval); window.__pagePollInterval = null; }

  // Reset any leftover scroll position (vertical or horizontal) from the
  // previous page — the hash router swaps content in place without a real
  // page load, so the browser otherwise keeps whatever scroll offset was
  // last set, which can land a freshly-rendered page mid-scrolled and make
  // its layout look broken/cut-off on the left or below the fold.
  window.scrollTo(0, 0);

  const container = document.getElementById('app');
  const html = typeof htmlFn === 'function' ? htmlFn(params) : htmlFn;

  if (window.Alpine) {
    try { window.Alpine.destroyTree(container); } catch {}
  }

  container.innerHTML = html;

  if (window.Alpine) {
    requestAnimationFrame(() => {
      window.Alpine.initTree(container);
    });
  }
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('medconnect_user')); } catch { return null; }
}

router.beforeEach = (path, meta) => {
  // Verification page: always accessible to everyone, logged in or not (e.g. someone
  // scanning the QR code on a printed certificate, with no MedConnect account at all).
  if (path.startsWith('/verify')) return true;

  // Public appointment-confirmation page reached from the WhatsApp reminder
  // link — accessible to patients who aren't logged in.
  if (path.startsWith('/konfirmasi')) return true;

  // Article detail pages and guest booking: public, accessible regardless of
  // login state (unlike /login etc. below, a logged-in doctor/patient
  // shouldn't be bounced away from these links back to their dashboard).
  if (path.startsWith('/artikel')) return true;
  if (path.startsWith('/booking-tamu')) return true;

  const user = getUser();

  // Public landing page ('/'): shown to anonymous visitors instead of forcing
  // straight to /login. Kept as its own exact-match check (not folded into
  // publicPaths below) because publicPaths uses startsWith() — '/' would match
  // every route in the app and disable the login gate entirely.
  if (path === '/') {
    if (user) {
      const routes = { superadmin: '#/admin/dashboard', owner: '#/admin/dashboard', doctor: '#/doctor/dashboard', patient: '#/patient/dashboard', pharmacy: '#/pharmacy/dashboard' };
      window.location.hash = routes[user.role] || '#/login';
      return false;
    }
    return true;
  }

  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  if (publicPaths.some(p => path.startsWith(p))) {
    if (user) {
      const routes = { superadmin: '#/admin/dashboard', owner: '#/admin/dashboard', doctor: '#/doctor/dashboard', patient: '#/patient/dashboard', pharmacy: '#/pharmacy/dashboard' };
      window.location.hash = routes[user.role] || '#/login';
      return false;
    }
    return true;
  }

  if (!user) {
    window.location.hash = '#/login';
    return false;
  }

  // 'owner' is a combined SuperAdmin+Dokter account (see store.getProfile) — it
  // passes both guards below so it can switch between the two views without
  // ever logging out.
  if (path.startsWith('/admin') && !['superadmin', 'owner'].includes(user.role)) { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/doctor') && !['doctor', 'owner'].includes(user.role)) { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/patient') && user.role !== 'patient') { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/pharmacy') && user.role !== 'pharmacy') { window.location.hash = '#/login'; return false; }

  return true;
};

// Public landing page
router.add('/', () => render(publicLandingPage));
router.add('/artikel/:id', (p) => render(publicArticleDetail, p));
router.add('/booking-tamu', () => render(publicGuestBooking));
router.add('/booking-tamu/:serviceId', (p) => render(publicGuestBooking, p));

// Auth pages
router.add('/login', () => render(loginPage));
router.add('/register', () => render(registerPage));
router.add('/forgot-password', () => render(forgotPasswordPage));
router.add('/reset-password', () => render(resetPasswordPage));
router.add('/verify/:certId', (p) => render(verifyPage, p));
router.add('/konfirmasi/:apptId', (p) => render(konfirmasiPage, p));

// Admin
router.add('/admin/dashboard', () => render(adminDashboard));
router.add('/admin/users', () => render(adminUsers));
router.add('/admin/patients', () => render(adminPatients));
router.add('/admin/bugs', () => render(adminBugs));
router.add('/admin/crm', () => render(adminCrm));
router.add('/admin/patients/:patientId', (p) => render(adminPatientDetail, p));
router.add('/admin/services', () => render(adminServices));
router.add('/admin/articles', () => render(adminArticles));
router.add('/admin/bookings', () => render(adminBookings));
router.add('/admin/calendar', () => render(adminCalendar));
router.add('/admin/calendar/:year/:month', (p) => render(adminCalendar, p));
router.add('/admin/consultations', () => render(adminConsultations));
router.add('/admin/consultations/:id', (p) => render(adminConsultationDetail, p));
router.add('/admin/homecare/new', () => render(adminHomeCareNew));
router.add('/admin/homecare/history', () => render(adminHomeCareHistory));
router.add('/admin/homecare/edit/:claimId', (p) => render(adminHomeCareEdit, p));

// Doctor
router.add('/doctor/dashboard', () => render(doctorDashboard));
router.add('/doctor/patients', () => render(doctorPatients));
router.add('/doctor/records', () => render(doctorRecords));
router.add('/doctor/skd-approval', () => render(doctorSKDApproval));
router.add('/doctor/crm', () => render(doctorCrm));
router.add('/doctor/emr/:patientId', (p) => render(doctorEMR, p));
router.add('/doctor/emr/:patientId/new', (p) => render(doctorEMRNew, p));
router.add('/doctor/prescriptions', () => render(doctorPrescriptions));
router.add('/doctor/prescriptions/new/:recordId', (p) => render(doctorPrescriptionNew, p));
router.add('/doctor/prescriptions/edit/:rxId', (p) => render(doctorPrescriptionEdit, p));
router.add('/doctor/emr/edit/:recordId', (p) => render(doctorEMREdit, p));
router.add('/doctor/calendar', () => render(doctorCalendar));
router.add('/doctor/calendar/:year/:month', (p) => render(doctorCalendar, p));
router.add('/doctor/homecare/new', () => render(doctorHomeCareNew));
router.add('/doctor/homecare/history', () => render(doctorHomeCareHistory));
router.add('/doctor/homecare/edit/:claimId', (p) => render(doctorHomeCareEdit, p));
router.add('/doctor/chat', () => render(doctorChatList));
router.add('/doctor/chat/start/:patientId', (p) => render(doctorChatStart, p));
router.add('/doctor/chat/:conversationId', (p) => render(doctorChatThread, p));
router.add('/admin/notifications', () => render(notificationsPage));
router.add('/doctor/notifications', () => render(notificationsPage));

// Patient
router.add('/patient/dashboard', () => render(patientDashboard));
router.add('/patient/history', () => render(patientHistory));
router.add('/patient/prescriptions', () => render(patientPrescriptions));
router.add('/patient/services', () => render(patientServices));
router.add('/patient/booking/:serviceId/:itemIdx', (p) => render(patientBooking, p));
router.add('/patient/chat', () => render(patientChatList));
router.add('/patient/chat/start/:doctorId', (p) => render(patientChatStart, p));
router.add('/patient/chat/:conversationId', (p) => render(patientChatThread, p));
router.add('/patient/profile', () => render(patientProfile));
router.add('/patient/notifications', () => render(notificationsPage));

// Pharmacy
router.add('/pharmacy/dashboard', () => render(pharmacyDashboard));
router.add('/pharmacy/prescriptions', () => render(pharmacyPrescriptions));
router.add('/pharmacy/inventory', () => render(pharmacyInventory));
router.add('/pharmacy/notifications', () => render(notificationsPage));

// Alpine.js data registration
document.addEventListener('alpine:init', () => {
  Alpine.data('adminUsersData', adminUsersData);
});

window.addEventListener('auth-changed', () => {
  router.resolve();
});

window.__generateVaxCert = async function(patientId, vaccineName) {
  const patient = store.getPatient(patientId);
  const vaccinations = store.getVaccinations(patientId).filter(v => v.vaccine_name === vaccineName);
  if (!patient || vaccinations.length === 0) return;

  // Open the window synchronously (right on the click) so popup blockers don't intervene,
  // then fill it in once the async cert-number + log lookups resolve.
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Memuat sertifikat...</title></head><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#4338ca;background:#f5f4fb"><p>Menyiapkan sertifikat...</p></body></html>');

  const latestDose = vaccinations.filter(v=>v.date_given).sort((a,b)=>b.date_given.localeCompare(a.date_given))[0];
  const latestBrand = latestDose?.vaccine_brand || vaccinations[0]?.vaccine_brand || '';
  const latestDoseNum = latestDose?.dose_number || 1;
  const totalD = vaccinations[0]?.total_doses || 1;
  const isBooster = vaccinations[0]?.vax_mode === 'booster';
  const doseLabel = isBooster ? `Pemberian ke-${vaccinations.filter(v=>v.date_given).length}` : (totalD > 1 ? `DOSIS ${latestDoseNum} dari ${totalD}` : '');
  const certDate = latestDose?.date_given ? new Date(latestDose.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});

  const doseInfoForLog = vaccinations.filter(v=>v.date_given).map(v => ({ dose: v.dose_number, date: v.date_given, batch: v.batch_number, doctor: (store.getDoctor(v.administered_by)||{}).full_name || '' }));

  // Reuse the same cert number / QR if this patient+vaccine already has one issued
  // (re-downloading doesn't burn a new sequential number); otherwise mint a fresh one.
  let certRecord, certNum;
  try {
    const existing = await store.getCertificateForPatientVaccine(patientId, vaccineName);
    if (existing) {
      certNum = existing.cert_number;
      await store.updateCertificate(existing.id, { dose_info: doseInfoForLog, vaccine_brand: latestBrand });
      certRecord = existing;
    } else {
      const year = new Date().getFullYear();
      const seqNumber = await store.getNextCertNumber(year);
      certNum = `${String(seqNumber).padStart(4,'0')}/SKV/KP/${String(year).slice(2)}`;
      certRecord = await store.logCertificate({
        cert_number: certNum, patient_id: patientId, patient_name: patient.full_name,
        vaccine_name: vaccineName, vaccine_brand: latestBrand, dose_info: doseInfoForLog
      });
    }
  } catch {
    certNum = `0001/SKV/KP/${String(new Date().getFullYear()).slice(2)}`;
    certRecord = { id: 'local-' + Date.now() };
  }

  const verifyUrl = `${window.location.origin}/#/verify/${certRecord.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(verifyUrl)}`;

  const certHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sertifikat Vaksinasi - ${patient.full_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,600;1,500;1,600&display=swap" rel="stylesheet">
  <style>
  :root{
    --ink:#1e1b4b; --ink-soft:#4338ca; --rule:#e4e1f5;
    --paper:#fbfaff; --table-head:#3730a3; --gold:#9a6508;
    --done:#15803d; --pending:#b45309; --muted:#6b6685;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{
    font-family:'Inter',sans-serif;background:#dcdcec;padding:32px 20px;
    min-height:100vh;display:flex;flex-direction:column;align-items:center;
  }

  /* A4 portrait, true to size: 210mm x 297mm. Screen preview scales the same ratio. */
  .cert{
    width:210mm;height:297mm;background:var(--paper);position:relative;
    page-break-inside:avoid;
    border:1px solid #c7c2e8;
    box-shadow:0 1px 3px rgba(30,27,75,.08),0 12px 32px rgba(30,27,75,.12);
    display:flex;flex-direction:column;
  }
  .cert::before{ /* inner hairline frame, classic certificate device */
    content:'';position:absolute;inset:9mm;border:1px solid #d8d4f0;pointer-events:none;
  }

  /* subtle corner motif - quiet wedges, not competing with content */
  .motif{position:absolute;width:120mm;height:120mm;pointer-events:none}
  .motif-bl{left:0;bottom:0;background:linear-gradient(135deg,#fb923c,transparent 72%);clip-path:polygon(0 100%,0 38%,62% 100%);opacity:.14}
  .motif-br{right:0;bottom:0;background:linear-gradient(225deg,#6d61e0,transparent 72%);clip-path:polygon(100% 100%,100% 38%,38% 100%);opacity:.12}

  .cert-inner{
    position:relative;z-index:2;flex:1;
    padding:20mm 24mm 16mm;
    display:flex;flex-direction:column;
  }

  /* Header — logos and title share one band, like the reference certificate */
  .header{display:flex;align-items:center;gap:18px;padding-bottom:11mm;border-bottom:1px solid var(--rule)}
  .logo-left{flex:0 0 auto}
  .logo-left img{display:block;height:15mm;width:auto;object-fit:contain}
  .logo-right{flex:0 0 auto;text-align:right}
  .logo-right img{display:block;height:19mm;width:auto;object-fit:contain;margin-left:auto}
  .clinic-line{font-size:9.5px;letter-spacing:.1em;color:var(--muted);margin-top:4px;text-transform:uppercase}
  .header-title{flex:1;text-align:center;min-width:0}
  .eyebrow{font-size:11px;font-weight:600;letter-spacing:.18em;color:var(--gold);text-transform:uppercase;margin-bottom:4px}
  .title{font-family:'Source Serif 4',serif;font-style:italic;font-weight:600;font-size:30px;color:var(--ink);letter-spacing:-.01em;line-height:1.1}

  .no-surat{text-align:center;font-size:13px;color:#5b5775;margin:9mm 0 13mm}
  .no-surat b{color:var(--ink);font-weight:600}

  .given-to{text-align:center;font-size:14px;color:#5b5775;margin-bottom:11px}
  .patient-name{text-align:center;font-family:'Source Serif 4',serif;font-weight:600;font-size:34px;color:var(--ink);letter-spacing:.01em;padding-bottom:16px;margin:0 60px 13mm;border-bottom:1px solid var(--rule)}

  .done-text{text-align:center;font-size:14px;color:#5b5775;margin-bottom:9px}
  .vaccine-title{text-align:center;font-size:21px;font-weight:700;color:var(--ink)}
  .dose-badge{text-align:center;font-size:12px;font-weight:600;letter-spacing:.08em;color:var(--ink-soft);text-transform:uppercase;margin:8px 0 14mm}

  /* Table */
  table{width:100%;border-collapse:collapse;border:1px solid var(--rule)}
  th{background:var(--table-head);color:#eef0ff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:13px 16px;text-align:left}
  td{padding:13px 16px;border-top:1px solid var(--rule);font-size:13.5px;color:#332f52;background:white}
  tbody tr:nth-child(even) td{background:#f7f6fd}
  .status-done{color:var(--done);font-weight:700}
  .status-pending{color:var(--pending);font-weight:700}

  /* Spacer pushes signature + footer to the bottom of the page, filling it fully */
  .spacer{flex:1;min-height:8mm}

  /* Verification block — QR code + clinic stamp, replaces a single doctor's signature
     since each dose in the table above may have been administered by a different doctor */
  .verify-block{display:flex;align-items:center;gap:16px;padding:14px 18px;background:#f7f6fd;border:1px solid var(--rule);border-radius:10px}
  .verify-qr{flex:0 0 auto;background:white;padding:6px;border-radius:6px;border:1px solid var(--rule)}
  .verify-qr img{display:block;width:76px;height:76px}
  .verify-text{flex:1;min-width:0}
  .verify-title{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:3px}
  .verify-desc{font-size:11px;color:var(--muted);line-height:1.5}
  .stamp{flex:0 0 auto}
  .stamp-ring{
    width:78px;height:78px;border-radius:50%;
    border:2px solid var(--ink-soft);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    transform:rotate(-8deg);opacity:.75;
  }
  .stamp-ring::before{
    content:'';position:absolute;width:66px;height:66px;border-radius:50%;border:1px solid var(--ink-soft);
  }
  .stamp-text-top{font-size:7px;font-weight:800;color:var(--ink-soft);letter-spacing:.04em;margin-top:6px}
  .stamp-star{font-size:11px;color:var(--gold);line-height:1;margin:2px 0}
  .stamp-text-bottom{font-size:6px;font-weight:700;color:var(--ink-soft);letter-spacing:.03em;margin-bottom:6px}

  /* Footer */
  .footer{margin-top:12mm;padding-top:14px;border-top:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center}
  .footer-id{font-size:10.5px;color:var(--muted);letter-spacing:.03em}
  .footer-note{font-size:10.5px;color:var(--muted);text-align:right;max-width:300px;line-height:1.5}

  .print-btn{
    margin-top:22px;background:var(--ink-soft);color:white;border:none;
    padding:13px 36px;border-radius:9px;font-size:14px;cursor:pointer;font-weight:600;
    font-family:Inter,sans-serif;box-shadow:0 4px 14px rgba(67,56,202,.3);
    transition:transform .15s ease-out,box-shadow .15s ease-out;
  }
  .print-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(67,56,202,.36)}

  @media print{
    @page{size:A4 portrait;margin:0}
    html,body{background:white;padding:0}
    .cert{box-shadow:none;border:none;width:210mm;height:297mm}
    .no-print{display:none!important}
  }
  </style></head><body>
  <div class="cert">
    <div class="motif motif-bl"></div>
    <div class="motif motif-br"></div>
    <div class="cert-inner">
      <div class="header">
        <div class="logo-left">
          <img src="${window.location.origin}/assets/logos/primuni-logo.png" alt="Primuni.id">
        </div>
        <div class="header-title">
          <div class="eyebrow">Surat Keterangan Resmi</div>
          <div class="title">Sertifikat Vaksinasi</div>
        </div>
        <div class="logo-right">
          <img src="${window.location.origin}/assets/logos/klinik-prima-logo.png" alt="Klinik Prima">
          <div class="clinic-line">Healthcare Center</div>
        </div>
      </div>

      <div class="no-surat">No. Surat: <b>${certNum}</b></div>

      <div class="given-to">Dengan ini menerangkan bahwa</div>
      <div class="patient-name">${patient.full_name.toUpperCase()}</div>

      <div class="done-text">telah menerima vaksinasi</div>
      <div class="vaccine-title">${vaccineName.toUpperCase()}${latestBrand ? ' &ndash; '+latestBrand.toUpperCase() : ''}</div>
      <div class="dose-badge">${doseLabel}</div>

      <table><thead><tr><th>${isBooster ? 'Ke-' : 'Dosis'}</th><th>Merk Vaksin</th><th>Tanggal</th><th>Batch No.</th><th>Dokter Penyuntik</th><th>Status</th></tr></thead><tbody>
      ${isBooster ?
        vaccinations.filter(v=>v.date_given).sort((a,b)=>a.date_given.localeCompare(b.date_given)).map((d,i) =>
          `<tr><td>${i+1}</td><td>${d.vaccine_brand||'-'}</td><td>${new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>${d.batch_number||'-'}</td><td>${(store.getDoctor(d.administered_by)||{}).full_name || '-'}</td><td class="status-done">Selesai</td></tr>`
        ).join('') + (latestDose?.next_dose_date ? `<tr><td>Next</td><td>&mdash;</td><td style="color:var(--pending);font-weight:600">${new Date(latestDose.next_dose_date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>&mdash;</td><td>&mdash;</td><td class="status-pending">Terjadwal</td></tr>` : '')
      : Array.from({length: totalD}, (_, i) => {
        const d = vaccinations.find(v => v.dose_number === i+1);
        const docName = d ? (store.getDoctor(d.administered_by)||{}).full_name : null;
        return `<tr><td>${i+1}/${totalD}</td><td>${d?.vaccine_brand || '-'}</td><td>${d?.date_given ? new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'}</td><td>${d?.batch_number || '-'}</td><td>${docName || '-'}</td><td class="${d?.date_given ? 'status-done' : 'status-pending'}">${d?.date_given ? 'Selesai' : 'Belum'}</td></tr>`;
      }).join('')}
      </tbody></table>

      <div class="spacer"></div>

      <div class="verify-block">
        <div class="verify-qr"><img src="${qrUrl}" alt="QR Verifikasi" width="76" height="76"></div>
        <div class="verify-text">
          <div class="verify-title">Verifikasi Keaslian Dokumen</div>
          <div class="verify-desc">Pindai kode QR untuk memverifikasi keabsahan sertifikat ini secara online melalui sistem Klinik Prima.</div>
        </div>
        <div class="stamp">
          <div class="stamp-ring">
            <div class="stamp-text-top">KLINIK PRIMA</div>
            <div class="stamp-star">&#9733;</div>
            <div class="stamp-text-bottom">DOKUMEN RESMI</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-id">No. Sertifikat: ${certNum} &nbsp;|&nbsp; Diterbitkan: ${certDate}</div>
        <div class="footer-note">Dokumen ini diterbitkan secara digital oleh Klinik Prima melalui platform Primuni.id</div>
      </div>
    </div>
  </div>
  <button class="no-print print-btn" id="printBtn" onclick="printCertNow()">Cetak / Download PDF</button>
  <script>
    function printCertNow() {
      var btn = document.getElementById('printBtn');
      var imgs = Array.prototype.slice.call(document.images);
      var pending = imgs.filter(function(img){ return !img.complete; });
      if (pending.length === 0) { window.print(); return; }
      btn.textContent = 'Menyiapkan...';
      btn.disabled = true;
      var done = 0;
      pending.forEach(function(img){
        img.addEventListener('load', check);
        img.addEventListener('error', check);
      });
      function check() {
        done++;
        if (done >= pending.length) {
          btn.textContent = 'Cetak / Download PDF';
          btn.disabled = false;
          window.print();
        }
      }
    }
  </script>
  </body></html>`;
  w.document.open();
  w.document.write(certHtml);
  w.document.close();
};

// Skip on localhost/local testing servers — the cache-first service worker
// otherwise serves a stale app.js after every code change, which has been a
// recurring source of confusion when trying out changes locally.
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
if ('serviceWorker' in navigator && !isLocalHost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Wait for Alpine to be ready, then start the router
let hasLoadedFromSupabase = false;
async function startApp() {
  // Check for password recovery token from Supabase email link
  const fullHash = window.location.hash;
  if (fullHash.includes('access_token=') && fullHash.includes('type=recovery')) {
    const params = new URLSearchParams(fullHash.replace('#', '?'));
    const token = params.get('access_token');
    if (token) {
      sessionStorage.setItem('sb_recovery_token', token);
      window.location.hash = '#/reset-password';
    }
  }

  // Load fresh data from Supabase on every app boot (not in demo mode).
  // This used to be guarded by `store.data._supabaseLoaded`, a flag that
  // lives on the same object _save() persists to localStorage — so once it
  // was set true on a given browser, it stayed true forever (surviving
  // reloads and even logging back in on that browser), and that browser
  // would silently keep showing whatever was cached at its very first-ever
  // load instead of syncing anything created elsewhere afterward. Using a
  // plain module-level flag instead means it naturally resets on every page
  // load, the way "did we already fetch this session" was meant to work.
  if (!hasLoadedFromSupabase) {
    hasLoadedFromSupabase = true;
    store.loadFromSupabase().catch(() => {});
  }
  if (window.Alpine) {
    router.init();
  } else {
    document.addEventListener('alpine:initialized', () => router.init());
    // Fallback: poll for Alpine (max 5s)
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (window.Alpine || attempts > 50) {
        clearInterval(check);
        if (!router.currentRoute) router.init();
      }
    }, 100);
  }
}

// ---- Near-real-time notifications (poll + toast + live bell badge) --------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function showToast(title, message) {
  let c = document.getElementById('__toast_container');
  if (!c) {
    c = document.createElement('div');
    c.id = '__toast_container';
    c.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:340px;pointer-events:none';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid #e5e7eb;border-left:4px solid #2b7ee0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:12px 14px;font-family:Inter,system-ui,sans-serif;cursor:pointer;opacity:0;transform:translateX(20px);transition:opacity .3s ease,transform .3s ease';
  t.innerHTML = `<div style="font-weight:700;font-size:13px;color:#111827;margin-bottom:2px">🔔 ${escapeHtml(title)}</div><div style="font-size:12px;color:#4b5563;line-height:1.4">${escapeHtml(message)}</div>`;
  t.onclick = () => t.remove();
  c.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'none'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; setTimeout(() => t.remove(), 320); }, 6000);
}
window.__showToast = showToast;

function updateNotifBadges(count) {
  document.querySelectorAll('[data-notif-count]').forEach(el => {
    el.textContent = count > 99 ? '99+' : String(count);
    el.style.display = count > 0 ? '' : 'none';
  });
}

let __notifSeen = null; // Set of unread ids already shown; null until first poll after login.
async function pollNotifications() {
  const user = getUser();
  if (!user) { __notifSeen = null; return; }
  if (CONFIG.DEMO_MODE) { updateNotifBadges(store.getUnreadCount(user.id)); return; }
  const list = await store.fetchNotifications(user.id);
  const unread = list.filter(n => !n.is_read);
  updateNotifBadges(unread.length);
  if (__notifSeen === null) { __notifSeen = new Set(unread.map(n => n.id)); return; } // seed silently on first run
  unread.forEach(n => { if (!__notifSeen.has(n.id)) { __notifSeen.add(n.id); showToast(n.title, n.message); } });
}
window.addEventListener('auth-changed', () => { __notifSeen = null; pollNotifications(); });
setInterval(pollNotifications, 20000);
setTimeout(pollNotifications, 3000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
