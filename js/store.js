import { CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { IDAI_META, IDAI_SEED, AMBANG_TELAT_HARI, KOLOM_USIA, tambahUsia, selisihHari as selisihHariIdai, umurLabel, usiaKeBulan, kolomUntukBulan } from './idai.js';

function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// An account can be created without an email — a walk-in clinic often has no
// email to record for a patient, and the same is allowed for any role. But
// profiles.email is UNIQUE NOT NULL in the schema, so we can't store a real
// blank: we stamp a unique placeholder in a reserved domain instead. Such an
// account has no auth login yet; an admin can later set a real email (which is
// when an actual Supabase Auth login gets created). isPlaceholderEmail lets the
// UI recognize these accounts and the email-fix flow know a login is missing.
const NO_EMAIL_DOMAIN = 'no-email.myprima.local';
function placeholderEmail() {
  return 'akun_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '@' + NO_EMAIL_DOMAIN;
}
function isPlaceholderEmail(email) {
  return typeof email === 'string' && email.endsWith('@' + NO_EMAIL_DOMAIN);
}

// `new Date().toISOString().split('T')[0]` — used all over this codebase for
// "today" — reads the UTC date, not the local one. WIB is UTC+7, so from
// local midnight to 7am the UTC date is still "yesterday": a record entered
// at, say, 00:30 WIB gets stamped with the previous day's date, and then
// doesn't show up under "today" for the rest of that actual day. getFullYear
// /getMonth/getDate default to the local timezone, so building the string
// from those instead gives the date the clinic's clock actually shows.
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Geser sebuah tanggal 'YYYY-MM-DD' sekian hari, tetap dalam zona waktu lokal.
// Dibangun dari komponen (bukan Date.parse) karena `new Date('2026-08-08')`
// dibaca sebagai UTC — di WIB itu mundur jadi tanggal 7.
function shiftDate(dateStr, days) {
  const [y, m, d] = String(dateStr || todayLocal()).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + (days || 0));
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

// Jatuh tempo berikutnya untuk tugas berulang. Kalau tugasnya sudah lama
// terlambat, tanggalnya digeser terus sampai melewati hari ini — supaya
// mencentang tugas yang telat tidak langsung memunculkan tugas telat lagi.
function nextRecurringDate(dueDate, recurrence, interval) {
  const step = Math.max(1, Number(interval) || 1);
  const today = todayLocal();
  let cur = dueDate || today;
  for (let i = 0; i < 400; i++) {
    if (recurrence === 'daily') cur = shiftDate(cur, step);
    else if (recurrence === 'weekly') cur = shiftDate(cur, 7 * step);
    else if (recurrence === 'monthly' || recurrence === 'yearly') {
      const [y, m, d] = cur.split('-').map(Number);
      const addMonths = recurrence === 'yearly' ? 12 * step : step;
      // Hari ke-31 pada bulan yang cuma 30 hari akan "meluber" ke bulan
      // berikutnya kalau langsung di-setMonth, jadi tanggalnya dijepit dulu
      // ke hari terakhir bulan tujuan (31 Jan + 1 bulan → 28/29 Feb).
      const target = new Date(y, m - 1 + addMonths, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(d, lastDay));
      cur = target.getFullYear() + '-' + String(target.getMonth() + 1).padStart(2, '0') + '-' + String(target.getDate()).padStart(2, '0');
    } else return null;
    if (cur > today) return cur;
  }
  return cur;
}

// A blank "Jumlah" number input (common for compound/racikan items, where
// the composition is described in compound_details instead) binds as the
// empty string '', not null — and prescription_items.quantity is an INTEGER
// column, so Postgres rejects that outright ('invalid input syntax for type
// integer: ""'), failing the whole item save. Postgres accepts NULL there,
// so normalize '' to null before it ever reaches the network request.
function sanitizeRxItem(item) {
  return { ...item, quantity: item.quantity === '' || item.quantity === undefined ? null : item.quantity };
}

// Same problem as sanitizeRxItem, but for DATE columns. An empty date input
// (e.g. no follow-up date on a visit, or a vaccination with no next dose)
// binds as the empty string '', and Postgres rejects that for a DATE column
// ('invalid input syntax for type date: ""'), which silently fails the whole
// insert (_syncInsert only console.warns the error) — so the row never reaches
// Supabase and stays stuck on its client 'id_...' id. For medical_records that
// also breaks any e-resep made for the visit, since the placeholder id gets
// sent as record_id into a UUID FK column ('invalid input syntax for type
// uuid: id_...'). Normalize '' (and undefined) dates to null on the given
// columns so the row actually persists and gets a real UUID.
function sanitizeDates(record, keys) {
  const out = { ...record };
  keys.forEach(k => { if (out[k] === '' || out[k] === undefined) out[k] = null; });
  return out;
}

// Kolom vaccinations yang datang dari supabase-vax-offschedule.sql. Selama
// migrasi itu belum dijalankan, kolomnya dibuang saat menyimpan supaya baris
// vaksinasinya tetap sampai ke server — lihat _syncInsert.
const KOLOM_VAX_BARU = ['off_schedule', 'off_schedule_reason', 'off_schedule_note'];

// Parses the published Google Sheet CSV for home care BMHP/Jasa prices.
// Handles quoted fields (commas inside item names) and looks columns up by
// header name so re-ordering columns in the sheet doesn't break parsing.
function parseHomeCarePriceCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = {
    category: header.indexOf('kategori'),
    name: header.indexOf('nama item'),
    unit: header.indexOf('satuan'),
    price: header.indexOf('harga'),
    active: header.indexOf('aktif'),
  };

  // Kategori is only filled on the first row of each group in the sheet and
  // left blank below it, so blank cells inherit the last non-blank category.
  // Whether an item needs BMHP reimbursement (vs a pure service fee) is
  // signalled by the Satuan column instead: rows priced "per Jasa" are
  // services, everything else (Pcs, etc.) is a physical item to restock.
  const items = [];
  let lastCategory = '';
  for (const r of rows.slice(1)) {
    if (r.length <= 1 || !r[idx.name]) continue;
    const active = (r[idx.active] || 'Y').trim().toUpperCase();
    if (active === 'N') continue;
    const rawCategory = (r[idx.category] || '').trim();
    if (rawCategory) lastCategory = rawCategory;
    const unit = (r[idx.unit] || '').trim();
    items.push({
      category: rawCategory || lastCategory,
      unit,
      bucket: unit.toLowerCase() === 'jasa' ? 'Jasa' : 'BMHP',
      name: (r[idx.name] || '').trim(),
      price: parseInt((r[idx.price] || '0').replace(/[^0-9-]/g, ''), 10) || 0,
      active,
    });
  }
  return items;
}

const DEMO_DATA = {
  users: [
    { id: 'u_admin1', email: 'superadmin@prima.id', password: 'admin12345', role: 'superadmin', is_active: true, created_at: '2026-01-01' },
    { id: 'u_doc1', email: 'dr.kevin@prima.id', password: 'dokter123', role: 'doctor', is_active: true, created_at: '2026-01-05' },
    { id: 'u_doc2', email: 'dr.sarah@prima.id', password: 'dokter123', role: 'doctor', is_active: true, created_at: '2026-01-10' },
    { id: 'u_pat1', email: 'budi@email.com', password: 'pasien123', role: 'patient', is_active: true, created_at: '2026-02-01' },
    { id: 'u_pat2', email: 'sari@email.com', password: 'pasien123', role: 'patient', is_active: true, created_at: '2026-02-15' },
    { id: 'u_pat3', email: 'rina@email.com', password: 'pasien123', role: 'patient', is_active: true, created_at: '2026-03-01' },
    { id: 'u_pat4', email: 'ahmad@email.com', password: 'pasien123', role: 'patient', is_active: true, created_at: '2026-03-10' },
    { id: 'u_pat5', email: 'maya@email.com', password: 'pasien123', role: 'patient', is_active: true, created_at: '2026-04-01' },
    { id: 'u_pha1', email: 'apotek@sehatfarma.com', password: 'apotek123', role: 'pharmacy', is_active: true, created_at: '2026-01-08' },
    { id: 'u_pha2', email: 'apotek@medikafarma.com', password: 'apotek123', role: 'pharmacy', is_active: true, created_at: '2026-02-01' },
  ],

  doctors: [
    { id: 'd_1', user_id: 'u_doc1', full_name: 'dr. Kevin Chikrista', sip_number: 'SIP-4401234567', specialization: 'Dokter Umum', phone: '081234567890', is_available: true, is_public_listed: true, schedule: { mon: '08:00-16:00', tue: '08:00-16:00', wed: '08:00-12:00', thu: '08:00-16:00', fri: '08:00-16:00', sat: '08:00-12:00', sun: null } },
    { id: 'd_2', user_id: 'u_doc2', full_name: 'dr. Sarah Putri, Sp.A', sip_number: 'SIP-4401234568', specialization: 'Dokter Anak', phone: '081234567891', is_available: true, is_public_listed: true, schedule: { mon: '09:00-15:00', tue: null, wed: '09:00-15:00', thu: '09:00-15:00', fri: '09:00-15:00', sat: null, sun: null } },
  ],

  patients: [
    { id: 'p_1', user_id: 'u_pat1', full_name: 'Budi Santoso', nik: '3174041503810001', birth_date: '1981-03-15', gender: 'Laki-laki', phone: '082345678901', address: 'Jl. Sudirman No. 45, Jakarta Selatan', blood_type: 'O', allergies: 'Penisilin', emergency_contact: 'Ani Santoso - 082345678999' },
    { id: 'p_2', user_id: 'u_pat2', full_name: 'Sari Aminah', nik: '3174042206950002', birth_date: '1995-06-22', gender: 'Perempuan', phone: '082345678902', address: 'Jl. Gatot Subroto No. 12, Jakarta Selatan', blood_type: 'A', allergies: '-', emergency_contact: 'Rudi Aminah - 082345678998' },
    { id: 'p_3', user_id: 'u_pat3', full_name: 'Rina Dewi', nik: '3174040108880003', birth_date: '1988-08-01', gender: 'Perempuan', phone: '082345678903', address: 'Jl. Rasuna Said No. 8, Jakarta Selatan', blood_type: 'B', allergies: 'Sulfa', emergency_contact: 'Dedi Wijaya - 082345678997' },
    { id: 'p_4', user_id: 'u_pat4', full_name: 'Ahmad Fauzi', nik: '3174041712000004', birth_date: '2000-12-17', gender: 'Laki-laki', phone: '082345678904', address: 'Jl. Kuningan No. 20, Jakarta Selatan', blood_type: 'AB', allergies: '-', emergency_contact: 'Fatimah Fauzi - 082345678996' },
    { id: 'p_5', user_id: 'u_pat5', full_name: 'Maya Sari', nik: '3174040505030005', birth_date: '2003-05-05', gender: 'Perempuan', phone: '082345678905', address: 'Jl. Kemang Raya No. 33, Jakarta Selatan', blood_type: 'O', allergies: 'Seafood', emergency_contact: 'Hendra Sari - 082345678995' },
  ],

  pharmacies: [
    { id: 'ph_1', user_id: 'u_pha1', name: 'Apotek Sehat Farma', address: 'Jl. Merdeka No. 10, Jakarta Pusat', phone: '021-5551234', license_no: 'SIPA-3174-2025-001', operating_hours: 'Sen-Sab 08:00-21:00, Min 09:00-17:00' },
    { id: 'ph_2', user_id: 'u_pha2', name: 'Apotek Medika Farma', address: 'Jl. Thamrin No. 25, Jakarta Pusat', phone: '021-5551235', license_no: 'SIPA-3174-2025-002', operating_hours: 'Sen-Min 07:00-22:00' },
  ],

  medical_records: [
    { id: 'mr_1', patient_id: 'p_1', doctor_id: 'd_1', visit_date: '2026-06-28', visit_type: 'consultation', location: 'Klinik Utama Prima', anamnesis: 'Demam sejak 3 hari yang lalu disertai batuk berdahak dan pilek. Pasien juga mengeluhkan nyeri tenggorokan dan badan lemas.', examination: 'TD: 120/80 mmHg, Nadi: 88x/mnt, Suhu: 38.2°C, RR: 20x/mnt, SpO2: 98%', diagnosis: 'ISPA (Infeksi Saluran Pernapasan Akut)', diagnosis_secondary: '', therapy: 'Terapi simptomatik, antibiotik oral 5 hari, edukasi istirahat dan hidrasi cukup', vital_signs: { td: '120/80', nadi: 88, suhu: 38.2, rr: 20, spo2: 98, bb: 70, tb: 170 }, follow_up_date: '2026-07-05', follow_up_notes: 'Evaluasi perbaikan gejala ISPA', notes: '' },
    { id: 'mr_2', patient_id: 'p_2', doctor_id: 'd_1', visit_date: '2026-06-25', visit_type: 'consultation', location: 'Klinik Utama Prima', anamnesis: 'Kontrol rutin diabetes mellitus tipe 2. Pasien rutin konsumsi Metformin 500mg 2x1. Keluhan saat ini: sering haus dan buang air kecil malam hari.', examination: 'TD: 130/85 mmHg, Nadi: 76x/mnt, Suhu: 36.5°C, RR: 18x/mnt, SpO2: 99%', diagnosis: 'Diabetes Mellitus Tipe 2', diagnosis_secondary: '', therapy: 'Lanjutkan Metformin 500mg 2x1, edukasi diet rendah gula, cek HbA1c bulan depan', vital_signs: { td: '130/85', nadi: 76, suhu: 36.5, rr: 18, spo2: 99, bb: 58, tb: 155 }, follow_up_date: '2026-07-25', follow_up_notes: 'Cek HbA1c dan evaluasi terapi', notes: '' },
    { id: 'mr_3', patient_id: 'p_3', doctor_id: 'd_1', visit_date: '2026-06-20', visit_type: 'consultation', location: 'Klinik Utama Prima', anamnesis: 'Follow-up hipertensi. TD terkontrol dengan Amlodipine 5mg. Tidak ada keluhan baru.', examination: 'TD: 125/82 mmHg, Nadi: 72x/mnt, Suhu: 36.4°C, RR: 16x/mnt, SpO2: 99%', diagnosis: 'Hipertensi Grade 1 (Terkontrol)', diagnosis_secondary: '', therapy: 'Lanjutkan Amlodipine 5mg 1x1, diet rendah garam', vital_signs: { td: '125/82', nadi: 72, suhu: 36.4, rr: 16, spo2: 99, bb: 65, tb: 162 }, follow_up_date: '2026-07-20', follow_up_notes: 'Kontrol tekanan darah rutin', notes: '' },
    { id: 'mr_4', patient_id: 'p_4', doctor_id: 'd_1', visit_date: '2026-06-28', visit_type: 'consultation', location: 'Klinik Utama Prima', anamnesis: 'Nyeri ulu hati sejak 2 hari lalu, mual, kembung. Pasien sering telat makan dan konsumsi kopi berlebihan.', examination: 'TD: 115/75 mmHg, Nadi: 80x/mnt, Suhu: 36.6°C, RR: 18x/mnt, SpO2: 99%', diagnosis: 'Gastritis Akut', diagnosis_secondary: 'Dispepsia', therapy: 'Omeprazole 20mg 2x1 AC, Sucralfate syrup 3x1 AC, Domperidone 10mg 3x1 AC. Edukasi pola makan teratur.', vital_signs: { td: '115/75', nadi: 80, suhu: 36.6, rr: 18, spo2: 99, bb: 68, tb: 175 }, follow_up_date: '2026-07-12', follow_up_notes: 'Evaluasi perbaikan keluhan gastritis', notes: 'Pasien alergi NSAID' },
  ],

  prescriptions: [
    { id: 'rx_1', record_id: 'mr_1', doctor_id: 'd_1', patient_id: 'p_1', pharmacy_id: 'ph_1', status: 'preparing', notes: 'Pasien alergi Penisilin - monitor reaksi Amoxicillin.', created_at: '2026-06-28T10:30:00', rx_number: 'R-2026-0142' },
    { id: 'rx_2', record_id: 'mr_4', doctor_id: 'd_1', patient_id: 'p_4', pharmacy_id: 'ph_1', status: 'sent', notes: 'Pasien alergi NSAID. Jangan ganti dengan obat mengandung aspirin.', created_at: '2026-06-28T14:30:00', rx_number: 'R-2026-0145' },
    { id: 'rx_3', record_id: 'mr_2', doctor_id: 'd_1', patient_id: 'p_2', pharmacy_id: 'ph_2', status: 'completed', notes: '', created_at: '2026-06-25T11:00:00', rx_number: 'R-2026-0138' },
    { id: 'rx_4', record_id: 'mr_3', doctor_id: 'd_1', patient_id: 'p_3', pharmacy_id: 'ph_1', status: 'ready', notes: '', created_at: '2026-06-20T09:15:00', rx_number: 'R-2026-0130' },
  ],

  prescription_items: [
    { id: 'rxi_1', prescription_id: 'rx_1', drug_name: 'Amoxicillin', dosage: '500mg', quantity: 15, unit: 'Kapsul', frequency: '3 x 1', time: 'Sesudah makan (PC)', duration: '5 hari', instructions: '', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_2', prescription_id: 'rx_1', drug_name: 'Paracetamol', dosage: '500mg', quantity: 10, unit: 'Tablet', frequency: '3 x 1', time: 'Sesudah makan (PC)', duration: '3 hari', instructions: 'Bila demam > 37.5°C', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_3', prescription_id: 'rx_2', drug_name: 'Omeprazole', dosage: '20mg', quantity: 14, unit: 'Kapsul', frequency: '2 x 1', time: 'Sebelum makan (AC)', duration: '7 hari', instructions: '', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_4', prescription_id: 'rx_2', drug_name: 'Sucralfate Syrup', dosage: '500mg/5ml', quantity: 3, unit: 'Botol', frequency: '3 x 1', time: 'Sebelum makan (AC)', duration: '7 hari', instructions: 'Kocok sebelum diminum', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_5', prescription_id: 'rx_2', drug_name: 'Domperidone', dosage: '10mg', quantity: 10, unit: 'Tablet', frequency: '3 x 1', time: 'Sebelum makan (AC)', duration: '3 hari', instructions: '', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_6', prescription_id: 'rx_3', drug_name: 'Metformin', dosage: '500mg', quantity: 60, unit: 'Tablet', frequency: '2 x 1', time: 'Sesudah makan (PC)', duration: '30 hari', instructions: '', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_7', prescription_id: 'rx_4', drug_name: 'Amlodipine', dosage: '5mg', quantity: 30, unit: 'Tablet', frequency: '1 x 1', time: 'Pagi', duration: '30 hari', instructions: '', is_compound: false, compound_details: '', display_name: '' },
    { id: 'rxi_8', prescription_id: 'rx_1', drug_name: 'Obat Batuk Racikan', dosage: '', quantity: 10, unit: 'Kapsul Racikan', frequency: '3 x 1', time: 'Sesudah makan (PC)', duration: '5 hari', instructions: '', is_compound: true, compound_details: 'Codein 10mg + GG 100mg + Salbutamol 2mg + CTM 2mg', display_name: 'Obat Batuk Pilek 3x1 kapsul' },
  ],

  appointments: [
    { id: 'apt_1', patient_id: 'p_1', doctor_id: 'd_1', date: '2026-06-28', time_slot: '08:30', type: 'visit', status: 'completed', queue_number: 1, notes: 'Demam dan batuk' },
    { id: 'apt_2', patient_id: 'p_2', doctor_id: 'd_1', date: '2026-06-28', time_slot: '09:00', type: 'visit', status: 'completed', queue_number: 2, notes: 'Kontrol diabetes' },
    { id: 'apt_3', patient_id: 'p_3', doctor_id: 'd_1', date: '2026-06-28', time_slot: '10:00', type: 'visit', status: 'waiting', queue_number: 3, notes: 'Vaksinasi HPV #2' },
    { id: 'apt_4', patient_id: 'p_4', doctor_id: 'd_1', date: '2026-06-28', time_slot: '14:00', type: 'visit', status: 'waiting', queue_number: 4, notes: 'Sakit kepala' },
    { id: 'apt_5', patient_id: 'p_5', doctor_id: 'd_1', date: '2026-06-28', time_slot: '15:00', type: 'vaccination', status: 'waiting', queue_number: 5, notes: 'Influenza Annual' },
    { id: 'apt_6', patient_id: 'p_1', doctor_id: 'd_1', date: '2026-07-05', time_slot: '09:00', type: 'follow_up', status: 'scheduled', queue_number: null, notes: 'Evaluasi ISPA' },
    { id: 'apt_7', patient_id: 'p_2', doctor_id: 'd_1', date: '2026-07-25', time_slot: '10:00', type: 'follow_up', status: 'scheduled', queue_number: null, notes: 'Cek HbA1c' },
    { id: 'apt_8', patient_id: 'p_3', doctor_id: 'd_1', date: '2026-07-20', time_slot: '09:30', type: 'follow_up', status: 'scheduled', queue_number: null, notes: 'Kontrol TD' },
  ],

  vaccinations: [
    // Seri dosis: vax_mode='series', total_doses=N, dose_schedule=[{dose,date}]
    { id: 'v_1', patient_id: 'p_3', vaccine_name: 'HPV', vaccine_brand: 'Gardasil 9', vax_mode: 'series', dose_number: 1, total_doses: 3, dose_schedule: [{dose:2,date:'2026-06-15'},{dose:3,date:'2026-12-15'}], date_given: '2026-03-15', next_dose_date: '2026-06-15', batch_number: 'GRD9-2026-A1', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: 'Dosis 1 - tidak ada KIPI' },
    { id: 'v_2', patient_id: 'p_3', vaccine_name: 'HPV', vaccine_brand: 'Gardasil 9', vax_mode: 'series', dose_number: 2, total_doses: 3, dose_schedule: [{dose:3,date:'2026-12-15'}], date_given: '2026-06-15', next_dose_date: '2026-12-15', batch_number: 'GRD9-2026-B3', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: 'Dosis 2 - nyeri ringan di lokasi suntik' },
    // Booster berkala: vax_mode='booster', booster_interval_months=N
    { id: 'v_3', patient_id: 'p_5', vaccine_name: 'Influenza', vaccine_brand: 'Influvac Tetra', vax_mode: 'booster', dose_number: 1, total_doses: 1, booster_interval_months: 12, date_given: '2026-01-10', next_dose_date: '2027-01-10', batch_number: 'IFV-2026-001', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: 'Annual vaccination' },
    { id: 'v_6', patient_id: 'p_5', vaccine_name: 'Influenza', vaccine_brand: 'Influvac Tetra', vax_mode: 'booster', dose_number: 2, total_doses: 1, booster_interval_months: 12, date_given: '2025-01-15', next_dose_date: '2026-01-10', batch_number: 'IFV-2025-010', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: 'Annual 2025' },
    // Seri dosis: Hepatitis B
    { id: 'v_4', patient_id: 'p_1', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix-B', vax_mode: 'series', dose_number: 1, total_doses: 3, dose_schedule: [{dose:2,date:'2026-05-01'},{dose:3,date:'2026-10-01'}], date_given: '2026-04-01', next_dose_date: '2026-05-01', batch_number: 'HBV-2026-X1', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: '' },
    { id: 'v_5', patient_id: 'p_1', vaccine_name: 'Hepatitis B', vaccine_brand: 'Engerix-B', vax_mode: 'series', dose_number: 2, total_doses: 3, dose_schedule: [{dose:3,date:'2026-10-01'}], date_given: '2026-05-01', next_dose_date: '2026-10-01', batch_number: 'HBV-2026-X2', administered_by: 'd_1', location: 'Home Care', notes: '' },
    // Booster: Typhoid
    { id: 'v_7', patient_id: 'p_1', vaccine_name: 'Typhoid', vaccine_brand: 'Typhim Vi', vax_mode: 'booster', dose_number: 1, total_doses: 1, booster_interval_months: 36, date_given: '2024-06-15', next_dose_date: '2027-06-15', batch_number: 'TYP-2024-005', administered_by: 'd_1', location: 'Klinik Utama Prima', notes: 'Booster setiap 3 tahun' },
  ],

  // Master lokasi / tempat praktik. Dikelola dari halaman Super Admin
  // (Lokasi Praktik) dan disinkronkan ke tabel practice_locations.
  practice_locations: [
    { id: 'loc_1', name: 'Klinik Utama Prima', address: 'Jl. Dr. Wahidin, Gg. Sepakat 8 No. 88BC, Pontianak', phone: '0895-1882-4216', notes: '', is_active: true, sort_order: 10, kind: 'facility' },
    { id: 'loc_2', name: 'Home Care', address: '', phone: '', notes: 'Kunjungan ke rumah pasien', is_active: true, sort_order: 20, kind: 'service' },
    { id: 'loc_3', name: 'Telemedicine', address: '', phone: '', notes: 'Konsultasi jarak jauh', is_active: true, sort_order: 30, kind: 'service' },
  ],

  // Catatan Bisnis — buku perkembangan usaha, isinya teks Markdown.
  // Disinkronkan ke tabel business_units & business_notes.
  business_units: [
    { id: 'bu_1', name: 'Klinik Prima', description: 'Layanan klinik utama', color: 'blue', is_active: true, sort_order: 10 },
    { id: 'bu_2', name: 'Apotek', description: 'Farmasi & penjualan obat', color: 'green', is_active: true, sort_order: 20 },
    { id: 'bu_3', name: 'Home Care', description: 'Kunjungan ke rumah pasien', color: 'amber', is_active: true, sort_order: 30 },
    { id: 'bu_4', name: 'Umroh & Haji', description: 'Vaksinasi meningitis & layanan jemaah', color: 'purple', is_active: true, sort_order: 40 },
  ],
  business_notes: [],
  umroh_sales: [],
  rm_access_claims: [],

  // To-do / daftar tugas klinik. Dikelola Super Admin & Owner dari halaman
  // "To-Do & Tugas", bisa didelegasikan ke staf mana pun (assignee_id =
  // users.id / profiles.id). Disinkronkan ke tabel tasks.
  tasks: [],

  health_services: [
    { id: 'hs_1', name: 'Vaksinasi Dewasa', description: 'Layanan vaksinasi lengkap untuk dewasa. Tersedia berbagai pilihan vaksin sesuai kebutuhan Anda.', category: 'Vaksinasi', price: 0, image_url: 'https://placehold.co/400x250/0d9488/white?text=Vaksinasi', is_active: true, items: [
      { name: 'Influenza (Vaxigrip Tetra)', price: 350000, desc: 'Vaksin flu tahunan, direkomendasikan setiap tahun' },
      { name: 'HPV (Gardasil 9)', price: 1500000, desc: 'Pencegahan kanker serviks, 3 dosis' },
      { name: 'Hepatitis B (Engerix-B)', price: 250000, desc: 'Pencegahan hepatitis B, 3 dosis' },
      { name: 'Typhoid (Typhim Vi)', price: 300000, desc: 'Pencegahan tifoid, booster tiap 3 tahun' },
      { name: 'Hepatitis A (Havrix)', price: 450000, desc: 'Pencegahan hepatitis A, 2 dosis' },
      { name: 'MMR (Priorix)', price: 350000, desc: 'Campak, Gondongan, Rubella' },
      { name: 'Varicella (Varilrix)', price: 550000, desc: 'Pencegahan cacar air, 2 dosis' },
    ]},
    { id: 'hs_2', name: 'Infus & Vitamin', description: 'Terapi infus untuk meningkatkan daya tahan tubuh, stamina, dan kecantikan kulit.', category: 'Infus', price: 0, image_url: 'https://placehold.co/400x250/0891b2/white?text=Infus+Vitamin', is_active: true, items: [
      { name: 'Infus Vitamin C 10g', price: 250000, desc: 'Boost imunitas dan kecerahan kulit' },
      { name: 'Infus Glutathione', price: 450000, desc: 'Antioksidan kuat, mencerahkan kulit' },
      { name: 'Infus B-Complex + Mineral', price: 300000, desc: 'Mengatasi kelelahan dan lemas' },
      { name: 'Infus Recovery (Post-illness)', price: 350000, desc: 'Pemulihan setelah sakit atau dehidrasi' },
    ]},
    { id: 'hs_3', name: 'Medical Check-Up', description: 'Pemeriksaan kesehatan lengkap untuk deteksi dini penyakit.', category: 'Check-up', price: 0, image_url: 'https://placehold.co/400x250/6366f1/white?text=Check+Up', is_active: true, items: [
      { name: 'Paket Basic', price: 350000, desc: 'Darah rutin, gula darah, kolesterol' },
      { name: 'Paket Standard', price: 650000, desc: 'Basic + fungsi hati, ginjal, urine' },
      { name: 'Paket Premium', price: 1200000, desc: 'Standard + EKG, rontgen, tumor marker' },
    ]},
    { id: 'hs_4', name: 'HomeCare Visit', description: 'Kunjungan dokter ke rumah untuk konsultasi, pemeriksaan, atau tindakan medis ringan.', category: 'HomeCare', price: 350000, image_url: 'https://placehold.co/400x250/f59e0b/white?text=Home+Care', is_active: true, items: []},
    { id: 'hs_5', name: 'Konsultasi Online', description: 'Konsultasi kesehatan via video call dengan dokter. Resep digital dikirim langsung ke apotek.', category: 'Konsultasi', price: 75000, is_promo: true, promo_original_price: 100000, image_url: 'https://placehold.co/400x250/ec4899/white?text=Konsultasi', is_active: true, items: [
      { name: 'Konsultasi Umum (Video Call)', price: 100000, desc: 'Konsultasi 30 menit via video call' },
      { name: 'Konsultasi Spesialis Anak', price: 200000, desc: 'Konsultasi dengan dokter spesialis anak' },
    ]},
  ],

  bookings: [
    { id: 'bk_1', patient_id: 'p_1', service_id: 'hs_1', service_name: 'Vaksinasi Dewasa', item_name: 'Influenza (Vaxigrip Tetra)', preferred_date: '2026-07-10', preferred_time: 'Pagi (08:00-12:00)', notes: '', status: 'confirmed', created_at: '2026-06-25T10:00:00', price: 350000 },
  ],

  inventory: [
    { id: 'inv_1', pharmacy_id: 'ph_1', drug_name: 'Amoxicillin 500mg', stock: 120, unit: 'Kapsul', min_stock: 50, expiry_date: '2027-06-01' },
    { id: 'inv_2', pharmacy_id: 'ph_1', drug_name: 'Paracetamol 500mg', stock: 200, unit: 'Tablet', min_stock: 100, expiry_date: '2027-12-01' },
    { id: 'inv_3', pharmacy_id: 'ph_1', drug_name: 'Omeprazole 20mg', stock: 48, unit: 'Kapsul', min_stock: 30, expiry_date: '2027-03-01' },
    { id: 'inv_4', pharmacy_id: 'ph_1', drug_name: 'Sucralfate Syrup 500mg/5ml', stock: 15, unit: 'Botol', min_stock: 10, expiry_date: '2027-01-01' },
    { id: 'inv_5', pharmacy_id: 'ph_1', drug_name: 'Domperidone 10mg', stock: 8, unit: 'Tablet', min_stock: 30, expiry_date: '2027-09-01' },
    { id: 'inv_6', pharmacy_id: 'ph_1', drug_name: 'Amlodipine 5mg', stock: 150, unit: 'Tablet', min_stock: 50, expiry_date: '2027-08-01' },
    { id: 'inv_7', pharmacy_id: 'ph_1', drug_name: 'Metformin 500mg', stock: 180, unit: 'Tablet', min_stock: 60, expiry_date: '2027-07-01' },
    { id: 'inv_8', pharmacy_id: 'ph_1', drug_name: 'Cetirizine 10mg', stock: 5, unit: 'Tablet', min_stock: 30, expiry_date: '2027-04-01' },
  ],

  articles: [
    { id: 'art_1', title: 'Kapan demam anak perlu dibawa ke dokter?', excerpt: 'Kenali tanda-tanda demam pada anak yang perlu penanganan medis segera.', body: 'Demam pada anak umumnya adalah respons normal tubuh terhadap infeksi. Namun, ada beberapa tanda yang perlu diwaspadai orang tua...', category: 'Anak', image_url: 'https://placehold.co/400x250/1b6fd6/white?text=Artikel', is_published: true, sort_order: 0, created_at: '2026-06-28T00:00:00' },
  ],

  notifications: [
    { id: 'n_1', user_id: 'u_pat1', title: 'Resep Sedang Disiapkan', message: 'Resep R-2026-0142 sedang disiapkan oleh Apotek Sehat Farma.', type: 'prescription', is_read: false, created_at: '2026-06-28T11:00:00' },
    { id: 'n_2', user_id: 'u_pat1', title: 'Jadwal Kontrol', message: 'Pengingat: Kontrol ulang dengan dr. Kevin pada 5 Juli 2026.', type: 'appointment', is_read: false, created_at: '2026-06-28T08:00:00' },
    { id: 'n_3', user_id: 'u_pha1', title: 'E-Resep Baru', message: 'Resep baru R-2026-0145 dari dr. Kevin untuk Ahmad Fauzi.', type: 'prescription', is_read: false, created_at: '2026-06-28T14:30:00' },
    { id: 'n_4', user_id: 'u_pat4', title: 'Resep Dikirim', message: 'Resep R-2026-0145 telah dikirim ke Apotek Sehat Farma.', type: 'prescription', is_read: false, created_at: '2026-06-28T14:30:00' },
    { id: 'n_5', user_id: 'u_doc1', title: 'Pasien Baru', message: 'Ahmad Fauzi telah terdaftar sebagai pasien baru.', type: 'patient', is_read: true, created_at: '2026-06-28T13:00:00' },
  ],
};

class Store {
  constructor() {
    this.data = this._load();
  }

  _load() {
    const saved = localStorage.getItem('medconnect_db');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    const data = JSON.parse(JSON.stringify(DEMO_DATA));
    this._save(data);
    return data;
  }

  _save(data) {
    localStorage.setItem('medconnect_db', JSON.stringify(data || this.data));
    if (!CONFIG.DEMO_MODE) this._syncToSupabase();
  }

  async _syncToSupabase() {
    // Background sync: mirror critical data changes to Supabase
    // This runs fire-and-forget so it doesn't block the UI
    try {
      // Sync is handled per-operation in individual methods when DEMO_MODE is false
    } catch (e) { console.warn('Supabase sync error:', e); }
  }

  // Fire-and-forget insert to Supabase. `localRecord.id` is a client-generated
  // string (see generateId()), not a real UUID, so the id column in Postgres
  // would reject it — it's omitted from the payload so Postgres assigns a real
  // UUID, which is then patched back onto localRecord so later update/delete
  // calls (keyed off .id) still target the right row. Pass `payloadOverride`
  // when the Supabase column shape differs from the local record shape (e.g.
  // notifications' profile_id vs local user_id). Returns a promise of the
  // (possibly patched) localRecord, useful for header->detail FK sequencing.
  // `kolomOpsional` — kolom yang berasal dari migrasi yang mungkin belum
  // dijalankan. Postgres menolak SELURUH baris begitu ada satu kolom yang tidak
  // dikenal, jadi tanpa ini sebuah migrasi yang tertinggal tidak menghilangkan
  // kolom tambahannya, melainkan menghilangkan kejadiannya: vaksinasi yang
  // benar-benar terjadi tidak pernah sampai ke server. Maka begitu ditolak,
  // baris yang sama dicoba sekali lagi tanpa kolom-kolom itu.
  _syncInsert(table, localRecord, payloadOverride, kolomOpsional) {
    if (CONFIG.DEMO_MODE) return Promise.resolve(localRecord);
    const { id, ...payload } = payloadOverride || localRecord;
    const opsional = (Array.isArray(kolomOpsional) ? kolomOpsional : []).filter(k => k in payload);

    const gagal = (err) => { console.warn(`Gagal menyimpan ke Supabase (${table}):`, err, payload); return localRecord; };
    const kirim = (p) => supabase.insert(table, p)
      .then(r => {
        if (r && r.id) { localRecord.id = r.id; this._save(); return { ok: true }; }
        return { ok: false, err: (r && r.error) || 'ditolak server' };
      })
      .catch(e => ({ ok: false, err: e }));

    return kirim(payload).then(r1 => {
      if (r1.ok) return localRecord;
      if (!opsional.length) return gagal(r1.err);
      console.warn(`Insert ${table} ditolak — mencoba ulang tanpa kolom ${opsional.join(', ')}. `
        + 'Jalankan migrasinya agar kolom ini ikut tersimpan.', r1.err);
      const tanpa = { ...payload };
      for (const k of opsional) delete tanpa[k];
      return kirim(tanpa).then(r2 => (r2.ok ? localRecord : gagal(r2.err)));
    });
  }

  // Sequential certificate numbering, resets each year (0001/SKV/KP/26, 0002/..., etc)
  async getNextCertNumber(year) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const result = await supabase.rpc('get_next_cert_number', { p_year: year });
        if (typeof result === 'number') return result;
      } catch (e) { console.warn('Cert sequence RPC failed, using local fallback:', e); }
    }
    // Demo mode / fallback: local counter in localStorage, also resets per year
    const key = 'medconnect_cert_seq_' + year;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  }

  // Sequential rx_number, resets each year. Same pattern as getNextCertNumber
  // above — previously rx_number was `local prescriptions.length + 1`, which
  // collides with an existing row whenever the local cache is missing any
  // prescription (a prior failed save, another doctor's, another device's).
  async getNextRxNumber(year) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const result = await supabase.rpc('get_next_rx_number', { p_year: year });
        if (typeof result === 'number') return result;
      } catch (e) { console.warn('Rx sequence RPC failed, using local fallback:', e); }
    }
    const key = 'medconnect_rx_seq_' + year;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  }

  // Persist an issued certificate so it can be looked up later via QR verification
  async logCertificate(cert) {
    const record = { id: generateId(), ...cert, issued_at: new Date().toISOString() };
    if (!this.data.certificates) this.data.certificates = [];
    this.data.certificates.push(record);
    this._save();
    if (!CONFIG.DEMO_MODE) {
      try {
        const inserted = await supabase.insert('certificates', cert);
        if (inserted && inserted.id) return inserted; // use server-generated UUID
      } catch (e) { console.warn('Failed to log certificate to Supabase:', e); }
    }
    return record;
  }

  // Jalur PUBLIK untuk halaman verifikasi QR — dipakai orang yang tidak punya
  // akun. Sengaja terpisah dari getCertificateById: yang ini hanya boleh
  // mengembalikan secukupnya untuk membuktikan keaslian dokumen, TANPA
  // diagnosis, keperluan, alamat, tanggal lahir, No. RM, maupun daftar obat.
  // Yang perlu dibuktikan orang HRD atau sekolah adalah suratnya asli dan
  // berlaku — bukan sakit apa pasiennya.
  //
  // Di server, batas itu ditegakkan fungsi verify_certificate() yang hanya
  // menerima SATU id; tabelnya sendiri sudah tertutup. Lihat
  // supabase-certificate-privacy.sql.
  async verifyCertificate(certId) {
    if (!certId) return null;
    if (!CONFIG.DEMO_MODE) {
      try {
        const hasil = await supabase.rpc('verify_certificate', { p_id: certId });
        const row = Array.isArray(hasil) ? hasil[0] : hasil;
        if (row && row.id) return row;
        return null;
      } catch (e) { console.warn('Gagal memverifikasi dokumen:', e); return null; }
    }
    // Mode demo: bentuk yang sama persis, disusun dari data lokal — supaya
    // halaman verifikasinya diuji terhadap bentuk yang benar-benar dipakai,
    // bukan terhadap baris utuh yang di produksi tidak akan pernah dia terima.
    const c = (this.data.certificates || []).find(x => x.id === certId);
    if (!c) return null;
    const d = c.details || {};
    return {
      id: c.id, cert_number: c.cert_number || '', cert_type: c.cert_type || '',
      perihal: c.perihal || '', patient_name: c.patient_name || '',
      doctor_name: c.doctor_name || '',
      vaccine_name: c.vaccine_name || '', vaccine_brand: c.vaccine_brand || '',
      issuer_name: (d.kop && d.kop.name) || '',
      item_count: Array.isArray(d.items) ? d.items.length : 0,
      approval_status: (d.approval && d.approval.status) || 'approved',
      issued_at: c.issued_at || '',
    };
  }

  async getCertificateById(id) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const results = await supabase.select('certificates', { eq: { id } });
        if (results && results[0]) return results[0];
      } catch (e) { console.warn('Failed to fetch certificate from Supabase:', e); }
    }
    return (this.data.certificates || []).find(c => c.id === id) || null;
  }

  // One printed-prescription certificate per prescription — re-printing reuses
  // the same number & QR instead of minting a new record every time.
  async getCertificateForPrescription(rxId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('certificates', { eq: { cert_type: 'resep' } });
        if (Array.isArray(rows)) {
          const hit = rows.find(c => c.details && c.details.rx_id === rxId);
          if (hit) return hit;
        }
      } catch (e) { /* fall through to local */ }
    }
    return (this.data.certificates || []).find(c => c.cert_type === 'resep' && c.details && c.details.rx_id === rxId) || null;
  }

  // Sequential letter number per (series, year) — e.g. series 'SKD' for a
  // Surat Keterangan Dokter. Same RPC-with-local-fallback pattern as the rx/
  // cert numbers above, so it stays unique across devices when online.
  async getNextDocNumber(series, year) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const result = await supabase.rpc('get_next_doc_number', { p_series: series, p_year: year });
        if (typeof result === 'number') return result;
      } catch (e) { console.warn('Doc sequence RPC failed, using local fallback:', e); }
    }
    const key = 'medconnect_doc_seq_' + series + '_' + year;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  }

  // Remember the clinic's medical-record number on the patient so it prefills
  // on the next letter. Best-effort — a failure here never blocks issuing.
  updatePatientRmNumber(patientId, rmNumber) {
    const p = this.data.patients.find(x => x.id === patientId);
    if (!p || !rmNumber || p.rm_number === rmNumber) return;
    p.rm_number = rmNumber;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(patientId).startsWith('id_')) {
      supabase.update('patients', patientId, { rm_number: rmNumber }).catch(() => {});
    }
  }

  // Continuous, system-assigned medical-record number (not reset per year) —
  // uses the doc_sequence with a fixed bucket so every patient gets a unique
  // running number. RPC-with-local-fallback like the other sequences.
  async getNextRmNumber() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const result = await supabase.rpc('get_next_doc_number', { p_series: 'RM', p_year: 0 });
        if (typeof result === 'number') return result;
      } catch (e) { console.warn('RM sequence RPC failed, using local fallback:', e); }
    }
    // Fallback: derive from the highest existing RM number across loaded patients
    // (deterministic & unique) instead of a per-device localStorage counter that
    // could drift or, if storage doesn't persist, hand out the same number twice.
    const maxRm = (this.data.patients || []).reduce((m, p) => {
      const n = parseInt(String(p.rm_number || '').replace(/\D/g, ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    return maxRm + 1;
  }

  // Assign a system RM number to a patient if they don't have one yet, persist
  // it, and return it. Idempotent — a patient keeps the same number forever.
  async ensureRmNumber(patientId) {
    const p = this.data.patients.find(x => x.id === patientId);
    if (!p) return '';
    if (p.rm_number) return p.rm_number;
    const num = await this.getNextRmNumber();
    const rm = String(num).padStart(6, '0');
    // Re-check after the await in case a concurrent call already assigned one.
    if (p.rm_number) return p.rm_number;
    this.updatePatientRmNumber(patientId, rm);
    return rm;
  }

  // One certificate number/QR per patient+vaccine pair — re-downloading reuses
  // the same record instead of minting a new sequential number each time.
  async getCertificateForPatientVaccine(patientId, vaccineName) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const results = await supabase.select('certificates', { eq: { patient_id: patientId, vaccine_name: vaccineName }, order: 'issued_at.desc', limit: 1 });
        if (results && results[0]) return results[0];
      } catch (e) { console.warn('Failed to look up existing certificate:', e); }
    }
    const local = (this.data.certificates || []).filter(c => c.patient_id === patientId && c.vaccine_name === vaccineName);
    return local.length ? local[local.length - 1] : null;
  }

  async updateCertificate(id, updates) {
    const local = (this.data.certificates || []).find(c => c.id === id);
    if (local) Object.assign(local, updates);
    this._save();
    if (!CONFIG.DEMO_MODE) {
      try { await supabase.update('certificates', id, updates); } catch (e) { console.warn('Failed to update certificate:', e); }
    }
  }

  // ---- SKD approval workflow (admin drafts → doctor ACCs) ----
  notifyDoctorPendingSKD(doctorId, patientName, jenis) {
    const d = this.data.doctors.find(x => x.id === doctorId);
    if (d && d.user_id) this.addNotification(d.user_id, 'Surat Menunggu ACC', `Surat Keterangan ${jenis} untuk ${patientName} menunggu persetujuan (ACC) Anda.`, 'system');
  }

  // SKD letters awaiting a given doctor's approval.
  async getPendingSKDForDoctor(doctorId) {
    let certs = [];
    if (!CONFIG.DEMO_MODE) {
      try { certs = await supabase.select('certificates', { eq: { cert_type: 'skd' }, order: 'issued_at.desc' }) || []; } catch (e) { certs = []; }
    }
    if (!certs.length) certs = (this.data.certificates || []).filter(c => c.cert_type === 'skd');
    return certs.filter(c => c.details && c.details.approval && c.details.approval.status === 'pending' && c.details.approval.doctor_id === doctorId);
  }

  async approveSKD(certId) {
    const cert = await this.getCertificateById(certId);
    if (!cert) return { error: 'Surat tidak ditemukan' };
    const prev = cert.details || {};
    const details = { ...prev, approval: { ...(prev.approval || {}), status: 'approved', reject_reason: '', approved_at: new Date().toISOString() } };
    await this.updateCertificate(certId, { details });
    // Let the admin who drafted it know it's now valid.
    if (prev.approval && prev.approval.created_by) {
      this.addNotification(prev.approval.created_by, 'Surat Disahkan', `Surat Keterangan ${cert.perihal || ''} untuk ${cert.patient_name || 'pasien'} (${cert.cert_number || ''}) telah disetujui (ACC) & sah.`, 'system');
    }
    return { success: true };
  }

  async rejectSKD(certId, reason) {
    const cert = await this.getCertificateById(certId);
    if (!cert) return { error: 'Surat tidak ditemukan' };
    const prev = cert.details || {};
    const details = { ...prev, approval: { ...(prev.approval || {}), status: 'rejected', reject_reason: reason || '' } };
    await this.updateCertificate(certId, { details });
    if (prev.approval && prev.approval.created_by) {
      this.addNotification(prev.approval.created_by, 'Surat Ditolak', `Surat Keterangan ${cert.perihal || ''} untuk ${cert.patient_name || 'pasien'} (${cert.cert_number || ''}) ditolak dokter.${reason ? ' Alasan: ' + reason : ''}`, 'system');
    }
    return { success: true };
  }

  // ---- Konfirmasi kehadiran pasien (public confirmation page) ----
  // Jam yang sudah terisi untuk dokter+tanggal (menandai slot penuh).
  async getTakenSlots(doctorId, date) {
    if (!doctorId || !date) return [];
    if (CONFIG.DEMO_MODE) {
      return (this.data.appointments || []).filter(a => a.doctor_id === doctorId && a.date === date && a.time_slot).map(a => a.time_slot);
    }
    try {
      const rows = await supabase.rpc('get_taken_slots', { p_doctor_id: doctorId, p_date: date });
      if (Array.isArray(rows)) return rows.map(r => r.time_slot).filter(Boolean);
    } catch (e) { /* ignore */ }
    return [];
  }

  // Clinic approves the patient's reschedule request → move the appointment.
  async approveReschedule(apptId) {
    const a = (this.data.appointments || []).find(x => x.id === apptId);
    if (!a) return { error: 'Jadwal tidak ditemukan' };
    if (!a.proposed_date) return { error: 'Tidak ada usulan tanggal dari pasien' };
    const updates = {
      date: a.proposed_date,
      time_slot: a.proposed_time || a.time_slot,
      patient_response: 'confirmed',
      patient_response_at: new Date().toISOString(),
      proposed_date: null,
      proposed_time: null,
    };
    Object.assign(a, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(apptId).startsWith('id_')) supabase.update('appointments', apptId, updates).catch(() => {});
    return { success: true, date: updates.date, time_slot: updates.time_slot };
  }


  async getAppointmentForConfirm(id) {
    if (CONFIG.DEMO_MODE) {
      const a = (this.data.appointments || []).find(x => x.id === id);
      if (!a) return null;
      const p = this.getPatient(a.patient_id); const d = this.getDoctor(a.doctor_id);
      return { ...a, patient_name: p?.full_name || '', doctor_name: d?.full_name || '' };
    }
    try {
      const rows = await supabase.rpc('get_appointment_for_confirm', { p_id: id });
      if (Array.isArray(rows) && rows[0]) return rows[0];
    } catch (e) { /* ignore */ }
    return null;
  }

  async submitAppointmentResponse(id, response, date, time, note) {
    if (CONFIG.DEMO_MODE) {
      const a = (this.data.appointments || []).find(x => x.id === id);
      if (a) { a.patient_response = response; a.patient_response_at = new Date().toISOString(); a.proposed_date = date || null; a.proposed_time = time || ''; a.response_note = note || ''; this._save(); }
      return { success: true };
    }
    try {
      await supabase.rpc('submit_appointment_response', { p_id: id, p_response: response, p_date: date || null, p_time: time || null, p_note: note || null });
      return { success: true };
    } catch (e) { return { error: e.message || 'Gagal menyimpan respons' }; }
  }

  // Record that a WhatsApp reminder was sent for an appointment/record.
  // Increments the counter + timestamp; returns the new count.
  logWaReminder(table, id) {
    const arr = table === 'appointments' ? this.data.appointments : this.data.medical_records;
    const item = (arr || []).find(x => x.id === id);
    if (!item) return 0;
    item.wa_reminder_count = (item.wa_reminder_count || 0) + 1;
    item.wa_last_sent_at = new Date().toISOString();
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update(table, id, { wa_reminder_count: item.wa_reminder_count, wa_last_sent_at: item.wa_last_sent_at }).catch(() => {});
    }
    return item.wa_reminder_count;
  }

  // ---- Lab & Radiologi (hasil penunjang) ----
  async getLabResults(patientId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('lab_results', { eq: { patient_id: patientId }, order: 'result_date.desc' });
        if (Array.isArray(rows)) return rows;
      } catch (e) { /* fall through to local */ }
    }
    return (this.data.lab_results || []).filter(l => l.patient_id === patientId).sort((a, b) => (b.result_date || '').localeCompare(a.result_date || ''));
  }

  // Bug reports — user-submitted issues, visible to staff in the admin console.
  async addBugReport(data) {
    const payload = {
      page: data.page || '', description: data.description || '',
      reporter_email: data.reporter_email || '', reporter_role: data.reporter_role || '', status: 'open',
    };
    if (data.reporter_profile_id && !String(data.reporter_profile_id).startsWith('id_')) payload.reporter_profile_id = data.reporter_profile_id;
    if (CONFIG.DEMO_MODE) {
      const rec = { id: generateId(), ...payload, created_at: new Date().toISOString() };
      if (!this.data.bug_reports) this.data.bug_reports = [];
      this.data.bug_reports.push(rec); this._save();
      return { success: true };
    }
    const inserted = await supabase.insert('bug_reports', payload);
    // RLS keeps non-staff from reading the row back, so an empty representation
    // (undefined) still means the insert landed — only a real error object fails.
    if (inserted && inserted.error) return { error: inserted.error };
    return { success: true };
  }

  async getBugReports() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('bug_reports', { order: 'created_at.desc' });
        if (Array.isArray(rows)) { this.data.bug_reports = rows; return rows; }
      } catch (e) { /* fall through to local */ }
    }
    return (this.data.bug_reports || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  async setBugReportStatus(id, status) {
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      await supabase.update('bug_reports', id, { status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).catch(() => {});
    }
    const r = (this.data.bug_reports || []).find(x => x.id === id);
    if (r) { r.status = status; this._save(); }
    return { success: true };
  }

  // ---- CRM: leads (calon pasien / prospek) --------------------------------
  async getLeads() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('leads', { order: 'created_at.desc' });
        if (Array.isArray(rows)) { this.data.leads = rows; return rows; }
      } catch (e) { /* fall through to local */ }
    }
    return (this.data.leads || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  async addLead(data) {
    const payload = {
      full_name: data.full_name || '', phone: data.phone || '', source: data.source || '',
      interest: data.interest || '', stage: data.stage || 'baru', notes: data.notes || '',
      next_followup: data.next_followup || null,
    };
    if (payload.next_followup === '') payload.next_followup = null;
    const cur = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (cur && cur.id && !String(cur.id).startsWith('id_')) payload.created_by = cur.id;
    if (CONFIG.DEMO_MODE) {
      const rec = { id: generateId(), ...payload, created_at: new Date().toISOString(), wa_count: 0 };
      if (!this.data.leads) this.data.leads = [];
      this.data.leads.unshift(rec); this._save();
      return { success: true, lead: rec };
    }
    const inserted = await supabase.insert('leads', payload);
    if (inserted && inserted.error) return { error: inserted.error };
    if (inserted && inserted.id) { if (!this.data.leads) this.data.leads = []; this.data.leads.unshift(inserted); this._save(); }
    return { success: true, lead: inserted || null };
  }

  async updateLead(id, patch) {
    const allowed = ['full_name', 'phone', 'source', 'interest', 'stage', 'notes', 'next_followup', 'pic_profile_id', 'converted_patient_id', 'wa_count', 'wa_last_at'];
    const clean = {};
    allowed.forEach(k => { if (patch[k] !== undefined) clean[k] = patch[k]; });
    if (clean.next_followup === '') clean.next_followup = null;
    ['pic_profile_id', 'converted_patient_id'].forEach(k => { if (clean[k] && String(clean[k]).startsWith('id_')) delete clean[k]; });
    clean.updated_at = new Date().toISOString();
    const l = (this.data.leads || []).find(x => x.id === id);
    if (l) { Object.assign(l, clean); this._save(); }
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      await supabase.update('leads', id, clean).catch(e => console.warn('Gagal menyimpan lead:', e));
    }
    return { success: true };
  }

  async deleteLead(id) {
    this.data.leads = (this.data.leads || []).filter(x => x.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) await supabase.delete('leads', id).catch(() => {});
    return { success: true };
  }

  async logLeadWa(id) {
    const l = (this.data.leads || []).find(x => x.id === id);
    const count = ((l && l.wa_count) || 0) + 1;
    const at = new Date().toISOString();
    if (l) { l.wa_count = count; l.wa_last_at = at; this._save(); }
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) await supabase.update('leads', id, { wa_count: count, wa_last_at: at }).catch(() => {});
    return { success: true };
  }

  // Turn a lead into a registered patient (reuses the email-optional register
  // flow), then mark the lead as converted so it lands in the "Jadi Pasien" stage.
  async convertLeadToPatient(lead) {
    const r = await this.register({ full_name: lead.full_name, phone: lead.phone || '' });
    if (r.error) return { error: r.error };
    const patientId = (r.profile && r.profile.id) ? r.profile.id : null;
    await this.updateLead(lead.id, { stage: 'pasien', converted_patient_id: patientId });
    return { success: true, patientId };
  }

  // ---- Stok Opening (import Excel harian) ---------------------------------
  async addStockOpening(data) {
    const payload = {
      opening_date: data.opening_date, filename: data.filename || '',
      columns: data.columns || [], rows: data.rows || [],
      name_col: data.name_col || '', stock_col: data.stock_col || '',
      low_threshold: data.low_threshold || 0, item_count: data.item_count || 0, low_count: data.low_count || 0,
    };
    const cur = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (cur && cur.id && !String(cur.id).startsWith('id_')) payload.uploaded_by = cur.id;
    if (CONFIG.DEMO_MODE) {
      const rec = { id: generateId(), ...payload, created_at: new Date().toISOString() };
      if (!this.data.stock_openings) this.data.stock_openings = [];
      this.data.stock_openings.unshift(rec); this._save();
      return { success: true, item: rec };
    }
    const inserted = await supabase.insert('stock_openings', payload);
    if (inserted && inserted.error) return { error: inserted.error };
    return { success: true, item: inserted || null };
  }

  // List = metadata only (never fetch the big rows JSONB for the list view).
  async getStockOpenings() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('stock_openings', { select: 'id,opening_date,filename,item_count,low_count,created_at', order: 'opening_date.desc', limit: 120 });
        if (Array.isArray(rows)) return rows;
      } catch (e) { /* fall through */ }
    }
    return (this.data.stock_openings || []).map(s => ({ id: s.id, opening_date: s.opening_date, filename: s.filename, item_count: s.item_count, low_count: s.low_count, created_at: s.created_at }))
      .sort((a, b) => (b.opening_date || '').localeCompare(a.opening_date || ''));
  }

  async getStockOpeningById(id) {
    if (!CONFIG.DEMO_MODE) {
      try { const rows = await supabase.select('stock_openings', { eq: { id }, limit: 1 }); if (Array.isArray(rows) && rows[0]) return rows[0]; } catch (e) { /* fall through */ }
    }
    return (this.data.stock_openings || []).find(s => s.id === id) || null;
  }

  async deleteStockOpening(id) {
    this.data.stock_openings = (this.data.stock_openings || []).filter(s => s.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) await supabase.delete('stock_openings', id).catch(() => {});
    return { success: true };
  }

  // Menerjemahkan galat Supabase Storage menjadi kalimat yang bisa
  // DIKERJAKAN orang yang membacanya.
  //
  // "Bucket not found" itu benar, tapi tidak memberi tahu siapa pun apa yang
  // harus dilakukan — yang membacanya tetap harus bertanya kepada orang lain
  // dulu. Di tempat lain aplikasi ini sudah menyebut nama berkas SQL-nya
  // langsung di pesan galat; penyimpanan berkas seharusnya sama.
  _pesanGalatStorage(galat, bucket, langkah) {
    const g = String(galat || '');
    if (/bucket not found/i.test(g)) {
      return 'Tempat penyimpanan belum dibuat di Supabase. Buka Storage → New bucket, '
        + 'beri nama ' + bucket + ' (' + langkah + '), lalu coba lagi.';
    }
    // 403 / RLS: embernya ada, tapi kebijakannya menolak. Penyebab tersering:
    // sesinya sudah kedaluwarsa, bukan kebijakannya yang salah.
    if (/row-level security|not authorized|403|permission denied/i.test(g)) {
      return 'Tidak diizinkan mengunggah ke ' + bucket + '. Coba keluar lalu masuk lagi; '
        + 'bila masih ditolak, periksa kebijakan Storage untuk bucket itu di Supabase.';
    }
    if (/413|payload too large|exceeded the maximum/i.test(g)) {
      return 'Berkasnya melebihi batas ukuran yang diizinkan server. Perkecil dulu berkasnya.';
    }
    if (/failed to fetch|networkerror|timeout|aborted/i.test(g)) {
      return 'Sambungan ke server terputus saat mengunggah. Periksa jaringan lalu coba lagi.';
    }
    return g;
  }

  async addLabResult(data, file) {
    let file_path = '', file_name = '';
    if (file) {
      file_name = file.name;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      file_path = `${data.patient_id}/${Date.now()}_${safeName}`;
      if (!CONFIG.DEMO_MODE) {
        const up = await supabase.uploadFile('lab-files', file_path, file);
        if (up && up.error) {
          return { error: 'Gagal mengunggah berkas: '
            + this._pesanGalatStorage(up.error, 'lab-files', 'JANGAN dicentang Public — isinya hasil pemeriksaan pasien') };
        }
      }
    }
    const payload = { ...data, file_path, file_name };
    if (payload.result_date === '') payload.result_date = null;
    // Never send client placeholder ids to UUID columns.
    ['patient_id', 'record_id', 'doctor_id'].forEach(k => { if (String(payload[k] || '').startsWith('id_')) payload[k] = null; });
    if (CONFIG.DEMO_MODE) {
      const rec = { id: generateId(), ...payload, created_at: new Date().toISOString() };
      if (!this.data.lab_results) this.data.lab_results = [];
      this.data.lab_results.push(rec); this._save();
      return { success: true, lab: rec };
    }
    const inserted = await supabase.insert('lab_results', payload);
    if (inserted && inserted.error) return { error: inserted.error };
    if (!this.data.lab_results) this.data.lab_results = [];
    if (inserted && inserted.id) this.data.lab_results.push(inserted);
    this._save();
    return { success: true, lab: inserted };
  }

  async deleteLabResult(id, filePath) {
    if (!CONFIG.DEMO_MODE) {
      if (filePath) supabase.removeFile('lab-files', filePath).catch(() => {});
      await supabase.delete('lab_results', id);
    }
    this.data.lab_results = (this.data.lab_results || []).filter(l => l.id !== id);
    this._save();
    return { success: true };
  }

  // Short-lived signed URL for viewing an uploaded penunjang file.
  async getLabFileUrl(filePath) {
    if (!filePath || CONFIG.DEMO_MODE) return null;
    const r = await supabase.signedUrl('lab-files', filePath);
    return (r && r.url) || null;
  }

  // All SKD letters for a patient (for the admin status list).
  async getSKDForPatient(patientId) {
    let certs = [];
    if (!CONFIG.DEMO_MODE) {
      try { certs = await supabase.select('certificates', { eq: { patient_id: patientId, cert_type: 'skd' }, order: 'issued_at.desc' }) || []; } catch (e) { certs = []; }
    }
    if (!certs.length) certs = (this.data.certificates || []).filter(c => c.cert_type === 'skd' && c.patient_id === patientId);
    return certs;
  }

  async loadFromSupabase() {
    if (CONFIG.DEMO_MODE) return;
    try {
      const [profiles, doctors, patients, pharmacies, records, prescriptions, rxItems, appointments, vaccinations, services, bookings, inventory, notifications, homeCareClaims, homeCareClaimItems, consultations, consultationMessages, articles] = await Promise.all([
        supabase.select('profiles'), supabase.select('doctors'), supabase.select('patients'),
        supabase.select('pharmacies'), supabase.select('medical_records', { order: 'visit_date.desc' }),
        supabase.select('prescriptions', { order: 'created_at.desc' }),
        supabase.select('prescription_items'), supabase.select('appointments'),
        supabase.select('vaccinations'), supabase.select('health_services'),
        supabase.select('bookings', { order: 'created_at.desc' }),
        supabase.select('inventory'), supabase.select('notifications', { order: 'created_at.desc' }),
        supabase.select('home_care_claims', { order: 'created_at.desc' }),
        supabase.select('home_care_claim_items'),
        supabase.select('consultations'),
        supabase.select('consultation_messages'),
        supabase.select('articles'),
      ]);
      // Map Supabase data to local format
      // can_notes IKUT DISALIN. Tanpa itu izinnya hanya bertahan sampai
      // halaman dimuat ulang: tombolnya ditekan, menunya muncul, lalu lenyap
      // begitu data profil diambil ulang dari server — dan yang mengalaminya
      // akan mengira fiturnya rusak, bukan mengira ada kolom yang tidak ikut
      // tersalin. Setiap kolom izin yang ditambahkan ke profiles harus
      // ditambahkan di sini juga.
      this.data.users = profiles.map(p => ({ id: p.id, email: p.email, role: p.role, is_active: p.is_active, auth_id: p.auth_id || null, no_email: isPlaceholderEmail(p.email), has_login: !!p.auth_id, password: '***', created_at: p.created_at, full_name: p.full_name || '', phone: p.phone || '', can_notes: p.can_notes === true, can_umroh: p.can_umroh === true }));
      if (doctors.length) this.data.doctors = doctors.map(d => ({ ...d, user_id: d.profile_id }));
      if (patients.length) this.data.patients = patients.map(p => ({ ...p, user_id: p.profile_id }));
      if (pharmacies.length) this.data.pharmacies = pharmacies.map(p => ({ ...p, user_id: p.profile_id }));
      if (records.length) this.data.medical_records = records;
      if (prescriptions.length) this.data.prescriptions = prescriptions;
      if (rxItems.length) this.data.prescription_items = rxItems;
      if (appointments.length) this.data.appointments = appointments;
      if (vaccinations.length) this.data.vaccinations = vaccinations;
      if (services.length) this.data.health_services = services;
      if (bookings.length) this.data.bookings = bookings;
      if (inventory.length) this.data.inventory = inventory;
      if (notifications.length) this.data.notifications = notifications.map(n => ({ ...n, user_id: n.profile_id }));
      if (homeCareClaims.length) this.data.home_care_claims = homeCareClaims;
      if (homeCareClaimItems.length) this.data.home_care_claim_items = homeCareClaimItems;
      if (consultations.length) this.data.consultations = consultations;
      if (consultationMessages.length) this.data.consultation_messages = consultationMessages;
      this.data.articles = articles;
      // Dimuat terpisah (bukan di Promise.all di atas) supaya bila tabel
      // practice_locations / tasks belum dibuat, sinkronisasi data lain tetap jalan.
      this.loadLocations().catch(() => {});
      this.loadTasks().catch(() => {});
      this.loadVaxPlanReminders().catch(() => {});
      this.loadAccessClaims().catch(() => {});
      try {
        const me = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
        // Penerima berbagi juga perlu memuatnya — RLS di server yang menyaring
        // baris mana yang benar-benar boleh dia baca.
        if (me && (this.canManageNotes(me) || this.canViewSharedNotes(me))) this.loadBusinessNotes(null).catch(() => {});
      } catch (e) {}
      this._save(this.data);
      console.log('Data loaded from Supabase:', { profiles: profiles.length, doctors: doctors.length, patients: patients.length });
    } catch (e) { console.warn('Failed to load from Supabase, using local data:', e); }
  }

  resetToDemo() {
    this.data = JSON.parse(JSON.stringify(DEMO_DATA));
    this._save();
  }

  // Auth
  login(email, password) {
    // In demo mode, check localStorage. In production, check Supabase profiles.
    // Note: In production with Supabase Auth, password check happens server-side.
    // For now, we match by email only (password stored in Supabase Auth, not in profiles).
    if (!CONFIG.DEMO_MODE) {
      const user = this.data.users.find(u => u.email === email && u.is_active);
      if (!user) return null;
      const profile = this.getProfile(user);
      return { user, profile };
    }
    const user = this.data.users.find(u => u.email === email && u.password === password && u.is_active);
    if (!user) return null;
    const profile = this.getProfile(user);
    return { user, profile };
  }

  async register(userData) {
    // Email is optional. When given, it must be unique (it's the login); when
    // blank, we register a login-less account under a unique placeholder email.
    const hasEmail = !!(userData.email && userData.email.trim());
    const email = hasEmail ? userData.email.trim() : placeholderEmail();
    if (hasEmail && this.data.users.find(u => u.email === email)) return { error: 'Email sudah terdaftar' };

    if (!CONFIG.DEMO_MODE) {
      try {
        // 1. Create auth user di Supabase — only when an email was provided.
        // Without an email there's nothing to log in with, so we skip auth
        // entirely (a synthetic address can't receive Supabase's confirmation
        // mail anyway) and leave auth_id null; an admin adds the login later.
        let authId = null;
        if (hasEmail) {
          const authRes = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/signup', {
            method: 'POST', headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: userData.password || 'default123' })
          }).then(r => r.json());
          if (authRes.error) return { error: authRes.error.message || authRes.msg || 'Gagal membuat akun login' };
          authId = authRes.user?.id || null;
        }

        // 2. Create profile di Supabase
        const profileRes = await supabase.insert('profiles', {
          email, role: 'patient', is_active: true, auth_id: authId
        });
        if (profileRes.error) return { error: profileRes.error };
        const profileId = profileRes.id;

        // 3. Create patient di Supabase — assign an RM number up front so every
        //    patient has one immediately, not only after their EMR is first opened.
        const patientPayload = {
          profile_id: profileId, full_name: userData.full_name, nik: userData.nik || '',
          birth_date: userData.birth_date || null, gender: userData.gender || '',
          phone: userData.phone || '', address: userData.address || '',
          blood_type: userData.blood_type || '', allergies: userData.allergies || '-',
          emergency_contact: userData.emergency_contact || '',
          family_name: userData.family_name || '', family_phone: userData.family_phone || '',
          family_relation: userData.family_relation || ''
        };
        try { const n = await this.getNextRmNumber(); if (n) patientPayload.rm_number = String(n).padStart(6, '0'); } catch (e) { /* assigned lazily later */ }
        await supabase.insert('patients', patientPayload);

        // 4. Reload data dari Supabase
        await this.loadFromSupabase();

        const user = this.data.users.find(u => u.email === email);
        const patient = this.data.patients.find(p => p.user_id === profileId);
        return { user: user || { id: profileId, email, role: 'patient' }, profile: patient };
      } catch(e) { return { error: 'Gagal menyimpan ke server: ' + e.message }; }
    }

    // Demo mode: localStorage only
    const userId = generateId();
    const user = { id: userId, email, password: userData.password, role: 'patient', is_active: true, created_at: new Date().toISOString().split('T')[0] };
    this.data.users.push(user);
    const patient = { id: generateId(), user_id: userId, full_name: userData.full_name, nik: userData.nik, birth_date: userData.birth_date, gender: userData.gender, phone: userData.phone, address: userData.address, blood_type: userData.blood_type || '', allergies: userData.allergies || '-', emergency_contact: userData.emergency_contact || '' };
    this.data.patients.push(patient);
    this._save();
    return { user, profile: patient };
  }

  getProfile(user) {
    switch (user.role) {
      case 'doctor': return this.data.doctors.find(d => d.user_id === user.id);
      // Owner = combined SuperAdmin + Dokter account — same doctor lookup as
      // 'doctor' (its linked doctors row is what makes /doctor/* pages work),
      // falling back to a generic label if that row hasn't been created yet.
      case 'owner': return this.data.doctors.find(d => d.user_id === user.id) || { full_name: user.full_name || 'Owner', phone: user.phone || '', role: 'owner' };
      case 'patient': return this.data.patients.find(p => p.user_id === user.id);
      case 'pharmacy': return this.data.pharmacies.find(ph => ph.user_id === user.id);
      // Super Admin tidak punya tabel profil tersendiri — namanya disimpan
      // langsung di profiles.full_name (lihat supabase-superadmin-staff.sql),
      // supaya beberapa Super Admin bisa dibedakan satu sama lain.
      case 'superadmin': {
        // Diambil dari baris profiles-nya, bukan dari objek sesi: objek sesi
        // dibekukan saat login dan tidak ikut berubah ketika izinnya diberikan
        // sesudah itu.
        const barisSA = (this.data.users || []).find(x => x.id === user.id) || {};
        return { full_name: user.full_name || barisSA.full_name || 'Super Admin',
          phone: user.phone || barisSA.phone || '', role: 'superadmin',
          can_notes: barisSA.can_notes === true,
          can_umroh: barisSA.can_umroh === true };
      }
      default: return null;
    }
  }

  // Users (Admin)
  // Super Admin dulu disembunyikan dari daftar ini karena hanya ada satu akun
  // bawaan. Sekarang boleh ada beberapa (Anis, Fitri, dst.), jadi mereka ikut
  // tampil supaya bisa dikelola — penghapusan Super Admin terakhir dicegah di
  // toggleUserActive/isLastSuperadmin.
  getUsers(roleFilter) {
    let users = this.data.users;
    if (roleFilter) users = users.filter(u => u.role === roleFilter);
    return users.map(u => ({ ...u, profile: this.getProfile(u) }));
  }

  // Menonaktifkan atau menghapus Super Admin terakhir akan mengunci semua
  // orang dari konsol admin, jadi ditolak.
  isLastSuperadmin(userId) {
    const u = this.data.users.find(x => x.id === userId);
    if (!u || u.role !== 'superadmin') return false;
    return this.data.users.filter(x => x.role === 'superadmin' && x.is_active !== false).length <= 1;
  }

  // Siapa yang boleh membuka panel "To-Do & Tugas": semua Super Admin, plus
  // akun pemilik klinik yang terdaftar di CONFIG.TASK_MANAGER_EMAILS.
  // Cadangan: kalau tidak satu pun e-mail itu terdaftar di sistem (mis. akun
  // pemiliknya memakai alamat lain), Owner tetap diizinkan supaya panelnya
  // tidak jadi tidak bisa dibuka siapa pun.
  canManageTasks(user) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    const allowed = (CONFIG.TASK_MANAGER_EMAILS || []).map(e => String(e).toLowerCase());
    const email = String(user.email || '').toLowerCase();
    if (allowed.includes(email)) return true;
    if (user.role === 'owner') {
      const anyListedAccountExists = (this.data.users || []).some(u => allowed.includes(String(u.email || '').toLowerCase()));
      if (!anyListedAccountExists) return true;
    }
    return false;
  }

  createUser(userData) {
    // Email optional (see register): blank → unique placeholder, no login.
    const hasEmail = !!(userData.email && userData.email.trim());
    const email = hasEmail ? userData.email.trim() : placeholderEmail();
    if (hasEmail && this.data.users.find(u => u.email === email)) return { error: 'Email sudah terdaftar' };
    if (userData.role === 'owner') {
      const currentUser = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      const ownerAlreadyExists = this.data.users.some(u => u.role === 'owner');
      if (currentUser?.role !== 'owner' && ownerAlreadyExists) return { error: 'Hanya akun Owner yang bisa membuat akun Owner baru' };
    }
    const userId = generateId();
    // full_name/phone ikut disimpan di baris user: untuk Super Admin inilah
    // satu-satunya tempat namanya tersimpan (tidak punya tabel profil sendiri);
    // untuk peran lain hanya jadi cadangan bila baris profilnya belum ada.
    const user = { id: userId, email, password: userData.password || 'default123', role: userData.role, is_active: true, no_email: !hasEmail, created_at: new Date().toISOString().split('T')[0], full_name: userData.full_name || '', phone: userData.phone || '' };
    this.data.users.push(user);
    if (userData.role === 'doctor' || userData.role === 'owner') {
      this.data.doctors.push({ id: generateId(), user_id: userId, full_name: userData.full_name, sip_number: userData.sip_number || '', specialization: userData.specialization || '', phone: userData.phone || '', is_available: true, schedule: { mon: '08:00-16:00', tue: '08:00-16:00', wed: '08:00-16:00', thu: '08:00-16:00', fri: '08:00-16:00', sat: null, sun: null } });
    } else if (userData.role === 'patient') {
      this.data.patients.push({ id: generateId(), user_id: userId, full_name: userData.full_name, nik: userData.nik || '', birth_date: userData.birth_date || '', gender: userData.gender || '', phone: userData.phone || '', address: userData.address || '', blood_type: userData.blood_type || '', allergies: userData.allergies || '-', emergency_contact: userData.emergency_contact || '' });
    } else if (userData.role === 'pharmacy') {
      this.data.pharmacies.push({ id: generateId(), user_id: userId, name: userData.name || userData.full_name, address: userData.address || '', phone: userData.phone || '', license_no: userData.license_no || '', operating_hours: userData.operating_hours || '',
        // Izin menyusun resep MATI secara bawaan. Memberi izin harus jadi
        // keputusan yang disadari, bukan sesuatu yang kebetulan menyala.
        can_prescribe: userData.can_prescribe === true });
      // Fasilitas berakun HARUS punya tempat praktik. Dibuatkan sekarang juga,
      // bukan diserahkan sebagai pekerjaan susulan yang mudah terlupa —
      // apotek tanpa tempat praktik tidak bisa membuat surat keterangan dan
      // resepnya tercetak dengan kop klinik lain.
      const phBaru = this.data.pharmacies[this.data.pharmacies.length - 1];
      this.ensureLocationForPharmacy(phBaru.id).catch(() => {});
    }
    this._save();
    return { user };
  }

  // Exposed so the admin/doctor UI shares one definition of the reserved
  // placeholder-email scheme used for accounts created without an email.
  makePlaceholderEmail() { return placeholderEmail(); }
  isPlaceholderEmail(email) { return isPlaceholderEmail(email); }

  updateUserEmail(userId, newEmail) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return { error: 'User tidak ditemukan' };
    const exists = this.data.users.find(u => u.email === newEmail && u.id !== userId);
    if (exists) return { error: 'Email sudah digunakan' };
    user.email = newEmail;
    this._save();
    return { success: true };
  }

  toggleUserActive(userId) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return { error: 'User tidak ditemukan' };
    if (user.role === 'owner' && user.is_active) {
      const activeOwners = this.data.users.filter(u => u.role === 'owner' && u.is_active);
      if (activeOwners.length <= 1) return { error: 'Tidak bisa menonaktifkan — minimal harus ada 1 akun Owner yang aktif' };
    }
    if (user.is_active && this.isLastSuperadmin(userId)) {
      return { error: 'Tidak bisa menonaktifkan — minimal harus ada 1 akun Super Admin yang aktif' };
    }
    user.is_active = !user.is_active;
    this._save();
    return { success: true };
  }

  // Patients
  //
  // SATU ATURAN PENCARIAN UNTUK SEMUA HALAMAN. Sebelumnya tiap halaman punya
  // aturannya sendiri: yang satu mencari nama+NIK+HP, yang lain menambahkan
  // No. RM, dan formulir resep apotek hanya mencari nama. Akibatnya petugas
  // yang terbiasa mengetik No. RM di satu halaman menemukan pasiennya, lalu
  // di halaman lain tidak — dan menyimpulkan pasiennya belum terdaftar.
  //
  // NOMOR HP DISAMAKAN DULU FORMATNYA ('0812…' menemukan '+62812…'), dan No.
  // RM dicocokkan tanpa nol di depannya, karena orang mengetik '31' untuk
  // mencari '000031'. Keduanya cara orang benar-benar mengetik, bukan cara
  // datanya kebetulan tersimpan.
  patientMatches(p, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    if (!p) return false;
    if (String(p.full_name || '').toLowerCase().includes(q)) return true;

    const angka = q.replace(/\D/g, '');
    if (!angka) return false;

    if (String(p.nik || '').replace(/\D/g, '').includes(angka)) return true;
    // Nomor HP: dibandingkan setelah 0/+62 disamakan.
    const hpCari = this.normalizePhone(q);
    if (hpCari && this.normalizePhone(p.phone).includes(hpCari)) return true;
    if (hpCari && this.normalizePhone(p.family_phone).includes(hpCari)) return true;
    // No. RM: '31' harus menemukan '000031'.
    const rm = String(p.rm_number || '').replace(/\D/g, '');
    if (rm && (rm.includes(angka) || String(Number(rm)) === String(Number(angka)))) return true;
    return false;
  }

  searchPatients(query, limit) {
    const hasil = (this.data.patients || []).filter(p => this.patientMatches(p, query));
    const max = Number(limit) || 0;
    return max > 0 ? hasil.slice(0, max) : hasil;
  }

  getPatients(search) {
    return this.searchPatients(search);
  }

  getPatient(patientId) { return this.data.patients.find(p => p.id === patientId); }

  getPatientByUserId(userId) { return this.data.patients.find(p => p.user_id === userId); }

  updatePatientProfile(patientId, updates) {
    const p = this.data.patients.find(x => x.id === patientId);
    if (!p) return { error: 'Pasien tidak ditemukan' };
    const allowed = ['full_name', 'nik', 'birth_date', 'gender', 'phone', 'address', 'blood_type', 'allergies', 'emergency_contact', 'rm_number', 'family_name', 'family_phone', 'family_relation'];
    const patch = {};
    allowed.forEach(k => { if (updates[k] !== undefined) { p[k] = updates[k]; patch[k] = updates[k]; } });
    // Empty date binds as '' which Postgres rejects for the DATE column, so
    // normalize it to null (same fix as sanitizeDates elsewhere).
    if (patch.birth_date === '') patch.birth_date = null;
    this._save();
    // Previously this only touched the local cache, so profile edits silently
    // never reached Supabase. Sync the changed fields so they persist.
    if (!CONFIG.DEMO_MODE && Object.keys(patch).length && !String(patientId).startsWith('id_')) {
      supabase.update('patients', patientId, patch).catch(e => console.warn('Gagal menyimpan profil pasien:', e));
    }
    return { success: true };
  }

  // Edit a doctor's registered identity (name, SIP, etc.) — used by the admin
  // panel so the SIP that prints on letters can be corrected in myprima.id.
  updateDoctorProfile(doctorId, updates) {
    const d = this.data.doctors.find(x => x.id === doctorId);
    if (!d) return { error: 'Dokter tidak ditemukan' };
    const allowed = ['full_name', 'sip_number', 'specialization', 'phone'];
    const patch = {};
    allowed.forEach(k => { if (updates[k] !== undefined) { d[k] = updates[k]; patch[k] = updates[k]; } });
    this._save();
    if (!CONFIG.DEMO_MODE && Object.keys(patch).length && !String(doctorId).startsWith('id_')) {
      supabase.update('doctors', doctorId, patch).catch(e => console.warn('Gagal menyimpan profil dokter:', e));
    }
    return { success: true };
  }

  // ==========================================================================
  // PRIVASI REKAM MEDIS: DOKTER HANYA MELIHAT PASIEN YANG IA TANGANI
  //
  // Sebelumnya setiap dokter bisa membuka rekam medis siapa pun — cukup tahu
  // atau menebak tautannya. Untuk klinik dengan satu dokter itu tidak terasa;
  // begitu ada beberapa dokter, artinya seluruh riwayat setiap pasien terbuka
  // bagi orang yang tidak pernah merawatnya.
  //
  // Aturannya: ada JEJAK PERAWATAN, atau tertutup. Jejaknya bisa apa pun yang
  // membuktikan pasien ini memang urusannya — rekam medis yang pernah ia
  // tulis, resep, vaksinasi, surat yang menunggu ACC-nya, atau janji temu yang
  // akan datang.
  //
  // Fungsi ini mengembalikan ALASANNYA, bukan sekadar true/false. Layar perlu
  // bisa menyebutkan kenapa sebuah rekam medis terbuka, dan izin yang tidak
  // bisa disebutkan sebabnya adalah izin yang tidak bisa diperiksa siapa pun.
  // ==========================================================================
  doctorPatientLink(doctorId, patientId) {
    const tutup = { boleh: false, alasan: '', sejak: '' };
    if (!doctorId || !patientId) return tutup;
    const bandingkan = (a) => String(a || '') === String(doctorId);

    const rec = (this.data.medical_records || [])
      .filter(r => r.patient_id === patientId && bandingkan(r.doctor_id))
      .sort((a, b) => String(b.visit_date || '').localeCompare(String(a.visit_date || '')))[0];
    if (rec) return { boleh: true, alasan: 'Pernah Anda periksa', sejak: String(rec.visit_date || '').slice(0, 10) };

    const vax = (this.data.vaccinations || []).find(v => v.patient_id === patientId
      && (bandingkan(v.administered_by) || bandingkan(v.approval_doctor_id)));
    if (vax) return { boleh: true, alasan: 'Vaksinasi atas nama Anda', sejak: String(vax.date_given || '').slice(0, 10) };

    const rx = (this.data.prescriptions || []).find(x => x.patient_id === patientId
      && (bandingkan(x.doctor_id) || bandingkan(x.approval_doctor_id)));
    if (rx) return { boleh: true, alasan: 'Resep atas nama Anda', sejak: String(rx.created_at || '').slice(0, 10) };

    const kons = (this.data.consultations || []).find(c => c.patient_id === patientId && bandingkan(c.doctor_id));
    if (kons) return { boleh: true, alasan: 'Konsultasi dengan Anda', sejak: String(kons.created_at || '').slice(0, 10) };

    // Janji temu: yang AKAN DATANG maupun yang sudah lewat sama-sama membuka
    // akses. Yang sudah lewat berarti pasiennya memang pernah dijadwalkan
    // kepadanya, dan riwayat itu tidak hilang hanya karena tanggalnya lewat.
    const apt = (this.data.appointments || [])
      .filter(a => a.patient_id === patientId && bandingkan(a.doctor_id))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (apt) {
      const akan = String(apt.date || '') >= todayLocal();
      return { boleh: true, alasan: akan ? 'Ada janji temu dengan Anda' : 'Pernah dijadwalkan ke Anda',
        sejak: String(apt.date || '').slice(0, 10) };
    }

    // Pintu darurat: dokter menyatakan sendiri akan memeriksa pasien ini.
    // Berlaku sementara dan SELALU tercatat — lihat claimPatientAccess.
    const klaim = (this.data.rm_access_claims || [])
      .filter(c => c.patient_id === patientId && bandingkan(c.doctor_id))
      .filter(c => !c.expires_at || String(c.expires_at) > new Date().toISOString())
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    if (klaim) return { boleh: true, alasan: 'Akses dibuka sendiri: ' + (klaim.reason || 'tanpa alasan'),
      sejak: String(klaim.created_at || '').slice(0, 10), klaim: true };

    return tutup;
  }

  // Satu pintu untuk semua layar. Pemilik klinik dan Super Admin tetap melihat
  // semuanya: merekalah yang mengurus kelengkapan rekam medis, menagih RM yang
  // belum ditulis, dan menyusun rekap — pekerjaan yang tidak bisa dikerjakan
  // dari potongan.
  recordAccess(user, patientId) {
    if (!user) return { boleh: false, alasan: '' };
    if (user.role === 'owner' || user.role === 'superadmin') {
      return { boleh: true, alasan: 'Akses pengelola klinik', penuh: true };
    }
    if (user.role === 'patient') {
      const p = this.getPatient(patientId);
      const milik = !!(p && (p.user_id === user.id || p.profile_id === user.id));
      return { boleh: milik, alasan: milik ? 'Rekam medis Anda sendiri' : '' };
    }
    if (user.role === 'doctor') {
      const d = this.getDoctorByUserId(user.id);
      return this.doctorPatientLink((d || {}).id, patientId);
    }
    // Apotek dan peran lain tidak punya urusan dengan isi rekam medis.
    return { boleh: false, alasan: '' };
  }

  canSeePatientRecords(user, patientId) { return this.recordAccess(user, patientId).boleh === true; }

  // Pencocokan No. RM PERSIS — bukan pencarian sebagian. Pencarian sebagian
  // atas seluruh pasien klinik akan mengembalikan kebocoran yang justru sedang
  // ditutup: satu huruf sudah cukup untuk menelusuri daftar nama.
  patientIdByRm(rm) {
    const cari = String(rm || '').trim().toLowerCase();
    if (!cari) return '';
    const p = (this.data.patients || []).find(x => String(x.rm_number || '').trim().toLowerCase() === cari);
    return p ? p.id : '';
  }

  // Pasien mana saja yang boleh dilihat seorang dokter. Dipakai daftar pasien
  // supaya yang muncul memang pasiennya, bukan seluruh isi klinik.
  patientIdsForDoctor(doctorId) {
    const set = new Set();
    if (!doctorId) return set;
    const sama = (a) => String(a || '') === String(doctorId);
    (this.data.medical_records || []).forEach(r => { if (sama(r.doctor_id)) set.add(r.patient_id); });
    (this.data.vaccinations || []).forEach(v => { if (sama(v.administered_by) || sama(v.approval_doctor_id)) set.add(v.patient_id); });
    (this.data.prescriptions || []).forEach(x => { if (sama(x.doctor_id) || sama(x.approval_doctor_id)) set.add(x.patient_id); });
    (this.data.consultations || []).forEach(c => { if (sama(c.doctor_id)) set.add(c.patient_id); });
    (this.data.appointments || []).forEach(a => { if (sama(a.doctor_id)) set.add(a.patient_id); });
    const kini = new Date().toISOString();
    (this.data.rm_access_claims || []).forEach(c => {
      if (sama(c.doctor_id) && (!c.expires_at || String(c.expires_at) > kini)) set.add(c.patient_id);
    });
    set.delete(undefined); set.delete(null); set.delete('');
    return set;
  }

  // Membuka akses ke pasien yang belum punya jejak — pasien baru yang berdiri
  // di depan meja, atau keadaan gawat.
  //
  // TIDAK ADA PENOLAKAN DI SINI, dan itu disengaja: menutup pintu ini berarti
  // dokter yang sedang menghadapi pasien tanpa riwayat tidak bisa melihat
  // alergi obatnya, dan bahaya itu jauh lebih besar daripada bahaya seseorang
  // membuka rekam medis yang bukan urusannya. Yang menggantikan penolakan
  // adalah JEJAK: siapa, kapan, pasien siapa, dan alasan yang ia tulis
  // sendiri. Pintu yang tercatat berbeda dari pintu yang terbuka.
  //
  // Berlaku 24 jam. Kalau dokternya benar memeriksa, rekam medis yang ia tulis
  // menjadi jejak permanennya; kalau tidak, aksesnya tertutup sendiri.
  async claimPatientAccess(patientId, alasan) {
    const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (!aku || aku.role !== 'doctor') return { error: 'Hanya akun dokter yang membuka akses lewat cara ini.' };
    const d = this.getDoctorByUserId(aku.id);
    if (!d) return { error: 'Data dokter tidak ditemukan.' };
    if (!this.getPatient(patientId)) return { error: 'Pasien tidak ditemukan.' };
    const teks = String(alasan || '').trim();
    if (teks.length < 4) return { error: 'Tuliskan dulu alasannya — keterangan ini yang menjelaskan pembukaan akses bila ditanyakan nanti.' };

    if (!this.data.rm_access_claims) this.data.rm_access_claims = [];
    const rec = {
      id: generateId(), doctor_id: d.id, patient_id: patientId, reason: teks,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    this.data.rm_access_claims.push(rec);
    this._save();
    if (!CONFIG.DEMO_MODE) {
      await this._syncInsert('rm_access_claims', rec, {
        id: rec.id, doctor_id: rec.doctor_id, patient_id: rec.patient_id,
        reason: rec.reason, created_at: rec.created_at, expires_at: rec.expires_at,
      });
    }
    // Pemilik klinik diberi tahu. Pembukaan akses yang tidak pernah dibaca
    // siapa pun sama saja dengan tidak dicatat.
    const nama = (this.getPatient(patientId) || {}).full_name || 'pasien';
    (this.data.users || []).filter(u => u.role === 'owner' && u.is_active !== false)
      .forEach(u => this.addNotification(u.id, 'Akses Rekam Medis Dibuka',
        (d.full_name || 'Seorang dokter') + ' membuka rekam medis ' + nama + '. Alasan: ' + teks, 'system'));
    return { success: true, klaim: rec };
  }

  patientAccessClaims(patientId) {
    return (this.data.rm_access_claims || [])
      .filter(c => !patientId || c.patient_id === patientId)
      .map(c => ({ ...c, doctor_name: (this.getDoctor(c.doctor_id) || {}).full_name || '' }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  async loadAccessClaims() {
    if (CONFIG.DEMO_MODE) return;
    const rows = await supabase.select('rm_access_claims', { order: 'created_at.desc' });
    if (Array.isArray(rows)) { this.data.rm_access_claims = rows; this._save(); }
  }

  // Medical Records — sorted by created_at (actual input time), not
  // visit_date (a date-only field the doctor sets, with no time-of-day) so
  // same-day records land in the order they were actually entered.
  getRecords(patientId) {
    return this.data.medical_records.filter(r => r.patient_id === patientId).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  getRecordsByDoctor(doctorId) {
    return this.data.medical_records.filter(r => r.doctor_id === doctorId).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  // Async (like createPrescription) so callers can wait for the server write
  // to land before using the record's id as a foreign key. createRecord used
  // to return immediately with the client-generated 'id_...' placeholder while
  // the real Supabase insert ran fire-and-forget — but the EMR "Buat E-Resep"
  // flow takes that returned id straight into createPrescription as record_id,
  // a UUID FK column. If the placeholder hadn't been patched to a real UUID
  // yet, Supabase rejected the prescription with "invalid input syntax for
  // type uuid: id_...". Awaiting the insert here means newRecord.id is the real
  // UUID by the time we return.
  async createRecord(record) {
    // created_at is set here (not left to the DB's default now()) so the
    // sort-by-input-time getters above have something to sort by in the
    // local optimistic copy immediately, before the next Supabase refresh.
    const newRecord = { id: generateId(), ...record, visit_date: record.visit_date || todayLocal(), created_at: new Date().toISOString() };
    this.data.medical_records.push(newRecord);
    if (record.follow_up_date) {
      const apt = { id: generateId(), patient_id: record.patient_id, doctor_id: record.doctor_id, date: record.follow_up_date, time_slot: '09:00', type: 'follow_up', status: 'scheduled', queue_number: null, notes: record.follow_up_notes || 'Kontrol ulang' };
      this.data.appointments.push(apt);
      this._syncInsert('appointments', apt);
    }
    this._save();
    // Insert with empty date strings normalized to null (see sanitizeDates)
    // — otherwise the whole insert fails and the record is stranded on its
    // client placeholder id, which then breaks any e-resep made for it.
    await this._syncInsert('medical_records', newRecord, sanitizeDates(newRecord, ['visit_date', 'follow_up_date']));
    return newRecord;
  }

  // Prescriptions — ordered by the linked medical record's created_at (when
  // the patient's visit was actually recorded), not the prescription row's
  // own created_at. A resep's own timestamp doesn't move when it's edited
  // (updatePrescription only touches the fields passed to it), but tying
  // the sort to the visit itself rather than to the resep row is the
  // robust choice: it can never let editing a resep shuffle it ahead of an
  // earlier patient in the pharmacy's queue, now or if that ever changes.
  _rxSortTime(rx) {
    const record = this.data.medical_records.find(r => r.id === rx.record_id);
    return (record && record.created_at) || rx.created_at || '';
  }

  getPrescriptionsByDoctor(doctorId) {
    return this.data.prescriptions.filter(rx => rx.doctor_id === doctorId).sort((a, b) => this._rxSortTime(b).localeCompare(this._rxSortTime(a)));
  }

  getPrescriptionsByPatient(patientId) {
    return this.data.prescriptions.filter(rx => rx.patient_id === patientId).sort((a, b) => this._rxSortTime(b).localeCompare(this._rxSortTime(a)));
  }

  getPrescriptionsByRecord(recordId) {
    return this.data.prescriptions.filter(rx => rx.record_id === recordId).sort((a, b) => this._rxSortTime(b).localeCompare(this._rxSortTime(a)));
  }

  // Antrean apotek TIDAK memuat resep yang masih menunggu ACC dokter. Ini
  // pengaman terpentingnya: resep yang belum disetujui tidak boleh terbaca
  // sebagai resep yang siap dilayani, walau apoteknya sendiri yang menyusun.
  getPrescriptionsByPharmacy(pharmacyId) {
    return this.data.prescriptions
      .filter(rx => rx.pharmacy_id === pharmacyId && !this.rxIsPending(rx))
      .sort((a, b) => this._rxSortTime(b).localeCompare(this._rxSortTime(a)));
  }

  // Re-fetches a pharmacy's prescriptions (+ items) from Supabase — same
  // staleness fix as fetchBookings/fetchHomeCareClaims, so a new e-resep sent
  // by a doctor shows up on the pharmacy dashboard without a manual reload.
  async fetchPrescriptionsForPharmacy(pharmacyId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const [prescriptions, items] = await Promise.all([
          supabase.select('prescriptions', { eq: { pharmacy_id: pharmacyId }, order: 'created_at.desc' }),
          supabase.select('prescription_items'),
        ]);
        if (prescriptions) this.data.prescriptions = (this.data.prescriptions || []).filter(rx => rx.pharmacy_id !== pharmacyId).concat(prescriptions);
        if (items) this.data.prescription_items = items;
        this._save();
      } catch (e) { console.warn('Gagal memuat resep:', e); }
    }
    return this.getPrescriptionsByPharmacy(pharmacyId);
  }

  getPrescriptionItems(prescriptionId) {
    return this.data.prescription_items.filter(i => i.prescription_id === prescriptionId);
  }

  // Async (unlike most other create* methods here) because a doctor sending a
  // prescription needs to know the write actually reached Supabase, not just
  // that it's sitting in the local cache — that gap is what let a "sent"
  // prescription silently vanish once the local cache was replaced by a
  // fresh, server-truth fetch. Success is judged by whether newRx.id got
  // patched from its client-generated 'id_...' placeholder to a real
  // Supabase UUID (see _syncInsert); if not, the insert never persisted.
  // =========================================================================
  // MENDAFTARKAN PASIEN BARU DARI MEJA DEPAN (dipakai halaman apotek)
  //
  // Resep tidak bisa ditulis untuk orang yang belum ada di daftar pasien,
  // sementara yang datang ke apotek sering belum pernah tercatat di klinik.
  // Karena itu apotek boleh mendaftarkannya sendiri. Mendaftarkan pasien
  // adalah pekerjaan administrasi, bukan keputusan klinis — jadi tidak perlu
  // menunggu ACC dokter. Yang tetap menunggu ACC adalah RESEPNYA.
  //
  // AKUNNYA DIBUAT TANPA LOGIN. Pasien yang didaftarkan di meja apotek tidak
  // sedang membuat akun aplikasi, dan menambalnya dengan alamat e-mail karangan
  // justru akan menghalangi dia mendaftar sendiri nanti. Super Admin bisa
  // mengisikan e-mail aslinya belakangan lewat Manajemen User untuk
  // mengaktifkan login — jalur yang memang sudah ada.
  //
  // YANG PALING BERBAHAYA DI SINI BUKAN SALAH KETIK, TAPI DUPLIKAT. Satu orang
  // yang terdaftar dua kali membuat riwayat obatnya terbelah, dan itu baru
  // ketahuan justru saat riwayatnya paling dibutuhkan. Karena itu ada dua
  // lapis: findSimilarPatients menampilkan calon kembarannya SEBELUM disimpan,
  // dan NIK yang sudah dipakai ditolak mentah-mentah.
  // =========================================================================

  // Satu nomor HP sering ditulis dengan banyak cara ('0812…', '+62812…',
  // '0812-3456'). Disamakan dulu, kalau tidak pencarian duplikat lolos hanya
  // karena bedanya cara menulis.
  normalizePhone(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('62')) d = '0' + d.slice(2);
    return d;
  }

  normalizeName(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Daftar alergi pasien, dipecah jadi kata kunci yang bisa dicocokkan dengan
  // nama obat. Ditaruh di store (bukan di dalam x-data) karena pemisahnya
  // memuat baris baru: satu karakter baris baru di dalam atribut x-data
  // memutus string JS-nya dan mematikan Alpine untuk seluruh halaman.
  patientAllergyTerms(patientId) {
    const p = this.getPatient(patientId) || {};
    return String(p.allergies || '')
      .split(/[,;/\n]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s && s !== '-');
  }

  // Pasien yang MUNGKIN orang yang sama. Ini peringatan, bukan penghalang:
  // nama yang sama persis itu lumrah di Indonesia, jadi yang memutuskan tetap
  // petugasnya. Yang benar-benar ditolak (NIK sama) diurus createPatientByStaff.
  findSimilarPatients(data, limit = 5) {
    const d = data || {};
    const nama = this.normalizeName(d.full_name);
    const hp = this.normalizePhone(d.phone);
    const nik = String(d.nik || '').replace(/\D/g, '');
    if (!nama && !hp && !nik) return [];
    const hasil = [];
    for (const p of (this.data.patients || [])) {
      const alasan = [];
      // Diurut dari yang paling meyakinkan: NIK menandai orang, nomor HP
      // menandai satu rumah tangga, nama hanya menandai kemungkinan.
      if (nik && String(p.nik || '').replace(/\D/g, '') === nik) alasan.push('NIK sama');
      if (hp && this.normalizePhone(p.phone) === hp) alasan.push('nomor HP sama');
      const namaP = this.normalizeName(p.full_name);
      if (nama && namaP && namaP === nama) alasan.push('nama sama persis');
      else if (nama.length >= 4 && namaP && (namaP.includes(nama) || nama.includes(namaP))) alasan.push('nama mirip');
      if (alasan.length) hasil.push({ ...p, match_reason: alasan.join(', '), match_score: alasan.length });
    }
    return hasil.sort((a, b) => b.match_score - a.match_score).slice(0, limit);
  }

  // opts: { byUserId, via } — jejak siapa yang mendaftarkan, lihat catatan
  // tentang kolom registered_by di bawah.
  async createPatientByStaff(data, opts) {
    const o = opts || {};
    const d = data || {};
    const nama = String(d.full_name || '').trim();
    if (!nama) return { success: false, error: 'Nama lengkap pasien wajib diisi.' };

    // Berlapis dengan RLS (is_staff() sudah menolaknya di server): akun pasien
    // tidak boleh membuatkan data pasien lain.
    try {
      const me = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      if (me && me.role === 'patient') return { success: false, error: 'Akun pasien tidak bisa mendaftarkan pasien lain.' };
    } catch (e) { /* sesi tidak terbaca — biarkan RLS yang memutuskan */ }

    // NIK adalah identitas tunggal. Kalau sudah dipakai, yang benar hampir
    // pasti memakai data yang sudah ada, bukan membuat data kedua.
    const nik = String(d.nik || '').replace(/\D/g, '');
    if (nik) {
      const kembar = (this.data.patients || []).find(p => String(p.nik || '').replace(/\D/g, '') === nik);
      if (kembar) return { success: false, error: 'NIK ini sudah terdaftar atas nama ' + (kembar.full_name || '-') + '. Pakai data pasien yang sudah ada saja.', existing: kembar };
    }

    const isi = {
      full_name: nama,
      nik: String(d.nik || '').trim(),
      birth_date: d.birth_date || null,
      gender: d.gender || '',
      phone: String(d.phone || '').trim(),
      address: String(d.address || '').trim(),
      blood_type: d.blood_type || '',
      allergies: String(d.allergies || '').trim() || '-',
      emergency_contact: '',
      family_name: String(d.family_name || '').trim(),
      family_phone: String(d.family_phone || '').trim(),
      family_relation: String(d.family_relation || '').trim(),
    };

    if (CONFIG.DEMO_MODE) {
      const userId = generateId();
      this.data.users.push({ id: userId, email: placeholderEmail(), password: 'default123', role: 'patient', is_active: true, no_email: true, created_at: todayLocal(), full_name: nama, phone: isi.phone });
      const baris = { id: generateId(), user_id: userId, rm_number: String(await this.getNextRmNumber()).padStart(6, '0'), registered_by: o.byUserId || null, registered_via: o.via || '', ...isi };
      this.data.patients.push(baris);
      this._save();
      return { success: true, patient: baris };
    }

    const profileRes = await supabase.insert('profiles', {
      email: placeholderEmail(), role: 'patient', is_active: true,
      full_name: nama, phone: isi.phone,
    });
    if (!profileRes || profileRes.error) return { success: false, error: (profileRes && profileRes.error) || 'Gagal membuat data pasien.' };

    const payload = { profile_id: profileRes.id, ...isi };
    // Nomor RM diberikan sejak awal, bukan menunggu rekam medisnya dibuka
    // pertama kali — apotek sering butuh menyebutnya di hari yang sama.
    try { const n = await this.getNextRmNumber(); if (n) payload.rm_number = String(n).padStart(6, '0'); } catch (e) { /* diberikan belakangan oleh ensureRmNumber */ }

    // Jejak "siapa yang mendaftarkan" baru ada setelah
    // supabase-pharmacy-add-patient.sql dijalankan. Kalau kolomnya belum ada,
    // PostgREST menolak SELURUH barisnya — bukan hanya kolom itu — sehingga
    // pasiennya gagal terdaftar sama sekali. Karena itu percobaan kedua
    // dilakukan tanpa jejaknya: yang hilang hanya catatan tambahan, bukan
    // pasiennya.
    let res = await supabase.insert('patients', { ...payload, registered_by: o.byUserId || null, registered_via: o.via || '' });
    if (res && res.error && /registered_(by|via)/.test(String(res.error))) {
      res = await supabase.insert('patients', payload);
    }
    if (!res || res.error) return { success: false, error: (res && res.error) || 'Gagal menyimpan data pasien.' };

    const baris = { ...res, user_id: res.profile_id };
    this.data.patients.push(baris);
    this.data.users.push({ id: profileRes.id, email: profileRes.email, role: 'patient', is_active: true, auth_id: null, no_email: true, has_login: false, password: '***', created_at: profileRes.created_at, full_name: nama, phone: isi.phone });
    this._save();
    return { success: true, patient: baris };
  }

  // =========================================================================
  // APOTEK MEMBUAT SURAT KETERANGAN DOKTER (SKD)
  //
  // Surat keterangan dibuat atas nama seorang dokter dan ditandatanganinya.
  // Karena itu apotek hanya boleh membuatkannya untuk DOKTER YANG BERPRAKTIK
  // DI TEMPAT ITU — bukan dokter mana pun yang kebetulan terdaftar di sistem.
  // Surat atas nama dokter yang tidak pernah berpraktik di sana adalah surat
  // yang tidak bisa dipertanggungjawabkan siapa pun.
  //
  // Yang menghubungkan keduanya adalah TEMPAT PRAKTIK:
  //
  //   pharmacies.location_id  →  practice_locations.id  ←  doctors.practice_places[].location_id
  //
  // Apotek mitra memang sudah didaftarkan sebagai tempat praktik di halaman
  // "Tempat Praktik & Kop" (lengkap dengan alamat dan kop-nya), jadi tidak ada
  // daftar tempat kedua yang harus dijaga tetap sama.
  //
  // Suratnya TETAP menunggu ACC dokter, persis seperti surat yang dibuat admin
  // klinik. Yang berubah hanya siapa yang boleh menyusun draftnya.
  // Lihat supabase-pharmacy-skd.sql.
  // =========================================================================

  // Tempat praktik yang mewakili sebuah apotek. Bila belum ditetapkan, dicoba
  // dicocokkan lewat namanya — apotek biasanya didaftarkan sebagai tempat
  // praktik dengan nama yang sama persis, jadi ini menyelamatkan data yang
  // sudah ada tanpa memaksa siapa pun mengisi ulang. Cocok-nama hanya cadangan;
  // begitu location_id diisi, itulah yang berlaku.
  pharmacyLocationId(pharmacyId) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (!ph) return '';
    if (ph.location_id) return ph.location_id;
    const nama = this.normalizeName(ph.name);
    if (!nama) return '';
    const l = (this.data.practice_locations || []).find(x => this.normalizeName(x.name) === nama);
    return (l && l.id) || '';
  }

  async setPharmacyLocation(pharmacyId, locationId) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (!ph) return { error: 'Apotek tidak ditemukan' };
    const id = locationId || null;
    if (id && !(this.data.practice_locations || []).some(l => l.id === id)) {
      return { error: 'Tempat praktik tidak ditemukan' };
    }
    ph.location_id = id;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(pharmacyId).startsWith('id_')) {
      supabase.update('pharmacies', pharmacyId, { location_id: id }).catch(() => {});
    }
    return { success: true, location_id: id };
  }

  // Dokter yang berpraktik di sebuah tempat. Sengaja TIDAK ada cadangan
  // "kalau kosong, kembalikan semua dokter": daftar kosong di sini artinya
  // memang belum ada dokter yang terdaftar praktik di situ, dan jawaban yang
  // benar adalah mengatakannya — bukan menawarkan dokter yang tidak berhak.
  doctorsAtLocation(locationId) {
    if (!locationId) return [];
    return (this.data.doctors || []).filter(d => this.doctorPracticeLocationIds(d.id).includes(locationId));
  }

  // Dokter yang boleh dijadikan penanggung jawab surat oleh sebuah apotek.
  doctorsForPharmacySKD(pharmacyId) {
    return this.doctorsAtLocation(this.pharmacyLocationId(pharmacyId));
  }

  // Gerbangnya. Dipanggil UI sebelum menyusun surat, DAN dipanggil ulang di
  // js/skd.js saat surat benar-benar dibuat — supaya pilihan dokter yang
  // sudah telanjur tersimpan di layar (mis. tempat praktiknya baru saja
  // diubah Super Admin) tidak bisa lolos hanya karena halamannya belum dimuat
  // ulang.
  canPharmacyIssueSKDFor(pharmacyId, doctorId) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (!ph) return { ok: false, error: 'Apotek tidak dikenali.' };
    const locId = this.pharmacyLocationId(pharmacyId);
    if (!locId) {
      return { ok: false, error: 'Apotek ini belum ditautkan ke tempat praktik mana pun. Minta Super Admin menautkannya lewat Manajemen User.' };
    }
    if (!doctorId) return { ok: false, error: 'Pilih dokter penanggung jawab surat terlebih dahulu.' };
    const dokter = this.getDoctor(doctorId);
    if (!dokter) return { ok: false, error: 'Dokter tidak ditemukan.' };
    if (!this.doctorPracticeLocationIds(doctorId).includes(locId)) {
      const tempat = (this.data.practice_locations || []).find(l => l.id === locId);
      return { ok: false, error: (dokter.full_name || 'Dokter ini') + ' tidak terdaftar berpraktik di ' + ((tempat && tempat.name) || 'tempat ini') + '. Surat keterangan hanya boleh atas nama dokter yang berpraktik di sini.' };
    }
    return { ok: true, location_id: locId };
  }

  // Surat yang disusun oleh seorang pengguna (dipakai halaman apotek untuk
  // menampilkan surat buatannya sendiri beserta statusnya).
  async getSKDCreatedBy(userId) {
    if (!userId) return [];
    let certs = [];
    if (!CONFIG.DEMO_MODE) {
      try { certs = await supabase.select('certificates', { eq: { cert_type: 'skd' }, order: 'issued_at.desc' }) || []; } catch (e) { certs = []; }
    }
    if (!certs.length) certs = (this.data.certificates || []).filter(c => c.cert_type === 'skd');
    return certs
      .filter(c => c.details && c.details.approval && c.details.approval.created_by === userId)
      .sort((a, b) => String(b.issued_at || '').localeCompare(String(a.issued_at || '')));
  }

  // =========================================================================
  // APOTEK MENULIS RESEP → WAJIB DI-ACC DOKTER
  //
  // Izinnya per apotek dan MATI secara bawaan. Resep yang lahir dari apotek
  // selalu berstatus menunggu ACC; tidak ada jalan lain membuatnya aktif.
  // Lihat supabase-pharmacy-prescribe.sql.
  // =========================================================================

  pharmacyCanPrescribe(pharmacyId) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    return !!(ph && ph.can_prescribe === true);
  }

  // Dipakai halaman apotek: apotek milik akun yang sedang login.
  pharmacyOfUser(userId) {
    return (this.data.pharmacies || []).find(p => p.user_id === userId) || null;
  }

  setPharmacyCanPrescribe(pharmacyId, allowed) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (!ph) return { error: 'Apotek tidak ditemukan' };
    ph.can_prescribe = allowed === true;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(pharmacyId).startsWith('id_')) {
      supabase.update('pharmacies', pharmacyId, { can_prescribe: ph.can_prescribe }).catch(() => {});
    }
    // Apoteknya diberi tahu — izin yang berubah diam-diam membingungkan, dan
    // yang dicabut izinnya perlu tahu kenapa menunya tiba-tiba hilang.
    if (ph.user_id) {
      this.addNotification(ph.user_id,
        ph.can_prescribe ? 'Izin Menyusun Resep Diberikan' : 'Izin Menyusun Resep Dicabut',
        ph.can_prescribe
          ? 'Apotek Anda kini boleh menyusun resep. Setiap resep yang Anda susun tetap harus di-ACC dokter sebelum berlaku.'
          : 'Apotek Anda tidak lagi boleh menyusun resep. Resep yang sudah di-ACC dokter tetap berlaku seperti biasa.',
        'system');
    }
    return { success: true, can_prescribe: ph.can_prescribe };
  }

  // Status persetujuan sebuah resep. Baris lama (semuanya ditulis dokter)
  // tidak punya kolom ini, jadi tanpa nilai berarti sudah sah.
  rxApprovalStatus(rx) { return (rx && rx.approval_status) || 'approved'; }
  rxIsPending(rx) { return this.rxApprovalStatus(rx) === 'pending'; }

  // Apotek menyusun resep. SELALU menunggu ACC — tidak ada parameter untuk
  // melewatinya, supaya tidak ada jalan pintas yang bisa dipanggil dari mana
  // pun kelak.
  async createPharmacyPrescription(rx, items, opts) {
    const o = opts || {};
    const pharmacyId = o.pharmacyId || rx.pharmacy_id;
    if (!this.pharmacyCanPrescribe(pharmacyId)) {
      return { success: false, error: 'Apotek ini tidak diberi izin menyusun resep. Hubungi Super Admin klinik.' };
    }
    const doctorId = o.doctorId || rx.approval_doctor_id;
    if (!doctorId) return { success: false, error: 'Pilih dokter yang akan meng-ACC resep ini terlebih dahulu.' };
    if (!rx.patient_id) return { success: false, error: 'Pilih pasiennya terlebih dahulu.' };
    const bersih = (items || []).filter(i => String((i && i.drug_name) || '').trim());
    if (!bersih.length) return { success: false, error: 'Isi minimal satu obat.' };

    // RACIKAN TANPA KOMPOSISI TIDAK ADA ARTINYA. Yang tercetak sebagai isi
    // resep racikan adalah komposisinya (lihat js/resep.js), dan yang harus
    // dinilai dokter saat meng-ACC juga komposisinya — bukan nama tampilnya.
    // Racikan berisi nama saja berarti dokter meng-ACC sesuatu yang tidak bisa
    // dia baca, dan apoteker meracik dari tebakan.
    const racikanKosong = bersih.findIndex(i => i.is_compound && !String(i.compound_details || '').trim());
    if (racikanKosong !== -1) {
      return { success: false, error: 'Racikan R/' + (racikanKosong + 1) + ' (' + String(bersih[racikanKosong].drug_name || '').trim() + ') belum diisi komposisinya. Komposisi inilah yang dibaca dokter saat meng-ACC dan yang tercetak di resep.' };
    }

    const res = await this.createPrescription({
      ...rx,
      pharmacy_id: pharmacyId,
      doctor_id: doctorId,
      approval_status: 'pending',
      approval_doctor_id: doctorId,
      drafted_by_pharmacy: pharmacyId,
    }, bersih);
    if (!res || !res.success) return res;

    const doc = this.getDoctor(doctorId);
    const patient = this.getPatient(rx.patient_id);
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (doc && doc.user_id) {
      this.addNotification(doc.user_id, 'Resep Menunggu ACC',
        `${(ph && ph.name) || 'Apotek'} menyusun resep ${res.rx.rx_number} untuk ${(patient && patient.full_name) || 'pasien'}. Resep ini belum berlaku sampai Anda menyetujuinya.`,
        'prescription');
    }
    return res;
  }

  // Dokter menyetujui: resepnya baru berlaku sejak detik ini.
  // opts.service_fee: jasa dokter yang boleh ditarik apotek dari pasien.
  // Ditentukan SAAT ACC, bukan saat apotek menyusun — apotek tidak berhak
  // menetapkan jasa dokter, dan dokternya baru tahu nilainya setelah membaca
  // resepnya.
  async approvePrescription(rxId, doctorId, note, opts) {
    const rx = (this.data.prescriptions || []).find(r => r.id === rxId);
    if (!rx) return { error: 'Resep tidak ditemukan' };
    if (!this.rxIsPending(rx)) return { error: 'Resep ini tidak sedang menunggu persetujuan.' };
    const o = opts || {};
    const fee = Math.max(0, Math.round(Number(o.service_fee) || 0));
    const feeOn = o.service_fee_enabled === true && fee > 0;
    const updates = {
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approval_note: String(note || '').trim(),
      // Sejak di-ACC, resepnya menjadi tanggung jawab dokter yang menyetujui.
      doctor_id: doctorId || rx.doctor_id,
      status: 'sent',
      service_fee_enabled: feeOn,
      service_fee: feeOn ? fee : 0,
    };
    Object.assign(rx, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(rxId).startsWith('id_')) {
      await supabase.update('prescriptions', rxId, updates).catch(() => null);
    }
    const ph = (this.data.pharmacies || []).find(p => p.id === rx.drafted_by_pharmacy || p.id === rx.pharmacy_id);
    if (ph && ph.user_id) {
      const jasa = updates.service_fee_enabled
        ? ` Jasa dokter Rp${Number(updates.service_fee).toLocaleString('id-ID')} mohon ditarik dari pasien.`
        : '';
      this.addNotification(ph.user_id, 'Resep Disetujui',
        `Resep ${rx.rx_number} sudah di-ACC dokter dan berlaku. Silakan dilayani.${jasa}`, 'prescription');
    }
    const pat = (this.data.patients || []).find(p => p.id === rx.patient_id);
    if (pat && pat.user_id) {
      this.addNotification(pat.user_id, 'Resep Dibuat',
        `Resep ${rx.rx_number} telah disetujui dokter.`, 'prescription');
    }
    return { success: true, rx };
  }

  // Ditolak. Alasannya wajib — resep yang dikembalikan tanpa keterangan hanya
  // akan disusun ulang dengan cara yang sama.
  async rejectPrescription(rxId, doctorId, reason) {
    const rx = (this.data.prescriptions || []).find(r => r.id === rxId);
    if (!rx) return { error: 'Resep tidak ditemukan' };
    if (!this.rxIsPending(rx)) return { error: 'Resep ini tidak sedang menunggu persetujuan.' };
    const clean = String(reason || '').trim();
    if (!clean) return { error: 'Tulis dulu alasan penolakannya.' };
    const updates = {
      approval_status: 'rejected',
      approval_note: clean,
      reject_reason: clean,
      status: 'rejected',
      approved_at: new Date().toISOString(),
    };
    Object.assign(rx, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(rxId).startsWith('id_')) {
      await supabase.update('prescriptions', rxId, updates).catch(() => null);
    }
    const ph = (this.data.pharmacies || []).find(p => p.id === rx.drafted_by_pharmacy || p.id === rx.pharmacy_id);
    if (ph && ph.user_id) {
      this.addNotification(ph.user_id, 'Resep Ditolak Dokter',
        `Resep ${rx.rx_number} tidak disetujui. Alasan: ${clean}`, 'prescription');
    }
    return { success: true, rx };
  }

  // ---- RESEP ULANG -------------------------------------------------------
  //
  // Apotek boleh menelusuri seluruh resep yang pernah sah, lalu mengulangnya.
  // Yang diulang hanya DAFTAR OBATNYA; resep ulangnya tetap resep baru yang
  // menunggu ACC dokter — sebab yang menjadikan sebuah resep sah adalah
  // keputusan dokter hari ini, bukan keputusan dokter tiga bulan lalu.
  //
  // Yang bisa dicari hanya resep yang SUDAH SAH. Resep yang masih menunggu
  // ACC atau pernah ditolak sengaja tidak bisa dijadikan sumber pengulangan.
  //
  // filter (opsional): { doctorId, fromDate, toDate }
  //
  // KANDUNGAN RACIKAN IKUT DICARI. Apoteker sering mencari dari isinya, bukan
  // dari nama tampilnya — "resep yang ada Codein-nya" tidak bisa ditemukan
  // lewat nama 'Obat Batuk Pilek'. Hasilnya menandai di mana kata itu ketemu
  // (match_in), supaya baris yang muncul karena kandungannya tidak terlihat
  // seperti hasil yang salah.
  searchPrescriptionsForRepeat(query, limit, filter) {
    const q = String(query || '').trim().toLowerCase();
    const max = Number(limit) || 25;
    const f = filter || {};
    const dokterId = f.doctorId || '';
    const dari = String(f.fromDate || '').slice(0, 10);
    const sampai = String(f.toDate || '').slice(0, 10);
    const hasil = [];
    const semua = (this.data.prescriptions || [])
      .filter(rx => this.rxApprovalStatus(rx) === 'approved' && rx.status !== 'cancelled')
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    for (const rx of semua) {
      if (dokterId && rx.doctor_id !== dokterId) continue;
      if (dari || sampai) {
        const tgl = String(rx.created_at || '').slice(0, 10);
        // Resep tanpa tanggal tidak bisa dibuktikan berada di dalam rentang
        // yang diminta, jadi tidak diikutkan. Rentang yang diam-diam
        // memasukkan baris tak bertanggal bukan rentang.
        if (!tgl) continue;
        if (dari && tgl < dari) continue;
        if (sampai && tgl > sampai) continue;
      }
      const pasien = this.getPatient(rx.patient_id);
      const items = this.getPrescriptionItems(rx.id);
      if (!items.length) continue;
      const cocokDi = [];
      if (q) {
        const cek = (teks) => String(teks || '').toLowerCase().includes(q);
        if (cek((pasien && pasien.full_name) || '')) cocokDi.push('pasien');
        if (cek(rx.rx_number)) cocokDi.push('no. resep');
        if (items.some(i => cek(i.drug_name))) cocokDi.push('nama obat');
        if (items.some(i => cek(i.compound_details))) cocokDi.push('kandungan');
        if (!cocokDi.length) continue;
      }
      hasil.push({
        match_in: cocokDi,
        // Potongan kandungan yang cocok — supaya terlihat KENAPA baris ini
        // muncul tanpa harus membuka resepnya satu per satu.
        match_kandungan: q
          ? (items.find(i => String(i.compound_details || '').toLowerCase().includes(q)) || {}).compound_details || ''
          : '',
        id: rx.id, rx_number: rx.rx_number || '', created_at: rx.created_at || '',
        patient_id: rx.patient_id, patient_name: (pasien && pasien.full_name) || 'Pasien',
        doctor_id: rx.doctor_id, doctor_name: (this.getDoctor(rx.doctor_id) || {}).full_name || '',
        // Racikan ikut dibawa utuh. Kalau tidak, "Sunting dulu" pada resep
        // ulang akan menyalin racikan menjadi obat biasa bernama sama —
        // komposisinya hilang diam-diam, dan yang tercetak nanti tinggal
        // namanya saja.
        items: items.map(i => ({
          drug_name: i.drug_name || '', dosage: i.dosage || '', frequency: i.frequency || '',
          time: i.time || '', quantity: i.quantity || '', unit: i.unit || '',
          duration: i.duration || '', instructions: i.instructions || '',
          is_compound: !!i.is_compound, compound_details: i.compound_details || '',
          display_name: i.display_name || '',
        })),
      });
      if (hasil.length >= max) break;
    }
    return hasil;
  }

  // Dokter yang benar-benar punya resep sah untuk diulang. Dipakai mengisi
  // saringan "Dokter" — daftar dokter lengkap akan memuat banyak nama yang
  // dipilih pun hasilnya nol, dan hasil nol itu terbaca seperti kesalahan.
  // Rentang tanggalnya ikut diperhitungkan supaya pilihannya tetap jujur
  // setelah rentangnya dipersempit.
  repeatSourceDoctors(filter) {
    const f = filter || {};
    const dari = String(f.fromDate || '').slice(0, 10);
    const sampai = String(f.toDate || '').slice(0, 10);
    const terlihat = new Map();
    for (const rx of (this.data.prescriptions || [])) {
      if (this.rxApprovalStatus(rx) !== 'approved' || rx.status === 'cancelled') continue;
      if (!rx.doctor_id || terlihat.has(rx.doctor_id)) continue;
      if (dari || sampai) {
        const tgl = String(rx.created_at || '').slice(0, 10);
        if (!tgl) continue;
        if (dari && tgl < dari) continue;
        if (sampai && tgl > sampai) continue;
      }
      if (!this.getPrescriptionItems(rx.id).length) continue;
      terlihat.set(rx.doctor_id, (this.getDoctor(rx.doctor_id) || {}).full_name || 'Dokter');
    }
    return [...terlihat.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Buat resep ulang dari sebuah resep lama. Selalu menunggu ACC.
  async repeatPrescription(sourceRxId, opts) {
    const o = opts || {};
    const src = (this.data.prescriptions || []).find(r => r.id === sourceRxId);
    if (!src) return { success: false, error: 'Resep sumber tidak ditemukan.' };
    if (this.rxApprovalStatus(src) !== 'approved') {
      return { success: false, error: 'Hanya resep yang sudah sah yang bisa diulang.' };
    }
    const items = this.getPrescriptionItems(sourceRxId).map(i => ({
      drug_name: i.drug_name, dosage: i.dosage, frequency: i.frequency, time: i.time,
      quantity: i.quantity, unit: i.unit, duration: i.duration, instructions: i.instructions,
      is_compound: i.is_compound, display_name: i.display_name, compound_details: i.compound_details,
    }));
    if (!items.length) return { success: false, error: 'Resep sumber tidak punya obat untuk diulang.' };
    const catatan = String(o.notes || '').trim();
    return this.createPharmacyPrescription({
      patient_id: src.patient_id,
      // Jejak asal-usulnya disimpan supaya dokter tahu ini pengulangan, dan
      // bisa menengok resep aslinya sebelum memutuskan.
      repeat_of: sourceRxId,
      notes: (catatan ? catatan + ' ' : '') + `(Resep ulang dari ${src.rx_number || 'resep sebelumnya'})`,
      record_id: null,
    }, items, { pharmacyId: o.pharmacyId, doctorId: o.doctorId });
  }

  // =========================================================================
  // KEWAJIBAN REKAM MEDIS
  //
  // Resep dan surat keterangan adalah TINDAKAN MEDIS. Begitu dokter meng-ACC
  // salah satunya, ia sudah membuat keputusan klinis atas nama pasien itu —
  // dan keputusan klinis harus ada rekam medisnya. Resep atau surat yang tidak
  // punya rekam medis adalah tindakan tanpa dasar tertulis: tidak bisa
  // ditelusuri, tidak bisa dipertanggungjawabkan bila dipersoalkan, dan
  // membuat riwayat pasiennya bolong justru di bagian yang paling penting.
  //
  // Yang menghubungkan keduanya sudah ada: prescriptions.record_id. Resep yang
  // ditulis dokter dari sebuah kunjungan otomatis terisi. Yang KOSONG adalah
  // resep yang lahir dari apotek — dan sejak apotek boleh menyusun resep serta
  // surat, lubang itu bertambah besar. Surat keterangan belum punya
  // penghubungnya sama sekali; itu yang ditambahkan (certificates.record_id).
  //
  // DIHITUNG SEBAGAI HUTANG HANYA YANG SUDAH SAH. Yang masih menunggu ACC atau
  // ditolak belum menjadi tindakan apa pun, jadi belum ada yang harus dicatat.
  //
  // Lihat supabase-rm-obligation.sql.
  // =========================================================================

  // Surat ini tanggung jawab dokter yang mana. Yang di-ACC menyebut dokternya
  // secara tegas; surat yang diterbitkan dokter sendiri tidak menyimpan id
  // itu, jadi dicocokkan lewat namanya — nama itulah yang tercetak di suratnya
  // dan yang akan ditanyakan orang bila surat itu dipersoalkan.
  _skdMilikDokter(cert, doctorId) {
    const a = (cert && cert.details && cert.details.approval) || {};
    if (a.doctor_id) return a.doctor_id === doctorId;
    const d = this.getDoctor(doctorId);
    if (!d || !d.full_name) return false;
    return this.normalizeName(cert.doctor_name) === this.normalizeName(d.full_name);
  }

  // Surat yang lahir dari sebuah kunjungan. Dipakai kartu kunjungan untuk
  // menunjukkan apa saja yang sudah diterbitkan dari situ — supaya dokter
  // tidak menerbitkan surat sakit kedua hanya karena yang pertama tidak
  // terlihat di layar yang sedang dibukanya.
  getCertificatesByRecord(recordId) {
    if (!recordId) return [];
    return (this.data.certificates || [])
      .filter(c => c.record_id === recordId || (c.details && c.details.record_id === recordId))
      .sort((a, b) => String(b.issued_at || '').localeCompare(String(a.issued_at || '')));
  }

  // Label jenis surat — satu tempat, supaya 'RUJUKAN' tidak muncul sebagai
  // 'Sakit' di layar mana pun hanya karena ada perbandingan yang lupa diubah.
  suratJenisLabel(cert) {
    const p = String((cert && cert.perihal) || '').toUpperCase();
    if (p === 'RUJUKAN') return 'Rujukan';
    if (p === 'SEHAT') return 'Sehat';
    return 'Sakit';
  }

  // Resep & surat SAH milik dokter ini yang belum punya rekam medis.
  rmDebtsForDoctor(doctorId) {
    if (!doctorId) return [];
    const hutang = [];

    for (const rx of (this.data.prescriptions || [])) {
      if (rx.doctor_id !== doctorId) continue;
      if (this.rxApprovalStatus(rx) !== 'approved') continue;
      if (rx.status === 'cancelled') continue;
      if (rx.record_id) continue;
      const obat = this.getPrescriptionItems(rx.id);
      hutang.push({
        kind: 'rx', id: rx.id,
        patient_id: rx.patient_id,
        patient_name: (this.getPatient(rx.patient_id) || {}).full_name || 'Pasien',
        date: String(rx.created_at || '').slice(0, 10),
        label: 'Resep ' + (rx.rx_number || ''),
        detail: obat.map(i => i.drug_name || '').filter(Boolean).join(', ') || '(tanpa obat tercatat)',
        from_pharmacy: !!rx.drafted_by_pharmacy,
      });
    }

    for (const c of (this.data.certificates || [])) {
      if (c.cert_type !== 'skd') continue;
      const status = (c.details && c.details.approval && c.details.approval.status) || 'approved';
      if (status !== 'approved') continue;
      if (c.record_id || (c.details && c.details.record_id)) continue;
      if (!this._skdMilikDokter(c, doctorId)) continue;
      const d = c.details || {};
      hutang.push({
        kind: 'skd', id: c.id,
        patient_id: c.patient_id,
        patient_name: c.patient_name || 'Pasien',
        date: String(d.letter_date || c.issued_at || '').slice(0, 10),
        label: 'Surat ' + this.suratJenisLabel(c) + ' ' + (c.cert_number || ''),
        detail: d.diagnosis || d.keperluan || d.tujuan_faskes || '(tanpa keterangan)',
        from_pharmacy: !!(d.approval && d.approval.by_pharmacy),
      });
    }

    // Yang paling lama menunggu didahulukan: hutang yang menua adalah hutang
    // yang paling sulit ditulis, karena dokternya sudah lupa kejadiannya.
    return hutang.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  rmDebtCount(doctorId) { return this.rmDebtsForDoctor(doctorId).length; }

  // Tautkan sebuah resep / surat ke rekam medis. Menolak menimpa tautan yang
  // sudah ada: menautkan ulang ke kunjungan lain diam-diam memindahkan dasar
  // sebuah tindakan, dan itu tidak boleh terjadi tanpa disadari.
  async linkRecordTo(kind, id, recordId) {
    if (!recordId) return { error: 'Rekam medis tidak disebutkan.' };
    const rec = (this.data.medical_records || []).find(r => r.id === recordId);
    if (!rec) return { error: 'Rekam medis tidak ditemukan.' };

    if (kind === 'rx') {
      const rx = (this.data.prescriptions || []).find(r => r.id === id);
      if (!rx) return { error: 'Resep tidak ditemukan.' };
      if (rx.record_id) return { error: 'Resep ini sudah tertaut ke rekam medis lain.' };
      if (rx.patient_id !== rec.patient_id) return { error: 'Rekam medis itu milik pasien yang berbeda.' };
      rx.record_id = recordId;
      this._save();
      if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_') && !String(recordId).startsWith('id_')) {
        supabase.update('prescriptions', id, { record_id: recordId }).catch(() => {});
      }
      return { success: true };
    }

    if (kind === 'skd') {
      const c = (this.data.certificates || []).find(x => x.id === id);
      if (!c) return { error: 'Surat tidak ditemukan.' };
      if (c.record_id) return { error: 'Surat ini sudah tertaut ke rekam medis lain.' };
      if (c.patient_id && rec.patient_id && c.patient_id !== rec.patient_id) {
        return { error: 'Rekam medis itu milik pasien yang berbeda.' };
      }
      c.record_id = recordId;
      this._save();
      if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_') && !String(recordId).startsWith('id_')) {
        // Kolomnya baru ada setelah supabase-rm-obligation.sql dijalankan.
        // Kalau belum, tautannya tetap tersimpan lokal dan tercatat ulang saat
        // SQL-nya dijalankan — bukan hilang tanpa kabar.
        supabase.update('certificates', id, { record_id: recordId }).catch(() => {});
      }
      return { success: true };
    }

    return { error: 'Jenis dokumen tidak dikenal.' };
  }

  // =========================================================================
  // REKAP BULANAN
  //
  // Rekap umroh sudah ada, tapi belum ada gambaran keseluruhan: berapa
  // kunjungan, resep, surat, dan vaksinasi dalam sebulan — per dokter dan per
  // tempat praktik. Sekarang angkanya bisa dipercaya justru karena resep dan
  // surat sudah wajib punya rekam medis: yang dihitung bukan lagi sekumpulan
  // catatan lepas.
  //
  // YANG DIHITUNG HANYA YANG SAH. Resep yang menunggu ACC atau ditolak, dan
  // surat yang belum disahkan, tidak masuk hitungan — belum menjadi tindakan
  // apa pun. Rekap yang memasukkannya akan melaporkan pekerjaan yang tidak
  // pernah terjadi.
  // =========================================================================

  // 'YYYY-MM' dari sebuah tanggal/timestamp, atau '' bila tidak bertanggal.
  _bulanDari(v) {
    const s = String(v || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(s) ? s : '';
  }

  // Bulan-bulan yang benar-benar ada isinya, terbaru dulu.
  monthsWithActivity(limit) {
    const set = new Set();
    (this.data.medical_records || []).forEach(r => { const b = this._bulanDari(r.visit_date); if (b) set.add(b); });
    (this.data.prescriptions || []).forEach(r => { const b = this._bulanDari(r.created_at); if (b) set.add(b); });
    (this.data.vaccinations || []).forEach(v => { const b = this._bulanDari(v.date_given); if (b) set.add(b); });
    const daftar = [...set].sort().reverse();
    const max = Number(limit) || 0;
    return max > 0 ? daftar.slice(0, max) : daftar;
  }

  monthlyRecap(bulan) {
    const b = this._bulanDari(bulan) || this._bulanDari(todayLocal());
    const perDokter = new Map();
    const perTempat = new Map();
    const ambilDokter = (id) => {
      const k = id || '(tanpa dokter)';
      if (!perDokter.has(k)) perDokter.set(k, { id: k, nama: (this.getDoctor(id) || {}).full_name || 'Tanpa dokter', kunjungan: 0, resep: 0, surat: 0, vaksinasi: 0 });
      return perDokter.get(k);
    };
    const ambilTempat = (nama) => {
      const k = String(nama || '').trim() || '(tidak dicatat)';
      if (!perTempat.has(k)) perTempat.set(k, { nama: k, kunjungan: 0, vaksinasi: 0 });
      return perTempat.get(k);
    };

    const pasien = new Set();
    let kunjungan = 0, resep = 0, resepApotek = 0, surat = 0, vaksinasi = 0, jasaDokter = 0;

    for (const r of (this.data.medical_records || [])) {
      if (this._bulanDari(r.visit_date) !== b) continue;
      kunjungan++;
      if (r.patient_id) pasien.add(r.patient_id);
      ambilDokter(r.doctor_id).kunjungan++;
      ambilTempat(r.location).kunjungan++;
    }

    for (const rx of (this.data.prescriptions || [])) {
      if (this._bulanDari(rx.created_at) !== b) continue;
      if (this.rxApprovalStatus(rx) !== 'approved' || rx.status === 'cancelled') continue;
      resep++;
      if (rx.drafted_by_pharmacy) resepApotek++;
      if (rx.service_fee_enabled) jasaDokter += Number(rx.service_fee) || 0;
      if (rx.patient_id) pasien.add(rx.patient_id);
      ambilDokter(rx.doctor_id).resep++;
    }

    for (const c of (this.data.certificates || [])) {
      if (c.cert_type !== 'skd') continue;
      const d = c.details || {};
      if (this._bulanDari(d.letter_date || c.issued_at) !== b) continue;
      if (((d.approval && d.approval.status) || 'approved') !== 'approved') continue;
      surat++;
      if (c.patient_id) pasien.add(c.patient_id);
      const dok = (this.data.doctors || []).find(x => this.normalizeName(x.full_name) === this.normalizeName(c.doctor_name));
      ambilDokter((d.approval && d.approval.doctor_id) || (dok && dok.id) || '').surat++;
    }

    for (const v of (this.data.vaccinations || [])) {
      if (this._bulanDari(v.date_given) !== b) continue;
      if (this.vaxApprovalStatus(v) !== 'approved') continue;
      vaksinasi++;
      if (v.patient_id) pasien.add(v.patient_id);
      ambilDokter(v.administered_by).vaksinasi++;
      ambilTempat(v.location).vaksinasi++;
    }

    const urut = (a, c) => (c.kunjungan + c.resep + c.surat + c.vaksinasi) - (a.kunjungan + a.resep + a.surat + a.vaksinasi);
    return {
      bulan: b,
      kunjungan, resep, resep_apotek: resepApotek, surat, vaksinasi,
      pasien_dilayani: pasien.size,
      jasa_dokter: jasaDokter,
      per_dokter: [...perDokter.values()].sort(urut),
      per_tempat: [...perTempat.values()].sort((a, c) => (c.kunjungan + c.vaksinasi) - (a.kunjungan + a.vaksinasi)),
    };
  }

  // =========================================================================
  // YANG JATUH TEMPO: KONTROL ULANG & DOSIS VAKSIN BERIKUTNYA
  //
  // Tanggalnya sudah lama dicatat — medical_records.follow_up_date diisi
  // dokter setiap kunjungan, dan vaccinations.next_dose_date diisi saat
  // vaksinasi dicatat. Tapi tidak ada satu pun layar yang menjawab pertanyaan
  // yang sebenarnya: SIAPA yang jatuh tempo minggu ini. Jadi tanggal itu cuma
  // tersimpan, dan pasien yang tidak kembali tidak pernah ketahuan tidak
  // kembali.
  //
  // Untuk vaksin berseri akibatnya paling nyata: dosis kedua yang terlewat
  // bukan hanya jadwal yang meleset — serinya tidak selesai, dan pasiennya
  // tetap tidak terlindungi walaupun sudah membayar dosis pertama.
  //
  // YANG LEWAT TETAP DITAMPILKAN, tidak dibuang begitu tanggalnya lewat.
  // Justru yang sudah lewat itulah yang paling perlu dikejar; daftar yang
  // hanya menampilkan "akan datang" diam-diam memaafkan semua yang telanjur
  // terlewat.
  // =========================================================================

  // opts: { fromDate, toDate, kind: 'kontrol'|'vaksin'|'' , doctorId }
  dueReminders(opts) {
    const o = opts || {};
    const hariIni = todayLocal();
    const dari = String(o.fromDate || shiftDate(hariIni, -60)).slice(0, 10);
    const sampai = String(o.toDate || shiftDate(hariIni, 14)).slice(0, 10);
    const jenis = o.kind || '';
    const hasil = [];

    if (jenis !== 'vaksin') {
      for (const r of (this.data.medical_records || [])) {
        const tgl = String(r.follow_up_date || '').slice(0, 10);
        if (!tgl || tgl < dari || tgl > sampai) continue;
        if (o.doctorId && r.doctor_id !== o.doctorId) continue;
        const p = this.getPatient(r.patient_id);
        if (!p) continue;
        hasil.push({
          kind: 'kontrol', id: r.id, patient_id: p.id, patient_name: p.full_name || 'Pasien',
          phone: p.phone || '', family_phone: p.family_phone || '', family_relation: p.family_relation || '',
          due: tgl, days: this._selisihHari(tgl),
          doctor_id: r.doctor_id, doctor_name: (this.getDoctor(r.doctor_id) || {}).full_name || '',
          title: 'Kontrol ulang', detail: r.follow_up_notes || r.diagnosis || '',
          sent_count: Number(r.wa_reminder_count) || 0, last_sent: r.wa_last_sent_at || '',
        });
      }
    }

    if (jenis !== 'kontrol') {
      // -------------------------------------------------------------------
      // ANAK: pengingatnya DIHITUNG dari jadwal IDAI, bukan dibaca dari
      // next_dose_date.
      //
      // Sebelumnya ada dua sumber kebenaran untuk "kapan dosis berikutnya",
      // dan keduanya tidak pernah saling melihat: pengingat memakai
      // next_dose_date yang diketik tangan saat dosis sebelumnya dicatat,
      // sementara kartu di layar memakai tanggal hitungan. Begitu satu dosis
      // tertunda, tanggal ketikan itu tidak ikut bergeser — orang tua menerima
      // WA "waktunya dosis 2" sementara aplikasinya berkata "belum waktunya".
      // Untuk keluarga, aplikasi yang berbicara dua hal berbeda lebih buruk
      // daripada aplikasi yang diam.
      //
      // Dan ada yang lebih buruk lagi: pengingat lama hanya lahir DARI baris
      // vaksinasi yang sudah ada. Anak yang belum pernah divaksin sama sekali
      // tidak punya baris apa pun, jadi tidak pernah diingatkan — justru anak
      // yang paling perlu dikejar adalah yang paling tidak terlihat.
      const ditanganiIdai = new Set();
      for (const p of (this.data.patients || [])) {
        if (!this.isAnak(p, hariIni)) continue;
        const plan = this.childVaxPlan(p.id, { today: hariIni });
        if (plan.error) continue;
        for (const it of plan.items) {
          // Serinya tetap ditandai walau tanggalnya di luar rentang, supaya
          // jalur next_dose_date di bawah tidak ikut memunculkannya lagi.
          ditanganiIdai.add(p.id + '::' + it.key);
          if (!it.berikut) continue;
          // 'boleh' dan 'belum_waktunya' tidak diingatkan: belum ada yang
          // terlewat, dan menagih sesuatu yang belum jatuh tempo membuat
          // pengingat berikutnya ikut diabaikan.
          if (!['terlambat', 'jatuh_tempo', 'perlu_dinilai_dokter'].includes(it.status)) continue;
          const tgl = String(it.berikut.dianjurkan || '').slice(0, 10);
          if (!tgl || tgl > sampai) continue;
          // Batas BAWAH bawaan (60 hari ke belakang) sengaja tidak diterapkan
          // pada seri IDAI. Anak yang tertinggal setengah tahun tanggal
          // anjurannya memang jauh di belakang — kalau ia disaring keluar,
          // yang tersisa di daftar justru cuma yang hampir tepat waktu, dan
          // yang paling perlu dikejar hilang lagi seperti sebelumnya. Kalau
          // petugas MENGISI sendiri tanggal mulainya, itu keinginan yang
          // dinyatakan dan tetap dihormati.
          if (o.fromDate && tgl < dari) continue;
          // Serinya diatribusikan ke dokter yang memberi dosis TERAKHIR — itu
          // yang membuat saringan "per dokter" tetap masuk akal. Anak yang
          // belum pernah disuntik sama sekali tidak punya dokter, jadi ia
          // hanya muncul saat saringannya kosong; kalau tidak, ia akan
          // menempel pada dokter mana pun yang kebetulan dipilih.
          const dosisTerakhir = (this._dosisSeri(p.id, it.key).slice(-1)[0]) || null;
          const dokterId = (dosisTerakhir || {}).administered_by || '';
          if (o.doctorId && dokterId !== o.doctorId) continue;
          hasil.push({
            kind: 'vaksin', id: 'plan:' + p.id + ':' + it.key,
            patient_id: p.id, patient_name: p.full_name || 'Pasien',
            phone: p.phone || '', family_phone: p.family_phone || '', family_relation: p.family_relation || '',
            due: tgl, days: this._selisihHari(tgl),
            doctor_id: dokterId, doctor_name: (this.getDoctor(dokterId) || {}).full_name || '',
            title: it.nama, detail: it.berikut.label + ' — ' + it.statusLabel,
            vaccine_name: it.nama, sumber: 'idai', series_key: it.key,
            ...this._planReminderCount(p.id, it.key),
          });
        }
      }

      for (const v of (this.data.vaccinations || [])) {
        const tgl = String(v.next_dose_date || '').slice(0, 10);
        if (!tgl || tgl < dari || tgl > sampai) continue;
        // Sudah diurus jadwal IDAI di atas — jangan diingatkan dua kali dengan
        // dua tanggal yang bisa berbeda. Vaksin anak yang memang TIDAK ada di
        // jadwal IDAI (meningitis untuk umroh, misalnya) tidak kena saringan
        // ini dan tetap lewat jalur next_dose_date.
        if (this.vaxSeriesKeys(v.vaccine_name, v.vaccine_brand, v.series_key)
          .some(k => ditanganiIdai.has(v.patient_id + '::' + k))) continue;
        // Vaksinasi yang belum di-ACC dokter belum sah; mengingatkan dosis
        // berikutnya dari catatan yang mungkin ditolak berarti memanggil
        // pasien untuk sesuatu yang belum tentu terjadi.
        if (this.vaxApprovalStatus(v) !== 'approved') continue;
        if (o.doctorId && v.administered_by !== o.doctorId) continue;
        const p = this.getPatient(v.patient_id);
        if (!p) continue;
        // Dosis yang sudah telanjur diberikan tidak perlu diingatkan lagi:
        // ada baris vaksinasi lain, vaksin sama, yang diberikan PADA/SESUDAH
        // tanggal jatuh temponya.
        const sudahLanjut = (this.data.vaccinations || []).some(x =>
          x.id !== v.id && x.patient_id === v.patient_id
          && this.normalizeName(x.vaccine_name) === this.normalizeName(v.vaccine_name)
          && String(x.date_given || '').slice(0, 10) >= tgl);
        if (sudahLanjut) continue;
        const berikut = v.vax_mode === 'booster'
          ? 'Booster berikutnya'
          : 'Dosis ke-' + ((Number(v.dose_number) || 1) + 1) + (v.total_doses ? ' dari ' + v.total_doses : '');
        hasil.push({
          kind: 'vaksin', id: v.id, patient_id: p.id, patient_name: p.full_name || 'Pasien',
          phone: p.phone || '', family_phone: p.family_phone || '', family_relation: p.family_relation || '',
          due: tgl, days: this._selisihHari(tgl),
          doctor_id: v.administered_by, doctor_name: (this.getDoctor(v.administered_by) || {}).full_name || '',
          title: v.vaccine_name || 'Vaksinasi', detail: berikut,
          vaccine_name: v.vaccine_name || '',
          sent_count: Number(v.wa_reminder_count) || 0, last_sent: v.wa_last_sent_at || '',
        });
      }
    }

    // Yang paling lama terlewat didahulukan; yang belum jatuh tempo di
    // belakang. Urutan inilah daftar kerjanya.
    return hasil.sort((a, b) => String(a.due).localeCompare(String(b.due)));
  }

  // `daftar` boleh dioper oleh pemanggil yang baru saja memanggil dueReminders
  // dengan opts yang sama — halaman pengingat melakukannya. Tanpa itu seluruh
  // jadwal setiap anak dihitung dua kali untuk satu layar.
  dueReminderCounts(opts, daftar) {
    const d = Array.isArray(daftar) ? daftar : this.dueReminders(opts);
    const hariIni = todayLocal();
    return {
      total: d.length,
      lewat: d.filter(x => x.due < hariIni).length,
      hariIni: d.filter(x => x.due === hariIni).length,
      akan: d.filter(x => x.due > hariIni).length,
    };
  }

  // Menandai sebuah pengingat sudah dikirim. Hitungannya disimpan supaya
  // terlihat siapa yang sudah berkali-kali diingatkan tapi tetap tidak datang
  // — itu keadaan yang berbeda dari belum pernah dihubungi sama sekali.
  // Hitungan pengingat untuk seri yang berasal dari jadwal IDAI.
  //
  // Tidak bisa menumpang kolom di baris vaksinasi seperti pengingat lama,
  // karena justru kasus yang paling penting TIDAK PUNYA baris vaksinasi: anak
  // yang belum pernah disuntik sama sekali. Maka hitungannya disimpan per
  // (pasien, seri) di tabelnya sendiri.
  async loadVaxPlanReminders() {
    if (CONFIG.DEMO_MODE) return;
    const rows = await supabase.select('vax_plan_reminders');
    if (Array.isArray(rows)) { this.data.vax_plan_reminders = rows; this._save(); }
  }

  _planReminderRow(patientId, seriesKey) {
    return (this.data.vax_plan_reminders || [])
      .find(x => x.patient_id === patientId && x.series_key === seriesKey) || null;
  }

  _planReminderCount(patientId, seriesKey) {
    const r = this._planReminderRow(patientId, seriesKey);
    return { sent_count: Number((r || {}).wa_reminder_count) || 0, last_sent: (r || {}).wa_last_sent_at || '' };
  }

  async _markPlanReminderSent(patientId, seriesKey) {
    if (!this.data.vax_plan_reminders) this.data.vax_plan_reminders = [];
    let row = this._planReminderRow(patientId, seriesKey);
    if (!row) {
      row = { id: generateId(), patient_id: patientId, series_key: seriesKey, wa_reminder_count: 0, wa_last_sent_at: '' };
      this.data.vax_plan_reminders.push(row);
    }
    row.wa_reminder_count = (Number(row.wa_reminder_count) || 0) + 1;
    row.wa_last_sent_at = new Date().toISOString();
    this._save();
    if (!CONFIG.DEMO_MODE) {
      const isi = { patient_id: patientId, series_key: seriesKey, wa_reminder_count: row.wa_reminder_count, wa_last_sent_at: row.wa_last_sent_at };
      if (String(row.id).startsWith('id_')) this._syncInsert('vax_plan_reminders', row, { ...isi, id: row.id });
      else supabase.update('vax_plan_reminders', row.id, isi).catch(() => {});
    }
    return { success: true, count: row.wa_reminder_count };
  }

  async markReminderSent(kind, id) {
    // Pengingat yang lahir dari jadwal IDAI dikenali dari bentuk id-nya dan
    // dihitung di tempat lain — lihat _markPlanReminderSent.
    if (kind === 'vaksin' && String(id).startsWith('plan:')) {
      const bagian = String(id).split(':');
      if (bagian.length < 3) return { error: 'Penanda pengingat tidak dikenali' };
      return this._markPlanReminderSent(bagian[1], bagian.slice(2).join(':'));
    }
    const tabel = kind === 'vaksin' ? 'vaccinations' : 'medical_records';
    const daftar = kind === 'vaksin' ? this.data.vaccinations : this.data.medical_records;
    const row = (daftar || []).find(x => x.id === id);
    if (!row) return { error: 'Data tidak ditemukan' };
    row.wa_reminder_count = (Number(row.wa_reminder_count) || 0) + 1;
    row.wa_last_sent_at = new Date().toISOString();
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update(tabel, id, { wa_reminder_count: row.wa_reminder_count, wa_last_sent_at: row.wa_last_sent_at }).catch(() => {});
    }
    return { success: true, count: row.wa_reminder_count };
  }

  // =========================================================================
  // RIWAYAT OBAT PASIEN
  //
  // Dokter yang meng-ACC resep dari apotek hanya melihat resep yang sedang
  // dinilai. Padahal yang paling sering datang lewat apotek justru
  // PENGULANGAN — dan pengulangan tidak bisa dinilai tanpa tahu apa yang
  // sudah diterima pasiennya, kapan, dan berapa kali. Menyetujui antibiotik
  // yang baru seminggu lalu dihabiskan bukan keputusan yang sama dengan
  // menyetujui antibiotik untuk keluhan baru, tapi di layar keduanya terlihat
  // persis sama.
  //
  // YANG DIHITUNG HANYA RESEP YANG SAH. Resep yang masih menunggu ACC atau
  // yang ditolak belum pernah sampai ke pasien; memasukkannya ke riwayat
  // berarti mengaku pasien menerima obat yang tidak pernah dia terima — dan
  // dokter akan menolak pengulangan karena obat yang sebenarnya tidak ada.
  // =========================================================================

  patientDrugHistory(patientId, opts) {
    if (!patientId) return [];
    const o = opts || {};
    const bulan = Number(o.months) > 0 ? Number(o.months) : 6;
    const kini = new Date();
    const b = new Date(kini.getFullYear(), kini.getMonth() - bulan, kini.getDate());
    const batas = b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-' + String(b.getDate()).padStart(2, '0');

    const hasil = [];
    for (const rx of (this.data.prescriptions || [])) {
      if (rx.patient_id !== patientId) continue;
      if (o.excludeRxId && rx.id === o.excludeRxId) continue;
      if (this.rxApprovalStatus(rx) !== 'approved') continue;
      if (rx.status === 'cancelled') continue;
      const tgl = String(rx.created_at || '').slice(0, 10);
      // Resep tanpa tanggal tidak bisa dibuktikan berada di dalam rentangnya.
      if (!tgl || tgl < batas) continue;
      const dokter = (this.getDoctor(rx.doctor_id) || {}).full_name || '';
      for (const it of this.getPrescriptionItems(rx.id)) {
        if (!String(it.drug_name || '').trim()) continue;
        hasil.push({
          date: tgl, rx_number: rx.rx_number || '', doctor_name: dokter,
          drug_name: it.drug_name || '', dosage: it.dosage || '',
          quantity: it.quantity || '', unit: it.unit || '', duration: it.duration || '',
          is_compound: !!it.is_compound, compound_details: it.compound_details || '',
          from_pharmacy: !!rx.drafted_by_pharmacy,
        });
      }
    }
    return hasil.sort((a, b2) => String(b2.date).localeCompare(String(a.date)));
  }

  _selisihHari(tglAwal) {
    const [y, m, d] = String(tglAwal || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    const kini = new Date();
    const a = new Date(y, m - 1, d);
    const b = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate());
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  // Obat pada resep yang sedang dinilai yang TERNYATA SUDAH PERNAH DITERIMA
  // pasien belakangan ini. Inilah yang paling perlu dilihat dokter sebelum
  // menekan Setujui.
  recentDrugOverlap(patientId, items, opts) {
    const riwayat = this.patientDrugHistory(patientId, opts);
    if (!riwayat.length) return [];
    const hasil = [];
    for (const it of (items || [])) {
      const nama = this.normalizeName(it.drug_name);
      // Nama terlalu pendek terlalu mudah cocok ke mana-mana; peringatan palsu
      // yang sering muncul justru membuat peringatan yang benar ikut diabaikan.
      if (nama.length < 3) continue;
      let cocok = riwayat.find(h => !h.is_compound && this.normalizeName(h.drug_name) === nama);
      let dimana = 'obat';
      if (!cocok) {
        cocok = riwayat.find(h => this.normalizeName(h.drug_name) === nama);
        if (cocok) dimana = 'obat';
      }
      if (!cocok) {
        // Yang paling mudah terlewat: obat yang sama sudah diterima sebagai
        // BAHAN di dalam racikan, jadi namanya tidak muncul sebagai nama obat.
        // Dibandingkan sebagai kata utuh — 'gg' tidak boleh cocok ke 'logging'.
        cocok = riwayat.find(h => h.is_compound
          && (' ' + this.normalizeName(h.compound_details) + ' ').includes(' ' + nama + ' '));
        if (cocok) dimana = 'racikan';
      }
      if (!cocok) continue;
      hasil.push({
        nama: String(it.drug_name || '').trim(),
        date: cocok.date, hari: this._selisihHari(cocok.date),
        where: dimana, rx_number: cocok.rx_number,
        lewat_apotek: cocok.from_pharmacy,
      });
    }
    return hasil;
  }

  // ---- SATU HITUNGAN UNTUK SEMUA YANG MENUNGGU KEPUTUSAN DOKTER ----------
  //
  // Yang butuh ACC dokter datang dari tiga arah sekaligus: resep yang disusun
  // apotek, surat keterangan yang disusun admin/apotek, dan catatan vaksinasi
  // yang diinput admin. Tanpa satu angka yang menjumlahkannya, dokter harus
  // INGAT untuk memeriksa — dan yang tidak diperiksa menahan apoteknya
  // sekaligus pasiennya, tanpa ada yang tahu di mana tertahannya.
  //
  // Sengaja MEMBACA DATA LOKAL, bukan memanggil server: menu digambar
  // serentak dan tidak bisa menunggu jaringan. Data lokal disegarkan
  // loadFromSupabase, jadi angkanya ikut segar tanpa permintaan tambahan.
  pendingAccCounts(doctorId) {
    const kosong = { rx: 0, skd: 0, vax: 0, total: 0 };
    if (!doctorId) return kosong;
    const rx = this.getPendingRxForDoctor(doctorId).length;
    const skd = (this.data.certificates || []).filter(c =>
      c.cert_type === 'skd' && c.details && c.details.approval
      && c.details.approval.status === 'pending'
      && c.details.approval.doctor_id === doctorId).length;
    const vax = (this.data.vaccinations || []).filter(v =>
      this.vaxApprovalStatus(v) === 'pending' && v.approval_doctor_id === doctorId).length;
    return { rx, skd, vax, total: rx + skd + vax };
  }

  // Antrean ACC seorang dokter.
  getPendingRxForDoctor(doctorId) {
    if (!doctorId) return [];
    return (this.data.prescriptions || [])
      .filter(rx => this.rxIsPending(rx) && (rx.approval_doctor_id === doctorId || rx.doctor_id === doctorId))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  // Resep yang disusun sebuah apotek (untuk halaman apoteknya sendiri).
  getRxDraftedByPharmacy(pharmacyId) {
    if (!pharmacyId) return [];
    return (this.data.prescriptions || [])
      .filter(rx => rx.drafted_by_pharmacy === pharmacyId)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  async createPrescription(rx, items) {
    const year = new Date().getFullYear();
    // Self-heal a stranded record_id: if the linked medical record never
    // reached Supabase (its id is still a client 'id_...' placeholder — e.g. a
    // visit saved before the empty-date fix, or while offline), inserting a
    // prescription with that placeholder as record_id gets rejected by the
    // UUID column ('invalid input syntax for type uuid: id_...'). Sync the
    // record now so we store a real UUID FK. Mutates rx.record_id in place so
    // the local prescription row and the server payload agree.
    if (!CONFIG.DEMO_MODE && typeof rx.record_id === 'string' && rx.record_id.startsWith('id_')) {
      const rec = this.data.medical_records.find(r => r.id === rx.record_id);
      if (rec) {
        await this._syncInsert('medical_records', rec, sanitizeDates(rec, ['visit_date', 'follow_up_date']));
        if (typeof rec.id === 'string' && !rec.id.startsWith('id_')) rx.record_id = rec.id;
      }
      if (typeof rx.record_id === 'string' && rx.record_id.startsWith('id_')) {
        return { success: false, rx: null, error: 'Gagal menyimpan resep ke server: rekam medis kunjungan ini belum tersimpan ke server. Buka kembali rekam medisnya lalu simpan ulang sebelum membuat e-resep.' };
      }
    }
    // "Resep luar": the patient fills it at a pharmacy of their choice, so it is
    // never routed to a partner pharmacy — clear the FK so it can't surface in
    // any pharmacy's queue (and no pharmacy notification is raised below).
    if (rx.rx_target === 'luar') rx.pharmacy_id = null;
    const seq = await this.getNextRxNumber(year);
    const newRx = { id: generateId(), ...rx, status: 'sent', created_at: new Date().toISOString(), rx_number: 'R-' + year + '-' + String(seq).padStart(4, '0') };
    this.data.prescriptions.push(newRx);
    const savedItems = [];
    items.forEach(item => {
      const newItem = { id: generateId(), prescription_id: newRx.id, ...sanitizeRxItem(item) };
      this.data.prescription_items.push(newItem);
      savedItems.push(newItem);
    });
    const patient = this.getPatient(rx.patient_id);
    this.addNotification(this.data.pharmacies.find(ph => ph.id === rx.pharmacy_id)?.user_id, 'E-Resep Baru', `Resep baru ${newRx.rx_number} untuk ${patient?.full_name || 'pasien'}.`, 'prescription');
    const patientUser = this.data.patients.find(p => p.id === rx.patient_id);
    if (patientUser) {
      const msg = rx.rx_target === 'luar'
        ? `Resep ${newRx.rx_number} telah dibuat. Silakan tebus di apotek pilihan Anda.`
        : `Resep ${newRx.rx_number} telah dikirim ke apotek.`;
      this.addNotification(patientUser.user_id, 'Resep Dibuat', msg, 'prescription');
    }
    this._save();
    if (CONFIG.DEMO_MODE) return { success: true, rx: newRx };

    // Bypasses _syncInsert here (unlike prescription_items below) because we
    // need the raw server error text to show the doctor — _syncInsert only
    // ever logs it to the console, which isn't reachable on a phone.
    const { id, ...payload } = newRx;
    let insertError = null;
    try {
      const inserted = await supabase.insert('prescriptions', payload);
      if (inserted && inserted.id) { newRx.id = inserted.id; this._save(); }
      else insertError = (inserted && inserted.error) || 'insert gagal tanpa keterangan';
    } catch (e) { insertError = e.message || 'kesalahan jaringan'; }

    if (!insertError) {
      // Batched into one insert (like the prescription row above) rather
      // than N parallel _syncInsert calls, so a failure surfaces the real
      // server error text instead of just "N obat gagal tersimpan" with no
      // reason — that gap is why the doctor only ever saw a bare item count.
      savedItems.forEach(si => { si.prescription_id = newRx.id; });
      const itemPayloads = savedItems.map(({ id, ...payload }) => payload);
      try {
        const insertedItems = await supabase.insert('prescription_items', itemPayloads);
        if (Array.isArray(insertedItems) && insertedItems.length === savedItems.length) {
          insertedItems.forEach((ins, idx) => { savedItems[idx].id = ins.id; });
          this._save();
        } else {
          insertError = (insertedItems && insertedItems.error) || 'obat gagal tersimpan tanpa keterangan';
        }
      } catch (e) { insertError = e.message || 'kesalahan jaringan saat menyimpan obat'; }
    }

    const success = !insertError;
    if (!success) {
      console.warn('Gagal menyimpan ke Supabase (prescriptions):', insertError, payload);
      // Roll back the optimistic local copy so the UI doesn't keep showing a
      // prescription that doesn't actually exist on the server — and if the
      // prescription row itself DID get created before its items failed,
      // delete it server-side too, so no other device/pharmacy ever sees a
      // "sent" prescription with no medicines on it.
      if (!newRx.id.startsWith('id_')) supabase.delete('prescriptions', newRx.id).catch(() => {});
      this.data.prescriptions = this.data.prescriptions.filter(p => p.id !== newRx.id);
      this.data.prescription_items = this.data.prescription_items.filter(i => i.prescription_id !== newRx.id);
      this._save();
    }
    return { success, rx: newRx, error: success ? null : `Gagal menyimpan resep ke server: ${insertError}` };
  }

  // reason is only meaningful (and required by the pharmacy UI) when status
  // is 'rejected' — stored so the doctor/patient can see why.
  updatePrescriptionStatus(rxId, status, reason) {
    const rx = this.data.prescriptions.find(r => r.id === rxId);
    if (!rx) return;
    rx.status = status;
    const updates = { status };
    if (status === 'rejected') { rx.reject_reason = reason || ''; updates.reject_reason = reason || ''; }
    // Recorded so "Selesai Hari Ini" on the pharmacy dashboard can filter by
    // when a prescription actually finished, not just its status — it used
    // to count every 'completed' prescription ever, regardless of date.
    if (status === 'completed') { rx.completed_at = new Date().toISOString(); updates.completed_at = rx.completed_at; }
    const patient = this.getPatient(rx.patient_id);
    const statusLabel = CONFIG.PRESCRIPTION_STATUS_LABELS[status] || status;
    const msg = status === 'rejected' && reason ? `Resep ${rx.rx_number} ditolak apotek. Alasan: ${reason}` : `Resep ${rx.rx_number} status: ${statusLabel}.`;
    if (patient) this.addNotification(patient.user_id, `Resep ${statusLabel}`, msg, 'prescription');
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('prescriptions', rxId, updates).catch(e => console.warn('Gagal update status resep:', e));
  }

  async updatePrescription(rxId, updates) {
    const rx = this.data.prescriptions.find(r => r.id === rxId);
    if (!rx) return { error: 'Resep tidak ditemukan' };
    if (!['sent','rejected'].includes(rx.status)) return { error: 'Resep sudah diproses apotek, tidak bisa diedit' };
    const previous = {};
    Object.keys(updates).forEach(k => { previous[k] = rx[k]; });
    Object.assign(rx, updates);
    this._save();
    if (CONFIG.DEMO_MODE) return { success: true, rx };
    const result = await supabase.update('prescriptions', rxId, updates);
    if (result && result.error) {
      Object.assign(rx, previous);
      this._save();
      return { error: `Gagal menyimpan perubahan resep: ${result.error}` };
    }
    return { success: true, rx };
  }

  // Inserts the new items and confirms they actually persisted BEFORE
  // deleting the old ones (rather than delete-then-insert), so a failed
  // save leaves the previous, still-correct items in place instead of
  // silently leaving the prescription with zero medicines on it.
  async updatePrescriptionItems(rxId, newItems) {
    const oldItems = this.data.prescription_items.filter(i => i.prescription_id === rxId);
    const savedItems = newItems.map(item => ({ id: generateId(), prescription_id: rxId, ...sanitizeRxItem(item) }));

    if (CONFIG.DEMO_MODE) {
      this.data.prescription_items = this.data.prescription_items.filter(i => i.prescription_id !== rxId).concat(savedItems);
      this._save();
      return { success: true };
    }

    // Batched into one insert rather than N parallel _syncInsert calls, both
    // because Postgrest inserts a multi-row batch atomically (all rows or
    // none, so there's no "some items got through" case to clean up here
    // the way createPrescription's per-item version had to) and so a
    // failure surfaces the real server error text instead of a bare count.
    let error = null;
    const itemPayloads = savedItems.map(({ id, ...payload }) => payload);
    try {
      const insertedItems = await supabase.insert('prescription_items', itemPayloads);
      if (Array.isArray(insertedItems) && insertedItems.length === savedItems.length) {
        insertedItems.forEach((ins, idx) => { savedItems[idx].id = ins.id; });
      } else {
        error = (insertedItems && insertedItems.error) || 'obat gagal tersimpan tanpa keterangan';
      }
    } catch (e) { error = e.message || 'kesalahan jaringan saat menyimpan obat'; }

    if (error) {
      console.warn('Gagal menyimpan ke Supabase (prescription_items update):', error);
      return { success: false, error: `Gagal menyimpan obat: ${error}` };
    }

    await Promise.all(oldItems.map(oi => supabase.delete('prescription_items', oi.id)));
    this.data.prescription_items = this.data.prescription_items.filter(i => i.prescription_id !== rxId).concat(savedItems);
    this._save();
    return { success: true };
  }

  cancelPrescription(rxId, reason) {
    const rx = this.data.prescriptions.find(r => r.id === rxId);
    if (!rx) return;
    rx.status = 'cancelled';
    rx.cancel_reason = reason || '';
    const patient = this.getPatient(rx.patient_id);
    if (patient) this.addNotification(patient.user_id, 'Resep Dibatalkan', `Resep ${rx.rx_number} telah dibatalkan oleh dokter.`, 'prescription');
    const pharmacy = this.getPharmacy(rx.pharmacy_id);
    if (pharmacy) this.addNotification(pharmacy.user_id, 'Resep Dibatalkan', `Resep ${rx.rx_number} dibatalkan oleh dokter. Alasan: ${reason || '-'}`, 'prescription');
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('prescriptions', rxId, { status: 'cancelled', cancel_reason: reason || '' }).catch(() => {});
  }

  updateRecord(recordId, updates) {
    const r = this.data.medical_records.find(x => x.id === recordId);
    if (!r) return { error: 'Rekam medis tidak ditemukan' };
    Object.assign(r, updates);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('medical_records', recordId, updates).catch(() => {});
    return { success: true };
  }

  // Appointments
  getAppointmentsByDoctor(doctorId, date) {
    let apts = this.data.appointments.filter(a => a.doctor_id === doctorId);
    if (date) apts = apts.filter(a => a.date === date);
    return apts.sort((a, b) => (a.time_slot || '').localeCompare(b.time_slot || ''));
  }

  getAppointmentsByPatient(patientId) {
    return this.data.appointments.filter(a => a.patient_id === patientId).sort((a, b) => b.date.localeCompare(a.date));
  }

  // Unfiltered, across every doctor — for SuperAdmin's clinic-wide calendar.
  getAllAppointments() { return this.data.appointments; }
  getAllRecords() { return this.data.medical_records; }

  getUpcomingAppointments(patientId) {
    const today = todayLocal();
    return this.data.appointments.filter(a => a.patient_id === patientId && a.date >= today && a.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  }

  // Vaccinations
  getVaccinations(patientId) {
    return this.data.vaccinations.filter(v => v.patient_id === patientId).sort((a, b) => a.date_given.localeCompare(b.date_given));
  }

  // Menandai baris vaksinasi yang di luar jadwal SEBELUM ia masuk ke data.
  //
  // Harus dijalankan sebelum push: vaxDoseCheck membandingkan dengan dosis lain
  // milik pasien yang sama, dan baris yang sudah terlanjur masuk akan ikut
  // terbandingkan dengan dirinya sendiri.
  //
  // Tidak pernah menggagalkan pencatatan. Kalau pemeriksanya sendiri yang
  // rusak, yang benar adalah vaksinnya tetap tercatat tanpa tanda — bukan
  // kejadian nyata yang hilang dari riwayat anak karena kode kita bermasalah.
  _tandaiLuarJadwal(vax) {
    let cek = null;
    try {
      cek = this.vaxDoseCheck({
        patient_id: vax.patient_id, vaccine_name: vax.vaccine_name,
        vaccine_brand: vax.vaccine_brand, series_key: vax.series_key,
        date_given: vax.date_given, exclude_id: vax.id,
      });
    } catch (e) { return vax; }
    // DUA KOLOM, DUA PEMILIK. off_schedule_reason milik pemeriksa dan ditulis
    // ulang setiap kali; off_schedule_note milik dokter dan tidak pernah kami
    // sentuh. Sempat digabung jadi satu kolom, dan akibatnya muncul saat
    // tanggalnya dibetulkan: teks temuan lama terbaca sebagai kalimat dokter
    // lalu disimpan kembali sebagai keterangan yang tidak pernah ia tulis.
    //
    // Hasil pemeriksaan juga MENGGANTIKAN tanda lama, bukan ditambahkan
    // padanya. Sempat ditulis `cek.luarJadwal || vax.off_schedule`, dan itu
    // membuat tandanya searah: sekali menempel, membetulkan tanggalnya pun
    // tidak mencabutnya — pembetulan yang benar membeku sebagai tuduhan tetap.
    vax.off_schedule = cek.luarJadwal === true;
    vax.off_schedule_reason = (cek.luarJadwal ? (cek.alasan || []) : []).join(' ');
    vax.off_schedule_note = String(vax.off_schedule_note || '').trim();
    return vax;
  }

  createVaccination(vax) {
    const newVax = this._tandaiLuarJadwal({ id: generateId(), ...vax });
    this.data.vaccinations.push(newVax);
    this._save();
    // next_dose_date is empty for a series with no scheduled next dose (and
    // date_given could be blank too) — null them so Postgres doesn't reject the
    // DATE columns and silently drop the whole vaccination insert.
    this._syncInsert('vaccinations', newVax, sanitizeDates(newVax, ['date_given', 'next_dose_date']), KOLOM_VAX_BARU);
    return newVax;
  }

  // Sama seperti createVaccination, tapi menunggu insert ke Supabase selesai
  // supaya pemanggilnya bisa tahu apakah baris benar-benar tersimpan (id sudah
  // berupa UUID asli) atau ditolak (masih placeholder 'id_...').
  async createVaccinationAwaited(vax) {
    const newVax = this._tandaiLuarJadwal({ id: generateId(), ...vax });
    this.data.vaccinations.push(newVax);
    this._save();
    await this._syncInsert('vaccinations', newVax, sanitizeDates(newVax, ['date_given', 'next_dose_date']), KOLOM_VAX_BARU);
    return newVax;
  }

  updateVaccination(vaxId, updates) {
    const v = this.data.vaccinations.find(x => x.id === vaxId);
    if (!v) return { error: 'Data vaksinasi tidak ditemukan' };
    Object.assign(v, updates);

    // Membetulkan tanggal atau nama vaksin mengubah jawaban atas "apakah dosis
    // ini di luar jadwal". Tanpa hitung ulang, tanda lama bertahan dan justru
    // membekukan kekeliruan yang baru saja diperbaiki.
    let kirim = { ...updates };
    const pengaruh = ['date_given', 'vaccine_name', 'vaccine_brand', 'series_key'];
    if (pengaruh.some(k => Object.prototype.hasOwnProperty.call(updates || {}, k))) {
      const sebelum = { luar: v.off_schedule === true, alasan: v.off_schedule_reason || '' };
      this._tandaiLuarJadwal(v);
      if (v.off_schedule !== sebelum.luar || v.off_schedule_reason !== sebelum.alasan) {
        kirim = { ...kirim, off_schedule: v.off_schedule, off_schedule_reason: v.off_schedule_reason };
      }
    }


    this._save();
    if (!CONFIG.DEMO_MODE) {
      supabase.update('vaccinations', vaxId, kirim).catch(() => {
        // Migrasi kolomnya mungkin belum dijalankan — simpan sisanya, jangan
        // sampai pembetulan tanggalnya ikut hilang.
        const tanpa = { ...kirim };
        for (const k of KOLOM_VAX_BARU) delete tanpa[k];
        if (Object.keys(tanpa).length) supabase.update('vaccinations', vaxId, tanpa).catch(() => {});
      });
    }
    return { success: true };
  }

  // Hapus satu kunjungan / rekam medis.
  //
  // Sengaja DITOLAK bila kunjungan itu masih menggantung e-resep: resepnya akan
  // kehilangan induknya dan tetap hidup di antrean apotek tanpa ada yang bisa
  // menelusurinya lagi. Batalkan atau selesaikan resepnya dulu — itu keputusan
  // yang harus disadari, bukan efek samping penghapusan.
  deleteRecord(recordId) {
    const rec = (this.data.medical_records || []).find(r => r.id === recordId);
    if (!rec) return { error: 'Rekam medis tidak ditemukan' };
    const rx = this.getPrescriptionsByRecord(recordId) || [];
    const aktif = rx.filter(x => x.status !== 'cancelled');
    if (aktif.length) {
      return { error: `Kunjungan ini masih punya ${aktif.length} e-resep (${aktif.map(x => x.rx_number).join(', ')}). Batalkan resepnya dulu, baru kunjungannya bisa dihapus.` };
    }
    this.data.medical_records = (this.data.medical_records || []).filter(r => r.id !== recordId);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(recordId).startsWith('id_')) {
      supabase.delete('medical_records', recordId).catch(() => {});
    }
    return { success: true };
  }

  deleteVaccination(vaxId) {
    this.data.vaccinations = this.data.vaccinations.filter(x => x.id !== vaxId);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.delete('vaccinations', vaxId).catch(() => {});
  }

  // ---- Vaksinasi yang diinput admin → ACC dokter --------------------------
  // Baris lama (dan semua yang diinput dokter sendiri) tidak punya kolom ini,
  // jadi tanpa nilai dianggap sudah sah — bukan menunggu persetujuan.
  vaxApprovalStatus(v) { return (v && v.approval_status) || 'approved'; }

  // Admin mencatat vaksinasi atas nama dokter. Dua hal sekaligus: baris
  // vaksinasi berstatus 'pending', dan rekam medis kunjungan agar riwayat
  // pasien tetap lengkap seperti kalau dokter yang mengisi.
  async addVaccinationByAdmin(data) {
    const doctorId = data.approval_doctor_id || data.administered_by || '';
    if (!doctorId) return { error: 'Pilih dokter penanggung jawab (yang akan meng-ACC) terlebih dahulu.' };
    if (!data.patient_id) return { error: 'Pasien tidak ditemukan' };
    if (!data.vaccine_name) return { error: 'Nama vaksin wajib diisi' };
    if (!data.date_given) return { error: 'Tanggal pemberian wajib diisi' };

    const modeLabel = data.vax_mode === 'booster'
      ? ' (booster ke-' + (data.dose_number || 1) + ')'
      : ' dosis ' + (data.dose_number || 1) + '/' + (data.total_doses || 1);

    const vax = await this.createVaccinationAwaited({
      patient_id: data.patient_id,
      vaccine_name: data.vaccine_name,
      vaccine_brand: data.vaccine_brand || '',
      vax_mode: data.vax_mode || 'series',
      dose_number: Number(data.dose_number) || 1,
      total_doses: Number(data.total_doses) || 1,
      booster_interval_months: Number(data.booster_interval_months) || 12,
      date_given: data.date_given,
      next_dose_date: data.next_dose_date || '',
      batch_number: data.batch_number || '',
      administered_by: doctorId,
      location: data.location || '',
      notes: data.notes || '',
      approval_status: 'pending',
      approval_doctor_id: doctorId,
      approval_created_by: data.created_by || '',
      reject_reason: '',
      // Kalau petugas sempat menulis kenapa dosisnya di luar jadwal, kalimat
      // itu harus ikut sampai — dokter yang meng-ACC nanti membacanya justru
      // untuk memutuskan apakah dosis itu sah.
      off_schedule_note: data.off_schedule_note || '',
    });

    // Kolom approval_* datang dari supabase-vaccination-approval.sql. Kalau
    // migrasi itu belum dijalankan, Postgres menolak seluruh baris dan id-nya
    // tetap placeholder 'id_...' — hentikan di sini dengan pesan jelas daripada
    // membiarkan admin mengira datanya sudah tersimpan di server.
    if (!CONFIG.DEMO_MODE && String(vax.id).startsWith('id_')) {
      this.data.vaccinations = this.data.vaccinations.filter(x => x.id !== vax.id);
      this._save();
      return { error: 'Gagal menyimpan ke server. Pastikan migrasi supabase-vaccination-approval.sql sudah dijalankan di Supabase.' };
    }

    // Rekam medis kunjungan — sama bentuknya dengan yang dibuat dokter, supaya
    // vaksinasi ini ikut muncul di riwayat rekam medis pasien.
    let record = null;
    try {
      record = await this.createRecord({
        patient_id: data.patient_id, doctor_id: doctorId,
        visit_type: 'vaccination', visit_date: data.date_given,
        location: data.location || '',
        anamnesis: 'Vaksinasi ' + data.vaccine_name + ' ' + (data.vaccine_brand || '') + modeLabel,
        diagnosis: 'Vaksinasi ' + data.vaccine_name,
        therapy: 'Pemberian vaksin ' + (data.vaccine_brand || data.vaccine_name) + modeLabel,
        vital_signs: {},
        follow_up_date: data.next_dose_date || '',
        follow_up_notes: data.vax_mode === 'booster' ? 'Booster berikutnya' : 'Vaksin dosis berikutnya',
        notes: [data.batch_number ? 'Batch: ' + data.batch_number : '', 'Diinput admin, menunggu ACC dokter.', data.notes || ''].filter(Boolean).join(' | '),
      });
    } catch (e) { /* vaksinasi tetap tersimpan walau rekam medis gagal */ }

    const d = this.data.doctors.find(x => x.id === doctorId);
    if (d && d.user_id) {
      this.addNotification(d.user_id, 'Vaksinasi Menunggu ACC',
        `Catatan vaksinasi ${data.vaccine_name} untuk ${(this.getPatient(data.patient_id) || {}).full_name || 'pasien'} dibuat admin dan menunggu persetujuan (ACC) Anda.`, 'system');
    }
    return { success: true, vaccination: vax, record };
  }

  // Ambil ulang dari server dulu: admin bisa saja menginput setelah tab dokter
  // dibuka, dan tanpa ini antreannya baru muncul setelah aplikasi di-reload.
  // Baris segar digabungkan ke data lokal supaya approve/reject (yang bekerja
  // pada data lokal) menemukan barisnya.
  async getPendingVaccinationsForDoctor(doctorId) {
    if (!doctorId) return [];
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('vaccinations', { eq: { approval_status: 'pending' } });
        if (Array.isArray(rows) && rows.length) {
          const byId = new Map((this.data.vaccinations || []).map(v => [v.id, v]));
          rows.forEach(r => {
            const local = byId.get(r.id);
            if (local) Object.assign(local, r);
            else this.data.vaccinations.push(r);
          });
          this._save();
        }
      } catch (e) { /* offline / tabel belum siap — pakai data lokal */ }
    }
    return (this.data.vaccinations || [])
      .filter(v => this.vaxApprovalStatus(v) === 'pending' && v.approval_doctor_id === doctorId)
      .sort((a, b) => String(b.date_given || '').localeCompare(String(a.date_given || '')));
  }

  async approveVaccination(vaxId) {
    const v = (this.data.vaccinations || []).find(x => x.id === vaxId);
    if (!v) return { error: 'Data vaksinasi tidak ditemukan' };
    const updates = { approval_status: 'approved', approved_at: new Date().toISOString(), reject_reason: '' };
    const r = this.updateVaccination(vaxId, updates);
    if (r && r.error) return r;
    if (v.approval_created_by) {
      this.addNotification(v.approval_created_by, 'Vaksinasi Disahkan',
        `Catatan vaksinasi ${v.vaccine_name || ''} untuk ${(this.getPatient(v.patient_id) || {}).full_name || 'pasien'} telah disetujui (ACC). Sertifikat sudah bisa dicetak.`, 'system');
    }
    return { success: true };
  }

  async rejectVaccination(vaxId, reason) {
    const v = (this.data.vaccinations || []).find(x => x.id === vaxId);
    if (!v) return { error: 'Data vaksinasi tidak ditemukan' };
    const r = this.updateVaccination(vaxId, { approval_status: 'rejected', reject_reason: reason || '' });
    if (r && r.error) return r;
    if (v.approval_created_by) {
      this.addNotification(v.approval_created_by, 'Vaksinasi Ditolak',
        `Catatan vaksinasi ${v.vaccine_name || ''} untuk ${(this.getPatient(v.patient_id) || {}).full_name || 'pasien'} ditolak dokter.${reason ? ' Alasan: ' + reason : ''}`, 'system');
    }
    return { success: true };
  }

  // Dosis yang belum di-ACC untuk satu vaksin — sertifikat tidak boleh terbit
  // selama masih ada yang menggantung.
  //
  // Dosis berstatus 'external' (diberikan di puskesmas / klinik lain, lalu
  // dicatat di sini atas laporan orang tua) sengaja TIDAK ikut: ia tidak
  // sedang menunggu ACC siapa pun, karena bukan kami yang memberikannya.
  // Yang dilakukan terhadapnya adalah tidak mencetaknya di sertifikat —
  // itu diurus di __generateVaxCert, bukan dengan memblokir sertifikatnya.
  getUnapprovedDoses(patientId, vaccineName) {
    return (this.data.vaccinations || []).filter(v =>
      v.patient_id === patientId && v.vaccine_name === vaccineName &&
      this.isVaxExternal(v) === false &&
      this.vaxApprovalStatus(v) !== 'approved');
  }

  isVaxExternal(v) {
    if (!v) return false;
    return this.vaxApprovalStatus(v) === 'external' || v.vax_source === 'luar';
  }

  // =========================================================================
  // JADWAL VAKSIN ANAK (IDAI) — TANGGALNYA DIHITUNG, BUKAN DIKETIK
  //
  // Sebelum ini, tanggal dosis berikutnya diketik tangan saat dosis sekarang
  // dicatat. Cukup selama anaknya datang tepat waktu. Yang tidak tertangani
  // adalah kejadian yang paling sering: anak demam, vaksinnya mundur dua
  // bulan, dan seluruh tanggal sesudahnya yang terlanjur diketik jadi salah
  // tanpa ada yang menghitung ulang. Yang tertinggal di layar justru tanggal
  // lama yang kelihatan meyakinkan.
  //
  // Di sini tanggalnya diturunkan dari dua batas yang keduanya harus lewat:
  //
  //     paling cepat = MAX(lahir + usia minimum dosis ke-n,
  //                        dosis terakhir + jarak minimum)
  //
  // Penundaan satu dosis dengan sendirinya menggeser sisanya.
  // =========================================================================

  // Angka jadwalnya BELUM diverifikasi dokter sampai baris ini berkata lain —
  // lihat penjelasan panjang di js/idai.js. Selama belum, semua layar yang
  // memakainya menyebut hasilnya "perkiraan", bukan anjuran.
  idaiMeta() {
    const row = this.data.vax_schedule;
    if (row && row.meta) return { ...IDAI_META, ...row.meta };
    return { ...IDAI_META };
  }

  idaiVerified() { return this.idaiMeta().verified === true; }

  // Jadwal yang berlaku: hasil suntingan dokter bila ada, kalau tidak ya bibit.
  idaiSchedule() {
    const row = this.data.vax_schedule;
    if (row && Array.isArray(row.seri) && row.seri.length) return row.seri;
    return IDAI_SEED;
  }

  async fetchVaxSchedule() {
    if (CONFIG.DEMO_MODE) return this.idaiSchedule();
    try {
      const rows = await supabase.select('vax_schedule', { order: 'updated_at.desc', limit: 1 });
      const r = Array.isArray(rows) && rows[0];
      if (r && r.payload && Array.isArray(r.payload.seri)) {
        this.data.vax_schedule = { id: r.id, seri: r.payload.seri, meta: r.payload.meta || {} };
        this._save();
      }
    } catch (e) { /* tabelnya belum dibuat — pakai bibit */ }
    return this.idaiSchedule();
  }

  // Menyimpan tabel yang sudah disunting. `meta.verified` hanya boleh naik
  // lewat verifyVaxSchedule supaya tidak ikut ter-set diam-diam saat dokter
  // baru membetulkan satu angka dan belum selesai memeriksa sisanya.
  async saveVaxSchedule(seri, metaPatch) {
    if (!Array.isArray(seri) || !seri.length) return { error: 'Jadwal kosong — tidak disimpan.' };
    const meta = { ...this.idaiMeta(), ...(metaPatch || {}) };
    const payload = { seri, meta };
    const lama = this.data.vax_schedule;
    this.data.vax_schedule = { id: (lama && lama.id) || '', seri, meta };
    this._save();
    if (CONFIG.DEMO_MODE) return { success: true };
    try {
      if (lama && lama.id) await supabase.update('vax_schedule', lama.id, { payload, updated_at: new Date().toISOString() });
      else {
        const baris = await supabase.insert('vax_schedule', { payload });
        const r = Array.isArray(baris) ? baris[0] : baris;
        if (r && r.id) { this.data.vax_schedule.id = r.id; this._save(); }
      }
      return { success: true };
    } catch (e) {
      return { error: 'Tersimpan di perangkat ini, tapi gagal ke server. Pastikan supabase-vax-schedule.sql sudah dijalankan.' };
    }
  }

  async verifyVaxSchedule(userId, nama) {
    return this.saveVaxSchedule(this.idaiSchedule(), {
      verified: true, verified_by: userId || '', verified_at: new Date().toISOString(),
      verified_name: nama || '',
    });
  }

  async unverifyVaxSchedule() {
    return this.saveVaxSchedule(this.idaiSchedule(), { verified: false, verified_by: '', verified_at: '' });
  }

  // Nama vaksin di sini teks bebas: yang tertulis bisa 'DPT', 'DTP',
  // 'Pentabio', atau merek lain. Tanpa pemetaan ini, dosis yang sama tercatat
  // sebagai tiga vaksin berbeda dan serinya tidak pernah terlihat lengkap.
  //
  // Sengaja mengembalikan BANYAK kunci: satu suntikan pentavalen memang
  // menghitung sekaligus untuk DTP, Hepatitis B, dan Hib. Kalau hanya satu
  // yang dipilih, dua seri lainnya akan terus terlihat tertinggal padahal
  // anaknya sudah disuntik.
  vaxSeriesKeys(vaccineName, brand, seriesKeyTersimpan) {
    const tersimpan = String(seriesKeyTersimpan || '').split(',').map(s => s.trim()).filter(Boolean);
    if (tersimpan.length) return tersimpan;
    const teks = ' ' + (String(vaccineName || '') + ' ' + String(brand || ''))
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    if (teks.trim() === '') return [];
    const hasil = [];
    for (const seri of this.idaiSchedule()) {
      const alias = (seri.alias || []).concat([seri.key]);
      const kena = alias.some(a => {
        const bersih = String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return bersih && teks.includes(' ' + bersih + ' ');
      });
      if (kena) hasil.push(seri.key);
    }
    return hasil;
  }

  // Dosis yang dianggap SUDAH masuk untuk satu seri.
  //
  // Yang DITOLAK dokter tidak ikut — penolakan artinya catatannya keliru.
  // Yang masih menunggu ACC tetap ikut: suntikannya sudah terjadi, dan
  // mengeluarkannya membuat kartu anak berkata "terlambat" untuk dosis yang
  // baru saja diberikan pagi tadi. Yang diberikan di luar juga ikut — memang
  // sudah masuk ke tubuh anaknya, terlepas dari siapa yang menyuntik.
  _dosisSeri(patientId, seriKey) {
    return (this.data.vaccinations || [])
      .filter(v => v.patient_id === patientId && v.date_given)
      .filter(v => this.vaxApprovalStatus(v) !== 'rejected')
      .filter(v => this.vaxSeriesKeys(v.vaccine_name, v.vaccine_brand, v.series_key).includes(seriKey))
      .sort((a, b) => String(a.date_given).localeCompare(String(b.date_given)));
  }

  _maxTanggal(...list) {
    return list.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(String(t || ''))).sort().pop() || '';
  }

  // SATU-SATUNYA TEMPAT TANGGAL DOSIS BERIKUTNYA DIHITUNG.
  //
  // Dipakai tiga pemanggil: childVaxPlan (kartu & tabel), vaxDoseCheck
  // (memeriksa dosis yang sedang direkam), dan dueReminders (pengingat WA).
  // Sengaja satu fungsi. Begitu ada dua salinan hitungan ini, layar dan
  // pemeriksa bisa berselisih tentang tanggal yang sama — dan itu persis
  // kesalahan yang sedang diperbaiki di pengingat, di mana next_dose_date yang
  // diketik tangan dan tanggal hitungan IDAI hidup berdampingan tanpa pernah
  // saling melihat.
  //
  // `diberikan` = dosis yang sudah masuk untuk seri ini, terurut menaik.
  _seriBerikut(seri, lahir, diberikan, hariIni) {
    const daftarDosis = seri.dosis || [];
    const terakhir = diberikan.length ? String(diberikan[diberikan.length - 1].date_given).slice(0, 10) : '';
    let d = daftarDosis[diberikan.length] || null;
    let ulangan = false;

    // Dosis yang hanya berlaku pada keadaan tertentu (dosis kedua influenza
    // hanya untuk pemberian pertama di bawah 9 tahun) dilewati bila syaratnya
    // tidak terpenuhi, bukan ditagih terus-menerus.
    while (d && d.hanyaJika && d.hanyaJika.usiaKurangDari) {
      const batasUmur = tambahUsia(lahir, d.hanyaJika.usiaKurangDari);
      if (batasUmur && hariIni >= batasUmur) d = daftarDosis[daftarDosis.indexOf(d) + 1] || null;
      else break;
    }

    if (!d && seri.ulang && terakhir) {
      const habis = seri.ulang.sampaiUsia ? tambahUsia(lahir, seri.ulang.sampaiUsia) : '';
      if (habis && hariIni > habis) return { selesai: true, label: 'Sudah tidak perlu diulang', berikut: null };
      ulangan = true;
      d = { ke: diberikan.length + 1, jarakMin: seri.ulang.jarak, label: 'Ulangan' };
    }
    if (!d) return { selesai: true, label: 'Lengkap', berikut: null };

    const dariUsia = d.usiaMin ? tambahUsia(lahir, d.usiaMin) : lahir;
    const dariJarak = (terakhir && d.jarakMin) ? tambahUsia(terakhir, d.jarakMin) : '';
    const palingCepat = this._maxTanggal(lahir, dariUsia, dariJarak);
    const anjurUsia = d.usiaAnjuran ? tambahUsia(lahir, d.usiaAnjuran) : '';
    const dianjurkan = this._maxTanggal(palingCepat, anjurUsia);
    const batasSpec = d.batasUsia || seri.batasUsia || null;
    const batasAkhir = batasSpec ? tambahUsia(lahir, batasSpec) : '';

    return {
      selesai: false, label: '',
      berikut: {
        ke: d.ke || (diberikan.length + 1),
        label: d.label || ('Dosis ke-' + (d.ke || diberikan.length + 1)),
        ulangan, palingCepat, dianjurkan, batasAkhir,
        // Dari mana batas "paling cepat" itu berasal. Dipakai penyusun pesan
        // supaya peringatannya berbunyi "kurang dari jarak minimum dari dosis
        // sebelumnya" atau "di bawah usia minimum" — bukan sekadar "terlalu
        // cepat", yang tidak memberi tahu apa yang harus diperbaiki.
        dariUsia, dariJarak, dosisSebelumnya: terakhir,
      },
    };
  }

  // Inti fiturnya. Untuk satu anak: tiap seri, dosis mana yang berikutnya,
  // paling cepat boleh kapan, dianjurkan kapan, dan seberapa tertinggal.
  //
  // SENGAJA TIDAK DIINGAT ANTAR PEMANGGILAN. Versi pertama menyimpan hasilnya
  // di sebuah Map yang dibuang tiap kali _save() berjalan, dan itu langsung
  // menjatuhkan uji lama: kode yang mengubah this.data secara langsung — tanpa
  // lewat _save — membuat kartu vaksin menunjukkan keadaan sebelum suntikan
  // terakhir. Kartu vaksin yang basi jauh lebih sulit ditemukan daripada
  // kartu vaksin yang lambat, dan taruhannya anak. Penghematannya dicari di
  // tempat lain: pemanggil yang butuh daftar DAN hitungannya sekaligus
  // sekarang menghitung sekali lalu mengoper hasilnya (lihat dueReminderCounts).
  childVaxPlan(patientId, opts) {
    const o = opts || {};
    const p = this.getPatient(patientId);
    const hariIni = o.today || todayLocal();
    const meta = this.idaiMeta();
    const kosong = { patient: p || null, lahir: '', umur: '', umurHari: null, verified: meta.verified === true, meta, items: [], error: '' };
    if (!p) return { ...kosong, error: 'Pasien tidak ditemukan.' };
    const lahir = String(p.birth_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lahir)) {
      return { ...kosong, error: 'Tanggal lahir belum terisi. Jadwal vaksin tidak bisa dihitung tanpa itu.' };
    }
    const umurHari = selisihHariIdai(lahir, hariIni);
    const ambang = Number(meta.ambang_telat_hari) > 0 ? Number(meta.ambang_telat_hari) : AMBANG_TELAT_HARI;

    const semua = this.idaiSchedule();
    // Seri yang saling menggantikan (rotavirus monovalen vs pentavalen, dua
    // macam vaksin dengue) hanya boleh muncul satu. Yang dipilih: yang sudah
    // pernah dipakai anak ini; kalau belum ada, yang pertama di daftar.
    const dipakai = new Set();
    for (const s of semua) {
      if (!s.grup) continue;
      if (this._dosisSeri(patientId, s.key).length) dipakai.add(s.grup + '::' + s.key);
    }
    const grupTerpilih = {};
    for (const s of semua) {
      if (!s.grup) continue;
      if (grupTerpilih[s.grup]) continue;
      const adaYangDipakai = semua.find(x => x.grup === s.grup && dipakai.has(s.grup + '::' + x.key));
      grupTerpilih[s.grup] = adaYangDipakai ? adaYangDipakai.key : s.key;
    }

    const items = [];
    for (const seri of semua) {
      if (seri.grup && grupTerpilih[seri.grup] !== seri.key) continue;
      const diberikan = this._dosisSeri(patientId, seri.key);
      const daftarDosis = seri.dosis || [];

      const dasar = {
        key: seri.key, nama: seri.nama, wajib: seri.wajib !== false,
        catatan: seri.catatan || '', grup: seri.grup || '',
        alternatif: seri.grup ? semua.filter(x => x.grup === seri.grup && x.key !== seri.key).map(x => x.nama) : [],
        total: daftarDosis.length, sudah: diberikan.length,
        riwayat: diberikan.map((v, i) => ({
          ke: i + 1, tanggal: String(v.date_given).slice(0, 10),
          merek: v.vaccine_brand || '', tempat: v.location || '',
          luar: this.isVaxExternal(v), id: v.id,
          // Dosis yang saat direkam ternyata di luar jadwal. Ditandai satu kali
          // di createVaccination dan dibawa terus, supaya tidak perlu dihitung
          // ulang tiap kali kartunya digambar — dan supaya alasan yang ditulis
          // dokter saat itu tidak hilang.
          luarJadwal: v.off_schedule === true,
          luarJadwalAlasan: v.off_schedule_reason || '',
          luarJadwalCatatan: v.off_schedule_note || '',
        })),
      };
      // Dosis di luar jadwal TETAP dihitung sebagai sudah masuk — mengeluarkannya
      // diam-diam sama menyesatkannya dengan menerimanya diam-diam. Yang berubah:
      // serinya membawa catatan bahwa ada dosis yang perlu ditinjau ulang.
      dasar.luarJadwalDosis = dasar.riwayat.filter(r => r.luarJadwal);

      const hitung = this._seriBerikut(seri, lahir, diberikan, hariIni);
      if (hitung.selesai) {
        items.push({ ...dasar, status: 'selesai', statusLabel: hitung.label, berikut: null });
        continue;
      }
      const berikut = hitung.berikut;
      const { palingCepat, dianjurkan, batasAkhir } = berikut;

      let status = '', statusLabel = '', telatHari = 0, sisaHari = 0;
      if (batasAkhir && hariIni > batasAkhir) {
        status = 'lewat_batas';
        statusLabel = 'Sudah lewat batas usia';
      } else if (palingCepat > hariIni) {
        status = 'belum_waktunya';
        sisaHari = selisihHariIdai(hariIni, palingCepat) || 0;
        statusLabel = 'Belum waktunya';
      } else if (dianjurkan > hariIni) {
        status = 'boleh';
        sisaHari = selisihHariIdai(hariIni, dianjurkan) || 0;
        statusLabel = 'Boleh sekarang';
      } else {
        telatHari = selisihHariIdai(dianjurkan, hariIni) || 0;
        if (telatHari > ambang) {
          // Tertinggal sejauh ini bukan lagi soal menggeser tanggal. Jadwal
          // kejarnya bergantung pada dosis mana saja yang sudah masuk dan
          // usia anaknya sekarang — itu penilaian dokter, bukan hitungan.
          status = 'perlu_dinilai_dokter';
          statusLabel = 'Perlu dinilai dokter';
        } else if (telatHari > 0) {
          status = 'terlambat';
          statusLabel = 'Terlambat ' + telatHari + ' hari';
        } else {
          status = 'jatuh_tempo';
          statusLabel = 'Jatuh tempo hari ini';
        }
      }

      items.push({ ...dasar, berikut, status, statusLabel, telatHari, sisaHari });
    }

    const urutan = { perlu_dinilai_dokter: 0, terlambat: 1, jatuh_tempo: 2, boleh: 3, belum_waktunya: 4, lewat_batas: 5, selesai: 6 };
    items.sort((a, b) => (urutan[a.status] - urutan[b.status])
      || (a.wajib === b.wajib ? 0 : (a.wajib ? -1 : 1))
      || String((a.berikut || {}).dianjurkan || '').localeCompare(String((b.berikut || {}).dianjurkan || '')));

    return {
      patient: p, lahir, umur: umurLabel(lahir, hariIni), umurHari,
      verified: meta.verified === true, meta, items, error: '',
      ringkas: {
        perluDinilai: items.filter(i => i.status === 'perlu_dinilai_dokter').length,
        terlambat: items.filter(i => i.status === 'terlambat').length,
        jatuhTempo: items.filter(i => i.status === 'jatuh_tempo').length,
        boleh: items.filter(i => i.status === 'boleh').length,
        // Dihitung per SUNTIKAN, bukan per baris seri. Satu suntikan pentavalen
        // muncul di tiga seri sekaligus (DTP, Hepatitis B, Hib) — menjumlah
        // barisnya membuat satu dosis janggal terbaca sebagai tiga.
        luarJadwal: new Set(items.flatMap(i => (i.luarJadwalDosis || []).map(r => r.id))).size,
      },
    };
  }

  // ==========================================================================
  // MEMERIKSA SATU DOSIS YANG SEDANG DIREKAM
  //
  // Sebelum ini, "paling cepat boleh" dihitung dengan benar dan ditampilkan di
  // layar — lalu tidak dipakai untuk apa pun. Dosis DTP kedua yang diberikan
  // seminggu setelah yang pertama (seharusnya berjarak 4 minggu) diterima
  // tanpa suara, dihitung sebagai dosis sah, dan serinya maju ke dosis 3.
  // Anaknya tampil "sesuai jadwal" padahal dosis keduanya tidak berlaku dan
  // harus diulang. Itu lebih buruk daripada tidak menghitung sama sekali:
  // aplikasinya memberi rasa aman yang keliru.
  //
  // Fungsi ini TIDAK MENOLAK apa pun. Vaksinnya sudah masuk ke tubuh anak —
  // menolak mencatatnya hanya membuat kejadiannya hilang dari riwayat, dan
  // riwayat yang bolong jauh lebih berbahaya daripada riwayat yang bertanda.
  // Yang dilakukannya: menamai apa yang janggal, supaya ada yang meninjau.
  //
  // Dipanggil dari createVaccination — SATU PINTU yang dilewati semua jalur
  // pencatatan (dokter, admin, vaksin luar). Diletakkan di sana, bukan di
  // formulirnya, karena formulir bisa bertambah dan yang baru akan lupa
  // memanggilnya.
  //
  // opts: { patient_id, vaccine_name, vaccine_brand, series_key, date_given,
  //         exclude_id, today }
  vaxDoseCheck(opts) {
    const o = opts || {};
    const hariIni = o.today || todayLocal();
    const tgl = String(o.date_given || '').slice(0, 10);
    const hasil = { luarJadwal: false, dikenali: true, alasan: [], seri: [] };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return hasil;

    const kunci = this.vaxSeriesKeys(o.vaccine_name, o.vaccine_brand, o.series_key);
    hasil.seri = kunci;
    // Nama vaksin yang tidak cocok dengan satu pun alias tidak akan pernah
    // terhitung di seri mana pun — anaknya terlihat tertinggal padahal sudah
    // disuntik. Sebelumnya itu terjadi tanpa jejak apa pun.
    if (!kunci.length) {
      hasil.dikenali = false;
      hasil.alasan.push('Nama vaksin "' + String(o.vaccine_name || '').trim()
        + '" tidak dikenali jadwal IDAI, jadi dosis ini tidak akan dihitung di seri mana pun.');
      return hasil;
    }

    const p = this.getPatient(o.patient_id);
    const lahir = String((p || {}).birth_date || '').slice(0, 10);
    // Tanpa tanggal lahir tidak ada yang bisa diperiksa. Itu bukan pelanggaran
    // jadwal, jadi tidak ditandai — cuma tidak bisa dinilai.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lahir)) return hasil;

    if (tgl > hariIni) {
      hasil.luarJadwal = true;
      hasil.alasan.push('Tanggal pemberian ada di masa depan (' + tgl + ').');
    }
    if (tgl < lahir) {
      hasil.luarJadwal = true;
      hasil.alasan.push('Tanggal pemberian mendahului tanggal lahir (' + lahir + ').');
      return hasil;
    }

    const grace = Math.max(0, Number(this.idaiMeta().grace_hari) || 0);

    for (const key of kunci) {
      const seri = this.idaiSchedule().find(s => s.key === key);
      if (!seri) continue;
      // Dosis SEBELUM yang sedang direkam. Baris yang sedang disunting ulang
      // dikeluarkan lewat exclude_id supaya tidak dibandingkan dengan dirinya
      // sendiri.
      const sebelumnya = this._dosisSeri(o.patient_id, key)
        .filter(v => v.id !== o.exclude_id)
        .filter(v => String(v.date_given).slice(0, 10) < tgl);
      const hitung = this._seriBerikut(seri, lahir, sebelumnya, tgl);
      if (hitung.selesai) continue;
      const b = hitung.berikut;

      if (b.palingCepat && tgl < b.palingCepat) {
        const cepatHari = selisihHariIdai(tgl, b.palingCepat) || 0;
        if (cepatHari > grace) {
          hasil.luarJadwal = true;
          // Dua sebab yang berbeda, dan yang harus diperbaiki juga berbeda:
          // jarak terlalu rapat (tunggu, atau ulangi dosis ini) versus anaknya
          // memang belum cukup umur.
          const karenaJarak = b.dariJarak && b.dariJarak > (b.dariUsia || '');
          hasil.alasan.push(karenaJarak
            ? seri.nama + ' ' + b.label + ': jaraknya ' + cepatHari
              + ' hari terlalu rapat dari dosis sebelumnya (' + b.dosisSebelumnya
              + '). Paling cepat ' + b.palingCepat + '.'
            : seri.nama + ' ' + b.label + ': anak belum mencapai usia minimum, kurang '
              + cepatHari + ' hari. Paling cepat ' + b.palingCepat + '.');
        }
      }

      if (b.batasAkhir && tgl > b.batasAkhir) {
        hasil.luarJadwal = true;
        hasil.alasan.push(seri.nama + ' ' + b.label + ': sudah lewat batas usia ('
          + b.batasAkhir + ').');
      }
    }

    return hasil;
  }

  // ==========================================================================
  // TAMPILAN KEDUA: TABEL GAYA IDAI
  //
  // Kartu per vaksin (childVaxPlan) menjawab "apa langkah berikutnya untuk
  // vaksin ini". Yang TIDAK dijawabnya: "apa saja yang seharusnya sudah masuk
  // tapi belum" — untuk tahu itu, seseorang harus membaca semua kartu satu
  // per satu lalu menyusun sendiri gambarannya di kepala. Itulah keluhan yang
  // muncul saat memakainya.
  //
  // Tabel ini memakai kerangka yang sama persis dengan lembar IDAI yang sudah
  // dikenal dokter — vaksin ke bawah, usia ke samping — lalu MENIMPAKAN
  // keadaan anak ini di atasnya. Yang membuatnya langsung terbaca adalah
  // GARIS HARI INI: semua sel di sebelah KIRI garis yang tidak hijau adalah
  // yang terlewat. Tidak perlu membandingkan tanggal satu per satu lagi.
  // ==========================================================================
  childVaxGrid(patientId, opts) {
    const o = opts || {};
    const hariIni = o.today || todayLocal();
    const plan = this.childVaxPlan(patientId, { today: hariIni });
    if (plan.error) return { ...plan, kolom: [], baris: [], hariIniKolom: -1 };

    const umurBulan = (() => {
      const lahir = plan.lahir;
      const [y1, m1, d1] = lahir.split('-').map(Number);
      const [y2, m2, d2] = hariIni.split('-').map(Number);
      let b = (y2 - y1) * 12 + (m2 - m1);
      if (d2 < d1) b -= 1;
      return Math.max(0, b);
    })();

    const hariIniKolomTmp = kolomUntukBulan(umurBulan);

    const baris = [];
    for (const it of plan.items) {
      const seri = this.idaiSchedule().find(s => s.key === it.key);
      if (!seri) continue;
      const daftar = seri.dosis || [];
      const sel = [];

      for (let i = 0; i < daftar.length; i++) {
        const d = daftar[i];
        const kolom = kolomUntukBulan(usiaKeBulan(d.usiaAnjuran));
        const nomor = i + 1;
        const sudah = it.riwayat.find(r => r.ke === nomor) || null;

        // Status per SEL, bukan per seri. Sebuah seri bisa punya dosis 1-2
        // hijau dan dosis 3 merah sekaligus — dan justru perbedaan itulah
        // yang dicari mata saat membaca tabel.
        //
        // 'tertinggal' adalah keadaan yang TIDAK ADA pada tampilan kartu, dan
        // justru inilah yang membuat tabelnya berguna. Ambil bayi 5 bulan
        // yang belum divaksin sama sekali: dosis 1 memang terlambat, tapi
        // dosis 2 dan 3 tidak bisa disebut "terlambat" — keduanya belum boleh
        // diberikan sebelum dosis 1 masuk. Menyebutnya "belum waktunya" pun
        // menyesatkan: kotaknya berada di kiri garis hari ini, artinya slot
        // usianya sudah lewat dan tetap kosong. Jadi ia diberi nama sendiri:
        // slot yang terlewat, menunggu dosis sebelumnya.
        let status;
        if (sudah) status = 'sudah';
        else if (it.berikut && it.berikut.ke === nomor) status = it.status;
        else if (it.status === 'lewat_batas') status = 'lewat_batas';
        else if (kolom <= hariIniKolomTmp) status = 'tertinggal';
        else status = 'belum_waktunya';

        sel.push({
          kolom, ke: nomor, status,
          jenis: d.jenis || (nomor === 1 ? 'primer' : 'booster'),
          label: d.label || ('Dosis ' + nomor),
          tanggal: sudah ? sudah.tanggal : '',
          tempat: sudah ? sudah.tempat : '',
          luar: sudah ? !!sudah.luar : false,
          // Hanya sel yang SEDANG jadi giliran berikutnya yang membawa
          // tanggal hitungan; sel lain tidak, supaya tidak ada tanggal
          // menggantung yang terbaca sebagai anjuran padahal bukan.
          berikut: (it.berikut && it.berikut.ke === nomor) ? it.berikut : null,
        });
      }

      // Seri yang diulang seumur hidup (influenza tiap tahun, tifoid tiap 3
      // tahun) tidak punya sel bernomor sesudah dosis awalnya. Digambar
      // sebagai pita, seperti pada lembar IDAI.
      let pita = null;
      if (seri.ulang) {
        const mulai = kolomUntukBulan(usiaKeBulan((daftar[0] || {}).usiaAnjuran));
        const habis = seri.ulang.sampaiUsia
          ? kolomUntukBulan(usiaKeBulan(seri.ulang.sampaiUsia))
          : KOLOM_USIA.length - 1;
        pita = { dari: mulai, sampai: habis, teks: seri.ulang.jarak && seri.ulang.jarak.tahun
          ? 'diulang tiap ' + seri.ulang.jarak.tahun + ' tahun' : 'diulang tiap tahun' };
      }

      baris.push({
        key: it.key, nama: it.nama, wajib: it.wajib, catatan: it.catatan,
        status: it.status, statusLabel: it.statusLabel,
        sudah: it.sudah, total: it.total, sel, pita,
      });
    }

    return {
      ...plan,
      kolom: KOLOM_USIA,
      baris,
      hariIniKolom: hariIniKolomTmp,
      umurBulan,
    };
  }

  // Anak = di bawah 18 tahun. Jadwal IDAI berhenti di situ.
  isAnak(patient, today) {
    const lahir = String((patient || {}).birth_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lahir)) return false;
    return (today || todayLocal()) < tambahUsia(lahir, { tahun: 18 });
  }

  // Daftar kerja: anak-anak yang vaksinnya sudah lewat waktu. Dipakai halaman
  // dokter/admin — bukan lagi menunggu orang tua yang ingat sendiri.
  childVaxWorklist(opts) {
    const o = opts || {};
    const hariIni = o.today || todayLocal();
    const batasan = o.status || ['perlu_dinilai_dokter', 'terlambat', 'jatuh_tempo'];
    const hasil = [];
    for (const p of (this.data.patients || [])) {
      if (!this.isAnak(p, hariIni)) continue;
      const plan = this.childVaxPlan(p.id, { today: hariIni });
      if (plan.error) continue;
      const perlu = plan.items.filter(i => batasan.includes(i.status) && (o.termasukPilihan ? true : i.wajib));
      if (!perlu.length) continue;
      hasil.push({ patient: p, umur: plan.umur, items: perlu });
    }
    hasil.sort((a, b) => (b.items.length - a.items.length) || String(a.patient.full_name || '').localeCompare(String(b.patient.full_name || '')));
    return o.limit ? hasil.slice(0, o.limit) : hasil;
  }

  // ---- Vaksin yang diberikan DI LUAR (puskesmas / klinik lain) ------------
  //
  // Kalau stok di sini kosong, anaknya tidak boleh ikut menunggu: yang benar
  // adalah menyarankan puskesmas atau klinik lain berikut tanggal yang boleh,
  // lalu MENCATAT hasilnya begitu orang tua melapor. Tanpa pencatatan itu,
  // seri anaknya terlihat bolong selamanya di sini dan pengingatnya terus
  // menagih dosis yang sebetulnya sudah masuk.
  //
  // Statusnya 'external', bukan 'approved'. Bedanya bukan main-main: yang ini
  // keterangan orang tua tentang tindakan yang bukan kami lakukan, jadi ia
  // sah sebagai riwayat tetapi tidak boleh ikut tercetak di sertifikat yang
  // kami tanda tangani.
  async recordVaccinationElsewhere(data) {
    const d = data || {};
    if (!d.patient_id || !this.getPatient(d.patient_id)) return { error: 'Pasien tidak ditemukan.' };
    if (!String(d.vaccine_name || '').trim()) return { error: 'Nama vaksin wajib diisi.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date_given || ''))) return { error: 'Tanggal pemberian wajib diisi.' };
    if (String(d.date_given) > todayLocal()) return { error: 'Tanggal pemberian tidak boleh di masa depan.' };
    if (!String(d.place || '').trim()) return { error: 'Tempat vaksinasi wajib diisi (puskesmas / klinik mana).' };

    const seriKeys = d.series_key
      ? String(d.series_key)
      : this.vaxSeriesKeys(d.vaccine_name, d.vaccine_brand || '').join(',');

    const vax = await this.createVaccinationAwaited({
      patient_id: d.patient_id,
      vaccine_name: String(d.vaccine_name).trim(),
      vaccine_brand: String(d.vaccine_brand || '').trim(),
      vax_mode: 'series',
      dose_number: Number(d.dose_number) || 1,
      total_doses: Number(d.total_doses) || 1,
      date_given: String(d.date_given).slice(0, 10),
      next_dose_date: '',
      batch_number: String(d.batch_number || '').trim(),
      administered_by: '',
      location: String(d.place).trim(),
      notes: ['Diberikan di luar: ' + String(d.place).trim(), 'Dicatat atas keterangan orang tua/wali.', String(d.notes || '').trim()].filter(Boolean).join(' | '),
      approval_status: 'external',
      approval_doctor_id: '',
      approval_created_by: d.created_by || '',
      vax_source: 'luar',
      series_key: seriKeys,
      reject_reason: '',
    });

    // Kolom vax_source & series_key datang dari supabase-vax-schedule.sql.
    // Kalau migrasinya belum jalan, Postgres menolak seluruh barisnya dan
    // id-nya tetap placeholder — lebih baik berhenti dengan pesan jelas
    // daripada membiarkan staf mengira catatannya sudah masuk server.
    if (!CONFIG.DEMO_MODE && String(vax.id).startsWith('id_')) {
      this.data.vaccinations = this.data.vaccinations.filter(x => x.id !== vax.id);
      this._save();
      return { error: 'Gagal menyimpan ke server. Pastikan migrasi supabase-vax-schedule.sql sudah dijalankan di Supabase.' };
    }
    return { success: true, vaccination: vax };
  }

  // ---- Lokasi / Tempat Praktik (master data) ------------------------------
  // Dulu di-hardcode sebagai CONFIG.LOCATIONS. Sekarang dikelola dari halaman
  // Super Admin dan disimpan di tabel practice_locations. CONFIG.LOCATIONS
  // tetap dipakai sebagai cadangan bila tabelnya belum dibuat / gagal dimuat,
  // supaya dropdown lokasi tidak pernah kosong.
  getAllLocations() {
    const rows = this.data.practice_locations || [];
    return rows.slice().sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100) || String(a.name || '').localeCompare(String(b.name || '')));
  }

  getActiveLocations() { return this.getAllLocations().filter(l => l.is_active !== false); }

  // Dipakai untuk mengisi <select> — selalu mengembalikan array nama (string).
  getLocationNames() {
    const names = this.getActiveLocations().map(l => l.name).filter(Boolean);
    return names.length ? names : (CONFIG.LOCATIONS || ['Klinik Utama Prima', 'Home Care', 'Telemedicine']);
  }

  // Cari data lengkap sebuah tempat dari namanya (nama itulah yang tersimpan
  // di medical_records.location), agar alamatnya bisa dicetak di kop resep.
  // ==========================================================================
  // KOP RESEP PER DOKTER
  //
  // Kop menyatakan SIAPA YANG MENULIS resep, bukan ke mana resepnya dikirim.
  // Resep dr. Kevin berkop Klinik Prima tetap boleh ditebus di apotek mana pun.
  //
  // Urutan penentuannya, dari yang paling menentukan:
  //   1. Kop bawaan dokternya (doctors.kop_location_id) — inilah yang dimaksud
  //      "dr. Niko memakai kop Apotek Medika Raya".
  //   2. Tempat praktik yang tertulis pada resep itu, bila tempatnya punya
  //      identitas kop sendiri.
  //   3. Identitas Klinik Prima.
  //
  // Lihat supabase-doctor-letterhead.sql.
  // ==========================================================================
  // Daftar tempat praktik seorang dokter, BESERTA NOMOR SIP di tiap tempat.
  // Bentuknya [{ location_id, sip_number }]. SIP memang diterbitkan per tempat
  // praktik, jadi dokter yang praktik di dua tempat punya dua nomor berbeda.
  doctorPracticePlaces(doctorId) {
    const d = this.getDoctor(doctorId);
    let v = d && d.practice_places;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
    if (!Array.isArray(v)) return [];
    return v
      .map(x => (typeof x === 'string'
        // Bentuk lama (hanya daftar id) tetap terbaca, SIP-nya dianggap kosong.
        ? { location_id: x, sip_number: '' }
        : { location_id: (x && x.location_id) || '', sip_number: String((x && x.sip_number) || '').trim() }))
      .filter(x => x.location_id);
  }

  doctorPracticeLocationIds(doctorId) {
    return this.doctorPracticePlaces(doctorId).map(x => x.location_id);
  }

  async setDoctorPracticePlaces(doctorId, places) {
    const d = this.getDoctor(doctorId);
    if (!d) return { error: 'Dokter tidak ditemukan' };
    const daftar = this.data.practice_locations || [];
    const terlihat = new Set();
    const bersih = (places || [])
      .map(x => ({ location_id: (x && x.location_id) || '', sip_number: String((x && x.sip_number) || '').trim() }))
      .filter(x => {
        if (!x.location_id || terlihat.has(x.location_id)) return false;
        if (!daftar.some(l => l.id === x.location_id)) return false;
        terlihat.add(x.location_id);
        return true;
      });
    d.practice_places = bersih;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(doctorId).startsWith('id_')) {
      supabase.update('doctors', doctorId, { practice_places: bersih }).catch(() => {});
    }
    return { success: true, places: bersih };
  }

  // SIP yang berlaku untuk sebuah resep: SIP di tempat kop resep itu, kalau
  // diisi; kalau tidak, SIP utama dokternya. Yang tercetak harus SIP di tempat
  // resep itu ditulis — bukan sembarang satu.
  doctorSipFor(doctorId, kopLocationId) {
    const d = this.getDoctor(doctorId);
    const utama = (d && d.sip_number) || '';
    if (!kopLocationId) return utama;
    const p = this.doctorPracticePlaces(doctorId).find(x => x.location_id === kopLocationId);
    return (p && p.sip_number) || utama;
  }

  // Pilihan kop yang ditawarkan saat menulis resep. Tempat praktik dokternya
  // ditaruh di depan (ditandai milik dia), sisanya tetap boleh dipilih —
  // membatasi hanya akan memaksa orang mengakali sistem saat ada keadaan yang
  // tidak terduga.
  getKopChoicesForDoctor(doctorId) {
    const milik = this.doctorPracticePlaces(doctorId);
    return (this.data.practice_locations || [])
      .filter(l => l.is_active !== false)
      .map(l => {
        const p = milik.find(x => x.location_id === l.id);
        return {
          id: l.id, name: l.name || '',
          kop_name: String(l.kop_name || '').trim(),
          mine: !!p,
          sip: (p && p.sip_number) || '',
        };
      })
      .sort((a, b) => (a.mine === b.mine ? a.name.localeCompare(b.name) : (a.mine ? -1 : 1)));
  }

  // kopLocationId = kop yang DIPILIH untuk resep itu; paling menentukan.
  getKopFor(doctorId, practicePlace, kopLocationId) {
    const bawaan = {
      name: 'KLINIK KASIH ANUGERAH PRIMA',
      sub: '(PRIMA KLINIK)',
      address: CONFIG.CLINIC_ADDRESS || '',
      phone: CONFIG.CLINIC_WHATSAPP_DISPLAY || '',
      email: 'primaklinik.ptk@gmail.com',
      logo: 'assets/logos/klinik-prima-logo.png',
      source: 'klinik',
    };
    const dokter = this.getDoctor(doctorId);
    const daftar = this.data.practice_locations || [];
    // Pilihan pada resepnya menang atas apa pun. Dokter yang praktik di dua
    // tempat memilih kop saat menulis, dan pilihannya menempel pada resep itu.
    const dipilih = kopLocationId ? daftar.find(l => l.id === kopLocationId) : null;
    const dariDokter = dokter && dokter.kop_location_id
      ? daftar.find(l => l.id === dokter.kop_location_id)
      : null;
    // Tempat pada resepnya hanya dipakai bila ia benar-benar punya identitas
    // kop; kalau hanya punya alamat, alamatnya saja yang menimpa — itulah
    // perilaku lama yang tetap dipertahankan.
    const dariTempat = practicePlace ? this.findLocationByName(practicePlace) : null;
    const utama = dariDokter || null;

    // Bila kopnya sudah DIPILIH pada resep, atau dokternya sudah DIPATOK ke
    // sebuah tempat, tempat itulah yang berlaku sepenuhnya — tempat pada
    // resepnya tidak boleh menimpanya.
    // Tanpa aturan ini, dr. Kevin yang dipatok ke Klinik Prima akan tercetak
    // berkop apotek hanya karena kebetulan menulis resep di sana.
    const pakai = dipilih || utama || dariTempat;
    const kop = { ...bawaan };
    if (pakai && String(pakai.kop_name || '').trim()) {
      kop.name = String(pakai.kop_name).trim();
      kop.sub = String(pakai.kop_sub || '').trim();
      kop.email = String(pakai.kop_email || '').trim();
      kop.logo = String(pakai.kop_logo_url || '').trim();
      kop.source = dipilih ? 'resep' : (utama ? 'dokter' : 'tempat');
    } else if (dipilih || utama) {
      // Dipatok ke tempat yang belum punya identitas kop: identitasnya tetap
      // Klinik Prima, tapi alamat & teleponnya ikut tempat itu.
      kop.source = dipilih ? 'resep' : 'dokter';
    }
    if (pakai && (pakai.address || pakai.phone)) {
      kop.address = pakai.address || bawaan.address;
      kop.phone = pakai.phone || bawaan.phone;
    }
    return kop;
  }

  // Unggah logo kop sebuah tempat praktik.
  //
  // Disimpan di bucket PUBLIK 'letterheads'. Logo bukan rahasia, dan kop resep
  // harus tetap tampil saat lembarnya dicetak ulang bertahun kemudian —
  // tautan bertanda tangan kedaluwarsa dalam hitungan jam, jadi tidak cocok.
  async uploadKopLogo(locationId, file) {
    if (!file) return { error: 'Belum ada berkas yang dipilih.' };
    const tipe = String(file.type || '');
    if (!/^image\//.test(tipe)) return { error: 'Berkasnya harus berupa gambar (PNG / JPG / WEBP).' };
    // Logo yang terlalu besar memperlambat setiap kali resep dicetak, dan
    // tidak menambah ketajaman pada ukuran cetak 20mm.
    if (file.size > 2 * 1024 * 1024) return { error: 'Ukuran logo maksimal 2 MB. Perkecil dulu gambarnya.' };
    if (CONFIG.DEMO_MODE) return { success: true, url: '' };
    const aman = String(file.name || 'logo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${locationId || 'umum'}/${Date.now()}_${aman}`;
    const up = await supabase.uploadFile('letterheads', path, file);
    if (up && up.error) {
      return { error: 'Gagal mengunggah logo: '
        + this._pesanGalatStorage(up.error, 'letterheads', 'centang Public, supaya logonya tetap tampil saat resep dicetak ulang') };
    }
    const url = supabase.publicUrl('letterheads', path);
    if (!url) return { error: 'Logo terunggah tapi tautannya tidak terbentuk.' };
    return { success: true, url, path };
  }

  // Menyetel kop bawaan seorang dokter.
  async setDoctorKop(doctorId, locationId) {
    const d = this.getDoctor(doctorId);
    if (!d) return { error: 'Dokter tidak ditemukan' };
    const id = locationId || null;
    if (id && !(this.data.practice_locations || []).some(l => l.id === id)) {
      return { error: 'Tempat praktik tidak ditemukan' };
    }
    d.kop_location_id = id;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(doctorId).startsWith('id_')) {
      supabase.update('doctors', doctorId, { kop_location_id: id }).catch(() => {});
    }
    return { success: true, kop: this.getKopFor(doctorId, '') };
  }

  findLocationByName(name) {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    return this.getAllLocations().find(l => String(l.name || '').trim().toLowerCase() === key) || null;
  }

  async loadLocations() {
    if (CONFIG.DEMO_MODE) return this.getAllLocations();
    try {
      const rows = await supabase.select('practice_locations', { order: 'sort_order.asc' });
      // select() mengembalikan [] baik saat tabel belum ada maupun saat memang
      // kosong, jadi hanya timpa bila benar-benar ada isinya — supaya daftar
      // lokal tidak terhapus hanya karena SQL-nya belum dijalankan.
      if (Array.isArray(rows) && rows.length) { this.data.practice_locations = rows; this._save(); }
    } catch (e) { /* tabel belum dibuat — pakai cadangan CONFIG.LOCATIONS */ }
    return this.getAllLocations();
  }

  // =========================================================================
  // TEMPAT PRAKTIK MENGIKUTI AKUN FASILITAS
  //
  // Aplikasi ini bukan lagi milik satu klinik. Ia menghubungkan dokter,
  // apotek, klinik, dan admin dari berbagai tempat — jadi setiap fasilitas
  // yang punya akun HARUS punya tempat praktiknya sendiri, lengkap dengan
  // kop. Kalau tidak, resep dan surat dari sana tercetak memakai identitas
  // klinik lain, dan dokumen medis yang salah kop adalah dokumen yang salah
  // penerbitnya.
  //
  // TEMPAT PRAKTIK ADA DUA MACAM, dan bedanya menentukan mana yang wajib:
  //
  //   'facility' — tempat fisik yang punya akun (apotek / klinik). Wajib ada
  //                untuk tiap akun, dan kop-nya wajib diisi.
  //   'service'  — CARA layanan, bukan tempat: Home Care, Telemedicine.
  //                Tidak punya akun, tidak punya kop sendiri, dan tidak boleh
  //                ikut ditagih kelengkapannya.
  //
  // Baris lama belum punya kolom kind, jadi jenisnya disimpulkan dari
  // namanya. Kesimpulan itu hanya cadangan — supabase-location-kind.sql
  // mengisinya sekali, dan sesudah itu kolomnya yang berlaku.
  // =========================================================================

  locationKind(l) {
    if (!l) return 'facility';
    if (l.kind === 'service' || l.kind === 'facility') return l.kind;
    const n = this.normalizeName(l.name);
    return (n === 'home care' || n === 'telemedicine') ? 'service' : 'facility';
  }

  isServiceLocation(l) { return this.locationKind(l) === 'service'; }

  // Apotek yang belum punya tempat praktik. Inilah daftar kerja halaman
  // "Tempat Praktik & Kop": tiap akun fasilitas harus punya satu.
  pharmaciesWithoutLocation() {
    return (this.data.pharmacies || []).filter(p => !this.pharmacyLocationId(p.id));
  }

  // Buatkan tempat praktik untuk sebuah akun apotek, lalu tautkan. Aman
  // diulang: kalau sudah ada (lewat location_id maupun kecocokan nama),
  // yang sudah ada itulah yang dipakai — bukan dibuatkan yang kedua.
  async ensureLocationForPharmacy(pharmacyId) {
    const ph = (this.data.pharmacies || []).find(p => p.id === pharmacyId);
    if (!ph) return { error: 'Apotek tidak ditemukan' };
    const adaId = this.pharmacyLocationId(pharmacyId);
    if (adaId) {
      // Sudah cocok lewat nama tapi belum ditautkan tegas — tegaskan sekarang,
      // supaya kelak tidak bergantung pada nama yang bisa berubah.
      if (!ph.location_id) await this.setPharmacyLocation(pharmacyId, adaId);
      return { success: true, sudah: true, location_id: adaId };
    }
    const nama = String(ph.name || '').trim();
    if (!nama) return { error: 'Akun apotek ini belum punya nama' };
    const res = await this.createLocation({
      name: nama, address: ph.address || '', phone: ph.phone || '',
      notes: 'Dibuat otomatis dari akun ' + nama,
      sort_order: 100, kind: 'facility',
      // Kop sengaja DIBIARKAN KOSONG, bukan diisi tebakan. Kop adalah
      // identitas resmi yang tercetak di resep; menebaknya berarti mencetak
      // identitas karangan, dan itu lebih buruk daripada kolom kosong yang
      // ditagih halaman ini sampai diisi orangnya.
    });
    if (!res || res.error) return { error: (res && res.error) || 'Gagal membuat tempat praktik' };
    await this.setPharmacyLocation(pharmacyId, res.item.id);
    return { success: true, sudah: false, location_id: res.item.id, item: res.item };
  }

  // Apa yang masih kurang pada daftar tempat praktik. Dipakai halaman admin
  // untuk menagih, bukan sekadar menampilkan daftar apa adanya.
  locationIssues() {
    const masalah = [];
    for (const ph of this.pharmaciesWithoutLocation()) {
      masalah.push({ jenis: 'tanpa-tempat', pharmacy_id: ph.id, nama: ph.name || '(tanpa nama)' });
    }
    for (const l of (this.data.practice_locations || [])) {
      if (this.isServiceLocation(l)) continue;         // Home Care & Telemedicine memang tidak berkop
      if (l.is_active === false) continue;
      if (!String(l.kop_name || '').trim()) {
        masalah.push({ jenis: 'tanpa-kop', location_id: l.id, nama: l.name || '(tanpa nama)' });
      }
    }
    return masalah;
  }

  async createLocation(data) {
    const payload = {
      name: String(data.name || '').trim(), address: data.address || '', phone: data.phone || '',
      notes: data.notes || '', is_active: data.is_active !== false,
      sort_order: Number(data.sort_order) || 100,
      // Identitas kop resep tempat ini. Boleh kosong — yang kosong jatuh
      // kembali ke identitas Klinik Prima (lihat getKopFor).
      kop_name: String(data.kop_name || '').trim(),
      kop_sub: String(data.kop_sub || '').trim(),
      kop_email: String(data.kop_email || '').trim(),
      kop_logo_url: String(data.kop_logo_url || '').trim(),
      // 'facility' = tempat fisik berakun (wajib berkop); 'service' = cara
      // layanan seperti Home Care / Telemedicine.
      kind: data.kind === 'service' ? 'service' : 'facility',
    };
    if (!payload.name) return { error: 'Nama tempat wajib diisi' };
    if (this.findLocationByName(payload.name)) return { error: 'Tempat dengan nama itu sudah ada' };
    if (CONFIG.DEMO_MODE) {
      const rec = { id: generateId(), ...payload };
      this.data.practice_locations = (this.data.practice_locations || []).concat(rec);
      this._save();
      return { success: true, item: rec };
    }
    const inserted = await supabase.insert('practice_locations', payload);
    if (inserted && inserted.error) return { error: inserted.error };
    this.data.practice_locations = (this.data.practice_locations || []).concat(inserted || { id: generateId(), ...payload });
    this._save();
    return { success: true, item: inserted || null };
  }

  async updateLocation(id, updates) {
    const l = (this.data.practice_locations || []).find(x => x.id === id);
    const nextName = updates.name !== undefined ? String(updates.name || '').trim() : (l && l.name);
    if (updates.name !== undefined && !nextName) return { error: 'Nama tempat wajib diisi' };
    const clash = nextName && this.findLocationByName(nextName);
    if (clash && clash.id !== id) return { error: 'Tempat dengan nama itu sudah ada' };
    if (l) { Object.assign(l, updates); this._save(); }
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.update('practice_locations', id, updates).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  async toggleLocationActive(id) {
    const l = (this.data.practice_locations || []).find(x => x.id === id);
    if (!l) return { error: 'Tempat tidak ditemukan' };
    return this.updateLocation(id, { is_active: !(l.is_active !== false) });
  }

  // Menghapus tempat TIDAK mengubah rekam medis lama: kolom location di sana
  // menyimpan teks nama, bukan referensi, jadi riwayat tetap utuh.
  async deleteLocation(id) {
    this.data.practice_locations = (this.data.practice_locations || []).filter(x => x.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.delete('practice_locations', id).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  // Berapa kali sebuah nama tempat dipakai — ditampilkan sebelum menghapus.
  countLocationUsage(name) {
    const key = String(name || '').trim().toLowerCase();
    const hit = (arr) => (arr || []).filter(r => String(r.location || '').trim().toLowerCase() === key).length;
    return hit(this.data.medical_records) + hit(this.data.vaccinations);
  }

  // ==========================================================================
  // TO-DO / DAFTAR TUGAS  (tabel `tasks`, lihat supabase-tasks.sql)
  //
  // Dikelola Super Admin & Owner dari #/admin/tasks, dan bisa didelegasikan ke
  // staf mana pun — penerimanya melihatnya di #/tugas.
  // ==========================================================================

  // Daftar orang yang boleh menerima delegasi tugas: semua akun staf aktif
  // (pasien tidak diikutkan). Nama diambil dari profil masing-masing peran;
  // kalau profilnya belum ada, e-mail dipakai sebagai label supaya tetap bisa
  // dipilih dan tidak muncul sebagai baris kosong.
  getStaffList() {
    const ROLE_LABEL = { superadmin: 'Super Admin', owner: 'Owner', doctor: 'Dokter', pharmacy: 'Apotek' };
    return (this.data.users || [])
      .filter(u => u.is_active !== false && ROLE_LABEL[u.role])
      .map(u => {
        const p = this.getProfile(u) || {};
        const name = p.full_name || p.name || (u.email || '').split('@')[0] || 'Tanpa Nama';
        return { id: u.id, name, role: u.role, role_label: ROLE_LABEL[u.role], email: u.email || '', phone: p.phone || '' };
      })
      .sort((a, b) => a.role_label.localeCompare(b.role_label) || a.name.localeCompare(b.name));
  }

  getStaff(userId) { return this.getStaffList().find(s => s.id === userId) || null; }

  // Label penerima tugas. Tugas tanpa assignee_id = untuk pembuatnya sendiri.
  staffName(userId) {
    if (!userId) return 'Saya sendiri';
    const s = this.getStaff(userId);
    if (s) return s.name;
    // Akunnya mungkin sudah dinonaktifkan/dihapus — tugas lamanya tetap ada.
    const u = (this.data.users || []).find(x => x.id === userId);
    return u ? ((u.email || '').split('@')[0] || 'Staf') : 'Staf';
  }

  // Tahapan sebuah tugas: todo → focus → review → done. Baris lama memakai
  // 'open', yang artinya sama dengan 'todo' (lihat supabase-task-status.sql),
  // jadi dibaca lewat satu pintu ini supaya tidak ada baris yang tercecer.
  taskStatus(t) {
    const s = (t && t.status) || 'todo';
    return s === 'open' ? 'todo' : s;
  }

  // ==========================================================================
  // INBOX — tempat menampung yang belum sempat dipikirkan
  //
  // Ide datang pada saat yang tidak menyenangkan: di tengah praktik, di
  // perjalanan, sedetik sebelum tidur. Kalau mencatatnya menuntut tanggal dan
  // penerima lebih dulu, yang terjadi bukan catatan yang rapi — yang terjadi
  // adalah tidak dicatat sama sekali. Maka ada satu kolom yang boleh menerima
  // apa saja hanya dengan judulnya.
  //
  // Harganya dibayar di pintu keluar, bukan di pintu masuk: sebuah tugas baru
  // boleh meninggalkan Inbox setelah punya SETIDAKNYA tanggal ATAU penerima.
  // Dengan begitu papan di luar Inbox tetap berarti — setiap kartu di sana
  // sudah punya kapan atau siapa, dan "To-Do" tidak pelan-pelan berubah
  // menjadi tumpukan niat tanpa bentuk.
  // ==========================================================================

  isInbox(t) { return this.taskStatus(t) === 'inbox'; }

  // Aturannya sengaja satu tempat: kalau nanti syaratnya mau diperketat
  // (mis. harus ada prioritas juga), yang diubah cukup fungsi ini dan
  // seluruh jalan keluar dari Inbox ikut berubah bersamanya.
  taskIsClarified(t) {
    if (!t) return false;
    if (t.due_date) return true;
    if (this.isEvent(t)) return this.attendeeIds(t).length > 0;
    return !!t.assignee_id;
  }

  // Apa yang masih kurang — dipakai untuk menjelaskan penolakan, bukan
  // sekadar menolak. Orang yang ditolak tanpa tahu apa yang kurang akan
  // mencoba hal yang sama sekali lagi.
  taskMissingLabel(t) {
    if (this.taskIsClarified(t)) return '';
    return this.isEvent(t) ? 'tanggal atau peserta' : 'tanggal atau penerima';
  }

  // Sudah berapa lama mengendap. Bahaya terbesar sebuah inbox bukan penuh,
  // melainkan berubah menjadi kuburan yang tidak pernah dibuka lagi — dan itu
  // hanya terlihat kalau umurnya ditampilkan.
  inboxAgeDays(t) {
    const dari = (t && (t.created_at || '')) || '';
    if (!dari) return 0;
    const ms = Date.now() - Date.parse(dari);
    if (!isFinite(ms) || ms < 0) return 0;
    return Math.floor(ms / 86400000);
  }

  // Tangkap cepat: judulnya saja. Sengaja TIDAK menerima tanggal maupun
  // penerima — kalau keduanya sudah diketahui, yang dipakai adalah formulir
  // biasa dan tugasnya tidak perlu singgah di Inbox sama sekali.
  async quickCaptureTask(title, userId) {
    const judul = String(title || '').trim();
    if (!judul) return { error: 'Judulnya belum diisi.' };
    return this.createTask({ title: judul, created_by: userId || null });
  }

  // ---- Peninjauan hasil kerja (lihat supabase-task-review.sql) -------------
  //
  // Pekerjaan yang DIDELEGASIKAN tidak boleh ditutup sendiri oleh yang
  // mengerjakannya. Dia hanya bisa mengajukannya untuk ditinjau; yang menekan
  // "Selesai" adalah pemberi tugas. Kalau tidak begitu, "selesai" hanya
  // berarti "saya merasa sudah selesai", dan pemberi tugas kehilangan satu-
  // satunya saat untuk memeriksa hasilnya.
  //
  // Tugas untuk diri sendiri tidak lewat jalur ini — tidak ada gunanya
  // meminta izin kepada diri sendiri.
  isDelegated(t) {
    if (!t || this.isEvent(t)) return false;
    const a = t.assignee_id || null;
    const c = t.created_by || null;
    return !!a && !!c && a !== c;
  }

  // Yang berhak menutup tugas adalah PEMBERI tugasnya, bukan Super Admin mana
  // pun — supaya tugas dari Anis ditinjau Anis, bukan tidak sengaja ditutup
  // orang lain yang tidak tahu isinya.
  taskReviewerId(t) { return (t && t.created_by) || null; }

  canCompleteTask(t, userId) {
    if (!this.isDelegated(t)) return true;
    return this.taskReviewerId(t) === userId;
  }

  awaitingReview(t) { return this.taskStatus(t) === 'review'; }
  needsMyReview(t, userId) { return this.awaitingReview(t) && !!userId && this.taskReviewerId(t) === userId; }
  countNeedingMyReview(userId) {
    return this._visibleTasks().filter(t => this.needsMyReview(t, userId)).length;
  }

  // Tugas ini "milik" siapa dari sudut pandang seseorang. Tugas tanpa
  // penerima dianggap milik pembuatnya (dikerjakan sendiri).
  // Sebuah baris tasks bisa berupa pekerjaan ('task') atau acara ('event').
  // Lihat supabase-task-events.sql. Baris lama tanpa kolom kind = 'task'.
  taskKind(t) { return (t && t.kind) === 'event' ? 'event' : 'task'; }
  isEvent(t) { return this.taskKind(t) === 'event'; }

  // Peserta acara. Disimpan sebagai daftar id; ditoleransi juga bila datang
  // sebagai teks JSON (beberapa jalur PostgREST mengembalikannya begitu).
  attendeeIds(t) {
    let v = t && t.attendee_ids;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
    return Array.isArray(v) ? v.filter(Boolean) : [];
  }
  attendeeNames(t) { return this.attendeeIds(t).map(id => this.staffName(id)); }

  // "Milik saya" berbeda artinya untuk acara: bukan siapa yang ditugasi,
  // melainkan siapa yang HADIR. Acara tanpa peserta dianggap milik pembuatnya.
  isMyTask(t, userId) {
    if (!t || !userId) return false;
    if (this.isEvent(t)) {
      const list = this.attendeeIds(t);
      return list.length ? list.indexOf(userId) !== -1 : t.created_by === userId;
    }
    return t.assignee_id ? t.assignee_id === userId : t.created_by === userId;
  }

  // ==========================================================================
  // TUGAS PRIBADI
  //
  // Panel To-Do sengaja dibuat terbuka antar staf: dokter perlu tahu tugas
  // admin dan sebaliknya. Tapi keterbukaan itu tidak selalu benar. Ada
  // rencana yang memang belum boleh dibaca siapa pun — negosiasi sewa,
  // rencana penambahan orang, urusan yang menyangkut nama seseorang. Sebelum
  // ada ini, satu-satunya cara menyimpannya adalah dengan tidak menuliskannya
  // sama sekali, dan yang tidak tertulis adalah yang terlupakan.
  //
  // Yang boleh menandai pribadi hanya pemilik klinik (alamat pada
  // CONFIG.TASK_MANAGER_EMAILS) — SENGAJA bukan semua orang yang bisa membuat
  // tugas. Kalau setiap staf bisa menyembunyikan tugasnya, panel ini berhenti
  // menjadi gambaran pekerjaan klinik dan pemiliknya kehilangan justru hal
  // yang membuat panel ini berguna.
  canMakeTaskPrivate(user) {
    if (!user) return false;
    const allowed = (CONFIG.TASK_MANAGER_EMAILS || []).map(e => String(e).toLowerCase());
    if (allowed.includes(String(user.email || '').toLowerCase())) return true;
    // Cadangan yang sama seperti canManageNotes: bila tidak satu pun alamat
    // itu terdaftar (mis. pemiliknya memakai alamat lain), Owner tetap boleh,
    // supaya fiturnya tidak jadi tidak bisa dipakai siapa pun.
    if (user.role === 'owner') {
      return !(this.data.users || []).some(u => allowed.includes(String(u.email || '').toLowerCase()));
    }
    return false;
  }

  isTaskPrivate(t) { return !!(t && t.is_private); }

  // Tugas pribadi hanya terlihat oleh PEMBUATNYA. Bukan penerimanya — tugas
  // pribadi memang tidak boleh punya penerima (lihat createTask/updateTask),
  // karena tugas yang didelegasikan tapi tidak bisa dibaca penerimanya adalah
  // tugas yang tidak akan pernah dikerjakan.
  canSeeTask(t, userId) {
    if (!this.isTaskPrivate(t)) return true;
    return !!userId && t.created_by === userId;
  }

  _sessionUserId() {
    try {
      const u = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      return (u && u.id) || '';
    } catch (e) { return ''; }
  }

  // Satu-satunya pintu ke this.data.tasks yang dipakai layar mana pun. Semua
  // daftar, hitungan lencana, dan kalender lewat sini, supaya tidak ada satu
  // jalur pun yang lupa menyaring — RLS di server adalah pagar sebenarnya,
  // ini yang menjaga layarnya tidak bocor pada data yang sudah telanjur
  // tersimpan di perangkat (mis. sesudah ganti akun tanpa reload).
  _visibleTasks() {
    const me = this._sessionUserId();
    return (this.data.tasks || []).filter(t => this.canSeeTask(t, me));
  }

  getAllTasks() {
    const rows = this._visibleTasks().slice();
    const P = { urgent: 0, high: 1, normal: 2, low: 3 };
    // Belum selesai dulu, lalu jatuh tempo paling dekat, lalu prioritas.
    // Tugas tanpa tanggal ditaruh paling belakang (bukan paling depan, yang
    // akan terjadi kalau string kosong ikut diurutkan apa adanya).
    return rows.sort((a, b) => {
      const ad = this.taskStatus(a) === 'done' ? 1 : 0, bd = this.taskStatus(b) === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const at = a.due_date || '9999-12-31', bt = b.due_date || '9999-12-31';
      if (at !== bt) return at < bt ? -1 : 1;
      const ap = P[a.priority] ?? 2, bp = P[b.priority] ?? 2;
      if (ap !== bp) return ap - bp;
      return String(a.due_time || '99:99').localeCompare(String(b.due_time || '99:99'));
    });
  }

  getTasksForUser(userId) {
    return this.getAllTasks().filter(t => t.assignee_id === userId || (!t.assignee_id && t.created_by === userId));
  }

  getTask(id) { return (this.data.tasks || []).find(t => t.id === id) || null; }

  async loadTasks() {
    if (CONFIG.DEMO_MODE) return this.getAllTasks();
    try {
      const rows = await supabase.select('tasks', { order: 'due_date.asc' });
      if (Array.isArray(rows) && rows.length) {
        this.data.tasks = rows;
        this._save();
      } else if (Array.isArray(rows)) {
        // select() mengembalikan [] baik saat tabel `tasks` belum dibuat
        // maupun saat memang kosong — keduanya tidak bisa dibedakan. Yang
        // pasti pernah tersimpan di server adalah baris ber-UUID (bukan
        // 'id_...'), jadi hanya baris itu yang boleh dibuang di sini. Baris
        // lokal yang belum pernah sampai server tetap dipertahankan supaya
        // tidak hilang hanya karena SQL-nya belum dijalankan.
        const kept = (this.data.tasks || []).filter(t => String(t.id || '').startsWith('id_'));
        if (kept.length !== (this.data.tasks || []).length) { this.data.tasks = kept; this._save(); }
      }
    } catch (e) { /* tabel belum dibuat — pakai data lokal */ }
    return this.getAllTasks();
  }

  async createTask(data) {
    const title = String(data.title || '').trim();
    if (!title) return { error: 'Judul tugas wajib diisi' };
    const kind = data.kind === 'event' ? 'event' : 'task';

    // Tanda pribadi tidak diterima apa adanya dari layar: yang menentukan
    // adalah siapa yang sedang login, bukan apa yang dikirim formulirnya.
    const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    const pribadi = !!data.is_private && this.canMakeTaskPrivate(aku);
    // Tugas pribadi yang punya penerima adalah tugas yang tidak akan pernah
    // dikerjakan: penerimanya tidak bisa melihatnya. Ditolak di sini, bukan
    // diam-diam dibuang salah satunya.
    if (pribadi && kind !== 'event' && data.assignee_id) {
      return { error: 'Tugas pribadi tidak bisa didelegasikan — penerimanya tidak akan bisa melihatnya. Hapus centang "pribadi" atau kosongkan penerimanya.' };
    }
    if (pribadi && kind === 'event' && Array.isArray(data.attendee_ids) && data.attendee_ids.filter(Boolean).length) {
      return { error: 'Acara pribadi tidak bisa punya peserta lain — mereka tidak akan bisa melihatnya.' };
    }

    const attendees = kind === 'event'
      ? (Array.isArray(data.attendee_ids) ? data.attendee_ids.filter(Boolean) : [])
      : [];
    const payload = {
      is_private: pribadi,
      title,
      kind,
      // Acara dihadiri banyak orang; pekerjaan dipegang satu orang. Keduanya
      // tidak pernah diisi bersamaan supaya tidak ada dua sumber kebenaran.
      attendee_ids: attendees,
      end_time: kind === 'event' ? (data.end_time || '') : '',
      location: kind === 'event' ? (data.location || '') : '',
      notes: data.notes || '',
      category: data.category || '',
      priority: ['urgent', 'high', 'normal', 'low'].includes(data.priority) ? data.priority : 'normal',
      due_date: data.due_date || null,
      due_time: data.due_time || '',
      // Yang menentukan kolomnya bukan tombol mana yang ditekan, melainkan
      // apakah tugasnya sudah punya kapan atau siapa. Tanpa aturan ini,
      // janji 'semua di luar Inbox sudah jelas' hanya bergantung pada
      // disiplin — dan yang bergantung pada disiplin akan bocor.
      status: 'todo',
      assignee_id: kind === 'event' ? null : (data.assignee_id || null),
      created_by: data.created_by || null,
      recurrence: ['daily', 'weekly', 'monthly', 'yearly'].includes(data.recurrence) ? data.recurrence : 'none',
      recurrence_interval: Math.max(1, Number(data.recurrence_interval) || 1),
      subtasks: Array.isArray(data.subtasks)
        ? data.subtasks.filter(s => s && String(s.text || '').trim()).map(s => ({ text: String(s.text).trim(), done: !!s.done }))
        : [],
      sort_order: Number(data.sort_order) || 100,
    };
    if (!this.taskIsClarified(payload)) payload.status = 'inbox';

    let rec;
    if (CONFIG.DEMO_MODE) {
      rec = { id: generateId(), created_at: new Date().toISOString(), wa_count: 0, wa_last_at: null, ...payload };
    } else {
      let inserted = await supabase.insert('tasks', payload);
      // Kolom is_private datang dari supabase-task-private.sql. Bila migrasi
      // itu belum dijalankan, Postgres menolak SELURUH barisnya — tugasnya
      // hilang hanya karena satu kolom belum ada. Dicoba ulang tanpa kolom
      // itu, TAPI dengan peringatan keras: yang tersimpan menjadi tugas
      // biasa yang terbaca semua staf, dan itu justru kebalikan dari yang
      // diminta. Diam di sini akan membocorkan isi tugasnya.
      let gagalPribadi = false;
      if (inserted && inserted.error && /is_private/i.test(String(inserted.error))) {
        const tanpa = { ...payload }; delete tanpa.is_private;
        inserted = await supabase.insert('tasks', tanpa);
        gagalPribadi = pribadi && !(inserted && inserted.error);
      }
      if (inserted && inserted.error) {
        return { error: inserted.error + ' — pastikan supabase-tasks.sql sudah dijalankan di Supabase.' };
      }
      rec = inserted || { id: generateId(), created_at: new Date().toISOString(), ...payload };
      if (gagalPribadi) {
        rec.is_private = false;
        this.data.tasks = (this.data.tasks || []).concat(rec);
        this._save();
        return { success: true, task: rec, warning: 'Tugas tersimpan TAPI TIDAK sebagai pribadi — kolomnya belum ada di server. Jalankan supabase-task-private.sql dulu, lalu ubah tugas ini dan centang lagi. Untuk sekarang isinya bisa dibaca staf lain.' };
      }
    }
    this.data.tasks = (this.data.tasks || []).concat(rec);
    this._save();

    // Kata-katanya mengikuti jenisnya — sebuah rapat yang diberitahukan
    // sebagai "Tugas Baru" membingungkan penerimanya.
    if (this.isEvent(rec)) this._notifyTaskAssignee(rec, 'Undangan Acara', 'Anda diundang ke acara');
    else this._notifyTaskAssignee(rec, 'Tugas Baru', 'Anda mendapat tugas baru');
    return { success: true, task: rec };
  }

  async updateTask(id, updates) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };

    // Penjagaan tanda pribadi — sama seperti di createTask, dan harus ada di
    // sini juga karena delegasi bisa dilakukan langsung dari kartu tugas
    // tanpa membuka formulirnya sama sekali.
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'is_private')) {
      const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
      if (!this.canMakeTaskPrivate(aku)) {
        return { error: 'Hanya pemilik klinik yang bisa menandai tugas sebagai pribadi.' };
      }
      updates = { ...updates, is_private: !!updates.is_private };
    }
    const akanPribadi = Object.prototype.hasOwnProperty.call(updates || {}, 'is_private')
      ? !!updates.is_private : this.isTaskPrivate(t);
    const akanPunyaPenerima = Object.prototype.hasOwnProperty.call(updates || {}, 'assignee_id')
      ? !!updates.assignee_id : !!t.assignee_id;
    if (akanPribadi && akanPunyaPenerima && !this.isEvent(t)) {
      return { error: 'Tugas pribadi tidak bisa didelegasikan — penerimanya tidak akan bisa melihatnya.' };
    }

    // ---- Lulus / turun dari Inbox dengan sendirinya ------------------------
    // Mengisi tanggal atau penerima ADALAH tindakan merapikannya. Menuntut
    // satu tekanan tombol lagi sesudah itu hanya menambah langkah yang bisa
    // terlupa, dan tugas yang sudah jelas akan tetap tertinggal di Inbox.
    //
    // Arah sebaliknya juga berlaku, tapi hanya untuk yang masih di To-Do:
    // mengosongkan tanggal DAN penerima membuatnya tidak jelas lagi, jadi ia
    // kembali ke Inbox. Yang sedang dikerjakan atau menunggu tinjauan tidak
    // ikut ditarik mundur — pekerjaannya sudah berjalan, dan menyeretnya
    // kembali ke penampungan hanya akan membuatnya hilang dari pandangan.
    if (updates && !Object.prototype.hasOwnProperty.call(updates, 'status')) {
      const sesudah = { ...t, ...updates };
      const jelas = this.taskIsClarified(sesudah);
      const st = this.taskStatus(t);
      if (st === 'inbox' && jelas) updates = { ...updates, status: 'todo' };
      else if (st === 'todo' && !jelas) updates = { ...updates, status: 'inbox' };
    }

    const prevAssignee = t.assignee_id || null;
    const prevAttendees = this.attendeeIds(t);
    Object.assign(t, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.update('tasks', id, updates).catch(() => null);
      if (res && res.error) {
        // Kolomnya belum ada di server: yang di layar sudah terlihat pribadi
        // padahal di server tidak. Dikembalikan apa adanya dan dikatakan
        // terus terang, karena mengira sesuatu tersembunyi padahal terbaca
        // semua orang jauh lebih berbahaya daripada gagal menyimpan.
        if (/is_private/i.test(String(res.error))) {
          t.is_private = false;
          this._save();
          return { error: 'Kolom tugas pribadi belum ada di server. Jalankan supabase-task-private.sql dulu — untuk sekarang tugas ini tetap terbaca staf lain.' };
        }
        return { error: res.error };
      }
    }
    // Baru diberitahu kalau tugasnya memang berpindah tangan.
    if (updates.assignee_id !== undefined && (updates.assignee_id || null) !== prevAssignee) {
      this._notifyTaskAssignee(t, 'Tugas Dialihkan', 'Sebuah tugas dialihkan kepada Anda');
    }
    // Untuk acara, yang dikabari hanya peserta yang BARU ditambahkan —
    // peserta lama tidak perlu diberi tahu ulang setiap kali daftarnya disunting.
    if (updates.attendee_ids !== undefined && this.isEvent(t)) {
      const added = this.attendeeIds(t).filter(id => prevAttendees.indexOf(id) === -1);
      if (added.length) {
        this._notifyTaskAssignee({ ...t, attendee_ids: added }, 'Undangan Acara', 'Anda diundang ke acara');
      }
    }
    return { success: true, task: t };
  }

  async deleteTask(id) {
    this.data.tasks = (this.data.tasks || []).filter(t => t.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.delete('tasks', id).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  // ==========================================================================
  // CATATAN BISNIS  (tabel business_units & business_notes)
  //
  // Buku catatan perkembangan usaha, isinya teks Markdown. PRIBADI: catatan
  // hanya bisa dibaca pembuatnya, ditegakkan di server lewat RLS — lihat
  // supabase-business-notes.sql. Yang di sini hanya lapisan tampilannya.
  // ==========================================================================

  // Siapa yang boleh membuka Catatan Bisnis. Berbeda dari canManageTasks:
  // Super Admin TIDAK termasuk, karena isinya omzet & strategi.
  canManageNotes(user) {
    if (!user) return false;
    // Saklar per akun (profiles.can_notes), dinyalakan dari Manajemen User.
    // Dulu daftarnya dipaku di dalam kode: menambah Anis dan Fitri berarti
    // mengubah kode dan menerbitkan ulang aplikasinya — itu bukan cara
    // mengelola orang. Daftar e-mail di CONFIG tetap dihormati sebagai
    // jaring pengaman kalau migrasinya belum dijalankan.
    const prof = this.getProfile(user) || {};
    if (prof.can_notes === true) return true;
    const u = (this.data.users || []).find(x => x.id === user.id);
    if (u && u.can_notes === true) return true;
    const allowed = (CONFIG.NOTES_MANAGER_EMAILS || []).map(e => String(e).toLowerCase());
    if (allowed.includes(String(user.email || '').toLowerCase())) return true;
    // Cadangan yang sama seperti panel tugas: kalau tidak satu pun e-mail pada
    // daftar itu terdaftar di sistem (mis. akun pemiliknya memakai alamat
    // lain), Owner tetap diizinkan supaya halamannya tidak jadi yatim.
    if (user.role === 'owner') {
      return !(this.data.users || []).some(u => allowed.includes(String(u.email || '').toLowerCase()));
    }
    return false;
  }

  // ==========================================================================
  // VAKSIN UMROH — saklar per akun klinik
  //
  // Tidak semua klinik melayani vaksin umroh. Yang tidak melayaninya tetap
  // melihat menunya, halaman kosong, dan istilah yang tidak berarti apa-apa
  // bagi mereka. Maka fiturnya dinyalakan per akun, dari Manajemen User, sama
  // seperti Catatan Bisnis.
  //
  // MEMATIKANNYA MENYEMBUNYIKAN, BUKAN MENGHAPUS. Foto dan catatan yang sudah
  // masuk tetap ada dan muncul lagi begitu dinyalakan kembali — sebuah saklar
  // menu yang diam-diam membuang data adalah kejutan yang paling mahal.
  // ==========================================================================
  canUmrohStamp(user) {
    if (!user) return false;
    const prof = this.getProfile(user) || {};
    if (prof.can_umroh === true) return true;
    const u = (this.data.users || []).find(x => x.id === user.id);
    if (u && u.can_umroh === true) return true;
    // Pemilik klinik selalu bisa — kalau tidak, saklar untuk menyalakannya
    // sendiri berada di balik fitur yang belum dinyalakan.
    return user.role === 'owner';
  }

  async setUmrohAccess(userId, allowed) {
    const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (!this.canMakeTaskPrivate(aku)) {
      return { error: 'Hanya pemilik klinik yang bisa mengatur fitur Vaksin Umroh.' };
    }
    const u = (this.data.users || []).find(x => x.id === userId);
    if (!u) return { error: 'Akun tidak ditemukan.' };
    u.can_umroh = allowed === true;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(userId).startsWith('id_')) {
      const res = await supabase.update('profiles', userId, { can_umroh: u.can_umroh }).catch(() => null);
      if (res && res.error) {
        u.can_umroh = !u.can_umroh; this._save();
        return { error: /can_umroh/i.test(String(res.error))
          ? 'Kolom izinnya belum ada di server. Jalankan supabase-umroh-stempel.sql dulu.'
          : res.error };
      }
    }
    this.addNotification(userId, allowed ? 'Fitur Vaksin Umroh Dibuka' : 'Fitur Vaksin Umroh Ditutup',
      allowed ? 'Menu Vaksin Umroh sudah bisa Anda pakai.' : 'Menu Vaksin Umroh ditutup. Data yang sudah ada tidak terhapus.',
      'system');
    return { success: true };
  }

  // Identitas yang tercetak di panel stempel. Diambil dari kop surat dokter
  // bila ada — di sanalah tiap klinik sudah memasang logo dan alamatnya —
  // dan jatuh ke pengaturan klinik bila belum.
  umrohStampKlinik(doctorId) {
    const kop = (doctorId ? this.getKopFor(doctorId, '') : null) || {};
    const nama = kop.name || CONFIG.APP_NAME || '';
    return {
      nama,
      // Nama pendek untuk kotak kanan atas: panel itu hanya selebar 247 px.
      namaPendek: nama.length > 24 ? nama.slice(0, 23).trim() + '…' : nama,
      alamat: kop.address || CONFIG.CLINIC_ADDRESS || '',
      logo: kop.logo_url || '',
    };
  }

  // Menyalakan / mematikan izin punya Catatan Bisnis untuk sebuah akun.
  // Hanya pemilik klinik yang boleh — kalau setiap Super Admin bisa
  // memberikannya, batas "Catatan Bisnis lebih tertutup daripada panel tugas"
  // hilang tanpa ada yang memutuskannya.
  async setNotesAccess(userId, allowed) {
    const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (!this.canMakeTaskPrivate(aku)) {
      return { error: 'Hanya pemilik klinik yang bisa memberikan akses Catatan Bisnis.' };
    }
    const u = (this.data.users || []).find(x => x.id === userId);
    if (!u) return { error: 'Akun tidak ditemukan.' };
    u.can_notes = allowed === true;
    this._save();
    if (!CONFIG.DEMO_MODE && !String(userId).startsWith('id_')) {
      const res = await supabase.update('profiles', userId, { can_notes: u.can_notes }).catch(() => null);
      if (res && res.error) {
        u.can_notes = !u.can_notes; this._save();
        return { error: /can_notes/i.test(String(res.error))
          ? 'Kolom izinnya belum ada di server. Jalankan supabase-notes-workspace.sql dulu.'
          : res.error };
      }
    }
    this.addNotification(userId, allowed ? 'Akses Catatan Bisnis Dibuka' : 'Akses Catatan Bisnis Ditutup',
      allowed ? 'Anda sekarang bisa membuat Catatan Bisnis sendiri di menu Catatan.'
              : 'Akses Catatan Bisnis Anda ditutup.', 'system');
    return { success: true };
  }

  // Daftar orang yang dibagikan sebuah unit usaha (profiles.id).
  unitSharedWith(u) {
    let v = u && u.shared_with;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
    return Array.isArray(v) ? v.filter(Boolean) : [];
  }

  // Daftar KEDUA: siapa yang juga boleh MENULIS di unit ini. Dipisah dari
  // shared_with, bukan digabung jadi satu daftar bertingkat, karena rekapan
  // keuangan dan catatan rapat memang pantas dibagikan dengan cara berbeda —
  // dan pemiliknya yang memilih, per unit.
  unitSharedEditWith(u) {
    let v = u && u.shared_edit_with;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
    return Array.isArray(v) ? v.filter(Boolean) : [];
  }

  unitEditIdsFor(userId) {
    if (!userId) return [];
    return this.getBusinessUnits()
      .filter(u => this.unitSharedEditWith(u).indexOf(userId) !== -1)
      .map(u => u.id);
  }

  // Boleh MENYUNTING sebuah catatan: pemiliknya, atau penerima berbagi-tulis
  // di unit itu. Catatan yang ditandai pribadi tetap milik pemiliknya saja,
  // walau unitnya dibagikan — itulah gunanya tanda pribadi.
  canEditNote(note, userId) {
    if (!note || !userId) return false;
    if (note.created_by === userId) return true;
    if (note.is_private) return false;
    return note.unit_id ? this.unitEditIdsFor(userId).indexOf(note.unit_id) !== -1 : false;
  }

  // Boleh MENGHAPUS: hanya pemiliknya. Menghapus halaman beserta seluruh
  // anaknya tidak bisa dibatalkan, dan itu bukan hak penerima berbagi.
  canDeleteNote(note, userId) {
    return !!(note && userId && note.created_by === userId);
  }

  // Unit apa saja yang dibagikan kepada seseorang.
  sharedUnitIdsFor(userId) {
    if (!userId) return [];
    return this.getBusinessUnits()
      .filter(u => this.unitSharedWith(u).indexOf(userId) !== -1
                || this.unitSharedEditWith(u).indexOf(userId) !== -1)
      .map(u => u.id);
  }

  // Boleh membuka halaman Catatan sebagai PENERIMA (baca saja), karena ada
  // setidaknya satu unit yang dibagikan kepadanya. Terpisah dari
  // canManageNotes yang memberi kuasa penuh kepada pemiliknya.
  canViewSharedNotes(user) {
    if (!user || this.canManageNotes(user)) return false;
    return this.sharedUnitIdsFor(user.id).length > 0;
  }

  // Sebuah catatan boleh dilihat seseorang bila dia pemiliknya, ATAU catatan
  // itu tidak ditandai pribadi dan berada di unit yang dibagikan kepadanya.
  canSeeNote(note, userId) {
    if (!note || !userId) return false;
    if (note.created_by === userId) return true;
    if (note.is_private) return false;
    return note.unit_id ? this.sharedUnitIdsFor(userId).indexOf(note.unit_id) !== -1 : false;
  }

  // Siapa saja yang bisa membaca sebuah catatan selain pemiliknya —
  // ditampilkan pada kartunya supaya tidak ada yang terbagi tanpa disadari.
  noteSharedNames(note) {
    if (!note || note.is_private || !note.unit_id) return [];
    const u = this.getBusinessUnit(note.unit_id);
    return this.unitSharedWith(u).map(id => this.staffName(id));
  }

  // ---- Unit usaha ----
  getBusinessUnits() {
    return (this.data.business_units || []).slice()
      .sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100) || String(a.name || '').localeCompare(String(b.name || '')));
  }
  getActiveBusinessUnits() { return this.getBusinessUnits().filter(u => u.is_active !== false); }
  getBusinessUnit(id) { return (this.data.business_units || []).find(u => u.id === id) || null; }
  businessUnitName(id) { const u = this.getBusinessUnit(id); return u ? u.name : 'Tanpa unit'; }

  // Kenapa pemuatan unit BOLEH GAGAL DENGAN SUARA sekarang.
  //
  // Sebelumnya galatnya ditelan diam-diam dengan alasan "tabelnya mungkin
  // belum dibuat". Akibatnya, ketika server MENOLAK karena aturan aksesnya —
  // dan itulah yang terjadi pada akun Super Admin, karena kebijakan
  // business_units dulu hanya mengizinkan peran owner — halamannya terbuka
  // dengan daftar unit kosong dan tidak ada satu kata pun yang menjelaskan
  // kenapa. Yang mengalaminya menyimpulkan fiturnya rusak, bukan bahwa ada
  // izin yang belum diberikan. Pesannya disimpan supaya layarnya bisa
  // menyebutkan apa yang sebenarnya terjadi.
  async loadBusinessNotes(userId) {
    if (CONFIG.DEMO_MODE) return;
    this.notesLoadError = '';
    try {
      const units = await supabase.select('business_units', { order: 'sort_order.asc' });
      if (Array.isArray(units) && units.length) { this.data.business_units = units; this._save(); }
      else if (units && units.error) this.notesLoadError = String(units.error);
    } catch (e) {
      this.notesLoadError = (e && e.message) ? e.message : String(e);
    }
    try {
      // Tidak disaring created_by di sini: penerima berbagi justru perlu baris
      // milik orang lain. Yang menentukan boleh-tidaknya adalah RLS di server.
      const rows = await supabase.select('business_notes', userId ? { eq: { created_by: userId } } : {});
      if (Array.isArray(rows)) {
        if (rows.length) { this.data.business_notes = rows; this._save(); }
        else {
          // select() mengembalikan [] baik saat tabel belum ada maupun saat
          // memang kosong. Hanya baris ber-UUID (yang pasti pernah sampai
          // server) yang boleh dibuang; catatan lokal dipertahankan.
          const kept = (this.data.business_notes || []).filter(n => String(n.id || '').startsWith('id_'));
          if (kept.length !== (this.data.business_notes || []).length) { this.data.business_notes = kept; this._save(); }
        }
      }
    } catch (e) {
      if (!this.notesLoadError) this.notesLoadError = (e && e.message) ? e.message : String(e);
    }
  }

  // Diterjemahkan untuk layar. Dua sebab yang paling mungkin dibedakan, karena
  // yang harus dikerjakan berbeda: migrasi belum jalan versus izin belum
  // diberikan.
  notesLoadMessage() {
    const g = String(this.notesLoadError || '');
    if (!g) return '';
    if (/does not exist|relation .* does not exist|schema cache/i.test(g)) {
      return 'Tabel Catatan Bisnis belum ada di server. Jalankan supabase-business-notes.sql dan supabase-notes-workspace.sql.';
    }
    if (/permission denied|row-level security|policy|401|403/i.test(g)) {
      return 'Server menolak membuka daftar unit usaha untuk akun ini. Jalankan supabase-notes-akses.sql supaya akun ber-izin Catatan Bisnis boleh membacanya.';
    }
    return 'Gagal memuat unit usaha dari server: ' + g;
  }

  async createBusinessUnit(data) {
    const name = String((data && data.name) || '').trim();
    if (!name) return { error: 'Nama unit wajib diisi' };
    if (this.getBusinessUnits().some(u => String(u.name || '').trim().toLowerCase() === name.toLowerCase())) {
      return { error: 'Unit dengan nama itu sudah ada' };
    }
    const payload = { name, description: (data && data.description) || '', color: (data && data.color) || 'slate',
      shared_with: Array.isArray(data && data.shared_with) ? data.shared_with.filter(Boolean) : [],
      is_active: true, sort_order: Number(data && data.sort_order) || 100 };
    let rec;
    if (CONFIG.DEMO_MODE) rec = { id: generateId(), created_at: new Date().toISOString(), ...payload };
    else {
      const ins = await supabase.insert('business_units', payload);
      if (ins && ins.error) return { error: ins.error + ' — pastikan supabase-business-notes.sql sudah dijalankan.' };
      rec = ins || { id: generateId(), ...payload };
    }
    this.data.business_units = (this.data.business_units || []).concat(rec);
    this._save();
    return { success: true, unit: rec };
  }

  async updateBusinessUnit(id, updates) {
    const u = this.getBusinessUnit(id);
    if (!u) return { error: 'Unit tidak ditemukan' };
    // Boleh menulis tanpa boleh membaca adalah keadaan yang tidak masuk akal:
    // orangnya akan melihat halaman kosong yang katanya boleh ia sunting.
    // Dirapikan di sini, satu pintu — bukan diserahkan ke layar yang
    // mengaturnya, karena layar berikutnya bisa lupa.
    if (updates.shared_edit_with !== undefined) {
      const tulis = (Array.isArray(updates.shared_edit_with) ? updates.shared_edit_with : []).filter(Boolean);
      const baca = updates.shared_with !== undefined
        ? (Array.isArray(updates.shared_with) ? updates.shared_with : []).filter(Boolean)
        : this.unitSharedWith(u);
      updates = { ...updates, shared_edit_with: tulis,
        shared_with: Array.from(new Set(baca.concat(tulis))) };
    }
    if (updates.name !== undefined) {
      const name = String(updates.name || '').trim();
      if (!name) return { error: 'Nama unit wajib diisi' };
      const clash = this.getBusinessUnits().find(x => x.id !== id && String(x.name || '').trim().toLowerCase() === name.toLowerCase());
      if (clash) return { error: 'Unit dengan nama itu sudah ada' };
    }
    Object.assign(u, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.update('business_units', id, updates).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  // Menghapus unit TIDAK menghapus catatannya — catatannya hanya kehilangan
  // label unit, supaya tulisan yang sudah dibuat tidak ikut lenyap.
  async deleteBusinessUnit(id) {
    this.data.business_units = (this.data.business_units || []).filter(u => u.id !== id);
    (this.data.business_notes || []).forEach(n => { if (n.unit_id === id) n.unit_id = null; });
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.delete('business_units', id).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  countNotesInUnit(unitId) { return (this.data.business_notes || []).filter(n => n.unit_id === unitId).length; }

  // ---- Catatan ----
  // Disematkan dulu, lalu tanggal catatan terbaru, lalu waktu pembuatan.
  getBusinessNotes(userId) {
    return (this.data.business_notes || [])
      .filter(n => !userId || !n.created_by || n.created_by === userId)
      .slice()
      .sort((a, b) => {
        const ap = a.pinned ? 0 : 1, bp = b.pinned ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const ad = a.note_date || '0000-00-00', bd = b.note_date || '0000-00-00';
        if (ad !== bd) return ad < bd ? 1 : -1;
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
  }

  getBusinessNote(id) { return (this.data.business_notes || []).find(n => n.id === id) || null; }

  // Catatan yang BOLEH DILIHAT seseorang: miliknya sendiri, ditambah catatan
  // tidak-pribadi di unit yang dibagikan kepadanya. Dipakai halaman Catatan
  // untuk pemilik maupun penerima berbagi — jadi aturannya hanya satu tempat.
  getVisibleBusinessNotes(userId) {
    if (!userId) return [];
    const shared = this.sharedUnitIdsFor(userId);
    return this.getBusinessNotes(null).filter(n =>
      n.created_by === userId || (!n.is_private && n.unit_id && shared.indexOf(n.unit_id) !== -1));
  }

  // Unit yang perlu ditampilkan kepada seseorang: semuanya bila dia pemilik,
  // atau hanya yang dibagikan kepadanya bila dia penerima.
  getVisibleBusinessUnits(user) {
    if (!user) return [];
    if (this.canManageNotes(user)) return this.getBusinessUnits();
    const shared = this.sharedUnitIdsFor(user.id);
    return this.getBusinessUnits().filter(u => shared.indexOf(u.id) !== -1);
  }

  // ---- HALAMAN BERSARANG ---------------------------------------------------
  // Sebelumnya unit -> catatan, dua tingkat dan berhenti. Sekarang catatan
  // bisa punya anak, sedalam apa pun. Isinya TETAP Markdown biasa; yang
  // berubah cuma cara menatanya — teks biasa tetap bisa dicari, disalin, dan
  // diselamatkan kalau suatu saat aplikasinya berganti.

  noteChildren(parentId, userId, unitId) {
    const semua = userId ? this.getVisibleBusinessNotes(userId) : (this.data.business_notes || []);
    return semua
      .filter(n => (n.parent_id || null) === (parentId || null))
      .filter(n => !unitId || n.unit_id === unitId)
      .sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100)
        || String(a.title || '').localeCompare(String(b.title || '')));
  }

  // Pohon halaman untuk sidebar. Kedalamannya dibatasi bukan karena tidak
  // sanggup, melainkan karena rujukan melingkar (halaman yang jadi induk
  // dirinya sendiri lewat rantai panjang) akan membuat halaman ini menggantung
  // selamanya tanpa pesan apa pun.
  noteTree(userId, unitId, parentId, kedalaman) {
    const dalam = Number(kedalaman) || 0;
    if (dalam > 12) return [];
    return this.noteChildren(parentId || null, userId, unitId).map(n => ({
      note: n,
      anak: this.noteTree(userId, unitId, n.id, dalam + 1),
    }));
  }

  // Jejak halaman dari akar sampai halaman ini — dipakai remah roti di atas
  // penyunting, supaya yang membacanya tahu ia sedang berada di mana.
  noteBreadcrumb(noteId) {
    const jalur = [];
    let n = this.getBusinessNote(noteId);
    let pagar = 0;
    while (n && pagar++ < 20) {
      jalur.unshift(n);
      n = n.parent_id ? this.getBusinessNote(n.parent_id) : null;
    }
    return jalur;
  }

  // Seluruh keturunan sebuah halaman — dihitung SEBELUM bertanya mau hapus,
  // supaya pertanyaannya menyebutkan berapa halaman yang ikut hilang. "Hapus
  // halaman ini?" yang ternyata menghapus sebelas halaman adalah pertanyaan
  // yang menyesatkan.
  noteDescendants(noteId) {
    const out = [];
    const turun = (id, dalam) => {
      if (dalam > 12) return;
      (this.data.business_notes || []).filter(n => n.parent_id === id).forEach(k => {
        out.push(k); turun(k.id, dalam + 1);
      });
    };
    turun(noteId, 0);
    return out;
  }

  // Memindahkan halaman ke induk lain. Menolak memindahkan halaman ke dalam
  // keturunannya sendiri: itu memutus cabang itu dari pohonnya dan membuatnya
  // hilang dari sidebar tanpa terhapus — hilang tanpa jejak, bentuk kerusakan
  // yang paling sulit disadari.
  async moveNote(noteId, parentId) {
    const n = this.getBusinessNote(noteId);
    if (!n) return { error: 'Halaman tidak ditemukan.' };
    if (parentId === noteId) return { error: 'Halaman tidak bisa dijadikan induk dirinya sendiri.' };
    if (parentId && this.noteDescendants(noteId).some(k => k.id === parentId)) {
      return { error: 'Tidak bisa dipindahkan ke dalam halamannya sendiri — cabang itu akan terputus dari pohonnya.' };
    }
    return this.updateBusinessNote(noteId, { parent_id: parentId || null });
  }

  // ---- SIMPAN OTOMATIS YANG TIDAK MENIMPA ----------------------------------
  // Dengan catatan yang bisa disunting bertiga DAN tersimpan otomatis, dua
  // orang yang membuka halaman sama akan saling menimpa tanpa ada yang sadar.
  // Karena itu sebelum menyimpan, versi yang ada di tangan dibandingkan dengan
  // versi yang tersimpan. Kalau sudah berubah: BERHENTI, jangan timpa —
  // kembalikan keduanya supaya layar bisa menawarkan pilihan. Lebih baik ada
  // dua versi daripada satu yang hilang diam-diam.
  async saveNoteBody(id, patch, basedOn) {
    const n = this.getBusinessNote(id);
    if (!n) return { error: 'Halaman tidak ditemukan.' };
    const aku = JSON.parse(sessionStorage.getItem('medconnect_user') || 'null');
    if (!this.canEditNote(n, (aku || {}).id)) {
      return { error: 'Anda hanya bisa membaca halaman ini.' };
    }
    if (basedOn && n.updated_at && String(n.updated_at) !== String(basedOn)) {
      return {
        conflict: true,
        error: 'Halaman ini sudah diubah orang lain sejak Anda membukanya. Tulisan Anda TIDAK ditimpakan.',
        theirs: { title: n.title, body: n.body, updated_at: n.updated_at },
      };
    }
    const r = await this.updateBusinessNote(id, patch);
    if (r && r.error) return r;
    return { success: true, note: r.note, updated_at: r.note.updated_at };
  }

  async createBusinessNote(data) {
    const title = String((data && data.title) || '').trim();
    if (!title) return { error: 'Judul catatan wajib diisi' };
    const payload = {
      unit_id: (data && data.unit_id) || null,
      title,
      body: (data && data.body) || '',
      note_date: (data && data.note_date) || todayLocal(),
      tags: (data && data.tags) || '',
      pinned: !!(data && data.pinned),
      is_private: !!(data && data.is_private),
      created_by: (data && data.created_by) || null,
      parent_id: (data && data.parent_id) || null,
      sort_order: Number(data && data.sort_order) || 100,
    };
    let rec;
    if (CONFIG.DEMO_MODE) rec = { id: generateId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
    else {
      let ins = await supabase.insert('business_notes', payload);
      // Kolom parent_id & sort_order datang dari supabase-notes-workspace.sql.
      // Bila migrasinya belum jalan, Postgres menolak SELURUH barisnya dan
      // halamannya hilang. Dicoba ulang tanpa kolom itu — halamannya tetap
      // tersimpan, hanya belum bisa disarangkan.
      if (ins && ins.error && /parent_id|sort_order/i.test(String(ins.error))) {
        const tanpa = { ...payload }; delete tanpa.parent_id; delete tanpa.sort_order;
        ins = await supabase.insert('business_notes', tanpa);
      }
      if (ins && ins.error) return { error: ins.error + ' — pastikan supabase-business-notes.sql sudah dijalankan.' };
      rec = ins || { id: generateId(), ...payload };
    }
    this.data.business_notes = (this.data.business_notes || []).concat(rec);
    this._save();
    return { success: true, note: rec };
  }

  async updateBusinessNote(id, updates) {
    const n = this.getBusinessNote(id);
    if (!n) return { error: 'Catatan tidak ditemukan' };
    if (updates.title !== undefined && !String(updates.title || '').trim()) return { error: 'Judul catatan wajib diisi' };
    const patch = { ...updates, updated_at: new Date().toISOString() };
    Object.assign(n, patch);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.update('business_notes', id, patch).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true, note: n };
  }

  async deleteBusinessNote(id) {
    this.data.business_notes = (this.data.business_notes || []).filter(n => n.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      const res = await supabase.delete('business_notes', id).catch(() => null);
      if (res && res.error) return { error: res.error };
    }
    return { success: true };
  }

  // Tugas berjatuh-tempo MILIK SATU ORANG, untuk ditampilkan di kalendernya.
  // Sengaja disaring per pengguna: kalender itu pribadi, jadi tugas orang lain
  // tidak boleh ikut muncul di sana. Dikembalikan ringkas (bukan baris utuh)
  // karena halaman kalender hanya perlu menampilkannya, bukan mengubahnya.
  getCalendarTasks(userId) {
    return this._visibleTasks()
      .filter(t => t.due_date && (!userId || this.isMyTask(t, userId)))
      .map(t => ({
        id: t.id,
        title: t.title || 'Tugas',
        due_date: t.due_date,
        due_time: t.due_time || '',
        priority: t.priority || 'normal',
        category: t.category || '',
        status: this.taskStatus(t),
        kind: this.taskKind(t),
        end_time: t.end_time || '',
        location: t.location || '',
        attendees: this.attendeeNames(t),
        sub_total: (t.subtasks || []).length,
        sub_done: (t.subtasks || []).filter(s => s && s.done).length,
      }))
      .sort((a, b) => String(a.due_time || '99:99').localeCompare(String(b.due_time || '99:99')));
  }

  // ---- Timer fokus -------------------------------------------------------
  // Waktu kerja dihitung dari stempel waktu, bukan dari penghitung di browser,
  // supaya tetap benar meski halaman ditutup, di-refresh, atau berpindah
  // perangkat. Lihat supabase-task-focus-timer.sql.

  // Total detik kerja bila potongan yang sedang berjalan ikut dibukukan.
  focusBanked(t) {
    const base = Number((t && t.focus_seconds) || 0) || 0;
    if (!t || !t.focus_at) return base;
    const started = new Date(t.focus_at).getTime();
    if (isNaN(started)) return base;
    // Jam perangkat bisa mundur (mis. sinkronisasi NTP) — jangan sampai
    // hitungannya jadi negatif dan waktu kerja malah berkurang.
    return base + Math.max(0, Math.round((Date.now() - started) / 1000));
  }

  focusRunning(t) { return !!(t && t.focus_at); }
  focusTargetMin(t) { return Number((t && t.focus_target_min) || 0) || 50; }

  // Nyalakan timer. Tidak mengubah tahap — dipakai untuk melanjutkan setelah
  // dijeda (tugasnya memang sudah ada di kolom Fokus).
  async startFocus(id) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    if (t.focus_at) return { success: true };            // sudah berjalan
    return this.updateTask(id, { focus_at: new Date().toISOString() });
  }

  // Jeda: bukukan potongan berjalan, lalu kosongkan penanda mulainya.
  async pauseFocus(id) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    if (!t.focus_at) return { success: true };           // sudah dijeda
    return this.updateTask(id, { focus_seconds: this.focusBanked(t), focus_at: null });
  }

  async resetFocus(id) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    return this.updateTask(id, { focus_seconds: 0, focus_at: t.focus_at ? new Date().toISOString() : null });
  }

  async setFocusTarget(id, minutes) {
    const m = Math.max(1, Number(minutes) || 50);
    return this.updateTask(id, { focus_target_min: m });
  }

  // Agenda berjam terdekat hari ini, supaya tidak ada yang terlewat saat
  // sedang tenggelam mengerjakan sesuatu. Menggabungkan dua sumber:
  //   - tugas hari ini yang punya jam (due_time)
  //   - janji temu hari ini (appointments) milik dokter yang bersangkutan;
  //     untuk admin tanpa baris dokter, dipakai janji temu seluruh klinik
  // Yang baru lewat tetap ditampilkan (ditandai terlewat) selama belum lebih
  // dari `graceMin` menit — yang paling sering bikin kecolongan justru itu.
  getUpcomingAgenda(userId, limit = 4, graceMin = 20) {
    const today = todayLocal();
    const d = new Date();
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const toMin = (hhmm) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const items = [];

    this._visibleTasks().forEach(t => {
      // Yang sudah diajukan untuk ditinjau tidak perlu lagi mengejar
      // pemiliknya — pekerjaannya sudah lepas dari tangannya.
      const st = this.taskStatus(t);
      if (st === 'done' || st === 'review') return;
      if (t.due_date !== today || !t.due_time) return;
      if (userId && !this.isMyTask(t, userId)) return;
      const at = toMin(t.due_time);
      if (at === null) return;
      const ev = this.isEvent(t);
      items.push({
        kind: ev ? 'event' : 'task', id: t.id, at, time: t.due_time,
        label: t.title || (ev ? 'Acara' : 'Tugas'),
        sub: ev ? ('Acara' + (t.location ? ' \u00b7 ' + t.location : '')) : 'Tugas',
      });
    });

    const doc = (this.data.doctors || []).find(x => x.user_id === userId);
    const apts = doc ? this.getAppointmentsByDoctor(doc.id, today)
                     : (this.data.appointments || []).filter(a => a.date === today);
    const TYPE = { visit: 'Kunjungan', follow_up: 'Kontrol', vaccination: 'Vaksinasi', consultation: 'Konsultasi' };
    apts.forEach(a => {
      if (['completed', 'cancelled', 'canceled'].includes(a.status)) return;
      const at = toMin(a.time_slot);
      if (at === null) return;
      const p = this.getPatient(a.patient_id);
      items.push({
        kind: 'appointment', id: a.id, at, time: a.time_slot,
        label: (p && p.full_name) || a.patient_name || 'Pasien',
        sub: TYPE[a.type] || 'Janji temu',
      });
    });

    return items
      .filter(i => i.at >= nowMin - graceMin)
      .sort((a, b) => a.at - b.at)
      .slice(0, limit)
      .map(i => ({ ...i, minutesAway: i.at - nowMin, late: i.at < nowMin }));
  }

  // Pindahkan tugas ke tahap lain: 'todo' | 'focus' | 'review' | 'done'.
  // Untuk tugas berulang, memindahkannya ke 'done' otomatis membuat tugas
  // berikutnya dengan jatuh tempo yang sudah digeser — jadi riwayat "sudah
  // dikerjakan" tetap tersimpan, tidak ditimpa.
  async setTaskStatus(id, status, userId) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const next_ = ['inbox', 'todo', 'focus', 'review', 'done'].includes(status) ? status : 'todo';

    // PINTU KELUAR INBOX. Ditolak di sini — bukan di tombolnya — supaya
    // seret-lepas, menu, dan jalan mana pun ke depan ikut terjaga tanpa
    // perlu diingat lagi satu per satu.
    //
    // Kecuali 'focus': menekan Kerjakan Sekarang berarti dikerjakan hari
    // ini, jadi tanggalnya diisikan hari ini dan syaratnya terpenuhi dengan
    // sendirinya. Memaksa orang mengisi tanggal untuk sesuatu yang sedang
    // dikerjakan detik itu juga hanya menghalangi tanpa menjaga apa pun.
    let isiTanggal = null;
    if (this.isInbox(t) && next_ !== 'inbox' && next_ !== 'done' && !this.taskIsClarified(t)) {
      if (next_ === 'focus') isiTanggal = todayLocal();
      else return { error: 'Tugas ini masih di Inbox. Isi dulu ' + this.taskMissingLabel(t) + ' lewat tombol Rapikan, baru bisa dipindahkan.' };
    }
    // Satu pintu untuk aturan "yang didelegasikan tidak ditutup sendiri" —
    // dijaga di sini, bukan di tombolnya, supaya centang cepat, layar timer,
    // dan jalan mana pun ke depan ikut terjaga tanpa perlu diingat lagi.
    if (next_ === 'done' && !this.canCompleteTask(t, userId)) {
      return { error: 'Tugas ini didelegasikan. Ajukan dulu lewat "Mohon Peninjauan Hasil Kerja" — yang menutupnya adalah pemberi tugas.' };
    }
    const nowDone = next_ === 'done';
    const nowIso = new Date().toISOString();
    // Bukukan dulu potongan waktu yang sedang berjalan, apa pun tahap
    // tujuannya — supaya waktu kerja tidak hilang saat tugas ditunda atau
    // diselesaikan di tengah timer yang menyala.
    const banked = this.focusBanked(t);
    const updates = nowDone
      ? { status: 'done', completed_at: nowIso, completed_by: userId || null,
          focus_seconds: banked, focus_at: null }
      : next_ === 'review'
        // Diajukan untuk ditinjau: timernya berhenti (pekerjaannya memang
        // sudah dilepas), tapi belum tercatat selesai.
        ? { status: 'review', completed_at: null, completed_by: null,
            focus_seconds: banked, focus_at: null, review_requested_at: nowIso }
        // Keluar dari 'done'/'review' mengembalikan tugas ke tahap yang
        // diminta dan membersihkan jejaknya, supaya tidak tercatat selesai dua
        // kali di riwayat. Masuk ke 'focus' langsung menyalakan timernya.
        : { status: next_, completed_at: null, completed_by: null,
            focus_seconds: banked, focus_at: next_ === 'focus' ? nowIso : null,
            review_requested_at: null,
            ...(isiTanggal ? { due_date: isiTanggal } : {}) };
    const res = await this.updateTask(id, updates);
    if (res && res.error) return res;

    let next = null;
    if (nowDone && t.recurrence && t.recurrence !== 'none') {
      const nextDue = nextRecurringDate(t.due_date, t.recurrence, t.recurrence_interval);
      const created = await this.createTask({
        title: t.title, notes: t.notes, category: t.category, priority: t.priority,
        due_date: nextDue, due_time: t.due_time,
        assignee_id: t.assignee_id, created_by: t.created_by,
        recurrence: t.recurrence, recurrence_interval: t.recurrence_interval,
        // Checklist dipakai ulang dalam keadaan kosong lagi.
        subtasks: (t.subtasks || []).map(s => ({ text: s.text, done: false })),
        sort_order: t.sort_order,
        // Acara berulang (mis. rapat mingguan) membawa peserta, jam selesai,
        // dan tempatnya ke jadwal berikutnya.
        kind: this.taskKind(t), attendee_ids: this.attendeeIds(t),
        end_time: t.end_time || '', location: t.location || '',
      });
      if (created && created.success) next = created.task;
    }
    return { success: true, status: next_, done: nowDone, next };
  }

  // Centang / batal-centang. Membatalkan centang mengembalikan tugas ke To-Do.
  // Untuk tugas yang didelegasikan, centangnya ditolak setTaskStatus — yang
  // dipakai penerimanya adalah requestReview.
  async toggleTaskDone(id, userId) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    return this.setTaskStatus(id, this.taskStatus(t) === 'done' ? 'todo' : 'done', userId);
  }

  // Penerima tugas mengajukan hasil kerjanya untuk ditinjau.
  async requestReview(id, userId, note) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const clean = String(note || '').trim();
    const res = await this.updateTask(id, {
      status: 'review', completed_at: null, completed_by: null,
      focus_seconds: this.focusBanked(t), focus_at: null,
      review_requested_at: new Date().toISOString(),
      review_note: clean,
    });
    if (res && res.error) return res;
    const reviewer = this.taskReviewerId(t);
    if (reviewer && reviewer !== userId) {
      this.addNotification(reviewer, 'Minta Peninjauan',
        `${this.staffName(userId)} sudah mengerjakan "${t.title}" dan meminta peninjauan Anda.${clean ? ' Catatan: ' + clean : ''}`,
        'system');
    }
    return { success: true, task: t };
  }

  // Pemberi tugas menyetujui hasilnya. Lewat setTaskStatus supaya tugas
  // berulang tetap dijadwalkan ulang seperti biasa.
  async approveTask(id, userId) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const worker = t.assignee_id || null;
    const res = await this.setTaskStatus(id, 'done', userId);
    if (res && res.error) return res;
    if (worker && worker !== userId) {
      this.addNotification(worker, 'Hasil Kerja Disetujui',
        `Tugas "${t.title}" sudah ditinjau dan ditutup. Terima kasih.`, 'system');
    }
    return res;
  }

  // Dikembalikan untuk diperbaiki. Alasannya wajib — dikembalikan tanpa
  // keterangan hanya membuat pekerjaan yang sama diulang dengan cara yang sama.
  async returnTask(id, userId, note) {
    const t = this.getTask(id);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const clean = String(note || '').trim();
    if (!clean) return { error: 'Tulis dulu apa yang perlu diperbaiki.' };
    const res = await this.updateTask(id, {
      status: 'todo', completed_at: null, completed_by: null,
      focus_at: null, review_requested_at: null, review_note: clean,
    });
    if (res && res.error) return res;
    const worker = t.assignee_id || null;
    if (worker && worker !== userId) {
      this.addNotification(worker, 'Perlu Diperbaiki',
        `Tugas "${t.title}" dikembalikan oleh ${this.staffName(userId)}. Catatan: ${clean}`, 'system');
    }
    return { success: true, task: t };
  }

  async toggleSubtask(taskId, index) {
    const t = this.getTask(taskId);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const subs = (t.subtasks || []).map((s, i) => (i === index ? { ...s, done: !s.done } : s));
    return this.updateTask(taskId, { subtasks: subs });
  }

  async addSubtask(taskId, text) {
    const t = this.getTask(taskId);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    const clean = String(text || '').trim();
    if (!clean) return { error: 'Sub-tugas kosong' };
    return this.updateTask(taskId, { subtasks: (t.subtasks || []).concat({ text: clean, done: false }) });
  }

  async removeSubtask(taskId, index) {
    const t = this.getTask(taskId);
    if (!t) return { error: 'Tugas tidak ditemukan' };
    return this.updateTask(taskId, { subtasks: (t.subtasks || []).filter((s, i) => i !== index) });
  }

  // Tombol WA hanya membuka wa.me dengan pesan siap kirim — ini mencatat
  // bahwa pengingatnya sudah ditekan, supaya tidak diingatkan berulang kali.
  logTaskWa(id) {
    const t = this.getTask(id);
    if (!t) return 0;
    t.wa_count = (t.wa_count || 0) + 1;
    t.wa_last_at = new Date().toISOString();
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update('tasks', id, { wa_count: t.wa_count, wa_last_at: t.wa_last_at }).catch(() => {});
    }
    return t.wa_count;
  }

  // Untuk acara, SEMUA pesertanya diberi tahu — bukan hanya satu orang.
  // Pembuatnya sendiri dilewati supaya tidak mengabari dirinya sendiri.
  _notifyTaskAssignee(task, title, lead) {
    if (!task) return;
    const targets = this.isEvent(task) ? this.attendeeIds(task) : [task.assignee_id];
    const when = task.due_date
      ? (this.isEvent(task)
          ? ` ${task.due_date}${task.due_time ? ' pukul ' + task.due_time : ''}${task.end_time ? '-' + task.end_time : ''}.`
          : ` Jatuh tempo ${task.due_date}${task.due_time ? ' pukul ' + task.due_time : ''}.`)
      : '';
    const where = this.isEvent(task) && task.location ? ` Tempat: ${task.location}.` : '';
    targets.filter(id => id && id !== task.created_by).forEach(id =>
      this.addNotification(id, title, `${lead}: "${task.title}".${when}${where}`, 'system'));
  }

  // Pilah tugas ke empat kolom papan, DARI SUDUT PANDANG satu orang.
  //
  // Tiga kolom pertama adalah pekerjaan orang itu sendiri menurut tahapannya;
  // kolom keempat berisi pekerjaan orang lain yang dia pantau. Karena
  // "Delegasi" ditentukan dari siapa yang melihat (bukan disimpan di baris
  // tugasnya), satu tugas yang sama muncul di kolom Delegasi pada papan
  // pemberi tugas dan di kolom To-Do/Fokus pada papan penerimanya — tanpa
  // pernah muncul dua kali di papan yang sama.
  groupTasksByColumn(tasks, userId) {
    const cols = { inbox: [], todo: [], focus: [], review: [], delegated: [], done: [] };
    (tasks || []).forEach(t => {
      const s = this.taskStatus(t);
      if (s === 'done') { cols.done.push(t); return; }
      // Inbox diperiksa SEBELUM 'delegasi'. Tugas di Inbox belum punya
      // penerima, jadi bagi mata orang lain ia tampak 'bukan tugas saya' dan
      // akan tersapu ke kolom Delegasi — padahal ia belum diberikan kepada
      // siapa pun. Itu justru kebalikan dari maksudnya.
      if (s === 'inbox') { cols.inbox.push(t); return; }
      // Menunggu tinjauan berlaku untuk kedua belah pihak: yang mengajukan
      // dan yang meninjau sama-sama melihatnya di satu kolom, jadi tidak ada
      // pekerjaan yang mengendap tanpa ada yang merasa memegangnya.
      if (s === 'review') { cols.review.push(t); return; }
      if (!this.isMyTask(t, userId)) { cols.delegated.push(t); return; }
      cols[s === 'focus' ? 'focus' : 'todo'].push(t);
    });
    // Yang sudah selesai: paling baru di atas.
    cols.done.sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
    return cols;
  }

  // Tugas selesai dalam N hari terakhir. Kolom Selesai memakai ini supaya
  // papan tetap ringan setelah dipakai berbulan-bulan; riwayat penuhnya tetap
  // bisa dibuka dari tombol di kolom itu.
  recentlyDone(tasks, days) {
    const limit = new Date(Date.now() - (Number(days) || 30) * 86400000).toISOString();
    return (tasks || []).filter(t => !t.completed_at || t.completed_at >= limit);
  }

  // Kelompokkan tugas per waktu — dipakai DI DALAM tiap kolom papan.
  // Mengembalikan urutan tetap supaya "Terlambat" selalu di atas.
  groupTasksByTime(tasks) {
    const today = todayLocal();
    const tomorrow = shiftDate(today, 1);
    const weekEnd = shiftDate(today, 7);
    const buckets = {
      overdue: [], today: [], tomorrow: [], week: [], later: [], someday: [], done: [],
    };
    (tasks || []).forEach(t => {
      if (this.taskStatus(t) === 'done') { buckets.done.push(t); return; }
      const d = t.due_date || '';
      if (!d) buckets.someday.push(t);
      else if (d < today) buckets.overdue.push(t);
      else if (d === today) buckets.today.push(t);
      else if (d === tomorrow) buckets.tomorrow.push(t);
      else if (d <= weekEnd) buckets.week.push(t);
      else buckets.later.push(t);
    });
    // Yang sudah selesai: paling baru di atas.
    buckets.done.sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
    return buckets;
  }

  // Health Services
  getServices() { return this.data.health_services.filter(s => s.is_active); }
  getAllServices() { return this.data.health_services; }
  createService(svc) { const s = { id: generateId(), ...svc, is_active: true }; this.data.health_services.push(s); this._save(); this._syncInsert('health_services', s); return s; }
  updateService(id, updates) { const s = this.data.health_services.find(x => x.id === id); if (s) { Object.assign(s, updates); this._save(); if (!CONFIG.DEMO_MODE) supabase.update('health_services', id, updates).catch(() => {}); } return s; }
  toggleServiceActive(id) { const s = this.data.health_services.find(x => x.id === id); if (s) { s.is_active = !s.is_active; this._save(); if (!CONFIG.DEMO_MODE) supabase.update('health_services', id, { is_active: s.is_active }).catch(() => {}); } }
  deleteService(id) { this.data.health_services = this.data.health_services.filter(x => x.id !== id); this._save(); if (!CONFIG.DEMO_MODE) supabase.delete('health_services', id).catch(() => {}); }

  // Bookings
  createBooking(booking) {
    const b = { id: generateId(), ...booking, status: 'pending', created_at: new Date().toISOString() };
    if (!this.data.bookings) this.data.bookings = [];
    this.data.bookings.push(b);
    this.data.users.filter(u => u.role === 'superadmin' || u.role === 'owner').forEach(u =>
      this.addNotification(u.id, 'Pendaftaran Layanan Baru', `${booking.patient_name || 'Pasien'} mendaftar: ${booking.item_name || booking.service_name}. Tanggal: ${booking.preferred_date}`, 'system')
    );
    this._save();
    this._syncInsert('bookings', b, sanitizeDates(b, ['preferred_date']));
    return b;
  }

  getBookings() { return (this.data.bookings || []).sort((a,b) => b.created_at.localeCompare(a.created_at)); }

  // Re-fetches all bookings from Supabase — called by the SuperAdmin bookings
  // list's polling interval, since a booking created from another tab/device
  // (patient app or the public guest-booking page) otherwise never shows up
  // until a full page reload (this.data is a one-time snapshot from login).
  async fetchBookings() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('bookings', { order: 'created_at.desc' });
        if (rows) { this.data.bookings = rows; this._save(); }
      } catch (e) { console.warn('Gagal memuat daftar pendaftaran:', e); }
    }
    return this.getBookings();
  }
  getBookingsByPatient(patientId) { return (this.data.bookings || []).filter(b => b.patient_id === patientId).sort((a,b) => b.created_at.localeCompare(a.created_at)); }

  // Re-fetches one patient's own bookings — same staleness fix as
  // fetchBookings, for the patient-facing "status pendaftaran" view so they
  // can see when SuperAdmin confirms/rejects/marks paid without reloading.
  async fetchBookingsForPatient(patientId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const rows = await supabase.select('bookings', { eq: { patient_id: patientId }, order: 'created_at.desc' });
        if (rows) this.data.bookings = (this.data.bookings || []).filter(b => b.patient_id !== patientId).concat(rows);
        this._save();
      } catch (e) { console.warn('Gagal memuat daftar pendaftaran:', e); }
    }
    return this.getBookingsByPatient(patientId);
  }
  // These are all awaited by the caller before it re-fetches from Supabase (see
  // adminBookings' poll() calls) — without awaiting the write first, an
  // immediate re-fetch could race the update and read back the old value,
  // making a successful action look like it silently failed/reverted.
  async updateBookingStatus(bookingId, status) {
    const b = (this.data.bookings || []).find(x => x.id === bookingId);
    if (!b) return;
    b.status = status;
    this._save();
    if (!CONFIG.DEMO_MODE) await supabase.update('bookings', bookingId, { status }).catch(e => console.warn('Gagal update status booking:', e));
  }

  // Confirming a booking assigns a doctor + exact time and creates a real
  // appointment on that doctor's calendar. patient_id may be null (guest
  // booking, no patient account) — patient_name is denormalized onto the
  // appointment itself so the doctor's calendar can still show a name.
  async confirmBookingWithAppointment(bookingId, doctorId, timeSlot) {
    const b = (this.data.bookings || []).find(x => x.id === bookingId);
    if (!b) return { error: 'Booking tidak ditemukan' };
    if (!doctorId || !timeSlot) return { error: 'Pilih dokter dan jam terlebih dahulu' };
    b.status = 'confirmed';
    const apt = {
      id: generateId(), patient_id: b.patient_id || null, doctor_id: doctorId,
      date: b.preferred_date, time_slot: timeSlot, type: 'visit', status: 'scheduled',
      queue_number: null, notes: b.item_name || b.service_name || '',
      patient_name: b.patient_name || '', booking_id: b.id,
    };
    if (!this.data.appointments) this.data.appointments = [];
    this.data.appointments.push(apt);
    const doc = this.getDoctor(doctorId);
    if (doc) this.addNotification(doc.user_id, 'Jadwal Baru', `${apt.patient_name || 'Pasien'} dijadwalkan ${apt.date} pukul ${timeSlot} (${apt.notes}).`, 'appointment');
    this._save();
    if (!CONFIG.DEMO_MODE) await supabase.update('bookings', bookingId, { status: 'confirmed' }).catch(e => console.warn('Gagal konfirmasi booking:', e));
    await this._syncInsert('appointments', apt);
    return { success: true, appointment: apt };
  }

  // Manual payment confirmation — no payment gateway, admin marks paid after
  // confirming transfer/QRIS/cash payment themselves.
  async toggleBookingPaid(bookingId) {
    const b = (this.data.bookings || []).find(x => x.id === bookingId);
    if (!b) return;
    b.is_paid = !b.is_paid;
    this._save();
    if (!CONFIG.DEMO_MODE) await supabase.update('bookings', bookingId, { is_paid: b.is_paid }).catch(e => console.warn('Gagal update status bayar:', e));
  }

  // Only a cancelled (rejected) booking can be removed — pending/confirmed/completed
  // ones stay as a record. Callable from both the patient's own history and SuperAdmin.
  async deleteBooking(bookingId) {
    const b = (this.data.bookings || []).find(x => x.id === bookingId);
    if (!b) return { error: 'Booking tidak ditemukan' };
    if (b.status !== 'cancelled') return { error: 'Hanya pendaftaran yang sudah ditolak yang bisa dihapus' };
    this.data.bookings = (this.data.bookings || []).filter(x => x.id !== bookingId);
    this._save();
    if (!CONFIG.DEMO_MODE) await supabase.delete('bookings', bookingId).catch(e => console.warn('Gagal menghapus booking:', e));
    return { success: true };
  }

  // Inventory
  getInventory(pharmacyId) {
    return this.data.inventory.filter(i => i.pharmacy_id === pharmacyId);
  }

  updateStock(invId, newStock) {
    const item = this.data.inventory.find(i => i.id === invId);
    if (item) { item.stock = newStock; this._save(); }
  }

  // Notifications
  getNotifications(userId) {
    return this.data.notifications.filter(n => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getUnreadCount(userId) {
    return this.data.notifications.filter(n => n.user_id === userId && !n.is_read).length;
  }

  markNotificationRead(notifId) {
    const n = this.data.notifications.find(x => x.id === notifId);
    if (n) {
      n.is_read = true; this._save();
      if (!CONFIG.DEMO_MODE && !String(notifId).startsWith('id_')) supabase.update('notifications', notifId, { is_read: true }).catch(() => {});
    }
  }

  markAllRead(userId) {
    const toMark = this.data.notifications.filter(n => n.user_id === userId && !n.is_read);
    toMark.forEach(n => n.is_read = true);
    this._save();
    // Persist read state so a later refetch doesn't resurrect them as unread.
    if (!CONFIG.DEMO_MODE) toMark.forEach(n => { if (!String(n.id).startsWith('id_')) supabase.update('notifications', n.id, { is_read: true }).catch(() => {}); });
  }

  // Refetch this user's notifications from Supabase (server truth) and merge —
  // used by the background poll that powers near-real-time notifications.
  async fetchNotifications(userId) {
    if (CONFIG.DEMO_MODE || !userId) return this.getNotifications(userId);
    try {
      const rows = await supabase.select('notifications', { eq: { profile_id: userId }, order: 'created_at.desc' });
      if (Array.isArray(rows)) {
        const others = (this.data.notifications || []).filter(n => n.user_id !== userId);
        this.data.notifications = others.concat(rows.map(n => ({ ...n, user_id: n.profile_id })));
        this._save();
      }
    } catch (e) { /* keep local copy on failure */ }
    return this.getNotifications(userId);
  }

  addNotification(userId, title, message, type) {
    if (!userId) return;
    const notif = { id: generateId(), user_id: userId, title, message, type, is_read: false, created_at: new Date().toISOString() };
    this.data.notifications.push(notif);
    this._save();
    this._syncInsert('notifications', notif, { id: notif.id, profile_id: userId, title, message, type, is_read: false, created_at: notif.created_at });
  }

  // Doctors list
  // ==========================================================================
  // UMROH & HAJI  (tabel umroh_sales)
  //
  // Datanya TIDAK diketik ulang: diunggah dari berkas "Laporan Detail Data
  // Penjualan Obat" milik sistem kasir apotek, yang sudah memuat tanggal,
  // nama pasien, nama dokter, kolom Sales (= travel pengirimnya), rincian
  // vaksin, dan total yang dibayar. Dengan begitu angka yang dipakai menagih
  // cashback adalah angka yang sama dengan yang tercatat di kasir — bukan
  // angka kedua yang harus dicocokkan setiap bulan.
  //
  // Kunci barisnya NOMOR FAKTUR. Mengunggah ulang periode yang sama hanya
  // memperbarui baris yang sudah ada, tidak menggandakannya — dan status
  // cashback yang sudah ditandai TIDAK ikut tertimpa, karena itu catatan kita
  // sendiri, bukan milik kasir.
  //
  // Lihat js/umroh-import.js (pembaca berkas) dan supabase-umroh-sales.sql.
  // ==========================================================================

  getUmrohSales() { return (this.data.umroh_sales || []).slice(); }

  async loadUmrohSales() {
    if (CONFIG.DEMO_MODE) return this.getUmrohSales();
    try {
      const rows = await supabase.select('umroh_sales', { order: 'sold_date.desc' });
      if (Array.isArray(rows) && rows.length) {
        this.data.umroh_sales = rows;
        this._save();
      } else if (Array.isArray(rows)) {
        // select() mengembalikan [] baik saat tabelnya belum dibuat maupun saat
        // memang kosong — tidak bisa dibedakan. Hanya baris ber-UUID yang pasti
        // pernah sampai server, jadi hanya itu yang boleh dibuang; baris lokal
        // hasil unggahan yang belum tersinkron tetap dipertahankan.
        const kept = (this.data.umroh_sales || []).filter(r => String(r.id || '').startsWith('id_'));
        if (kept.length !== (this.data.umroh_sales || []).length) { this.data.umroh_sales = kept; this._save(); }
      }
    } catch (e) { /* tabel belum dibuat — pakai data lokal */ }
    return this.getUmrohSales();
  }

  // Terapkan hasil pembacaan berkas. Mengembalikan berapa yang baru, berapa
  // yang diperbarui, dan berapa yang dilewati — supaya yang mengunggah tahu
  // persis apa yang terjadi, bukan hanya "berhasil".
  async importUmrohSales(entries, meta) {
    const list = (entries || []).filter(e => e && e.invoice_no);
    if (!list.length) return { error: 'Tidak ada transaksi vaksin umroh yang terbaca di berkas ini.' };
    const m = meta || {};
    const byInvoice = new Map((this.data.umroh_sales || []).map(r => [String(r.invoice_no), r]));
    let baru = 0, diperbarui = 0, sama = 0;
    const nowIso = new Date().toISOString();

    for (const e of list) {
      // Yang datang dari kasir hanya fakta penjualannya. Cashback sengaja
      // tidak ikut disentuh di sini.
      const fakta = {
        invoice_no: String(e.invoice_no),
        sold_date: e.sold_date || null,
        sold_time: e.sold_time || '',
        patient_name: e.patient_name || '',
        doctor_name: e.doctor_name || '',
        // Nilai apa adanya dari kolom Sales di berkas kasir. Disimpan terpisah
        // dari travel_name supaya isian manual tidak menghapusnya, dan
        // sebaliknya — keduanya bisa hidup berdampingan.
        travel_source: e.travel_name || '',
        service: e.service || '',
        service_label: e.service_label || '',
        price: Math.max(0, Math.round(Number(e.price) || 0)),
        items: Array.isArray(e.items) ? e.items : [],
        other_items: Array.isArray(e.other_items) ? e.other_items : [],
      };
      const ada = byInvoice.get(fakta.invoice_no);
      if (ada) {
        // ISIAN MANUAL TIDAK PERNAH TERTIMPA UNGGAHAN ULANG.
        // Kalau tidak begini, travel yang sudah susah payah diisi tangan akan
        // hilang lagi setiap kali laporan bulan berjalan diunggah — sebab di
        // berkas kasirnya kolom Sales itu memang masih kosong.
        if (!ada.travel_manual) fakta.travel_name = fakta.travel_source;
        // Cashback ikut dihitung ulang bila harganya berubah — kecuali sudah
        // diisi tangan, atau sudah terlanjur dibayar (nominalnya sudah
        // disepakati saat itu, mengubahnya membuat riwayat tidak lagi cocok).
        if (!ada.cashback_manual && !ada.cashback_paid) {
          const auto = this.umrohAutoCashback({ ...ada, ...fakta });
          if ((Number(ada.cashback_amount) || 0) !== auto.amount) {
            fakta.cashback_amount = auto.amount;
          }
        }
        const berubah = Object.keys(fakta).some(k => {
          const a = fakta[k], b = ada[k];
          return Array.isArray(a) ? JSON.stringify(a) !== JSON.stringify(b || []) : String(a == null ? '' : a) !== String(b == null ? '' : b);
        });
        if (!berubah) { sama++; continue; }
        Object.assign(ada, fakta, { imported_at: nowIso, source_file: m.source_file || '' });
        diperbarui++;
        if (!CONFIG.DEMO_MODE && !String(ada.id || '').startsWith('id_')) {
          await supabase.update('umroh_sales', ada.id, { ...fakta, imported_at: nowIso, source_file: m.source_file || '' }).catch(() => null);
        }
      } else {
        const rec = {
          id: generateId(), ...fakta,
          travel_name: fakta.travel_source, travel_manual: false,
          cashback_amount: this.umrohAutoCashback(fakta).amount, cashback_manual: false, cashback_paid: false, cashback_at: null, cashback_by: null,
          imported_at: nowIso, imported_by: m.imported_by || null, source_file: m.source_file || '',
        };
        this.data.umroh_sales = (this.data.umroh_sales || []).concat(rec);
        byInvoice.set(rec.invoice_no, rec);
        baru++;
        if (!CONFIG.DEMO_MODE) {
          const ins = await supabase.insert('umroh_sales', { ...rec, id: undefined }).catch(() => null);
          if (ins && ins.id) rec.id = ins.id;
          else if (ins && ins.error) {
            this.data.umroh_sales = this.data.umroh_sales.filter(x => x.id !== rec.id);
            this._save();
            return { error: 'Gagal menyimpan ke server. Pastikan supabase-umroh-sales.sql sudah dijalankan di Supabase. (' + ins.error + ')' };
          }
        }
      }
    }
    this._save();
    return { success: true, baru, diperbarui, sama, total: list.length };
  }

  umrohKindLabel(key) {
    const f = (CONFIG.UMROH_VACCINES || []).find(u => u.key === key);
    return f ? f.label : (key || '-');
  }

  // Baris laporan dalam rentang tanggal. from/to inklusif, boleh kosong.
  getUmrohEntries(opts) {
    const o = opts || {};
    const from = o.from || '';
    const to = o.to || '';
    return (this.data.umroh_sales || [])
      .filter(r => {
        const d = String(r.sold_date || '').slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .map(r => ({
        key: r.id,
        id: r.id,
        invoice_no: r.invoice_no || '',
        date: String(r.sold_date || '').slice(0, 10),
        time: r.sold_time || '',
        patient_name: r.patient_name || '-',
        doctor_name: r.doctor_name || '-',
        travel: String(r.travel_name || '').trim(),
        // Dari mana nama travelnya: diisi tangan, atau ikut berkas kasir.
        travel_manual: !!r.travel_manual,
        travel_source: String(r.travel_source || '').trim(),
        service: r.service || '',
        service_label: r.service_label || '-',
        price: Number(r.price) || 0,
        cashback: Number(r.cashback_amount) || 0,
        cashback_manual: !!r.cashback_manual,
        paid: !!r.cashback_paid,
        paid_at: r.cashback_at || null,
        // Tiga keadaan: belum diajukan → diajukan admin → di-ACC (= dibayar).
        cb_state: this.umrohCashbackState(r),
        batch: r.cashback_batch || '',
        requested_at: r.cashback_requested_at || null,
        requested_by: r.cashback_requested_by || null,
        requested_by_name: r.cashback_requested_by ? this.staffName(r.cashback_requested_by) : '',
        reject_note: r.cashback_reject_note || '',
        items: Array.isArray(r.items) ? r.items : [],
        // Barang di luar vaksin umroh ikut menaikkan total faktur, jadi
        // ditandai — supaya harga yang berbeda sendiri tidak dikira salah catat.
        other_items: Array.isArray(r.other_items) ? r.other_items : [],
        jemaah_count: this.umrohJemaahCount(r.patient_name),
        // Alasan bila angkanya perlu diperiksa orang (bukan langsung dipercaya).
        cb_review: this.umrohAutoCashback(r).review ? this.umrohAutoCashback(r).reason : '',
      }))
      .sort((a, b) => (a.date === b.date
        ? String(a.time || '').localeCompare(String(b.time || ''))
        : b.date.localeCompare(a.date)));
  }

  // Daftar nama dokter yang muncul di data — dipakai saringan. Diambil dari
  // datanya sendiri, bukan dari master dokter, karena nama di berkas kasir
  // ditulis apa adanya oleh kasir ('DR. KEVIN CHIKRISTA', 'dr.NIKO').
  umrohDoctors(entries) {
    const names = new Set();
    (entries || []).forEach(e => { if (e.doctor_name && e.doctor_name !== '-') names.add(e.doctor_name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  // Berapa jemaah dalam satu faktur. Kasir kadang menggabungkan sekeluarga
  // dalam satu transaksi, dan nama-namanya ditulis dipisah koma. Kalau ini
  // tidak dihitung, faktur Rp2.000.000 untuk 4 orang akan terbaca sebagai satu
  // jemaah yang membayar 2 juta — dan cashback-nya melonjak jauh dari yang
  // seharusnya.
  umrohJemaahCount(nama) {
    const bagian = String(nama || '').split(',').map(x => x.trim()).filter(Boolean);
    return Math.max(1, bagian.length);
  }

  // Cashback otomatis: selisih antara yang dibayar jemaah dan harga dasar
  // klinik. Lihat CONFIG.UMROH_CASHBACK_BASE.
  //
  // Mengembalikan juga `review`: penanda bahwa angkanya perlu diperiksa orang,
  // bukan langsung dipercaya. Lebih baik menandai yang meragukan daripada
  // diam-diam menghitung angka yang salah — cashback yang kelebihan bayar
  // tidak akan pernah kembali.
  umrohAutoCashback(row) {
    const service = (row && row.service) || '';
    const price = Number((row && row.price) || 0);
    const base = (CONFIG.UMROH_CASHBACK_BASE || {})[service];
    if (base === null || base === undefined) {
      return { amount: 0, review: true, reason: 'Harga dasar untuk layanan ini belum ditentukan' };
    }
    const lain = (row && row.other_items) || [];
    if (lain.length) {
      // Barang di luar vaksin umroh ikut menaikkan total faktur, dan tidak ada
      // cara memisahkannya dari angka total. Ditandai untuk diisi tangan.
      return { amount: 0, review: true, reason: 'Faktur memuat barang lain: ' + lain.join(', ') };
    }
    const n = this.umrohJemaahCount(row && row.patient_name);
    const perOrang = Math.round(price / n);
    const amount = Math.max(0, perOrang - base) * n;
    return {
      amount,
      review: n > 1,
      reason: n > 1 ? (n + ' jemaah dalam satu faktur, dibagi rata') : '',
    };
  }

  // Rentang tanggal yang benar-benar ada datanya. Halaman memakai ini sebagai
  // rentang bawaan, BUKAN "bulan berjalan": laporan penjualan hampir selalu
  // diunggah untuk periode yang sudah lewat, jadi bawaan "bulan ini" membuat
  // sebagian besar datanya tidak tampil — dan travel yang kebetulan hanya
  // beroperasi di bulan sebelumnya lenyap sama sekali dari daftar.
  umrohDateRange() {
    const tgl = (this.data.umroh_sales || [])
      .map(r => String(r.sold_date || '').slice(0, 10))
      .filter(Boolean)
      .sort();
    if (!tgl.length) return { min: '', max: '' };
    return { min: tgl[0], max: tgl[tgl.length - 1] };
  }

  umrohTravels(entries) {
    const names = new Set();
    (entries || []).forEach(e => { if (e.travel) names.add(e.travel); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  // Isi / ubah travel sebuah baris secara manual.
  //
  // Kolom Sales di kasir kadang terlewat diisi, dan mengejar kasir untuk
  // memperbaiki lalu mengekspor ulang tidak selalu memungkinkan. Isian di sini
  // ditandai travel_manual, dan tanda itulah yang membuatnya bertahan saat
  // berkas yang sama diunggah lagi.
  //
  // Nilai asli dari kasir tetap disimpan di travel_source, jadi isian manual
  // tidak menghapus apa pun — dan sewaktu-waktu bisa dikembalikan.
  setUmrohTravel(id, name) {
    const r = (this.data.umroh_sales || []).find(x => x.id === id);
    if (!r) return { error: 'Data penjualan tidak ditemukan' };
    const clean = String(name || '').trim();
    const updates = clean
      ? { travel_name: clean, travel_manual: true }
      // Dikosongkan = batalkan isian manual, kembali mengikuti berkas kasir.
      : { travel_name: String(r.travel_source || '').trim(), travel_manual: false };
    Object.assign(r, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update('umroh_sales', id, updates).catch(() => {});
    }
    return { success: true, travel: r.travel_name, manual: r.travel_manual };
  }

  // Isi travel sekaligus untuk beberapa baris — biasanya satu travel memang
  // mengirim serombongan jemaah pada hari yang sama.
  setUmrohTravelBulk(ids, name) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Tidak ada baris yang dipilih' };
    const clean = String(name || '').trim();
    if (!clean) return { error: 'Nama travel belum diisi.' };
    let n = 0;
    list.forEach(id => { const res = this.setUmrohTravel(id, clean); if (res && res.success) n++; });
    if (!n) return { error: 'Data penjualan tidak ditemukan' };
    return { success: true, count: n };
  }

  // Nominal cashback satu baris.
  setUmrohCashbackAmount(id, amount) {
    const r = (this.data.umroh_sales || []).find(x => x.id === id);
    if (!r) return { error: 'Data penjualan tidak ditemukan' };
    const updates = {
      cashback_amount: Math.max(0, Math.round(Number(amount) || 0)),
      // Ditandai supaya hitungan otomatis tidak menimpanya saat unggah ulang.
      cashback_manual: true,
    };
    Object.assign(r, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update('umroh_sales', id, updates).catch(() => {});
    }
    return { success: true };
  }

  // Kembalikan satu baris ke hitungan otomatis.
  resetUmrohCashback(id) {
    const r = (this.data.umroh_sales || []).find(x => x.id === id);
    if (!r) return { error: 'Data penjualan tidak ditemukan' };
    const updates = { cashback_amount: this.umrohAutoCashback(r).amount, cashback_manual: false };
    Object.assign(r, updates);
    this._save();
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update('umroh_sales', id, updates).catch(() => {});
    }
    return { success: true, amount: updates.cashback_amount };
  }

  // Hitung ulang cashback otomatis untuk baris yang belum diisi tangan dan
  // belum dibayar. Dipakai tombol "Hitung Ulang Otomatis" — berguna setelah
  // harga dasarnya diubah, atau untuk data yang diunggah sebelum aturan ini ada.
  recalcUmrohCashback(ids) {
    const target = (ids && ids.length)
      ? (this.data.umroh_sales || []).filter(r => ids.indexOf(r.id) !== -1)
      : (this.data.umroh_sales || []);
    let diubah = 0, dilewati = 0, perluCek = 0;
    target.forEach(r => {
      if (r.cashback_manual || r.cashback_paid) { dilewati++; return; }
      const auto = this.umrohAutoCashback(r);
      if (auto.review) perluCek++;
      if ((Number(r.cashback_amount) || 0) === auto.amount) return;
      const updates = { cashback_amount: auto.amount, cashback_manual: false };
      Object.assign(r, updates);
      diubah++;
      if (!CONFIG.DEMO_MODE && !String(r.id).startsWith('id_')) {
        supabase.update('umroh_sales', r.id, updates).catch(() => {});
      }
    });
    this._save();
    return { success: true, diubah, dilewati, perluCek };
  }

  // Tarif cashback satu travel, diterapkan sekaligus. Yang sudah ditandai
  // dibayar sengaja dilewati — nominalnya sudah terlanjur disepakati saat itu,
  // dan mengubahnya akan membuat riwayat pembayaran tidak lagi cocok.
  applyUmrohTravelRate(travel, amount, opts) {
    const o = opts || {};
    const nominal = Math.max(0, Math.round(Number(amount) || 0));
    const rows = (this.data.umroh_sales || []).filter(r =>
      String(r.travel_name || '').trim() === String(travel || '').trim()
      && !r.cashback_paid
      && (!o.from || String(r.sold_date || '') >= o.from)
      && (!o.to || String(r.sold_date || '') <= o.to));
    rows.forEach(r => this.setUmrohCashbackAmount(r.id, nominal));
    return { success: true, count: rows.length };
  }

  // =========================================================================
  // PENGAJUAN PEMBAYARAN CASHBACK
  //
  //   belum  →  diajukan (admin mencentang & mengajukan)  →  dibayar (ACC)
  //
  // Yang mengajukan boleh siapa saja yang membuka halaman ini; yang meng-ACC
  // hanya pemilik klinik. Ini memisahkan dua pekerjaan yang memang berbeda:
  // menyusun tagihan itu kerja administrasi, sedangkan menyatakan uangnya
  // sudah keluar adalah keputusan yang memegang uangnya.
  //
  // ACC BERARTI SUDAH DIBAYAR — tidak ada langkah ketiga. Kalau dipisah lagi
  // ("disetujui" lalu "dibayar"), akan ada keadaan menggantung yang tidak
  // dilihat siapa pun, dan justru itu yang membuat cashback terlupakan.
  // =========================================================================

  umrohCashbackState(r) {
    if (!r) return 'none';
    if (r.cashback_paid) return 'paid';
    if (r.cashback_requested_at) return 'requested';
    return 'none';
  }

  _umrohWrite(id, updates) {
    const r = (this.data.umroh_sales || []).find(x => x.id === id);
    if (!r) return false;
    Object.assign(r, updates);
    if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
      supabase.update('umroh_sales', id, updates).catch(() => {});
    }
    return true;
  }

  // Admin mengajukan sekumpulan baris untuk dibayarkan.
  requestUmrohPayment(ids, userId, note) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Belum ada jemaah yang dicentang.' };
    const rows = list.map(id => (this.data.umroh_sales || []).find(x => x.id === id)).filter(Boolean);
    if (!rows.length) return { error: 'Data penjualan tidak ditemukan' };
    // Yang sudah dibayar tidak boleh ikut diajukan lagi — kalau ikut, satu
    // jemaah bisa terbayar dua kali tanpa ada yang menyadarinya.
    const bisa = rows.filter(r => !r.cashback_paid);
    if (!bisa.length) return { error: 'Semua yang dicentang sudah ditandai dibayar.' };
    const tanpaNominal = bisa.filter(r => !(Number(r.cashback_amount) > 0));
    if (tanpaNominal.length === bisa.length) {
      return { error: 'Nominal cashback-nya belum diisi. Isi dulu lewat tombol Nominal atau Tarif Cashback.' };
    }
    const batch = 'PB-' + generateId();
    const nowIso = new Date().toISOString();
    bisa.forEach(r => this._umrohWrite(r.id, {
      cashback_batch: batch,
      cashback_requested_at: nowIso,
      cashback_requested_by: userId || null,
      cashback_request_note: String(note || '').trim(),
      cashback_reject_note: '',
    }));
    this._save();

    // Kabari yang berhak meng-ACC. Tanpa ini pengajuannya hanya menunggu
    // sampai kebetulan ada yang membuka halamannya.
    const total = bisa.reduce((a, b) => a + (Number(b.cashback_amount) || 0), 0);
    const travel = Array.from(new Set(bisa.map(r => String(r.travel_name || '').trim()).filter(Boolean)));
    const rupiah = 'Rp' + total.toLocaleString('id-ID');
    const allowed = (CONFIG.CASHBACK_MANAGER_EMAILS || []).map(e => String(e).toLowerCase());
    (this.data.users || [])
      .filter(u => allowed.includes(String(u.email || '').toLowerCase()) && u.id !== userId)
      .forEach(u => this.addNotification(u.id, 'Pengajuan Pembayaran Cashback',
        `${this.staffName(userId)} mengajukan pembayaran cashback ${travel.join(', ') || 'travel'}: ${bisa.length} jemaah, ${rupiah}.`, 'system'));

    return { success: true, batch, count: bisa.length, total, dilewati: rows.length - bisa.length, tanpaNominal: tanpaNominal.length };
  }

  // Membatalkan pengajuan yang belum di-ACC.
  cancelUmrohPayment(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Tidak ada pengajuan yang dipilih' };
    let n = 0;
    list.forEach(id => {
      const r = (this.data.umroh_sales || []).find(x => x.id === id);
      if (!r || r.cashback_paid) return;
      if (this._umrohWrite(id, { cashback_batch: '', cashback_requested_at: null, cashback_requested_by: null, cashback_request_note: '' })) n++;
    });
    this._save();
    if (!n) return { error: 'Tidak ada pengajuan yang bisa dibatalkan.' };
    return { success: true, count: n };
  }

  // ACC = sudah dibayar. Hanya pemilik klinik.
  approveUmrohPayment(ids, user) {
    if (!this.canMarkCashback(user)) {
      return { error: 'Hanya dr. Kevin Chikrista yang bisa meng-ACC pembayaran cashback.' };
    }
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Tidak ada pengajuan yang dipilih' };
    const res = this.setUmrohCashbackPaid(list, true, (user && user.id) || null);
    if (res && res.error) return res;
    // Kabari yang mengajukan bahwa uangnya sudah keluar.
    const pengaju = new Set();
    list.forEach(id => {
      const r = (this.data.umroh_sales || []).find(x => x.id === id);
      if (r && r.cashback_requested_by && r.cashback_requested_by !== (user && user.id)) pengaju.add(r.cashback_requested_by);
    });
    pengaju.forEach(pid => this.addNotification(pid, 'Cashback Sudah Dibayar',
      `Pengajuan pembayaran cashback Anda sudah di-ACC dan dibayarkan (${res.count} jemaah).`, 'system'));
    return res;
  }

  // Dikembalikan ke pengaju untuk diperbaiki. Alasannya wajib — dikembalikan
  // tanpa keterangan hanya membuat pengajuan yang sama diajukan lagi.
  rejectUmrohPayment(ids, user, note) {
    if (!this.canMarkCashback(user)) {
      return { error: 'Hanya dr. Kevin Chikrista yang bisa menolak pengajuan.' };
    }
    const clean = String(note || '').trim();
    if (!clean) return { error: 'Tulis dulu alasan pengembaliannya.' };
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Tidak ada pengajuan yang dipilih' };
    const pengaju = new Set();
    let n = 0;
    list.forEach(id => {
      const r = (this.data.umroh_sales || []).find(x => x.id === id);
      if (!r || r.cashback_paid) return;
      if (r.cashback_requested_by) pengaju.add(r.cashback_requested_by);
      if (this._umrohWrite(id, { cashback_batch: '', cashback_requested_at: null, cashback_requested_by: null, cashback_reject_note: clean })) n++;
    });
    this._save();
    if (!n) return { error: 'Tidak ada pengajuan yang bisa dikembalikan.' };
    pengaju.forEach(pid => {
      if (pid === (user && user.id)) return;
      this.addNotification(pid, 'Pengajuan Cashback Dikembalikan',
        `Pengajuan pembayaran cashback Anda dikembalikan. Catatan: ${clean}`, 'system');
    });
    return { success: true, count: n };
  }

  // Pengajuan yang belum di-ACC, dikelompokkan per pengajuan (batch).
  getUmrohPaymentRequests(entries) {
    const per = new Map();
    (entries || []).forEach(e => {
      if (e.cb_state !== 'requested' || !e.batch) return;
      if (!per.has(e.batch)) {
        per.set(e.batch, {
          batch: e.batch, rows: [], travels: new Set(),
          requested_at: e.requested_at, requested_by_name: e.requested_by_name || 'Admin',
        });
      }
      const g = per.get(e.batch);
      g.rows.push(e);
      if (e.travel) g.travels.add(e.travel);
      // Yang paling awal diajukan jadi penanda waktunya.
      if (e.requested_at && (!g.requested_at || e.requested_at < g.requested_at)) g.requested_at = e.requested_at;
    });
    return Array.from(per.values()).map(g => ({
      batch: g.batch,
      requested_at: g.requested_at,
      requested_by_name: g.requested_by_name,
      travel: Array.from(g.travels).sort().join(', ') || '(tanpa travel)',
      count: g.rows.length,
      total: g.rows.reduce((a, b) => a + (Number(b.cashback) || 0), 0),
      ids: g.rows.map(r => r.id),
      rows: g.rows,
    })).sort((a, b) => String(a.requested_at || '').localeCompare(String(b.requested_at || '')));
  }

  setUmrohCashbackPaid(ids, paid, userId) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return { error: 'Tidak ada data yang dipilih' };
    const nowIso = new Date().toISOString();
    let n = 0;
    list.forEach(id => {
      const r = (this.data.umroh_sales || []).find(x => x.id === id);
      if (!r) return;
      r.cashback_paid = !!paid;
      r.cashback_at = paid ? nowIso : null;
      r.cashback_by = paid ? (userId || null) : null;
      // Batal lunas juga menghapus jejak pengajuannya, supaya barisnya kembali
      // ke keadaan awal dan tidak tertinggal sebagai pengajuan hantu.
      const extra = paid ? {} : { cashback_batch: '', cashback_requested_at: null, cashback_requested_by: null };
      Object.assign(r, extra);
      n++;
      if (!CONFIG.DEMO_MODE && !String(id).startsWith('id_')) {
        supabase.update('umroh_sales', id, { cashback_paid: r.cashback_paid, cashback_at: r.cashback_at, cashback_by: r.cashback_by, ...extra }).catch(() => {});
      }
    });
    this._save();
    if (!n) return { error: 'Data penjualan tidak ditemukan' };
    return { success: true, count: n };
  }

  // Siapa yang boleh menandai cashback sudah dibayar. Lebih sempit daripada
  // yang boleh membuka halamannya — lihat CONFIG.CASHBACK_MANAGER_EMAILS.
  canMarkCashback(user) {
    if (!user) return false;
    const allowed = (CONFIG.CASHBACK_MANAGER_EMAILS || []).map(e => String(e).toLowerCase());
    if (allowed.includes(String(user.email || '').toLowerCase())) return true;
    // Cadangan yang sama seperti panel lain: kalau tidak satu pun e-mail itu
    // terdaftar, Owner tetap boleh supaya tidak ada yang bisa menandainya.
    if (user.role === 'owner') {
      return !(this.data.users || []).some(u => allowed.includes(String(u.email || '').toLowerCase()));
    }
    return false;
  }

  umrohSummary(entries) {
    const s = {
      jamaah: 0, revenue: 0,
      cashbackTotal: 0, cashbackPaid: 0, cashbackDue: 0, cashbackRequested: 0, requestedCount: 0,
      meningitis: 0, polio: 0, combo: 0,
      noTravel: 0, noCashback: 0, travels: 0, perluCek: 0,
    };
    const travels = new Set();
    (entries || []).forEach(e => {
      s.jamaah++;
      s.revenue += Number(e.price) || 0;
      const cb = Number(e.cashback) || 0;
      s.cashbackTotal += cb;
      if (e.paid) s.cashbackPaid += cb; else s.cashbackDue += cb;
      if (e.cb_state === 'requested') { s.cashbackRequested += cb; s.requestedCount++; }
      if (!cb) s.noCashback++;
      if (e.cb_review) s.perluCek++;
      if (e.service === 'combo') s.combo++;
      else if (e.service === 'meningitis') s.meningitis++;
      else if (e.service === 'polio') s.polio++;
      if (e.travel) travels.add(e.travel); else s.noTravel++;
    });
    s.travels = travels.size;
    return s;
  }

  // Pesan WhatsApp berisi rincian cashback untuk satu travel.
  // Dirakit di sini (bukan di dalam x-data) supaya teksnya bebas dari jebakan
  // pelolosan tanda kutip pada atribut HTML.
  buildUmrohCashbackText(travel, entries, from, to) {
    const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
    const tgl = (d) => {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const list = entries || [];
    const periode = from && to ? ` periode ${tgl(from)} \u2013 ${tgl(to)}` : '';
    const baris = list.map((e, i) => {
      const nominal = Number(e.cashback) > 0 ? ` \u2014 ${rupiah(e.cashback)}` : '';
      return `${i + 1}. ${e.patient_name} (${tgl(e.date)}) \u2014 ${e.service_label}${nominal}`;
    });
    const total = list.reduce((sum, e) => sum + (Number(e.cashback) || 0), 0);
    const penutup = total > 0
      ? `Total ${list.length} jemaah, cashback ${rupiah(total)}.`
      // Tanpa nominal, kalimat "total Rp0" justru membingungkan — lebih baik
      // hanya menyebut jumlah jemaahnya.
      : `Total ${list.length} jemaah.`;
    return [
      `Assalamu'alaikum, Tim ${travel || 'Travel'}.`,
      '',
      `Berikut rincian jemaah yang telah kami layani vaksinasi di ${CONFIG.APP_NAME}${periode}:`,
      '',
      baris.join('\n'),
      '',
      penutup,
      'Mohon konfirmasinya untuk proses cashback. Terima kasih.',
    ].join('\n');
  }

  getDoctors() { return this.data.doctors; }
  getDoctor(doctorId) { return this.data.doctors.find(d => d.id === doctorId); }
  getDoctorByUserId(userId) { return this.data.doctors.find(d => d.user_id === userId); }

  // Doctors shown on the public landing page — opt-in via SuperAdmin, since having
  // an account doesn't mean a doctor actually practices at this clinic (could be
  // a visiting/temporary doctor), so this is never just "all doctor accounts".
  getPublicDoctors() { return this.data.doctors.filter(d => d.is_public_listed); }
  toggleDoctorPublicListing(doctorId) {
    const d = this.data.doctors.find(x => x.id === doctorId);
    if (!d) return;
    d.is_public_listed = !d.is_public_listed;
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('doctors', doctorId, { is_public_listed: d.is_public_listed }).catch(() => {});
  }

  // Promo — not a separate content type: any Layanan can be flagged as promo
  // from SuperAdmin (checkbox + strikethrough "harga asli"), shown highlighted
  // on the public landing page while is_promo is on. Uses the same
  // createService/updateService/toggleServiceActive/deleteService methods above.
  getPromoServices() { return this.data.health_services.filter(s => s.is_active && s.is_promo); }

  // Health articles — managed from SuperAdmin, shown on the public landing page when published.
  getAllArticles() { return this.data.articles || []; }
  getPublishedArticles() { return (this.data.articles || []).filter(a => a.is_published).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)); }
  getArticle(id) { return (this.data.articles || []).find(a => a.id === id); }
  createArticle(data) {
    const a = { id: generateId(), is_published: true, sort_order: 0, ...data, created_at: new Date().toISOString() };
    if (!this.data.articles) this.data.articles = [];
    this.data.articles.push(a);
    this._save();
    this._syncInsert('articles', a);
    return a;
  }
  updateArticle(id, updates) {
    const a = (this.data.articles || []).find(x => x.id === id);
    if (a) { Object.assign(a, updates); this._save(); if (!CONFIG.DEMO_MODE) supabase.update('articles', id, updates).catch(() => {}); }
    return a;
  }
  toggleArticlePublished(id) {
    const a = (this.data.articles || []).find(x => x.id === id);
    if (a) { a.is_published = !a.is_published; this._save(); if (!CONFIG.DEMO_MODE) supabase.update('articles', id, { is_published: a.is_published }).catch(() => {}); }
  }
  deleteArticle(id) {
    this.data.articles = (this.data.articles || []).filter(x => x.id !== id);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.delete('articles', id).catch(() => {});
  }

  // Chat consultations (Patient <-> Doctor), refreshed via polling since there's
  // no realtime/websocket support in this hand-rolled Supabase REST wrapper.
  async getOrCreateConsultation(patientId, doctorId) {
    let c = (this.data.consultations || []).find(x => x.patient_id === patientId && x.doctor_id === doctorId);
    if (c) return c;
    // Check Supabase directly (not just the local cache) before creating —
    // otherwise if the patient and doctor each start the chat from their own
    // side in separate browser sessions, neither session's local cache knows
    // about the other's row yet, and each would create its OWN consultation,
    // silently splitting the conversation in two (messages never connect).
    if (!CONFIG.DEMO_MODE) {
      try {
        const existing = await supabase.select('consultations', { eq: { patient_id: patientId, doctor_id: doctorId } });
        if (existing && existing[0]) {
          c = existing[0];
          if (!this.data.consultations) this.data.consultations = [];
          this.data.consultations.push(c);
          this._save();
          return c;
        }
      } catch (e) { console.warn('Gagal mengecek percakapan yang sudah ada:', e); }
    }
    c = { id: generateId(), patient_id: patientId, doctor_id: doctorId, last_message_at: new Date().toISOString(), patient_last_read_at: null, doctor_last_read_at: null, created_at: new Date().toISOString() };
    if (!this.data.consultations) this.data.consultations = [];
    this.data.consultations.push(c);
    this._save();
    await this._syncInsert('consultations', c);
    return c;
  }

  getConsultation(id) { return (this.data.consultations || []).find(c => c.id === id); }

  _consultationSummary(c, viewerRole) {
    const patient = this.getPatient(c.patient_id);
    const doctor = this.getDoctor(c.doctor_id);
    const msgs = this.getMessages(c.id);
    const last = msgs[msgs.length - 1];
    const lastReadAt = viewerRole === 'patient' ? c.patient_last_read_at : c.doctor_last_read_at;
    const unread = msgs.filter(m => m.sender_role !== viewerRole && (!lastReadAt || m.created_at > lastReadAt)).length;
    return {
      ...c,
      patient_name: patient?.full_name || 'Pasien',
      doctor_name: doctor?.full_name || 'Dokter',
      last_message: last?.message || '',
      unread_count: unread,
    };
  }

  getConsultationsForPatient(patientId) {
    return (this.data.consultations || []).filter(c => c.patient_id === patientId)
      .map(c => this._consultationSummary(c, 'patient'))
      .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''));
  }

  // All consultations across every patient/doctor — for SuperAdmin's Riwayat
  // Konsultasi oversight page (read-only, not a chat participant).
  getAllConsultations() {
    return (this.data.consultations || []).map(c => {
      const patient = this.getPatient(c.patient_id);
      const doctor = this.getDoctor(c.doctor_id);
      const msgs = this.getMessages(c.id);
      return {
        ...c,
        patient_name: patient?.full_name || 'Pasien',
        doctor_name: doctor?.full_name || 'Dokter',
        last_message: msgs[msgs.length - 1]?.message || '',
        message_count: msgs.length,
      };
    }).sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''));
  }

  // Re-fetches every consultation + message from Supabase — same staleness
  // fix as fetchBookings, for the SuperAdmin Riwayat Konsultasi list.
  async fetchAllConsultations() {
    if (!CONFIG.DEMO_MODE) {
      try {
        const [consults, msgs] = await Promise.all([
          supabase.select('consultations'),
          supabase.select('consultation_messages'),
        ]);
        if (consults) this.data.consultations = consults;
        if (msgs) this.data.consultation_messages = msgs;
        this._save();
      } catch (e) { console.warn('Gagal memuat riwayat konsultasi:', e); }
    }
    return this.getAllConsultations();
  }

  getConsultationsForDoctor(doctorId) {
    return (this.data.consultations || []).filter(c => c.doctor_id === doctorId)
      .map(c => this._consultationSummary(c, 'doctor'))
      .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''));
  }

  getMessages(consultationId) {
    return (this.data.consultation_messages || []).filter(m => m.consultation_id === consultationId).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }

  // Re-fetches the consultation list from Supabase — called by the chat list
  // page's polling interval, so a new conversation started by the other party
  // (patient or doctor) appears without a full app reload.
  async fetchConsultationsForPatient(patientId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const [consults, msgs] = await Promise.all([
          supabase.select('consultations', { eq: { patient_id: patientId } }),
          supabase.select('consultation_messages'),
        ]);
        if (consults) this.data.consultations = (this.data.consultations || []).filter(c => c.patient_id !== patientId).concat(consults);
        if (msgs) this.data.consultation_messages = msgs;
        this._save();
      } catch (e) { console.warn('Gagal memuat daftar percakapan:', e); }
    }
    return this.getConsultationsForPatient(patientId);
  }

  async fetchConsultationsForDoctor(doctorId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const [consults, msgs] = await Promise.all([
          supabase.select('consultations', { eq: { doctor_id: doctorId } }),
          supabase.select('consultation_messages'),
        ]);
        if (consults) this.data.consultations = (this.data.consultations || []).filter(c => c.doctor_id !== doctorId).concat(consults);
        if (msgs) this.data.consultation_messages = msgs;
        this._save();
      } catch (e) { console.warn('Gagal memuat daftar percakapan:', e); }
    }
    return this.getConsultationsForDoctor(doctorId);
  }

  // Re-fetches messages for one conversation from Supabase — called by the chat
  // thread's polling interval. Only ever touches this.data.consultation_messages,
  // never any compose-box input state, so in-progress typing is never wiped.
  async fetchMessages(consultationId) {
    if (CONFIG.DEMO_MODE) return this.getMessages(consultationId);
    try {
      const rows = await supabase.select('consultation_messages', { eq: { consultation_id: consultationId }, order: 'created_at.asc' });
      if (rows) {
        this.data.consultation_messages = (this.data.consultation_messages || []).filter(m => m.consultation_id !== consultationId).concat(rows);
        this._save();
      }
    } catch (e) { console.warn('Gagal memuat pesan chat:', e); }
    return this.getMessages(consultationId);
  }

  sendMessage(consultationId, senderRole, text) {
    const msg = { id: generateId(), consultation_id: consultationId, sender_role: senderRole, message: text, created_at: new Date().toISOString() };
    if (!this.data.consultation_messages) this.data.consultation_messages = [];
    this.data.consultation_messages.push(msg);
    const c = this.getConsultation(consultationId);
    if (c) {
      c.last_message_at = msg.created_at;
      const patient = this.getPatient(c.patient_id);
      const doctor = this.getDoctor(c.doctor_id);
      if (senderRole === 'patient' && doctor) this.addNotification(doctor.user_id, 'Pesan Baru', `${patient?.full_name || 'Pasien'}: ${text.slice(0, 60)}`, 'chat');
      if (senderRole === 'doctor' && patient) this.addNotification(patient.user_id, 'Pesan Baru', `${doctor?.full_name || 'Dokter'}: ${text.slice(0, 60)}`, 'chat');
    }
    this._save();
    this._syncInsert('consultation_messages', msg);
    if (c && !CONFIG.DEMO_MODE) supabase.update('consultations', consultationId, { last_message_at: msg.created_at }).catch(() => {});
    return msg;
  }

  markConversationRead(consultationId, viewerRole) {
    const c = this.getConsultation(consultationId);
    if (!c) return;
    const now = new Date().toISOString();
    if (viewerRole === 'patient') c.patient_last_read_at = now; else c.doctor_last_read_at = now;
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('consultations', consultationId, viewerRole === 'patient' ? { patient_last_read_at: now } : { doctor_last_read_at: now }).catch(() => {});
  }

  // Pharmacies list
  getPharmacies() { return this.data.pharmacies; }
  getPharmacy(pharmacyId) { return this.data.pharmacies.find(p => p.id === pharmacyId); }
  getPharmacyByUserId(userId) { return this.data.pharmacies.find(p => p.user_id === userId); }

  // Home Care - BMHP & Jasa claims
  // Always fetched live from the published Google Sheet (not cached in this.data)
  // so a price edited in the sheet shows up next time this is called.
  async getPriceList() {
    try {
      const res = await fetch(CONFIG.HOMECARE_PRICE_SHEET_CSV_URL, { cache: 'no-store' });
      if (!res.ok) return [];
      const text = await res.text();
      return parseHomeCarePriceCsv(text);
    } catch (e) { console.warn('Gagal memuat daftar harga BMHP/Jasa:', e); return []; }
  }

  // Awaits the claim insert, THEN awaits every item insert (via Promise.all)
  // before returning — the caller (homecare.js submitClaim) awaits this whole
  // call before showing "Tersimpan!" and navigating away. Previously the item
  // inserts fired fire-and-forget after the claim insert resolved, so
  // navigating away (or closing the tab) right after submit could abandon
  // them mid-flight — the claim's totals would save but its itemized
  // breakdown would silently end up empty, as happened with a real claim.
  async createHomeCareClaim(header, items) {
    const newClaim = { id: generateId(), status: 'pending', completed_at: null, ...header, created_at: new Date().toISOString() };
    if (!this.data.home_care_claims) this.data.home_care_claims = [];
    this.data.home_care_claims.push(newClaim);
    const savedItems = [];
    items.forEach(item => {
      const newItem = { id: generateId(), claim_id: newClaim.id, ...item };
      if (!this.data.home_care_claim_items) this.data.home_care_claim_items = [];
      this.data.home_care_claim_items.push(newItem);
      savedItems.push(newItem);
    });
    this._save();
    const claim = await this._syncInsert('home_care_claims', newClaim);
    savedItems.forEach(si => { si.claim_id = claim.id; });
    await Promise.all(savedItems.map(si => this._syncInsert('home_care_claim_items', si)));
    return newClaim;
  }

  getHomeCareClaims(filters = {}) {
    let claims = this.data.home_care_claims || [];
    if (filters.doctorId) claims = claims.filter(c => c.doctor_id === filters.doctorId);
    return claims.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  // Re-fetches claims (+ items) from Supabase — same staleness fix as
  // fetchBookings, so a claim submitted by a doctor shows up for SuperAdmin
  // (and vice versa) without a full page reload. Pass a doctorId to scope to
  // one doctor's own history page, or omit for SuperAdmin's cross-doctor view.
  async fetchHomeCareClaims(doctorId) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const query = doctorId ? { eq: { doctor_id: doctorId }, order: 'created_at.desc' } : { order: 'created_at.desc' };
        const [claims, items] = await Promise.all([
          supabase.select('home_care_claims', query),
          supabase.select('home_care_claim_items'),
        ]);
        if (claims) this.data.home_care_claims = doctorId
          ? (this.data.home_care_claims || []).filter(c => c.doctor_id !== doctorId).concat(claims)
          : claims;
        if (items) this.data.home_care_claim_items = items;
        this._save();
      } catch (e) { console.warn('Gagal memuat klaim BMHP:', e); }
    }
    return this.getHomeCareClaims(doctorId ? { doctorId } : {});
  }

  getHomeCareClaim(claimId) {
    return (this.data.home_care_claims || []).find(c => c.id === claimId);
  }

  getHomeCareClaimItems(claimId) {
    return (this.data.home_care_claim_items || []).filter(i => i.claim_id === claimId);
  }

  async updateHomeCareClaim(claimId, header, items) {
    const claim = this.data.home_care_claims.find(c => c.id === claimId);
    if (!claim) return { error: 'Klaim tidak ditemukan' };
    Object.assign(claim, header);
    this.data.home_care_claim_items = (this.data.home_care_claim_items || []).filter(i => i.claim_id !== claimId);
    const savedItems = [];
    items.forEach(item => {
      const newItem = { id: generateId(), claim_id: claimId, ...item };
      this.data.home_care_claim_items.push(newItem);
      savedItems.push(newItem);
    });
    this._save();
    if (!CONFIG.DEMO_MODE) {
      await supabase.update('home_care_claims', claimId, header).catch(e => console.warn('Gagal update klaim BMHP:', e));
      await supabase.deleteWhere('home_care_claim_items', { claim_id: claimId }).catch(e => console.warn('Gagal hapus item klaim lama:', e));
      await Promise.all(savedItems.map(si => this._syncInsert('home_care_claim_items', si)));
    }
    return { success: true };
  }

  markHomeCareClaimComplete(claimId) {
    const claim = this.data.home_care_claims.find(c => c.id === claimId);
    if (!claim) return;
    claim.status = 'selesai';
    claim.completed_at = new Date().toISOString();
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('home_care_claims', claimId, { status: 'selesai', completed_at: claim.completed_at }).catch(() => {});
  }

  unmarkHomeCareClaimComplete(claimId) {
    const claim = this.data.home_care_claims.find(c => c.id === claimId);
    if (!claim) return;
    claim.status = 'pending';
    claim.completed_at = null;
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('home_care_claims', claimId, { status: 'pending', completed_at: null }).catch(() => {});
  }

  deleteHomeCareClaim(claimId) {
    this.data.home_care_claims = (this.data.home_care_claims || []).filter(c => c.id !== claimId);
    this.data.home_care_claim_items = (this.data.home_care_claim_items || []).filter(i => i.claim_id !== claimId);
    this._save();
    if (!CONFIG.DEMO_MODE) {
      supabase.deleteWhere('home_care_claim_items', { claim_id: claimId }).catch(() => {});
      supabase.delete('home_care_claims', claimId).catch(() => {});
    }
  }

  // Stats
  getStats() {
    return {
      totalPatients: this.data.patients.length,
      totalDoctors: this.data.doctors.length,
      totalPharmacies: this.data.pharmacies.length,
      totalRecords: this.data.medical_records.length,
      totalPrescriptions: this.data.prescriptions.length,
      totalAppointments: this.data.appointments.length,
    };
  }
}

export const store = new Store();
