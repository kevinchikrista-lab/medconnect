-- =============================================
-- MedConnect Database Schema for Supabase
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'doctor', 'patient', 'pharmacy')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. DOCTORS
-- =============================================
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  sip_number TEXT,
  specialization TEXT,
  phone TEXT,
  is_available BOOLEAN DEFAULT true,
  schedule JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. PATIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nik TEXT,
  birth_date DATE,
  gender TEXT,
  phone TEXT,
  address TEXT,
  blood_type TEXT,
  allergies TEXT DEFAULT '-',
  emergency_contact TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 4. PHARMACIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  license_no TEXT,
  operating_hours TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 5. MEDICAL RECORDS
-- =============================================
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id),
  doctor_id UUID REFERENCES public.doctors(id),
  visit_date DATE DEFAULT CURRENT_DATE,
  visit_type TEXT DEFAULT 'consultation',
  location TEXT,
  anamnesis TEXT,
  examination TEXT,
  diagnosis TEXT,
  diagnosis_secondary TEXT,
  therapy TEXT,
  vital_signs JSONB DEFAULT '{}',
  follow_up_date DATE,
  follow_up_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 6. PRESCRIPTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rx_number TEXT UNIQUE,
  record_id UUID REFERENCES public.medical_records(id),
  doctor_id UUID REFERENCES public.doctors(id),
  patient_id UUID REFERENCES public.patients(id),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','received','preparing','ready','delivering','completed','rejected','cancelled')),
  notes TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 7. PRESCRIPTION ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  dosage TEXT,
  quantity INTEGER,
  unit TEXT,
  frequency TEXT,
  "time" TEXT,
  duration TEXT,
  instructions TEXT,
  is_compound BOOLEAN DEFAULT false,
  compound_details TEXT,
  display_name TEXT
);

-- =============================================
-- 8. APPOINTMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id),
  doctor_id UUID REFERENCES public.doctors(id),
  date DATE NOT NULL,
  time_slot TEXT,
  type TEXT DEFAULT 'visit',
  status TEXT DEFAULT 'scheduled',
  queue_number INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 9. VACCINATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.vaccinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id),
  vaccine_name TEXT NOT NULL,
  vaccine_brand TEXT,
  vax_mode TEXT DEFAULT 'series' CHECK (vax_mode IN ('series', 'booster')),
  dose_number INTEGER DEFAULT 1,
  total_doses INTEGER DEFAULT 1,
  dose_schedule JSONB DEFAULT '[]',
  booster_interval_months INTEGER,
  date_given DATE,
  next_dose_date DATE,
  batch_number TEXT,
  administered_by UUID REFERENCES public.doctors(id),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 10. HEALTH SERVICES
-- =============================================
CREATE TABLE IF NOT EXISTS public.health_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 11. BOOKINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,
  service_id UUID REFERENCES public.health_services(id),
  service_name TEXT,
  item_name TEXT,
  price INTEGER DEFAULT 0,
  preferred_date DATE,
  preferred_time TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 12. INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  drug_name TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  unit TEXT,
  min_stock INTEGER DEFAULT 0,
  expiry_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 13. NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'system',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow anon read for health_services (public catalog)
CREATE POLICY "Public can view active services" ON public.health_services
  FOR SELECT USING (is_active = true);

-- Allow authenticated users full access (simplified for MVP)
-- In production, these should be more granular per role
CREATE POLICY "Authenticated full access profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access doctors" ON public.doctors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access patients" ON public.patients
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access pharmacies" ON public.pharmacies
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access medical_records" ON public.medical_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access prescriptions" ON public.prescriptions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access prescription_items" ON public.prescription_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access appointments" ON public.appointments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access vaccinations" ON public.vaccinations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access health_services_all" ON public.health_services
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access bookings" ON public.bookings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access inventory" ON public.inventory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access notifications" ON public.notifications
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_patients_nik ON public.patients(nik);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON public.medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor ON public.medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON public.prescriptions(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_patient ON public.vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
