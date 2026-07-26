-- =============================================
-- Rapikan No. Rekam Medis (RM) semua pasien.
-- Memberi nomor rapi & urut: 000001, 000002, ... sesuai urutan pendaftaran,
-- mengisi yang kosong (null) dan memperbaiki format lama (mis. "2", "32").
-- Lalu penghitung diset agar pasien berikutnya lanjut dari nomor terakhir.
--
-- CATATAN: ini MENOMORI ULANG semua pasien, jadi beberapa nomor yang sudah ada
-- bisa berubah. Untuk klinik yang masih menata data ini biasanya diinginkan.
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS FIRST, id) AS rn
  FROM public.patients
)
UPDATE public.patients p
SET rm_number = lpad(n.rn::text, 6, '0')
FROM numbered n
WHERE p.id = n.id;

-- Set penghitung RM agar pasien berikutnya lanjut dari nomor tertinggi.
INSERT INTO public.doc_sequence (series, year, last_number)
VALUES ('RM', 0, (SELECT count(*) FROM public.patients))
ON CONFLICT (series, year) DO UPDATE SET last_number = EXCLUDED.last_number;

-- Tampilkan hasil.
SELECT rm_number, full_name FROM public.patients ORDER BY rm_number;
