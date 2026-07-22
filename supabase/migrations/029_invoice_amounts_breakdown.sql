-- ============================================================
-- Migración 029 — Importes desglosados en facturas y notas crédito
-- Resuelve la ambigüedad de total_amount: hasta ahora guardaba la BASE (sin IVA),
-- pero cartera/recibos/reportes lo usaban como total a cobrar. Con IVA > 0 eso
-- subfacturaba el impuesto. Ahora se persiste subtotal (base) + tax_amount (IVA),
-- y total_amount pasa a ser el TOTAL CON IVA (lo que se cobra y concilia).
-- El writeback de api/dian/send y de credit-note escribe los tres.
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill: históricamente el IVA fue 0 (exento por defecto), así que total_amount
-- era igual a la base. Copiamos base = total_amount para las filas existentes; el
-- tax_amount queda en 0 (correcto para esas facturas).
UPDATE invoices SET subtotal = total_amount WHERE subtotal = 0 AND total_amount <> 0;
UPDATE credit_notes SET subtotal = total_amount WHERE subtotal = 0 AND total_amount <> 0;
