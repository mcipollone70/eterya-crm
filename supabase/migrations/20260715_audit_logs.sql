-- Audit Log — tracciamento azioni chiave (create/update/delete, admin, backup)
-- Modulo 18: registro non invasivo delle azioni rilevanti.

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  summary      TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Lettura/scrittura per autenticati (l'accesso alla UI è limitato agli admin
-- a livello applicativo). L'update/delete non è previsto dall'app: il log è
-- append-only lato applicazione.
DROP POLICY IF EXISTS "authenticated_all_audit_logs" ON audit_logs;
CREATE POLICY "authenticated_all_audit_logs" ON audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
