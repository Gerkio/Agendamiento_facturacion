-- ============================================================
-- Migración 018 — Revocar EXECUTE de funciones SECURITY DEFINER expuestas
-- ============================================================
-- La 007 (nunca aplicada) y la 013 revocaban solo de anon/authenticated o solo
-- de PUBLIC, dejando vivo el otro GRANT. Resultado: un usuario 'cleaner'
-- autenticado podía llamar /rest/v1/rpc/allocate_invoice_number y QUEMAR
-- consecutivos de factura DIAN (huecos en la numeración). Aquí se revoca de
-- PUBLIC + anon + authenticated de una vez.
--
-- No rompe nada:
--   · El pipeline de emisión llama estas funciones con service_role (conserva EXECUTE).
--   · handle_new_user y set_novedad_cod son funciones de TRIGGER: el trigger las
--     ejecuta como dueño, sin pasar por el privilegio EXECUTE a nivel SQL.
--   · get_user_role / get_user_cleaner_id NO se tocan: se evalúan dentro de las
--     políticas RLS y solo devuelven el rol/id del propio llamante.

REVOKE EXECUTE ON FUNCTION public.allocate_invoice_number(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_novedad_cod() FROM PUBLIC, anon, authenticated;
