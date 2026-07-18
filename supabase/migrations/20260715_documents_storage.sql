-- Gestione Documenti — bucket Storage privato + policy RLS
-- Modulo 10: abilita upload/download documenti collegati alle entità (attachments).
-- La tabella `attachments` esiste già (vedi schema.sql). Questa migrazione crea
-- il bucket di storage e le policy per gli utenti autenticati.

-- 1) Bucket privato "documents"
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Policy RLS su storage.objects (modello single-tenant: tutti gli autenticati)
DROP POLICY IF EXISTS "documents_authenticated_select" ON storage.objects;
CREATE POLICY "documents_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_authenticated_insert" ON storage.objects;
CREATE POLICY "documents_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_authenticated_update" ON storage.objects;
CREATE POLICY "documents_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_authenticated_delete" ON storage.objects;
CREATE POLICY "documents_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
