-- =============================================
-- MENUTUP KEBOCORAN TABEL certificates.
--
-- KEADAAN SEBELUM FILE INI. supabase-rls-fase-b.sql mengunci semua tabel
-- klinis per pasien, TAPI certificates sengaja dilewati — catatan di baris
-- terakhir file itu menyebutkannya sendiri. Yang berlaku masih kebijakan lama:
--
--   CREATE POLICY "public_read"   ... FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY "public_insert" ... FOR INSERT TO anon, authenticated WITH CHECK (true);
--
-- Artinya dua hal, dan keduanya nyata karena kunci anon Supabase memang
-- tertanam di kode aplikasi (wajar — RLS-lah yang seharusnya jadi pagarnya):
--
--   1. SIAPA PUN, TANPA LOGIN, BISA MEMBACA SELURUH ISI TABEL ITU. Bukan hanya
--      nomor suratnya: details memuat nama pasien, No. RM, tanggal lahir,
--      jenis kelamin, ALAMAT, dan untuk surat sakit — DIAGNOSISNYA.
--
--   2. SIAPA PUN BISA MENYISIPKAN BARIS SERTIFIKAT. Surat karangan akan lolos
--      saat di-scan di halaman verifikasi, karena halaman itu percaya pada isi
--      tabelnya. Ini melumpuhkan justru fitur yang dibuat untuk membuktikan
--      keaslian.
--
-- KENAPA DULU DIBUKA, DAN KENAPA ITU TIDAK PERLU. Halaman verifikasi QR harus
-- bisa dibuka orang yang tidak punya akun — betul. Tapi halaman itu hanya
-- perlu membaca SATU surat berdasarkan id-nya, bukan boleh membaca semuanya.
-- RLS tidak bisa membedakan "diambil satu" dari "diambil semua" (USING (true)
-- mengizinkan keduanya), jadi jalur publiknya dipindah ke sebuah FUNGSI yang
-- menerima satu id dan hanya mengembalikan yang perlu untuk membuktikan
-- keaslian.
--
-- YANG DIKEMBALIKAN FUNGSI ITU sengaja sempit: nomor dokumen, jenisnya, nama
-- pasien, nama dokter, fasilitas penerbit, tanggal terbit, dan statusnya.
-- TIDAK ADA diagnosis, keperluan, alamat, tanggal lahir, No. RM, maupun daftar
-- obat. Yang perlu dibuktikan orang HRD atau sekolah adalah suratnya asli dan
-- berlaku — bukan sakit apa pasiennya. Untuk sertifikat vaksin, nama vaksinnya
-- ikut karena justru itulah isi yang diverifikasi (mis. meningitis umroh), dan
-- nama itu memang tercetak di lembar yang sedang dipegang si pemeriksa.
--
-- PRASYARAT: supabase-rls-fase-b.sql sudah dijalankan (memakai is_staff(),
-- current_patient_id(), dan _drop_all_policies()).
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

-- ---- Jalur publik: verifikasi SATU dokumen, seperlunya saja ---------------
-- SECURITY DEFINER supaya bisa membaca baris yang RLS-nya kini tertutup, tapi
-- hanya lewat pintu sesempit ini: satu id masuk, sekumpulan kolom tetap keluar.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_id uuid)
RETURNS TABLE (
  id              uuid,
  cert_number     text,
  cert_type       text,
  perihal         text,
  patient_name    text,
  doctor_name     text,
  vaccine_name    text,
  vaccine_brand   text,
  issuer_name     text,
  item_count      int,
  approval_status text,
  issued_at       timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT c.id,
         c.cert_number,
         c.cert_type,
         c.perihal,
         c.patient_name,
         c.doctor_name,
         c.vaccine_name,
         c.vaccine_brand,
         NULLIF(c.details->'kop'->>'name', '')                       AS issuer_name,
         -- Jumlahnya saja, bukan daftar obatnya: yang diverifikasi keaslian
         -- lembarnya, dan lembarnya sudah ada di tangan si pemeriksa.
         CASE WHEN jsonb_typeof(c.details->'items') = 'array'
              THEN jsonb_array_length(c.details->'items') ELSE 0 END AS item_count,
         COALESCE(c.details->'approval'->>'status', 'approved')      AS approval_status,
         c.issued_at
  FROM public.certificates c
  WHERE c.id = p_id;
$fn$;

REVOKE ALL ON FUNCTION public.verify_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(uuid) TO anon, authenticated;

-- ---- Tabelnya sendiri: ditutup seperti tabel klinis lainnya ---------------
SELECT public._drop_all_policies('certificates');

CREATE POLICY "staff_all" ON public.certificates FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "patient_read_own" ON public.certificates FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

-- Pasien MENGUNDUH SENDIRI sertifikat vaksinnya, dan nomornya baru dicetak
-- saat pengunduhan pertama — jadi izin menyisipkan tidak bisa dicabut habis
-- tanpa mematikan fiturnya. Yang dilakukan: dipersempit sampai tidak bisa
-- dipakai memalsukan apa pun.
--
--   • hanya untuk dirinya sendiri;
--   • BUKAN surat keterangan dan bukan resep — dua jenis yang paling menggoda
--     untuk dipalsukan justru tidak bisa dibuat pasien sama sekali;
--   • dan hanya bila vaksinasinya MEMANG ADA dan SUDAH DI-ACC dokter.
--
-- Syarat terakhir itu yang menutup pemalsuan: pasien tidak bisa membuat baris
-- vaksinasi (tabelnya staff-only), jadi ia tidak bisa mengarang sertifikat
-- vaksin yang tidak ada dasarnya.
CREATE POLICY "patient_insert_own_vax" ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = public.current_patient_id()
    AND COALESCE(cert_type, '') NOT IN ('skd', 'resep')
    AND vaccine_name IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.vaccinations v
      WHERE v.patient_id = certificates.patient_id
        AND v.vaccine_name = certificates.vaccine_name
        AND COALESCE(v.approval_status, 'approved') = 'approved'
    )
  );

-- Pasien sengaja TIDAK diberi izin UPDATE. Memperbarui sertifikatnya sendiri
-- berarti bisa menulis ulang isinya — termasuk status ACC pada surat sakit.
-- Akibat sampingannya kecil dan disengaja: saat pasien mengunduh ulang
-- sertifikat vaksinnya setelah dosis berikutnya, penyegaran dose_info tidak
-- ikut tersimpan di server. Lembar yang tercetak tetap benar (disusun dari
-- data vaksinasi saat itu juga), dan barisnya ikut segar begitu petugas
-- membukanya.

-- ---- Pemeriksa ------------------------------------------------------------
-- Harus TIDAK ADA lagi kebijakan yang menyebut anon pada tabel ini.
SELECT policyname, roles::text, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'certificates'
ORDER BY policyname;
