import { router } from './router.js';
import { store } from './store.js';
import { loginPage, registerPage, forgotPasswordPage, resetPasswordPage } from './pages/auth.js';
import { adminDashboard, adminUsers, adminUsersData, adminServices, adminBookings } from './pages/admin.js';
import { doctorDashboard, doctorPatients, doctorRecords, doctorEMR, doctorEMRNew, doctorEMREdit, doctorPrescriptions, doctorPrescriptionNew, doctorPrescriptionEdit, doctorCalendar } from './pages/doctor.js';
import { patientDashboard, patientHistory, patientPrescriptions, patientServices, patientBooking, patientProfile } from './pages/patient.js';
import { pharmacyDashboard, pharmacyPrescriptions, pharmacyInventory } from './pages/pharmacy.js';
import { notificationsPage } from './pages/notifications.js';

window.__store = store;
window.adminUsersData = adminUsersData;

function render(htmlFn, params) {
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
  const user = getUser();
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  if (publicPaths.some(p => path.startsWith(p))) {
    if (user) {
      const routes = { superadmin: '#/admin/dashboard', doctor: '#/doctor/dashboard', patient: '#/patient/dashboard', pharmacy: '#/pharmacy/dashboard' };
      window.location.hash = routes[user.role] || '#/login';
      return false;
    }
    return true;
  }

  if (!user) {
    window.location.hash = '#/login';
    return false;
  }

  if (path.startsWith('/admin') && user.role !== 'superadmin') { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/doctor') && user.role !== 'doctor') { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/patient') && user.role !== 'patient') { window.location.hash = '#/login'; return false; }
  if (path.startsWith('/pharmacy') && user.role !== 'pharmacy') { window.location.hash = '#/login'; return false; }

  return true;
};

// Auth pages
router.add('/login', () => render(loginPage));
router.add('/register', () => render(registerPage));
router.add('/forgot-password', () => render(forgotPasswordPage));
router.add('/reset-password', () => render(resetPasswordPage));

// Admin
router.add('/admin/dashboard', () => render(adminDashboard));
router.add('/admin/users', () => render(adminUsers));
router.add('/admin/services', () => render(adminServices));
router.add('/admin/bookings', () => render(adminBookings));

// Doctor
router.add('/doctor/dashboard', () => render(doctorDashboard));
router.add('/doctor/patients', () => render(doctorPatients));
router.add('/doctor/records', () => render(doctorRecords));
router.add('/doctor/emr/:patientId', (p) => render(doctorEMR, p));
router.add('/doctor/emr/:patientId/new', (p) => render(doctorEMRNew, p));
router.add('/doctor/prescriptions', () => render(doctorPrescriptions));
router.add('/doctor/prescriptions/new/:recordId', (p) => render(doctorPrescriptionNew, p));
router.add('/doctor/prescriptions/edit/:rxId', (p) => render(doctorPrescriptionEdit, p));
router.add('/doctor/emr/edit/:recordId', (p) => render(doctorEMREdit, p));
router.add('/doctor/calendar', () => render(doctorCalendar));
router.add('/doctor/notifications', () => render(notificationsPage));

// Patient
router.add('/patient/dashboard', () => render(patientDashboard));
router.add('/patient/history', () => render(patientHistory));
router.add('/patient/prescriptions', () => render(patientPrescriptions));
router.add('/patient/services', () => render(patientServices));
router.add('/patient/booking/:serviceId/:itemIdx', (p) => render(patientBooking, p));
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

window.__generateVaxCert = function(patientId, vaccineName) {
  const patient = store.getPatient(patientId);
  const vaccinations = store.getVaccinations(patientId).filter(v => v.vaccine_name === vaccineName);
  if (!patient || vaccinations.length === 0) return;
  const doctor = store.getDoctor(vaccinations[0].administered_by) || store.data.doctors[0];
  const latestDose = vaccinations.filter(v=>v.date_given).sort((a,b)=>b.date_given.localeCompare(a.date_given))[0];
  const latestBrand = latestDose?.vaccine_brand || vaccinations[0]?.vaccine_brand || '';
  const latestDoseNum = latestDose?.dose_number || 1;
  const totalD = vaccinations[0]?.total_doses || 1;
  const isBooster = vaccinations[0]?.vax_mode === 'booster';
  const doseLabel = isBooster ? `Pemberian ke-${vaccinations.filter(v=>v.date_given).length}` : (totalD > 1 ? `DOSIS ${latestDoseNum} dari ${totalD}` : '');
  const certDate = latestDose?.date_given ? new Date(latestDose.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  const certNum = `${String(Math.floor(Math.random()*9000)+1000)}/ ${new Date().toLocaleDateString('id-ID',{month:'short'}).toUpperCase().replace('.','').slice(0,3)} / SKV / KP / ${new Date().getFullYear().toString().slice(2)}`;

  const certId = `CERT-${patientId.slice(-3).toUpperCase()}-${vaccineName.replace(/\s/g,'').slice(0,4).toUpperCase()}-${new Date().getFullYear()}`;

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

  /* Header */
  .header{display:flex;justify-content:space-between;align-items:center;padding-bottom:9mm;border-bottom:1px solid var(--rule)}
  .logo-left img{display:block;height:13mm;width:auto;object-fit:contain}
  .logo-right img{display:block;height:21mm;width:auto;object-fit:contain}
  .logo-right{text-align:right}
  .clinic-line{font-size:9.5px;letter-spacing:.1em;color:var(--muted);margin-top:4px;text-transform:uppercase}

  /* Title block */
  .eyebrow{text-align:center;font-size:12px;font-weight:600;letter-spacing:.2em;color:var(--gold);text-transform:uppercase;margin-top:14mm}
  .title{font-family:'Source Serif 4',serif;font-style:italic;font-weight:600;font-size:44px;color:var(--ink);text-align:center;margin:7px 0 16px;letter-spacing:-.01em}
  .no-surat{text-align:center;font-size:13px;color:#5b5775;margin-bottom:13mm}
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

  /* Signature block - centered, matches traditional cert convention */
  .sign-block{margin:0 auto;width:280px;text-align:center}
  .sign-city{font-size:13.5px;color:#5b5775;margin-bottom:15mm}
  .sign-line{border-top:1px solid #a7a2c9;padding-top:9px}
  .sign-name{font-size:15px;font-weight:700;color:var(--ink);letter-spacing:.01em}
  .sign-sip{font-size:11.5px;color:var(--muted);margin-top:3px}

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
        <div class="logo-right">
          <img src="${window.location.origin}/assets/logos/klinik-prima-logo.png" alt="Klinik Prima">
          <div class="clinic-line">Healthcare Center</div>
        </div>
      </div>

      <div class="eyebrow">Surat Keterangan Resmi</div>
      <div class="title">Sertifikat Vaksinasi</div>
      <div class="no-surat">No. Surat: <b>${certNum}</b></div>

      <div class="given-to">Dengan ini menerangkan bahwa</div>
      <div class="patient-name">${patient.full_name.toUpperCase()}</div>

      <div class="done-text">telah menerima vaksinasi</div>
      <div class="vaccine-title">${vaccineName.toUpperCase()}${latestBrand ? ' &ndash; '+latestBrand.toUpperCase() : ''}</div>
      <div class="dose-badge">${doseLabel}</div>

      <table><thead><tr><th>${isBooster ? 'Ke-' : 'Dosis'}</th><th>Merk Vaksin</th><th>Tanggal</th><th>Batch No.</th><th>Lokasi</th><th>Status</th></tr></thead><tbody>
      ${isBooster ?
        vaccinations.filter(v=>v.date_given).sort((a,b)=>a.date_given.localeCompare(b.date_given)).map((d,i) =>
          `<tr><td>${i+1}</td><td>${d.vaccine_brand||'-'}</td><td>${new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>${d.batch_number||'-'}</td><td>${d.location||'-'}</td><td class="status-done">Selesai</td></tr>`
        ).join('') + (latestDose?.next_dose_date ? `<tr><td>Next</td><td>&mdash;</td><td style="color:var(--pending);font-weight:600">${new Date(latestDose.next_dose_date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>&mdash;</td><td>&mdash;</td><td class="status-pending">Terjadwal</td></tr>` : '')
      : Array.from({length: totalD}, (_, i) => {
        const d = vaccinations.find(v => v.dose_number === i+1);
        return `<tr><td>${i+1}/${totalD}</td><td>${d?.vaccine_brand || '-'}</td><td>${d?.date_given ? new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'}</td><td>${d?.batch_number || '-'}</td><td>${d?.location || '-'}</td><td class="${d?.date_given ? 'status-done' : 'status-pending'}">${d?.date_given ? 'Selesai' : 'Belum'}</td></tr>`;
      }).join('')}
      </tbody></table>

      <div class="spacer"></div>

      <div class="sign-block">
        <div class="sign-city">${certDate}</div>
        <div class="sign-line">
          <div class="sign-name">${(doctor?.full_name || 'Dokter').toUpperCase()}</div>
          <div class="sign-sip">${doctor?.sip_number ? 'SIP: '+doctor.sip_number : ''}</div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-id">ID Dokumen: ${certId}</div>
        <div class="footer-note">Dokumen ini diterbitkan secara digital oleh Klinik Prima melalui platform Primuni.id</div>
      </div>
    </div>
  </div>
  <button class="no-print print-btn" onclick="window.print()">Cetak / Download PDF</button>
  </body></html>`;
  const w = window.open('', '_blank');
  w.document.write(certHtml);
  w.document.close();
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Wait for Alpine to be ready, then start the router
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

  // Load data from Supabase if not in demo mode
  if (!store.data._supabaseLoaded) {
    store.loadFromSupabase().then(() => { store.data._supabaseLoaded = true; }).catch(() => {});
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
