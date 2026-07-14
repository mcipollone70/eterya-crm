-- =============================================================================
-- Eterya CRM — Task #10: integrazione Google Calendar
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE calendar_entity_kind AS ENUM ('visit', 'follow_up', 'reminder');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calendar_sync_status AS ENUM ('synced', 'pending', 'error', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email      TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ NOT NULL,
  calendar_id       TEXT NOT NULL DEFAULT 'primary',
  sync_enabled      BOOLEAN NOT NULL DEFAULT true,
  last_sync_at      TIMESTAMPTZ,
  last_sync_error   TEXT,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_external_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_kind         calendar_entity_kind NOT NULL,
  entity_id           UUID NOT NULL,
  google_event_id     TEXT NOT NULL,
  google_calendar_id  TEXT NOT NULL,
  sync_status         calendar_sync_status NOT NULL DEFAULT 'pending',
  last_synced_at      TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_external_events_entity_unique UNIQUE (user_id, entity_kind, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_external_events_user
  ON calendar_external_events (user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_external_events_entity
  ON calendar_external_events (entity_kind, entity_id);

CREATE INDEX IF NOT EXISTS idx_calendar_external_events_status
  ON calendar_external_events (sync_status);

DROP TRIGGER IF EXISTS trg_google_calendar_connections_updated_at ON google_calendar_connections;
CREATE TRIGGER trg_google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_calendar_external_events_updated_at ON calendar_external_events;
CREATE TRIGGER trg_calendar_external_events_updated_at
  BEFORE UPDATE ON calendar_external_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_external_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_own_google_calendar_connections" ON google_calendar_connections;
CREATE POLICY "authenticated_own_google_calendar_connections" ON google_calendar_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_own_calendar_external_events" ON calendar_external_events;
CREATE POLICY "authenticated_own_calendar_external_events" ON calendar_external_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
