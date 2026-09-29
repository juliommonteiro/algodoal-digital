export type VarianteBotao = 'primario' | 'secundario' | 'grande'

/** Classes do botão, para aplicar o mesmo visual num <a> ou <Link> (ex.: WhatsApp). */
export function classesBotao(variante: VarianteBotao = 'primario', extra?: string): string {
  return ['botao', `botao--${variante}`, extra].filter(Boolean).join(' ')
}
