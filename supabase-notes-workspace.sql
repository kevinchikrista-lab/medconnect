-- =============================================================================
-- CATATAN BISNIS JADI RUANG KERJA BERSAMA
--
-- Tiga perubahan, dan ketiganya menjawab satu keluhan yang sama: catatan ini
-- hanya bisa dimiliki satu orang, isinya datar, dan yang dibagikan cuma bisa
-- dibaca. Untuk buku catatan pribadi itu cukup; untuk sesuatu yang dikerjakan
-- bertiga, tidak.
--
--   1. HALAMAN BERSARANG (parent_id). Sebelumnya unit usaha -> catatan, dua
--      tingkat dan berhenti. Sekarang catatan bisa punya anak, sedalam apa
--      pun — seperti OneNote/Notion. Isinya TETAP Markdown biasa; yang
--      berubah cuma cara menatanya, bukan cara menyimpannya. Itu disengaja:
--      teks biasa tetap bisa dicari, disalin, dan diselamatkan kalau suatu
--      saat aplikasinya berganti.
--
--   2. BERBAGI YANG BISA MENULIS (shared_edit_with). shared_with sudah ada
--      dan artinya "boleh membaca". Yang baru adalah daftar kedua: siapa yang
--      juga boleh MENULIS. Dipisah, bukan digabung jadi satu daftar dengan
--      tingkatan, karena rekapan keuangan dan catatan rapat memang pantas
--      dibagikan dengan cara yang berbeda — dan pemiliknya yang memilih.
--
--   3. SIAPA YANG BOLEH PUNYA CATATAN (profiles.can_notes). Sebelumnya
--      dipaku ke satu alamat e-mail di dalam kode (CONFIG.NOTES_MANAGER_
--      EMAILS). Menambah Anis dan Fitri berarti mengubah kode dan menerbitkan
--      ulang aplikasinya — itu bukan cara mengelola orang. Sekarang jadi
--      saklar per akun yang dinyalakan dari Manajemen User.
--
-- Prasyarat: supabase-business-notes.sql dan supabase-business-notes-sharing.sql
-- sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Halaman bersarang
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_notes
  ADD COLUMN IF NOT EXISTS parent_id  uuid REFERENCES public.business_notes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 100;

COMMENT ON COLUMN public.business_notes.parent_id IS
  'Halaman induk. NULL = halaman tingkat atas di dalam unitnya. ON DELETE CASCADE: menghapus induk menghapus seluruh anaknya — dan layar menyebutkan jumlahnya sebelum bertanya.';

CREATE INDEX IF NOT EXISTS idx_business_notes_parent
  ON public.business_notes (parent_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. Berbagi yang bisa menulis
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_units
  ADD COLUMN IF NOT EXISTS shared_edit_with jsonb DEFAULT '[]'::jsonb;

UPDATE public.business_units SET shared_edit_with = '[]'::jsonb WHERE shared_edit_with IS NULL;

COMMENT ON COLUMN public.business_units.shared_edit_with IS
  'profiles.id yang boleh MENULIS di unit ini. Harus juga ada di shared_with (yang boleh membaca) — aplikasi menjaganya, dan kebijakan di bawah menuntut keduanya.';

CREATE INDEX IF NOT EXISTS idx_business_units_shared_edit
  ON public.business_units USING gin (shared_edit_with);

-- Penerima berbagi-tulis boleh MENGUBAH catatan tidak-pribadi di unit itu.
-- Menghapus TIDAK diberikan: menghapus halaman beserta seluruh anaknya adalah
-- tindakan yang tidak bisa dibatalkan, dan itu tetap hak pemiliknya.
DROP POLICY IF EXISTS "shared_notes_write" ON public.business_notes;
CREATE POLICY "shared_notes_write" ON public.business_notes
  FOR UPDATE TO authenticated
  USING (
    COALESCE(is_private, false) = false
    AND unit_id IN (
      SELECT u.id FROM public.business_units u
      WHERE u.shared_edit_with ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  )
  WITH CHECK (
    COALESCE(is_private, false) = false
    AND unit_id IN (
      SELECT u.id FROM public.business_units u
      WHERE u.shared_edit_with ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  );

-- Dan boleh MENAMBAH halaman baru di unit yang dibagikan-tulis kepadanya —
-- tanpa ini, "boleh ikut menulis" berarti hanya boleh menyunting yang sudah
-- ada, dan tidak ada yang bisa menambahkan halaman rapat berikutnya.
DROP POLICY IF EXISTS "shared_notes_insert" ON public.business_notes;
CREATE POLICY "shared_notes_insert" ON public.business_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(is_private, false) = false
    AND unit_id IN (
      SELECT u.id FROM public.business_units u
      WHERE u.shared_edit_with ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Siapa yang boleh punya catatan
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_notes boolean DEFAULT false;

UPDATE public.profiles SET can_notes = false WHERE can_notes IS NULL;

COMMENT ON COLUMN public.profiles.can_notes IS
  'true = akun ini boleh punya Catatan Bisnis sendiri. Dinyalakan dari Manajemen User oleh pemilik klinik.';

-- Akun pemilik klinik dinyalakan sejak awal, supaya halamannya tidak jadi
-- tidak bisa dibuka siapa pun sesudah migrasi ini dijalankan.
UPDATE public.profiles SET can_notes = true
WHERE lower(email) IN ('kevinchikrista@gmail.com') OR role = 'owner';

-- ---- Pemeriksa ------------------------------------------------------------
-- Siapa yang boleh punya catatan.
SELECT full_name, email, role, can_notes
FROM public.profiles
WHERE can_notes
ORDER BY full_name;

-- Unit mana dibagikan ke siapa, dan dengan hak apa.
SELECT u.name                                        AS unit,
       COALESCE(jsonb_array_length(u.shared_with), 0)      AS boleh_baca,
       COALESCE(jsonb_array_length(u.shared_edit_with), 0) AS boleh_tulis
FROM public.business_units u
ORDER BY u.name;

-- HARUS KOSONG: yang boleh menulis tapi tidak boleh membaca — keadaan yang
-- tidak masuk akal dan menandakan datanya sudah tidak sinkron.
SELECT u.name, u.shared_with, u.shared_edit_with
FROM public.business_units u
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements_text(COALESCE(u.shared_edit_with, '[]'::jsonb)) e
  WHERE NOT (COALESCE(u.shared_with, '[]'::jsonb) ? e)
);
