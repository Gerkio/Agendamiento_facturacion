-- ============================================================
-- Migración 016 — Catálogo de servicios (tipos predefinidos)
-- ============================================================
-- Permite al administrador definir los servicios que presta (nombre, grupo
-- hogar/empresa, jornada, hora de inicio + duración, precio, bono) para no
-- reingresar esos datos en cada agendamiento. El modal de "Agendar servicio"
-- toma de aquí los valores por defecto.

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'hogar' CHECK (segment IN ('hogar', 'empresa')),
  tipo TEXT NOT NULL DEFAULT 'dia_completo'
    CHECK (tipo IN ('dia_completo', 'medio_dia_manana', 'medio_dia_tarde')),
  start_time TIME NOT NULL DEFAULT '08:00',
  duration_minutes INT NOT NULL DEFAULT 450 CHECK (duration_minutes > 0),
  price_cop NUMERIC NOT NULL DEFAULT 0 CHECK (price_cop >= 0),
  bono_cop NUMERIC NOT NULL DEFAULT 0 CHECK (bono_cop >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_active ON service_catalog(is_active);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_service_catalog" ON service_catalog;
CREATE POLICY "admin_all_service_catalog" ON service_catalog FOR ALL USING (get_user_role() = 'admin');

-- Referencia opcional desde el servicio agendado al ítem del catálogo usado.
ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_id UUID
  REFERENCES service_catalog(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_services_catalog ON services(catalog_id);

-- Semilla de ejemplo (solo si la tabla está vacía) basada en tarifas de hogar.
INSERT INTO service_catalog (name, segment, tipo, start_time, duration_minutes, price_cop)
SELECT v.name, v.segment, v.tipo, v.start_time::time, v.duration_minutes, v.price_cop
FROM (VALUES
  ('Esporádico (8 horas)',                  'hogar', 'dia_completo',     '08:00', 460, 176000),
  ('Esporádico 4 horas',                    'hogar', 'medio_dia_manana', '08:00', 240, 119000),
  ('Fijo - toda la semana',                 'hogar', 'dia_completo',     '08:00', 460, 139120),
  ('Más de 1 vez a la semana (8 horas)',    'hogar', 'dia_completo',     '08:00', 460, 168000),
  ('Más de 2 veces a la semana (8 horas)',  'hogar', 'dia_completo',     '08:00', 460, 160000),
  ('Mañana medio tiempo dominical',         'hogar', 'medio_dia_manana', '08:00', 240, 122000),
  ('Mensualidad internas',                  'hogar', 'dia_completo',     '08:00', 600, 141120),
  ('Promoción mañana medio tiempo',         'hogar', 'medio_dia_manana', '08:00', 240, 108000),
  ('Promoción tarde medio tiempo',          'hogar', 'medio_dia_tarde',  '14:00', 240, 108000),
  ('Tarde medio tiempo dominical',          'hogar', 'medio_dia_tarde',  '14:00', 240, 122000),
  ('Tarde medio tiempo tarifa esporádico',  'hogar', 'medio_dia_tarde',  '14:00', 240, 119000),
  ('Tarifa Muy Especial',                   'hogar', 'dia_completo',     '08:00', 360, 150000),
  ('Tarifa muy especial (jornada completa)','hogar', 'dia_completo',     '08:00', 240, 145000)
) AS v(name, segment, tipo, start_time, duration_minutes, price_cop)
WHERE NOT EXISTS (SELECT 1 FROM service_catalog);
