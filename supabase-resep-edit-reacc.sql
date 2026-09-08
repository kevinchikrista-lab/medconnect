-- =============================================================================
-- RESEP: BOLEH DISUNTING SESUDAH DI-ACC APOTEK, TAPI HARUS ACC ULANG
--
-- Sebelumnya dokter cuma boleh menyunting resep yang statusnya masih 'sent'
-- atau 'rejected' -- begitu apotek menerimanya (status jadi 'preparing' dst),
-- dokter terkunci sama sekali, walau ada salah ketik dosis yang baru
-- ketahuan. Sekarang boleh disunting sampai 'ready' (belum benar-benar
-- dikirim/diselesaikan) -- TAPI kalau resepnya SUDAH di-ACC apotek,
-- menyimpan suntingan memaksa statusnya kembali ke 'sent' dan menandai
-- needs_reacc, supaya apotek yang sedang menyiapkan obat versi lama melihat
-- lagi versi barunya sebelum melanjutkan -- bukan diam-diam tetap
-- menyiapkan obat yang sudah tidak sesuai resep.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang. Tidak menghapus apa
-- pun.
-- =============================================================================

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS needs_reacc boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prescriptions.needs_reacc IS
  'true berarti resep ini diubah dokter SESUDAH apotek pernah menerimanya (status kembali ke sent) -- apotek perlu memeriksa ulang sebelum melanjutkan. Dibersihkan otomatis begitu apotek bertindak lagi (terima/tolak/dst).';

-- ---- Pemeriksa -------------------------------------------------------------
SELECT 'kolom' AS bagian, 'prescriptions.needs_reacc' AS yang_diperiksa,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='prescriptions' AND column_name='needs_reacc')
            THEN 'OK' ELSE 'BELUM' END AS keadaan;
