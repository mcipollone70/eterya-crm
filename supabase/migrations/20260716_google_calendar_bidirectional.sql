-- =============================================================================
-- Eterya CRM — Google Calendar bidirectional (inbound events + sync metadata)
-- ADDITIVE / NON-DESTRUCTIVE — DO NOT auto-apply; apply manually in Supabase.
-- =============================================================================
-- RLS note: google_calendar_connections resta owner-only (token protetti).
-- calendar_external_events SELECT aperto resta intenzionale per badge multi-agente.
-- =============================================================================

ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS sync_token TEXT,
  ADD COLUMN IF NOT EXISTS sync_in_progress_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT;

-- Eventi originati da Google (non creati dal CRM), mostrati in Agenda come «Evento Google».
-- Dedup: (user_id, google_calendar_id, google_event_id).
CREATE TABLE IF NOT EXISTS calendar_google_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id     TEXT NOT NULL,
  google_calendar_id  TEXT NOT NULL,
  summary             TEXT NOT NULL DEFAULT '',
  description         TEXT,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ,
  all_day             BOOLEAN NOT NULL DEFAULT false,
  status              TEXT,
  html_link           TEXT,
  recurring_event_id  TEXT,
  is_crm_managed      BOOLEAN NOT NULL DEFAULT false,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_google_events_dedupe
    UNIQUE (user_id, google_calendar_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_google_events_user_start
  ON calendar_google_events (user_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_google_events_seen
  ON calendar_google_events (user_id, last_seen_at);

DROP TRIGGER IF EXISTS trg_calendar_google_events_updated_at ON calendar_google_events;
CREATE TRIGGER trg_calendar_google_events_updated_at
  BEFORE UPDATE ON calendar_google_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE calendar_google_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_own_calendar_google_events" ON calendar_google_events;
CREATE POLICY "authenticated_own_calendar_google_events" ON calendar_google_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
