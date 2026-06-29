import { CONFIG } from './config.js';
import { supabase } from './supabase.js';

function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
    { id: 'd_1', user_id: 'u_doc1', full_name: 'dr. Kevin Chikrista', sip_number: 'SIP-4401234567', specialization: 'Dokter Umum', phone: '081234567890', is_available: true, schedule: { mon: '08:00-16:00', tue: '08:00-16:00', wed: '08:00-12:00', thu: '08:00-16:00', fri: '08:00-16:00', sat: '08:00-12:00', sun: null } },
    { id: 'd_2', user_id: 'u_doc2', full_name: 'dr. Sarah Putri, Sp.A', sip_number: 'SIP-4401234568', specialization: 'Dokter Anak', phone: '081234567891', is_available: true, schedule: { mon: '09:00-15:00', tue: null, wed: '09:00-15:00', thu: '09:00-15:00', fri: '09:00-15:00', sat: null, sun: null } },
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
    { id: 'hs_5', name: 'Konsultasi Online', description: 'Konsultasi kesehatan via video call dengan dokter. Resep digital dikirim langsung ke apotek.', category: 'Konsultasi', price: 100000, image_url: 'https://placehold.co/400x250/ec4899/white?text=Konsultasi', is_active: true, items: [
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

  async loadFromSupabase() {
    if (CONFIG.DEMO_MODE) return;
    try {
      const [profiles, doctors, patients, pharmacies, records, prescriptions, rxItems, appointments, vaccinations, services, bookings, inventory, notifications] = await Promise.all([
        supabase.select('profiles'), supabase.select('doctors'), supabase.select('patients'),
        supabase.select('pharmacies'), supabase.select('medical_records', { order: 'visit_date.desc' }),
        supabase.select('prescriptions', { order: 'created_at.desc' }),
        supabase.select('prescription_items'), supabase.select('appointments'),
        supabase.select('vaccinations'), supabase.select('health_services'),
        supabase.select('bookings', { order: 'created_at.desc' }),
        supabase.select('inventory'), supabase.select('notifications', { order: 'created_at.desc' }),
      ]);
      // Map Supabase data to local format
      this.data.users = profiles.map(p => ({ id: p.id, email: p.email, role: p.role, is_active: p.is_active, password: '***', created_at: p.created_at }));
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
    const exists = this.data.users.find(u => u.email === userData.email);
    if (exists) return { error: 'Email sudah terdaftar' };

    if (!CONFIG.DEMO_MODE) {
      try {
        // 1. Create auth user di Supabase
        const authRes = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/signup', {
          method: 'POST', headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email, password: userData.password || 'default123' })
        }).then(r => r.json());
        const authId = authRes.user?.id || null;

        // 2. Create profile di Supabase
        const profileRes = await supabase.insert('profiles', {
          email: userData.email, role: 'patient', is_active: true, auth_id: authId
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

        const user = this.data.users.find(u => u.email === userData.email);
        const patient = this.data.patients.find(p => p.user_id === profileId);
        return { user: user || { id: profileId, email: userData.email, role: 'patient' }, profile: patient };
      } catch(e) { return { error: 'Gagal menyimpan ke server: ' + e.message }; }
    }

    // Demo mode: localStorage only
    const userId = generateId();
    const user = { id: userId, email: userData.email, password: userData.password, role: 'patient', is_active: true, created_at: new Date().toISOString().split('T')[0] };
    this.data.users.push(user);
    const patient = { id: generateId(), user_id: userId, full_name: userData.full_name, nik: userData.nik, birth_date: userData.birth_date, gender: userData.gender, phone: userData.phone, address: userData.address, blood_type: userData.blood_type || '', allergies: userData.allergies || '-', emergency_contact: userData.emergency_contact || '' };
    this.data.patients.push(patient);
    this._save();
    return { user, profile: patient };
  }

  getProfile(user) {
    switch (user.role) {
      case 'doctor': return this.data.doctors.find(d => d.user_id === user.id);
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
    const exists = this.data.users.find(u => u.email === userData.email);
    if (exists) return { error: 'Email sudah terdaftar' };
    const userId = generateId();
    const user = { id: userId, email: userData.email, password: userData.password || 'default123', role: userData.role, is_active: true, created_at: new Date().toISOString().split('T')[0] };
    this.data.users.push(user);
    if (userData.role === 'doctor') {
      this.data.doctors.push({ id: generateId(), user_id: userId, full_name: userData.full_name, sip_number: userData.sip_number || '', specialization: userData.specialization || '', phone: userData.phone || '', is_available: true, schedule: { mon: '08:00-16:00', tue: '08:00-16:00', wed: '08:00-16:00', thu: '08:00-16:00', fri: '08:00-16:00', sat: null, sun: null } });
    } else if (userData.role === 'patient') {
      this.data.patients.push({ id: generateId(), user_id: userId, full_name: userData.full_name, nik: userData.nik || '', birth_date: userData.birth_date || '', gender: userData.gender || '', phone: userData.phone || '', address: userData.address || '', blood_type: userData.blood_type || '', allergies: userData.allergies || '-', emergency_contact: userData.emergency_contact || '' });
    } else if (userData.role === 'pharmacy') {
      this.data.pharmacies.push({ id: generateId(), user_id: userId, name: userData.name || userData.full_name, address: userData.address || '', phone: userData.phone || '', license_no: userData.license_no || '', operating_hours: userData.operating_hours || '' });
    }
    this._save();
    return { user };
  }

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
    if (!user) return;
    user.is_active = !user.is_active;
    this._save();
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

  // Medical Records
  getRecords(patientId) {
    return this.data.medical_records.filter(r => r.patient_id === patientId).sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  }

  getRecordsByDoctor(doctorId) {
    return this.data.medical_records.filter(r => r.doctor_id === doctorId).sort((a, b) => b.visit_date.localeCompare(a.visit_date));
  }

  createRecord(record) {
    const newRecord = { id: generateId(), ...record, visit_date: record.visit_date || new Date().toISOString().split('T')[0] };
    this.data.medical_records.push(newRecord);
    if (record.follow_up_date) {
      const apt = { id: generateId(), patient_id: record.patient_id, doctor_id: record.doctor_id, date: record.follow_up_date, time_slot: '09:00', type: 'follow_up', status: 'scheduled', queue_number: null, notes: record.follow_up_notes || 'Kontrol ulang' };
      this.data.appointments.push(apt);
      if (!CONFIG.DEMO_MODE) supabase.insert('appointments', apt).catch(() => {});
    }
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.insert('medical_records', newRecord).catch(() => {});
    return newRecord;
  }

  // Prescriptions
  getPrescriptionsByDoctor(doctorId) {
    return this.data.prescriptions.filter(rx => rx.doctor_id === doctorId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getPrescriptionsByPatient(patientId) {
    return this.data.prescriptions.filter(rx => rx.patient_id === patientId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getPrescriptionsByPharmacy(pharmacyId) {
    return this.data.prescriptions.filter(rx => rx.pharmacy_id === pharmacyId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getPrescriptionItems(prescriptionId) {
    return this.data.prescription_items.filter(i => i.prescription_id === prescriptionId);
  }

  createPrescription(rx, items) {
    const newRx = { id: generateId(), ...rx, status: 'sent', created_at: new Date().toISOString(), rx_number: 'R-' + new Date().getFullYear() + '-' + String(this.data.prescriptions.length + 1).padStart(4, '0') };
    this.data.prescriptions.push(newRx);
    const savedItems = [];
    items.forEach(item => {
      const newItem = { id: generateId(), prescription_id: newRx.id, ...item };
      this.data.prescription_items.push(newItem);
      savedItems.push(newItem);
    });
    const patient = this.getPatient(rx.patient_id);
    this.addNotification(this.data.pharmacies.find(ph => ph.id === rx.pharmacy_id)?.user_id, 'E-Resep Baru', `Resep baru ${newRx.rx_number} untuk ${patient?.full_name || 'pasien'}.`, 'prescription');
    const patientUser = this.data.patients.find(p => p.id === rx.patient_id);
    if (patientUser) this.addNotification(patientUser.user_id, 'Resep Dikirim', `Resep ${newRx.rx_number} telah dikirim ke apotek.`, 'prescription');
    this._save();
    if (!CONFIG.DEMO_MODE) {
      supabase.insert('prescriptions', newRx).catch(() => {});
      savedItems.forEach(si => supabase.insert('prescription_items', si).catch(() => {}));
    }
    return newRx;
  }

  updatePrescriptionStatus(rxId, status) {
    const rx = this.data.prescriptions.find(r => r.id === rxId);
    if (!rx) return;
    rx.status = status;
    const patient = this.getPatient(rx.patient_id);
    const statusLabel = CONFIG.PRESCRIPTION_STATUS_LABELS[status] || status;
    if (patient) this.addNotification(patient.user_id, `Resep ${statusLabel}`, `Resep ${rx.rx_number} status: ${statusLabel}.`, 'prescription');
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('prescriptions', rxId, { status }).catch(() => {});
  }

  updatePrescription(rxId, updates) {
    const rx = this.data.prescriptions.find(r => r.id === rxId);
    if (!rx) return { error: 'Resep tidak ditemukan' };
    if (!['sent','rejected'].includes(rx.status)) return { error: 'Resep sudah diproses apotek, tidak bisa diedit' };
    Object.assign(rx, updates);
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.update('prescriptions', rxId, updates).catch(() => {});
    return { success: true, rx };
  }

  updatePrescriptionItems(rxId, newItems) {
    this.data.prescription_items = this.data.prescription_items.filter(i => i.prescription_id !== rxId);
    if (!CONFIG.DEMO_MODE) supabase.deleteWhere('prescription_items', { prescription_id: rxId }).catch(() => {});
    newItems.forEach(item => {
      const newItem = { id: generateId(), prescription_id: rxId, ...item };
      this.data.prescription_items.push(newItem);
      if (!CONFIG.DEMO_MODE) supabase.insert('prescription_items', newItem).catch(() => {});
    });
    this._save();
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

  getUpcomingAppointments(patientId) {
    const today = new Date().toISOString().split('T')[0];
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
    if (!CONFIG.DEMO_MODE) supabase.insert('vaccinations', newVax).catch(() => {});
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
  createService(svc) { const s = { id: generateId(), ...svc, is_active: true }; this.data.health_services.push(s); this._save(); if (!CONFIG.DEMO_MODE) supabase.insert('health_services', s).catch(() => {}); return s; }
  updateService(id, updates) { const s = this.data.health_services.find(x => x.id === id); if (s) { Object.assign(s, updates); this._save(); if (!CONFIG.DEMO_MODE) supabase.update('health_services', id, updates).catch(() => {}); } return s; }
  toggleServiceActive(id) { const s = this.data.health_services.find(x => x.id === id); if (s) { s.is_active = !s.is_active; this._save(); if (!CONFIG.DEMO_MODE) supabase.update('health_services', id, { is_active: s.is_active }).catch(() => {}); } }
  deleteService(id) { this.data.health_services = this.data.health_services.filter(x => x.id !== id); this._save(); if (!CONFIG.DEMO_MODE) supabase.delete('health_services', id).catch(() => {}); }

  // Bookings
  createBooking(booking) {
    const b = { id: generateId(), ...booking, status: 'pending', created_at: new Date().toISOString() };
    if (!this.data.bookings) this.data.bookings = [];
    this.data.bookings.push(b);
    const adminUser = this.data.users.find(u => u.role === 'superadmin');
    if (adminUser) this.addNotification(adminUser.id, 'Pendaftaran Layanan Baru', `${booking.patient_name || 'Pasien'} mendaftar: ${booking.item_name || booking.service_name}. Tanggal: ${booking.preferred_date}`, 'system');
    this._save();
    if (!CONFIG.DEMO_MODE) supabase.insert('bookings', b).catch(() => {});
    return b;
  }

  getBookings() { return (this.data.bookings || []).sort((a,b) => b.created_at.localeCompare(a.created_at)); }
  getBookingsByPatient(patientId) { return (this.data.bookings || []).filter(b => b.patient_id === patientId).sort((a,b) => b.created_at.localeCompare(a.created_at)); }
  updateBookingStatus(bookingId, status) { const b = (this.data.bookings || []).find(x => x.id === bookingId); if (b) { b.status = status; this._save(); if (!CONFIG.DEMO_MODE) supabase.update('bookings', bookingId, { status }).catch(() => {}); } }

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
    if (!CONFIG.DEMO_MODE) supabase.insert('notifications', { ...notif, profile_id: userId }).catch(() => {});
  }

  // Doctors list
  getDoctors() { return this.data.doctors; }
  getDoctor(doctorId) { return this.data.doctors.find(d => d.id === doctorId); }
  getDoctorByUserId(userId) { return this.data.doctors.find(d => d.user_id === userId); }

  // Pharmacies list
  getPharmacies() { return this.data.pharmacies; }
  getPharmacy(pharmacyId) { return this.data.pharmacies.find(p => p.id === pharmacyId); }
  getPharmacyByUserId(userId) { return this.data.pharmacies.find(p => p.user_id === userId); }

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
