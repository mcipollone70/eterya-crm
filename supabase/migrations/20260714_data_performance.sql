-- =============================================================================
-- Eterya CRM — Task #3: indici e RPC per metriche aggregate
-- =============================================================================
-- Idempotente. Eseguire dopo lo stack database (schema + 20260714_*).
-- Non modifica dati esistenti.
-- =============================================================================

-- Liste aziende: ordinamento default e filtri commercial_status + last_visit
CREATE INDEX IF NOT EXISTS idx_companies_created_at
  ON companies (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_commercial_status_created_at
  ON companies (commercial_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companies_commercial_status_last_visit
  ON companies (commercial_status, last_visit_at DESC NULLS LAST);

-- Contesto priorità: opportunità aperte per company_id
CREATE INDEX IF NOT EXISTS idx_opportunities_open_stage_company
  ON opportunities (company_id)
  WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation');

-- Follow-up dashboard: filtri su status + date effettive
CREATE INDEX IF NOT EXISTS idx_follow_ups_open_scheduled
  ON follow_ups (scheduled_at)
  WHERE status IN ('todo', 'postponed');

CREATE INDEX IF NOT EXISTS idx_follow_ups_open_postponed
  ON follow_ups (postponed_to)
  WHERE status = 'postponed';

-- -----------------------------------------------------------------------------
-- RPC: conteggi commercial_status (sostituisce 4 query head separate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_commercial_status_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'prospect', COUNT(*) FILTER (
      WHERE commercial_status = 'prospect' OR commercial_status IS NULL
    ),
    'cliente', COUNT(*) FILTER (WHERE commercial_status = 'cliente'),
    'ex_cliente', COUNT(*) FILTER (WHERE commercial_status = 'ex_cliente'),
    'da_ricontattare', COUNT(*) FILTER (WHERE commercial_status = 'da_ricontattare')
  )
  FROM companies;
$$;

GRANT EXECUTE ON FUNCTION get_commercial_status_counts() TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: riepilogo geocoding (sostituisce 4 query head separate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_geocoding_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'withoutCoordinates', COUNT(*) FILTER (
      WHERE (latitude IS NULL OR longitude IS NULL)
        AND geocode_status IN ('not_geocoded', 'pending', 'processing')
    ),
    'geocoded', COUNT(*) FILTER (
      WHERE geocode_status IN ('geocoded', 'completed')
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    ),
    'needsReview', COUNT(*) FILTER (WHERE geocode_status = 'needs_review'),
    'failed', COUNT(*) FILTER (WHERE geocode_status = 'failed')
  )
  FROM companies;
$$;

GRANT EXECUTE ON FUNCTION get_geocoding_summary() TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: metriche follow-up dashboard (date passate dal server app)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_follow_up_dashboard_metrics(
  p_today_start timestamptz,
  p_today_end timestamptz,
  p_next7_end timestamptz
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH open_follow_ups AS (
    SELECT
      priority,
      CASE
        WHEN status = 'postponed' AND postponed_to IS NOT NULL THEN postponed_to
        ELSE scheduled_at
      END AS effective_at
    FROM follow_ups
    WHERE status IN ('todo', 'postponed')
  )
  SELECT jsonb_build_object(
    'today', COUNT(*) FILTER (
      WHERE effective_at >= p_today_start AND effective_at <= p_today_end
    ),
    'overdue', COUNT(*) FILTER (
      WHERE effective_at < p_today_start
    ),
    'next7Days', COUNT(*) FILTER (
      WHERE effective_at >= p_today_start AND effective_at <= p_next7_end
    ),
    'highPriority', COUNT(*) FILTER (
      WHERE priority = 'high'
    )
  )
  FROM open_follow_ups;
$$;

GRANT EXECUTE ON FUNCTION get_follow_up_dashboard_metrics(timestamptz, timestamptz, timestamptz) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: metriche opportunità dashboard
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_opportunity_dashboard_metrics()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'openCount', COUNT(*) FILTER (
      WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation')
    ),
    'pipelineValue', COALESCE(
      SUM(total_amount) FILTER (
        WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation')
      ),
      0
    ),
    'wonCount', COUNT(*) FILTER (WHERE stage = 'won'),
    'lostCount', COUNT(*) FILTER (WHERE stage = 'lost')
  )
  FROM opportunities;
$$;

GRANT EXECUTE ON FUNCTION get_opportunity_dashboard_metrics() TO authenticated;
