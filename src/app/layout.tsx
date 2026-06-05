import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AMARU | Agendamiento y Facturación',
  description: 'Sistema de agendamiento y facturación electrónica DIAN para empresa de aseo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-canvas text-gray-900 antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
