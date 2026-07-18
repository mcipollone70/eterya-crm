-- Allow the same product on multiple quote/order lines with distinct
-- quantities, prices, discounts, VAT and descriptions.
-- Additive, idempotent, non-destructive. Do NOT auto-apply — run manually.
--
-- Root cause: opportunity_products PRIMARY KEY (opportunity_id, product_id)
-- blocked duplicate product_id on the same opportunity.

-- ---------------------------------------------------------------------------
-- 1) Add surrogate line id (backfill existing rows, no data loss)
-- ---------------------------------------------------------------------------
ALTER TABLE opportunity_products
  ADD COLUMN IF NOT EXISTS id UUID;

UPDATE opportunity_products
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE opportunity_products
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE opportunity_products
  ALTER COLUMN id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Replace composite PK with id PRIMARY KEY
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pk_cols TEXT;
BEGIN
  SELECT string_agg(a.attname, ',' ORDER BY u.ord)
  INTO pk_cols
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = u.attnum
  WHERE c.conrelid = 'public.opportunity_products'::regclass
    AND c.contype = 'p';

  -- Drop only the composite (opportunity_id, product_id) primary key.
  IF pk_cols = 'opportunity_id,product_id' THEN
    ALTER TABLE opportunity_products DROP CONSTRAINT opportunity_products_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.opportunity_products'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE opportunity_products
      ADD CONSTRAINT opportunity_products_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Keep FKs; ensure supporting indexes (PK no longer covers opportunity_id)
-- ---------------------------------------------------------------------------
-- FKs opportunity_id → opportunities(id) and product_id → products(id) remain.
CREATE INDEX IF NOT EXISTS idx_opportunity_products_opportunity
  ON opportunity_products (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_product
  ON opportunity_products (product_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_products_opportunity_sort
  ON opportunity_products (opportunity_id, sort_order);

COMMENT ON COLUMN opportunity_products.id IS
  'Surrogate PK for quote/order lines; same product_id may appear on multiple rows.';
