-- =============================================
-- CATATAN BISNIS — buku catatan perkembangan per unit usaha.
--
-- Dua tabel:
--   business_units  : daftar unit usaha (Klinik Prima, Apotek, Home Care, ...)
--   business_notes  : catatannya, isinya teks Markdown biasa
--
-- Isi catatan disimpan sebagai TEKS MARKDOWN, bukan struktur blok seperti
-- Notion. Alasannya sengaja: teks biasa tetap bisa dibaca, dicari, disalin,
-- dan diselamatkan meski suatu saat aplikasinya berganti — sedangkan struktur
-- blok hanya bisa dibaca oleh aplikasi yang membuatnya.
--
-- HAK AKSES — catatan ini PRIBADI.
-- business_notes hanya bisa dibaca/ditulis oleh AKUN YANG MEMBUATNYA sendiri
-- (created_by). Bukan sekadar disembunyikan di tampilan: Super Admin pun tidak
-- bisa membacanya lewat jalur mana pun, karena aturannya ditegakkan di server.
-- Daftar unit usahanya sendiri tidak rahasia — cukup dibatasi ke Owner.
--
-- Jangan menaruh data pasien di sini; catatan bisnis tidak dilindungi seketat
-- rekam medis. Sebut nomor RM bila perlu, jangan nama.
--
-- Prasyarat: tabel public.profiles sudah ada.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

CREATE TABLE IF NOT EXISTS public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  description text,
  color text DEFAULT 'slate',      -- warna lencana di tampilan
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 100
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_units_name
  ON public.business_units (lower(name));

CREATE TABLE IF NOT EXISTS public.business_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text DEFAULT '',            -- isi catatan, format Markdown
  note_date date,                  -- tanggal yang dicatat (bukan tanggal ketik)
  tags text DEFAULT '',            -- label bebas, dipisah koma
  pinned boolean DEFAULT false,

  created_by uuid                  -- profiles.id pemilik catatan
);

-- Daftar catatan selalu diurutkan: yang disematkan dulu, lalu terbaru.
CREATE INDEX IF NOT EXISTS idx_business_notes_owner
  ON public.business_notes (created_by, pinned DESC, note_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_business_notes_unit
  ON public.business_notes (unit_id);

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_notes ENABLE ROW LEVEL SECURITY;

-- Unit usaha: hanya Owner (pemilik klinik).
DROP POLICY IF EXISTS "owner_all" ON public.business_units;
CREATE POLICY "owner_all" ON public.business_units
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role = 'owner'));

-- Catatan: HANYA milik pembuatnya. Tidak ada pengecualian untuk Super Admin —
-- inilah yang membuat "hanya dr. Kevin" benar-benar berlaku, bukan sekadar
-- menyembunyikan menunya. WITH CHECK mengunci created_by ke diri sendiri,
-- jadi catatan tidak bisa dititipkan atas nama orang lain.
DROP POLICY IF EXISTS "own_notes" ON public.business_notes;
CREATE POLICY "own_notes" ON public.business_notes
  FOR ALL TO authenticated
  USING (created_by IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()))
  WITH CHECK (created_by IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()));

-- Isi awal daftar unit usaha — silakan ubah/tambah nanti dari halaman Catatan.
INSERT INTO public.business_units (name, description, color, sort_order)
VALUES
  ('Klinik Prima', 'Layanan klinik utama', 'blue',   10),
  ('Apotek',       'Farmasi & penjualan obat', 'green',  20),
  ('Home Care',    'Kunjungan ke rumah pasien', 'amber', 30),
  ('Umroh & Haji', 'Vaksinasi meningitis & layanan jemaah', 'purple', 40)
ON CONFLICT DO NOTHING;

SELECT u.name AS unit, count(n.id) AS jumlah_catatan
FROM public.business_units u
LEFT JOIN public.business_notes n ON n.unit_id = u.id
GROUP BY u.name ORDER BY u.name;
