-- Roles inside a workspace
CREATE TYPE public.member_role AS ENUM ('admin', 'operator');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORKSPACES
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  timezone text NOT NULL DEFAULT 'America/Belem',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- MEMBERS
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'operator',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX members_user_idx ON public.members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id uuid, _role public.member_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid() AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members a
    JOIN public.members b ON a.workspace_id = b.workspace_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  )
$$;

-- Policies: profiles
CREATE POLICY "Ver o próprio perfil e de colegas" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_workspace_with(id));
CREATE POLICY "Editar o próprio perfil" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Policies: workspaces
CREATE POLICY "Membros veem o workspace" ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_workspace_member(id));
CREATE POLICY "Admins editam o workspace" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.has_workspace_role(id, 'admin'))
  WITH CHECK (public.has_workspace_role(id, 'admin'));
CREATE POLICY "Admins excluem o workspace" ON public.workspaces
  FOR DELETE TO authenticated USING (public.has_workspace_role(id, 'admin'));

-- Policies: members
CREATE POLICY "Membros veem a equipe" ON public.members
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins adicionam membros" ON public.members
  FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));
CREATE POLICY "Admins alteram papéis" ON public.members
  FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin'))
  WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));
CREATE POLICY "Admins removem membros ou o próprio usuário sai" ON public.members
  FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin') OR user_id = auth.uid());

-- Keep at least one admin per workspace
CREATE OR REPLACE FUNCTION public.ensure_workspace_has_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ws uuid := OLD.workspace_id;
BEGIN
  IF OLD.role = 'admin' AND (TG_OP = 'DELETE' OR NEW.role <> 'admin') THEN
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = ws) AND NOT EXISTS (
      SELECT 1 FROM public.members WHERE workspace_id = ws AND role = 'admin' AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'O workspace precisa ter pelo menos um administrador.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER members_keep_admin BEFORE UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_workspace_has_admin();

-- Create a workspace and become its admin
CREATE OR REPLACE FUNCTION public.create_workspace(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  INSERT INTO public.workspaces (name, created_by)
  VALUES (coalesce(nullif(trim(_name), ''), 'Meu workspace'), auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.members (workspace_id, user_id, role) VALUES (new_id, auth.uid(), 'admin');
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;

-- On signup: profile + first workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display_name text := coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  ws_name text := coalesce(
    nullif(trim(NEW.raw_user_meta_data->>'workspace_name'), ''),
    'Workspace de ' || display_name
  );
  ws_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (NEW.id, display_name, NEW.raw_user_meta_data->>'avatar_url', NEW.email);

  INSERT INTO public.workspaces (name, created_by)
  VALUES (left(ws_name, 80), NEW.id)
  RETURNING id INTO ws_id;

  INSERT INTO public.members (workspace_id, user_id, role) VALUES (ws_id, NEW.id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();