-- ============================================================
-- Migración 030 — Integridad de abonos (cartera)
-- (1) Invariante en la BD: la suma de abonos de una factura NO puede superar su
--     total. Antes solo se validaba en el navegador (evadible por REST y sin
--     protección ante concurrencia). Ahora un trigger lo impone bloqueando la fila.
-- (2) created_by (ya existía uuid, siempre NULL): se le da DEFAULT auth.uid() y
--     FK a auth.users para trazar quién registró cada abono, sin tocar el cliente.
-- ============================================================

-- created_by: autopoblar con el usuario autenticado del JWT + integridad referencial.
ALTER TABLE invoice_payments ALTER COLUMN created_by SET DEFAULT auth.uid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'invoice_payments'
      AND constraint_name = 'invoice_payments_created_by_fkey'
  ) THEN
    ALTER TABLE invoice_payments
      ADD CONSTRAINT invoice_payments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Invariante suma(abonos) <= total de la factura. FOR UPDATE bloquea la factura
-- para evitar sobrepago por inserciones concurrentes. Tolerancia de 0.5 por
-- redondeo. SECURITY DEFINER para poder leer invoices con el bloqueo.
CREATE OR REPLACE FUNCTION check_payment_within_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv_total NUMERIC;
  ya_abonado NUMERIC;
BEGIN
  SELECT total_amount INTO inv_total FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF inv_total IS NULL THEN
    RAISE EXCEPTION 'La factura % no existe.', NEW.invoice_id;
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO ya_abonado
    FROM invoice_payments
    WHERE invoice_id = NEW.invoice_id AND id <> NEW.id;
  IF ya_abonado + NEW.amount > inv_total + 0.5 THEN
    RAISE EXCEPTION 'El abono (%) supera el saldo pendiente: total %, ya abonado %.', NEW.amount, inv_total, ya_abonado;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_balance ON invoice_payments;
CREATE TRIGGER trg_payment_balance BEFORE INSERT OR UPDATE OF amount ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_within_balance();

REVOKE EXECUTE ON FUNCTION check_payment_within_balance() FROM PUBLIC, anon, authenticated;
