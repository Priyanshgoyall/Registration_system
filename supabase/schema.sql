-- ============================================================
-- Student Registration System - Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Students
CREATE TABLE IF NOT EXISTS public.students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT NOT NULL,
  school_name   TEXT NOT NULL,
  city          TEXT,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS city TEXT;

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registrations
CREATE TABLE IF NOT EXISTS public.registrations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id            UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id            UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  class                 TEXT,
  email                 TEXT,
  city                  TEXT,
  registration_id       TEXT NOT NULL UNIQUE,
  registration_status   TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending','confirmed','cancelled')),
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, session_id)
);

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id   UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  attendance_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status            TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  UNIQUE(registration_id, attendance_date)
);

-- Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id       UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  certificate_id        TEXT NOT NULL UNIQUE,
  certificate_url       TEXT,
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_status   TEXT NOT NULL DEFAULT 'valid' CHECK (verification_status IN ('valid','revoked')),
  UNIQUE(registration_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students(phone);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON public.registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_session_id ON public.registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_registration_id ON public.attendance(registration_id);
CREATE INDEX IF NOT EXISTS idx_certificates_registration_id ON public.certificates(registration_id);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_id ON public.certificates(certificate_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Helper: check if caller is an admin (has email confirmed = admin role)
-- We use a simple approach: admins are authenticated users.
-- The anon role can INSERT students (registration kiosk) and read certificates (verification).

-- STUDENTS: Anon can insert (kiosk registration) and read (success page, public card).
-- Auth can read/update/delete (admin).
CREATE POLICY "anon_insert_students" ON public.students
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_read_students" ON public.students
  FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_students" ON public.students
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SESSIONS: Anon can read active sessions. Auth can do all.
CREATE POLICY "anon_read_active_sessions" ON public.sessions
  FOR SELECT TO anon USING (status = 'active');

CREATE POLICY "auth_all_sessions" ON public.sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- REGISTRATIONS: Anon can insert and read (for success page). Auth can do all.
CREATE POLICY "anon_insert_registrations" ON public.registrations
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_read_registrations" ON public.registrations
  FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_registrations" ON public.registrations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ATTENDANCE: Auth only.
CREATE POLICY "auth_all_attendance" ON public.attendance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CERTIFICATES: Anon can read (for verification). Auth can do all.
CREATE POLICY "anon_read_certificates" ON public.certificates
  FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_certificates" ON public.certificates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- student-photos bucket: anon can upload, anyone can read
CREATE POLICY "anon_upload_photos" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'student-photos');

CREATE POLICY "public_read_photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'student-photos');

CREATE POLICY "auth_manage_photos" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'student-photos');

-- certificates bucket: auth can upload, anyone can read
CREATE POLICY "anon_read_certs_storage" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'certificates');

CREATE POLICY "auth_manage_certs_storage" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'certificates');

-- ============================================================
-- USER PROFILES & COORDINATORS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'coordinator',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_user_profiles" ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_user_profiles" ON public.user_profiles
  FOR SELECT TO anon USING (true);

