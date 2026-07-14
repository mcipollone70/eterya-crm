-- Nome visualizzato per i giri visite salvati (rinomina e ordinamento)

ALTER TABLE visit_tours
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE visit_tours
SET name = 'Giro ' || to_char(tour_date, 'DD/MM/YYYY')
WHERE name IS NULL OR trim(name) = '';

ALTER TABLE visit_tours
  ALTER COLUMN name SET DEFAULT 'Giro';
