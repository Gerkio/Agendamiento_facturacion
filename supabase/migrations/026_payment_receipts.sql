-- ============================================================
-- Migración 026 — Recibos de caja (comprobante de pago) + devolución
-- Formaliza los abonos de la cartera en un documento numerado e imprimible
-- (recibo de caja). Es soporte contable INTERNO, NO un documento DIAN. La
-- "devolución" anula el recibo y devuelve el saldo a las facturas.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL DEFAULT current_date,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  method TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'anulado')),
  reversal_reason TEXT,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_client ON payment_receipts(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);

-- Un recibo agrupa 1..N abonos (distribución entre varias facturas).
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES payment_receipts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_payments_receipt ON invoice_payments(receipt_id);

-- Consecutivo RC-00001 (secuencia genérica; el recibo no es fiscal).
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'RC-' || lpad(allocate_sequence('RC')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_receipt_number ON payment_receipts;
CREATE TRIGGER trg_receipt_number BEFORE INSERT ON payment_receipts
  FOR EACH ROW EXECUTE FUNCTION set_receipt_number();
REVOKE EXECUTE ON FUNCTION set_receipt_number() FROM PUBLIC, anon, authenticated;

ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_payment_receipts ON payment_receipts;
CREATE POLICY admin_all_payment_receipts ON payment_receipts FOR ALL
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');

-- Devolución atómica: anula el recibo y borra sus abonos (devuelve saldo a las
-- facturas). SECURITY INVOKER → corre con los privilegios del admin (la RLS de
-- payment_receipts e invoice_payments aplica; un no-admin no afecta filas).
CREATE OR REPLACE FUNCTION reverse_payment_receipt(p_receipt_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE payment_receipts
    SET status = 'anulado', reversal_reason = p_reason, reversed_at = now(), reversed_by = auth.uid()
    WHERE id = p_receipt_id AND status = 'activo';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo no encontrado o ya anulado';
  END IF;
  DELETE FROM invoice_payments WHERE receipt_id = p_receipt_id;
END;
$$;
