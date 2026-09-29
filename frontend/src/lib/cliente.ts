import { clienteHttp } from './api'
import { clienteMock } from './mock'
import type { ClienteApi } from './tipos'

/** Mock por padrão enquanto o backend não tem os endpoints; VITE_USAR_MOCK=false liga a API real. */
export const usandoMock = import.meta.env.VITE_USAR_MOCK !== 'false'

/** Ponto único de acesso aos dados: as telas importam `api` daqui, nunca o mock direto. */
export const api: ClienteApi = usandoMock ? clienteMock : clienteHttp
