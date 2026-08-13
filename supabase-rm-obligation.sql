-- =============================================
-- KEWAJIBAN REKAM MEDIS.
--
-- Resep dan surat keterangan adalah TINDAKAN MEDIS. Begitu dokter meng-ACC
-- salah satunya, ia sudah membuat keputusan klinis atas nama pasien itu — dan
-- keputusan klinis harus ada rekam medisnya. Resep atau surat yang tidak punya
-- rekam medis adalah tindakan tanpa dasar tertulis: tidak bisa ditelusuri,
-- tidak bisa dipertanggungjawabkan bila dipersoalkan, dan membuat riwayat
-- pasiennya bolong justru di bagian yang paling penting.
--
-- Untuk resep, penghubungnya SUDAH ADA: prescriptions.record_id. Resep yang
-- ditulis dokter dari sebuah kunjungan otomatis terisi. Yang kosong adalah
-- resep yang lahir dari apotek — dan sejak apotek boleh menyusun resep,
-- lubang itu bertambah besar.
--
-- Surat keterangan belum punya penghubungnya sama sekali. Itu yang ditambahkan
-- file ini: SATU kolom, certificates.record_id.
--
-- DIHITUNG SEBAGAI KEWAJIBAN HANYA YANG SUDAH SAH. Resep atau surat yang masih
-- menunggu ACC, atau yang ditolak, belum menjadi tindakan apa pun — belum ada
-- yang harus dicatat. Ini penting: kalau yang menunggu ikut dihitung, daftar
-- kewajibannya penuh oleh hal-hal yang mungkin tidak pernah jadi, dan daftar
-- yang penuh hal tak penting adalah daftar yang berhenti dibaca.
--
-- TIDAK MEMBLOKIR APA PUN. Kewajiban ini ditampilkan sebagai daftar kerja
-- beserta angkanya di menu dokter, bukan sebagai penghalang penerbitan resep
-- atau surat berikutnya. Menahan pelayanan pasien hari ini karena catatan
-- pasien kemarin belum ditulis memindahkan akibatnya ke orang yang salah.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS record_id uuid;

COMMENT ON COLUMN public.certificates.record_id IS
  'medical_records.id yang menjadi dasar tertulis surat ini. Kosong = kewajiban rekam medis dokternya belum dilunasi.';

-- Menelusuri "surat yang belum punya RM", diambil per dokter.
CREATE INDEX IF NOT EXISTS idx_certificates_tanpa_rm
  ON public.certificates (cert_type, issued_at DESC)
  WHERE record_id IS NULL;

-- Dan padanannya untuk resep. Kolomnya sudah ada; yang belum ada indeksnya.
CREATE INDEX IF NOT EXISTS idx_prescriptions_tanpa_rm
  ON public.prescriptions (doctor_id, created_at DESC)
  WHERE record_id IS NULL;

-- ---- Pemeriksa: berapa kewajiban tiap dokter, dan yang tertua sejak kapan --
-- Sengaja MENGHITUNG YANG SAH SAJA, sama seperti aplikasinya: approval_status
-- 'approved' untuk resep, details->approval->>'status' 'approved' untuk surat
-- (baris lama tanpa kolom itu memang sudah sah sejak awal).
WITH resep AS (
  SELECT rx.doctor_id,
         count(*)          AS jumlah,
         min(rx.created_at) AS tertua
  FROM public.prescriptions rx
  WHERE rx.record_id IS NULL
    AND COALESCE(rx.approval_status, 'approved') = 'approved'
    AND COALESCE(rx.status, '') <> 'cancelled'
    AND rx.doctor_id IS NOT NULL
  GROUP BY rx.doctor_id
),
surat AS (
  SELECT d.id            AS doctor_id,
         count(*)        AS jumlah,
         min(c.issued_at) AS tertua
  FROM public.certificates c
  JOIN public.doctors d
    ON d.id::text = COALESCE(c.details->'approval'->>'doctor_id', '')
   OR (COALESCE(c.details->'approval'->>'doctor_id', '') = ''
       AND lower(d.full_name) = lower(COALESCE(c.doctor_name, '')))
  WHERE c.cert_type = 'skd'
    AND c.record_id IS NULL
    AND COALESCE(c.details->'approval'->>'status', 'approved') = 'approved'
  GROUP BY d.id
)
SELECT d.full_name                                   AS dokter,
       COALESCE(r.jumlah, 0)                         AS resep_tanpa_rm,
       COALESCE(s.jumlah, 0)                         AS surat_tanpa_rm,
       COALESCE(r.jumlah, 0) + COALESCE(s.jumlah, 0) AS total_kewajiban,
       LEAST(COALESCE(r.tertua, now()), COALESCE(s.tertua, now()))::date AS tertunggak_sejak
FROM public.doctors d
LEFT JOIN resep r ON r.doctor_id = d.id
LEFT JOIN surat s ON s.doctor_id = d.id
WHERE COALESCE(r.jumlah, 0) + COALESCE(s.jumlah, 0) > 0
ORDER BY total_kewajiban DESC;
