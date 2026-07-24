import { store } from './store.js';

// Surat Keterangan Dokter (SKD) — Sehat & Sakit.
// Same anti-duplication model as the vaccination certificate: mint a unique
// sequential number, log the letter to Supabase, and stamp a QR that points at
// the public /verify page so a scanner always sees the real server-side data.
//
// Hybrid approval: a doctor issuing from their own view creates an 'approved'
// letter (they ARE the signer). An admin drafting on a doctor's behalf creates
// a 'pending' letter that the chosen doctor must ACC before it's valid — until
// then it prints with a DRAFT watermark and its QR verifies as "belum disahkan".

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

function pad4(n) { return String(n).padStart(4, '0'); }

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

// Doctor initials for the letter number (e.g. "dr. Nico Theodorus" -> "NT").
function doctorInitials(name) {
  if (!name) return 'DR';
  const cleaned = name.replace(/\b(dr|drg|dr\.|drg\.)\b/gi, '').replace(/\./g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const ini = parts.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return ini || 'DR';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function approvalStatus(cert) {
  return (cert && cert.details && cert.details.approval && cert.details.approval.status) || 'approved';
}

// Build & log a new SKD record. Returns the stored cert (with a real UUID id
// when the server accepted it). opts.status: 'approved' (doctor-issued, default)
// or 'pending' (admin draft awaiting ACC); opts.approvalDoctorId names the
// doctor who must ACC a pending letter.
export async function createSKD(opts) {
  const patient = store.getPatient(opts.patientId);
  if (!patient) { alert('Pasien tidak ditemukan'); return null; }
  // Signing/ACC doctor: an explicit one (admin picks the responsible doctor)
  // takes precedence over the logged-in doctor's own profile.
  const doctor = (opts.doctor && opts.doctor.full_name) ? opts.doctor : (JSON.parse(sessionStorage.getItem('medconnect_profile') || 'null') || {});
  const isSehat = opts.type === 'sehat';

  // No. RM is assigned by the system (a continuous sequence), never typed.
  let rmNumber = patient.rm_number || '';
  if (!rmNumber) { try { rmNumber = await store.ensureRmNumber(opts.patientId); } catch (e) { rmNumber = ''; } }

  const birth = opts.birth_date || patient.birth_date || '';
  const gender = opts.gender || patient.gender || '';
  const address = opts.address || patient.address || '';
  const letterDate = opts.letter_date || new Date().toISOString().split('T')[0];
  const year = new Date(letterDate).getFullYear();
  const monthRoman = ROMAN[new Date(letterDate).getMonth()];
  const initials = doctorInitials(doctor.full_name);

  let certNum, certRecord;
  try {
    const seq = await store.getNextDocNumber('SKD', year);
    certNum = `${pad4(seq)}/${monthRoman}/SKD/${initials}/${String(year).slice(2)}`;
  } catch (e) {
    certNum = `0001/${monthRoman}/SKD/${initials}/${String(year).slice(2)}`;
  }

  // Everything needed to re-render the letter later (e.g. after ACC) lives in
  // details, so printing never depends on the patient/doctor records changing.
  const details = {
    no_rm: rmNumber, tgl_lahir: birth, gender, alamat: address, letter_date: letterDate,
    doctor_name: doctor.full_name || '', doctor_sip: doctor.sip_number || '',
    keperluan: isSehat ? (opts.keperluan || '') : '',
    kesimpulan: isSehat ? (opts.kesimpulan || 'SEHAT FISIK DAN MENTAL') : '',
    berat_badan: isSehat ? (opts.berat_badan || '') : '',
    tinggi_badan: isSehat ? (opts.tinggi_badan || '') : '',
    tekanan_darah: isSehat ? (opts.tekanan_darah || '') : '',
    nadi: isSehat ? (opts.nadi || '') : '',
    diagnosis: isSehat ? '' : (opts.diagnosis || ''),
    rest_days: isSehat ? '' : (opts.rest_days || ''),
    from_date: isSehat ? '' : (opts.from_date || ''),
    to_date: isSehat ? '' : (opts.to_date || ''),
    approval: { status: opts.status || 'approved', doctor_id: opts.approvalDoctorId || '', reject_reason: '' },
  };

  // certificates.patient_id is a UUID column, so never send a client
  // placeholder id ('id_...') from an unsynced patient.
  const safePatientId = String(opts.patientId).startsWith('id_') ? null : opts.patientId;
  try {
    certRecord = await store.logCertificate({
      cert_number: certNum, cert_type: 'skd', perihal: isSehat ? 'SEHAT' : 'SAKIT',
      patient_id: safePatientId, patient_name: patient.full_name,
      doctor_name: doctor.full_name || '', details,
    });
  } catch (e) {
    certRecord = { id: 'local-' + Date.now(), cert_number: certNum, cert_type: 'skd', perihal: isSehat ? 'SEHAT' : 'SAKIT', patient_name: patient.full_name, doctor_name: doctor.full_name || '', details, issued_at: new Date().toISOString() };
  }

  // Notify the assigned doctor when a draft awaits their ACC.
  if (details.approval.status === 'pending' && details.approval.doctor_id) {
    try { store.notifyDoctorPendingSKD(details.approval.doctor_id, patient.full_name, isSehat ? 'Sehat' : 'Sakit'); } catch (e) { /* best-effort */ }
  }
  return certRecord;
}

// Render a letter from a stored cert record into an already-open window `w`
// (opened synchronously on the click so popup blockers allow it).
function writeLetter(w, cert) {
  if (!w) return;
  const d = cert.details || {};
  const isSehat = (cert.perihal || '').toUpperCase() === 'SEHAT';
  const draft = approvalStatus(cert) !== 'approved';
  const certNum = cert.cert_number || '';
  const origin = window.location.origin;
  const verifyUrl = `${origin}/#/verify/${cert.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(verifyUrl)}`;

  const bodyHtml = isSehat ? `
    <p class="lead">Pada hari ini, pasien dengan identitas diri di atas, telah dilakukan pemeriksaan dengan hasil sebagai berikut:</p>
    <table class="periksa">
      <tr><td class="k">Berat Badan</td><td class="s">:</td><td class="v">${esc(d.berat_badan) || '-'} ${d.berat_badan ? 'KG' : ''}</td></tr>
      <tr><td class="k">Tinggi Badan</td><td class="s">:</td><td class="v">${esc(d.tinggi_badan) || '-'} ${d.tinggi_badan ? 'CM' : ''}</td></tr>
      <tr><td class="k">Tekanan Darah</td><td class="s">:</td><td class="v">${esc(d.tekanan_darah) || '-'} ${d.tekanan_darah ? 'MMHG' : ''}</td></tr>
      <tr><td class="k">Nadi</td><td class="s">:</td><td class="v">${esc(d.nadi) || '-'} ${d.nadi ? 'X/MIN' : ''}</td></tr>
      <tr><td class="k">Dipergunakan untuk</td><td class="s">:</td><td class="v">${esc((d.keperluan || '-')).toUpperCase()}</td></tr>
    </table>
    <p class="lead">Dari hasil pemeriksaan, saya menyatakan kondisi pasien dengan data diri di atas dalam kondisi:</p>
    <p class="conclusion">${esc(d.kesimpulan || 'SEHAT FISIK DAN MENTAL').toUpperCase()}</p>
  ` : `
    <p class="lead">Bahwa benar, pasien dengan identitas diri di atas, sedang menderita penyakit dengan diagnosis:</p>
    <p class="conclusion">${esc((d.diagnosis || '-')).toUpperCase()}</p>
    <table class="periksa">
      <tr><td class="k">Diperlukan izin istirahat selama</td><td class="s">:</td><td class="v">${esc(d.rest_days || '-')} HARI</td></tr>
      <tr><td class="k">Dari Tanggal</td><td class="s">:</td><td class="v">${fmtDate(d.from_date)}</td></tr>
      <tr><td class="k">Hingga Tanggal</td><td class="s">:</td><td class="v">${fmtDate(d.to_date)}</td></tr>
    </table>
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Surat Keterangan ${isSehat ? 'Sehat' : 'Sakit'} - ${esc(cert.patient_name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
  :root{ --ink:#111827; --muted:#6b7280; --rule:#d1d5db; --accent:#1c3980; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;background:#e5e7eb;padding:28px 16px;display:flex;flex-direction:column;align-items:center;color:var(--ink)}
  .page{width:210mm;min-height:297mm;background:white;padding:18mm 20mm;box-shadow:0 8px 28px rgba(0,0,0,.14);display:flex;flex-direction:column;position:relative;overflow:hidden}
  .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5}
  .watermark span{transform:rotate(-32deg);font-size:60px;font-weight:800;color:rgba(220,38,38,.13);border:6px solid rgba(220,38,38,.13);padding:10px 40px;border-radius:14px;letter-spacing:.05em;text-align:center;line-height:1.1}
  .kop{display:flex;align-items:center;gap:16px;border-bottom:3px double var(--accent);padding-bottom:12px;position:relative;z-index:6}
  .kop img{height:22mm;width:auto;object-fit:contain}
  .kop-text{flex:1;text-align:center}
  .kop-name{font-size:20px;font-weight:800;color:var(--accent);letter-spacing:.02em;line-height:1.15}
  .kop-sub{font-size:11px;font-weight:600;color:var(--muted);margin-top:1px}
  .kop-addr{font-size:10.5px;color:#4b5563;margin-top:5px;line-height:1.5}
  .content{position:relative;z-index:6;display:flex;flex-direction:column;flex:1}
  .title{text-align:center;margin:16px 0 4px}
  .title h1{font-size:16px;font-weight:800;letter-spacing:.06em;text-decoration:underline;text-underline-offset:3px}
  .perihal{text-align:center;font-size:12.5px;font-weight:600;color:#374151;margin-bottom:2px}
  .no-surat{text-align:center;font-size:12.5px;color:#374151;margin-bottom:18px}
  .no-surat b{color:var(--ink)}
  .intro{font-size:13px;margin-bottom:10px}
  .identitas{margin:0 0 14px 4mm}
  .identitas table{border-collapse:collapse}
  .identitas td{font-size:13px;padding:2.5px 0;vertical-align:top}
  .identitas td.k{width:38mm;color:#374151}
  .identitas td.s{width:6mm}
  .identitas td.v{font-weight:600}
  .lead{font-size:13px;margin:10px 0}
  table.periksa{border-collapse:collapse;margin:6px 0 6px 4mm}
  table.periksa td{font-size:13px;padding:3px 0;vertical-align:top}
  table.periksa td.k{width:60mm;color:#374151}
  table.periksa td.s{width:6mm}
  table.periksa td.v{font-weight:600}
  .conclusion{text-align:center;font-size:16px;font-weight:800;letter-spacing:.04em;color:var(--accent);margin:12px 0;padding:8px;border:1px solid var(--rule);border-radius:6px;background:#f8fafc}
  .closing{font-size:13px;margin-top:14px;line-height:1.6}
  .spacer{flex:1;min-height:6mm}
  .sign-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;gap:20px}
  .verify{display:flex;align-items:center;gap:10px;max-width:78mm}
  .verify img{width:74px;height:74px;border:1px solid var(--rule);border-radius:6px;padding:4px;background:white}
  .verify-t{font-size:10px;color:var(--muted);line-height:1.5}
  .verify-t b{color:var(--ink);font-size:11px}
  .sign{text-align:center;min-width:60mm}
  .sign .place{font-size:13px;margin-bottom:2px}
  .sign .role{font-size:13px;margin-bottom:8px}
  .sign .name{font-size:14px;font-weight:800;text-decoration:underline;text-underline-offset:3px}
  .sign .sip{font-size:11px;color:#374151;margin-top:2px}
  .foot{margin-top:14px;padding-top:8px;border-top:1px solid var(--rule);font-size:10px;color:var(--muted);text-align:center;line-height:1.5}
  .draft-banner{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:11px;font-weight:600;text-align:center;padding:6px;border-radius:6px;margin-bottom:10px;position:relative;z-index:6}
  .print-btn{margin-top:20px;background:var(--accent);color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif}
  @media print{ @page{size:A4 portrait;margin:0} body{background:white;padding:0} .page{box-shadow:none;width:210mm} .no-print{display:none!important} }
  </style></head><body>
  <div class="page">
    ${draft ? '<div class="watermark"><span>DRAFT<br>BELUM DISAHKAN</span></div>' : ''}
    <div class="kop">
      <img src="${origin}/assets/logos/klinik-prima-logo.png" alt="Klinik Prima">
      <div class="kop-text">
        <div class="kop-name">KLINIK KASIH ANUGERAH PRIMA</div>
        <div class="kop-sub">(PRIMA KLINIK)</div>
        <div class="kop-addr">Jl. Dr. Wahidin Gg. Sepakat 8, Ruko No. 88 B-C, Kel. Sungai Jawi<br>Kec. Pontianak Kota, Kota Pontianak, Kalimantan Barat, 78111<br>No. HP / WA : 089518824216 &nbsp;|&nbsp; email: primaklinik.ptk@gmail.com</div>
      </div>
    </div>
    <div class="content">
      ${draft ? '<div class="draft-banner">DRAFT — Surat ini BELUM DISAHKAN oleh dokter. Belum sah untuk digunakan sampai disetujui (ACC).</div>' : ''}
      <div class="title"><h1>SURAT KETERANGAN DOKTER</h1></div>
      <div class="perihal">Perihal : SURAT KETERANGAN ${isSehat ? 'SEHAT' : 'SAKIT'}</div>
      <div class="no-surat">No. Surat : <b>${esc(certNum)}</b></div>

      <p class="intro">Yang bertanda tangan di bawah ini, saya menerangkan dengan sesungguhnya bahwa:</p>
      <div class="identitas"><table>
        <tr><td class="k">No. RM</td><td class="s">:</td><td class="v">${esc(d.no_rm || '-')}</td></tr>
        <tr><td class="k">Nama Pasien</td><td class="s">:</td><td class="v">${esc(cert.patient_name).toUpperCase()}</td></tr>
        <tr><td class="k">Tanggal Lahir</td><td class="s">:</td><td class="v">${fmtDate(d.tgl_lahir)}</td></tr>
        <tr><td class="k">Jenis Kelamin</td><td class="s">:</td><td class="v">${esc(d.gender || '-')}</td></tr>
        <tr><td class="k">Alamat</td><td class="s">:</td><td class="v">${esc(d.alamat || '-')}</td></tr>
      </table></div>

      ${bodyHtml}

      <p class="closing">Demikian surat keterangan ini dibuat dan dapat digunakan sebagaimana mestinya. Atas perhatiannya, terima kasih banyak.</p>

      <div class="spacer"></div>

      <div class="sign-row">
        <div class="verify">
          <img src="${qrUrl}" alt="QR Verifikasi">
          <div class="verify-t"><b>Verifikasi Keaslian</b><br>Pindai QR untuk memverifikasi keabsahan surat ini secara online melalui sistem Klinik Prima.</div>
        </div>
        <div class="sign">
          <div class="place">Pontianak, ${fmtDate(d.letter_date)}</div>
          <div class="role">Dokter Pemeriksa,</div>
          <div class="name">${esc(cert.doctor_name || d.doctor_name || '-').toUpperCase()}</div>
          <div class="sip">SIPD: ${esc(d.doctor_sip || '-')}</div>
          <div class="sip" style="font-style:italic;color:#9ca3af;margin-top:4px">${draft ? 'Menunggu pengesahan (ACC) dokter' : 'Sah tanpa tanda tangan basah — diverifikasi via QR'}</div>
        </div>
      </div>

      <div class="foot">Dokumen ini diterbitkan secara digital oleh Klinik Prima melalui platform myprima.id &middot; No. ${esc(certNum)}</div>
    </div>
  </div>
  <button class="no-print print-btn" onclick="window.print()">Cetak / Download PDF</button>
  </body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

const LOADING_DOC = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menyiapkan surat...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#1c3980">Menyiapkan surat...</body></html>';

// Render a cert into a window that was already opened (synchronously, within a
// click) — used after an async approve so the print window isn't popup-blocked.
export function renderSKDInto(w, cert) {
  if (!w) return;
  if (!cert) { w.close(); return; }
  writeLetter(w, cert);
}
export const SKD_LOADING_DOC = LOADING_DOC;

// Create a new SKD and open it for printing (draft watermark if pending).
export async function issueSKD(opts) {
  const w = window.open('', '_blank');
  if (w) w.document.write(LOADING_DOC);
  const cert = await createSKD(opts);
  if (!cert) { if (w) w.close(); return null; }
  writeLetter(w, cert);
  return cert;
}

// Print an already-issued letter by its id (used to reprint / print after ACC).
export async function printSKDById(certId) {
  const w = window.open('', '_blank');
  if (w) w.document.write(LOADING_DOC);
  const cert = await store.getCertificateById(certId);
  if (!cert) { if (w) w.close(); alert('Surat tidak ditemukan'); return; }
  writeLetter(w, cert);
}
