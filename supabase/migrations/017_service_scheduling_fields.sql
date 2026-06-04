-- ============================================================
-- Migración 017 — Campos de agendamiento (fieles a la herramienta de referencia)
-- ============================================================
-- Reorganiza el modal de "Agendar servicio": clasificación operativa, turno,
-- recargo dominical/festivo y forma de pago por servicio (con default del cliente).
-- Todos nullable/defaulted (backfill-safe).

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_class TEXT NOT NULL DEFAULT 'Normal'
  CHECK (service_class IN ('Normal', 'Garantía', 'Obsequio', 'Reinducción', 'Dominical'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS turno TEXT
  CHECK (turno IS NULL OR turno IN ('manana', 'tarde', 'dia_completo'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS recargo_dominical BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS forma_pago TEXT;
