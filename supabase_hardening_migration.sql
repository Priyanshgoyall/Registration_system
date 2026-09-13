-- ====================================================================
-- HARDENED SUPABASE RLS & RPC MIGRATION SCRIPT
-- Target Capacity: ~1,000 to 10,000+ Students & Registrations
-- Run this in Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. Ensure user_profiles table exists
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'coordinator',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS across all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 2. Drop open anonymous SELECT policies that expose full database tables (USING true)
DROP POLICY IF EXISTS "anon_read_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "anon_read_certificates" ON public.certificates;
DROP POLICY IF EXISTS "anon_read_students" ON public.students;
DROP POLICY IF EXISTS "anon_read_registrations" ON public.registrations;
DROP POLICY IF EXISTS "anon_read_sessions" ON public.sessions;

-- 3. Define Hardened RLS Policies

-- user_profiles: Only authenticated users (Admins & Coordinators) can access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'auth_user_profiles_all') THEN
    CREATE POLICY "auth_user_profiles_all" ON public.user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- sessions: Anonymous can read active sessions only; authenticated full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'anon_read_active_sessions') THEN
    CREATE POLICY "anon_read_active_sessions" ON public.sessions FOR SELECT TO anon USING (status = 'active');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'auth_sessions_all') THEN
    CREATE POLICY "auth_sessions_all" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- students: Anonymous can INSERT (for kiosk registration); authenticated full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'anon_insert_students') THEN
    CREATE POLICY "anon_insert_students" ON public.students FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'auth_students_all') THEN
    CREATE POLICY "auth_students_all" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- registrations: Anonymous can INSERT; authenticated full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registrations' AND policyname = 'anon_insert_registrations') THEN
    CREATE POLICY "anon_insert_registrations" ON public.registrations FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registrations' AND policyname = 'auth_registrations_all') THEN
    CREATE POLICY "auth_registrations_all" ON public.registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- certificates: Authenticated full access only (Anonymous reads via verify_certificate RPC function)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'auth_certificates_all') THEN
    CREATE POLICY "auth_certificates_all" ON public.certificates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;


-- 4. RPC Functions for Secure Anonymous Access without Table Scanning

-- Single Certificate Verification RPC (Replaces SELECT * FROM certificates for anon)
CREATE OR REPLACE FUNCTION public.verify_certificate(p_cert_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', c.id,
    'certificate_id', c.certificate_id,
    'issued_at', c.issued_at,
    'verification_status', c.verification_status,
    'registrations', jsonb_build_object(
      'registration_id', r.registration_id,
      'class', r.class,
      'registration_status', r.registration_status,
      'students', jsonb_build_object(
        'name', s.name,
        'school_name', s.school_name
      ),
      'sessions', jsonb_build_object(
        'name', sess.name,
        'start_date', sess.start_date,
        'end_date', sess.end_date
      )
    )
  ) INTO result
  FROM public.certificates c
  JOIN public.registrations r ON r.id = c.registration_id
  JOIN public.students s ON s.id = r.student_id
  JOIN public.sessions sess ON sess.id = r.session_id
  WHERE UPPER(c.certificate_id) = UPPER(TRIM(p_cert_id));

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;


-- Public Single Registration Fetching RPC (For /success/:registrationId page)
CREATE OR REPLACE FUNCTION public.get_registration_public(p_reg_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'registration_id', r.registration_id,
    'class', r.class,
    'email', r.email,
    'city', r.city,
    'registration_status', r.registration_status,
    'registered_at', r.registered_at,
    'students', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'email', s.email,
      'phone', s.phone,
      'school_name', s.school_name,
      'city', s.city,
      'photo_url', s.photo_url
    ),
    'sessions', jsonb_build_object(
      'id', sess.id,
      'name', sess.name,
      'start_date', sess.start_date,
      'end_date', sess.end_date
    )
  ) INTO result
  FROM public.registrations r
  JOIN public.students s ON s.id = r.student_id
  JOIN public.sessions sess ON sess.id = r.session_id
  WHERE r.registration_id = TRIM(p_reg_id);

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_registration_public(text) TO anon, authenticated;


-- Registration Duplicate Check RPC (Checks email AND phone for active session)
CREATE OR REPLACE FUNCTION public.check_existing_registration(
  p_email text,
  p_phone text,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_exists boolean := false;
  phone_exists boolean := false;
  existing_reg_id text;
BEGIN
  -- Check email
  SELECT registration_id INTO existing_reg_id
  FROM public.registrations
  WHERE LOWER(email) = LOWER(TRIM(p_email))
    AND session_id = p_session_id
    AND registration_status != 'cancelled'
  LIMIT 1;

  IF existing_reg_id IS NOT NULL THEN
    email_exists := true;
  END IF;

  -- Check normalized phone
  IF p_phone IS NOT NULL AND TRIM(p_phone) != '' THEN
    SELECT r.registration_id INTO existing_reg_id
    FROM public.registrations r
    JOIN public.students s ON s.id = r.student_id
    WHERE s.phone = TRIM(p_phone)
      AND r.session_id = p_session_id
      AND r.registration_status != 'cancelled'
    LIMIT 1;

    IF existing_reg_id IS NOT NULL THEN
      phone_exists := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'email_exists', email_exists,
    'phone_exists', phone_exists,
    'existing_reg_id', existing_reg_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_existing_registration(text, text, uuid) TO anon, authenticated;


-- Coordinator Account Pre-Check RPC
CREATE OR REPLACE FUNCTION public.check_coordinator_profile(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prof record;
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.user_profiles;

  SELECT full_name, is_active INTO prof
  FROM public.user_profiles
  WHERE LOWER(email) = LOWER(TRIM(p_email));

  IF prof IS NOT NULL THEN
    RETURN jsonb_build_object(
      'exists', true,
      'is_active', prof.is_active,
      'full_name', prof.full_name,
      'total_profiles', total_count
    );
  ELSE
    RETURN jsonb_build_object(
      'exists', false,
      'is_active', false,
      'total_profiles', total_count
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_coordinator_profile(text) TO anon, authenticated;


-- 5. Database Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_student_id ON public.registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_registrations_session_id ON public.registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(registration_status);

CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students(phone);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);

CREATE INDEX IF NOT EXISTS idx_certificates_registration_id ON public.certificates(registration_id);
CREATE INDEX IF NOT EXISTS idx_certificates_cert_id ON public.certificates(certificate_id);

CREATE INDEX IF NOT EXISTS idx_attendance_registration_id ON public.attendance(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);

SELECT 'Hardened security & RPC migration applied successfully' AS status;
