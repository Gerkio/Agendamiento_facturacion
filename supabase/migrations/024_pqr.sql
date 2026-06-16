-- ============================================================
-- Migración 024 — PQR (Peticiones, Quejas, Reclamos, Sugerencias)
-- Servicio al cliente. La empresa presta aseo COMERCIAL/PRIVADO (Ley 1480), así
-- que el plazo de respuesta es política configurable (no el término legal de
-- servicios públicos). Patrón clonado de novedades (012) + secuencia + bitácora
-- inmutable (003). RLS solo-admin con private.get_user_role().
-- ============================================================

CREATE TABLE IF NOT EXISTS pqr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado TEXT UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('peticion', 'queja', 'reclamo', 'sugerencia')),
  canal TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  petitioner_name TEXT,                 -- para PQR de no-cliente / anónimo
  petitioner_contact TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'radicada'
    CHECK (status IN ('radicada', 'en_tramite', 'respondida', 'cerrada', 'desistida')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'prioritaria')),
  responsible TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE,                        -- calculada en días hábiles según el SLA
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pqr_status ON pqr(status);
CREATE INDEX IF NOT EXISTS idx_pqr_due ON pqr(due_date);
CREATE INDEX IF NOT EXISTS idx_pqr_client ON pqr(client_id);

-- Bitácora de actuaciones (append-only).
CREATE TABLE IF NOT EXISTS pqr_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pqr_id UUID NOT NULL REFERENCES pqr(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  note TEXT,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pqr_events_pqr ON pqr_events(pqr_id);

-- Radicado PQR-00001 vía la secuencia genérica (reusa allocate_sequence de 012).
CREATE OR REPLACE FUNCTION set_pqr_radicado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.radicado IS NULL THEN
    NEW.radicado := 'PQR-' || lpad(allocate_sequence('PQR')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pqr_radicado ON pqr;
CREATE TRIGGER trg_pqr_radicado BEFORE INSERT ON pqr
  FOR EACH ROW EXECUTE FUNCTION set_pqr_radicado();

-- No exponer la función SECURITY DEFINER por RPC (el trigger no requiere EXECUTE).
REVOKE EXECUTE ON FUNCTION set_pqr_radicado() FROM PUBLIC, anon, authenticated;

ALTER TABLE pqr ENABLE ROW LEVEL SECURITY;
ALTER TABLE pqr_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_pqr ON pqr;
CREATE POLICY admin_all_pqr ON pqr FOR ALL
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- pqr_events es inmutable: solo SELECT + INSERT (sin UPDATE/DELETE).
DROP POLICY IF EXISTS admin_select_pqr_events ON pqr_events;
CREATE POLICY admin_select_pqr_events ON pqr_events FOR SELECT
  USING (private.get_user_role() = 'admin');
DROP POLICY IF EXISTS admin_insert_pqr_events ON pqr_events;
CREATE POLICY admin_insert_pqr_events ON pqr_events FOR INSERT
  WITH CHECK (private.get_user_role() = 'admin');
