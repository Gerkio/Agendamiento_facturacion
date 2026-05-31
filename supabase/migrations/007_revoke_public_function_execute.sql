-- ============================================================
-- Migración 007 — Revocar ejecución pública de funciones SECURITY DEFINER
-- (hallazgo del advisor de seguridad de Supabase)
-- ============================================================
-- allocate_invoice_number: solo el servidor (service_role) debe usarla para
--   asignar el consecutivo. Si un usuario autenticado la llama por
--   /rest/v1/rpc/allocate_invoice_number, podría QUEMAR números de la secuencia
--   y generar huecos en la numeración DIAN (problema de cumplimiento).
--   El código ya la invoca con el cliente admin (service_role), así que revocar
--   no rompe la emisión.
-- handle_new_user: es una función de TRIGGER; el trigger la sigue ejecutando con
--   normalidad (no depende de este GRANT). No tiene sentido exponerla por RPC.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.allocate_invoice_number(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Nota: get_user_role() y get_user_cleaner_id() SÍ deben permanecer ejecutables
-- por 'authenticated' porque se evalúan dentro de las políticas RLS. Solo
-- devuelven el rol/ID del propio usuario (no es información sensible de terceros).
