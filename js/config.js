export const CONFIG = {
  APP_NAME: 'MedConnect',
  APP_TAGLINE: 'Platform Kesehatan Digital',
  DOMAIN: 'prima.id',

  // Supabase — isi saat siap production
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Mode demo (gunakan mock data lokal)
  DEMO_MODE: true,

  ROLES: {
    SUPERADMIN: 'superadmin',
    DOCTOR: 'doctor',
    PATIENT: 'patient',
    PHARMACY: 'pharmacy',
  },

  PRESCRIPTION_STATUS: {
    SENT: 'sent',
    RECEIVED: 'received',
    PREPARING: 'preparing',
    READY: 'ready',
    DELIVERING: 'delivering',
    COMPLETED: 'completed',
    REJECTED: 'rejected',
  },

  PRESCRIPTION_STATUS_LABELS: {
    sent: 'Dikirim',
    received: 'Diterima',
    preparing: 'Sedang Disiapkan',
    ready: 'Siap Diambil',
    delivering: 'Sedang Dikirim',
    completed: 'Selesai',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
  },

  SIGNA_OPTIONS: [
    '1 x 1', '2 x 1', '3 x 1', '4 x 1',
    '1 x 2', '2 x 2', '3 x 2',
    'Bila perlu (prn)', 'Sesuai petunjuk dokter',
  ],

  SIGNA_TIME: [
    'Sebelum makan (AC)',
    'Sesudah makan (PC)',
    'Pagi',
    'Siang',
    'Malam',
    'Pagi & malam',
    'Sebelum tidur',
  ],

  DRUG_UNITS: ['Tablet', 'Kapsul', 'Botol', 'Tube', 'Ampul', 'Sachet', 'Strip', 'Sendok', 'Puyer', 'Kapsul Racikan'],

  VISIT_TYPES: {
    consultation: 'Konsultasi',
    vaccination: 'Vaksinasi',
    both: 'Konsultasi + Vaksinasi',
  },

  LOCATIONS: [
    'Klinik Utama Prima',
    'Klinik Cabang Kemang',
    'Home Care',
    'Telemedicine',
  ],
};
