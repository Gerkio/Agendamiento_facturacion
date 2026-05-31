-- ============================================================
-- Migración 006 — Mínimo privilegio en RLS (protección de PII)
-- Endurece el acceso de los ASEADORES a datos sensibles de clientes y
-- compañeros. Antes, cualquier aseador autenticado podía leer la base COMPLETA
-- de clientes (NIT, correo, dirección, teléfono) y de limpiadores pegando
-- directo a la API. Ahora solo ven lo estrictamente necesario para su trabajo.
-- Ejecutar en Supabase SQL Editor. No afecta a los administradores.
-- ============================================================

-- CLIENTES: un aseador solo puede leer los clientes que tienen al menos un
-- servicio asignado a él. Así puede ver dirección/indicaciones de las casas que
-- debe visitar, pero no enumerar toda la cartera de clientes.
DROP POLICY IF EXISTS "cleaners_read_clients" ON clients;
CREATE POLICY "cleaners_read_assigned_clients" ON clients FOR SELECT
  USING (
    get_user_role() = 'cleaner'
    AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.client_id = clients.id
        AND s.cleaner_id = get_user_cleaner_id()
    )
  );

-- LIMPIADORES: un aseador solo puede leer su propia ficha (no la de sus
-- compañeros, que incluye cédula y teléfono). El administrador conserva acceso
-- total vía la política admin_all_cleaners.
DROP POLICY IF EXISTS "cleaners_read_all" ON cleaners;
CREATE POLICY "cleaners_read_own" ON cleaners FOR SELECT
  USING (get_user_role() = 'cleaner' AND id = get_user_cleaner_id());

-- Nota: los aseadores NO tienen políticas de INSERT/UPDATE/DELETE en clients,
-- cleaners, invoices ni user_profiles → solo lectura del subconjunto permitido.
-- Las facturas siguen siendo exclusivas de administradores (admin_all_invoices).
