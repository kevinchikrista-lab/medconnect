-- =============================================
-- PENINJAUAN HASIL KERJA untuk tugas yang DIDELEGASIKAN.
--
--     todo  →  focus  →  review  →  done
--
-- Aturannya: pekerjaan yang didelegasikan tidak boleh ditutup sendiri oleh
-- orang yang mengerjakannya. Dia hanya bisa MENGAJUKANNYA ("Mohon Peninjauan
-- Hasil Kerja"); yang menekan Selesai adalah PEMBERI tugasnya. Tanpa itu,
-- "selesai" hanya berarti "saya merasa sudah selesai", dan pemberi tugas
-- kehilangan satu-satunya saat untuk memeriksa hasilnya.
--
-- Yang meninjau adalah created_by (pemberi tugasnya), bukan Super Admin mana
-- pun — supaya tugas dari Anis ditinjau Anis, tidak tidak sengaja ditutup
-- orang lain yang tidak tahu isi pekerjaannya.
--
-- Tugas untuk DIRI SENDIRI (assignee_id kosong, atau sama dengan created_by)
-- tidak lewat jalur ini: tidak ada gunanya meminta izin kepada diri sendiri.
--
-- Prasyarat: supabase-tasks.sql dan supabase-task-status.sql sudah dijalankan.
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

-- Kapan hasil kerjanya diajukan — dipakai untuk mengurutkan antrean tinjauan
-- dan melihat mana yang sudah lama menggantung menunggu keputusan.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

-- Satu kotak catatan yang dipakai bergantian oleh kedua arah percakapan:
-- ringkasan hasil kerja saat diajukan, lalu alasan perbaikan saat
-- dikembalikan. Sengaja satu kolom, bukan tabel riwayat — yang dibutuhkan
-- hanya "apa yang perlu dibereskan sekarang", bukan arsip perdebatannya.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS review_note text;

-- Antrean "menunggu ditinjau", diambil per peninjau.
CREATE INDEX IF NOT EXISTS idx_tasks_review
  ON public.tasks (created_by, review_requested_at) WHERE status = 'review';

-- ---- Penegakan di server -------------------------------------------------
-- Tombolnya sudah disembunyikan di aplikasi, tapi itu hanya tampilan. Baris
-- di bawah ini yang membuat aturannya benar-benar berlaku: seorang penerima
-- tugas TIDAK BISA menyimpan barisnya dalam keadaan 'done' bila tugas itu
-- dibuatkan orang lain untuknya.
--
-- Perhatikan batasnya: kebijakan ini mengikat staf biasa (dokter, apotek,
-- admin). Super Admin / Owner tetap lolos lewat kebijakan admin_write yang
-- memberi mereka kuasa penuh atas tabel ini — jadi bagi sesama Super Admin,
-- aturan "yang menutup adalah pemberi tugas" ditegakkan aplikasinya saja,
-- bukan servernya. Itu memang konsekuensi dari memberi mereka hak admin.
DROP POLICY IF EXISTS "assignee_update" ON public.tasks;
CREATE POLICY "assignee_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assignee_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()))
  WITH CHECK (
    assignee_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid())
    AND NOT (status = 'done' AND created_by IS NOT NULL AND created_by <> assignee_id)
  );

SELECT status,
       count(*)                                        AS jumlah,
       count(*) FILTER (WHERE created_by IS NOT NULL
                          AND assignee_id IS NOT NULL
                          AND created_by <> assignee_id) AS didelegasikan,
       count(*) FILTER (WHERE review_note IS NOT NULL AND review_note <> '') AS ada_catatan
FROM public.tasks GROUP BY status ORDER BY status;
