-- ============================================================
-- CleanSched & Direct Billing Colombia
-- Schema DDL — Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. CLEANERS
CREATE TABLE IF NOT EXISTS cleaners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    document_id TEXT UNIQUE NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CLIENTS (With DIAN mandatory codes)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    nit_cedula TEXT UNIQUE NOT NULL,
    dv VARCHAR(1) NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    city_code VARCHAR(5) NOT NULL DEFAULT '11001',
    tax_scheme VARCHAR(2) NOT NULL DEFAULT '01',
    fiscal_regimen TEXT NOT NULL DEFAULT 'R-99-PN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INVOICES (Direct DIAN tracking)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    invoice_number TEXT UNIQUE,
    cufe TEXT UNIQUE,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    xml_content TEXT,
    dian_response_code TEXT,
    dian_response_description TEXT,
    qr_content TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    billing_status TEXT CHECK (billing_status IN ('draft', 'signed', 'sent_dian', 'rejected')) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SERVICES / EVENTS
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
    cleaner_id UUID REFERENCES cleaners(id) ON DELETE RESTRICT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('scheduled', 'completed', 'canceled')) DEFAULT 'scheduled',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_group_id UUID NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    price_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. USER PROFILES (role mapping)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'cleaner')) NOT NULL DEFAULT 'cleaner',
    cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Helper function: get current user cleaner_id
CREATE OR REPLACE FUNCTION get_user_cleaner_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT cleaner_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- user_profiles: users can read their own profile
CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin_all_profiles" ON user_profiles FOR ALL USING (get_user_role() = 'admin');

-- cleaners: admin full access, cleaners read all
CREATE POLICY "admin_all_cleaners" ON cleaners FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "cleaners_read_all" ON cleaners FOR SELECT USING (get_user_role() = 'cleaner');

-- clients: admin full access, cleaners read
CREATE POLICY "admin_all_clients" ON clients FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "cleaners_read_clients" ON clients FOR SELECT USING (get_user_role() = 'cleaner');

-- services: admin full, cleaner reads own
CREATE POLICY "admin_all_services" ON services FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "cleaner_read_own_services" ON services FOR SELECT
    USING (get_user_role() = 'cleaner' AND cleaner_id = get_user_cleaner_id());

-- invoices: admin only
CREATE POLICY "admin_all_invoices" ON invoices FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- Trigger: auto-create user_profile on new auth user
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'cleaner')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_services_client_id ON services(client_id);
CREATE INDEX IF NOT EXISTS idx_services_cleaner_id ON services(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_services_invoice_id ON services(invoice_id);
CREATE INDEX IF NOT EXISTS idx_services_start_time ON services(start_time);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(billing_status);
