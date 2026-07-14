-- Storico contatti: tipologie estese, campi attività e ultimo contatto su companies

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'visit';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'quote';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'note';

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

UPDATE activities
SET occurred_at = COALESCE(completed_at, created_at)
WHERE occurred_at IS NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_type TEXT,
  ADD COLUMN IF NOT EXISTS last_contact_outcome TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_occurred_at ON activities (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_next_follow_up ON activities (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_last_contact_at ON companies (last_contact_at);

-- Collega visite già completate allo storico attività
INSERT INTO activities (
  company_id,
  user_id,
  visit_id,
  type,
  title,
  description,
  status,
  completed_at,
  occurred_at,
  outcome,
  next_follow_up_at,
  metadata
)
SELECT
  v.company_id,
  v.user_id,
  v.id,
  'visit',
  'Visita',
  v.notes,
  'done',
  v.completed_at,
  v.completed_at,
  v.outcome,
  v.next_callback_at,
  '{}'::jsonb
FROM visits v
WHERE v.status = 'completed'
  AND v.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activities a WHERE a.visit_id = v.id
  );

-- Backfill ultimo contatto da storico attività
UPDATE companies c
SET
  last_contact_at = latest.occurred_at,
  last_contact_type = latest.type::text,
  last_contact_outcome = latest.outcome
FROM (
  SELECT DISTINCT ON (company_id)
    company_id,
    occurred_at,
    type,
    outcome
  FROM activities
  WHERE company_id IS NOT NULL
    AND status = 'done'
    AND occurred_at IS NOT NULL
  ORDER BY company_id, occurred_at DESC
) latest
WHERE c.id = latest.company_id;
