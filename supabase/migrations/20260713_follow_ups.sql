-- Follow-up e promemoria

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_status') THEN
    CREATE TYPE follow_up_status AS ENUM ('todo', 'completed', 'postponed', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type   TEXT NOT NULL,
  description     TEXT,
  priority        activity_priority NOT NULL DEFAULT 'medium',
  status          follow_up_status NOT NULL DEFAULT 'todo',
  scheduled_at    TIMESTAMPTZ NOT NULL,
  postponed_to    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_company ON follow_ups (company_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups (user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups (status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_priority ON follow_ups (priority);

DROP TRIGGER IF EXISTS trg_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER trg_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_follow_ups" ON follow_ups;
CREATE POLICY "authenticated_all_follow_ups" ON follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migra follow-up pianificati dallo storico contatti
INSERT INTO follow_ups (
  company_id,
  user_id,
  activity_type,
  description,
  priority,
  status,
  scheduled_at,
  created_at,
  updated_at
)
SELECT
  a.company_id,
  a.user_id,
  a.type,
  COALESCE(a.description, a.title),
  COALESCE(a.priority::activity_priority, 'medium'::activity_priority),
  'todo'::follow_up_status,
  a.next_follow_up_at,
  a.created_at,
  a.updated_at
FROM activities a
WHERE a.company_id IS NOT NULL
  AND a.next_follow_up_at IS NOT NULL
  AND a.status = 'done'
  AND a.next_follow_up_at > now()
  AND NOT EXISTS (
    SELECT 1
    FROM follow_ups f
    WHERE f.company_id = a.company_id
      AND f.scheduled_at = a.next_follow_up_at
      AND f.description IS NOT DISTINCT FROM COALESCE(a.description, a.title)
  );
