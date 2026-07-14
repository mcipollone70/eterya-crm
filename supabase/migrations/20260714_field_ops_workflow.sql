-- =============================================================================
-- Eterya CRM — Task #4: indici agenda visite
-- =============================================================================
-- Idempotente. Migliora filtri periodo su visits (scheduled/completed).
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_visits_status_scheduled_at
  ON visits (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_visits_status_completed_at
  ON visits (status, completed_at DESC)
  WHERE status = 'completed';
