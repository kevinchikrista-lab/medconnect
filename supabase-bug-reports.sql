-- =============================================
-- Tabel LAPORAN BUG (in-app).
-- Siapa pun (login atau belum) boleh MENGIRIM laporan;
-- hanya STAF (non-pasien) yang boleh MELIHAT & mengelola.
-- Prasyarat: fungsi public.is_staff() sudah ada (dari RLS Fase B).
-- Jalankan sekali di Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  page text,
  description text NOT NULL,
  reporter_email text,
  reporter_role text,
  reporter_profile_id uuid,
  status text DEFAULT 'open',          -- 'open' | 'resolved'
  resolved_at timestamptz
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Siapa pun boleh MENGIRIM laporan.
DROP POLICY IF EXISTS "report_insert" ON public.bug_reports;
CREATE POLICY "report_insert" ON public.bug_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Hanya STAF yang boleh MELIHAT & MENGELOLA laporan.
DROP POLICY IF EXISTS "staff_read"   ON public.bug_reports;
CREATE POLICY "staff_read" ON public.bug_reports
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "staff_manage" ON public.bug_reports;
CREATE POLICY "staff_manage" ON public.bug_reports
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

SELECT 'Tabel bug_reports siap — laporan bug kini tersimpan di aplikasi' as status;
