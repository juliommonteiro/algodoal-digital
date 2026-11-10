/**
 * Fotos dos locais (#29): o mesmo cliente serve o painel admin (/admin) e o do parceiro
 * (/partner); a API decide quem mexe em qual local.
 */
import { garantirTokenDeAcesso, requisitar } from './api'
import { usandoMock } from './cliente'
import { bancoDoMock, falhar, responder, usuarioDaSessaoMock } from './mock'
import type { Foto } from './tipos'

/** Mesmos limites da API (services/fotos.py). */
export const LIMITE_DE_FOTOS = 6
export const TAMANHO_MAXIMO = 5 * 1024 * 1024
/** Lado maior depois de reduzir no aparelho: nítido no celular, ~300 kB em JPEG. */
const LADO_MAXIMO = 1600

export interface ClienteFotos {
  /** Devolve as fotos do local depois da mudança, já na ordem (a primeira é a capa). */
  enviar(localId: string, foto: Blob): Promise<Foto[]>
  apagar(localId: string, fotoId: string): Promise<Foto[]>
  tornarCapa(localId: string, fotoId: string): Promise<Foto[]>
}

export type Painel = 'admin' | 'partner'

/**
 * Reduz a foto para no máximo 1600 px e regrava em JPEG antes de enviar. Regravar também tira
 * os metadados (EXIF), que podem ter a localização de quem tirou a foto. Sem suporte no
 * navegador (createImageBitmap/canvas), envia o arquivo como está; a API ainda confere tipo e
 * tamanho.
 */
export async function prepararFoto(arquivo: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return arquivo
  try {
    const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(imagem.width * escala)
    canvas.height = Math.round(imagem.height * escala)
    const contexto = canvas.getContext('2d')
    if (!contexto) return arquivo
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height)
    imagem.close()
    const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
    return jpeg ?? arquivo
  } catch {
    // Formato que o navegador não abre (ex.: HEIC em alguns Android): a API responde 415.
    return arquivo
  }
}

function clienteHttp(painel: Painel): ClienteFotos {
  const base = (localId: string) => `/${painel}/places/${encodeURIComponent(localId)}/photos`
  return {
    enviar: (localId, foto) => requisitar<Foto[]>('POST', base(localId), foto),
    apagar: (localId, fotoId) =>
      requisitar<Foto[]>('DELETE', `${base(localId)}/${encodeURIComponent(fotoId)}`),
    tornarCapa: (localId, fotoId) =>
      requisitar<Foto[]>('POST', `${base(localId)}/${encodeURIComponent(fotoId)}/capa`),
  }
}

// ---------------------------------------------------------------------------- mock

function clienteMock(painel: Painel): ClienteFotos {
  async function localPermitido(localId: string) {
    await garantirTokenDeAcesso()
    const usuario = usuarioDaSessaoMock()
    if (!usuario) return { erro: falhar(401, 'Não autenticado.') }
    const perfil = painel === 'admin' ? 'admin' : 'partner'
    if (usuario.role !== perfil) return { erro: falhar(403, 'Você não tem permissão para isso.') }
    const local = bancoDoMock().locais.find((l) => l.id === localId)
    const dele = painel === 'admin' || local?.business?.owner_email === usuario.email
    if (!local || !dele || (painel === 'partner' && local.deleted_at)) {
      return { erro: falhar(404, 'Local não encontrado.') }
    }
    return { local }
  }
  // Como os triggers da API (#28): mexer nas fotos marca o local como alterado.
  const tocar = (local: { updated_at: string }) => (local.updated_at = new Date().toISOString())
  const ordenadas = (fotos: Foto[]) =>
    fotos.sort((a, b) => a.position - b.position).map((f, position) => Object.assign(f, { position }))

  return {
    async enviar(localId, foto) {
      const { local, erro } = await localPermitido(localId)
      if (erro) return erro
      if (local.photos.length >= LIMITE_DE_FOTOS) {
        return falhar(409, 'Cada local pode ter até 6 fotos. Apague uma para enviar outra.')
      }
      if (foto.size > TAMANHO_MAXIMO) return falhar(413, 'A foto passa de 5 MB. Tente uma menor.')
      if (!/^image\/(jpeg|png|webp)$/.test(foto.type)) {
        return falhar(415, 'Use uma foto em JPG, PNG ou WebP.')
      }
      // Sem arquivo de verdade no mock: a tela mostra o substituto (urlDaFoto).
      local.photos.push({
        id: crypto.randomUUID(),
        storage_key: `mock/${crypto.randomUUID()}.jpg`,
        position: local.photos.length,
      })
      tocar(local)
      return responder(ordenadas(local.photos))
    },

    async apagar(localId, fotoId) {
      const { local, erro } = await localPermitido(localId)
      if (erro) return erro
      if (!local.photos.some((f) => f.id === fotoId)) return falhar(404, 'Foto não encontrada.')
      local.photos = local.photos.filter((f) => f.id !== fotoId)
      tocar(local)
      return responder(ordenadas(local.photos))
    },

    async tornarCapa(localId, fotoId) {
      const { local, erro } = await localPermitido(localId)
      if (erro) return erro
      const foto = local.photos.find((f) => f.id === fotoId)
      if (!foto) return falhar(404, 'Foto não encontrada.')
      foto.position = -1
      tocar(local)
      return responder(ordenadas(local.photos))
    },
  }
}

export function clienteDeFotos(painel: Painel): ClienteFotos {
  return usandoMock ? clienteMock(painel) : clienteHttp(painel)
}
