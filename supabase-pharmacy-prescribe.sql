-- =============================================
-- APOTEK MENULIS RESEP → WAJIB DI-ACC DOKTER.
--
-- Sebagian apotek mitra terbiasa menyiapkan resep lebih dulu (pasien datang
-- membawa keluhan, apoteker menyusun usulannya). Yang TIDAK boleh adalah
-- resep itu berlaku tanpa dokter. Karena itu izinnya dipasang per apotek,
-- dan resep yang lahir dari apotek SELALU menunggu ACC dokter — tidak ada
-- jalan lain untuk membuatnya aktif.
--
--   apotek menyusun  →  menunggu ACC dokter  →  berlaku (masuk antrean)
--                                            ↘  ditolak (beserta alasannya)
--
-- RESEP ULANG mengikuti jalur yang sama persis. Apotek boleh menelusuri resep
-- yang pernah sah lalu mengulangnya, tapi yang disalin hanya DAFTAR OBATNYA:
-- resep ulangnya tetap resep baru yang menunggu ACC. Yang menjadikan sebuah
-- resep sah adalah keputusan dokter hari ini, bukan keputusan dokter tiga
-- bulan lalu — kondisi pasien bisa sudah berbeda. Asal-usulnya disimpan di
-- kolom repeat_of supaya dokter bisa menengok resep aslinya.
--
-- JASA DOKTER ditentukan SAAT ACC (kolom service_fee_enabled & service_fee
-- yang sudah ada), bukan saat apotek menyusun — apotek tidak berhak
-- menetapkannya, dan dokternya baru tahu nilainya setelah membaca resepnya.
--
-- Izin ini MATI secara bawaan (can_prescribe = false). Apotek yang tidak
-- diberi izin tidak melihat menunya sama sekali — bukan sekadar tombolnya
-- dinonaktifkan.
--
-- CATATAN PENTING soal apa yang ditegakkan di mana:
-- kebijakan RLS tabel prescriptions saat ini masih permisif (warisan tahap
-- awal proyek), jadi pembatasan "hanya apotek berizin yang boleh menyusun"
-- ditegakkan di aplikasi. Yang DITEGAKKAN DI SINI adalah hal yang lebih
-- penting: sebuah resep berstatus 'pending' tidak boleh terbaca sebagai resep
-- yang siap dilayani — itu dijaga oleh kolom approval_status dan dipakai di
-- setiap query antrean apotek.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

-- Izin per apotek. Bawaannya mati.
ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS can_prescribe boolean DEFAULT false;

UPDATE public.pharmacies SET can_prescribe = false WHERE can_prescribe IS NULL;

-- Jejak persetujuan pada resepnya.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS approval_status    text DEFAULT 'approved', -- approved | pending | rejected
  ADD COLUMN IF NOT EXISTS approval_doctor_id uuid,                    -- dokter yang harus meng-ACC
  ADD COLUMN IF NOT EXISTS drafted_by_pharmacy uuid,                   -- apotek penyusunnya
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note      text,
  ADD COLUMN IF NOT EXISTS repeat_of          uuid;   -- resep yang diulang

-- Baris lama semuanya ditulis dokter, jadi sah sejak awal. Dibuat eksplisit
-- supaya tidak ada NULL yang harus ditebak artinya oleh query mana pun.
UPDATE public.prescriptions SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Antrean ACC dokter mengambil baris pending miliknya.
CREATE INDEX IF NOT EXISTS idx_prescriptions_pending_acc
  ON public.prescriptions (approval_doctor_id, created_at DESC)
  WHERE approval_status = 'pending';

-- Menelusuri riwayat pengulangan sebuah resep.
CREATE INDEX IF NOT EXISTS idx_prescriptions_repeat_of
  ON public.prescriptions (repeat_of) WHERE repeat_of IS NOT NULL;

-- Antrean apotek: resep yang sudah sah saja.
CREATE INDEX IF NOT EXISTS idx_prescriptions_approved
  ON public.prescriptions (pharmacy_id, status)
  WHERE approval_status = 'approved';

SELECT COALESCE(p.name, '(tanpa nama)')                       AS apotek,
       COALESCE(p.can_prescribe, false)                       AS boleh_menyusun_resep,
       count(rx.id) FILTER (WHERE rx.drafted_by_pharmacy = p.id) AS resep_disusun_apotek,
       count(rx.id) FILTER (WHERE rx.drafted_by_pharmacy = p.id
                              AND rx.approval_status = 'pending')  AS menunggu_acc
FROM public.pharmacies p
LEFT JOIN public.prescriptions rx ON rx.drafted_by_pharmacy = p.id
GROUP BY p.name, p.can_prescribe ORDER BY p.name;
