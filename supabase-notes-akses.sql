-- =============================================================================
-- CATATAN BISNIS: IZIN DI SERVER MENGIKUTI SAKLAR DI APLIKASI
--
-- MASALAHNYA
--
-- supabase-notes-workspace.sql menambahkan saklar per akun (profiles.can_notes)
-- supaya Anis dan Fitri bisa punya Catatan Bisnis sendiri. Tapi saklar itu
-- hanya berlaku di APLIKASI. Aturan akses di server tidak ikut diubah, dan
-- bunyinya masih:
--
--     CREATE POLICY "owner_all" ON public.business_units
--       USING (... p.role = 'owner')
--
-- Anis dan Fitri berperan superadmin, bukan owner. Jadi begitu saklarnya
-- dinyalakan, menunya muncul — lalu server menolak setiap permintaan membaca
-- daftar unit usaha. Yang terlihat: halaman terbuka, daftar unit kosong, tidak
-- ada halaman yang bisa dibuat, dan tidak ada satu kata pun yang menjelaskan
-- kenapa. Wajar kalau disimpulkan fiturnya rusak.
--
-- Menyalakan menu tanpa memberi izin di server bukan setengah fitur; itu
-- fitur yang tidak ada, dengan pintu yang terlihat.
--
-- YANG DIPERBAIKI
--
-- Izin membaca dan mengelola unit usaha kini mengikuti profiles.can_notes,
-- kunci yang sama dengan yang dipakai aplikasi. Satu sumber kebenaran, bukan
-- dua daftar yang harus diingat untuk disamakan.
--
-- Menghapus unit tetap tidak menghapus catatan: business_notes.unit_id
-- memakai ON DELETE SET NULL, jadi catatannya hanya kehilangan label unitnya —
-- persis seperti yang dikatakan layar sebelum bertanya.
--
-- Prasyarat: supabase-business-notes.sql, supabase-business-notes-sharing.sql,
-- dan supabase-notes-workspace.sql sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Unit usaha: boleh dibaca & dikelola oleh akun yang memang diberi Catatan
-- Bisnis. Kebijakan lama "owner_all" DIBIARKAN — kebijakan bersifat menambah,
-- jadi pemilik klinik tetap punya akses penuh walaupun suatu saat kolom
-- can_notes-nya tidak sengaja dimatikan.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notes_users_units" ON public.business_units;
CREATE POLICY "notes_users_units" ON public.business_units
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.auth_id = auth.uid()
                   AND (COALESCE(p.can_notes, false) OR p.role = 'owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.auth_id = auth.uid()
                        AND (COALESCE(p.can_notes, false) OR p.role = 'owner')));

-- ---------------------------------------------------------------------------
-- Catatan: kebijakan "own_notes" yang lama sudah benar — ia dikunci ke
-- created_by, bukan ke peran, sehingga siapa pun yang punya baris profil bisa
-- menulis catatannya sendiri. Tidak diubah. Ditegaskan di sini supaya siapa
-- pun yang membaca berkas ini tahu bahwa itu memang disengaja, bukan
-- terlewat.
-- ---------------------------------------------------------------------------

-- ---- Pemeriksa ------------------------------------------------------------
-- 1. Kebijakan business_units sekarang: harus ada "notes_users_units".
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'business_units'
ORDER BY policyname;

-- 2. Siapa yang seharusnya bisa membuka Catatan Bisnis.
SELECT full_name, email, role, can_notes
FROM public.profiles
WHERE COALESCE(can_notes, false) OR role = 'owner'
ORDER BY role, full_name;

-- 3. HARUS TIDAK KOSONG bila unitnya memang sudah ada — kalau kosong padahal
--    tabelnya berisi, berarti masih ada kebijakan yang menghalangi.
SELECT count(*) AS unit_terbaca FROM public.business_units;
