-- ============================================================
-- Migración 011 — Storage privado para fotos de auxiliares
-- ============================================================
-- Bucket PRIVADO (PII). La lectura se hace con URL firmada desde el servidor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaner-photos', 'cleaner-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Solo administradores operan los objetos del bucket. La subida real se hace por
-- el servidor con service_role (omite RLS), pero dejamos la política por defensa.
DROP POLICY IF EXISTS "admin_all_cleaner_photos" ON storage.objects;
CREATE POLICY "admin_all_cleaner_photos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cleaner-photos' AND get_user_role() = 'admin')
  WITH CHECK (bucket_id = 'cleaner-photos' AND get_user_role() = 'admin');
