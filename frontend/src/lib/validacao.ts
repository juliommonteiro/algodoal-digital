// Validação no cliente: só para dar retorno rápido. Quem decide de verdade é a API.

export const SENHA_MINIMA = 8

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function erroEmail(email: string): string | null {
  if (!email.trim()) return 'Informe seu e-mail.'
  if (!EMAIL.test(email.trim())) return 'Esse e-mail não parece válido. Confira se tem @ e domínio.'
  return null
}

export function erroSenhaObrigatoria(senha: string): string | null {
  return senha ? null : 'Informe sua senha.'
}

export function erroSenhaNova(senha: string): string | null {
  if (!senha) return 'Crie uma senha.'
  if (senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  }
  return null
}

export function erroConfirmacao(senha: string, confirmacao: string): string | null {
  if (!confirmacao) return 'Repita a senha.'
  if (senha !== confirmacao) return 'As senhas não são iguais.'
  return null
}

/** Mesma regra da API (CarroceiroIn): com DDD, ou já com o 55 do Brasil. */
export function erroWhatsApp(whatsapp: string): string | null {
  const digitos = whatsapp.replace(/\D/g, '')
  if (!digitos) return 'Informe seu WhatsApp: é por ele que o turista fala com você.'
  const nacional = digitos.length === 10 || digitos.length === 11
  const comPais = (digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')
  return nacional || comPais ? null : 'Informe o WhatsApp com DDD, por exemplo (91) 98888-7777.'
}

export const CAPACIDADE_MAXIMA = 12

export function erroCapacidade(capacidade: string): string | null {
  const numero = Number(capacidade)
  if (!capacidade.trim() || !Number.isInteger(numero) || numero < 1 || numero > CAPACIDADE_MAXIMA) {
    return `Informe quantas pessoas cabem, de 1 a ${CAPACIDADE_MAXIMA}.`
  }
  return null
}

export function erroNome(nome: string): string | null {
  if (!nome.trim()) return 'Informe seu nome.'
  if (nome.trim().length < 2) return 'O nome precisa ter pelo menos 2 letras.'
  return null
}

export type ErrosDe<C extends string> = Partial<Record<C, string>>

/** Primeiro campo com erro, na ordem do formulário, para levar o foco até ele. */
export function primeiroComErro<C extends string>(ordem: readonly C[], erros: ErrosDe<C>): C | null {
  return ordem.find((campo) => erros[campo]) ?? null
}
