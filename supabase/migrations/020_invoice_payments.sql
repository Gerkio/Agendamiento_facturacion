-- ============================================================
-- Migración 020 — Abonos / pagos de facturas (cartera)
-- Registra los pagos parciales o totales de una factura para el seguimiento de
-- cuentas por cobrar (clientes a crédito). El saldo se deriva (total − abonos),
-- no se almacena, para que siempre cuadre con los abonos registrados.
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),  -- monto del abono (COP)
    paid_at DATE NOT NULL DEFAULT current_date,        -- fecha del pago
    method TEXT,                                       -- medio (efectivo, transferencia…)
    note TEXT,
    created_by UUID,                                   -- auth.users.id del admin que lo registró
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- Solo administradores gestionan la cartera. Los limpiadores no ven pagos.
DROP POLICY IF EXISTS admin_all_invoice_payments ON invoice_payments;
CREATE POLICY admin_all_invoice_payments ON invoice_payments FOR ALL
    USING (private.get_user_role() = 'admin')
    WITH CHECK (private.get_user_role() = 'admin');
