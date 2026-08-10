-- =============================================
-- EVENT pada papan To-Do & Tugas.
--
-- Sebuah baris `tasks` kini bisa berupa dua hal:
--   kind = 'task'   : pekerjaan — dikerjakan seseorang, punya jatuh tempo
--   kind = 'event'  : acara/pertemuan — TERJADI pada jam tertentu, di suatu
--                     tempat, dan bisa dihadiri LEBIH DARI SATU orang
--
-- Kenapa satu tabel, bukan tabel baru: keduanya sama-sama muncul di papan,
-- di kalender, dan di daftar "jangan terlewat"; keduanya punya jatuh tempo,
-- prioritas, catatan, dan bisa berulang. Memisah tabel berarti menulis ulang
-- semua itu dua kali dan berisiko keduanya jadi tidak sinkron.
--
-- Bedanya:
--   - Tugas dipegang SATU orang     → assignee_id (kolom lama)
--   - Event dihadiri BANYAK orang   → attendee_ids (kolom baru, daftar uuid)
--
-- due_date & due_time dipakai ulang sebagai tanggal & jam MULAI acara, supaya
-- event otomatis ikut muncul di kalender dan di panel "Jangan terlewat"
-- tanpa perlu jalur baru.
--
-- Jalankan sekali di Supabase SQL editor. Aman diulang.
-- =============================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kind         text  DEFAULT 'task',            -- task | event
  ADD COLUMN IF NOT EXISTS attendee_ids jsonb DEFAULT '[]'::jsonb,       -- peserta event (profiles.id)
  ADD COLUMN IF NOT EXISTS end_time     text  DEFAULT '',                -- jam selesai, "HH:MM"
  ADD COLUMN IF NOT EXISTS location     text  DEFAULT '';                -- tempat / tautan rapat daring

-- Baris lama semuanya pekerjaan biasa.
UPDATE public.tasks SET kind = 'task'          WHERE kind IS NULL;
UPDATE public.tasks SET attendee_ids = '[]'::jsonb WHERE attendee_ids IS NULL;

-- Papan menyaring event dan tugas secara terpisah pada beberapa tampilan.
CREATE INDEX IF NOT EXISTS idx_tasks_kind
  ON public.tasks (kind, due_date) WHERE status <> 'done';

-- Mencari "event yang saya hadiri" berarti mencari di dalam daftar peserta.
CREATE INDEX IF NOT EXISTS idx_tasks_attendees
  ON public.tasks USING gin (attendee_ids);

-- CATATAN HAK AKSES: kebijakan "assignee_update" yang sudah ada hanya mengenal
-- assignee_id, sehingga peserta event tidak bisa menandai kehadirannya sendiri.
-- Kebijakan di bawah menambahkan itu — peserta boleh mengubah baris event yang
-- dia hadiri, dan tetap tidak bisa mengeluarkan dirinya dari daftar peserta
-- maupun mengalihkannya ke orang lain (WITH CHECK menuntut dirinya tetap ada
-- di dalam daftar).
DROP POLICY IF EXISTS "attendee_update" ON public.tasks;
CREATE POLICY "attendee_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    kind = 'event'
    AND attendee_ids ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
  )
  WITH CHECK (
    kind = 'event'
    AND attendee_ids ?| ARRAY(SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid())
  );

SELECT kind,
       count(*) AS jumlah,
       count(*) FILTER (WHERE jsonb_array_length(COALESCE(attendee_ids, '[]'::jsonb)) > 0) AS ada_peserta
FROM public.tasks GROUP BY kind ORDER BY kind;
