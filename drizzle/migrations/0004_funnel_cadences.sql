ALTER TABLE public.contacts
  ADD COLUMN stage text NOT NULL DEFAULT 'novo' CHECK (stage IN ('novo','contatado','respondeu','interessado','proposta','fechado','perdido')),
  ADD COLUMN product text CHECK (product IN ('credito','consorcio','limpa_nome','rating','outro')),
  ADD COLUMN deal_value numeric(14,2),
  ADD COLUMN stage_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_message_at timestamptz;
CREATE INDEX contacts_ws_stage_idx ON public.contacts (workspace_id, stage);

CREATE TABLE public.cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  window_start int NOT NULL DEFAULT 8,
  window_end int NOT NULL DEFAULT 19,
  window_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  daily_limit int NOT NULL DEFAULT 30,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadences TO authenticated;
GRANT ALL ON public.cadences TO service_role;
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem cadencias" ON public.cadences FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros criam cadencias" ON public.cadences FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam cadencias" ON public.cadences FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins excluem cadencias" ON public.cadences FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id,'admin'));

CREATE TABLE public.cadence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cadence_id uuid NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  step int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped')),
  stop_reason text,
  last_sent_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, contact_id)
);
CREATE INDEX cadence_enr_due_idx ON public.cadence_enrollments (status, next_run_at);
CREATE INDEX cadence_enr_phone_idx ON public.cadence_enrollments (workspace_id, phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cadence_enrollments TO authenticated;
GRANT ALL ON public.cadence_enrollments TO service_role;
ALTER TABLE public.cadence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem inscricoes" ON public.cadence_enrollments FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros inscrevem" ON public.cadence_enrollments FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros editam inscricoes" ON public.cadence_enrollments FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Membros removem inscricoes" ON public.cadence_enrollments FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

-- Stage timestamp + stop cadences when a contact leaves "active"
CREATE OR REPLACE FUNCTION public.contacts_stage_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN NEW.stage_changed_at := now(); END IF;
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    UPDATE public.cadence_enrollments SET status = 'stopped', stop_reason = 'Contato descadastrado ou bloqueado'
    WHERE contact_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contacts_stage_guard BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.contacts_stage_guard();

-- Inbound reply: stop cadences, move lead to "respondeu"
CREATE OR REPLACE FUNCTION public.wa_inbound_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    UPDATE public.cadence_enrollments SET status = 'stopped', stop_reason = 'Lead respondeu'
    WHERE workspace_id = NEW.workspace_id AND phone = NEW.phone AND status = 'active';
    UPDATE public.contacts SET last_message_at = NEW.created_at,
      stage = CASE WHEN stage IN ('novo','contatado') THEN 'respondeu' ELSE stage END
    WHERE workspace_id = NEW.workspace_id AND phone = NEW.phone;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wa_inbound_automation AFTER INSERT ON public.wa_messages FOR EACH ROW EXECUTE FUNCTION public.wa_inbound_automation();

-- Campaign message sent: move lead from "novo" to "contatado"
CREATE OR REPLACE FUNCTION public.campaign_sent_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts SET stage = 'contatado' WHERE id = NEW.contact_id AND stage = 'novo';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaign_sent_automation AFTER UPDATE OF status ON public.campaign_messages FOR EACH ROW EXECUTE FUNCTION public.campaign_sent_automation();

REVOKE EXECUTE ON FUNCTION public.contacts_stage_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wa_inbound_automation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.campaign_sent_automation() FROM PUBLIC, anon, authenticated;