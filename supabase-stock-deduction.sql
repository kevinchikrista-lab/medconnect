-- =============================================
-- STOK BERKURANG SAAT RESEP SELESAI DILAYANI.
--
-- Sebelumnya angka pada halaman Inventaris tidak pernah berubah oleh
-- pelayanan resep, jadi angka itu hanya hiasan — apotek tetap menghitung
-- stoknya di tempat lain, dan halaman ini tidak pernah bisa dipercaya.
--
-- YANG DITAMBAHKAN HANYA SATU KOLOM: penanda bahwa sebuah resep sudah pernah
-- memotong stok. Ini bukan kemewahan. Tanpa penanda itu, menekan "Selesai"
-- dua kali — atau polling yang memperbarui status ulang — memotong stok dua
-- kali, dan selisihnya tidak akan pernah ketahuan sampai opname berikutnya.
--
-- TIGA HAL YANG SENGAJA DIPUTUSKAN BEGINI (ditegakkan di aplikasi):
--
-- 1. TIDAK PERNAH MEMBLOKIR PELAYANAN. Obatnya sudah diserahkan ke pasien
--    saat resep ditandai selesai. Menolak mencatatnya karena angka di sistem
--    kurang hanya membuat catatannya makin jauh dari kenyataan.
--
-- 2. TIDAK MENEBAK. Nama obat resep dicocokkan ke inventaris setelah spasi
--    dan tanda baca dibuang ('Amoxicillin' + '500 mg' ↔ 'Amoxicillin 500mg').
--    Kalau tidak ketemu, ATAU justru cocok ke beberapa baris (dua kekuatan
--    berbeda), barisnya DILEWATI dan apotek diberi tahu. Mengurangi stok yang
--    salah lebih buruk daripada tidak mengurangi: yang salah tidak terlihat,
--    yang dilewati dilaporkan.
--
-- 3. RACIKAN SELALU DILEWATI. Komposisinya teks bebas ('Codein 10mg + GG
--    100mg'), bukan tautan ke baris inventaris. Menguraikannya berarti
--    menebak bahan, dan itu tebakan yang paling mahal.
--
-- STOK BOLEH MINUS dan tidak dipotong di nol. Angka minus berteriak
-- "hitungan ini salah, perlu opname"; angka yang dipotong diam-diam
-- berpura-pura semuanya beres. Halaman Inventaris menandainya merah.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS stock_deducted boolean DEFAULT false;

UPDATE public.prescriptions SET stock_deducted = false WHERE stock_deducted IS NULL;

COMMENT ON COLUMN public.prescriptions.stock_deducted IS
  'true = stok inventaris sudah dipotong untuk resep ini. Penjaga agar pemotongan tidak terjadi dua kali bila status diperbarui ulang.';

-- Resep yang sudah selesai SEBELUM fitur ini ada tidak boleh ikut memotong
-- stok belakangan: obatnya sudah keluar rak berbulan lalu, dan stok hari ini
-- dihitung tanpa memperhitungkannya. Ditandai sudah-dipotong supaya tidak
-- terpotong ulang kalau statusnya kelak disentuh lagi.
UPDATE public.prescriptions
SET stock_deducted = true
WHERE status = 'completed' AND COALESCE(stock_deducted, false) = false;

-- ---- Pemeriksa ------------------------------------------------------------
-- Stok minus = yang dilayani lebih banyak daripada yang tercatat masuk.
-- Hampir selalu karena ada pemasukan barang yang belum dicatat.
SELECT COALESCE(p.name, '(tanpa nama)') AS apotek,
       i.drug_name,
       i.stock,
       i.unit,
       i.min_stock,
       CASE WHEN i.stock < 0 THEN 'MINUS — perlu opname'
            WHEN i.stock <= i.min_stock THEN 'rendah'
            ELSE 'cukup' END AS keadaan
FROM public.inventory i
LEFT JOIN public.pharmacies p ON p.id = i.pharmacy_id
ORDER BY i.stock ASC, i.drug_name;
