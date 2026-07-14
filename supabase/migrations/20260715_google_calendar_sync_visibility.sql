-- Consente la lettura degli stati sync per badge agenda multi-agente.
-- I token OAuth restano protetti da RLS su google_calendar_connections.

DROP POLICY IF EXISTS "authenticated_own_calendar_external_events" ON calendar_external_events;

CREATE POLICY "authenticated_read_calendar_external_events"
  ON calendar_external_events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_own_calendar_external_events"
  ON calendar_external_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_update_own_calendar_external_events"
  ON calendar_external_events
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_delete_own_calendar_external_events"
  ON calendar_external_events
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
