#!/usr/bin/env node
/**
 * Convierte el certificado .pfx / .p12 que entrega la DIAN en los dos valores
 * base64 (clave privada PEM + certificado PEM) que la app consume en runtime.
 *
 * Uso:
 *   node scripts/pfx-to-env.mjs <ruta/al/certificado.pfx> <password>
 *
 * Imprime las dos líneas listas para pegar en .env.local:
 *   DIAN_PRIVATE_KEY_BASE64=...
 *   DIAN_CERTIFICATE_BASE64=...
 *
 * Requiere `openssl` en el PATH (incluido en Git for Windows, macOS y Linux).
 * Node no puede extraer la clave de un PKCS#12 de forma nativa, por eso se
 * usa openssl para esta conversión que se hace UNA sola vez.
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const [, , pfxPath, password] = process.argv

if (!pfxPath || password === undefined) {
  console.error('Uso: node scripts/pfx-to-env.mjs <cert.pfx> <password>')
  process.exit(1)
}
if (!existsSync(pfxPath)) {
  console.error(`No se encontró el archivo: ${pfxPath}`)
  process.exit(1)
}

/** Ejecuta openssl pkcs12; reintenta con -legacy si el .pfx usa cifrado antiguo (RC2/3DES). */
function runOpenssl(args) {
  try {
    return execFileSync('openssl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (firstErr) {
    try {
      return execFileSync('openssl', [...args, '-legacy'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr)
      throw new Error(
        msg.includes('ENOENT')
          ? 'openssl no está disponible en el PATH. Instálalo (Git for Windows lo incluye) y vuelve a intentar.'
          : `openssl falló. ¿Password correcto? Detalle: ${msg}`
      )
    }
  }
}

/** Extrae el bloque PEM (BEGIN..END) del tipo indicado, descartando bag attributes. */
function extractPem(output, type) {
  const re = new RegExp(`-----BEGIN ${type}-----[\\s\\S]*?-----END ${type}-----`)
  const m = output.match(re)
  if (!m) throw new Error(`No se pudo extraer el bloque PEM de tipo "${type}".`)
  return m[0] + '\n'
}

try {
  const keyOut = runOpenssl(['pkcs12', '-in', pfxPath, '-nocerts', '-nodes', '-passin', `pass:${password}`])
  const certOut = runOpenssl(['pkcs12', '-in', pfxPath, '-clcerts', '-nokeys', '-passin', `pass:${password}`])

  // La clave puede salir como "PRIVATE KEY" (PKCS#8) o "RSA PRIVATE KEY" (PKCS#1).
  const keyPem = keyOut.includes('BEGIN PRIVATE KEY')
    ? extractPem(keyOut, 'PRIVATE KEY')
    : extractPem(keyOut, 'RSA PRIVATE KEY')
  const certPem = extractPem(certOut, 'CERTIFICATE')

  const keyB64 = Buffer.from(keyPem, 'utf8').toString('base64')
  const certB64 = Buffer.from(certPem, 'utf8').toString('base64')

  console.log('\n# Pega estas líneas en .env.local:\n')
  console.log(`DIAN_PRIVATE_KEY_BASE64=${keyB64}`)
  console.log(`DIAN_CERTIFICATE_BASE64=${certB64}`)
  console.log('')
} catch (e) {
  console.error('\n❌ ' + (e instanceof Error ? e.message : String(e)) + '\n')
  process.exit(1)
}
