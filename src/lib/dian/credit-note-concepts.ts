/** Conceptos de corrección de la nota crédito (DiscrepancyResponse/ResponseCode),
 *  Anexo Técnico 1.9. Módulo puro (sin dependencias de servidor) para poder
 *  usarse también en componentes de cliente. */
export const CREDIT_NOTE_CONCEPTS: { code: string; label: string }[] = [
  { code: '1', label: 'Devolución parcial de los bienes y/o no aceptación parcial del servicio' },
  { code: '2', label: 'Anulación de factura electrónica' },
  { code: '3', label: 'Rebaja o descuento parcial o total' },
  { code: '4', label: 'Ajuste de precio' },
  { code: '5', label: 'Otros' },
]
