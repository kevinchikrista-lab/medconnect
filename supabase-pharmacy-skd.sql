-- =============================================
-- APOTEK MEMBUAT SURAT KETERANGAN DOKTER (SKD).
--
-- Selama ini surat keterangan hanya bisa disusun admin klinik. Apotek mitra
-- juga melayani pasien yang membutuhkannya, jadi apotek kini boleh menyusun
-- draftnya — DENGAN SATU BATAS YANG TIDAK BISA DITAWAR:
--
--   Apotek hanya boleh membuat surat atas nama DOKTER YANG BERPRAKTIK DI
--   TEMPAT ITU.
--
-- Alasannya bukan administratif. Surat keterangan dibuat atas nama seorang
-- dokter dan ditandatanganinya; surat atas nama dokter yang tidak pernah
-- berpraktik di sana adalah surat yang tidak bisa dipertanggungjawabkan
-- siapa pun — termasuk oleh dokter yang namanya tercetak di situ.
--
-- YANG MENGHUBUNGKAN KEDUANYA ADALAH TEMPAT PRAKTIK:
--
--   pharmacies.location_id  →  practice_locations.id  ←  doctors.practice_places[].location_id
--
-- Apotek mitra memang sudah didaftarkan sebagai tempat praktik di halaman
-- "Tempat Praktik & Kop" (lengkap dengan alamat, logo, dan kop resepnya),
-- jadi tidak ada daftar tempat kedua yang harus dijaga tetap sama. Kolom yang
-- ditambahkan file ini hanya SATU: penunjuk dari akun apotek ke tempat itu.
--
-- BILA location_id BELUM DIISI, aplikasi mencoba mencocokkan lewat NAMA
-- apotek dengan nama tempat praktik. Itu cadangan supaya data yang sudah ada
-- tidak perlu diisi ulang satu per satu — bukan pengganti. Begitu location_id
-- diisi, itulah yang berlaku, dan nama yang kebetulan mirip tidak lagi
-- menentukan apa pun.
--
-- APOTEK YANG TIDAK TERTAUT TIDAK BISA MEMBUAT SURAT SAMA SEKALI. Perhatikan
-- arah kegagalannya: yang tidak diketahui berakhir "tidak boleh", bukan
-- "boleh memilih dokter mana saja". Begitu pula tempat yang belum punya
-- dokter — daftarnya kosong, dan halamannya mengatakan kenapa.
--
-- SURATNYA TETAP MENUNGGU ACC DOKTER, persis seperti surat yang disusun admin
-- klinik: sebelum di-ACC yang tercetak adalah draft bertanda air, dan status
-- itu disimpan di certificates.details->approval seperti sebelumnya. Yang
-- berubah hanya SIAPA YANG BOLEH MENYUSUN DRAFTNYA — bukan siapa yang
-- mengesahkannya.
--
-- TIDAK ADA TABEL BARU DAN TIDAK ADA KEBIJAKAN RLS BARU. Tabel certificates
-- sudah dipakai jalur admin dengan bentuk data yang sama persis; jejak apotek
-- penyusunnya ikut di details->approval->by_pharmacy, di sebelah created_by
-- yang sudah ada. Menambah tabel kedua hanya akan membuat dua sumber
-- kebenaran untuk satu jenis surat.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.pharmacies
  ADD COLUMN IF NOT EXISTS location_id uuid;

COMMENT ON COLUMN public.pharmacies.location_id IS
  'practice_locations.id yang mewakili apotek ini. Menentukan dokter mana yang boleh dijadikan penanggung jawab surat keterangan yang disusun apotek ini. Kosong = belum tertaut, dan apotek itu belum bisa membuat surat.';

CREATE INDEX IF NOT EXISTS idx_pharmacies_location
  ON public.pharmacies (location_id) WHERE location_id IS NOT NULL;

-- ---- Menautkan yang namanya sudah sama persis ----------------------------
-- Sekali jalan untuk data yang sudah ada. Hanya menyentuh baris yang BELUM
-- tertaut, dan hanya bila namanya cocok persis (setelah spasi & tanda baca
-- disamakan) — pencocokan yang lebih longgar dari itu bisa menautkan apotek
-- ke tempat yang salah, dan akibatnya adalah surat atas nama dokter yang
-- keliru. Yang tidak cocok sengaja dibiarkan kosong untuk diatur tangan.
UPDATE public.pharmacies p
SET location_id = l.id
FROM public.practice_locations l
WHERE p.location_id IS NULL
  AND lower(regexp_replace(COALESCE(p.name, ''), '[^a-zA-Z0-9]+', ' ', 'g')) =
      lower(regexp_replace(COALESCE(l.name, ''), '[^a-zA-Z0-9]+', ' ', 'g'))
  AND COALESCE(p.name, '') <> '';

-- ---- Pemeriksa: apotek mana yang sudah bisa membuat surat, dan atas nama siapa ----
SELECT COALESCE(p.name, '(tanpa nama)')                           AS apotek,
       COALESCE(l.name, '(belum tertaut)')                        AS tempat_praktik,
       COALESCE(
         string_agg(d.full_name, ', ' ORDER BY d.full_name),
         '(belum ada dokter di tempat ini)')                      AS dokter_penanggung_jawab
FROM public.pharmacies p
LEFT JOIN public.practice_locations l ON l.id = p.location_id
LEFT JOIN public.doctors d
       ON l.id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(d.practice_places, '[]'::jsonb)) AS pp
        WHERE pp->>'location_id' = l.id::text
      )
GROUP BY p.name, l.name
ORDER BY p.name;
