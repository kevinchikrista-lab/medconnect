-- =============================================================================
-- KOLOM INBOX PADA PAPAN TUGAS.
--
-- CATATAN PENTING: MIGRASI INI OPSIONAL.
--
-- Inbox tidak memakai kolom baru. Ia hanya nilai baru pada tasks.status —
-- 'inbox' di samping 'todo', 'focus', 'review', 'done' — dan kolom itu
-- bertipe TEXT tanpa CHECK, jadi fiturnya sudah jalan tanpa menjalankan
-- apa pun di sini. Berkas ini hanya menambahkan indeks dan keterangan.
-- Jalankan kalau sempat; tidak ada yang rusak kalau ditunda.
--
-- KENAPA ADA KOLOM INI. Ide datang pada saat yang tidak menyenangkan: di
-- tengah praktik, di perjalanan, sedetik sebelum tidur. Kalau mencatatnya
-- menuntut tanggal dan penerima lebih dulu, yang terjadi bukan catatan yang
-- lebih rapi — yang terjadi adalah tidak dicatat sama sekali.
--
-- Harganya dibayar di pintu KELUAR, bukan di pintu masuk: sebuah tugas baru
-- boleh meninggalkan Inbox setelah punya setidaknya tanggal ATAU penerima
-- (untuk acara: tanggal atau peserta). Aturan itu ditegakkan aplikasi di
-- store.taskIsClarified — sengaja TIDAK dijadikan CHECK di sini, karena
-- baris berstatus 'focus' yang tanggalnya belakangan dikosongkan memang
-- dibiarkan apa adanya: pekerjaannya sudah berjalan, dan menyeretnya kembali
-- ke penampungan hanya akan membuatnya hilang dari pandangan.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================================================

COMMENT ON COLUMN public.tasks.status IS
  'inbox | todo | focus | review | done. inbox = ditangkap cepat, belum punya tanggal maupun penerima. Baris lama bernilai open dibaca sebagai todo.';

-- Kolom Inbox diambil sebagai satu daftar utuh dan diurutkan dari yang paling
-- lama mengendap, jadi penyaringnya status dan umurnya, bukan jatuh tempo
-- (yang memang belum ada).
CREATE INDEX IF NOT EXISTS idx_tasks_inbox
  ON public.tasks (created_by, created_at)
  WHERE status = 'inbox';

-- ---- Pemeriksa ------------------------------------------------------------
-- Isi Inbox per orang, beserta yang paling lama mengendap.
SELECT COALESCE(p.full_name, '(tanpa nama)')            AS pemilik,
       count(*)                                         AS di_inbox,
       max(CURRENT_DATE - t.created_at::date)           AS paling_lama_hari
FROM public.tasks t
LEFT JOIN public.profiles p ON p.id = t.created_by
WHERE t.status = 'inbox'
GROUP BY 1
ORDER BY 2 DESC;

-- Yang HARUS kosong: tugas di luar Inbox yang belum punya tanggal maupun
-- penerima — kecuali yang sedang dikerjakan atau menunggu tinjauan, yang
-- memang sengaja dibiarkan (lihat penjelasan di atas).
SELECT id, title, status
FROM public.tasks
WHERE status = 'todo'
  AND due_date IS NULL
  AND assignee_id IS NULL;
