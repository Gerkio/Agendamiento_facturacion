/** Utilidades CSV para exportar tablas (historial de servicios, libro de
 *  facturas…). Genera CSV con BOM UTF-8 para que Excel respete los acentos y
 *  dispara la descarga en el navegador. Sin dependencias externas. */

type Cell = string | number | null | undefined

/** Escapa una celda: la envuelve en comillas si contiene el separador, comillas
 *  o saltos de línea, y duplica las comillas internas (formato RFC 4180). */
function escapeCell(value: Cell): string {
  const s = value == null ? '' : String(value)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serializa encabezados + filas a un string CSV. Usa ';' como separador, que es
 *  el que Excel en configuración regional es-CO espera por defecto. */
export function buildCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map(r => r.map(escapeCell).join(';')).join('\r\n')
}

/** Dispara la descarga de un CSV en el navegador (con BOM UTF-8 para Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = String.fromCharCode(0xfeff)
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
