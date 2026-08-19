-- =============================================================================
-- KODE ICD-10 MILIK KLINIK
--
-- Daftar diagnosis bawaan aplikasi (js/icd10.js) berisi 455 kode pilihan. Itu
-- BUKAN ICD-10 utuh — ICD-10 asli berisi sekitar 14.000 kode. Selalu akan ada
-- yang kurang, dan menambahnya lewat perubahan kode berarti dokter menunggu
-- rilis berikutnya hanya untuk bisa menulis satu diagnosis.
--
-- Tabel ini menampung kode yang ditambahkan sendiri dari layar pencarian
-- diagnosis. Ditambahkan sekali, lalu tersedia untuk seluruh klinik.
--
-- created_by disimpan bukan untuk mengawasi, melainkan karena kode diagnosis
-- ikut dipakai untuk klaim: kalau suatu saat ada kode yang keliru, harus ada
-- cara menelusuri dari mana ia datang.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.icd10_custom (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  name       text,
  name_id    text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Satu kode hanya boleh ada sekali. Dua baris dengan kode sama akan muncul
-- berdampingan di kotak pencarian, dan dokter yang melihatnya akan ragu mana
-- yang benar — keraguan yang tidak perlu ada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_icd10_custom_kode
  ON public.icd10_custom (upper(code));

ALTER TABLE public.icd10_custom ENABLE ROW LEVEL SECURITY;

-- Daftar diagnosis bukan data pasien: seluruh staf perlu membacanya, dan
-- dokter perlu menambahnya. Menghapus tidak diberikan lewat aplikasi —
-- kode yang sudah dipakai di rekam medis lama tidak boleh lenyap dari
-- pencarian, karena rekam medis itu akan kehilangan artinya.
DROP POLICY IF EXISTS "icd_read_staff" ON public.icd10_custom;
CREATE POLICY "icd_read_staff" ON public.icd10_custom
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.auth_id = auth.uid() AND p.role <> 'patient'));

DROP POLICY IF EXISTS "icd_insert_staff" ON public.icd10_custom;
CREATE POLICY "icd_insert_staff" ON public.icd10_custom
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.auth_id = auth.uid()
                        AND p.role IN ('doctor','superadmin','owner')));

-- ---- Pemeriksa ------------------------------------------------------------
-- 1. Tabelnya ada dan kebijakannya terpasang.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'icd10_custom'
ORDER BY policyname;

-- 2. Kode yang sudah ditambahkan klinik (kosong pada pemasangan pertama).
SELECT c.code, c.name_id, p.full_name AS ditambahkan_oleh, c.created_at
FROM public.icd10_custom c
LEFT JOIN public.profiles p ON p.id = c.created_by
ORDER BY c.code;
