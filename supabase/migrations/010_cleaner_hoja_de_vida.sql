-- ============================================================
-- Migración 010 — Hoja de vida del auxiliar (campos en cleaners)
-- ============================================================
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS photo_url TEXT;                 -- ruta en storage (bucket cleaner-photos)
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS eps TEXT;                       -- salud
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS arl TEXT;                       -- riesgos laborales
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS hire_date DATE;                 -- fecha de ingreso

-- Sin cambios de RLS (heredan admin_all_cleaners + cleaners_read_own).
