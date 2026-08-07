-- =============================================
-- MASTER DATA — Lokasi / Tempat Praktik.
-- Menggantikan daftar lokasi yang dulu di-hardcode di js/config.js
-- (CONFIG.LOCATIONS), supaya bisa ditambah / diubah / dihapus dari
-- halaman Super Admin tanpa perlu ubah kode.
--
-- Dipakai oleh:
--   - Rekam medis (Lokasi / Tempat kunjungan)
--   - Vaksinasi (Lokasi Vaksinasi)
--   - Kertas resep (baris "Tempat Praktik" + alamat pada kop surat)
--
-- Prasyarat: fungsi public.is_staff() sudah ada (dari RLS Fase B).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.practice_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,          -- nama tempat, mis. "Klinik Utama Prima"
  address text,                -- alamat lengkap; dicetak di kop kertas resep
  phone text,                  -- no. telp / WA tempat ini (opsional)
  notes text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 100
);

-- Nama tempat tidak boleh dobel — nama inilah yang tersimpan di rekam medis
-- dan vaksinasi, jadi harus unik supaya tidak ambigu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_locations_name
  ON public.practice_locations (lower(name));

ALTER TABLE public.practice_locations ENABLE ROW LEVEL SECURITY;

-- Semua staf boleh membaca (dokter & apotek butuh untuk dropdown + cetak resep).
DROP POLICY IF EXISTS "staff_read" ON public.practice_locations;
CREATE POLICY "staff_read" ON public.practice_locations
  FOR SELECT TO authenticated USING (public.is_staff());

-- Hanya Super Admin / Owner yang boleh menambah, mengubah, menghapus.
DROP POLICY IF EXISTS "admin_write" ON public.practice_locations;
CREATE POLICY "admin_write" ON public.practice_locations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')));

-- Isi awal — sesuai lokasi yang selama ini dipakai.
-- ("Klinik Cabang Kemang" sengaja TIDAK diikutkan: itu data contoh bawaan.)
INSERT INTO public.practice_locations (name, address, phone, sort_order)
VALUES
  ('Klinik Utama Prima', 'Jl. Dr. Wahidin, Gg. Sepakat 8 No. 88BC, Pontianak', '0895-1882-4216', 10),
  ('Home Care',          '', '', 20),
  ('Telemedicine',       '', '', 30)
ON CONFLICT DO NOTHING;

SELECT name, address, is_active, sort_order
FROM public.practice_locations ORDER BY sort_order, name;
