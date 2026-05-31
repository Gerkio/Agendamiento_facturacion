'use client'

import { useState } from 'react'

interface TestResult {
  step: string
  status: 'pending' | 'running' | 'success' | 'error'
  message: string
  detail?: string
}

const INITIAL_STEPS: TestResult[] = [
  { step: '1. Factura de prueba #1', status: 'pending', message: 'En espera' },
  { step: '2. Factura de prueba #2', status: 'pending', message: 'En espera' },
  { step: '3. Nota de crédito de prueba', status: 'pending', message: 'En espera' },
  { step: '4. Verificar habilitación en DIAN', status: 'pending', message: 'En espera' },
]

export default function DebugDianPanel() {
  const [steps, setSteps] = useState<TestResult[]>(INITIAL_STEPS)
  const [running, setRunning] = useState(false)
  const [xmlPreview, setXmlPreview] = useState<string | null>(null)
  const [cufeResult, setCufeResult] = useState<string | null>(null)
  const [testClientNit, setTestClientNit] = useState('800000000')

  function updateStep(idx: number, update: Partial<TestResult>) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...update } : s))
  }

  async function runTestSet() {
    setRunning(true)
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending', message: 'En espera' })))

    for (let i = 0; i < 4; i++) {
      updateStep(i, { status: 'running', message: 'Ejecutando...' })
      await new Promise(r => setTimeout(r, 800))

      try {
        const res = await fetch('/api/dian/test-set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: i + 1, testClientNit }),
        })
        const data = await res.json()

        if (data.success) {
          updateStep(i, {
            status: 'success',
            message: data.message ?? 'Exitoso',
            detail: data.cufe ?? data.detail,
          })
          if (i === 0 && data.xml) setXmlPreview(data.xml)
          if (i === 0 && data.cufe) setCufeResult(data.cufe)
        } else {
          updateStep(i, {
            status: 'error',
            message: data.error ?? 'Error desconocido',
            detail: data.detail,
          })
          break
        }
      } catch (e) {
        updateStep(i, { status: 'error', message: e instanceof Error ? e.message : 'Error de red' })
        break
      }
    }
    setRunning(false)
  }

  async function testCufe() {
    const res = await fetch('/api/dian/test-cufe', { method: 'POST' })
    const data = await res.json()
    setCufeResult(data.cufe ?? data.error)
  }

  async function previewXml() {
    const res = await fetch('/api/dian/preview-xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testClientNit }),
    })
    const data = await res.json()
    setXmlPreview(data.xml ?? data.error)
  }

  const statusIcon = (s: TestResult['status']) =>
    ({ pending: '⬜', running: '🔄', success: '✅', error: '❌' })[s]
  const statusColor = (s: TestResult['status']) =>
    ({ pending: 'text-gray-600', running: 'text-blue-600', success: 'text-green-700', error: 'text-red-600' })[s]

  return (
    <div className="space-y-6">
      {/* Env info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">⚠️ Ambiente activo: {process.env.NEXT_PUBLIC_DIAN_ENV === '1' ? '🟢 Producción' : '🟡 Pruebas (Sandbox)'}</p>
        <p>Modifica <code>DIAN_ENVIRONMENT</code> en <code>.env.local</code> para cambiar. Pruebas = 2, Producción = 1.</p>
      </div>

      {/* Test client NIT */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Configuración del Test</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">NIT del cliente de prueba</label>
            <input
              type="text"
              value={testClientNit}
              onChange={e => setTestClientNit(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="800000000"
            />
          </div>
          <button type="button" onClick={testCufe} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">
            🔢 Probar CUFE
          </button>
          <button type="button" onClick={previewXml} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition">
            📄 Preview XML
          </button>
        </div>
      </div>

      {/* CUFE result */}
      {cufeResult && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">CUFE calculado (SHA-384):</p>
          <code className="text-xs break-all text-green-700">{cufeResult}</code>
        </div>
      )}

      {/* XML Preview */}
      {xmlPreview && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">XML UBL 2.1 generado:</p>
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto max-h-64">{xmlPreview}</pre>
        </div>
      )}

      {/* Test Set Runner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">Conjunto de Pruebas DIAN</h2>
          <button
            onClick={runTestSet}
            disabled={running}
            className="bg-brand-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {running ? '⏳ Ejecutando...' : '▶ Ejecutar Test Set'}
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className={`border rounded-lg p-4 ${step.status === 'error' ? 'border-red-200 bg-red-50' : step.status === 'success' ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{statusIcon(step.status)}</span>
                <div>
                  <p className={`text-sm font-medium ${statusColor(step.status)}`}>{step.step}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.message}</p>
                  {step.detail && (
                    <p className="text-xs font-mono mt-1 text-gray-600 break-all">{step.detail}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-sm text-gray-600 space-y-2">
        <h3 className="font-semibold text-gray-700">📋 Pasos para habilitación en producción</h3>
        <ol className="list-decimal list-inside space-y-1 text-gray-600">
          <li>Configurar <code>DIAN_ENVIRONMENT=2</code> (Sandbox).</li>
          <li>Llenar las variables de certificado (<code>DIAN_CERTIFICATE_BASE64</code>, <code>DIAN_PRIVATE_KEY_BASE64</code>, <code>DIAN_CERTIFICATE_PASSWORD</code>).</li>
          <li>Configurar las variables de empresa (<code>COMPANY_NIT</code>, <code>COMPANY_NAME</code>, etc.).</li>
          <li>Configurar resolución de facturación (<code>INVOICE_PREFIX</code>, <code>INVOICE_RESOLUTION_NUMBER</code>, etc.).</li>
          <li>Ejecutar el Test Set desde este panel. Las 2 facturas y 1 nota de crédito deben aprobarse.</li>
          <li>La DIAN confirma por correo la habilitación. Cambiar a <code>DIAN_ENVIRONMENT=1</code> para producción.</li>
        </ol>
      </div>
    </div>
  )
}
