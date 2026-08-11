-- =============================================
-- BERBAGI CATATAN BISNIS ke staf tertentu, per UNIT USAHA.
--
-- Kebutuhannya: Super Admin boleh melihat catatan yang berkaitan dengan
-- Apotek & Klinik saja, tidak yang lain.
--
-- KENAPA PER UNIT, BUKAN PER LABEL BEBAS.
-- Label bebas-ketik (tags) tidak aman dipakai sebagai kunci akses: salah ketik
-- satu huruf (“apotik” vs “apotek”) membuat catatan diam-diam bocor atau
-- diam-diam hilang dari pandangan, dan tidak ada yang menyadarinya. Unit usaha
-- sudah berupa daftar tetap dengan id — tidak bisa salah ketik, dan pemberian
-- aksesnya bisa ditelusuri.
--
--   business_units.shared_with : daftar profiles.id yang boleh MEMBACA catatan
--                                di unit ini (selain pemiliknya)
--   business_notes.is_private  : jalan keluar per catatan — bila true, catatan
--                                tetap milik pembuatnya saja meski unitnya
--                                dibagikan. Untuk tulisan sensitif yang
--                                kebetulan berada di unit terbuka.
--
-- Yang dibagikan hanya HAK BACA. Membuat, mengubah, dan menghapus tetap milik
-- pemiliknya; itu ditegakkan oleh kebijakan own_notes yang sudah ada.
--
-- Prasyarat: supabase-business-notes.sql sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.business_units
  ADD COLUMN IF NOT EXISTS shared_with jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.business_notes
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

UPDATE public.business_units SET shared_with = '[]'::jsonb WHERE shared_with IS NULL;
UPDATE public.business_notes SET is_private = false        WHERE is_private IS NULL;

-- Mencari "unit yang dibagikan ke saya" berarti mencari di dalam daftar.
CREATE INDEX IF NOT EXISTS idx_business_units_shared
  ON public.business_units USING gin (shared_with);

-- ---- Unit usaha ----------------------------------------------------------
-- Pemilik tetap berkuasa penuh (kebijakan owner_all yang sudah ada). Penerima
-- berbagi perlu bisa MEMBACA daftar unitnya juga — tanpa itu, catatan yang
-- dia terima tampil tanpa nama unit.
DROP POLICY IF EXISTS "shared_unit_read" ON public.business_units;
CREATE POLICY "shared_unit_read" ON public.business_units
  FOR SELECT TO authenticated
  USING (shared_with ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid()));

-- ---- Catatan -------------------------------------------------------------
-- Hanya BACA, dan hanya untuk catatan yang tidak ditandai pribadi.
-- Kebijakan own_notes yang sudah ada tetap memegang tulis/ubah/hapus, jadi
-- penerima berbagi tidak bisa menyunting apa pun.
DROP POLICY IF EXISTS "shared_notes_read" ON public.business_notes;
CREATE POLICY "shared_notes_read" ON public.business_notes
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_private, false) = false
    AND unit_id IN (
      SELECT u.id FROM public.business_units u
      WHERE u.shared_with ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
    )
  );

SELECT u.name AS unit,
       jsonb_array_length(COALESCE(u.shared_with, '[]'::jsonb)) AS dibagikan_ke_orang,
       count(n.id)                                              AS jumlah_catatan,
       count(n.id) FILTER (WHERE n.is_private)                  AS ditandai_pribadi
FROM public.business_units u
LEFT JOIN public.business_notes n ON n.unit_id = u.id
GROUP BY u.name, u.shared_with ORDER BY u.name;
