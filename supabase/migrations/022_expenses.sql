-- ============================================================
-- Migración 022 — Gastos / egresos operativos
-- Hasta ahora AMARU solo registraba ingresos (facturas). Con los gastos puede
-- calcular margen (P&L = ingresos − gastos). MVP: categoría gestionable + gasto
-- con soporte adjunto. Día 2 (a validar con contador): proveedores con NIT,
-- Documento Soporte DIAN (Res. 000167/2021), retenciones y abonos de egreso.
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    puc_code TEXT,                       -- cuenta PUC opcional (ej. 5135)
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT current_date,
    category_id UUID REFERENCES expense_categories(id) ON DELETE RESTRICT,
    supplier_name TEXT,                  -- tercero/proveedor (texto en MVP)
    cost_center TEXT,                    -- centro de costo (texto en MVP)
    description TEXT,
    base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    iva_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_status IN ('pendiente', 'pagado')),
    support_path TEXT,                   -- soporte en bucket privado expense-receipts
    support_type TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_expense_categories ON expense_categories;
CREATE POLICY admin_all_expense_categories ON expense_categories FOR ALL
    USING (private.get_user_role() = 'admin')
    WITH CHECK (private.get_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_expenses ON expenses;
CREATE POLICY admin_all_expenses ON expenses FOR ALL
    USING (private.get_user_role() = 'admin')
    WITH CHECK (private.get_user_role() = 'admin');

-- Bucket PRIVADO para los soportes (factura del proveedor, recibo, etc.).
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_all_expense_receipts" ON storage.objects;
CREATE POLICY "admin_all_expense_receipts" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'expense-receipts' AND private.get_user_role() = 'admin')
    WITH CHECK (bucket_id = 'expense-receipts' AND private.get_user_role() = 'admin');

-- Categorías base (editables/ampliables desde la app).
INSERT INTO expense_categories (name) VALUES
    ('Insumos de aseo'),
    ('Dotación y EPP'),
    ('Transporte'),
    ('Arriendo'),
    ('Servicios públicos'),
    ('Nómina y seguridad social'),
    ('Administración'),
    ('Otros')
ON CONFLICT (name) DO NOTHING;
