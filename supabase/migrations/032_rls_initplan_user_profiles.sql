-- ============================================================
-- Migración 032 — Optimización RLS de user_profiles (initplan)
-- La política users_read_own_profile evaluaba auth.uid() UNA VEZ POR FILA. Como
-- user_profiles se consulta en casi todos los requests (resolución de rol), es
-- una política caliente. Envolver la función en un subselect hace que el planner
-- la evalúe una sola vez (InitPlan) en lugar de por fila.
-- Semántica idéntica; solo rendimiento. Recomendación oficial de Supabase:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

DROP POLICY IF EXISTS users_read_own_profile ON user_profiles;
CREATE POLICY users_read_own_profile ON user_profiles FOR SELECT
  USING (id = (SELECT auth.uid()));
