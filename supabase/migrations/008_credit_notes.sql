-- ============================================================
-- Migración 008 — Notas crédito (anulación/corrección de facturas)
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Factura que corrige/anula. RESTRICT: no se borra una factura con notas.
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    note_number TEXT UNIQUE,
    cude TEXT UNIQUE,                    -- Código Único de Documento Electrónico
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    concept_code TEXT NOT NULL,          -- 1..5 (DiscrepancyResponse/ResponseCode)
    reason TEXT,                         -- descripción del motivo
    xml_content TEXT,
    dian_response_code TEXT,
    dian_response_description TEXT,
    qr_content TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    billing_status TEXT NOT NULL DEFAULT 'draft'
      CHECK (billing_status IN ('draft', 'processing', 'signed', 'sent_dian', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Solo administradores. (Las escrituras del pipeline van con service_role.)
DROP POLICY IF EXISTS "admin_all_credit_notes" ON credit_notes;
CREATE POLICY "admin_all_credit_notes" ON credit_notes FOR ALL USING (get_user_role() = 'admin');

-- La numeración reutiliza allocate_invoice_number(prefix) con un prefijo propio
-- (p.ej. 'NC'); no se requiere función nueva.
