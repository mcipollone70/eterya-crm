-- =============================================================================
-- Eterya CRM — Task #6: promemoria interni agenda
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  notes           TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          follow_up_status NOT NULL DEFAULT 'todo',
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_reminders_user ON agenda_reminders (user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_reminders_scheduled ON agenda_reminders (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_agenda_reminders_status ON agenda_reminders (status);
CREATE INDEX IF NOT EXISTS idx_agenda_reminders_company ON agenda_reminders (company_id);

DROP TRIGGER IF EXISTS trg_agenda_reminders_updated_at ON agenda_reminders;
CREATE TRIGGER trg_agenda_reminders_updated_at
  BEFORE UPDATE ON agenda_reminders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE agenda_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_agenda_reminders" ON agenda_reminders;
CREATE POLICY "authenticated_all_agenda_reminders" ON agenda_reminders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
