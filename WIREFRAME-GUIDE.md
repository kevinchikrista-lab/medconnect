# Panduan Wireframe & User Flow
## MedConnect — Platform Kesehatan Digital PWA

---

## 1. Arsitektur Navigasi per Role

### 1.1 Struktur Halaman Global

```
ROOT (/)
├── /login                    ← Halaman login (semua role)
├── /register                 ← Registrasi (hanya pasien)
├── /forgot-password          ← Reset password
│
├── /admin/                   ← SuperAdmin Area
│   ├── /admin/dashboard
│   ├── /admin/users
│   ├── /admin/users/create
│   ├── /admin/services
│   └── /admin/settings
│
├── /doctor/                  ← Dokter Area
│   ├── /doctor/dashboard
│   ├── /doctor/patients
│   ├── /doctor/patients/:id
│   ├── /doctor/emr/:patientId
│   ├── /doctor/emr/:patientId/new
│   ├── /doctor/prescriptions
│   ├── /doctor/prescriptions/new/:recordId
│   ├── /doctor/calendar
│   └── /doctor/telemedicine
│
├── /patient/                 ← Pasien Area
│   ├── /patient/dashboard
│   ├── /patient/schedule
│   ├── /patient/history
│   ├── /patient/history/:visitId
│   ├── /patient/prescriptions
│   ├── /patient/services
│   ├── /patient/services/:id
│   ├── /patient/profile
│   └── /patient/notifications
│
└── /pharmacy/                ← Apotek Area
    ├── /pharmacy/dashboard
    ├── /pharmacy/prescriptions
    ├── /pharmacy/prescriptions/:id
    ├── /pharmacy/inventory
    └── /pharmacy/settings
```

---

## 2. Wireframe — Halaman Autentikasi

### 2.1 Halaman Login (`/login`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │              [Logo MedConnect]                      │    │
│  │          "Platform Kesehatan Digital"                │    │
│  │                                                     │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  📧 Alamat Email                              │  │    │
│  │  │  ┌─────────────────────────────────────────┐  │  │    │
│  │  │  │ email@contoh.com                        │  │  │    │
│  │  │  └─────────────────────────────────────────┘  │  │    │
│  │  │                                               │  │    │
│  │  │  🔒 Password              [Lupa password?]    │  │    │
│  │  │  ┌─────────────────────────────────────────┐  │  │    │
│  │  │  │ ••••••••••            [👁 show/hide]    │  │  │    │
│  │  │  └─────────────────────────────────────────┘  │  │    │
│  │  │                                               │  │    │
│  │  │  ☐ Ingat saya                                 │  │    │
│  │  │                                               │  │    │
│  │  │  ┌─────────────────────────────────────────┐  │  │    │
│  │  │  │         ▶ MASUK KE AKUN                 │  │  │    │
│  │  │  └─────────────────────────────────────────┘  │  │    │
│  │  │                                               │  │    │
│  │  │  Belum punya akun? [Daftar sekarang]          │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  © 2026 MedConnect. All rights reserved.                    │
└─────────────────────────────────────────────────────────────┘

Catatan Desain:
- Background: gradient biru-teal subtle + pattern medis halus
- Card login: glassmorphism (backdrop-blur, border semi-transparan)
- Tombol Masuk: gradient primary, hover scale + shadow
- Responsive: card centered, max-width 420px
- Setelah login, redirect otomatis ke dashboard sesuai role
```

### 2.2 Halaman Register (`/register`) — Khusus Pasien

```
┌─────────────────────────────────────────────────────────────┐
│                   [Logo MedConnect]                          │
│               "Daftar Akun Pasien Baru"                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  ── Data Pribadi ──────────────────────────────     │    │
│  │                                                     │    │
│  │  Nama Lengkap*        NIK (16 digit)*              │    │
│  │  ┌──────────────┐     ┌──────────────────────┐     │    │
│  │  │              │     │                      │     │    │
│  │  └──────────────┘     └──────────────────────┘     │    │
│  │                                                     │    │
│  │  Tanggal Lahir*       Jenis Kelamin*               │    │
│  │  ┌──────────────┐     ┌──────────────────────┐     │    │
│  │  │ dd/mm/yyyy   │     │ ▼ Pilih             │     │    │
│  │  └──────────────┘     └──────────────────────┘     │    │
│  │                                                     │    │
│  │  No. Telepon*          Golongan Darah               │    │
│  │  ┌──────────────┐     ┌──────────────────────┐     │    │
│  │  │ +62          │     │ ▼ A/B/AB/O          │     │    │
│  │  └──────────────┘     └──────────────────────┘     │    │
│  │                                                     │    │
│  │  Alamat Lengkap*                                    │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │                                          │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  │                                                     │    │
│  │  Riwayat Alergi (opsional)                          │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │                                          │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  │                                                     │    │
│  │  ── Akun ──────────────────────────────────        │    │
│  │                                                     │    │
│  │  Email*                                             │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │                                          │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  │                                                     │    │
│  │  Password*             Konfirmasi Password*         │    │
│  │  ┌──────────────┐     ┌──────────────────────┐     │    │
│  │  │ Min 8 char   │     │                      │     │    │
│  │  └──────────────┘     └──────────────────────┘     │    │
│  │  ✓ Huruf besar ✗ Angka ✗ Min 8 karakter           │    │
│  │                                                     │    │
│  │  ☐ Saya menyetujui Syarat & Ketentuan              │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐      │    │
│  │  │          ▶ DAFTAR SEKARANG                │      │    │
│  │  └──────────────────────────────────────────┘      │    │
│  │                                                     │    │
│  │  Sudah punya akun? [Masuk di sini]                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Wireframe — Dashboard Dokter (Desktop/Tablet)

### 3.1 Layout Utama Dokter

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  MedConnect            🔔 3   👤 dr. Kevin  ▼               │
│ │  [Logo]  │                              Notifikasi  Profil              │
│ └──────────┘                                                              │
├────────────┬────────────────────────────────────────────────────────────────┤
│            │                                                               │
│  SIDEBAR   │   MAIN CONTENT AREA                                          │
│            │                                                               │
│ ┌────────┐ │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│ │🏠      │ │   │ 📋 24   │ │ ⏳ 8    │ │ ✅ 16   │ │ 💊 12   │          │
│ │Dashboard│ │   │ Pasien  │ │ Antrean │ │ Selesai │ │ Resep   │          │
│ ├────────┤ │   │ Hari Ini│ │ Aktif   │ │ Hari Ini│ │ Terkirim│          │
│ │👥      │ │   └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│ │Pasien  │ │                                                               │
│ ├────────┤ │   ┌──────────────────────┐ ┌──────────────────────────┐      │
│ │📋      │ │   │ ANTREAN PASIEN       │ │ JADWAL HARI INI          │      │
│ │Rekam   │ │   │                      │ │                          │      │
│ │Medis   │ │   │ #1 Budi Santoso      │ │ 08:00 ░░░░░░░ Konsul    │      │
│ ├────────┤ │   │    Demam, batuk       │ │ 08:30 ████████ Budi S.  │      │
│ │💊      │ │   │    [Mulai Konsultasi] │ │ 09:00 ████████ Sari A.  │      │
│ │E-Resep │ │   │                      │ │ 09:30 ░░░░░░░ Kosong    │      │
│ ├────────┤ │   │ #2 Sari Aminah       │ │ 10:00 ████████ Rina D.  │      │
│ │📅      │ │   │    Kontrol diabetes   │ │ 10:30 ░░░░░░░ Kosong    │      │
│ │Kalender│ │   │    [Mulai Konsultasi] │ │ 11:00 ████████ Vaksin   │      │
│ ├────────┤ │   │                      │ │                          │      │
│ │📹      │ │   │ #3 Rina Dewi         │ │ ──── Istirahat ────     │      │
│ │Tele-   │ │   │    Vaksinasi HPV #2   │ │                          │      │
│ │medicine│ │   │    [Mulai Konsultasi] │ │ 14:00 ████████ Ahmad    │      │
│ ├────────┤ │   │                      │ │ 14:30 ░░░░░░░ Kosong    │      │
│ │⚙️     │ │   │ #4 Ahmad Fauzi       │ │ 15:00 ████████ Konsul   │      │
│ │Setting │ │   │    Sakit kepala       │ │                          │      │
│ └────────┘ │   │    [Mulai Konsultasi] │ │                          │      │
│            │   └──────────────────────┘ └──────────────────────────┘      │
│            │                                                               │
│  ┌──────┐  │   ┌───────────────────────────────────────────────────┐      │
│  │Logout│  │   │ KONTROL ULANG MENDATANG                           │      │
│  └──────┘  │   │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │      │
│            │   │ │30/6 │ │ 1/7 │ │ 2/7 │ │ 3/7 │ │ 5/7 │        │      │
│            │   │ │2 org│ │1 org│ │3 org│ │2 org│ │1 org│        │      │
│            │   │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │      │
│            │   └───────────────────────────────────────────────────┘      │
└────────────┴────────────────────────────────────────────────────────────────┘

Catatan:
- Sidebar: fixed, collapsible (icon-only mode untuk layar lebih kecil)
- Stats cards: 4 kolom di desktop, 2 kolom di tablet
- Antrean & Jadwal: side-by-side di desktop, stacked di tablet
- Warna: █ = slot terisi (teal), ░ = slot kosong (gray)
```

### 3.2 Halaman EMR — Input Rekam Medis (`/doctor/emr/:patientId/new`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  📋 Rekam Medis Baru                     [Simpan] [Batal]   │
│            │                                                              │
│            │  ┌─ INFO PASIEN ─────────────────────────────────────────┐   │
│            │  │ 👤 Budi Santoso  |  NIK: 317404XXXXXXXX              │   │
│            │  │ L, 45 thn  |  Gol. Darah: O  |  Alergi: Penisilin   │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ VITAL SIGNS ─────────────────────────────────────────┐   │
│            │  │                                                       │   │
│            │  │  TD          Nadi        Suhu        RR        SpO2   │   │
│            │  │  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐  ┌─────┐ │   │
│            │  │  │120/80│   │  80  │   │ 36.5 │   │  18  │  │ 98  │ │   │
│            │  │  └──────┘   └──────┘   └──────┘   └──────┘  └─────┘ │   │
│            │  │  mmHg        x/mnt      °C          x/mnt    %       │   │
│            │  │                                                       │   │
│            │  │  BB           TB                                      │   │
│            │  │  ┌──────┐   ┌──────┐                                 │   │
│            │  │  │  70  │   │ 170  │                                 │   │
│            │  │  └──────┘   └──────┘                                 │   │
│            │  │  kg          cm                                       │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ ANAMNESIS ───────────────────────────────────────────┐   │
│            │  │ Keluhan Utama*                                        │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │ Demam sejak 3 hari yang lalu, disertai batuk   │   │   │
│            │  │ │ berdahak dan pilek...                           │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  │                                                       │   │
│            │  │ Riwayat Penyakit Sekarang                             │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │                                                 │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  │                                                       │   │
│            │  │ Riwayat Penyakit Dahulu     Riwayat Alergi            │   │
│            │  │ ┌───────────────────────┐   ┌───────────────────┐    │   │
│            │  │ │ DM Tipe 2 (2020)      │   │ Penisilin (auto)  │    │   │
│            │  │ └───────────────────────┘   └───────────────────┘    │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ DIAGNOSIS ───────────────────────────────────────────┐   │
│            │  │ Diagnosis Utama*                                      │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │ ISPA (Infeksi Saluran Pernapasan Akut)         │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  │ Diagnosis Sekunder                                    │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │                                                 │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ TERAPI & TINDAKAN ───────────────────────────────────┐   │
│            │  │ Rencana Terapi*                                       │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │ - Terapi simptomatik                           │   │   │
│            │  │ │ - Antibiotik oral 5 hari                       │   │   │
│            │  │ │ - Edukasi istirahat dan hidrasi                │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  │                                                       │   │
│            │  │ ☐ Buat E-Resep untuk kunjungan ini                   │   │
│            │  │                                                       │   │
│            │  │ Jadwal Kontrol Ulang                                  │   │
│            │  │ ┌──────────────┐  ┌──────────────────────────────┐   │   │
│            │  │ │ 05/07/2026   │  │ Evaluasi perbaikan gejala   │   │   │
│            │  │ └──────────────┘  └──────────────────────────────┘   │   │
│            │  │  Tanggal              Catatan kontrol                 │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌──────────────────────────────────┐                       │
│            │  │   💾 SIMPAN REKAM MEDIS           │                       │
│            │  └──────────────────────────────────┘                       │
└────────────┴──────────────────────────────────────────────────────────────┘
```

### 3.3 Halaman E-Resep (`/doctor/prescriptions/new/:recordId`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  💊 Buat E-Resep                         [Kirim] [Batal]    │
│            │                                                              │
│            │  ┌─ HEADER RESEP (Auto-fill) ────────────────────────────┐   │
│            │  │ Dokter: dr. Kevin Chikrista    SIP: 44XXXXXXXX        │   │
│            │  │ Pasien: Budi Santoso           Tanggal: 28/06/2026    │   │
│            │  │ Diagnosis: ISPA                                       │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ DAFTAR OBAT ─────────────────────────────────────────┐   │
│            │  │                                                       │   │
│            │  │  R/ 1                                    [🗑 Hapus]   │   │
│            │  │  ┌────────────────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │   │
│            │  │  │ Amoxicillin    │ │500mg │ │ 15   │ │ Kapsul   │   │   │
│            │  │  └────────────────┘ └──────┘ └──────┘ └──────────┘   │   │
│            │  │   Nama Obat          Dosis    Jumlah    Satuan        │   │
│            │  │                                                       │   │
│            │  │  Signa: ┌─────────────────────────────────────────┐   │   │
│            │  │         │ 3 x 1  ▼ │ Sesudah makan  ▼ │         │   │   │
│            │  │         └─────────────────────────────────────────┘   │   │
│            │  │  Durasi: ┌─────┐ hari                                │   │
│            │  │          │  5  │                                      │   │
│            │  │          └─────┘                                      │   │
│            │  │                                                       │   │
│            │  │  ─────────────────────────────────────────────────    │   │
│            │  │                                                       │   │
│            │  │  R/ 2                                    [🗑 Hapus]   │   │
│            │  │  ┌────────────────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │   │
│            │  │  │ Paracetamol    │ │500mg │ │ 10   │ │ Tablet   │   │   │
│            │  │  └────────────────┘ └──────┘ └──────┘ └──────────┘   │   │
│            │  │                                                       │   │
│            │  │  Signa: │ 3 x 1  ▼ │ Bila perlu (prn) ▼ │           │   │
│            │  │                                                       │   │
│            │  │  ─────────────────────────────────────────────────    │   │
│            │  │                                                       │   │
│            │  │  [＋ Tambah Obat]                                     │   │
│            │  │                                                       │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ KETERANGAN KHUSUS ───────────────────────────────────┐   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │ Pasien alergi Penisilin - gunakan Amoxicillin  │   │   │
│            │  │ │ dengan monitoring. Hubungi jika ada reaksi.    │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                              │
│            │  ┌─ KIRIM KE APOTEK ─────────────────────────────────────┐   │
│            │  │ Pilih Apotek Mitra:                                   │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │ ▼ Apotek Sehat Farma - Jl. Merdeka No. 10     │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  │                                                       │   │
│            │  │ ┌─────────────────────────────────────────────────┐   │   │
│            │  │ │          📤 KIRIM E-RESEP KE APOTEK             │   │   │
│            │  │ └─────────────────────────────────────────────────┘   │   │
│            │  └───────────────────────────────────────────────────────┘   │
└────────────┴──────────────────────────────────────────────────────────────┘
```

### 3.4 Kalender Dokter (`/doctor/calendar`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  📅 Kalender & Jadwal                                       │
│            │                                                              │
│            │  ◀ Juni 2026 ▶          [Bulan] [Minggu] [Hari]             │
│            │                                                              │
│            │  ┌────┬────┬────┬────┬────┬────┬────┐                       │
│            │  │ Sen│ Sel│ Rab│ Kam│ Jum│ Sab│ Min│                       │
│            │  ├────┼────┼────┼────┼────┼────┼────┤                       │
│            │  │  1 │  2 │  3 │  4 │  5 │  6 │  7 │                       │
│            │  │    │ •  │ •• │    │ •  │    │    │                       │
│            │  ├────┼────┼────┼────┼────┼────┼────┤                       │
│            │  │  8 │  9 │ 10 │ 11 │ 12 │ 13 │ 14 │                       │
│            │  │ •  │    │ •••│ •  │ •  │    │    │                       │
│            │  ├────┼────┼────┼────┼────┼────┼────┤                       │
│            │  │...                                │                       │
│            │  ├────┼────┼────┼────┼────┼────┼────┤                       │
│            │  │ 28 │ 29 │ 30 │    │    │    │    │                       │
│            │  │████│ •  │ •  │    │    │    │    │                       │
│            │  └────┴────┴────┴────┴────┴────┴────┘                       │
│            │   ████ = Hari ini    • = Ada jadwal (jumlah dot = density)   │
│            │                                                              │
│            │  ┌─ JADWAL 28 JUNI 2026 ─────────────────────────────────┐   │
│            │  │                                                       │   │
│            │  │  🏥 Konsultasi                                        │   │
│            │  │  ├── 08:30  Budi Santoso — Keluhan demam             │   │
│            │  │  ├── 09:00  Sari Aminah — Kontrol diabetes           │   │
│            │  │  ├── 10:00  Rina Dewi — Follow-up hipertensi         │   │
│            │  │  └── 14:00  Ahmad Fauzi — Konsultasi baru            │   │
│            │  │                                                       │   │
│            │  │  💉 Vaksinasi                                         │   │
│            │  │  ├── 11:00  Rina Dewi — HPV Dosis 2                  │   │
│            │  │  └── 15:00  Maya Sari — Influenza Annual             │   │
│            │  │                                                       │   │
│            │  │  🔄 Kontrol Ulang Dijadwalkan                         │   │
│            │  │  ├── 30/06  Budi Santoso — Evaluasi ISPA             │   │
│            │  │  ├── 01/07  Sari Aminah — Cek HbA1c                  │   │
│            │  │  └── 05/07  Ahmad Fauzi — Follow-up                  │   │
│            │  │                                                       │   │
│            │  └───────────────────────────────────────────────────────┘   │
└────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 4. Wireframe — Dashboard Pasien (Mobile-First)

### 4.1 Layout Utama Pasien (Mobile)

```
┌──────────────────────────────┐
│  MedConnect     🔔 2    👤   │
├──────────────────────────────┤
│                              │
│  Halo, Budi! 👋              │
│  Semoga hari Anda sehat.     │
│                              │
│  ┌──────────────────────────┐│
│  │ 📅 JADWAL TERDEKAT       ││
│  │                          ││
│  │ Kontrol Ulang            ││
│  │ dr. Kevin Chikrista      ││
│  │ 30 Juni 2026, 09:00      ││
│  │                          ││
│  │ ⏰ 2 hari lagi           ││
│  │                          ││
│  │ 💉 Vaksin HPV Dosis 3    ││
│  │ 15 Juli 2026             ││
│  │ ⏰ 17 hari lagi          ││
│  └──────────────────────────┘│
│                              │
│  ┌──────────────────────────┐│
│  │ 💊 STATUS RESEP          ││
│  │                          ││
│  │ Resep #R-2026-0142       ││
│  │ dr. Kevin — 28/06/2026   ││
│  │                          ││
│  │ ●───●───◉───○───○       ││
│  │ Kirim Terima Siapkan     ││
│  │               Ambil Done ││
│  │                          ││
│  │ Status: Sedang Disiapkan ││
│  │ Apotek: Sehat Farma      ││
│  └──────────────────────────┘│
│                              │
│  ── Layanan Untuk Anda ──    │
│                              │
│  ┌────────┐ ┌────────┐      │
│  │ 🖼️    │ │ 🖼️    │      │
│  │Vaksin  │ │Infus   │      │
│  │asi     │ │Vitamin │      │
│  │        │ │        │      │
│  │Rp150rb │ │Rp250rb │      │
│  └────────┘ └────────┘      │
│  ┌────────┐ ┌────────┐      │
│  │ 🖼️    │ │ 🖼️    │      │
│  │Medical │ │Home    │      │
│  │Checkup │ │Care    │      │
│  │        │ │        │      │
│  │Rp500rb │ │Rp350rb │      │
│  └────────┘ └────────┘      │
│                              │
├──────────────────────────────┤
│  🏠    📋    💊    👤       │
│ Home  Riwayat Resep Profil  │
└──────────────────────────────┘

Catatan:
- Bottom navigation: 4 tab utama
- Card-based layout, scroll vertikal
- Status resep: progress stepper visual
- Layanan: grid 2 kolom dengan gambar
- Pull-to-refresh untuk update data
```

### 4.2 Riwayat Kunjungan Pasien (`/patient/history`)

```
┌──────────────────────────────┐
│  ◀ Riwayat Kunjungan         │
├──────────────────────────────┤
│                              │
│  ┌─ FILTER ────────────────┐ │
│  │ [Semua] [Konsultasi]    │ │
│  │ [Vaksinasi] [Lainnya]   │ │
│  └─────────────────────────┘ │
│                              │
│  ── Juni 2026 ──             │
│                              │
│  ┌──────────────────────────┐│
│  │ 📋 28 Jun 2026           ││
│  │ dr. Kevin Chikrista      ││
│  │ Diagnosis: ISPA          ││
│  │ 💊 Resep: 2 item         ││
│  │ 🔄 Kontrol: 30 Jun       ││
│  │                    [ > ] ││
│  └──────────────────────────┘│
│                              │
│  ┌──────────────────────────┐│
│  │ 💉 15 Jun 2026           ││
│  │ dr. Kevin Chikrista      ││
│  │ Vaksin: HPV Dosis 2/3    ││
│  │ ✅ Completed              ││
│  │ Next: Dosis 3 — 15 Jul   ││
│  │                    [ > ] ││
│  └──────────────────────────┘│
│                              │
│  ── Mei 2026 ──              │
│                              │
│  ┌──────────────────────────┐│
│  │ 📋 10 Mei 2026           ││
│  │ dr. Sarah Putri          ││
│  │ Diagnosis: Gastritis     ││
│  │ 💊 Resep: 3 item         ││
│  │ ✅ Selesai                ││
│  │                    [ > ] ││
│  └──────────────────────────┘│
│                              │
│  [Muat lebih banyak...]      │
│                              │
├──────────────────────────────┤
│  🏠    📋    💊    👤       │
│ Home  Riwayat Resep Profil  │
└──────────────────────────────┘
```

### 4.3 Kartu Vaksinasi Digital (`/patient/history` — Detail Vaksin)

```
┌──────────────────────────────┐
│  ◀ Kartu Vaksinasi Digital   │
├──────────────────────────────┤
│                              │
│  ┌──────────────────────────┐│
│  │  👤 Budi Santoso          ││
│  │  NIK: 31740XXXXXXXXXX    ││
│  │  TTL: 15/03/1981         ││
│  └──────────────────────────┘│
│                              │
│  ── HPV (Human Papilloma) ── │
│                              │
│  ┌──────────────────────────┐│
│  │ Dosis 1 ✅                ││
│  │ 15 Maret 2026            ││
│  │ Gardasil 9               ││
│  │ Batch: GRD9-2026-A1      ││
│  │ dr. Kevin Chikrista      ││
│  ├──────────────────────────┤│
│  │ Dosis 2 ✅                ││
│  │ 15 Juni 2026             ││
│  │ Gardasil 9               ││
│  │ Batch: GRD9-2026-B3      ││
│  │ dr. Kevin Chikrista      ││
│  ├──────────────────────────┤│
│  │ Dosis 3 ⏳ TERJADWAL     ││
│  │ 15 Juli 2026             ││
│  │ ⏰ 17 hari lagi          ││
│  │                          ││
│  │ [Lihat Detail Jadwal]    ││
│  └──────────────────────────┘│
│                              │
│  ── Influenza ──             │
│                              │
│  ┌──────────────────────────┐│
│  │ Annual ✅                 ││
│  │ 10 Januari 2026          ││
│  │ Influvac Tetra           ││
│  │ Next: Januari 2027       ││
│  └──────────────────────────┘│
│                              │
├──────────────────────────────┤
│  🏠    📋    💊    👤       │
│ Home  Riwayat Resep Profil  │
└──────────────────────────────┘

Catatan:
- Mirip konsep tracking dosis dari primuni.id
- Progress visual per vaksin
- ✅ = selesai, ⏳ = terjadwal, ○ = belum
- Batch number untuk traceability
```

---

## 5. Wireframe — Dashboard Apotek Mitra

### 5.1 Dashboard Utama Apotek

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Apotek Sehat Farma — MedConnect           🔔 5    👤 Apoteker  ▼ │
├────────────┬────────────────────────────────────────────────────────────────┤
│            │                                                               │
│  SIDEBAR   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│            │  │ 📥 5    │ │ ⏳ 3    │ │ ✅ 12   │ │ ⚠️ 2   │           │
│ ┌────────┐ │  │ Resep   │ │ Sedang  │ │ Selesai │ │ Stok    │           │
│ │🏠      │ │  │ Masuk   │ │ Proses  │ │ Hari Ini│ │ Rendah  │           │
│ │Dashbrd │ │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│ ├────────┤ │                                                               │
│ │📥      │ │  ┌─ RESEP MASUK (Real-time) ─────────────────────────────┐   │
│ │E-Resep │ │  │                                                       │   │
│ ├────────┤ │  │  🔴 BARU  R-2026-0145         5 menit lalu            │   │
│ │📦      │ │  │  Pasien: Ahmad Fauzi                                  │   │
│ │Inventori│ │  │  Dokter: dr. Kevin Chikrista                          │   │
│ ├────────┤ │  │  Obat: 3 item                                         │   │
│ │⚙️     │ │  │  ┌──────────┐ ┌──────────┐                            │   │
│ │Setting │ │  │  │ ✅ Terima │ │ ❌ Tolak  │                            │   │
│ └────────┘ │  │  └──────────┘ └──────────┘                            │   │
│            │  │                                                       │   │
│            │  │  🟡 PROSES R-2026-0144        30 menit lalu            │   │
│            │  │  Pasien: Rina Dewi                                     │   │
│            │  │  Dokter: dr. Kevin Chikrista                           │   │
│            │  │  Obat: 2 item                                         │   │
│            │  │  Status: Sedang Disiapkan                              │   │
│            │  │  ┌──────────────────┐ ┌─────────────────┐             │   │
│            │  │  │ ✅ Siap Diambil   │ │ 🚚 Kirim        │             │   │
│            │  │  └──────────────────┘ └─────────────────┘             │   │
│            │  │                                                       │   │
│            │  │  🟢 SIAP  R-2026-0143         1 jam lalu              │   │
│            │  │  Pasien: Budi Santoso                                  │   │
│            │  │  Status: Siap Diambil                                  │   │
│            │  │  ┌──────────────────┐                                 │   │
│            │  │  │ ✅ Selesai        │                                 │   │
│            │  │  └──────────────────┘                                 │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                               │
│            │  ┌─ ALERT STOK RENDAH ───────────────────────────────────┐   │
│            │  │ ⚠️ Amoxicillin 500mg — Sisa: 12 kapsul (min: 50)    │   │
│            │  │ ⚠️ Omeprazole 20mg — Sisa: 8 tablet (min: 30)       │   │
│            │  └───────────────────────────────────────────────────────┘   │
└────────────┴────────────────────────────────────────────────────────────────┘
```

### 5.2 Detail E-Resep Masuk

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  📥 Detail Resep #R-2026-0145                                │
│            │                                                               │
│            │  ┌─ INFO RESEP ──────────────────────────────────────────┐    │
│            │  │ Dokter  : dr. Kevin Chikrista (SIP: 44XXXXXXXX)      │    │
│            │  │ Pasien  : Ahmad Fauzi                                 │    │
│            │  │ Tanggal : 28 Juni 2026, 14:30                        │    │
│            │  │ Diagnosis: Gastritis Akut                             │    │
│            │  └───────────────────────────────────────────────────────┘    │
│            │                                                               │
│            │  ┌─ DAFTAR OBAT ─────────────────────────────────────────┐    │
│            │  │                                                       │    │
│            │  │  # │ Nama Obat        │ Dosis  │ Jml │ Signa         │    │
│            │  │ ───┼──────────────────┼────────┼─────┼───────────────│    │
│            │  │  1 │ Omeprazole       │ 20mg   │ 14  │ 2x1 AC       │    │
│            │  │    │ ✅ Stok: 48                                      │    │
│            │  │ ───┼──────────────────┼────────┼─────┼───────────────│    │
│            │  │  2 │ Sucralfate Syr   │ 500mg  │  3  │ 3x1 AC       │    │
│            │  │    │ ✅ Stok: 15                                      │    │
│            │  │ ───┼──────────────────┼────────┼─────┼───────────────│    │
│            │  │  3 │ Domperidone      │ 10mg   │ 10  │ 3x1 AC       │    │
│            │  │    │ ⚠️ Stok: 8 (kurang 2)                           │    │
│            │  │                                                       │    │
│            │  │  AC = Ante Cibum (Sebelum Makan)                     │    │
│            │  └───────────────────────────────────────────────────────┘    │
│            │                                                               │
│            │  ┌─ KETERANGAN DOKTER ───────────────────────────────────┐    │
│            │  │ Pasien ada riwayat alergi NSAID. Jangan ganti        │    │
│            │  │ dengan obat yang mengandung aspirin.                  │    │
│            │  └───────────────────────────────────────────────────────┘    │
│            │                                                               │
│            │  ┌─ AKSI ────────────────────────────────────────────────┐    │
│            │  │                                                       │    │
│            │  │  ┌──────────────┐  ┌──────────────────────────────┐  │    │
│            │  │  │  ✅ TERIMA    │  │  ❌ TOLAK (+ Alasan/Subst.)  │  │    │
│            │  │  └──────────────┘  └──────────────────────────────┘  │    │
│            │  │                                                       │    │
│            │  │  ⚠️ Domperidone stok kurang 2 tablet.                │    │
│            │  │  Saran: Terima parsial atau hubungi dokter.          │    │
│            │  └───────────────────────────────────────────────────────┘    │
└────────────┴────────────────────────────────────────────────────────────────┘
```

---

## 6. Wireframe — Dashboard SuperAdmin

### 6.1 Dashboard & Manajemen User

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo]  MedConnect — SuperAdmin                   🔔    👤 SuperAdmin  ▼  │
├────────────┬────────────────────────────────────────────────────────────────┤
│            │                                                               │
│  SIDEBAR   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│            │  │ 👥 156  │ │ 🩺 12   │ │ 💊 5    │ │ 📋 1.2K │           │
│ ┌────────┐ │  │ Total   │ │ Dokter  │ │ Apotek  │ │ Kunjung-│           │
│ │🏠      │ │  │ Pasien  │ │ Aktif   │ │ Mitra   │ │ an/bln  │           │
│ │Dashbrd │ │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│ ├────────┤ │                                                               │
│ │👥      │ │  ┌─ MANAJEMEN USER ──────────────────────────────────────┐   │
│ │Users   │ │  │                                                       │   │
│ ├────────┤ │  │  [Semua] [Dokter] [Pasien] [Apotek]    [＋ Tambah User│   │
│ │🏥      │ │  │                                                       │   │
│ │Layanan │ │  │  🔍 Cari nama, email, atau NIK...                     │   │
│ ├────────┤ │  │                                                       │   │
│ │📅      │ │  │  ┌────┬────────────┬──────────┬────────┬──────┬────┐ │   │
│ │Jadwal  │ │  │  │Role│ Nama       │ Email    │ Telp   │Status│Aksi│ │   │
│ ├────────┤ │  │  ├────┼────────────┼──────────┼────────┼──────┼────┤ │   │
│ │⚙️     │ │  │  │ 🩺 │dr. Kevin C.│kevin@... │08123...│ ✅   │ ⚙  │ │   │
│ │Setting │ │  │  │ 🩺 │dr. Sarah P.│sarah@... │08234...│ ✅   │ ⚙  │ │   │
│ └────────┘ │  │  │ 👤 │Budi S.     │budi@...  │08345...│ ✅   │ ⚙  │ │   │
│            │  │  │ 👤 │Sari A.     │sari@...  │08456...│ ✅   │ ⚙  │ │   │
│            │  │  │ 💊 │Apt. Sehat  │apt@...   │08567...│ ✅   │ ⚙  │ │   │
│            │  │  │ 👤 │Ahmad F.    │ahmad@... │08678...│ ⛔   │ ⚙  │ │   │
│            │  │  └────┴────────────┴──────────┴────────┴──────┴────┘ │   │
│            │  │                                                       │   │
│            │  │  ◀ 1 2 3 ... 10 ▶         Menampilkan 1-10 dari 173  │   │
│            │  └───────────────────────────────────────────────────────┘   │
│            │                                                               │
│            │  ⚙ Aksi per user:                                            │
│            │  • Edit data profil & ganti email                            │
│            │  • Kirim link reset password (TIDAK bisa set password)       │
│            │  • Aktifkan / Nonaktifkan akun                               │
│            │  • Lihat log aktivitas user                                  │
└────────────┴────────────────────────────────────────────────────────────────┘
```

---

## 7. User Flow Diagrams

### 7.1 Flow Utama: Konsultasi → E-Resep → Apotek

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  PASIEN  │     │  DOKTER  │     │  SISTEM  │     │  APOTEK  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ Datang/Daftar  │                │                │
     │───────────────►│                │                │
     │                │ Buka EMR       │                │
     │                │───────────────►│                │
     │                │                │                │
     │                │ Input Anamnesis│                │
     │                │ + Diagnosis    │                │
     │                │ + Terapi       │                │
     │                │───────────────►│ Simpan Rekam   │
     │                │                │ Medis          │
     │                │                │                │
     │                │ Buat E-Resep   │                │
     │                │ + Pilih Apotek │                │
     │                │───────────────►│ Routing Resep  │
     │                │                │───────────────►│
     │                │                │                │ Terima Resep
     │                │                │                │
     │                │                │  Notifikasi    │
     │◄───────────────│────────────────│────────────────│ "Resep Diterima"
     │                │                │                │
     │                │                │                │ Proses Obat
     │                │                │                │
     │◄───────────────│────────────────│────────────────│ "Siap Diambil"
     │                │                │                │
     │ Ambil Obat     │                │                │
     │───────────────►│────────────────│───────────────►│
     │                │                │                │ Tandai Selesai
     │                │                │                │
     │◄───────────────│────────────────│────────────────│ "Selesai"
     │                │                │                │
     ▼                ▼                ▼                ▼
```

### 7.2 Flow Autentikasi

```
                    ┌─────────────┐
                    │ Buka Aplikasi│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Sudah Login?│
                    └──────┬──────┘
                    Ya/    │    \Tidak
                   /       │     \
          ┌───────▼──┐     │  ┌──▼───────────┐
          │Redirect ke│     │  │Halaman Login │
          │Dashboard  │     │  └──┬───────────┘
          │sesuai Role│     │     │
          └───────────┘     │     ├── Email + Password
                           │     │
                           │  ┌──▼───────────┐
                           │  │ Validasi     │
                           │  └──┬───────────┘
                           │     │
                    ┌──────▼─────┐
                    │ Cek Role   │
                    └──┬─┬─┬─┬──┘
           ┌───────────┘ │ │ └───────────┐
           ▼             ▼ ▼             ▼
     ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
     │SuperAdmin│ │ Dokter  │ │ Pasien   │ │ Apotek   │
     │Dashboard │ │Dashboard│ │Dashboard │ │Dashboard │
     └──────────┘ └─────────┘ └──────────┘ └──────────┘

     * Dokter & Apotek: akun HARUS dibuat oleh SuperAdmin
     * Pasien: bisa self-register ATAU dibuat SuperAdmin
     * Lupa Password: email → reset link → set baru
```

### 7.3 Flow Vaksinasi (Terinspirasi primuni.id)

```
┌─────────┐                                    ┌─────────┐
│SuperAdmin│                                    │ Dokter  │
│/ Dokter │                                    │         │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ Setup Program Vaksin                         │
     │ (nama, jumlah dosis,                         │
     │  interval antar dosis)                       │
     │                                              │
     ▼                                              │
┌──────────┐    ┌───────────┐    ┌──────────┐      │
│ Pasien   │    │ Jadwal    │    │ Dosis 1  │      │
│ Daftar   │───►│ Vaksinasi │───►│ Diberikan│◄─────┤ Input: batch,
│ Vaksin   │    │ Dibuat    │    │          │      │ tanggal, notes
└──────────┘    └───────────┘    └────┬─────┘      │
                                      │            │
                              Auto-schedule         │
                                      │            │
                                 ┌────▼─────┐      │
                                 │ Reminder │      │
                                 │ Dosis 2  │      │
                                 │ (notif)  │      │
                                 └────┬─────┘      │
                                      │            │
                                 ┌────▼─────┐      │
                                 │ Dosis 2  │      │
                                 │ Diberikan│◄─────┘
                                 └────┬─────┘
                                      │
                                 ...repeat...
                                      │
                                 ┌────▼─────┐
                                 │ LENGKAP  │
                                 │ ✅ Semua  │
                                 │ dosis OK │
                                 └──────────┘
```

---

## 8. Responsive Breakpoints

```
┌──────────────────────────────────────────────────────────────┐
│ BREAKPOINT STRATEGY                                          │
│                                                              │
│ Mobile (< 640px)   → Pasien primary view                    │
│                     Bottom nav, single column                │
│                     Touch-optimized (min tap target 44px)    │
│                                                              │
│ Tablet (640-1024px) → Dokter secondary view                 │
│                      Sidebar collapsed (icon-only)           │
│                      2-column layout                         │
│                                                              │
│ Desktop (> 1024px)  → Dokter & Admin primary view           │
│                      Sidebar expanded                        │
│                      Multi-column layout                     │
│                      Split-pane untuk EMR                    │
│                                                              │
│ Wide (> 1440px)     → Full dashboard dengan side panels     │
│                      3-column layout possible                │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Komponen UI Reusable

| Komponen | Penggunaan |
|---|---|
| **StatCard** | Dashboard semua role — counter dengan ikon dan label |
| **DataTable** | List pasien, user, inventaris — sortable, searchable, paginated |
| **FormInput** | Semua form — dengan label, validation, error message |
| **StatusBadge** | Status resep, status user — warna-coded |
| **ProgressStepper** | Tracking status resep pasien |
| **CalendarGrid** | Kalender dokter — with dot indicators |
| **TimelineItem** | Riwayat kunjungan pasien |
| **DrugInputRow** | Form e-resep — repeatable drug entry |
| **NotificationCard** | Notifikasi semua role |
| **BottomNav** | Navigasi mobile (Pasien) |
| **Sidebar** | Navigasi desktop (Dokter, Admin, Apotek) |
| **Modal/Dialog** | Konfirmasi aksi, detail popup |
| **Toast** | Feedback aksi (sukses, error, warning) |

---

*Dokumen ini menjadi panduan visual untuk implementasi. Setiap wireframe dapat diekspansi menjadi mockup high-fidelity setelah disetujui.*
