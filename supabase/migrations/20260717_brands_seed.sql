-- Seed catalogo marchi commerciali (idempotente).
-- Non sovrascrive name/slug/short_code/color se il record esiste già.

INSERT INTO brands (name, slug, short_code, color, is_active)
VALUES
  ('ETERYA', 'eterya', 'ETR', '#1B4F72', true),
  ('ZANZAR', 'zanzar', 'ZNZ', '#1E8449', true),
  ('TEMPRA GLASS', 'tempra-glass', 'TMP', '#6C3483', true),
  ('PALAGINA', 'palagina', 'PLG', '#B9770E', true)
ON CONFLICT (slug) DO NOTHING;
