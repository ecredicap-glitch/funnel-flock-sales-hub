CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'primeiro_contato',
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem templates" ON public.templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam templates" ON public.templates FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam templates" ON public.templates FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros excluem templates" ON public.templates FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE TYPE public.campaign_status AS ENUM ('draft','running','paused','completed','cancelled');
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  list_id uuid REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  body text NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  pause_reason text,
  min_interval_s int NOT NULL DEFAULT 15,
  max_interval_s int NOT NULL DEFAULT 45,
  batch_size int NOT NULL DEFAULT 20,
  batch_pause_min int NOT NULL DEFAULT 3,
  batch_pause_max int NOT NULL DEFAULT 8,
  daily_limit int NOT NULL DEFAULT 20,
  window_start int NOT NULL DEFAULT 8,
  window_end int NOT NULL DEFAULT 19,
  window_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  dedupe_days int NOT NULL DEFAULT 7,
  start_at timestamptz,
  next_send_at timestamptz,
  sent_in_batch int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem campanhas" ON public.campaigns FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam campanhas" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam campanhas" ON public.campaigns FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins excluem campanhas" ON public.campaigns FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id,'admin'));

CREATE TYPE public.message_status AS ENUM ('queued','sent','failed','skipped');
CREATE TABLE public.campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone text NOT NULL,
  body text NOT NULL,
  status public.message_status NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_messages TO authenticated;
GRANT ALL ON public.campaign_messages TO service_role;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem mensagens" ON public.campaign_messages FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam mensagens" ON public.campaign_messages FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam mensagens" ON public.campaign_messages FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE INDEX campaign_messages_queue_idx ON public.campaign_messages(campaign_id, status, created_at);
CREATE INDEX campaign_messages_ws_sent_idx ON public.campaign_messages(workspace_id, sent_at);
CREATE INDEX campaign_messages_phone_idx ON public.campaign_messages(workspace_id, phone, sent_at);