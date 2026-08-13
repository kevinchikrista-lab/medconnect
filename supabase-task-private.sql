-- =============================================================================
-- TUGAS PRIBADI: satu tugas yang hanya bisa dibaca pembuatnya.
--
-- KENAPA. supabase-tasks.sql sengaja membuka daftar tugas untuk semua staf —
-- catatannya sendiri menuliskan alasannya: dokter perlu tahu tugas admin dan
-- sebaliknya. Untuk hampir semua isinya itu benar. Yang tidak tertampung
-- adalah rencana yang memang belum boleh dibaca siapa pun: negosiasi sewa,
-- rencana penambahan atau pengurangan orang, urusan yang menyangkut nama
-- seseorang. Sebelum ini, satu-satunya cara menyimpan hal seperti itu adalah
-- dengan TIDAK MENULISKANNYA — dan yang tidak tertulis adalah yang terlupakan.
--
-- YANG DIJAGA DI SINI, BUKAN DI LAYAR. Menyembunyikan baris di tampilan saja
-- tidak ada artinya: kunci anon Supabase memang tertanam di kode aplikasi,
-- jadi siapa pun yang bisa login sebagai staf dapat memanggil PostgREST
-- langsung dan membaca seluruh tabelnya. Pagar sebenarnya adalah kebijakan
-- di bawah ini.
--
-- YANG SENGAJA TIDAK DILAKUKAN. Tugas pribadi tidak boleh punya penerima:
-- tugas yang didelegasikan tapi tidak bisa dibaca penerimanya adalah tugas
-- yang tidak akan pernah dikerjakan. Aturan itu ditegakkan aplikasi (menolak
-- dengan pesan jelas) DAN di sini lewat CHECK, supaya keadaan mustahil itu
-- tidak bisa masuk lewat jalur mana pun.
--
-- Prasyarat: supabase-tasks.sql sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

UPDATE public.tasks SET is_private = false WHERE is_private IS NULL;

COMMENT ON COLUMN public.tasks.is_private IS
  'true = hanya created_by yang boleh membaca. Tidak boleh dipakai bersama assignee_id/attendee_ids.';

-- Keadaan mustahil ditutup di tingkat tabel: pribadi + ada penerima.
-- NOT VALID supaya baris lama (yang semuanya is_private = false) tidak perlu
-- dipindai ulang; aturannya tetap berlaku penuh untuk setiap baris baru.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_private_no_assignee;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_private_no_assignee
  CHECK (COALESCE(is_private, false) = false OR assignee_id IS NULL) NOT VALID;

-- Daftar tugas selalu disaring "yang boleh saya lihat", jadi kolom ini ikut
-- di hampir setiap query.
CREATE INDEX IF NOT EXISTS idx_tasks_private_owner
  ON public.tasks (created_by) WHERE is_private;

-- ---------------------------------------------------------------------------
-- Kebijakan baca: staf tetap melihat semuanya KECUALI yang ditandai pribadi
-- oleh orang lain.
--
-- created_by menyimpan profiles.id, sedangkan auth.uid() adalah id akun
-- Auth — pemetaannya lewat profiles.auth_id, sama seperti kebijakan
-- assignee_update di supabase-tasks.sql.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_read" ON public.tasks;
CREATE POLICY "staff_read" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND (
      COALESCE(is_private, false) = false
      OR created_by IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  );

-- Kebijakan admin_write memberi Super Admin kuasa penuh atas seluruh baris,
-- termasuk yang pribadi milik pemilik klinik — bukan itu yang diminta.
-- Dipersempit: Super Admin mengurus semua tugas biasa, tapi baris pribadi
-- hanya bisa disentuh pembuatnya sendiri.
DROP POLICY IF EXISTS "admin_write" ON public.tasks;
CREATE POLICY "admin_write" ON public.tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner'))
    AND (
      COALESCE(is_private, false) = false
      OR created_by IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner'))
    AND (
      COALESCE(is_private, false) = false
      OR created_by IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  );

-- Kebijakan assignee_update & assignee_insert_own dari supabase-tasks.sql
-- tidak perlu diubah: keduanya menuntut assignee_id = diri sendiri, sedangkan
-- baris pribadi tidak punya assignee_id sama sekali (dijaga CHECK di atas),
-- jadi tidak ada baris pribadi yang bisa lolos lewat sana.

-- ---- Pemeriksa ------------------------------------------------------------
-- Berapa tugas yang ditandai pribadi, dan milik siapa.
SELECT COALESCE(p.full_name, '(tanpa nama)') AS pemilik,
       count(*)                              AS jumlah_tugas_pribadi
FROM public.tasks t
LEFT JOIN public.profiles p ON p.id = t.created_by
WHERE t.is_private
GROUP BY 1
ORDER BY 2 DESC;

-- Harus kosong: tugas pribadi yang punya penerima.
SELECT id, title, assignee_id
FROM public.tasks
WHERE is_private AND assignee_id IS NOT NULL;
