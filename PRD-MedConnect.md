# Product Requirement Document (PRD)
## MedConnect — Platform Kesehatan Digital Multi-Role (PWA)

---

**Versi Dokumen:** 1.0  
**Tanggal:** 28 Juni 2026  
**Pemilik Produk:** Kevin Chikrista  
**Referensi Desain:** primuni.id  

---

## 1. Executive Summary

MedConnect adalah Progressive Web App (PWA) kesehatan yang mengintegrasikan 3 ekosistem pengguna — **Dokter**, **Pasien**, dan **Apotek Mitra** — dalam satu platform terpadu dengan antarmuka terisolasi per role. Platform ini menggantikan alur kerja manual klinik menjadi digital: dari registrasi pasien, rekam medis elektronik (EMR), e-resep yang ter-routing otomatis ke apotek, hingga pemantauan status obat secara real-time.

### Mengapa PWA?
| Keunggulan | Penjelasan |
|---|---|
| **Tanpa App Store** | Install langsung dari browser ke home screen |
| **Cross-platform** | Satu codebase untuk Android, iOS, desktop |
| **Offline-capable** | Service worker menyimpan data kritis untuk akses offline |
| **Update instan** | Tidak perlu update via store, langsung dari server |
| **Ringan** | Ukuran install < 5MB vs aplikasi native 50-100MB |

---

## 2. Arsitektur Sistem

### 2.1 Tech Stack yang Direkomendasikan

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (PWA)                        │
│  HTML5 + Tailwind CSS + Vanilla JS (Alpine.js)          │
│  Service Worker + Web App Manifest                       │
│  Responsive: Mobile-first (Pasien) / Desktop (Dokter)   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API / Fetch
┌──────────────────────▼──────────────────────────────────┐
│                   BACKEND (API)                          │
│  Pilihan: Supabase (PostgreSQL + Auth + Realtime)       │
│  ATAU: Firebase (Firestore + Auth + Cloud Functions)    │
│  ATAU: Node.js + Express + PostgreSQL                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   DATABASE                               │
│  PostgreSQL (via Supabase) — RECOMMENDED                │
│  • Relational → cocok untuk data medis terstruktur      │
│  • Row Level Security → isolasi data per role           │
│  • Realtime subscriptions → notifikasi e-resep          │
│  • Skalabel hingga 100.000+ records                     │
│  • HIPAA-compatible dengan konfigurasi tepat            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Rekomendasi Database: Supabase (PostgreSQL)

**Mengapa Supabase untuk proyek ini:**

| Faktor | Supabase (PostgreSQL) | Firebase (Firestore) |
|---|---|---|
| **Struktur data medis** | ✅ Relational, cocok untuk EMR | ⚠️ NoSQL, perlu denormalisasi |
| **Query kompleks** | ✅ SQL penuh, JOIN antar tabel | ⚠️ Terbatas, perlu Cloud Functions |
| **Skalabilitas 100K** | ✅ PostgreSQL proven at scale | ✅ Auto-scale |
| **Realtime** | ✅ Built-in realtime subscriptions | ✅ Built-in |
| **Auth** | ✅ Built-in, email + password + OAuth | ✅ Built-in |
| **Row Level Security** | ✅ Policy-based per role | ⚠️ Security rules (lebih rumit) |
| **Harga untuk 1K-100K user** | ✅ Free tier cukup untuk awal | ⚠️ Bisa mahal di read-heavy |
| **Self-host option** | ✅ Bisa self-host | ❌ Locked to Google |

### 2.3 Skema Database (ERD Konseptual)

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐
│    users      │     │   patients       │     │   doctors     │
├──────────────┤     ├──────────────────┤     ├───────────────┤
│ id (PK)      │     │ id (PK)          │     │ id (PK)       │
│ email        │◄────│ user_id (FK)     │     │ user_id (FK)  │──►│users│
│ password_hash│     │ nik              │     │ sip_number    │
│ role         │     │ full_name        │     │ full_name     │
│ is_active    │     │ birth_date       │     │ specialization│
│ created_at   │     │ gender           │     │ phone         │
│ updated_at   │     │ phone            │     │ schedule_json │
└──────────────┘     │ address          │     │ is_available  │
                     │ blood_type       │     └───────────────┘
                     │ allergies        │
                     │ emergency_contact│            ┌───────────────┐
                     └──────────────────┘            │  pharmacies   │
                                                     ├───────────────┤
┌──────────────────┐     ┌──────────────────┐       │ id (PK)       │
│  medical_records │     │  prescriptions   │       │ user_id (FK)  │
├──────────────────┤     ├──────────────────┤       │ name          │
│ id (PK)          │     │ id (PK)          │       │ address       │
│ patient_id (FK)  │     │ record_id (FK)   │       │ phone         │
│ doctor_id (FK)   │     │ doctor_id (FK)   │       │ license_no    │
│ visit_date       │     │ patient_id (FK)  │       │ operating_hrs │
│ anamnesis        │     │ pharmacy_id (FK) │       └───────────────┘
│ diagnosis        │     │ status           │
│ therapy_plan     │     │ notes            │    ┌──────────────────┐
│ vital_signs_json │     │ created_at       │    │prescription_items│
│ follow_up_date   │     └──────────────────┘    ├──────────────────┤
│ notes            │                              │ id (PK)          │
└──────────────────┘     ┌──────────────────┐    │ prescription_id  │
                         │  appointments    │    │ drug_name        │
┌──────────────────┐     ├──────────────────┤    │ dosage           │
│ vaccinations     │     │ id (PK)          │    │ frequency        │
├──────────────────┤     │ patient_id (FK)  │    │ signa            │
│ id (PK)          │     │ doctor_id (FK)   │    │ duration         │
│ patient_id (FK)  │     │ date             │    │ quantity         │
│ vaccine_name     │     │ time_slot        │    │ instructions     │
│ dose_number      │     │ type (visit/     │    │ is_available     │
│ date_given       │     │   telemedicine)  │    └──────────────────┘
│ next_dose_date   │     │ status           │
│ batch_number     │     │ queue_number     │    ┌──────────────────┐
│ administered_by  │     │ notes            │    │   inventory      │
│ notes            │     └──────────────────┘    ├──────────────────┤
└──────────────────┘                              │ id (PK)          │
                         ┌──────────────────┐    │ pharmacy_id (FK) │
                         │health_services   │    │ drug_name        │
                         ├──────────────────┤    │ stock            │
                         │ id (PK)          │    │ unit             │
                         │ name             │    │ min_stock        │
                         │ description      │    │ expiry_date      │
                         │ category         │    │ updated_at       │
                         │ price            │    └──────────────────┘
                         │ image_url        │
                         │ is_active        │    ┌──────────────────┐
                         └──────────────────┘    │  notifications   │
                                                  ├──────────────────┤
                                                  │ id (PK)          │
                                                  │ user_id (FK)     │
                                                  │ title            │
                                                  │ message          │
                                                  │ type             │
                                                  │ is_read          │
                                                  │ created_at       │
                                                  └──────────────────┘
```

---

## 3. Sistem Autentikasi & Otorisasi

### 3.1 Role Hierarchy

```
SuperAdmin (GOD MODE)
├── Bisa membuat akun Dokter
├── Bisa membuat akun Apotek Mitra
├── Bisa membuat/mengelola akun Pasien
├── Bisa mengganti email akun manapun
├── TIDAK bisa melihat password siapapun (hashed)
└── Mengelola layanan kesehatan & konfigurasi sistem

Dokter (STAFF)
├── Akses penuh ke modul EMR
├── Bisa melihat & mengedit data pasien sendiri
├── Bisa membuat e-resep
├── Bisa melihat jadwal & antrean
└── TIDAK bisa membuat akun baru (kecuali registrasi pasien cepat)

Pasien (END USER)
├── Bisa mendaftar sendiri (self-register)
├── Bisa melihat riwayat kunjungan sendiri
├── Bisa melihat jadwal kontrol
├── Bisa melihat status resep
└── TIDAK bisa mengakses data pasien lain

Apotek Mitra (PARTNER)
├── Menerima e-resep dari dokter
├── Update status pemrosesan resep
├── Manajemen inventaris dasar
└── TIDAK bisa mengakses EMR atau data medis
```

### 3.2 Alur Autentikasi

```
┌─────────────────────────────────────────────────────────────┐
│                    ALUR LOGIN                                │
│                                                              │
│  [Halaman Login] ──► Email + Password                       │
│       │                                                      │
│       ▼                                                      │
│  [Verifikasi Kredensial]                                    │
│       │                                                      │
│       ├── Role = superadmin ──► Dashboard SuperAdmin         │
│       ├── Role = doctor     ──► Dashboard Dokter             │
│       ├── Role = patient    ──► Dashboard Pasien             │
│       └── Role = pharmacy   ──► Dashboard Apotek             │
│                                                              │
│  [Lupa Password] ──► Input Email ──► Kirim Reset Link       │
│                       via Email ──► Set Password Baru        │
│                                                              │
│  [Register] ──► Hanya untuk Pasien (self-register)          │
│               ──► Dokter & Apotek HARUS dibuat SuperAdmin    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Keamanan

- Password di-hash menggunakan bcrypt (tidak pernah disimpan plain text)
- SuperAdmin **tidak bisa** melihat password user lain
- SuperAdmin **bisa** mengganti email user
- SuperAdmin **bisa** mereset password user (kirim link reset, bukan set manual)
- Session menggunakan JWT token dengan expiry
- Rate limiting pada endpoint login (anti brute-force)

---

## 4. Spesifikasi Fitur per Role

### 4.1 DOKTER (Optimasi Tablet/Desktop)

#### 4.1.1 Dashboard Utama
| Elemen | Deskripsi |
|---|---|
| **Header Stats** | Total pasien hari ini, antrean aktif, konsultasi selesai, resep terkirim |
| **Jadwal Hari Ini** | Timeline visual jam praktik dengan slot terisi/kosong |
| **Antrean Pasien** | List pasien menunggu dengan nomor antrean, nama, keluhan singkat |
| **Quick Actions** | Tombol cepat: Pasien Baru, Mulai Konsultasi, Tulis Resep |
| **Notifikasi** | Badge count untuk resep yang perlu ditindaklanjuti |

#### 4.1.2 Manajemen Pasien
| Fitur | Deskripsi |
|---|---|
| **Pencarian Pasien** | Search by nama, NIK, nomor telepon — instant search dengan debounce |
| **Registrasi Pasien Baru** | Form: Nama, NIK, tanggal lahir, gender, telepon, alamat, golongan darah, alergi, kontak darurat |
| **Profil Pasien** | Kartu profil dengan riwayat lengkap: kunjungan, vaksinasi, resep, data vital |
| **Filter & Sort** | Filter berdasarkan tanggal kunjungan terakhir, status aktif/nonaktif |

#### 4.1.3 Rekam Medis Elektronik (EMR)
| Komponen | Detail |
|---|---|
| **Anamnesis** | Textarea rich: keluhan utama, riwayat penyakit sekarang, riwayat penyakit dahulu, riwayat keluarga, riwayat alergi |
| **Pemeriksaan Fisik** | Input terstruktur: tekanan darah, nadi, suhu, respirasi, berat badan, tinggi badan, SpO2 |
| **Diagnosis** | Input dengan autocomplete ICD-10 (opsional), diagnosis utama + sekunder |
| **Terapi/Tindakan** | Textarea: rencana terapi, tindakan yang dilakukan, edukasi pasien |
| **Follow-up** | Date picker: jadwal kontrol berikutnya, catatan untuk kontrol |
| **Riwayat Rekam Medis** | Timeline kronologis semua kunjungan pasien, bisa di-expand per visit |

#### 4.1.4 Kalender & Jadwal
| Fitur | Deskripsi |
|---|---|
| **Kalender Bulanan** | View bulanan dengan dot indicator untuk hari yang ada jadwal |
| **List Harian** | Detail jadwal per hari: konsultasi, vaksinasi, kontrol ulang |
| **Jadwal Vaksinasi Pasien** | List pasien yang perlu vaksin lanjutan dengan tanggal target |
| **Jadwal Kontrol Ulang** | List pasien yang dijadwalkan kontrol ulang |
| **Manajemen Jadwal Praktik** | Set jam praktik per hari, toggle hari libur |

#### 4.1.5 E-Resep (Resep Digital)
| Komponen | Detail |
|---|---|
| **Header Resep** | Auto-fill: nama dokter, SIP, nama pasien, tanggal |
| **Daftar Obat** | Input berulang: nama obat, dosis, jumlah, satuan |
| **Signa** | Dropdown + custom: frekuensi (3x1, 2x1, 1x1), waktu (sebelum/sesudah makan, pagi/siang/malam) |
| **Keterangan Khusus** | Textarea: instruksi khusus untuk apoteker |
| **Pilih Apotek** | Dropdown apotek mitra yang terdaftar |
| **Kirim** | Tombol kirim → resep ter-routing ke apotek mitra secara realtime |
| **Riwayat Resep** | List resep yang sudah dibuat dengan status (dikirim/diproses/selesai) |

#### 4.1.6 Telemedicine (Fase Lanjutan)
| Fitur | Deskripsi |
|---|---|
| **Video Call** | Integrasi WebRTC atau third-party (Daily.co / Jitsi) |
| **Chat** | Real-time chat selama sesi konsultasi |
| **Catatan Sesi** | Form EMR yang bisa diisi selama video call |

---

### 4.2 PASIEN (Mobile-First UI)

#### 4.2.1 Dashboard Utama
| Elemen | Deskripsi |
|---|---|
| **Greeting Card** | "Halo, [Nama]" dengan ringkasan kesehatan |
| **Jadwal Terdekat** | Card: kontrol/vaksinasi berikutnya dengan countdown |
| **Status Resep** | Badge: resep yang sedang diproses |
| **Quick Actions** | Buat janji temu, lihat riwayat, katalog layanan |
| **Notifikasi** | Push notification untuk status resep & pengingat jadwal |

#### 4.2.2 Riwayat & Jadwal
| Fitur | Deskripsi |
|---|---|
| **Jadwal Mendatang** | List jadwal kontrol & vaksinasi dengan tanggal, dokter, lokasi |
| **Riwayat Kunjungan** | Timeline kunjungan: tanggal, dokter, diagnosis ringkas |
| **Detail Kunjungan** | Expand: anamnesis, diagnosis, terapi, resep yang diberikan |
| **Riwayat Vaksinasi** | Kartu vaksin digital: nama vaksin, dosis ke-N, tanggal, dosis berikutnya |

#### 4.2.3 Katalog Layanan Kesehatan
| Fitur | Deskripsi |
|---|---|
| **Etalase Visual** | Grid card dengan gambar, nama layanan, deskripsi singkat, harga |
| **Kategori** | Tab/filter: Vaksinasi, Infus Vitamin, Check-up, Preventif, HomeCare |
| **Detail Layanan** | Halaman detail: deskripsi lengkap, prosedur, durasi, harga, dokter tersedia |
| **Booking** | Tombol "Daftar Layanan" → pilih tanggal & waktu → konfirmasi |

#### 4.2.4 Pemantauan Resep
| Fitur | Deskripsi |
|---|---|
| **List Resep Aktif** | Kartu resep dengan status real-time |
| **Status Tracker** | Progress bar: Dikirim → Diproses → Siap Diambil → Selesai |
| **Detail Resep** | List obat, signa, keterangan dokter |
| **Push Notification** | Notifikasi otomatis saat status berubah |

#### 4.2.5 Profil & Pengaturan
| Fitur | Deskripsi |
|---|---|
| **Data Pribadi** | Lihat & edit (terbatas): nama, telepon, alamat |
| **Data Medis** | Lihat: golongan darah, alergi, riwayat penyakit |
| **Ganti Password** | Form ganti password dengan validasi |

#### 4.2.6 Integrasi Wearable (Fase Lanjutan / Opsional)
| Fitur | Deskripsi |
|---|---|
| **Sync Data** | Koneksi ke Google Fit / Apple Health via Web API |
| **Dashboard Vital** | Grafik: langkah harian, detak jantung, tidur |
| **Share ke Dokter** | Toggle: izinkan dokter melihat data wearable |

---

### 4.3 APOTEK MITRA (Dashboard Operasional)

#### 4.3.1 Dashboard Utama
| Elemen | Deskripsi |
|---|---|
| **Resep Masuk** | Counter real-time resep yang belum diproses |
| **Resep Hari Ini** | Total resep masuk, diproses, selesai |
| **Alert Stok** | Peringatan obat yang stoknya di bawah minimum |
| **Quick Stats** | Grafik ringkas: volume resep mingguan |

#### 4.3.2 Penerimaan E-Resep
| Fitur | Deskripsi |
|---|---|
| **Inbox Resep** | List resep masuk secara real-time, terbaru di atas |
| **Detail Resep** | Nama pasien, nama dokter, list obat + signa + keterangan |
| **Cek Ketersediaan** | Otomatis cross-check dengan inventaris, tandai obat yang habis |
| **Terima/Tolak** | Tombol aksi: Terima (mulai proses) atau Tolak (dengan alasan + saran substitusi) |

#### 4.3.3 Status Pesanan
| Status | Trigger |
|---|---|
| **Resep Diterima** | Saat apotek menekan "Terima" |
| **Sedang Disiapkan** | Saat apotek mulai menyiapkan obat |
| **Siap Diambil** | Obat sudah dikemas, menunggu pasien |
| **Sedang Dikirim** | Jika ada opsi pengiriman |
| **Selesai** | Obat sudah diserahkan ke pasien |

> Setiap perubahan status otomatis memicu **push notification** ke aplikasi pasien.

#### 4.3.4 Manajemen Inventaris Ringkas
| Fitur | Deskripsi |
|---|---|
| **List Obat** | Tabel: nama obat, stok saat ini, satuan, stok minimum, kadaluarsa |
| **Update Stok** | Form cepat untuk menambah/mengurangi stok |
| **Alert** | Notifikasi otomatis jika stok di bawah minimum |
| **Search** | Pencarian obat by nama |

---

### 4.4 SUPERADMIN

#### 4.4.1 Dashboard Utama
| Elemen | Deskripsi |
|---|---|
| **Overview Stats** | Total user per role, total kunjungan bulan ini, total resep |
| **Aktivitas Terbaru** | Log aktivitas: registrasi baru, login, perubahan data |
| **System Health** | Status server, database usage |

#### 4.4.2 Manajemen User
| Fitur | Deskripsi |
|---|---|
| **Buat Akun Dokter** | Form: email, nama lengkap, SIP, spesialisasi, telepon |
| **Buat Akun Apotek** | Form: email, nama apotek, alamat, SIPA, telepon, jam operasional |
| **Buat Akun Pasien** | Form registrasi pasien (sama seperti self-register) |
| **List Semua User** | Tabel dengan filter per role, search, pagination |
| **Edit User** | Ubah email, data profil, toggle aktif/nonaktif |
| **Reset Password** | Kirim link reset password via email (SuperAdmin TIDAK bisa set password langsung) |
| **Nonaktifkan Akun** | Soft-delete: nonaktifkan tanpa menghapus data |

#### 4.4.3 Manajemen Layanan
| Fitur | Deskripsi |
|---|---|
| **CRUD Layanan** | Tambah/edit/hapus layanan kesehatan yang tampil di katalog pasien |
| **Upload Gambar** | Upload gambar layanan untuk etalase |
| **Atur Kategori** | Kelola kategori layanan |

#### 4.4.4 Manajemen Jadwal Dokter
| Fitur | Deskripsi |
|---|---|
| **Atur Jadwal** | Set jadwal praktik dokter per hari |
| **Hari Libur** | Set hari libur/cuti dokter |

---

## 5. Non-Functional Requirements

### 5.1 Performa
| Metrik | Target |
|---|---|
| **First Contentful Paint** | < 1.5 detik |
| **Time to Interactive** | < 3 detik |
| **Lighthouse PWA Score** | > 90 |
| **Database Query** | < 200ms untuk query standar |
| **Concurrent Users** | Support 500 concurrent tanpa degradasi |

### 5.2 Kapasitas Data
| Data | Estimasi |
|---|---|
| **Total Users (target)** | 100.000 |
| **Users awal** | ~1.000 |
| **Rekam medis per pasien** | ~20-50 records/tahun |
| **Resep per hari** | ~50-200 |
| **Storage** | PostgreSQL: mulai dari free tier Supabase (500MB), scale sesuai kebutuhan |

### 5.3 PWA Requirements
- ✅ Web App Manifest (nama, ikon, theme color, start URL)
- ✅ Service Worker (caching strategi: Cache-First untuk asset, Network-First untuk API)
- ✅ HTTPS (wajib untuk PWA)
- ✅ Responsive Design (breakpoints: 320px, 768px, 1024px, 1440px)
- ✅ Installable (Add to Home Screen prompt)
- ✅ Push Notifications (untuk status resep & pengingat jadwal)
- ✅ Offline fallback page

### 5.4 Keamanan
- Semua password di-hash (bcrypt, cost factor 10+)
- HTTPS everywhere
- JWT token dengan expiry (access: 1 jam, refresh: 7 hari)
- Rate limiting: 5 login attempts / 15 menit
- CORS policy: hanya domain yang diizinkan
- Input sanitization (anti XSS & SQL injection)
- Row Level Security di database (per role)

---

## 6. Roadmap & Fase Pengembangan

### Fase 1 — MVP (Minggu 1-4)
- [x] Sistem autentikasi multi-role
- [x] Dashboard SuperAdmin + manajemen user
- [x] Dashboard Dokter: manajemen pasien + EMR dasar
- [x] Dashboard Pasien: riwayat + jadwal
- [x] E-Resep basic (tanpa realtime)
- [x] Dashboard Apotek: terima resep + update status

### Fase 2 — Enhanced (Minggu 5-8)
- [ ] Realtime notifications (push notification)
- [ ] Kalender & jadwal lanjutan
- [ ] Katalog layanan kesehatan
- [ ] Manajemen inventaris apotek
- [ ] Modul vaksinasi dengan tracking dosis
- [ ] Lupa password via email

### Fase 3 — Advanced (Minggu 9-12)
- [ ] Telemedicine (video call)
- [ ] Integrasi wearable
- [ ] Laporan & analytics
- [ ] Multi-klinik support
- [ ] Sistem pembayaran online

---

## 7. Panduan Wireframe & User Flow

> Lihat dokumen terpisah: `WIREFRAME-GUIDE.md`

---

## 8. Catatan Desain (Referensi primuni.id)

### Prinsip Desain yang Diadopsi dari primuni.id:
1. **Warna**: Nuansa biru-teal sebagai primary (kepercayaan medis), aksen hangat untuk CTA
2. **Layout**: Clean, card-based, generous whitespace
3. **Typography**: Sans-serif modern, hierarki jelas antara heading dan body
4. **Navigasi**: Sidebar untuk desktop, bottom nav untuk mobile
5. **Interaksi**: Transisi smooth, feedback visual pada setiap aksi
6. **Futuristik**: Gradient subtle, glassmorphism ringan, micro-interactions

### Perbedaan dengan primuni.id:
1. **Multi-role terisolasi** — primuni.id lebih general, MedConnect punya dashboard terpisah per role
2. **EMR komprehensif** — primuni.id fokus vaksin, MedConnect mencakup seluruh rekam medis
3. **E-Resep ter-routing** — fitur baru yang tidak ada di primuni.id
4. **Apotek Mitra** — role baru dengan dashboard operasional khusus

---

*Dokumen ini adalah living document dan akan diperbarui seiring perkembangan proyek.*
