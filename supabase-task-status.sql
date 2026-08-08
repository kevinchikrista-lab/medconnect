-- =============================================
-- PAPAN TUGAS 4 KOLOM: To-Do / Fokus Sekarang / Delegasi / Selesai.
--
-- Sebelumnya sebuah tugas hanya punya dua keadaan: 'open' dan 'done'.
-- Sekarang ada tahap ketiga di tengah, yaitu "sedang dikerjakan":
--
--     todo  →  focus  →  done
--
-- "Delegasi" SENGAJA bukan nilai status, karena dia bukan tahapan melainkan
-- keterangan siapa yang mengerjakan (kolom assignee_id yang sudah ada).
-- Kalau dijadikan status, tugas yang sudah didelegasikan DAN sedang dikerjakan
-- penerimanya tidak punya tempat yang benar. Dengan cara ini satu baris tugas
-- dilihat berbeda tergantung siapa yang membuka:
--   - di papan pemberi tugas  → kolom Delegasi (dengan tanda "sedang dikerjakan")
--   - di papan penerimanya    → kolom To-Do / Fokus miliknya sendiri
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

-- Kapan tugas mulai dikerjakan — dipakai untuk menandai "sudah dikerjakan
-- sejak ..." pada kolom Delegasi, supaya terlihat mana yang mandek.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS focus_at timestamptz;

-- Baris lama bernilai 'open'. Artinya sama dengan 'todo', jadi tinggal
-- diganti namanya. (Aplikasi tetap membaca 'open' sebagai 'todo' seandainya
-- ada baris yang terlewat, jadi tidak ada yang hilang.)
UPDATE public.tasks SET status = 'todo' WHERE status = 'open' OR status IS NULL;

ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'todo';

-- Papan mengambil tugas yang belum selesai lalu memilahnya per kolom.
DROP INDEX IF EXISTS public.idx_tasks_open_due;
CREATE INDEX IF NOT EXISTS idx_tasks_board
  ON public.tasks (status, due_date) WHERE status <> 'done';

-- Kolom Selesai hanya menampilkan 30 hari terakhir secara bawaan.
CREATE INDEX IF NOT EXISTS idx_tasks_done_at
  ON public.tasks (completed_at DESC) WHERE status = 'done';

SELECT status, count(*) AS jumlah
FROM public.tasks GROUP BY status ORDER BY status;
