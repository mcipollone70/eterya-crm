-- Dashboard Commerciale Avanzata: layout utente + RPC aggregate ottimizzate
-- Compatibile anche se follow_ups non esiste ancora (fallback su activities.next_follow_up_at)

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  widget_order    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  hidden_widgets  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_dashboard_layouts_updated_at ON dashboard_layouts;
CREATE TRIGGER trg_dashboard_layouts_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_own_dashboard_layout" ON dashboard_layouts;
CREATE POLICY "authenticated_own_dashboard_layout" ON dashboard_layouts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_visits_completed_month
  ON visits (completed_at)
  WHERE status = 'completed' AND completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_coords
  ON companies (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Conteggio follow-up di oggi: follow_ups se presente, altrimenti activities.next_follow_up_at
CREATE OR REPLACE FUNCTION dashboard_count_follow_ups_today()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  today_ts timestamptz := date_trunc('day', now());
  tomorrow_ts timestamptz := today_ts + interval '1 day';
  result integer := 0;
BEGIN
  IF to_regclass('public.follow_ups') IS NOT NULL THEN
    SELECT COUNT(*)::integer INTO result
    FROM follow_ups f
    WHERE f.status IN ('todo', 'postponed')
      AND f.completed_at IS NULL
      AND COALESCE(
        CASE WHEN f.status = 'postponed' THEN f.postponed_to END,
        f.scheduled_at
      ) >= today_ts
      AND COALESCE(
        CASE WHEN f.status = 'postponed' THEN f.postponed_to END,
        f.scheduled_at
      ) < tomorrow_ts;
  ELSIF to_regclass('public.activities') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activities'
        AND column_name = 'next_follow_up_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM activities a
    WHERE a.status = 'done'
      AND a.next_follow_up_at IS NOT NULL
      AND a.next_follow_up_at >= today_ts
      AND a.next_follow_up_at < tomorrow_ts;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- Ultima visita: companies.last_visit_at se presente, altrimenti calcolo da visits
CREATE OR REPLACE FUNCTION dashboard_company_has_last_visit_column()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'last_visit_at'
  );
$$;

CREATE OR REPLACE FUNCTION dashboard_count_never_visited_companies()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result integer := 0;
BEGIN
  IF dashboard_company_has_last_visit_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies
    WHERE last_visit_at IS NULL;
  ELSIF to_regclass('public.visits') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visits'
        AND column_name = 'completed_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM visits v
      WHERE v.company_id = c.id
        AND v.status = 'completed'
        AND v.completed_at IS NOT NULL
    );
  ELSE
    SELECT COUNT(*)::integer INTO result FROM companies;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION dashboard_count_clients_without_visit_90_days()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  threshold_ts timestamptz := now() - interval '90 days';
  result integer := 0;
BEGIN
  IF dashboard_company_has_last_visit_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE c.commercial_status = 'cliente'
      AND (c.last_visit_at IS NULL OR c.last_visit_at < threshold_ts);
  ELSIF to_regclass('public.visits') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visits'
        AND column_name = 'completed_at'
    ) THEN
    SELECT COUNT(*)::integer INTO result
    FROM companies c
    WHERE c.commercial_status = 'cliente'
      AND (
        NOT EXISTS (
          SELECT 1
          FROM visits v
          WHERE v.company_id = c.id
            AND v.status = 'completed'
            AND v.completed_at IS NOT NULL
        )
        OR (
          SELECT MAX(v.completed_at)
          FROM visits v
          WHERE v.company_id = c.id
            AND v.status = 'completed'
            AND v.completed_at IS NOT NULL
        ) < threshold_ts
      );
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- Opportunità: compatibile con colonna stage (pipeline) o solo status legacy
CREATE OR REPLACE FUNCTION dashboard_opportunity_has_stage_column()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'stage'
  );
$$;

CREATE OR REPLACE FUNCTION dashboard_legacy_status_to_stage(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'accepted' THEN 'won'
    WHEN p_status IN ('rejected', 'cancelled') THEN 'lost'
    WHEN p_status = 'sent' THEN 'quote_sent'
    ELSE 'new'
  END;
$$;

CREATE OR REPLACE FUNCTION dashboard_count_open_opportunities()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result integer := 0;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN 0;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COUNT(*)::integer INTO result
    FROM opportunities
    WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation');
  ELSE
    SELECT COUNT(*)::integer INTO result
    FROM opportunities
    WHERE status NOT IN ('accepted', 'rejected', 'cancelled');
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION dashboard_sum_open_pipeline_value()
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result numeric := 0;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN 0;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COALESCE(SUM(total_amount), 0) INTO result
    FROM opportunities
    WHERE stage IN ('new', 'contact_started', 'site_visit', 'quote_sent', 'negotiation');
  ELSE
    SELECT COALESCE(SUM(total_amount), 0) INTO result
    FROM opportunities
    WHERE status NOT IN ('accepted', 'rejected', 'cancelled');
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

-- KPI snapshot (conteggi head-only equivalenti in un round-trip)
CREATE OR REPLACE FUNCTION get_commercial_dashboard_kpis()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH today_start AS (
    SELECT date_trunc('day', now()) AS ts
  ),
  week_start AS (
    SELECT date_trunc('week', now()) AS ts
  )
  SELECT jsonb_build_object(
    'totalCompanies', (SELECT COUNT(*)::int FROM companies),
    'prospects', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'prospect'),
    'clients', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'cliente'),
    'exClients', (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'ex_cliente'),
    'geocodedCompanies', (
      SELECT COUNT(*)::int FROM companies
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND geocode_status IN ('geocoded', 'completed')
    ),
    'needsReviewCompanies', (
      SELECT COUNT(*)::int FROM companies WHERE geocode_status = 'needs_review'
    ),
    'visitsToday', (
      SELECT COUNT(*)::int FROM visits v, today_start t
      WHERE v.status = 'completed'
        AND v.completed_at IS NOT NULL
        AND v.completed_at >= t.ts
    ),
    'visitsThisWeek', (
      SELECT COUNT(*)::int FROM visits v, week_start w
      WHERE v.status = 'completed'
        AND v.completed_at IS NOT NULL
        AND v.completed_at >= w.ts
    ),
    'followUpsToday', dashboard_count_follow_ups_today(),
    'openOpportunities', dashboard_count_open_opportunities(),
    'pipelineValue', dashboard_sum_open_pipeline_value(),
    'neverVisitedCompanies', dashboard_count_never_visited_companies(),
    'clientsWithoutVisit90Days', dashboard_count_clients_without_visit_90_days()
  );
$$;

CREATE OR REPLACE FUNCTION get_companies_by_province_chart(p_limit int DEFAULT 12)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', COALESCE(NULLIF(TRIM(province), ''), 'N/D'),
        'value', cnt
      )
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT COALESCE(NULLIF(TRIM(province), ''), 'N/D') AS province, COUNT(*)::int AS cnt
    FROM companies
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT GREATEST(p_limit, 1)
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_companies_by_commercial_status_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('label', commercial_status::text, 'value', cnt)
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT commercial_status, COUNT(*)::int AS cnt
    FROM companies
    GROUP BY commercial_status
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_visits_monthly_trend_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', to_char(m.month_start, 'YYYY-MM'),
        'value', COALESCE(v.cnt, 0)
      )
      ORDER BY m.month_start
    ),
    '[]'::jsonb
  )
  FROM months m
  LEFT JOIN (
    SELECT date_trunc('month', completed_at) AS month_start, COUNT(*)::int AS cnt
    FROM visits
    WHERE status = 'completed' AND completed_at IS NOT NULL
      AND completed_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  ) v ON v.month_start = m.month_start;
$$;

CREATE OR REPLACE FUNCTION get_opportunities_by_stage_chart()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF to_regclass('public.opportunities') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF dashboard_opportunity_has_stage_column() THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('label', stage::text, 'value', cnt)
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) INTO result
    FROM (
      SELECT stage, COUNT(*)::int AS cnt
      FROM opportunities
      GROUP BY stage
    ) s;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('label', stage_label, 'value', cnt)
        ORDER BY cnt DESC
      ),
      '[]'::jsonb
    ) INTO result
    FROM (
      SELECT dashboard_legacy_status_to_stage(status::text) AS stage_label, COUNT(*)::int AS cnt
      FROM opportunities
      GROUP BY 1
    ) s;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_product_interests_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('label', family, 'value', cnt)
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT p.family::text AS family, COUNT(DISTINCT cpi.company_id)::int AS cnt
    FROM company_product_interests cpi
    JOIN products p ON p.id = cpi.product_id
    GROUP BY p.family
  ) s;
$$;

CREATE OR REPLACE FUNCTION get_prospect_conversion_chart()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS month_start
  ),
  new_clients AS (
    SELECT date_trunc('month', updated_at) AS month_start, COUNT(*)::int AS cnt
    FROM companies
    WHERE commercial_status = 'cliente'
      AND updated_at >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'prospect') AS prospects,
      (SELECT COUNT(*)::int FROM companies WHERE commercial_status = 'cliente') AS clients
  )
  SELECT jsonb_build_object(
    'monthly', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'label', to_char(m.month_start, 'YYYY-MM'),
            'value', COALESCE(nc.cnt, 0)
          )
          ORDER BY m.month_start
        )
        FROM months m
        LEFT JOIN new_clients nc ON nc.month_start = m.month_start
      ),
      '[]'::jsonb
    ),
    'conversionRate', CASE
      WHEN (totals.prospects + totals.clients) = 0 THEN 0
      ELSE ROUND((totals.clients::numeric / (totals.prospects + totals.clients)::numeric) * 100, 1)
    END,
    'prospects', totals.prospects,
    'clients', totals.clients
  )
  FROM totals;
$$;
