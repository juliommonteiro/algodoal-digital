// Este arquivo exporta, junto dos ícones, os dados de cada tipo (traços, grupo, cor): a regra
// abaixo só afeta o Fast Refresh, que recarrega a página inteira quando ele é editado.
/* oxlint-disable react/only-export-components */
import type { ComponentType, SVGProps } from 'react'
import { ROTULO_TIPO } from '../../lib/formatos'
import type { TipoLocal } from '../../lib/tipos'
import { COR } from './cores'

/*
 * Ícones dos tipos de local, desenhados à mão no mesmo grid 24x24 do Icone.tsx e embutidos no
 * bundle: nada de biblioteca nem CDN — o mapa tem de funcionar offline. Traço só (sem
 * preenchimento), em currentColor: no marcador ficam brancos sobre o pino colorido.
 *
 * Os traços ficam como dados porque têm dois usos: os componentes abaixo (legenda) e o
 * marcador, que é DOM puro, fora do React (marcadores.ts).
 */
export const CAMINHOS_DO_TIPO: Record<TipoLocal, readonly string[]> = {
  // Sol nascendo atrás de duas ondas
  beach: [
    'M7 12a5 5 0 0 1 10 0',
    'M12 3v2M5.6 5.6 7 7m11.4-1.4L17 7',
    'M3 15.5q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0',
    'M3 19.5q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0',
  ],
  // Duas pegadas, uma à frente da outra
  trail: [
    'M7.5 3C9.1 3 10 4.8 10 7s-.9 4-2.5 4S5 9.2 5 7s.9-4 2.5-4Z',
    'M5.5 13.5h4v1a2 2 0 0 1-4 0Z',
    'M16.5 7c1.6 0 2.5 1.8 2.5 4s-.9 4-2.5 4-2.5-1.8-2.5-4 .9-4 2.5-4Z',
    'M14.5 17.5h4v1a2 2 0 0 1-4 0Z',
  ],
  // Binóculos: duas lentes e os dois corpos
  tourist_point: [
    'M3 16a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0M14 16a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
    'M3.5 15 5.5 6h3l1 8M20.5 15l-2-9h-3l-1 8M10 12h4',
  ],
  // Sacola de compras com alça
  business: ['M5 8h14l-1 13H6Z', 'M9 10V7a3 3 0 0 1 6 0v3'],
  // Canoa vista de lado e o remo
  experience: [
    'M2 11.5c2 0 3 .7 3.8 1.5h12.4c.8-.8 1.8-1.5 3.8-1.5-1 3.5-4.3 5.5-10 5.5S3 15 2 11.5Z',
    'M16.5 3 9 19',
    'M10.4 16.6 8.8 20.4a1 1 0 0 1-1.8-.8l1.6-3.8',
  ],
  // Reciclagem: três setas formando um triângulo
  collection_point: [
    'M13.3 5.7l6.4 11.1m.4-2.6-.4 2.6-2.4-.9',
    'M18.4 19H5.6m2 1.7-2-1.7 2-1.7',
    'M4.3 16.8l6.4-11.1m-2.4.9 2.4-.9.4 2.6',
  ],
  // Tambor de carimbó (curimbó): couro em cima, corpo de tronco e a amarração em zigue-zague
  culture: [
    'M4.5 7a7.5 2.5 0 1 0 15 0 7.5 2.5 0 1 0-15 0',
    'M4.5 7l1.8 11.5a5.7 2 0 0 0 11.4 0L19.5 7',
    'M5.8 15.5a6.2 2 0 0 0 12.4 0',
    'M8 9.3l1.8 7.8 2.2-7.8 2.2 7.8L16 9.3',
  ],
}

function Desenho({ tipo, ...props }: { tipo: TipoLocal } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {CAMINHOS_DO_TIPO[tipo].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

type PropsDoIcone = SVGProps<SVGSVGElement>

export function IconePraia(props: PropsDoIcone) {
  return <Desenho tipo="beach" {...props} />
}
export function IconeTrilha(props: PropsDoIcone) {
  return <Desenho tipo="trail" {...props} />
}
export function IconePontoTuristico(props: PropsDoIcone) {
  return <Desenho tipo="tourist_point" {...props} />
}
export function IconeEstabelecimento(props: PropsDoIcone) {
  return <Desenho tipo="business" {...props} />
}
export function IconeExperiencia(props: PropsDoIcone) {
  return <Desenho tipo="experience" {...props} />
}
export function IconePontoDeColeta(props: PropsDoIcone) {
  return <Desenho tipo="collection_point" {...props} />
}
export function IconeCultura(props: PropsDoIcone) {
  return <Desenho tipo="culture" {...props} />
}

export type GrupoDoTipo = 'explorar' | 'economia' | 'ambiental' | 'cultura'

/**
 * Cor de cada grupo, de tokens.css. O ícone é branco sobre ela; contraste conferido em
 * icones.test.ts (mínimo 4,5:1). Na ordem da legenda.
 */
export const GRUPOS: Record<GrupoDoTipo, { rotulo: string; cor: string }> = {
  explorar: { rotulo: 'Explorar', cor: COR.mar },
  economia: { rotulo: 'Economia local', cor: COR.sol },
  ambiental: { rotulo: 'Ambiental', cor: COR.mangue },
  cultura: { rotulo: 'Cultura', cor: COR.terra },
}

export interface DadosDoTipo {
  icone: ComponentType<PropsDoIcone>
  grupo: GrupoDoTipo
  /** Cor do pino (a do grupo). */
  cor: string
  /** O mesmo rótulo da lista de locais (ROTULO_TIPO): vai no aria-label e na legenda. */
  rotulo: string
}

const dados = (icone: ComponentType<PropsDoIcone>, grupo: GrupoDoTipo, tipo: TipoLocal) => ({
  icone,
  grupo,
  cor: GRUPOS[grupo].cor,
  rotulo: ROTULO_TIPO[tipo],
})

/** Tipo do local → ícone, grupo, cor e rótulo. Na ordem da legenda. */
export const TIPOS: Record<TipoLocal, DadosDoTipo> = {
  beach: dados(IconePraia, 'explorar', 'beach'),
  trail: dados(IconeTrilha, 'explorar', 'trail'),
  tourist_point: dados(IconePontoTuristico, 'explorar', 'tourist_point'),
  business: dados(IconeEstabelecimento, 'economia', 'business'),
  experience: dados(IconeExperiencia, 'economia', 'experience'),
  collection_point: dados(IconePontoDeColeta, 'ambiental', 'collection_point'),
  culture: dados(IconeCultura, 'cultura', 'culture'),
}
