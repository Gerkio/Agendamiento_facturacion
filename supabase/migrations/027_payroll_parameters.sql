-- ============================================================
-- Migración 027 — Nómina: parámetros del año + contrato del auxiliar
-- Parámetros 100% editables por el contador (NO hardcodeados): el SMMLV 2026
-- está judicialmente cuestionado, y las tasas/ARL/FSP cambian por norma. Un año
-- debe quedar verified_by_accountant antes de liquidar. Cifras sembradas como
-- referencia (verificar con contador). RLS solo-admin.
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL UNIQUE CHECK (year BETWEEN 2024 AND 2100),
  smmlv NUMERIC(12,2) NOT NULL,
  transport_allowance NUMERIC(12,2) NOT NULL,
  -- Aportes (fracciones, no porcentajes hardcodeados).
  health_employer NUMERIC(6,5) NOT NULL DEFAULT 0.085,
  health_employee NUMERIC(6,5) NOT NULL DEFAULT 0.04,
  pension_employer NUMERIC(6,5) NOT NULL DEFAULT 0.12,
  pension_employee NUMERIC(6,5) NOT NULL DEFAULT 0.04,
  ccf_rate NUMERIC(6,5) NOT NULL DEFAULT 0.04,
  icbf_rate NUMERIC(6,5) NOT NULL DEFAULT 0.03,
  sena_rate NUMERIC(6,5) NOT NULL DEFAULT 0.02,
  -- Provisiones de prestaciones.
  cesantias_rate NUMERIC(6,5) NOT NULL DEFAULT 0.0833,
  intereses_cesantias_rate NUMERIC(6,5) NOT NULL DEFAULT 0.12,
  prima_rate NUMERIC(6,5) NOT NULL DEFAULT 0.0833,
  vacaciones_rate NUMERIC(6,5) NOT NULL DEFAULT 0.0417,
  -- Topes y reglas (en SMMLV).
  ibc_min_smmlv NUMERIC(6,2) NOT NULL DEFAULT 1,
  ibc_max_smmlv NUMERIC(6,2) NOT NULL DEFAULT 25,
  transport_max_smmlv NUMERIC(6,2) NOT NULL DEFAULT 2,
  exoneration_threshold_smmlv NUMERIC(6,2) NOT NULL DEFAULT 10,
  fsp_min_smmlv NUMERIC(6,2) NOT NULL DEFAULT 4,
  fsp_brackets JSONB NOT NULL DEFAULT '[{"from":4,"to":16,"rate":0.01},{"from":16,"to":17,"rate":0.012},{"from":17,"to":18,"rate":0.014},{"from":18,"to":19,"rate":0.016},{"from":19,"to":20,"rate":0.018},{"from":20,"to":9999,"rate":0.02}]'::jsonb,
  arl_rates JSONB NOT NULL DEFAULT '{"I":0.00522,"II":0.01044,"III":0.02436,"IV":0.0435,"V":0.0696}'::jsonb,
  -- ¿La empresa es beneficiaria de la exoneración art. 114-1? (lo confirma el contador).
  exoneration_eligible BOOLEAN NOT NULL DEFAULT false,
  verified_by_accountant BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_parameters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_all_payroll_parameters ON payroll_parameters;
CREATE POLICY admin_all_payroll_parameters ON payroll_parameters FOR ALL
  USING (private.get_user_role() = 'admin') WITH CHECK (private.get_user_role() = 'admin');

-- Contrato laboral del auxiliar (lo que el cálculo necesita).
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS contract_type TEXT
  CHECK (contract_type IS NULL OR contract_type IN ('indefinido','fijo','obra_labor','aprendizaje'));
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS salary_type TEXT
  CHECK (salary_type IS NULL OR salary_type IN ('ordinario','integral'));
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2);
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS has_transport_allowance BOOLEAN DEFAULT true;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS arl_risk_level TEXT
  CHECK (arl_risk_level IS NULL OR arl_risk_level IN ('I','II','III','IV','V'));
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS payment_periodicity TEXT
  CHECK (payment_periodicity IS NULL OR payment_periodicity IN ('mensual','quincenal'));
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS afp_code TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS ccf_code TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS bank_account_type TEXT
  CHECK (bank_account_type IS NULL OR bank_account_type IN ('ahorros','corriente'));
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS contract_end DATE;

-- Semilla de referencia (verificar con contador; el 2026 está cuestionado).
INSERT INTO payroll_parameters (year, smmlv, transport_allowance) VALUES
  (2025, 1423500, 200000),
  (2026, 1750905, 249095)
ON CONFLICT (year) DO NOTHING;
