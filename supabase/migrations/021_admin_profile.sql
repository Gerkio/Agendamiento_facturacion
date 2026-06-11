-- ============================================================
-- Migración 021 — Perfil de administradores (nombre + foto)
-- Los auxiliares ya tienen nombre/foto en `cleaners`; los administradores solo
-- tenían correo. Se agrega nombre y foto al perfil para administrarlos mejor.
-- ============================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Bucket PRIVADO para fotos de administradores (mismo patrón que cleaner-photos:
-- lectura con URL firmada desde el servidor; subida con service_role).
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-photos', 'admin-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_all_admin_photos" ON storage.objects;
CREATE POLICY "admin_all_admin_photos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'admin-photos' AND private.get_user_role() = 'admin')
  WITH CHECK (bucket_id = 'admin-photos' AND private.get_user_role() = 'admin');
