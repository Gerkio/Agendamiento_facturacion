-- ============================================================
-- Datos de demostración para probar el dashboard y el facturador.
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql.
-- Idempotente: se puede correr varias veces sin duplicar ni descuadrar.
-- Los DV de los NIT son los REALES (algoritmo mod-11 DIAN).
-- ============================================================

-- Limpiadores
INSERT INTO cleaners (id, full_name, document_id, phone, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'María García',  '1234567', '3001234567', true),
  ('22222222-2222-2222-2222-222222222222', 'Juan López',    '2345678', '3109876543', true),
  ('33333333-3333-3333-3333-333333333333', 'Ana Rodríguez', '3456789', '3201112223', true)
ON CONFLICT (id) DO NOTHING;

-- Clientes (DV reales: 900123456-8, 800234567-0, 800111222-7).
-- DO UPDATE para corregir datos si ya existían con valores viejos.
INSERT INTO clients (id, company_name, nit_cedula, dv, email, phone, address, city_code, tax_scheme, fiscal_regimen, indicaciones) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Edificio Torres S.A.',    '900123456', '8', 'admin@torres.com',   '6011112233', 'Cra 7 # 71-21',  '11001', '01', 'R-99-PN', 'Torre B, portería pide cédula. Timbre 1201. Parqueadero de visitantes al fondo.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Centro Comercial Andino', '800234567', '0', 'compras@andino.com', '6012223344', 'Cra 11 # 82-71', '11001', '01', 'O-13',    'Entrada de servicio por la Calle 82. Preguntar por administración.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Clínica Bautista',        '800111222', '7', 'mant@clinica.com',   '6024445566', 'Av 6 # 23-50',   '76001', 'ZV', 'R-99-PN', NULL)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name, nit_cedula = EXCLUDED.nit_cedula, dv = EXCLUDED.dv,
  email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address,
  city_code = EXCLUDED.city_code, tax_scheme = EXCLUDED.tax_scheme,
  fiscal_regimen = EXCLUDED.fiscal_regimen, indicaciones = EXCLUDED.indicaciones;

-- Servicios de prueba con IDs fijos. Se borran y recrean para dejar un estado
-- limpio y SIN facturar cada vez que corras el seed (resetea invoice_id).
DELETE FROM services WHERE id IN (
  'd0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003',
  'd0000001-0000-0000-0000-000000000004',
  'd0000001-0000-0000-0000-000000000005'
);

-- Escenario para el facturador (cliente «Edificio Torres S.A.»):
--   2 completados (600.000 + 350.000) + 1 agendado (800.000), todos SIN facturar.
--   → «Solo completados» encuentra 2 (= $950.000)
--   → «Todos sin facturar» encuentra 3 (= $1.750.000)
INSERT INTO services (id, client_id, cleaner_id, start_time, end_time, status, is_recurring, recurrence_group_id, invoice_id, price_cop) VALUES
  ('d0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '2 hours', 'completed', false, NULL, NULL, 600000),
  ('d0000001-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days'  + INTERVAL '2 hours', 'completed', false, NULL, NULL, 350000),
  ('d0000001-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', NOW() + INTERVAL '1 day',   NOW() + INTERVAL '1 day'   + INTERVAL '2 hours', 'scheduled', false, NULL, NULL, 800000),
  -- Otro cliente, para verificar que el buscador filtra por cliente correctamente:
  ('d0000001-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days'  + INTERVAL '2 hours', 'completed', false, NULL, NULL, 500000),
  ('d0000001-0000-0000-0000-000000000005', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', NOW() + INTERVAL '2 days',  NOW() + INTERVAL '2 days'  + INTERVAL '2 hours', 'scheduled', false, NULL, NULL, 450000);

-- ============================================================
-- Recuerda: crea tu usuario en Authentication → Users y hazlo admin:
--   UPDATE user_profiles SET role = 'admin' WHERE email = 'gerkio.18@gmail.com';
-- ============================================================
