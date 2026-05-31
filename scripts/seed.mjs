// Siembra datos de prueba en Supabase usando el service role (solo local).
// Uso:  node --env-file=.env.local scripts/seed.mjs
// Idempotente: clientes/limpiadores se upsertean; los servicios de prueba se
// borran y recrean para dejar un estado limpio y SIN facturar.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Corre: node --env-file=.env.local scripts/seed.mjs')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const hoursFromNow = (h) => new Date(Date.now() + h * 3600_000).toISOString()

const cleaners = [
  { id: '11111111-1111-1111-1111-111111111111', full_name: 'María García',  document_id: '1234567', phone: '3001234567', is_active: true },
  { id: '22222222-2222-2222-2222-222222222222', full_name: 'Juan López',    document_id: '2345678', phone: '3109876543', is_active: true },
  { id: '33333333-3333-3333-3333-333333333333', full_name: 'Ana Rodríguez', document_id: '3456789', phone: '3201112223', is_active: true },
]

const clients = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'Edificio Torres S.A.',    nit_cedula: '900123456', dv: '8', email: 'admin@torres.com',   phone: '6011112233', address: 'Cra 7 # 71-21',  city_code: '11001', tax_scheme: '01', fiscal_regimen: 'R-99-PN', indicaciones: 'Torre B, portería pide cédula. Timbre 1201. Parqueadero de visitantes al fondo.' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', company_name: 'Centro Comercial Andino', nit_cedula: '800234567', dv: '0', email: 'compras@andino.com', phone: '6012223344', address: 'Cra 11 # 82-71', city_code: '11001', tax_scheme: '01', fiscal_regimen: 'O-13',    indicaciones: 'Entrada de servicio por la Calle 82. Preguntar por administración.' },
  { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', company_name: 'Clínica Bautista',        nit_cedula: '800111222', dv: '7', email: 'mant@clinica.com',   phone: '6024445566', address: 'Av 6 # 23-50',   city_code: '76001', tax_scheme: 'ZV', fiscal_regimen: 'R-99-PN', indicaciones: null },
]

// 2 completados + 1 agendado de «Edificio Torres» (sin facturar) + 2 de otros clientes.
const serviceIds = [
  'd0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000004',
  'd0000001-0000-0000-0000-000000000005',
]
const services = [
  { id: serviceIds[0], client_id: clients[0].id, cleaner_id: cleaners[0].id, start_time: hoursFromNow(-240), end_time: hoursFromNow(-238), status: 'completed', is_recurring: false, recurrence_group_id: null, invoice_id: null, price_cop: 600000 },
  { id: serviceIds[1], client_id: clients[0].id, cleaner_id: cleaners[1].id, start_time: hoursFromNow(-72),  end_time: hoursFromNow(-70),  status: 'completed', is_recurring: false, recurrence_group_id: null, invoice_id: null, price_cop: 350000 },
  { id: serviceIds[2], client_id: clients[0].id, cleaner_id: cleaners[0].id, start_time: hoursFromNow(24),   end_time: hoursFromNow(26),   status: 'scheduled', is_recurring: false, recurrence_group_id: null, invoice_id: null, price_cop: 800000 },
  { id: serviceIds[3], client_id: clients[1].id, cleaner_id: cleaners[2].id, start_time: hoursFromNow(-120), end_time: hoursFromNow(-118), status: 'completed', is_recurring: false, recurrence_group_id: null, invoice_id: null, price_cop: 500000 },
  { id: serviceIds[4], client_id: clients[2].id, cleaner_id: cleaners[2].id, start_time: hoursFromNow(48),   end_time: hoursFromNow(50),   status: 'scheduled', is_recurring: false, recurrence_group_id: null, invoice_id: null, price_cop: 450000 },
]

async function main() {
  console.log('→ Sembrando limpiadores…')
  let r = await db.from('cleaners').upsert(cleaners, { onConflict: 'id' })
  if (r.error) throw r.error

  console.log('→ Sembrando clientes…')
  r = await db.from('clients').upsert(clients, { onConflict: 'id' })
  if (r.error) throw r.error

  console.log('→ Limpiando servicios de prueba anteriores…')
  r = await db.from('services').delete().in('id', serviceIds)
  if (r.error) throw r.error

  console.log('→ Sembrando servicios de prueba…')
  r = await db.from('services').insert(services)
  if (r.error) throw r.error

  console.log('\n✅ Listo. Escenario para el facturador (cliente «Edificio Torres S.A.»):')
  console.log('   • «Solo completados»  → 2 servicios = $950.000')
  console.log('   • «Todos sin facturar» → 3 servicios = $1.750.000')
  console.log('\nEntra a Facturación, elige «Edificio Torres S.A.» y pulsa Buscar Servicios.')
}

main().catch((e) => {
  console.error('\n❌ Error sembrando:', e.message ?? e)
  console.error('Verifica que el esquema (schema.sql + migraciones) ya esté aplicado en Supabase.')
  process.exit(1)
})
