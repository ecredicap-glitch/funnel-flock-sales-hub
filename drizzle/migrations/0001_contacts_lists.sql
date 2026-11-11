CREATE TYPE public.contact_status AS ENUM ('active','unsubscribed','blocked');

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  email text,
  city text,
  tags text[] NOT NULL DEFAULT '{}',
  custom_fields jsonb NOT NULL DEFAULT '{}',
  opt_in boolean NOT NULL DEFAULT false,
  opt_in_source text,
  opt_in_at timestamptz,
  status public.contact_status NOT NULL DEFAULT 'active',
  status_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem contatos" ON public.contacts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam contatos" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam contatos" ON public.contacts FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins excluem contatos" ON public.contacts FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id,'admin'));
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX contacts_ws_idx ON public.contacts(workspace_id, created_at DESC);
CREATE INDEX contacts_tags_idx ON public.contacts USING gin(tags);

CREATE TABLE public.contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_lists TO authenticated;
GRANT ALL ON public.contact_lists TO service_role;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem listas" ON public.contact_lists FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam listas" ON public.contact_lists FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam listas" ON public.contact_lists FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros excluem listas" ON public.contact_lists FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE TABLE public.contact_list_members (
  list_id uuid NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_list_members TO authenticated;
GRANT ALL ON public.contact_list_members TO service_role;
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem membros de lista" ON public.contact_list_members FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros adicionam a listas" ON public.contact_list_members FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros removem de listas" ON public.contact_list_members FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));