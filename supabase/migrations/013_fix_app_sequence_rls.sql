-- ============================================================
-- Migración 013 — Endurecer la secuencia genérica (hallazgos del advisor)
-- ============================================================
-- app_sequence solo la usa el servidor (trigger / service_role). RLS sin
-- políticas = nadie la lee/escribe vía PostgREST (igual que invoice_sequence).
ALTER TABLE app_sequence ENABLE ROW LEVEL SECURITY;

-- Revocar de PUBLIC (no solo anon/authenticated): el trigger SECURITY DEFINER y
-- service_role siguen ejecutándolas; nadie las llama por RPC.
REVOKE EXECUTE ON FUNCTION allocate_sequence(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_novedad_cod() FROM PUBLIC;
