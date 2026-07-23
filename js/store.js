import { CONFIG } from './config.js';
import { supabase } from './supabase.js';

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
  _syncInsert(table, localRecord, payloadOverride) {
    if (CONFIG.DEMO_MODE) return Promise.resolve(localRecord);
    const { id, ...payload } = payloadOverride || localRecord;
    return supabase.insert(table, payload).then(inserted => {
      if (inserted && inserted.id) { localRecord.id = inserted.id; this._save(); }
      else if (inserted && inserted.error) { console.warn(`Gagal menyimpan ke Supabase (${table}):`, inserted.error, payload); }
      return localRecord;
    }).catch(e => { console.warn(`Gagal menyimpan ke Supabase (${table}):`, e, payload); return localRecord; });
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

  async getCertificateById(id) {
    if (!CONFIG.DEMO_MODE) {
      try {
        const results = await supabase.select('certificates', { eq: { id } });
        if (results && results[0]) return results[0];
      } catch (e) { console.warn('Failed to fetch certificate from Supabase:', e); }
    }
    return (this.data.certificates || []).find(c => c.id === id) || null;
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
      this.data.users = profiles.map(p => ({ id: p.id, email: p.email, role: p.role, is_active: p.is_active, auth_id: p.auth_id || null, no_email: isPlaceholderEmail(p.email), has_login: !!p.auth_id, password: '***', created_at: p.created_at }));
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

        // 3. Create patient di Supabase
        await supabase.insert('patients', {
          profile_id: profileId, full_name: userData.full_name, nik: userData.nik || '',
          birth_date: userData.birth_date || null, gender: userData.gender || '',
          phone: userData.phone || '', address: userData.address || '',
          blood_type: userData.blood_type || '', allergies: userData.allergies || '-',
          emergency_contact: userData.emergency_contact || ''
        });

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
      case 'owner': return this.data.doctors.find(d => d.user_id === user.id) || { full_name: 'Owner', role: 'owner' };
      case 'patient': return this.data.patients.find(p => p.user_id === user.id);
      case 'pharmacy': return this.data.pharmacies.find(ph => ph.user_id === user.id);
      case 'superadmin': return { full_name: 'Super Admin', role: 'superadmin' };
      default: return null;
    }
  }

  // Users (Admin)
  getUsers(roleFilter) {
    let users = this.data.users.filter(u => u.role !== 'superadmin');
    if (roleFilter) users = users.filter(u => u.role === roleFilter);
    return users.map(u => ({ ...u, profile: this.getProfile(u) }));
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
    const user = { id: userId, email, password: userData.password || 'default123', role: userData.role, is_active: true, no_email: !hasEmail, created_at: new Date().toISOString().split('T')[0] };
    this.data.users.push(user);
    if (userData.role === 'doctor' || userData.role === 'owner') {
      this.data.doctors.push({ id: generateId(), user_id: userId, full_name: userData.full_name, sip_number: userData.sip_number || '', specialization: userData.specialization || '', phone: userData.phone || '', is_available: true, schedule: { mon: '08:00-16:00', tue: '08:00-16:00', wed: '08:00-16:00', thu: '08:00-16:00', fri: '08:00-16:00', sat: null, sun: null } });
    } else if (userData.role === 'patient') {
      this.data.patients.push({ id: generateId(), user_id: userId, full_name: userData.full_name, nik: userData.nik || '', birth_date: userData.birth_date || '', gender: userData.gender || '', phone: userData.phone || '', address: userData.address || '', blood_type: userData.blood_type || '', allergies: userData.allergies || '-', emergency_contact: userData.emergency_contact || '' });
    } else if (userData.role === 'pharmacy') {
      this.data.pharmacies.push({ id: generateId(), user_id: userId, name: userData.name || userData.full_name, address: userData.address || '', phone: userData.phone || '', license_no: userData.license_no || '', operating_hours: userData.operating_hours || '' });
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
    user.is_active = !user.is_active;
    this._save();
    return { success: true };
  }

  // Patients
  getPatients(search) {
    let patients = this.data.patients;
    if (search) {
      const q = search.toLowerCase();
      patients = patients.filter(p => p.full_name.toLowerCase().includes(q) || p.nik.includes(q) || p.phone.includes(q));
    }
    return patients;
  }

  getPatient(patientId) { return this.data.patients.find(p => p.id === patientId); }

  getPatientByUserId(userId) { return this.data.patients.find(p => p.user_id === userId); }

  updatePatientProfile(patientId, updates) {
    const p = this.data.patients.find(x => x.id === patientId);
    if (!p) return { error: 'Pasien tidak ditemukan' };
    const allowed = ['phone', 'address', 'emergency_contact', 'allergies'];
    allowed.forEach(k => { if (updates[k] !== undefined) p[k] = updates[k]; });
    this._save();
    return { success: true };
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

  getPrescriptionsByPharmacy(pharmacyId) {
    return this.data.prescriptions.filter(rx => rx.pharmacy_id === pharmacyId).sort((a, b) => this._rxSortTime(b).localeCompare(this._rxSortTime(a)));
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
    if (patientUser) this.addNotification(patientUser.user_id, 'Resep Dikirim', `Resep ${newRx.rx_number} telah dikirim ke apotek.`, 'prescription');
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

  createVaccination(vax) {
    const newVax = { id: generateId(), ...vax };
    this.data.vaccinations.push(newVax);
    this._save();
    // next_dose_date is empty for a series with no scheduled next dose (and
    // date_given could be blank too) — null them so Postgres doesn't reject the
    // DATE columns and silently drop the whole vaccination insert.
    this._syncInsert('vaccinations', newVax, sanitizeDates(newVax, ['date_given', 'next_dose_date']));
    return newVax;
  }

  updateVaccination(vaxId, updates) {
    const v = this.data.vaccinations.find(x => x.id === vaxId);
    if (!v) return { error: 'Data vaksinasi tidak ditemukan' };
    Object.assign(v, updates);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('vaccinations', vaxId, updates).catch(() => {});
    return { success: true };
  }

  deleteVaccination(vaxId) {
    this.data.vaccinations = this.data.vaccinations.filter(x => x.id !== vaxId);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.delete('vaccinations', vaxId).catch(() => {});
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
    if (n) { n.is_read = true; this._save(); }
  }

  markAllRead(userId) {
    this.data.notifications.filter(n => n.user_id === userId).forEach(n => n.is_read = true);
    this._save();
  }

  addNotification(userId, title, message, type) {
    if (!userId) return;
    const notif = { id: generateId(), user_id: userId, title, message, type, is_read: false, created_at: new Date().toISOString() };
    this.data.notifications.push(notif);
    this._save();
    this._syncInsert('notifications', notif, { id: notif.id, profile_id: userId, title, message, type, is_read: false, created_at: notif.created_at });
  }

  // Doctors list
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
