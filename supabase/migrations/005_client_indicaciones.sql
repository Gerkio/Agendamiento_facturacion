-- ============================================================
-- Migración 005 — Indicaciones de llegada del cliente
-- Texto libre con cómo llegar a la casa del cliente; visible para el aseador.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS indicaciones TEXT;

-- Nota: el aseador (rol 'cleaner') ya puede leer clients (política cleaners_read_clients),
-- por lo que verá estas indicaciones en su agenda sin cambios de RLS.
