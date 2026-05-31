-- ============================================================
-- Migración 002 — Usuarios automáticos para limpiadores
-- Ejecutar en Supabase SQL Editor (después de schema.sql).
-- ============================================================

-- Bandera: obliga a cambiar la contraseña en el primer ingreso.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- (Las políticas RLS de admin ya permiten gestionar perfiles; las rutas
--  del servidor usan la service_role y omiten RLS para crear/resetear usuarios.)
