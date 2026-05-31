import { createHash } from 'crypto'
import type { Client, Service } from '@/types/database'

// Redondeo a 2 decimales (local, sin imports relativos en runtime — lo usa el validador offline).
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** SoftwareSecurityCode: SHA-384(SoftwareID + PIN + NumeroDocumento). */
function computeSoftwareSecurityCode(docNumber: string): string {
  const softwareId = process.env.DIAN_SOFTWARE_ID ?? ''
  const pin = process.env.DIAN_SOFTWARE_PIN ?? ''
  return createHash('sha384').update(`${softwareId}${pin}${docNumber}`, 'utf8').digest('hex')
}

function pad2(n: number) { return String(n).padStart(2, '0') }
function formatISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function formatISOTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}-05:00` }
function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function formatAmount(n: number): string { return n.toFixed(2) }

export interface CreditNoteData {
  noteNumber: string
  issueDate: Date
  client: Client
  services: Service[]
  totalAmount: number
  taxAmount: number
  taxableBase: number
  taxRate: number
  cude: string
  environment: '1' | '2'
  /** Factura que se corrige/anula. */
  original: { number: string; cufe: string; issueDate: string }
  /** Concepto de corrección. */
  concept: { code: string; description: string }
}

export function generateCreditNoteXML(data: CreditNoteData): string {
  const {
    noteNumber, issueDate, client, services, totalAmount,
    taxAmount, taxableBase, taxRate, cude, environment, original, concept,
  } = data

  const issueD = formatISODate(issueDate)
  const issueT = formatISOTime(issueDate)

  const companyNit = process.env.COMPANY_NIT!
  const companyDV = process.env.COMPANY_DV!
  const companyName = xmlEscape(process.env.COMPANY_NAME!)
  const companyAddress = xmlEscape(process.env.COMPANY_ADDRESS!)
  const companyCityCode = process.env.COMPANY_CITY_CODE!
  const companyEmail = process.env.COMPANY_EMAIL!
  const companyPhone = process.env.COMPANY_PHONE!

  const taxSchemeCode = client.tax_scheme === '01' ? '01' : 'ZY'
  const taxSchemeName = client.tax_scheme === '01' ? 'IVA' : 'No aplica'

  const softwareSecurityCode = computeSoftwareSecurityCode(noteNumber)
  const qrBase = environment === '1' ? 'https://catalogo-vpfe.dian.gov.co' : 'https://catalogo-vpfe-hab.dian.gov.co'
  const qrContent = `${qrBase}/document/searchqr?documentkey=${cude}`

  const creditNoteLines = services.map((s, idx) => {
    const unitPrice = Number(s.price_cop)
    const lineTax = round2((unitPrice * taxRate) / 100)
    const startDate = new Date(s.start_time).toLocaleDateString('es-CO')
    const description = xmlEscape(`Servicio de aseo - ${startDate}`)
    return `
    <cac:CreditNoteLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:CreditedQuantity unitCode="94">1</cbc:CreditedQuantity>
      <cbc:LineExtensionAmount currencyID="COP">${formatAmount(unitPrice)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${formatAmount(lineTax)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="COP">${formatAmount(unitPrice)}</cbc:TaxableAmount>
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
    </cac:CreditNoteLine>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
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
  <cbc:CustomizationID>20</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1: Nota Crédito de la Factura Electrónica de Venta</cbc:ProfileID>
  <cbc:ProfileExecutionID>${environment}</cbc:ProfileExecutionID>
  <cbc:ID>${noteNumber}</cbc:ID>
  <cbc:UUID schemeID="${environment}" schemeName="CUDE-SHA384">${cude}</cbc:UUID>
  <cbc:IssueDate>${issueD}</cbc:IssueDate>
  <cbc:IssueTime>${issueT}</cbc:IssueTime>
  <cbc:CreditNoteTypeCode listAgencyID="195" listAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" listID="${environment}" listName="Tipo de Documento" listSchemeURI="http://www.dian.gov.co/contratos/facturaelectronica/v1/InvoiceType">91</cbc:CreditNoteTypeCode>
  <cbc:Note>${xmlEscape(`Nota crédito ${noteNumber} de la factura ${original.number}`)}</cbc:Note>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${services.length}</cbc:LineCountNumeric>
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${xmlEscape(original.number)}</cbc:ReferenceID>
    <cbc:ResponseCode>${concept.code}</cbc:ResponseCode>
    <cbc:Description>${xmlEscape(concept.description)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${xmlEscape(original.number)}</cbc:ID>
      <cbc:UUID schemeName="CUFE-SHA384">${original.cufe}</cbc:UUID>
      <cbc:IssueDate>${original.issueDate}</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
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
          <cbc:ID>${client.city_code}</cbc:ID>
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
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="31">${client.nit_cedula}</cbc:CompanyID>
        <cbc:TaxLevelCode listName="${client.fiscal_regimen}">${client.tax_scheme}</cbc:TaxLevelCode>
        <cac:RegistrationAddress>
          <cbc:ID>${client.city_code}</cbc:ID>
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
        <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="31">${client.nit_cedula}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:ElectronicMail>${client.email}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
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
  ${creditNoteLines}
</CreditNote>`
}
