CREATE TABLE public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone text NOT NULL,
  push_name text,
  direction text NOT NULL DEFAULT 'in',
  body text NOT NULL DEFAULT '',
  external_id text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_id)
);
CREATE INDEX wa_messages_ws_phone_idx ON public.wa_messages (workspace_id, phone, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem conversas" ON public.wa_messages FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros registram conversas" ON public.wa_messages FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros marcam lidas" ON public.wa_messages FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;