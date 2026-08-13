-- =============================================
-- APOTEK MENDAFTARKAN PASIEN BARU.
--
-- Resep tidak bisa ditulis untuk orang yang belum ada di daftar pasien,
-- sementara yang datang ke apotek sering belum pernah tercatat di klinik.
-- Sebelumnya jalan satu-satunya adalah menunggu Super Admin membuatkan
-- datanya, dan selama menunggu itu resepnya tidak jadi ditulis. Sekarang
-- apotek boleh mendaftarkan sendiri.
--
-- MENDAFTARKAN PASIEN BUKAN KEPUTUSAN KLINIS, jadi tidak menunggu ACC dokter
-- dan tidak diikat izin "boleh menyusun resep" (pharmacies.can_prescribe).
-- Yang menunggu ACC tetap RESEPNYA — itu tidak berubah sedikit pun.
--
-- TIDAK ADA KEBIJAKAN RLS BARU DI SINI, dan itu memang disengaja. Kebijakan
-- yang sudah ada di supabase-rls-fase-b.sql sudah mengizinkannya:
--
--   CREATE POLICY "staff_all" ON public.patients FOR ALL TO authenticated
--     USING (public.is_staff()) WITH CHECK (public.is_staff());
--
-- dan is_staff() berarti "user login yang bukan pasien" — akun apotek termasuk
-- di dalamnya. Menambah kebijakan kedua di sini hanya akan membuat dua sumber
-- kebenaran yang bisa berbeda.
--
-- AKUNNYA DIBUAT TANPA LOGIN. Pasien yang didaftarkan di meja apotek tidak
-- sedang membuat akun aplikasi; e-mailnya diisi alamat cadangan di domain
-- no-email.myprima.local (profiles.email UNIQUE NOT NULL, jadi tidak bisa
-- dikosongkan) dan auth_id dibiarkan kosong. Super Admin bisa mengisikan
-- e-mail aslinya belakangan lewat Manajemen User — saat itulah login
-- Supabase Auth-nya baru dibuat.
--
-- YANG DITAMBAHKAN FILE INI HANYA JEJAK PENDAFTARAN. Kalau kelak ada data
-- pasien yang salah atau kembar, pertanyaan pertamanya selalu "ini siapa yang
-- daftarkan?" — tanpa kolom ini pertanyaan itu tidak bisa dijawab.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS registered_by  uuid,   -- profiles.id yang mendaftarkan
  ADD COLUMN IF NOT EXISTS registered_via text;   -- 'apotek' | '' (lewat admin)

-- Baris lama tidak ditebak-tebak isinya: yang tidak diketahui dibiarkan
-- kosong, bukan diisi nilai karangan yang nanti terbaca sebagai fakta.

COMMENT ON COLUMN public.patients.registered_by IS
  'profiles.id petugas yang mendaftarkan pasien ini. Kosong untuk data lama atau pasien yang mendaftar sendiri.';
COMMENT ON COLUMN public.patients.registered_via IS
  'Dari mana pendaftarannya: apotek = didaftarkan dari halaman apotek. Kosong = lewat admin / pendaftaran mandiri.';

-- Menelusuri "pasien yang didaftarkan apotek", biasanya saat menyisir duplikat.
CREATE INDEX IF NOT EXISTS idx_patients_registered_via
  ON public.patients (registered_via, created_at DESC)
  WHERE registered_via IS NOT NULL AND registered_via <> '';

-- ---- Pemeriksa duplikat --------------------------------------------------
-- Aplikasi sudah memperingatkan calon kembaran sebelum menyimpan, tapi
-- peringatan bisa dilewati (dan memang harus bisa — nama yang sama persis itu
-- lumrah). Query ini untuk menyisirnya secara berkala. Sengaja TIDAK dibuat
-- indeks unik pada nama: itu akan menolak dua orang berbeda yang kebetulan
-- senama, dan yang tertolak justru pasien sungguhan di depan meja.
SELECT lower(regexp_replace(full_name, '[^a-zA-Z0-9]+', ' ', 'g'))        AS nama_disamakan,
       count(*)                                                          AS jumlah_data,
       string_agg(COALESCE(NULLIF(rm_number, ''), '(tanpa RM)'), ', ')    AS nomor_rm,
       string_agg(DISTINCT COALESCE(NULLIF(phone, ''), '-'), ', ')        AS nomor_hp
FROM public.patients
GROUP BY 1
HAVING count(*) > 1
ORDER BY 2 DESC, 1;
