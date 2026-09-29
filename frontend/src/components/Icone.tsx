import type { SVGProps } from 'react'

// Ícones de traço, desenhados à mão no mesmo grid 24x24. Decorativos por padrão.
const CAMINHOS = {
  mapa: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  diretorio: (
    <>
      <path d="M4 9h16l-1.5-5h-13L4 9Z" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  carroca: (
    <>
      <path d="M2 7h13v6H2z" />
      <circle cx="8.5" cy="17" r="3" />
      <path d="M8.5 14v6M5.5 17h6M15 10h7" />
    </>
  ),
  passaporte: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 16h6" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  voltar: <path d="M15 18 9 12l6-6" />,
  pino: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  telefone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  conversa: <path d="M4 20l1.3-3.9A8 8 0 1 1 8.2 19Z" />,
  selo: (
    <>
      <path d="m12 3 2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  foto: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 17-5-5-9 7" />
    </>
  ),
  bussola: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
} as const

// Ícones que substituem caracteres no meio do texto: "→" (U+2192) e "✓" (U+2713) não existem na
// IBM Plex e cairiam para a fonte do sistema, que varia no Android e desalinha. Grid 20x20,
// traço 1.5 e 1em de lado, para acompanhar o tamanho do texto em volta.
const EM_LINHA = {
  seta: <path d="M3 10h13m-4.5-4.5L16 10l-4.5 4.5" />,
  conferido: <path d="M4 10.5l4 4 8-8" />,
} as const

export type NomeIcone = keyof typeof CAMINHOS | keyof typeof EM_LINHA

export interface IconeProps extends SVGProps<SVGSVGElement> {
  nome: NomeIcone
  /** Em px (padrão 24) ou unidade CSS; os ícones em linha usam 1em por padrão. */
  tamanho?: number | string
}

/**
 * Decorativo (aria-hidden). Se o ícone carrega sentido — a seta entre origem e destino —,
 * ponha o texto para o leitor de tela ao lado: <span className="so-leitor">para</span>.
 */
export function Icone({ nome, tamanho, className, ...resto }: IconeProps) {
  const emLinha = nome in EM_LINHA
  const lado = tamanho ?? (emLinha ? '1em' : 24)
  return (
    <svg
      width={lado}
      height={lado}
      viewBox={emLinha ? '0 0 20 20' : '0 0 24 24'}
      fill="none"
      stroke="currentColor"
      strokeWidth={emLinha ? 1.5 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={[emLinha ? 'icone-em-linha' : null, className].filter(Boolean).join(' ') || undefined}
      {...resto}
    >
      {emLinha ? EM_LINHA[nome as keyof typeof EM_LINHA] : CAMINHOS[nome as keyof typeof CAMINHOS]}
    </svg>
  )
}
