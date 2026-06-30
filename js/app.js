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
  const doctor = store.getDoctor(vaccinations[0].administered_by);
  const latestDose = vaccinations.filter(v=>v.date_given).sort((a,b)=>b.date_given.localeCompare(a.date_given))[0];
  const latestBrand = latestDose?.vaccine_brand || vaccinations[0]?.vaccine_brand || '';
  const latestDoseNum = latestDose?.dose_number || 1;
  const totalD = vaccinations[0]?.total_doses || 1;
  const isBooster = vaccinations[0]?.vax_mode === 'booster';
  const doseLabel = isBooster ? `Pemberian ke-${vaccinations.filter(v=>v.date_given).length}` : (totalD > 1 ? `DOSIS ${latestDoseNum} dari ${totalD}` : '');
  const certDate = latestDose?.date_given ? new Date(latestDose.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  const certNum = `${String(Math.floor(Math.random()*9000)+1000)}/ ${new Date().toLocaleDateString('id-ID',{month:'short'}).toUpperCase().replace('.','').slice(0,3)} / SKV / KP / ${new Date().getFullYear().toString().slice(2)}`;

  const certHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sertifikat Vaksinasi - ${patient.full_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#e8eaf0;padding:20px;min-height:100vh;display:flex;flex-direction:column;align-items:center}
  .cert{width:900px;background:#eef0f8;border-radius:0;padding:0;position:relative;overflow:hidden;page-break-inside:avoid}
  .cert-inner{padding:50px 60px 40px;position:relative;z-index:1}
  /* Geometric decorations like the PDF */
  .deco-tl{position:absolute;top:0;left:0;width:120px;height:120px;overflow:hidden;z-index:2}
  .deco-tl::before{content:'';position:absolute;top:-30px;left:-30px;width:140px;height:140px;border-radius:0 0 50% 0;background:linear-gradient(135deg,#f97316,#fb923c)}
  .deco-br{position:absolute;bottom:0;right:0;width:200px;height:200px;overflow:hidden;z-index:0}
  .deco-br::before{content:'';position:absolute;bottom:-20px;right:-20px;width:180px;height:180px;background:linear-gradient(135deg,#7c3aed,#a78bfa);transform:rotate(45deg)}
  .deco-br::after{content:'';position:absolute;bottom:30px;right:60px;width:100px;height:100px;background:linear-gradient(135deg,#c4b5fd,#ddd6fe);transform:rotate(45deg);opacity:0.7}
  .deco-line{position:absolute;bottom:0;right:140px;width:4px;height:160px;background:linear-gradient(to top,#4f46e5,transparent);z-index:0}
  .deco-line2{position:absolute;bottom:0;right:155px;width:4px;height:120px;background:linear-gradient(to top,#7c3aed,transparent);z-index:0}
  /* Header */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
  .logo-left{display:flex;align-items:center}
  .logo-left img{height:48px;width:auto;object-fit:contain}
  .logo-right{display:flex;align-items:center;justify-content:flex-end}
  .logo-right img{height:56px;width:auto;object-fit:contain}
  /* Title */
  .title{font-family:'Playfair Display',serif;font-size:42px;font-weight:700;color:#4f46e5;text-align:center;margin:20px 0 6px;font-style:italic}
  .no-surat{text-align:center;font-size:13px;color:#334155;font-weight:600;margin-bottom:4px}
  .given-to{text-align:center;font-size:13px;color:#64748b;margin:16px 0 4px}
  .patient-name{text-align:center;font-size:34px;font-weight:300;color:#0f172a;letter-spacing:2px;margin:8px 0 20px;font-family:'Inter',sans-serif}
  .done-text{text-align:center;font-size:13px;color:#64748b;margin-bottom:6px}
  .vaccine-title{text-align:center;font-size:20px;font-weight:700;color:#0f172a;font-style:italic;margin-bottom:4px}
  .dose-badge{text-align:center;font-size:15px;color:#4f46e5;font-weight:600;margin-bottom:24px}
  /* Table */
  table{width:100%;border-collapse:collapse;margin:16px 0;position:relative;z-index:1}
  th{background:#4f46e5;color:white;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding:10px 12px;text-align:left}
  th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}
  td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#334155;background:white}
  tr:last-child td{border-bottom:none}
  .status-done{color:#16a34a;font-weight:700}.status-pending{color:#d97706;font-weight:700}
  /* Footer */
  .sign-area{margin-top:30px;text-align:right;padding-right:40px;position:relative;z-index:1}
  .sign-city{font-size:13px;color:#334155;margin-bottom:50px}
  .sign-name{font-size:15px;font-weight:700;color:#0f172a}
  .sign-sip{font-size:10px;color:#64748b}
  .cert-id{position:absolute;bottom:15px;left:60px;font-size:10px;color:#94a3b8;z-index:1}
  /* Print */
  @media print{body{background:white;padding:0}button.no-print{display:none!important}.cert{box-shadow:none}}
  </style></head><body>
  <div class="cert">
    <div class="deco-tl"></div>
    <div class="deco-br"></div>
    <div class="deco-line"></div>
    <div class="deco-line2"></div>
    <div class="cert-inner">
      <div class="header">
        <div class="logo-left"><img src="${window.location.origin}/assets/logos/primuni-logo.png" alt="Primuni.id"></div>
        <div class="logo-right"><img src="${window.location.origin}/assets/logos/klinik-prima-logo.png" alt="Klinik Prima"></div>
      </div>
      <div class="title">Sertifikat Vaksinasi</div>
      <div class="no-surat">No. Surat: ${certNum}</div>
      <div class="given-to">Sertifikat ini diberikan kepada:</div>
      <div class="patient-name">${patient.full_name.toUpperCase()}</div>
      <div class="done-text">Yang telah melaksanakan:</div>
      <div class="vaccine-title">VAKSINASI ${vaccineName.toUpperCase()}${latestBrand ? ' - '+latestBrand.toUpperCase() : ''}</div>
      <div class="dose-badge">${doseLabel.toUpperCase()}</div>
      <table><thead><tr><th>${isBooster ? '#' : 'Dosis'}</th><th>Merk Vaksin</th><th>Tanggal</th><th>Batch No.</th><th>Lokasi</th><th>Status</th></tr></thead><tbody>
      ${isBooster ?
        vaccinations.filter(v=>v.date_given).sort((a,b)=>a.date_given.localeCompare(b.date_given)).map((d,i) =>
          `<tr><td>${i+1}</td><td>${d.vaccine_brand||'-'}</td><td>${new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>${d.batch_number||'-'}</td><td>${d.location||'-'}</td><td class="status-done">Selesai</td></tr>`
        ).join('') + (latestDose?.next_dose_date ? `<tr><td>Next</td><td>-</td><td style="color:#d97706;font-weight:600">${new Date(latestDose.next_dose_date).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</td><td>-</td><td>-</td><td class="status-pending">Terjadwal</td></tr>` : '')
      : Array.from({length: totalD}, (_, i) => {
        const d = vaccinations.find(v => v.dose_number === i+1);
        return `<tr><td>${i+1}/${totalD}</td><td>${d?.vaccine_brand || '-'}</td><td>${d?.date_given ? new Date(d.date_given).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '-'}</td><td>${d?.batch_number || '-'}</td><td>${d?.location || '-'}</td><td class="${d?.date_given ? 'status-done' : 'status-pending'}">${d?.date_given ? 'Selesai' : 'Belum'}</td></tr>`;
      }).join('')}
      </tbody></table>
      <div class="sign-area">
        <div class="sign-city">${certDate}</div>
        <div class="sign-name">${(doctor?.full_name || 'Dokter').toUpperCase()}</div>
        <div class="sign-sip">${doctor?.sip_number || ''}</div>
      </div>
      <div class="cert-id">ID: CERT-${patientId.slice(-3).toUpperCase()}-${vaccineName.replace(/\s/g,'').slice(0,4).toUpperCase()}-${new Date().getFullYear()}</div>
    </div>
  </div>
  <button class="no-print" onclick="window.print()" style="margin-top:20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border:none;padding:14px 40px;border-radius:10px;font-size:14px;cursor:pointer;font-weight:600;font-family:Inter,sans-serif">Cetak / Download PDF</button>
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
