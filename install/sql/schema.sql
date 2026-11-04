-- Assist AR application schema. Safe to run more than once.
-- Applied by ./install.sh after the sign-in service has created its own tables.

-- ---------------------------------------------------------------- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL UNIQUE,
  display_name text,
  role         text DEFAULT 'customer',
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  public_id    char(11) UNIQUE,
  CONSTRAINT profiles_role_check
    CHECK (role IS NULL OR role IN ('customer', 'technician', 'expert', 'admin'))
);

-- ---------------------------------------------------------------- sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code     text NOT NULL UNIQUE,
  room_name     text NOT NULL,
  customer_id   uuid NOT NULL REFERENCES public.profiles(id),
  technician_id uuid REFERENCES public.profiles(id),
  status        text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'active', 'ended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id   ON public.sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_technician_id ON public.sessions (technician_id);

-- ---------------------------------------------------------------- models
CREATE TABLE IF NOT EXISTS public.models (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  url             text NOT NULL,
  thumbnail_url   text,
  file_size_bytes bigint NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- functions
CREATE OR REPLACE FUNCTION public.generate_public_id() RETURNS char
LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  new_id char(11);
  done bool;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_id := lpad((floor(random() * 90000000000) + 10000000000)::bigint::text, 11, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_public_id() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := public.generate_public_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Every new sign-up becomes a CUSTOMER, whatever the client sends.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_public_id ON public.profiles;
CREATE TRIGGER profiles_assign_public_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_id();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------- row security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Customers can create sessions"        ON public.sessions;
DROP POLICY IF EXISTS "Participants can read own sessions"   ON public.sessions;
DROP POLICY IF EXISTS "Participants can update own sessions" ON public.sessions;
CREATE POLICY "Customers can create sessions" ON public.sessions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = customer_id);
CREATE POLICY "Participants can read own sessions" ON public.sessions
  FOR SELECT USING ((SELECT auth.uid()) = customer_id OR (SELECT auth.uid()) = technician_id);
CREATE POLICY "Participants can update own sessions" ON public.sessions
  FOR UPDATE USING ((SELECT auth.uid()) = customer_id OR (SELECT auth.uid()) = technician_id);

DROP POLICY IF EXISTS "Authenticated users can read active models" ON public.models;
CREATE POLICY "Authenticated users can read active models" ON public.models
  FOR SELECT USING (is_active = true AND (SELECT auth.role()) = 'authenticated');

-- ---------------------------------------------------------------- privileges
-- Signed-in users must never be able to change their own role (that would let a
-- customer make themselves an admin). Only the server (service role) may.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

REVOKE ALL ON public.sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;

REVOKE ALL ON public.models FROM anon, authenticated;
GRANT SELECT ON public.models TO authenticated;

GRANT ALL ON public.profiles, public.sessions, public.models TO service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
