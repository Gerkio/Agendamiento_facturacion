-- ============================================================
-- Migración 019 — Mover los helpers de RLS a un esquema privado
-- ============================================================
-- get_user_role() y get_user_cleaner_id() estaban en `public`, por lo que
-- PostgREST las exponía como RPC (/rest/v1/rpc/...) y el advisor las marcaba.
-- Solo devuelven el rol/id del PROPIO llamante (no filtran datos de terceros),
-- pero para eliminar la exposición se mueven al esquema `private` (no expuesto
-- por la API). NO se puede simplemente revocar EXECUTE de `authenticated`: las
-- políticas RLS llaman estas funciones y se rompería todo el acceso. Por eso se
-- recrean en `private`, se repuntan TODAS las políticas, y se borran las públicas.
-- Migración atómica: si faltara repuntar una política, el DROP FUNCTION final
-- falla y todo se revierte (probado antes con un ensayo en transacción).

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT role FROM public.user_profiles WHERE id = auth.uid(); $$;
CREATE OR REPLACE FUNCTION private.get_user_cleaner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT cleaner_id FROM public.user_profiles WHERE id = auth.uid(); $$;
REVOKE EXECUTE ON FUNCTION private.get_user_role(), private.get_user_cleaner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_role(), private.get_user_cleaner_id() TO anon, authenticated;

DROP POLICY admin_read_audit ON public.audit_log;
CREATE POLICY admin_read_audit ON public.audit_log FOR SELECT USING (private.get_user_role() = 'admin');
DROP POLICY admin_all_cleaners ON public.cleaners;
CREATE POLICY admin_all_cleaners ON public.cleaners FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY cleaners_read_own ON public.cleaners;
CREATE POLICY cleaners_read_own ON public.cleaners FOR SELECT USING (private.get_user_role() = 'cleaner' AND id = private.get_user_cleaner_id());
DROP POLICY admin_all_client_addresses ON public.client_addresses;
CREATE POLICY admin_all_client_addresses ON public.client_addresses FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY cleaners_read_assigned_client_addresses ON public.client_addresses;
CREATE POLICY cleaners_read_assigned_client_addresses ON public.client_addresses FOR SELECT USING (private.get_user_role() = 'cleaner' AND EXISTS (SELECT 1 FROM services s WHERE s.client_id = client_addresses.client_id AND s.cleaner_id = private.get_user_cleaner_id()));
DROP POLICY admin_all_clients ON public.clients;
CREATE POLICY admin_all_clients ON public.clients FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY cleaners_read_assigned_clients ON public.clients;
CREATE POLICY cleaners_read_assigned_clients ON public.clients FOR SELECT USING (private.get_user_role() = 'cleaner' AND EXISTS (SELECT 1 FROM services s WHERE s.client_id = clients.id AND s.cleaner_id = private.get_user_cleaner_id()));
DROP POLICY admin_all_credit_notes ON public.credit_notes;
CREATE POLICY admin_all_credit_notes ON public.credit_notes FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY admin_all_invoices ON public.invoices;
CREATE POLICY admin_all_invoices ON public.invoices FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY admin_all_novedades ON public.novedades;
CREATE POLICY admin_all_novedades ON public.novedades FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY cleaner_read_own_novedades ON public.novedades;
CREATE POLICY cleaner_read_own_novedades ON public.novedades FOR SELECT USING (private.get_user_role() = 'cleaner' AND cleaner_id = private.get_user_cleaner_id());
DROP POLICY admin_all_service_catalog ON public.service_catalog;
CREATE POLICY admin_all_service_catalog ON public.service_catalog FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY admin_all_services ON public.services;
CREATE POLICY admin_all_services ON public.services FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY cleaner_read_own_services ON public.services;
CREATE POLICY cleaner_read_own_services ON public.services FOR SELECT USING (private.get_user_role() = 'cleaner' AND cleaner_id = private.get_user_cleaner_id());
DROP POLICY admin_all_profiles ON public.user_profiles;
CREATE POLICY admin_all_profiles ON public.user_profiles FOR ALL USING (private.get_user_role() = 'admin');
DROP POLICY admin_all_cleaner_photos ON storage.objects;
CREATE POLICY admin_all_cleaner_photos ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'cleaner-photos' AND private.get_user_role() = 'admin') WITH CHECK (bucket_id = 'cleaner-photos' AND private.get_user_role() = 'admin');
DROP POLICY admin_all_client_photos ON storage.objects;
CREATE POLICY admin_all_client_photos ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'client-photos' AND private.get_user_role() = 'admin') WITH CHECK (bucket_id = 'client-photos' AND private.get_user_role() = 'admin');

DROP FUNCTION public.get_user_role();
DROP FUNCTION public.get_user_cleaner_id();
