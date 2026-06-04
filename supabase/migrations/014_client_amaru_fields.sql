-- ============================================================
-- Migración 014 — Campos AMARU en clientes + direcciones múltiples
-- ============================================================
-- Campos nuevos (nullable/defaulted, backfill-safe; no tocan company_name NOT NULL).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS naturaleza TEXT NOT NULL DEFAULT 'juridica'
  CHECK (naturaleza IN ('natural', 'juridica'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS second_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_surname TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS second_surname TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sucursal TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS customer_type TEXT;   -- Tipo (Hogar/...)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS origen TEXT;          -- Origen (Referido/...)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone2 TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Direcciones adicionales por cliente (supletorias; el DIAN sigue usando clients.address).
CREATE TABLE IF NOT EXISTS client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT,
  address TEXT NOT NULL,
  city_code VARCHAR(5) NOT NULL DEFAULT '11001',
  indicaciones TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client ON client_addresses(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_primary_address ON client_addresses(client_id) WHERE is_primary;

ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_client_addresses" ON client_addresses;
CREATE POLICY "admin_all_client_addresses" ON client_addresses FOR ALL USING (get_user_role() = 'admin');
DROP POLICY IF EXISTS "cleaners_read_assigned_client_addresses" ON client_addresses;
CREATE POLICY "cleaners_read_assigned_client_addresses" ON client_addresses FOR SELECT
  USING (get_user_role() = 'cleaner' AND EXISTS (
    SELECT 1 FROM services s WHERE s.client_id = client_addresses.client_id AND s.cleaner_id = get_user_cleaner_id()
  ));
