import { store } from './store.js';
import { CONFIG } from './config.js';

// Kertas resep yang bisa dicetak (kop klinik + format R/ + SIP + QR verifikasi).
// Sama seperti SKD/sertifikat vaksin: nomor unik dicatat sebagai certificate
// bertipe 'resep' agar QR-nya bisa diverifikasi publik lewat /verify/<id>.

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

function pad4(n) { return String(n).padStart(4, '0'); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calcAge(birth) {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b)) return null;
  return Math.floor((Date.now() - b) / (365.25 * 24 * 60 * 60 * 1000));
}

function doctorInitials(name) {
  if (!name) return 'DR';
  const cleaned = String(name).replace(/\b(dr|drg|dr\.|drg\.)\b/gi, '').replace(/\./g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'DR';
}

// Reuse an existing certificate for this prescription so re-printing keeps the
// same number & QR (no duplicate records piling up).
async function ensureResepCert(rx, patient, doctor, items) {
  const existing = await store.getCertificateForPrescription(rx.id);
  if (existing) return existing;

  const issueDate = (rx.created_at || new Date().toISOString()).split('T')[0];
  const year = new Date(issueDate).getFullYear();
  const monthRoman = ROMAN[new Date(issueDate).getMonth()] || 'I';
  const initials = doctorInitials(doctor && doctor.full_name);

  let certNum;
  try {
    const seq = await store.getNextDocNumber('RSP', year);
    certNum = `${pad4(seq)}/${monthRoman}/RSP/${initials}/${String(year).slice(2)}`;
  } catch (e) {
    certNum = rx.rx_number || `0001/${monthRoman}/RSP/${initials}/${String(year).slice(2)}`;
  }

  // Berat badan diambil dari TTV kunjungan terkait — wajib pada resep anak.
  const linkedRecord = (store.data.medical_records || []).find(r => r.id === rx.record_id);
  const vs = (linkedRecord && linkedRecord.vital_signs) || {};

  const details = {
    rx_id: rx.id,
    rx_number: rx.rx_number || '',
    rx_target: rx.rx_target || 'apotek',
    no_rm: (patient && patient.rm_number) || '',
    tgl_lahir: (patient && patient.birth_date) || '',
    gender: (patient && patient.gender) || '',
    alamat: (patient && patient.address) || '',
    berat_badan: vs.bb || '',
    tinggi_badan: vs.tb || '',
    // Tempat praktik saat resep ditulis (Klinik / Home Care / Telemedicine) —
    // bagian dari Inscriptio, bisa berbeda tiap kunjungan.
    practice_place: (linkedRecord && linkedRecord.location) || '',
    doctor_name: (doctor && doctor.full_name) || '',
    doctor_sip: (doctor && doctor.sip_number) || '',
    letter_date: issueDate,
    notes: rx.notes || '',
    service_fee_enabled: !!rx.service_fee_enabled,
    service_fee: rx.service_fee || 0,
    items: (items || []).map(i => ({
      drug_name: i.drug_name || '', dosage: i.dosage || '', quantity: i.quantity || '',
      unit: i.unit || '', frequency: i.frequency || '', time: i.time || '',
      duration: i.duration || '', instructions: i.instructions || '',
      is_compound: !!i.is_compound, compound_details: i.compound_details || '',
    })),
  };

  const safePatientId = String(rx.patient_id || '').startsWith('id_') ? null : rx.patient_id;
  try {
    return await store.logCertificate({
      cert_number: certNum, cert_type: 'resep', perihal: 'RESEP',
      patient_id: safePatientId, patient_name: (patient && patient.full_name) || '',
      doctor_name: (doctor && doctor.full_name) || '', details,
    });
  } catch (e) {
    return { id: 'local-' + Date.now(), cert_number: certNum, cert_type: 'resep', patient_name: (patient && patient.full_name) || '', doctor_name: (doctor && doctor.full_name) || '', details, issued_at: new Date().toISOString() };
  }
}

function itemHtml(i, idx) {
  if (i.is_compound) {
    return `
      <div class="rx-item">
        <div class="rx-line"><span class="rx-mark">R/</span><span class="rx-name">${esc(i.drug_name) || 'Racikan ' + (idx + 1)}</span><span class="rx-qty">No. ${esc(i.quantity) || '-'}</span></div>
        <div class="rx-sub">Komposisi: ${esc(i.compound_details) || '-'}</div>
        <div class="rx-sig">S ${esc(i.frequency)} ${esc(i.time)}${i.duration ? ' &middot; ' + esc(i.duration) : ''}${i.instructions ? ' &middot; ' + esc(i.instructions) : ''}</div>
      </div>`;
  }
  return `
      <div class="rx-item">
        <div class="rx-line"><span class="rx-mark">R/</span><span class="rx-name">${esc(i.drug_name)}${i.dosage ? ' ' + esc(i.dosage) : ''}</span><span class="rx-qty">No. ${esc(i.quantity) || '-'} ${esc(i.unit)}</span></div>
        <div class="rx-sig">S ${esc(i.frequency)} ${esc(i.time)}${i.duration ? ' &middot; ' + esc(i.duration) : ''}${i.instructions ? ' &middot; ' + esc(i.instructions) : ''}</div>
      </div>`;
}

function writeResep(w, cert) {
  if (!w) return;
  const d = cert.details || {};
  const origin = window.location.origin;
  const verifyUrl = `${origin}/#/verify/${cert.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(verifyUrl)}`;
  const age = calcAge(d.tgl_lahir);
  const isLuar = (d.rx_target || 'apotek') === 'luar';
  const items = d.items || [];

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resep - ${esc(cert.patient_name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
  :root{ --ink:#111827; --muted:#6b7280; --rule:#d1d5db; --accent:#1c3980; }
  *{margin:0;padding:0;box-sizing:border-box}
  /* --s = faktor skala; semua ukuran ikut mengecil saat kertas lebih kecil. */
  body{font-family:'Inter',sans-serif;background:#e5e7eb;padding:84px 16px 28px;display:flex;flex-direction:column;align-items:center;color:var(--ink);--s:1;--pw:210mm;--ph:297mm;--pad:16mm 18mm}
  body[data-size="a5"]{--s:.78;--pw:148mm;--ph:210mm;--pad:9mm 11mm}
  /* 1/3 A4 PORTRAIT (99x210mm) — blanko resep klasik: sempit & tinggi.
     Lebarnya cuma ~87mm setelah padding, jadi kop & blok tanda tangan
     ditumpuk vertikal agar tidak berdesakan. */
  body[data-size="a4-3"]{--s:.55;--pw:99mm;--ph:210mm;--pad:6mm 6mm}
  body[data-size="a4-3"] .kop{flex-direction:column;text-align:center;gap:calc(6px*var(--s))}
  body[data-size="a4-3"] .kop img{height:calc(14mm*var(--s))}
  body[data-size="a4-3"] .doc-line{flex-direction:column;align-items:flex-start;gap:1px}
  body[data-size="a4-3"] .ident td.k{width:auto;padding-right:calc(4px*var(--s))}
  body[data-size="a4-3"] .sign-row{flex-direction:column;align-items:stretch;gap:calc(12px*var(--s))}
  body[data-size="a4-3"] .verify{max-width:none;justify-content:center}
  body[data-size="a4-3"] .sign{min-width:0}
  .page{width:var(--pw);min-height:var(--ph);background:white;padding:var(--pad);box-shadow:0 8px 28px rgba(0,0,0,.14);display:flex;flex-direction:column;position:relative}
  .kop{display:flex;align-items:center;gap:calc(16px*var(--s));border-bottom:3px double var(--accent);padding-bottom:calc(12px*var(--s))}
  .kop img{height:calc(20mm*var(--s));width:auto;object-fit:contain}
  .kop-text{flex:1;text-align:center}
  .kop-name{font-size:calc(19px*var(--s));font-weight:800;color:var(--accent);letter-spacing:.02em;line-height:1.15}
  .kop-sub{font-size:calc(11px*var(--s));font-weight:600;color:var(--muted);margin-top:1px}
  .kop-addr{font-size:calc(10.5px*var(--s));color:#4b5563;margin-top:calc(5px*var(--s));line-height:1.45}
  .doc-line{display:flex;justify-content:space-between;align-items:baseline;margin-top:calc(10px*var(--s));font-size:calc(12px*var(--s))}
  .doc-line b{font-size:calc(13px*var(--s))}
  .badge-luar{display:inline-block;margin-top:calc(8px*var(--s));padding:calc(5px*var(--s)) calc(12px*var(--s));border-radius:6px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:calc(11px*var(--s));font-weight:700}
  .ident{margin:calc(12px*var(--s)) 0 calc(8px*var(--s));border:1px solid var(--rule);border-radius:8px;padding:calc(9px*var(--s)) calc(12px*var(--s));background:#f9fafb}
  .ident table{border-collapse:collapse;width:100%}
  .ident td{font-size:calc(12.5px*var(--s));padding:calc(2px*var(--s)) 0;vertical-align:top}
  .ident td.k{width:calc(30mm*var(--s));color:#374151}
  .ident td.s{width:calc(5mm*var(--s))}
  .ident td.v{font-weight:600}
  .rx-list{flex:1}
  .rx-item{margin:0 0 calc(11px*var(--s)) calc(6mm*var(--s));padding-bottom:calc(7px*var(--s));border-bottom:1px dashed #e5e7eb}
  .rx-line{display:flex;align-items:baseline;gap:calc(8px*var(--s))}
  .rx-mark{font-weight:800;color:var(--accent);font-size:calc(15px*var(--s));min-width:calc(22px*var(--s))}
  .rx-name{font-weight:700;font-size:calc(14px*var(--s));flex:1}
  .rx-qty{font-size:calc(13px*var(--s));font-weight:600;white-space:nowrap}
  .rx-sub{font-size:calc(11.5px*var(--s));color:#4b5563;margin:3px 0 0 calc(30px*var(--s));line-height:1.45}
  .rx-sig{font-size:calc(12.5px*var(--s));font-style:italic;color:#374151;margin:3px 0 0 calc(30px*var(--s))}
  .notes{margin-top:calc(6px*var(--s));padding:calc(7px*var(--s)) calc(10px*var(--s));border-radius:6px;background:#fffbeb;border:1px solid #fde68a;font-size:calc(11.5px*var(--s));color:#92400e}
  .fee{margin-top:calc(6px*var(--s));padding:calc(7px*var(--s)) calc(10px*var(--s));border-radius:6px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:calc(11.5px*var(--s));color:#166534;font-weight:600}
  .sign-row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:calc(16px*var(--s));gap:calc(20px*var(--s))}
  .verify{display:flex;align-items:center;gap:calc(10px*var(--s));max-width:78mm}
  .verify img{width:calc(70px*var(--s));height:calc(70px*var(--s));border:1px solid var(--rule);border-radius:6px;padding:calc(4px*var(--s));background:white}
  .verify-t{font-size:calc(9.5px*var(--s));color:var(--muted);line-height:1.45}
  .verify-t b{color:var(--ink);font-size:calc(10.5px*var(--s))}
  .sign{text-align:center;min-width:calc(60mm*var(--s))}
  .sign .place{font-size:calc(12.5px*var(--s));margin-bottom:2px}
  .sign-space{height:calc(20mm*var(--s))}
  .sign .name{font-size:calc(14px*var(--s));font-weight:800;text-decoration:underline;text-underline-offset:3px}
  .sign .sip{font-size:calc(11px*var(--s));color:#374151;margin-top:2px}
  .foot{margin-top:calc(10px*var(--s));padding-top:calc(7px*var(--s));border-top:1px solid var(--rule);font-size:calc(9.5px*var(--s));color:var(--muted);text-align:center;line-height:1.45}
  /* Toolbar menempel di atas layar supaya langsung terlihat tanpa scroll
     (halaman A4 tingginya ~1100px, kalau toolbar di bawah pasti terlewat). */
  .bar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;font-family:Inter,sans-serif;background:#f8fafc;border-bottom:1px solid #cbd5e1;padding:12px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
  .bar span{font-size:12px;color:#4b5563;font-weight:600;margin-right:2px}
  .bar button{background:white;color:#374151;border:1px solid #cbd5e1;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif}
  .bar button.active{background:var(--accent);color:white;border-color:var(--accent)}
  .bar button.print{background:var(--accent);color:white;border-color:var(--accent);padding:8px 24px}
  @media print{ body{background:white;padding:0} .page{box-shadow:none} .no-print{display:none!important} }
  </style>
  <style id="pagesize">@page{size:210mm 297mm;margin:0}</style>
  </head><body>
  <div class="bar no-print">
    <span>Ukuran kertas:</span>
    <button type="button" data-sz="a4">A4</button>
    <button type="button" data-sz="a5">A5</button>
    <button type="button" data-sz="a4-3">&#8531; A4 (99&times;210mm)</button>
    <button type="button" class="print" onclick="window.print()">Cetak / PDF</button>
  </div>
  <div class="page">
    <div class="kop">
      <img src="${origin}/assets/logos/klinik-prima-logo.png" alt="Klinik Prima">
      <div class="kop-text">
        <div class="kop-name">KLINIK KASIH ANUGERAH PRIMA</div>
        <div class="kop-sub">(PRIMA KLINIK)</div>
        <div class="kop-addr">${esc(CONFIG.CLINIC_ADDRESS || '')}<br>No. HP / WA : ${esc(CONFIG.CLINIC_WHATSAPP_DISPLAY || '')} &nbsp;|&nbsp; email: primaklinik.ptk@gmail.com</div>
      </div>
    </div>

    <div class="doc-line">
      <span>No. Resep : <b>${esc(cert.cert_number)}</b>${d.rx_number ? ' <span style="color:#6b7280">(' + esc(d.rx_number) + ')</span>' : ''}</span>
      <span>Pontianak, ${fmtDate(d.letter_date)}</span>
    </div>
    ${d.practice_place ? `<div class="doc-line" style="margin-top:2px"><span style="color:#6b7280">Tempat Praktik : <b style="color:#111827">${esc(d.practice_place)}</b></span><span></span></div>` : ''}
    ${isLuar ? '<div class="badge-luar">RESEP LUAR &mdash; dapat ditebus di apotek pilihan pasien</div>' : ''}

    <div class="ident"><table>
      <tr><td class="k">Nama Pasien</td><td class="s">:</td><td class="v">${esc(cert.patient_name).toUpperCase()}</td></tr>
      <tr><td class="k">No. RM</td><td class="s">:</td><td class="v">${esc(d.no_rm || '-')}</td></tr>
      <tr><td class="k">Tgl. Lahir / Umur</td><td class="s">:</td><td class="v">${d.tgl_lahir ? fmtDate(d.tgl_lahir) : '-'}${age !== null ? ' (' + age + ' tahun)' : ''}</td></tr>
      <tr><td class="k">Jenis Kelamin</td><td class="s">:</td><td class="v">${esc(d.gender || '-')}</td></tr>
      <tr><td class="k">Berat Badan</td><td class="s">:</td><td class="v">${d.berat_badan ? esc(d.berat_badan) + ' kg' : '-'}${d.tinggi_badan ? ' &nbsp;|&nbsp; TB: ' + esc(d.tinggi_badan) + ' cm' : ''}</td></tr>
      <tr><td class="k">Alamat</td><td class="s">:</td><td class="v">${esc(d.alamat || '-')}</td></tr>
    </table></div>

    <div class="rx-list">
      ${items.length ? items.map(itemHtml).join('') : '<p style="margin-left:6mm;color:#6b7280;font-size:13px">(tidak ada item obat)</p>'}
      ${d.notes ? `<div class="notes"><b>Catatan:</b> ${esc(d.notes)}</div>` : ''}
      ${d.service_fee_enabled ? `<div class="fee">Jasa Dokter: Rp ${Number(d.service_fee || 0).toLocaleString('id-ID')}</div>` : ''}
    </div>

    <div class="sign-row">
      <div class="verify">
        <img src="${qrUrl}" alt="QR Verifikasi">
        <div class="verify-t"><b>Verifikasi Keaslian</b><br>Pindai QR untuk memverifikasi keabsahan resep ini secara online melalui sistem Klinik Prima.</div>
      </div>
      <div class="sign">
        <div class="place">Dokter Penulis Resep,</div>
        <div class="sign-space"></div>
        <div class="name">${esc(cert.doctor_name || d.doctor_name || '-').toUpperCase()}</div>
        <div class="sip">SIP: ${esc(d.doctor_sip || '-')}</div>
      </div>
    </div>

    <div class="foot">Dokumen ini diterbitkan secara digital oleh Klinik Prima melalui platform myprima.id &middot; No. ${esc(cert.cert_number)}</div>
  </div>
  <script>
    (function(){
      var SIZES = { 'a4':'210mm 297mm', 'a5':'148mm 210mm', 'a4-3':'99mm 210mm' };
      function apply(sz){
        if (!SIZES[sz]) sz = 'a4';
        document.body.setAttribute('data-size', sz);
        document.getElementById('pagesize').textContent = '@page{size:' + SIZES[sz] + ';margin:0}';
        var btns = document.querySelectorAll('.bar button[data-sz]');
        for (var i=0;i<btns.length;i++) btns[i].className = (btns[i].getAttribute('data-sz')===sz ? 'active' : '');
        try { localStorage.setItem('medconnect_resep_size', sz); } catch(e){}
      }
      var btns = document.querySelectorAll('.bar button[data-sz]');
      for (var i=0;i<btns.length;i++) (function(b){ b.onclick = function(){ apply(b.getAttribute('data-sz')); }; })(btns[i]);
      var saved = 'a4';
      try { saved = localStorage.getItem('medconnect_resep_size') || 'a4'; } catch(e){}
      apply(saved);
    })();
  </script>
  </body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

const LOADING_DOC = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menyiapkan resep...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#1c3980">Menyiapkan kertas resep...</body></html>';

// Print a prescription as a proper prescription sheet. The window is opened
// synchronously (before any await) so popup blockers allow it.
export async function printResepById(rxId) {
  const w = window.open('', '_blank');
  if (w) w.document.write(LOADING_DOC);
  const rx = (store.data.prescriptions || []).find(r => r.id === rxId);
  if (!rx) { if (w) w.close(); alert('Resep tidak ditemukan.'); return; }
  const patient = store.getPatient(rx.patient_id);
  const doctor = store.getDoctor(rx.doctor_id);
  const items = store.getPrescriptionItems(rx.id);
  const cert = await ensureResepCert(rx, patient, doctor, items);
  if (!cert) { if (w) w.close(); alert('Gagal menyiapkan kertas resep.'); return; }
  writeResep(w, cert);
}
