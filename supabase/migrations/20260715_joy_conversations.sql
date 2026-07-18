-- Conversazioni Joy AI (persistenza server-side per utente)

CREATE TABLE IF NOT EXISTS joy_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Nuova chat',
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_joy_conversations_user_updated
  ON joy_conversations (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_joy_conversations_updated_at ON joy_conversations;
CREATE TRIGGER trg_joy_conversations_updated_at
  BEFORE UPDATE ON joy_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE joy_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "joy_conversations_select_own" ON joy_conversations;
CREATE POLICY "joy_conversations_select_own" ON joy_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "joy_conversations_insert_own" ON joy_conversations;
CREATE POLICY "joy_conversations_insert_own" ON joy_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "joy_conversations_update_own" ON joy_conversations;
CREATE POLICY "joy_conversations_update_own" ON joy_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "joy_conversations_delete_own" ON joy_conversations;
CREATE POLICY "joy_conversations_delete_own" ON joy_conversations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
