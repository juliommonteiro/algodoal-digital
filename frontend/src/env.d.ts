interface ImportMetaEnv {
  /** Origem da API. Vazio em dev: o Vite faz proxy de /api para localhost:8000. */
  readonly VITE_API_URL?: string
  /** 'false' usa a API real; qualquer outro valor (ou ausente) usa o mock. */
  readonly VITE_USAR_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
