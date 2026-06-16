import { defineConfig } from 'vitest/config'

// Solo se prueban módulos PUROS (sin Next/DOM): cálculo de nómina, días hábiles,
// CUFE/CUDE, IVA. Entorno node; archivos *.test.ts dentro de src.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
