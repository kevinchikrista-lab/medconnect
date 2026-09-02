import { store } from './store.js';
import { printSKDById } from './skd.js';

// Edit an already-issued SKD. The letter and the QR-verify page both render from
// the stored certificate record, so saving here updates what everyone sees —
// safe for doctor/admin corrections. Values are set via JS after insertion (not
// embedded in attributes) to avoid any quoting issues.
function field(id, label, opts) {
  opts = opts || {};
  const w = opts.full ? 'grid-column:1/-1;' : '';
  if (opts.type === 'select') {
    const options = (opts.options || []).map(o => '<option value="' + o + '">' + o + '</option>').join('');
    return '<div style="' + w + '"><label style="display:block;font-size:11px;color:#6b7280;margin-bottom:3px">' + label + '</label><select id="' + id + '" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:13px;box-sizing:border-box;background:#fff"><option value=""></option>' + options + '</select></div>';
  }
  if (opts.type === 'textarea') {
    return '<div style="' + w + '"><label style="display:block;font-size:11px;color:#6b7280;margin-bottom:3px">' + label + '</label><textarea id="' + id + '" rows="2" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:13px;box-sizing:border-box;resize:none"></textarea></div>';
  }
  return '<div style="' + w + '"><label style="display:block;font-size:11px;color:#6b7280;margin-bottom:3px">' + label + '</label><input id="' + id + '" type="' + (opts.type || 'text') + '" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:13px;box-sizing:border-box"></div>';
}

export async function editSKD(certId, onSaved) {
  const cert = await store.getCertificateById(certId);
  if (!cert) { alert('Surat tidak ditemukan.'); return; }
  const d = cert.details || {};
  const isSehat = (cert.perihal || '').toUpperCase() === 'SEHAT';
  const isRujukan = (cert.perihal || '').toUpperCase() === 'RUJUKAN';
  const isLab = (cert.perihal || '').toUpperCase() === 'HASIL LABORATORIUM' || (cert.perihal || '').toUpperCase() === 'BEBAS NARKOBA';

  // Surat hasil laboratorium / bebas narkoba dibekukan dari katalog centang —
  // belum ada form sunting untuk itu di sini, jadi jangan tampilkan form yang
  // salah sasaran (field-nya tidak akan pernah cocok dengan yang tercetak).
  if (isLab) { alert('Surat hasil laboratorium / bebas narkoba belum bisa disunting dari sini. Batalkan dan terbitkan surat baru bila ada yang perlu diperbaiki.'); return; }

  const common = field('e_name', 'Nama Pasien', { full: true })
    + field('e_rm', 'No. RM')
    + field('e_birth', 'Tanggal Lahir', { type: 'date' })
    + field('e_gender', 'Jenis Kelamin', { type: 'select', options: ['Laki-laki', 'Perempuan'] })
    + field('e_ldate', 'Tanggal Surat', { type: 'date' })
    + field('e_addr', 'Alamat', { full: true })
    + field('e_doc', 'Nama Dokter')
    + field('e_sip', 'No. SIP');

  const body = isSehat
    ? field('e_bb', 'Berat Badan (kg)') + field('e_tb', 'Tinggi Badan (cm)')
      + field('e_td', 'Tekanan Darah (mmHg)') + field('e_nadi', 'Nadi (x/mnt)')
      + field('e_goldar', 'Golongan Darah', { type: 'select', options: ['A', 'B', 'AB', 'O'] })
      + field('e_buta', 'Pemeriksaan Buta Warna', { type: 'select', options: ['Normal', 'Buta warna parsial (defisiensi merah-hijau)', 'Buta warna total'] })
      + field('e_kep', 'Dipergunakan untuk (keperluan)', { full: true })
      + field('e_kes', 'Kesimpulan', { full: true })
    : isRujukan
    ? field('e_tujuan_dokter', 'Ditujukan Kepada (Dokter)', { full: true })
      + field('e_tujuan_faskes', 'Fasilitas Tujuan', { full: true })
      + field('e_anam', 'Anamnesis', { type: 'textarea', full: true })
      + field('e_td', 'Tekanan Darah (mmHg)') + field('e_nadi', 'Nadi (x/mnt)')
      + field('e_suhu', 'Suhu (°C)') + field('e_rr', 'RR (x/mnt)')
      + field('e_bb', 'Berat Badan (kg)') + field('e_tb', 'Tinggi Badan (cm)')
      + field('e_periksa', 'Pemeriksaan Fisik', { type: 'textarea', full: true })
      + field('e_penunjang', 'Pemeriksaan Penunjang', { type: 'textarea', full: true })
      + field('e_diag', 'Diagnosis Kerja', { full: true }) + field('e_icd10', 'Kode ICD-10')
      + field('e_terapi', 'Terapi yang Sudah Diberikan', { type: 'textarea', full: true })
      + field('e_alasan', 'Alasan Rujukan', { type: 'textarea', full: true })
      + field('e_harapan', 'Harapan', { type: 'textarea', full: true })
    : field('e_diag', 'Diagnosis', { full: true })
      + field('e_rest', 'Izin Istirahat (hari)') + field('e_from', 'Dari Tanggal', { type: 'date' })
      + field('e_to', 'Hingga Tanggal', { type: 'date' });

  const old = document.getElementById('__skd_edit'); if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = '__skd_edit';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif';
  ov.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:560px;width:100%;padding:20px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font-weight:700;font-size:16px;color:#111827">Edit Surat ' + (isRujukan ? 'Rujukan' : 'Keterangan ' + (isSehat ? 'Sehat' : 'Sakit')) + '</div><button id="e_x" style="border:none;background:none;font-size:20px;color:#9ca3af;cursor:pointer">&times;</button></div>'
    + '<div style="font-size:11px;color:#9ca3af;margin-bottom:14px">No. ' + (cert.cert_number || '') + ' — perubahan langsung berlaku pada surat & hasil verifikasi QR.</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + common + '</div>'
    + '<div style="border-top:1px solid #f3f4f6;margin:14px 0"></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + body + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">'
    + '<button id="e_cancel" style="padding:9px 14px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;font-size:13px;font-weight:600;color:#4b5563;cursor:pointer">Batal</button>'
    + '<button id="e_save" style="padding:9px 18px;border-radius:9px;border:none;background:#2b7ee0;color:#fff;font-size:13px;font-weight:700;cursor:pointer">Simpan Perubahan</button>'
    + '</div></div>';
  document.body.appendChild(ov);

  const set = (id, v) => { const el = ov.querySelector('#' + id); if (el) el.value = (v == null ? '' : v); };
  const val = (id) => { const el = ov.querySelector('#' + id); return el ? el.value : ''; };

  set('e_name', cert.patient_name); set('e_rm', d.no_rm); set('e_birth', d.tgl_lahir);
  set('e_gender', d.gender); set('e_ldate', d.letter_date); set('e_addr', d.alamat);
  set('e_doc', cert.doctor_name || d.doctor_name); set('e_sip', d.doctor_sip);
  if (isSehat) { set('e_bb', d.berat_badan); set('e_tb', d.tinggi_badan); set('e_td', d.tekanan_darah); set('e_nadi', d.nadi); set('e_goldar', d.golongan_darah); set('e_buta', d.buta_warna); set('e_kep', d.keperluan); set('e_kes', d.kesimpulan); }
  else if (isRujukan) {
    const vt = d.vital || {};
    set('e_tujuan_dokter', d.tujuan_dokter); set('e_tujuan_faskes', d.tujuan_faskes);
    set('e_anam', d.anamnesis); set('e_td', vt.td); set('e_nadi', vt.nadi); set('e_suhu', vt.suhu); set('e_rr', vt.rr);
    set('e_bb', vt.bb); set('e_tb', vt.tb); set('e_periksa', d.pemeriksaan); set('e_penunjang', d.penunjang);
    set('e_diag', d.diagnosis); set('e_icd10', d.icd10); set('e_terapi', d.terapi);
    set('e_alasan', d.alasan); set('e_harapan', d.harapan);
  }
  else { set('e_diag', d.diagnosis); set('e_rest', d.rest_days); set('e_from', d.from_date); set('e_to', d.to_date); }

  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('#e_x').onclick = close;
  ov.querySelector('#e_cancel').onclick = close;
  ov.querySelector('#e_save').onclick = async () => {
    const btn = ov.querySelector('#e_save'); btn.disabled = true; btn.textContent = 'Menyimpan...';
    const nd = Object.assign({}, d, {
      no_rm: val('e_rm'), tgl_lahir: val('e_birth'), gender: val('e_gender'), alamat: val('e_addr'),
      letter_date: val('e_ldate'), doctor_name: val('e_doc'), doctor_sip: val('e_sip'),
    });
    if (isSehat) { nd.berat_badan = val('e_bb'); nd.tinggi_badan = val('e_tb'); nd.tekanan_darah = val('e_td'); nd.nadi = val('e_nadi'); nd.golongan_darah = val('e_goldar'); nd.buta_warna = val('e_buta'); nd.keperluan = val('e_kep'); nd.kesimpulan = val('e_kes'); }
    else if (isRujukan) {
      nd.tujuan_dokter = val('e_tujuan_dokter'); nd.tujuan_faskes = val('e_tujuan_faskes');
      nd.anamnesis = val('e_anam'); nd.pemeriksaan = val('e_periksa'); nd.penunjang = val('e_penunjang');
      nd.diagnosis = val('e_diag'); nd.icd10 = val('e_icd10'); nd.terapi = val('e_terapi');
      nd.alasan = val('e_alasan'); nd.harapan = val('e_harapan');
      nd.vital = { td: val('e_td'), nadi: val('e_nadi'), suhu: val('e_suhu'), rr: val('e_rr'), bb: val('e_bb'), tb: val('e_tb') };
    }
    else { nd.diagnosis = val('e_diag'); nd.rest_days = val('e_rest'); nd.from_date = val('e_from'); nd.to_date = val('e_to'); }
    await store.updateCertificate(certId, { details: nd, patient_name: val('e_name'), doctor_name: val('e_doc') });
    close();
    if (onSaved) { try { onSaved(); } catch (e) {} }
    if (window.__showToast) window.__showToast('Tersimpan', 'Surat diperbarui. Cetak ulang untuk salinan terbaru.');
    if (confirm('Perubahan tersimpan. Cetak ulang surat sekarang?')) printSKDById(certId);
  };
}
