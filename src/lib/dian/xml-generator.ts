import { createHash } from 'crypto'
import type { Client, Service } from '@/types/database'

// Redondeo a 2 decimales (misma fórmula que lib/dian/tax.ts; se define local para
// que el generador no tenga imports relativos en runtime — lo usa el validador offline).
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * SoftwareSecurityCode per DIAN Anexo Técnico:
 * SHA-384( SoftwareID + PIN + NumeroDocumento ).
 * Verify the exact concatenation against the current Anexo before go-live.
 */
export function computeSoftwareSecurityCode(invoiceNumber: string): string {
  const softwareId = process.env.DIAN_SOFTWARE_ID ?? ''
  const pin = process.env.DIAN_SOFTWARE_PIN ?? ''
  return createHash('sha384').update(`${softwareId}${pin}${invoiceNumber}`, 'utf8').digest('hex')
}

export interface InvoiceData {
  invoiceNumber: string
  issueDate: Date
  client: Client
  services: Service[]
  totalAmount: number
  taxAmount: number   // IVA total del documento (suma de las líneas)
  taxableBase: number
  taxRate: number     // % de IVA aplicado (0 = exento)
  cufe: string        // Calculado antes de llamar esta función
  environment: '1' | '2'  // 1=Producción, 2=Pruebas
}

function pad2(n: number) { return String(n).padStart(2, '0') }

// IssueDate/IssueTime en hora legal de Colombia (UTC-5). Debe coincidir EXACTAMENTE
// con FecFac/HorFac usados por el CUFE, o la DIAN rechaza por CUFE inconsistente.
function formatISODate(d: Date) {
  const co = new Date(d.getTime() - 5 * 3600_000)
  return `${co.getUTCFullYear()}-${pad2(co.getUTCMonth() + 1)}-${pad2(co.getUTCDate())}`
}

function formatISOTime(d: Date) {
  const co = new Date(d.getTime() - 5 * 3600_000)
  return `${pad2(co.getUTCHours())}:${pad2(co.getUTCMinutes())}:${pad2(co.getUTCSeconds())}-05:00`
}

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function formatAmount(n: number): string {
  return n.toFixed(2)
}

export function generateInvoiceXML(data: InvoiceData): string {
  const {
    invoiceNumber, issueDate, client, services, totalAmount,
    taxAmount, taxableBase, taxRate, cufe, environment,
  } = data

  const issueD = formatISODate(issueDate)
  const issueT = formatISOTime(issueDate)
  const dueDate = new Date(issueDate)
  dueDate.setDate(dueDate.getDate() + 30)
  const dueDateStr = formatISODate(dueDate)

  const companyNit = process.env.COMPANY_NIT!
  const companyDV = process.env.COMPANY_DV!
  const companyName = xmlEscape(process.env.COMPANY_NAME!)
  const companyAddress = xmlEscape(process.env.COMPANY_ADDRESS!)
  const companyCityCode = process.env.COMPANY_CITY_CODE!
  const companyEmail = process.env.COMPANY_EMAIL!
  const companyPhone = process.env.COMPANY_PHONE!
  const invoicePrefix = process.env.INVOICE_PREFIX!
  const resolutionNumber = process.env.INVOICE_RESOLUTION_NUMBER!
  const resolutionDate = process.env.INVOICE_RESOLUTION_DATE!
  const fromNumber = process.env.INVOICE_FROM_NUMBER!
  const toNumber = process.env.INVOICE_TO_NUMBER!

  const taxSchemeCode = client.tax_scheme === '01' ? '01' : 'ZY'
  const taxSchemeName = client.tax_scheme === '01' ? 'IVA' : 'No aplica'

  const softwareSecurityCode = computeSoftwareSecurityCode(invoiceNumber)
  // QR de la DIAN v2: URL al catálogo público con el CUFE como documentkey.
  const qrBase = environment === '1'
    ? 'https://catalogo-vpfe.dian.gov.co'
    : 'https://catalogo-vpfe-hab.dian.gov.co'
  const qrContent = `${qrBase}/document/searchqr?documentkey=${cufe}`

  const invoiceLines = services.map((s, idx) => {
    const unitPrice = Number(s.price_cop)
    const lineTotal = unitPrice
    const lineTax = round2((unitPrice * taxRate) / 100)
    const startDate = new Date(s.start_time).toLocaleDateString('es-CO')
    const description = xmlEscape(`Servicio de aseo - ${startDate}`)
    return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="94">1</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${formatAmount(lineTotal)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${formatAmount(lineTax)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="COP">${formatAmount(lineTotal)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="COP">${formatAmount(lineTax)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:Percent>${taxRate.toFixed(2)}</cbc:Percent>
            <cac:TaxScheme>
              <cbc:ID>01</cbc:ID>
              <cbc:Name>IVA</cbc:Name>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${description}</cbc:Description>
        <cac:StandardItemIdentification>
          <cbc:ID schemeAgencyID="10" schemeID="001">SVC-${String(idx + 1).padStart(4, '0')}</cbc:ID>
        </cac:StandardItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="COP">${formatAmount(unitPrice)}</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity>
      </cac:Price>
    </cac:InvoiceLine>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
  xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
  xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
  xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <sts:DianExtensions>
          <sts:InvoiceControl>
            <sts:InvoiceAuthorization>${resolutionNumber}</sts:InvoiceAuthorization>
            <sts:AuthorizationPeriod>
              <cbc:StartDate>${resolutionDate}</cbc:StartDate>
              <cbc:EndDate>2030-12-31</cbc:EndDate>
            </sts:AuthorizationPeriod>
            <sts:AuthorizedInvoices>
              <sts:Prefix>${invoicePrefix}</sts:Prefix>
              <sts:From>${fromNumber}</sts:From>
              <sts:To>${toNumber}</sts:To>
            </sts:AuthorizedInvoices>
          </sts:InvoiceControl>
          <sts:InvoiceSource>
            <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
          </sts:InvoiceSource>
          <sts:SoftwareProvider>
            <sts:ProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${companyDV}" schemeName="31">${companyNit}</sts:ProviderID>
            <sts:SoftwareID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${process.env.DIAN_SOFTWARE_ID ?? 'SOFTWARE-ID'}</sts:SoftwareID>
          </sts:SoftwareProvider>
          <sts:SoftwareSecurityCode schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${softwareSecurityCode}</sts:SoftwareSecurityCode>
          <sts:AuthorizationProvider>
            <sts:AuthorizationProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="UN/CEFACT">800197268</sts:AuthorizationProviderID>
          </sts:AuthorizationProvider>
          <sts:QRCode>${xmlEscape(qrContent)}</sts:QRCode>
        </sts:DianExtensions>
      </ext:ExtensionContent>
    </ext:UBLExtension>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>10</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ProfileExecutionID>${environment}</cbc:ProfileExecutionID>
  <cbc:ID>${invoiceNumber}</cbc:ID>
  <cbc:UUID schemeID="${environment}" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
  <cbc:IssueDate>${issueD}</cbc:IssueDate>
  <cbc:IssueTime>${issueT}</cbc:IssueTime>
  <cbc:DueDate>${dueDateStr}</cbc:DueDate>
  <cbc:InvoiceTypeCode listAgencyID="195" listAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" listID="${environment}" listName="Tipo de Documento" listSchemeURI="http://www.dian.gov.co/contratos/facturaelectronica/v1/InvoiceType">01</cbc:InvoiceTypeCode>
  <cbc:Note>${xmlEscape(`Factura de servicios de aseo - ${invoiceNumber}`)}</cbc:Note>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${services.length}</cbc:LineCountNumeric>
  <cac:OrderReference>
    <cbc:ID>1</cbc:ID>
  </cac:OrderReference>
  <cac:AccountingSupplierParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${companyName}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:ID>${companyCityCode}</cbc:ID>
          <cbc:CityName>Bogotá D.C.</cbc:CityName>
          <cbc:PostalZone>110111</cbc:PostalZone>
          <cbc:CountrySubentity>Bogotá D.C.</cbc:CountrySubentity>
          <cbc:CountrySubentityCode>11</cbc:CountrySubentityCode>
          <cac:AddressLine>
            <cbc:Line>${companyAddress}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${companyName}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${companyDV}" schemeName="31">${companyNit}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="${process.env.COMPANY_FISCAL_REGIMEN ?? 'O-13'}">${process.env.COMPANY_TAX_SCHEME ?? '01'}</cbc:TaxLevelCode>
        <cac:RegistrationAddress>
          <cbc:ID>${companyCityCode}</cbc:ID>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${companyName}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${companyDV}" schemeName="31">${companyNit}</cbc:CompanyID>
        <cac:CorporateRegistrationScheme>
          <cbc:ID>${invoicePrefix}</cbc:ID>
        </cac:CorporateRegistrationScheme>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Telephone>${companyPhone}</cbc:Telephone>
        <cbc:ElectronicMail>${companyEmail}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${xmlEscape(client.company_name)}</cbc:Name>
      </cac:PartyName>
      <cac:PhysicalLocation>
        <cac:Address>
          <cbc:ID>${xmlEscape(client.city_code)}</cbc:ID>
          <cac:AddressLine>
            <cbc:Line>${xmlEscape(client.address)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
            <cbc:Name languageID="es">Colombia</cbc:Name>
          </cac:Country>
        </cac:Address>
      </cac:PhysicalLocation>
      <cac:PartyTaxScheme>
        <cbc:RegistrationName>${xmlEscape(client.company_name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${xmlEscape(client.dv)}" schemeName="31">${xmlEscape(client.nit_cedula)}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="${xmlEscape(client.fiscal_regimen)}">${xmlEscape(client.tax_scheme)}</cbc:TaxLevelCode>
        <cac:RegistrationAddress>
          <cbc:ID>${xmlEscape(client.city_code)}</cbc:ID>
          <cac:Country>
            <cbc:IdentificationCode>CO</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
        <cac:TaxScheme>
          <cbc:ID>${taxSchemeCode}</cbc:ID>
          <cbc:Name>${taxSchemeName}</cbc:Name>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(client.company_name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${xmlEscape(client.dv)}" schemeName="31">${xmlEscape(client.nit_cedula)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${xmlEscape(client.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:ID>1</cbc:ID>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${dueDateStr}</cbc:PaymentDueDate>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="COP">${formatAmount(taxAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="COP">${formatAmount(taxableBase)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="COP">${formatAmount(taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${taxRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>01</cbc:ID>
          <cbc:Name>IVA</cbc:Name>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="COP">${formatAmount(taxableBase)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="COP">${formatAmount(taxableBase)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="COP">${formatAmount(totalAmount)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="COP">0.00</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="COP">0.00</cbc:ChargeTotalAmount>
    <cbc:PayableAmount currencyID="COP">${formatAmount(totalAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${invoiceLines}
</Invoice>`
}
