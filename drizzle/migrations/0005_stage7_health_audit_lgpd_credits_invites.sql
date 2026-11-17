ALTER TABLE public.workspaces
  ADD COLUMN optout_message text NOT NULL DEFAULT 'Pronto, você não vai mais receber nossas mensagens. Se precisar de algo, é só chamar por aqui.' CHECK (char_length(optout_message) <= 500);

ALTER TABLE public.campaign_messages
  ADD COLUMN external_id text,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN read_at timestamptz;
CREATE INDEX campaign_messages_ext_idx ON public.campaign_messages (workspace_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.wa_messages ADD COLUMN source text CHECK (source IN ('campaign','cadence','manual','test'));
CREATE INDEX wa_messages_ws_created_idx ON public.wa_messages (workspace_id, direction, created_at);

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_ws_idx ON public.audit_log (workspace_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem auditoria" ON public.audit_log FOR SELECT TO authenticated USING (public.has_workspace_role(workspace_id, 'admin'));

CREATE OR REPLACE FUNCTION public.write_audit(_ws uuid, _action text, _entity uuid, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _ws) THEN RETURN; END IF;
  INSERT INTO public.audit_log (workspace_id, actor_id, action, entity_id, details)
  VALUES (_ws, auth.uid(), _action, _entity, coalesce(_details, '{}'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_audit(_ws uuid, _action text, _entity uuid, _details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_member(_ws) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  IF _action NOT IN ('contact.export') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  PERFORM public.write_audit(_ws, _action, _entity, _details);
END;
$$;
REVOKE ALL ON FUNCTION public.log_audit(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, uuid, jsonb) TO authenticated;

-- INVITES
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role NOT NULL DEFAULT 'operator',
  invited_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
GRANT SELECT, INSERT, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem convites" ON public.invites FOR SELECT TO authenticated USING (public.has_workspace_role(workspace_id, 'admin'));
CREATE POLICY "Admins convidam" ON public.invites FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, 'admin') AND invited_by = auth.uid());
CREATE POLICY "Admins cancelam convites" ON public.invites FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, 'admin'));

CREATE OR REPLACE FUNCTION public.accept_my_invites()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.members (workspace_id, user_id, role)
    SELECT i.workspace_id, auth.uid(), i.role FROM public.invites i
    WHERE i.email = v_email AND i.accepted_at IS NULL
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.invites SET accepted_at = now() WHERE email = v_email AND accepted_at IS NULL;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_my_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_my_invites() TO authenticated;

-- CREDITS
CREATE TABLE public.credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  note text CHECK (char_length(note) <= 200),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_grants_ws_idx ON public.credit_grants (workspace_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.credit_grants TO authenticated;
GRANT ALL ON public.credit_grants TO service_role;
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros veem creditos" ON public.credit_grants FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins lancam creditos" ON public.credit_grants FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, 'admin') AND created_by = auth.uid());
CREATE POLICY "Admins removem creditos" ON public.credit_grants FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, 'admin'));

-- Generic audit trigger
CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; eid uuid; act text; det jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN ws := OLD.workspace_id; eid := OLD.id; ELSE ws := NEW.workspace_id; eid := NEW.id; END IF;
  IF TG_TABLE_NAME = 'contacts' THEN
    IF TG_OP = 'DELETE' THEN act := 'contact.delete'; det := jsonb_build_object('nome', OLD.name, 'telefone', OLD.phone);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN act := 'contact.status'; det := jsonb_build_object('nome', NEW.name, 'telefone', NEW.phone, 'de', OLD.status, 'para', NEW.status, 'motivo', NEW.status_reason);
    ELSIF NEW.opt_in IS DISTINCT FROM OLD.opt_in THEN act := 'contact.opt_in'; det := jsonb_build_object('nome', NEW.name, 'telefone', NEW.phone, 'opt_in', NEW.opt_in, 'origem', NEW.opt_in_source);
    END IF;
  ELSIF TG_TABLE_NAME = 'campaigns' THEN
    IF TG_OP = 'INSERT' THEN act := 'campaign.create'; det := jsonb_build_object('nome', NEW.name, 'total', NEW.total);
    ELSIF TG_OP = 'DELETE' THEN act := 'campaign.delete'; det := jsonb_build_object('nome', OLD.name);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN act := 'campaign.status'; det := jsonb_build_object('nome', NEW.name, 'de', OLD.status, 'para', NEW.status, 'motivo', NEW.pause_reason);
    END IF;
  ELSIF TG_TABLE_NAME = 'members' THEN
    IF TG_OP = 'INSERT' THEN act := 'member.add'; det := jsonb_build_object('email', (SELECT email FROM public.profiles WHERE id = NEW.user_id), 'papel', NEW.role);
    ELSIF TG_OP = 'DELETE' THEN act := 'member.remove'; det := jsonb_build_object('email', (SELECT email FROM public.profiles WHERE id = OLD.user_id));
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN act := 'member.role'; det := jsonb_build_object('email', (SELECT email FROM public.profiles WHERE id = NEW.user_id), 'de', OLD.role, 'para', NEW.role);
    END IF;
  ELSIF TG_TABLE_NAME = 'invites' THEN
    IF TG_OP = 'INSERT' THEN act := 'invite.create'; det := jsonb_build_object('email', NEW.email, 'papel', NEW.role);
    ELSIF TG_OP = 'DELETE' AND OLD.accepted_at IS NULL THEN act := 'invite.cancel'; det := jsonb_build_object('email', OLD.email);
    END IF;
  ELSIF TG_TABLE_NAME = 'cadences' THEN
    IF TG_OP = 'INSERT' THEN act := 'cadence.create'; det := jsonb_build_object('nome', NEW.name);
    ELSIF TG_OP = 'DELETE' THEN act := 'cadence.delete'; det := jsonb_build_object('nome', OLD.name);
    ELSIF NEW.active IS DISTINCT FROM OLD.active THEN act := 'cadence.active'; det := jsonb_build_object('nome', NEW.name, 'ativa', NEW.active);
    END IF;
  ELSIF TG_TABLE_NAME = 'credit_grants' THEN
    IF TG_OP = 'INSERT' THEN act := 'credit.add'; det := jsonb_build_object('quantidade', NEW.amount, 'validade', NEW.expires_at, 'obs', NEW.note);
    ELSIF TG_OP = 'DELETE' THEN act := 'credit.remove'; det := jsonb_build_object('quantidade', OLD.amount);
    END IF;
  END IF;
  IF act IS NOT NULL THEN PERFORM public.write_audit(ws, act, eid, det); END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_row() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER audit_contacts AFTER UPDATE OR DELETE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_campaigns AFTER INSERT OR UPDATE OR DELETE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_invites AFTER INSERT OR DELETE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_cadences AFTER INSERT OR UPDATE OR DELETE ON public.cadences FOR EACH ROW EXECUTE FUNCTION public.audit_row();
CREATE TRIGGER audit_credit_grants AFTER INSERT OR DELETE ON public.credit_grants FOR EACH ROW EXECUTE FUNCTION public.audit_row();

-- LGPD: erase a contact's personal data (admin only)
CREATE OR REPLACE FUNCTION public.erase_contact(_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT id, workspace_id, phone INTO c FROM public.contacts WHERE id = _contact_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Contato não encontrado'; END IF;
  IF NOT public.has_workspace_role(c.workspace_id, 'admin') THEN RAISE EXCEPTION 'Apenas administradores podem apagar dados.'; END IF;
  DELETE FROM public.wa_messages WHERE workspace_id = c.workspace_id AND phone = c.phone;
  DELETE FROM public.cadence_enrollments WHERE workspace_id = c.workspace_id AND phone = c.phone;
  UPDATE public.campaign_messages SET phone = 'anon-' || left(id::text, 8), body = '[removido a pedido do titular]', contact_id = NULL
    WHERE workspace_id = c.workspace_id AND phone = c.phone;
  PERFORM public.write_audit(c.workspace_id, 'contact.erase', c.id, jsonb_build_object('telefone', '****' || right(c.phone, 4)));
  DELETE FROM public.contacts WHERE id = c.id;
END;
$$;
REVOKE ALL ON FUNCTION public.erase_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erase_contact(uuid) TO authenticated;

-- Per-campaign metrics (RLS applies)
CREATE OR REPLACE FUNCTION public.campaign_metrics(_ws uuid)
RETURNS TABLE (c_id uuid, n_queued bigint, n_sent bigint, n_delivered bigint, n_read bigint, n_failed bigint, n_skipped bigint, n_replied bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT m.campaign_id,
    count(*) FILTER (WHERE m.status = 'queued'),
    count(*) FILTER (WHERE m.status = 'sent'),
    count(*) FILTER (WHERE m.delivered_at IS NOT NULL OR m.read_at IS NOT NULL),
    count(*) FILTER (WHERE m.read_at IS NOT NULL),
    count(*) FILTER (WHERE m.status = 'failed'),
    count(*) FILTER (WHERE m.status = 'skipped'),
    count(*) FILTER (WHERE m.status = 'sent' AND EXISTS (
      SELECT 1 FROM public.wa_messages w WHERE w.workspace_id = m.workspace_id AND w.phone = m.phone AND w.direction = 'in' AND w.created_at > m.sent_at))
  FROM public.campaign_messages m
  WHERE m.workspace_id = _ws
  GROUP BY m.campaign_id
$$;
GRANT EXECUTE ON FUNCTION public.campaign_metrics(uuid) TO authenticated;

-- Workspace dashboard metrics in America/Belem (RLS applies)
CREATE OR REPLACE FUNCTION public.workspace_metrics(_ws uuid, _days int DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  tz text := 'America/Belem';
  nd int := greatest(1, least(coalesce(_days, 7), 90));
  v_today date := (now() AT TIME ZONE tz)::date;
  v_since timestamptz := ((v_today - (nd - 1))::timestamp AT TIME ZONE tz);
  v_day_start timestamptz := (v_today::timestamp AT TIME ZONE tz);
  r jsonb;
BEGIN
  IF NOT public.is_workspace_member(_ws) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  SELECT jsonb_build_object(
    'contacts', (SELECT count(*) FROM public.contacts WHERE workspace_id = _ws AND status = 'active' AND opt_in),
    'sent_today', (SELECT count(*) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND created_at >= v_day_start),
    'sent', (SELECT count(*) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND created_at >= v_since),
    'contacted', (SELECT count(DISTINCT phone) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND created_at >= v_since),
    'repliers', (SELECT count(DISTINCT phone) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'in' AND created_at >= v_since),
    'camp_sent', (SELECT count(*) FROM public.campaign_messages WHERE workspace_id = _ws AND status = 'sent' AND sent_at >= v_since),
    'camp_delivered', (SELECT count(*) FROM public.campaign_messages WHERE workspace_id = _ws AND status = 'sent' AND sent_at >= v_since AND (delivered_at IS NOT NULL OR read_at IS NOT NULL)),
    'camp_failed', (SELECT count(*) FROM public.campaign_messages WHERE workspace_id = _ws AND status = 'failed' AND created_at >= v_since),
    'optouts', (SELECT count(*) FROM public.contacts WHERE workspace_id = _ws AND status = 'unsubscribed' AND updated_at >= v_since),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'sent', coalesce(s.n, 0), 'replies', coalesce(i.n, 0)) ORDER BY g), '[]'::jsonb)
      FROM generate_series((v_today - (nd - 1))::timestamp, v_today::timestamp, interval '1 day') g
      LEFT JOIN (SELECT (created_at AT TIME ZONE tz)::date dd, count(*) n FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND created_at >= v_since GROUP BY 1) s ON s.dd = g::date
      LEFT JOIN (SELECT (created_at AT TIME ZONE tz)::date dd, count(*) n FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'in' AND created_at >= v_since GROUP BY 1) i ON i.dd = g::date),
    'heatmap', (SELECT coalesce(jsonb_agg(jsonb_build_object('dow', h.dow, 'hour', h.hr, 'n', h.n)), '[]'::jsonb) FROM (
      SELECT extract(dow FROM created_at AT TIME ZONE tz)::int dow, extract(hour FROM created_at AT TIME ZONE tz)::int hr, count(*) n
      FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'in' AND created_at >= now() - interval '30 days' GROUP BY 1, 2) h),
    'stages', (SELECT coalesce(jsonb_object_agg(s.stage, s.n), '{}'::jsonb) FROM (SELECT stage, count(*) n FROM public.contacts WHERE workspace_id = _ws GROUP BY 1) s),
    'daily_limit', (SELECT max(daily_limit) FROM public.campaigns WHERE workspace_id = _ws AND status IN ('running', 'paused')),
    'windows', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', 'Campanha', 'name', name, 'start', window_start, 'end', window_end, 'days', window_days)), '[]'::jsonb) FROM public.campaigns WHERE workspace_id = _ws AND status = 'running')
      || (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', 'Cadência', 'name', name, 'start', window_start, 'end', window_end, 'days', window_days)), '[]'::jsonb) FROM public.cadences WHERE workspace_id = _ws AND active),
    'scheduled', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'status', status, 'start_at', start_at, 'remaining', greatest(total - sent - failed, 0)) ORDER BY created_at DESC), '[]'::jsonb)
      FROM public.campaigns WHERE workspace_id = _ws AND status IN ('running', 'paused', 'draft')),
    'followups_today', (SELECT count(*) FROM public.cadence_enrollments WHERE workspace_id = _ws AND status = 'active' AND next_run_at < v_day_start + interval '1 day'),
    'hot_leads', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT c.id, c.name, c.phone, c.stage, lm.created_at AS last_in
      FROM public.contacts c
      JOIN LATERAL (SELECT w.direction, w.created_at FROM public.wa_messages w WHERE w.workspace_id = c.workspace_id AND w.phone = c.phone ORDER BY w.created_at DESC LIMIT 1) lm ON true
      WHERE c.workspace_id = _ws AND c.status = 'active' AND c.stage IN ('respondeu', 'interessado', 'proposta')
        AND lm.direction = 'in' AND lm.created_at < now() - interval '24 hours'
      ORDER BY lm.created_at LIMIT 8) x)
  ) INTO r;
  RETURN r;
END;
$$;
GRANT EXECUTE ON FUNCTION public.workspace_metrics(uuid, int) TO authenticated;

-- Credit balance (RLS applies)
CREATE OR REPLACE FUNCTION public.credit_summary(_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE v_granted bigint; v_start timestamptz; v_used bigint; v_next timestamptz;
BEGIN
  IF NOT public.is_workspace_member(_ws) THEN RAISE EXCEPTION 'Sem acesso'; END IF;
  SELECT coalesce(sum(amount), 0), min(created_at), min(expires_at) INTO v_granted, v_start, v_next
    FROM public.credit_grants WHERE workspace_id = _ws AND (expires_at IS NULL OR expires_at > now());
  SELECT count(*) INTO v_used FROM public.wa_messages
    WHERE workspace_id = _ws AND direction = 'out' AND source IN ('campaign', 'cadence') AND v_start IS NOT NULL AND created_at >= v_start;
  RETURN jsonb_build_object('granted', v_granted, 'used', v_used, 'balance', v_granted - v_used, 'next_expiry', v_next,
    'used_30d', (SELECT count(*) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND source IN ('campaign', 'cadence') AND created_at >= now() - interval '30 days'),
    'cadence_30d', (SELECT count(*) FROM public.wa_messages WHERE workspace_id = _ws AND direction = 'out' AND source = 'cadence' AND created_at >= now() - interval '30 days'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_summary(uuid) TO authenticated;