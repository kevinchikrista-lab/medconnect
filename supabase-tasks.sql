-- =============================================
-- TO-DO / DAFTAR TUGAS (mirip Todoist) + DELEGASI KE STAF.
--
-- Dipakai oleh halaman Super Admin/Owner "To-Do & Tugas" (#/admin/tasks) dan
-- halaman "Tugas Saya" (#/tugas) yang bisa dibuka semua staf (dokter, apotek,
-- admin) untuk melihat tugas yang didelegasikan kepadanya.
--
-- Fitur yang didukung kolom di bawah:
--   - Prioritas + jatuh tempo (priority, due_date, due_time)
--   - Tugas berulang            (recurrence, recurrence_interval)
--   - Sub-tugas / checklist     (subtasks JSONB)
--   - Pengingat WhatsApp        (wa_count, wa_last_at)
--   - Delegasi ke staf          (assignee_id → profiles.id)
--
-- Prasyarat: fungsi public.is_staff() sudah ada (dari RLS Fase B).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),

  title text NOT NULL,
  notes text,
  category text,                                   -- label bebas, mis. "Perizinan", "Stok"

  priority text DEFAULT 'normal',                  -- urgent | high | normal | low
  due_date date,                                   -- kosong = tanpa jatuh tempo ("Nanti")
  due_time text,                                   -- jam "HH:MM" (teks, bukan time, agar '' aman)

  status text DEFAULT 'open',                      -- open | done
  completed_at timestamptz,
  completed_by uuid,                               -- profiles.id yang menyelesaikan

  assignee_id uuid,                                -- profiles.id penerima tugas (NULL = untuk diri sendiri)
  created_by uuid,                                 -- profiles.id pembuat tugas

  -- Tugas berulang. Saat sebuah tugas berulang dicentang selesai, aplikasi
  -- membuat salinan barunya dengan jatuh tempo digeser sesuai aturan ini.
  recurrence text DEFAULT 'none',                  -- none | daily | weekly | monthly | yearly
  recurrence_interval int DEFAULT 1,               -- tiap berapa hari/minggu/bulan/tahun

  -- Checklist di dalam satu tugas: [{ "text": "...", "done": false }, ...]
  subtasks jsonb DEFAULT '[]'::jsonb,

  -- Jejak pengingat WhatsApp (tombol WA hanya membuka wa.me, tidak mengirim
  -- otomatis — kolom ini mencatat berapa kali staf menekannya).
  wa_count int DEFAULT 0,
  wa_last_at timestamptz,

  sort_order int DEFAULT 100
);

-- Tampilan utama dikelompokkan per waktu (Terlambat / Hari Ini / Besok /
-- Minggu Ini / Nanti), jadi hampir semua query menyaring tugas yang belum
-- selesai lalu mengurutkannya berdasarkan jatuh tempo.
CREATE INDEX IF NOT EXISTS idx_tasks_open_due
  ON public.tasks (due_date) WHERE status = 'open';

-- "Tugas Saya" mengambil baris milik satu penerima.
CREATE INDEX IF NOT EXISTS idx_tasks_assignee
  ON public.tasks (assignee_id, status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Semua staf boleh membaca. Daftar tugas klinik memang dimaksudkan terbuka
-- antar staf (dokter perlu tahu tugas admin dan sebaliknya); yang dibatasi
-- adalah siapa yang boleh membuat/menghapus, bukan siapa yang boleh melihat.
DROP POLICY IF EXISTS "staff_read" ON public.tasks;
CREATE POLICY "staff_read" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_staff());

-- Membuat, mengubah apa pun, dan menghapus: hanya Super Admin / Owner.
DROP POLICY IF EXISTS "admin_write" ON public.tasks;
CREATE POLICY "admin_write" ON public.tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.auth_id = auth.uid() AND p.role IN ('superadmin','owner')));

-- Penerima tugas boleh MENGUBAH tugasnya sendiri (mencentang selesai,
-- mencentang sub-tugas). Dia tidak bisa membuat tugas baru maupun menghapus,
-- dan tidak bisa melempar tugas ke orang lain karena baris hasil ubahannya
-- tetap harus atas namanya sendiri (WITH CHECK di bawah).
DROP POLICY IF EXISTS "assignee_update" ON public.tasks;
CREATE POLICY "assignee_update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assignee_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()))
  WITH CHECK (assignee_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()));

-- Saat sebuah tugas BERULANG dicentang selesai, aplikasi membuat salinan
-- berikutnya atas nama penerima yang sama. Kalau yang mencentang adalah staf
-- (bukan admin), insert itu akan ditolak oleh admin_write — jadi staf boleh
-- menambah baris SELAMA tugasnya untuk dirinya sendiri. Dia tetap tidak bisa
-- melempar tugas ke orang lain (WITH CHECK mengunci assignee_id ke dirinya).
DROP POLICY IF EXISTS "assignee_insert_own" ON public.tasks;
CREATE POLICY "assignee_insert_own" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (assignee_id IN (SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid()));

SELECT status, priority, count(*) AS jumlah
FROM public.tasks GROUP BY status, priority ORDER BY status, priority;
