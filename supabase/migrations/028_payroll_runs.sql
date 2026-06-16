-- ============================================================
-- Migración 028 — Nómina: corridas (runs) + desprendibles (items)
-- Cada corrida liquida un periodo; cada item es el desprendible de un auxiliar
-- con el snapshot del cálculo. Numeración NOM- (allocate_sequence). RLS:
-- admin total; el auxiliar lee SOLO sus propios desprendibles.
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod TEXT UNIQUE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  period_kind TEXT NOT NULL DEFAULT 'mensual' CHECK (period_kind IN ('mensual', 'quincena_1', 'quincena_2')),
  param_id UUID REFERENCES payroll_parameters(id),
  status TEXT NOT NULL DEFAULT 'calculada' CHECK (status IN ('borrador', 'calculada', 'aprobada', 'pagada', 'anulada')),
  total_devengado NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deducciones NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_neto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_aportes_patronales NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_provisiones NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_total_empleador NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month, period_kind)
);

CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES cleaners(id) ON DELETE RESTRICT,
  -- Snapshot del contrato y del cálculo.
  base_salary NUMERIC(12,2) NOT NULL,
  salary_type TEXT NOT NULL,
  arl_risk_level TEXT NOT NULL,
  ibc NUMERIC(12,2) NOT NULL,
  worked_days INT NOT NULL,
  salary_earned NUMERIC(12,2) NOT NULL,
  transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_devengado NUMERIC(12,2) NOT NULL,
  health_employee NUMERIC(12,2) NOT NULL,
  pension_employee NUMERIC(12,2) NOT NULL,
  fsp NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deducciones NUMERIC(12,2) NOT NULL,
  neto_pagar NUMERIC(12,2) NOT NULL,
  health_employer NUMERIC(12,2) NOT NULL,
  pension_employer NUMERIC(12,2) NOT NULL,
  arl NUMERIC(12,2) NOT NULL,
  ccf NUMERIC(12,2) NOT NULL,
  icbf NUMERIC(12,2) NOT NULL,
  sena NUMERIC(12,2) NOT NULL,
  exonerated BOOLEAN NOT NULL DEFAULT false,
  prov_cesantias NUMERIC(12,2) NOT NULL DEFAULT 0,
  prov_intereses NUMERIC(12,2) NOT NULL DEFAULT 0,
  prov_prima NUMERIC(12,2) NOT NULL DEFAULT 0,
  prov_vacaciones NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_provisiones NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_empleador NUMERIC(12,2) NOT NULL,
  -- Placeholders de nómina electrónica DIAN (requiere artefactos oficiales).
  cune TEXT,
  ne_status TEXT NOT NULL DEFAULT 'no_generado' CHECK (ne_status IN ('no_generado', 'generado', 'firmado', 'enviado', 'aceptado', 'rechazado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, cleaner_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_cleaner ON payroll_items(cleaner_id);

-- Numeración NOM-00001.
CREATE OR REPLACE FUNCTION set_payroll_run_cod()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cod IS NULL THEN
    NEW.cod := 'NOM-' || lpad(allocate_sequence('NOM')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_payroll_run_cod ON payroll_runs;
CREATE TRIGGER trg_payroll_run_cod BEFORE INSERT ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_payroll_run_cod();
REVOKE EXECUTE ON FUNCTION set_payroll_run_cod() FROM PUBLIC, anon, authenticated;

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_payroll_runs ON payroll_runs;
CREATE POLICY admin_all_payroll_runs ON payroll_runs FOR ALL
  USING (private.get_user_role() = 'admin') WITH CHECK (private.get_user_role() = 'admin');

DROP POLICY IF EXISTS admin_all_payroll_items ON payroll_items;
CREATE POLICY admin_all_payroll_items ON payroll_items FOR ALL
  USING (private.get_user_role() = 'admin') WITH CHECK (private.get_user_role() = 'admin');

-- El auxiliar puede leer sus propios desprendibles.
DROP POLICY IF EXISTS cleaner_read_own_payroll_items ON payroll_items;
CREATE POLICY cleaner_read_own_payroll_items ON payroll_items FOR SELECT
  USING (private.get_user_role() = 'cleaner' AND cleaner_id = private.get_user_cleaner_id());
