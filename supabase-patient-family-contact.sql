-- =============================================
-- Pasien: kontak keluarga/wali terstruktur.
-- Penting untuk pasien anak, lansia, atau pasien yang tidak memegang HP sendiri.
--
-- Berbeda dari kolom lama emergency_contact (teks bebas "Nama - Telepon"),
-- kolom ini terpisah supaya bisa ditelepon/di-WA langsung & difilter.
-- Jalankan sekali di Supabase SQL editor (proyek MedConnect).
-- =============================================

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS family_name TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS family_phone TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS family_relation TEXT;

SELECT 'Kolom kontak keluarga pasien siap' as status;
