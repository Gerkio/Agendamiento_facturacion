-- ============================================================
-- Migración 015 — Storage privado para fotos de clientes
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-photos', 'client-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_all_client_photos" ON storage.objects;
CREATE POLICY "admin_all_client_photos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'client-photos' AND get_user_role() = 'admin')
  WITH CHECK (bucket_id = 'client-photos' AND get_user_role() = 'admin');
