-- ============================================================
-- Migración 025 — Peticiones (bandeja interna del personal)
-- Solicitudes del auxiliar a RR.HH./operación (permiso, dotación/EPP, anticipo,
-- certificado). Distinta de PQR (cliente) y de Novedades (la empresa abre sobre
-- el auxiliar). El auxiliar radica y consulta las suyas; solo el admin decide.
-- Patrón clonado de novedades (012): secuencia PET- + RLS admin/cleaner.
-- ============================================================

CREATE TABLE IF NOT EXISTS peticiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  cod TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('permiso', 'dotacion', 'anticipo', 'certificado', 'otro')),
  subject TEXT NOT NULL,
  description TEXT,
  amount_cop NUMERIC(12,2),             -- solo para anticipos
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'aprobada', 'rechazada', 'resuelta')),
  requested_by UUID REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peticiones_cleaner ON peticiones(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_peticiones_status ON peticiones(status);

-- Consecutivo PET-00001 (reusa allocate_sequence de la migración 012).
CREATE OR REPLACE FUNCTION set_peticion_cod()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cod IS NULL THEN
    NEW.cod := 'PET-' || lpad(allocate_sequence('PET')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_peticion_cod ON peticiones;
CREATE TRIGGER trg_peticion_cod BEFORE INSERT ON peticiones
  FOR EACH ROW EXECUTE FUNCTION set_peticion_cod();
REVOKE EXECUTE ON FUNCTION set_peticion_cod() FROM PUBLIC, anon, authenticated;

ALTER TABLE peticiones ENABLE ROW LEVEL SECURITY;

-- Admin: total. El auxiliar: lee y radica SOLO las suyas, siempre como 'pendiente'
-- (no puede aprobarse a sí mismo: las decisiones quedan solo al admin).
DROP POLICY IF EXISTS admin_all_peticiones ON peticiones;
CREATE POLICY admin_all_peticiones ON peticiones FOR ALL
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

DROP POLICY IF EXISTS cleaner_select_own_peticiones ON peticiones;
CREATE POLICY cleaner_select_own_peticiones ON peticiones FOR SELECT
  USING (private.get_user_role() = 'cleaner' AND cleaner_id = private.get_user_cleaner_id());

DROP POLICY IF EXISTS cleaner_insert_own_peticiones ON peticiones;
CREATE POLICY cleaner_insert_own_peticiones ON peticiones FOR INSERT
  WITH CHECK (private.get_user_role() = 'cleaner' AND cleaner_id = private.get_user_cleaner_id() AND status = 'pendiente');
