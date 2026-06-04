-- ============================================================
-- Migración 009 — Campos AMARU en servicios y clientes
-- ============================================================
-- Servicios: tipo, observaciones para el auxiliar e internas.
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS obs_auxiliar TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS obs_internas TEXT;

-- Clientes: forma de pago (a nivel de cliente, p.ej. "Crédito 30 días").
ALTER TABLE clients ADD COLUMN IF NOT EXISTS forma_pago TEXT;

-- Sin cambios de RLS: las columnas heredan las políticas de cada tabla.
-- Nota: obs_internas se oculta en la UI del aseador (no en RLS) en v1.
