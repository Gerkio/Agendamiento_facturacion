-- ============================================================
-- Migración 004 — Consecutivo transaccional + idempotencia (directriz #9)
-- Evita números de factura duplicados/saltados y la doble emisión.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- 1) Estado intermedio 'processing' para la transición atómica anti-doble-envío.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_billing_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_billing_status_check
  CHECK (billing_status IN ('draft', 'processing', 'signed', 'sent_dian', 'rejected'));

-- 2) Contador de numeración por prefijo (un renglón por resolución).
CREATE TABLE IF NOT EXISTS invoice_sequence (
  prefix TEXT PRIMARY KEY,
  current_number BIGINT NOT NULL DEFAULT 0
);

-- 3) Asignación ATÓMICA del siguiente consecutivo (UPDATE ... RETURNING bloquea el renglón).
--    Devuelve el número asignado; no se reutilizan ni se saltan números bajo concurrencia.
CREATE OR REPLACE FUNCTION allocate_invoice_number(p_prefix TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  INSERT INTO invoice_sequence (prefix, current_number)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix)
    DO UPDATE SET current_number = invoice_sequence.current_number + 1
  RETURNING current_number INTO n;
  RETURN n;
END;
$$;

-- 4) (Opcional) Sembrar el contador para que el primer número sea INVOICE_FROM_NUMBER.
--    Ej.: si la resolución arranca en 990000000, ejecutar UNA vez (ajusta prefijo/valor):
--    INSERT INTO invoice_sequence (prefix, current_number) VALUES ('SETP', 989999999)
--      ON CONFLICT (prefix) DO NOTHING;
