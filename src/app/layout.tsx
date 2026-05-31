import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CleanSched | Agendamiento y Facturación',
  description: 'Sistema de agendamiento y facturación electrónica DIAN para empresa de aseo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
