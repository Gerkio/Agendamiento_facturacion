import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// Content-Security-Policy. En producción es estricta; en desarrollo se relaja
// para que el HMR de Turbopack (eval + websockets) funcione.
// Nota: 'unsafe-inline' en script/style es necesario porque Next (App Router)
// inyecta scripts inline de hidratación y usamos estilos inline (colores por
// cliente). Para máxima protección anti-XSS, migrar a CSP con nonce más adelante.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Supabase (Auth/DB/Realtime) + llamadas propias. En dev, websockets de HMR.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isProd ? '' : ' ws: http://localhost:*'}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Fuerza HTTPS durante 2 años en todos los subdominios.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Anti-clickjacking (además de frame-ancestors).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Evita que el navegador "adivine" tipos MIME (anti drive-by).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No filtrar la URL completa como referer a terceros.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Desactiva APIs sensibles que la app no usa.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  // No revelar el framework/versión en la cabecera (reduce huella para atacantes).
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Incluir esquemas XSD + Schematron compilado (SEF) en el bundle del servidor.
  outputFileTracingIncludes: {
    '/api/dian/**': ['./dian/xsd/**/*.xsd', './dian/schematron/*.sef.json'],
  },
  // xmllint-wasm (WASM) y saxon-js se mantienen externos para evitar problemas de empaquetado.
  serverExternalPackages: ['xmllint-wasm', 'saxon-js'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
