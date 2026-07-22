-- ============================================================
-- Migración 033 — Tarifas de turno de liquidación (con vigencia)
-- Saca las tarifas por turno (mañana/tarde/día completo/recargo dominical) de
-- localStorage a una tabla compartida y con vigencia por fecha. Antes:
--   - cada NAVEGADOR guardaba sus propias tarifas → dos admins liquidaban distinto
--     el mismo periodo,
--   - sin historial: cambiar una tarifa alteraba en silencio la liquidación de
--     periodos ya pasados (recalcular un mes viejo usaba la tarifa nueva).
-- Ahora cada fila es un juego de tarifas vigente DESDE una fecha; la liquidación
-- de un periodo usa el juego con effective_from más reciente <= inicio del periodo.
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_shift_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL UNIQUE,
  manana NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (manana >= 0),
  tarde NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tarde >= 0),
  dia_completo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dia_completo >= 0),
  recargo_dominical NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (recargo_dominical >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Búsqueda típica: "juego vigente <= fecha" → ORDER BY effective_from DESC LIMIT 1.
CREATE INDEX IF NOT EXISTS idx_payroll_shift_rates_eff ON payroll_shift_rates(effective_from DESC);

ALTER TABLE payroll_shift_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_payroll_shift_rates ON payroll_shift_rates;
CREATE POLICY admin_all_payroll_shift_rates ON payroll_shift_rates FOR ALL
  USING (private.get_user_role() = 'admin')
  WITH CHECK (private.get_user_role() = 'admin');
