-- ============================================================
-- Migración 023 — Garantías (re-aseo por reclamo)
-- La clase de servicio 'Garantía' ya existe (migración 017); aquí se le da
-- estructura: vínculo al servicio original reclamado, motivo y notas, para poder
-- medir la tasa de garantía y su causa. Extiende `services` (no tabla nueva); las
-- políticas RLS existentes (admin_all_services / cleaner_read_own) ya cubren.
-- ============================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS original_service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_reason TEXT
    CHECK (warranty_reason IS NULL OR warranty_reason IN ('mala_calidad', 'area_faltante', 'queja_cliente', 'dano', 'otro'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

-- Índice parcial: solo indexa los servicios de garantía (el reporte filtra por clase).
CREATE INDEX IF NOT EXISTS idx_services_garantia ON services(start_time DESC) WHERE service_class = 'Garantía';
