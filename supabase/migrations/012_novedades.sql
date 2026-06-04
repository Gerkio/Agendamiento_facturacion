-- ============================================================
-- Migración 012 — Módulo Novedades (RR.HH.) + secuencia genérica
-- ============================================================

-- Secuencia atómica genérica por prefijo (mismo patrón que allocate_invoice_number).
CREATE TABLE IF NOT EXISTS app_sequence (
  prefix TEXT PRIMARY KEY,
  current_number BIGINT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION allocate_sequence(p_prefix TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  INSERT INTO app_sequence (prefix, current_number)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix)
    DO UPDATE SET current_number = app_sequence.current_number + 1
  RETURNING current_number INTO n;
  RETURN n;
END;
$$;

-- Solo el servidor (service_role) usa la secuencia; no exponer por RPC.
REVOKE EXECUTE ON FUNCTION allocate_sequence(TEXT) FROM anon, authenticated;

-- Tabla de novedades (permisos, vacaciones, incapacidades, etc.).
CREATE TABLE IF NOT EXISTS novedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  cod TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('permiso', 'vacaciones', 'incapacidad', 'otro')),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'resuelta')),
  responsible TEXT,
  last_observation TEXT,
  start_date DATE NOT NULL DEFAULT current_date,
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_novedades_cleaner ON novedades(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_novedades_status ON novedades(status);
CREATE INDEX IF NOT EXISTS idx_novedades_start ON novedades(start_date DESC);

-- Trigger: asigna el código secuencial NOV-00001 si no viene.
CREATE OR REPLACE FUNCTION set_novedad_cod()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cod IS NULL THEN
    NEW.cod := 'NOV-' || lpad(allocate_sequence('NOV')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_novedad_cod ON novedades;
CREATE TRIGGER trg_novedad_cod BEFORE INSERT ON novedades
  FOR EACH ROW EXECUTE FUNCTION set_novedad_cod();

-- RLS: admin total; el aseador puede leer sus propias novedades.
ALTER TABLE novedades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_novedades" ON novedades;
CREATE POLICY "admin_all_novedades" ON novedades FOR ALL USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "cleaner_read_own_novedades" ON novedades;
CREATE POLICY "cleaner_read_own_novedades" ON novedades FOR SELECT
  USING (get_user_role() = 'cleaner' AND cleaner_id = get_user_cleaner_id());
