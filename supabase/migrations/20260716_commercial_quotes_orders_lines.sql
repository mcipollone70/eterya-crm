-- Commercial cycle completion: line items, order fulfillment, quote history,
-- product family "altro", service ticket ↔ order link.
-- Additive, idempotent. RLS + policies. Do NOT auto-apply — run manually.

-- ---------------------------------------------------------------------------
-- 1) Product family: Altro
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_family')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'product_family' AND e.enumlabel = 'altro'
     ) THEN
    ALTER TYPE product_family ADD VALUE 'altro';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Order fulfillment status (separate from quote OpportunityStatus)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_fulfillment_status') THEN
    CREATE TYPE order_fulfillment_status AS ENUM (
      'bozza',
      'confermato',
      'in_lavorazione',
      'pronto',
      'consegnato',
      'annullato'
    );
  END IF;
END $$;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS order_status order_fulfillment_status,
  ADD COLUMN IF NOT EXISTS expected_delivery_at DATE,
  ADD COLUMN IF NOT EXISTS order_date DATE,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS converted_from_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;

COMMENT ON COLUMN opportunities.order_status IS
  'Stato evasione ordine (valorizzato quando stage = won).';
COMMENT ON COLUMN opportunities.converted_from_id IS
  'Opportunità/preventivo di origine se creato come ordine separato.';

CREATE INDEX IF NOT EXISTS idx_opportunities_order_status
  ON opportunities (order_status)
  WHERE order_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_expected_delivery
  ON opportunities (expected_delivery_at)
  WHERE expected_delivery_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_converted_from
  ON opportunities (converted_from_id)
  WHERE converted_from_id IS NOT NULL;

-- Backfill order_status for existing won opportunities
UPDATE opportunities
SET
  order_status = COALESCE(order_status, 'confermato'::order_fulfillment_status),
  order_date = COALESCE(order_date, accepted_at::date, opened_at::date, created_at::date)
WHERE stage = 'won' AND order_status IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Quote / order line items on opportunity_products
-- ---------------------------------------------------------------------------
ALTER TABLE opportunity_products
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 3) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunity_products_quantity_positive'
  ) THEN
    ALTER TABLE opportunity_products
      ADD CONSTRAINT opportunity_products_quantity_positive CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunity_products_discount_range'
  ) THEN
    ALTER TABLE opportunity_products
      ADD CONSTRAINT opportunity_products_discount_range
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'opportunity_products_vat_range'
  ) THEN
    ALTER TABLE opportunity_products
      ADD CONSTRAINT opportunity_products_vat_range
      CHECK (vat_rate >= 0 AND vat_rate <= 100);
  END IF;
END $$;

-- Recalculate line_total for existing rows (net of discount, incl. VAT)
UPDATE opportunity_products op
SET line_total = ROUND(
  (op.quantity * op.unit_price)
  * (1 - COALESCE(op.discount_percent, 0) / 100.0)
  * (1 + COALESCE(op.vat_rate, 22) / 100.0),
  2
)
WHERE op.line_total = 0
  AND (op.unit_price > 0 OR op.quantity <> 1);

-- ---------------------------------------------------------------------------
-- 4) Essential change history for quotes/orders/opportunities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunity_change_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  field_name       TEXT,
  old_value        TEXT,
  new_value        TEXT,
  notes            TEXT,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunity_change_history_opp
  ON opportunity_change_history (opportunity_id, changed_at DESC);

ALTER TABLE opportunity_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_opportunity_change_history" ON opportunity_change_history;
CREATE POLICY "authenticated_all_opportunity_change_history" ON opportunity_change_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5) Service tickets: link to order (won opportunity)
-- ---------------------------------------------------------------------------
ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_tickets_order
  ON service_tickets (order_id)
  WHERE order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) Progressive document number helper (quote / order)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commercial_document_sequences (
  doc_type   TEXT PRIMARY KEY,
  year       INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commercial_document_sequences_type_check
    CHECK (doc_type IN ('quote', 'order'))
);

ALTER TABLE commercial_document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_commercial_document_sequences" ON commercial_document_sequences;
CREATE POLICY "authenticated_all_commercial_document_sequences" ON commercial_document_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION next_commercial_document_number(p_doc_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_next INTEGER;
  v_prefix TEXT;
BEGIN
  IF p_doc_type NOT IN ('quote', 'order') THEN
    RAISE EXCEPTION 'doc_type non valido: %', p_doc_type;
  END IF;

  INSERT INTO commercial_document_sequences (doc_type, year, last_value)
  VALUES (p_doc_type, v_year, 0)
  ON CONFLICT (doc_type) DO NOTHING;

  UPDATE commercial_document_sequences
  SET
    last_value = CASE
      WHEN year = v_year THEN last_value + 1
      ELSE 1
    END,
    year = v_year,
    updated_at = now()
  WHERE doc_type = p_doc_type
  RETURNING last_value INTO v_next;

  v_prefix := CASE WHEN p_doc_type = 'quote' THEN 'PRV' ELSE 'ORD' END;
  RETURN v_prefix || '-' || v_year::TEXT || '-' || lpad(v_next::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_commercial_document_number(TEXT) TO authenticated;
