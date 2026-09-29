import type { Foto, Negocio, TipoLocal } from './tipos'

export const ROTULO_TIPO: Record<TipoLocal, string> = {
  beach: 'Praia',
  trail: 'Trilha',
  tourist_point: 'Ponto turístico',
  experience: 'Experiência',
  business: 'Estabelecimento',
  collection_point: 'Ponto de coleta',
  culture: 'Cultura',
}

/** Ordem de exibição e nome por extenso das chaves de opening_hours. */
export const DIAS: readonly [chave: string, nome: string][] = [
  ['seg', 'Segunda'],
  ['ter', 'Terça'],
  ['qua', 'Quarta'],
  ['qui', 'Quinta'],
  ['sex', 'Sexta'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
]

/** Chave do dia de hoje no formato de opening_hours (Date.getDay: 0 = domingo). */
export function chaveDeHoje(data = new Date()): string {
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][data.getDay()]
}

export function horarioDoDia(horarios: Negocio['opening_hours'], chave: string): string {
  const faixas = horarios?.[chave]
  if (!faixas || faixas.length === 0) return 'Fechado'
  return faixas.map(([abre, fecha]) => `${abre}–${fecha}`).join(', ')
}

const PRECOS: Record<string, string> = {
  $: 'econômico',
  $$: 'moderado',
  $$$: 'mais caro',
}

export function descricaoPreco(faixa: string): string | null {
  return PRECOS[faixa] ?? null
}

function soDigitos(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  // Número nacional com DDD (10 ou 11 dígitos) ganha o 55 do Brasil.
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

export function linkWhatsApp(telefone: string, nomeDoLocal: string): string {
  const texto = `Olá! Encontrei ${nomeDoLocal} no Algodoal Digital.`
  return `https://wa.me/${soDigitos(telefone)}?text=${encodeURIComponent(texto)}`
}

export function linkTelefone(telefone: string): string {
  return `tel:+${soDigitos(telefone)}`
}

export function coordenadas(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

/**
 * URL da foto. O storage ainda não existe (decisão 7 da arquitetura: local em dev, S3 em
 * produção), e as chaves do seed são fictícias; nesses casos a tela mostra o substituto.
 */
export function urlDaFoto(foto: Foto): string | null {
  if (foto.storage_key.startsWith('ficticio/')) return null
  return `${import.meta.env.VITE_API_URL ?? ''}/media/${foto.storage_key}`
}

/** Minúsculas e sem acento: "maré" encontra "Mare", "pousada" encontra "Pousada". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
