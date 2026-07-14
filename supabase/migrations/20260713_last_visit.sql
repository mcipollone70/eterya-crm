-- Ultima visita: snapshot su companies + campi storico su visits

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_visit_outcome TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_visit_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS next_callback_at TIMESTAMPTZ;

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS next_callback_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_last_visit_at ON companies (last_visit_at);
CREATE INDEX IF NOT EXISTS idx_visits_company_completed ON visits (company_id, completed_at DESC);

-- Backfill ultima visita da storico esistente
UPDATE companies c
SET
  last_visit_at = v.completed_at,
  last_visit_outcome = v.outcome,
  last_visit_notes = v.notes,
  last_visit_duration_minutes = v.duration_minutes,
  next_callback_at = v.next_callback_at
FROM (
  SELECT DISTINCT ON (company_id)
    company_id,
    completed_at,
    outcome,
    notes,
    duration_minutes,
    next_callback_at
  FROM visits
  WHERE status = 'completed' AND completed_at IS NOT NULL
  ORDER BY company_id, completed_at DESC
) v
WHERE c.id = v.company_id;
