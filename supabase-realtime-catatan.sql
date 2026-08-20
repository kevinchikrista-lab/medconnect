-- =============================================================================
-- SAMBUNGAN LANGSUNG UNTUK CATATAN BISNIS
--
-- Supabase Realtime membaca perubahan dari replikasi logis Postgres, dan ia
-- hanya melihat tabel yang dimasukkan ke publikasi `supabase_realtime`.
-- Selama tabelnya belum ada di sana, aplikasi tetap bisa menyambung ke
-- WebSocket-nya dan tetap tidak akan menerima kabar apa pun — halaman akan
-- terlihat baik-baik saja sambil diam.
--
-- Sesudah ini dijalankan, halaman Catatan Bisnis menyusul dalam sepersekian
-- detik. Kalau tidak dijalankan, halaman TIDAK rusak: ia kembali menanyakan
-- ulang tiap 15 detik seperti sebelumnya, dan tandanya di layar berbunyi
-- "Menyusul tiap 15 detik", bukan "Langsung".
--
-- YANG TIDAK BERGANTUNG PADA BERKAS INI
--
-- Ketikan huruf demi huruf berjalan lewat SIARAN (broadcast) — pesan langsung
-- antar-peramban yang tidak menyentuh basis data sama sekali, jadi ia tidak
-- lewat publikasi ini dan tetap bekerja walau berkas ini belum dijalankan.
-- Yang dijalankan berkas ini adalah kabar untuk perubahan yang SUDAH
-- TERSIMPAN: halaman baru, halaman dihapus, dan isi yang sudah masuk server.
--
-- REPLICA IDENTITY FULL sengaja TIDAK dipasang. Itu membuat Postgres ikut
-- mengirimkan seluruh isi baris yang lama pada setiap UPDATE dan DELETE —
-- termasuk isi catatannya. Aplikasi ini tidak membacanya sama sekali (pesan
-- Realtime hanya dipakai sebagai bel pintu; datanya diambil ulang lewat REST
-- yang melewati RLS), jadi mengirimkannya hanya menambah isi catatan yang
-- beredar tanpa ada yang memerlukannya.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

-- Publikasinya sudah ada pada proyek Supabase baru. Blok ini hanya berjaga
-- untuk proyek lama yang belum punya.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $do$;

-- Menambahkan tabel yang sudah ada di publikasi akan menimbulkan galat, jadi
-- diperiksa dulu — supaya berkas ini aman dijalankan berulang kali.
DO $do$
DECLARE t TEXT;
  tabel TEXT[] := ARRAY['business_notes','business_units'];
BEGIN
  FOREACH t IN ARRAY tabel LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $do$;

-- ---- Pemeriksa ------------------------------------------------------------
-- 1. Kedua tabel HARUS muncul di sini. Kalau salah satu tidak ada, halaman
--    Catatan Bisnis akan tetap menanyakan berkala untuk tabel itu.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

-- 2. RLS tetap menyala pada keduanya. Realtime menyaring kabarnya menurut
--    kebijakan yang sama; kalau RLS mati di sini, kabar perubahan akan
--    dikirim ke semua orang yang mendengarkan.
SELECT relname AS tabel, relrowsecurity AS rls_menyala
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('business_notes','business_units')
ORDER BY relname;
