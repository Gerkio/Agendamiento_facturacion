import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import ClientDetail from '@/components/clients/ClientDetail'
import ClientServicesTab from '@/components/clients/ClientServicesTab'
import ClientPaymentsTab from '@/components/clients/ClientPaymentsTab'
import ClientAccountTab from '@/components/clients/ClientAccountTab'
import { isUuid } from '@/lib/validate'
import type { ClientAddress, Service, Invoice } from '@/types/database'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await requireAdmin()

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const [{ data: addresses }, { data: services }, { data: invoices }, { data: unbilled }, { data: invAgg }] = await Promise.all([
    supabase.from('client_addresses').select('*').eq('client_id', id).order('is_primary', { ascending: false }).order('created_at'),
    supabase.from('services').select('*, cleaners(full_name)').eq('client_id', id).order('start_time', { ascending: false }).limit(50),
    supabase.from('invoices').select('id, invoice_number, issue_date, total_amount, billing_status, client_id, created_at').eq('client_id', id).order('issue_date', { ascending: false }).limit(50),
    // P5 · Estado de cuenta: servicios completados sin factura + agregado de facturas.
    supabase.from('services').select('price_cop').eq('client_id', id).eq('status', 'completed').is('invoice_id', null),
    supabase.from('invoices').select('total_amount, billing_status').eq('client_id', id),
  ])

  let photoUrl: string | null = null
  if (client.photo_url) {
    const { data } = await supabase.storage.from('client-photos').createSignedUrl(client.photo_url, 3600)
    photoUrl = data?.signedUrl ?? null
  }

  const serviceList = (services ?? []) as Service[]
  const invoiceList = (invoices ?? []) as Invoice[]

  // Agregados del estado de cuenta (P5).
  const unbilledRows = (unbilled ?? []) as { price_cop: number }[]
  const invRows = (invAgg ?? []) as { total_amount: number; billing_status: string }[]
  const porFacturarValor = unbilledRows.reduce((s, r) => s + Number(r.price_cop), 0)
  const validadas = invRows.filter(i => i.billing_status === 'sent_dian')
  const facturadoValidado = validadas.reduce((s, i) => s + Number(i.total_amount), 0)
  const enProcesoCount = invRows.filter(i => ['draft', 'processing', 'signed'].includes(i.billing_status)).length
  const rechazadasCount = invRows.filter(i => i.billing_status === 'rejected').length

  return (
    <ClientDetail
      client={client}
      addresses={(addresses ?? []) as ClientAddress[]}
      servicesCount={serviceList.length}
      invoicesCount={invoiceList.length}
      cuentaTab={
        <ClientAccountTab
          porFacturarValor={porFacturarValor}
          porFacturarCount={unbilledRows.length}
          facturadoValidado={facturadoValidado}
          validadasCount={validadas.length}
          enProcesoCount={enProcesoCount}
          rechazadasCount={rechazadasCount}
          totalFacturas={invRows.length}
        />
      }
      serviciosTab={<ClientServicesTab services={serviceList} />}
      pagosTab={<ClientPaymentsTab invoices={invoiceList} />}
      photoUrl={photoUrl}
    />
  )
}
