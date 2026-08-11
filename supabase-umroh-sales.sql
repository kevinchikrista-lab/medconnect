-- =============================================
-- UMROH & HAJI: laporan jemaah + cashback travel (#/admin/umroh).
--
-- Datanya TIDAK diketik ulang. Berkas "Laporan Detail Data Penjualan Obat"
-- hasil ekspor sistem kasir apotek diunggah lewat halaman ini, lalu dibaca
-- oleh js/umroh-import.js. Berkas itu sudah memuat tanggal, nama pasien, nama
-- dokter, kolom Sales (= travel pengirimnya), rincian vaksin, dan total yang
-- dibayar — jadi angka yang dipakai menagih cashback adalah angka yang sama
-- dengan yang tercatat di kasir, bukan angka kedua yang harus dicocokkan.
--
-- KUNCINYA NOMOR FAKTUR (invoice_no, mis. 'PJ2607230011').
-- Ini yang membuat unggah ulang aman: baris dikenali dari nomor fakturnya, jadi
-- mengunggah periode yang tumpang tindih hanya MENIMPA baris yang sudah ada,
-- tidak menggandakannya. Keunikannya ditegakkan oleh indeks unik di bawah —
-- bukan hanya oleh pengecekan di aplikasi — supaya dua orang yang mengunggah
-- berkas yang sama pada saat bersamaan pun tidak bisa membuat baris kembar.
--
-- YANG TIDAK IKUT TERTIMPA saat unggah ulang: cashback_amount, cashback_paid,
-- cashback_at, cashback_by. Itu catatan klinik sendiri, bukan milik kasir —
-- kalau ikut ditimpa, tanda "sudah dibayar" akan hilang setiap kali laporan
-- bulan berjalan diunggah lagi.
--
-- TRAVEL YANG DIISI TANGAN juga tidak ikut tertimpa. Kolom Sales di kasir
-- kadang terlewat diisi, dan mengejar kasir untuk memperbaikinya lalu
-- mengekspor ulang tidak selalu memungkinkan. Karena itu ada tiga kolom:
--
--   travel_source : nilai apa adanya dari berkas kasir (selalu diperbarui)
--   travel_manual : true bila diisi tangan lewat aplikasi
--   travel_name   : yang berlaku — isian manual bila ada, kalau tidak ikut kasir
--
-- Dipisah begini supaya tidak ada yang hilang di kedua arah: mengisi tangan
-- tidak menghapus nilai kasir, dan mengosongkan isian tangan mengembalikannya
-- mengikuti kasir lagi.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

CREATE TABLE IF NOT EXISTS public.umroh_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),

  -- ---- Fakta dari kasir (ditimpa setiap kali berkasnya diunggah ulang) ----
  invoice_no    text NOT NULL,          -- No. Faktur, mis. 'PJ2607230011'
  sold_date     date,
  sold_time     text,                   -- 'HH:MM' (teks, bukan time, agar '' aman)
  patient_name  text,
  doctor_name   text,                   -- ditulis apa adanya oleh kasir
  travel_name   text,                   -- travel yang berlaku (kasir ATAU isian manual)
  travel_source text,                   -- nilai apa adanya dari kolom "Sales" di berkas
  travel_manual boolean DEFAULT false,  -- true = diisi tangan, jangan ditimpa unggahan
  service       text,                   -- meningitis | polio | combo
  service_label text,                   -- mis. 'Combo (Meningitis + Polio)'
  price         integer DEFAULT 0,      -- Total faktur, sudah dipotong diskon
  items         jsonb   DEFAULT '[]'::jsonb,  -- nama item di faktur (bukti)
  other_items   jsonb   DEFAULT '[]'::jsonb,  -- item di luar vaksin umroh

  -- ---- Catatan klinik (TIDAK ikut tertimpa saat unggah ulang) ----
  cashback_amount integer DEFAULT 0,
  cashback_paid   boolean DEFAULT false,
  cashback_at     timestamptz,
  cashback_by     uuid,                 -- profiles.id yang menandai

  -- ---- Jejak unggahan ----
  imported_at   timestamptz,
  imported_by   uuid,
  source_file   text
);

-- Inilah pengaman "jangan sampai dobel". Tanpa ini, aplikasi memang sudah
-- mencocokkan nomor faktur sebelum menyimpan, tapi pengecekan di aplikasi
-- selalu punya celah balapan: dua unggahan berbarengan sama-sama melihat
-- "belum ada", lalu keduanya menyimpan. Indeks unik menutup celah itu di
-- tingkat basis data, tempat yang tidak bisa dilewati.
CREATE UNIQUE INDEX IF NOT EXISTS idx_umroh_sales_invoice
  ON public.umroh_sales (invoice_no);

-- Laporan hampir selalu diambil per rentang tanggal, lalu dikelompokkan per
-- travel; dan tagihan cashback diambil per travel yang belum dibayar.
CREATE INDEX IF NOT EXISTS idx_umroh_sales_date
  ON public.umroh_sales (sold_date DESC);

CREATE INDEX IF NOT EXISTS idx_umroh_sales_travel
  ON public.umroh_sales (travel_name, sold_date);

CREATE INDEX IF NOT EXISTS idx_umroh_sales_cashback_due
  ON public.umroh_sales (travel_name, sold_date)
  WHERE cashback_paid IS NOT TRUE;

-- Aman dijalankan pada tabel yang sudah terlanjur dibuat versi sebelumnya.
ALTER TABLE public.umroh_sales
  ADD COLUMN IF NOT EXISTS travel_source text,
  ADD COLUMN IF NOT EXISTS travel_manual boolean DEFAULT false;

UPDATE public.umroh_sales SET travel_manual = false WHERE travel_manual IS NULL;
-- Baris yang sudah ada sebelum kolom ini lahir: nilai kasirnya sama dengan
-- yang berlaku sekarang, karena saat itu belum ada isian manual sama sekali.
UPDATE public.umroh_sales SET travel_source = travel_name WHERE travel_source IS NULL;

-- Daftar kerja "yang travelnya masih kosong", diambil per rentang tanggal.
CREATE INDEX IF NOT EXISTS idx_umroh_sales_tanpa_travel
  ON public.umroh_sales (sold_date)
  WHERE travel_name IS NULL OR travel_name = '';

ALTER TABLE public.umroh_sales ENABLE ROW LEVEL SECURITY;

-- Isinya data penjualan & komisi travel — bukan konsumsi semua staf.
-- Hanya Super Admin / Owner. Siapa yang boleh menandai cashback SUDAH dibayar
-- dibatasi lebih sempit lagi di aplikasi (CONFIG.CASHBACK_MANAGER_EMAILS);
-- pembatasan satu kolom itu tidak ditegakkan RLS, jadi perlu diketahui bahwa
-- seorang Super Admin yang menembus lewat API tetap bisa mengubahnya.
DROP POLICY IF EXISTS "admin_all" ON public.umroh_sales;
CREATE POLICY "admin_all" ON public.umroh_sales
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')));

-- Ringkasan pemeriksa: jemaah per travel per bulan, beserta cashback tertunggak.
SELECT to_char(sold_date, 'YYYY-MM')                                     AS bulan,
       COALESCE(NULLIF(travel_name, ''), '(masih kosong)')               AS travel,
       count(*)                                                         AS jemaah,
       count(*) FILTER (WHERE travel_manual)                            AS diisi_manual,
       COALESCE(sum(price), 0)                                          AS nilai_penjualan,
       COALESCE(sum(cashback_amount) FILTER (WHERE NOT cashback_paid), 0) AS cashback_belum_dibayar,
       COALESCE(sum(cashback_amount) FILTER (WHERE cashback_paid), 0)     AS cashback_sudah_dibayar
FROM public.umroh_sales
GROUP BY 1, 2 ORDER BY 1 DESC, 3 DESC;
