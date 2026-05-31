// Next 16 entrega flat config directamente; se importa y se extiende.
import next from 'eslint-config-next'

const eslintConfig = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'dian/**', 'scripts/**', 'supabase/**'],
  },
  {
    rules: {
      // Patrones legítimos de sincronización con sistemas externos (fetch async,
      // carga inicial desde localStorage, generación de QR). Se deja como aviso.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]

export default eslintConfig
