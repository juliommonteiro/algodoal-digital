import { addProtocol, setWorkerUrl } from 'maplibre-gl'
// O MapLibre 6 monta a URL do worker em tempo de execução, e o Vite não a enxerga: sem isto o
// build não inclui o worker e os tiles nunca são desenhados. `?worker&url` faz o Vite empacotar
// o worker (com o código que ele importa) num chunk próprio e devolver o endereço.
import urlDoWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { PMTiles, Protocol } from 'pmtiles'
import { FonteEmMemoria } from './arquivo'

let protocolo: Protocol | null = null

/**
 * Prepara o MapLibre uma vez só por sessão — fora do ciclo de render, para remontar o
 * componente não registrar de novo: aponta o worker e registra o protocolo pmtiles://.
 */
export function protocoloPmtiles(): Protocol {
  if (!protocolo) {
    setWorkerUrl(urlDoWorker)
    protocolo = new Protocol({ metadata: true })
    addProtocol('pmtiles', protocolo.tile)
  }
  return protocolo
}

/** Registra o arquivo em memória no protocolo (uma vez por chave). */
export function registrarArquivo(chave: string, dados: ArrayBuffer): void {
  const protocolo = protocoloPmtiles()
  if (!protocolo.get(`pmtiles://${chave}`)) {
    protocolo.add(new PMTiles(new FonteEmMemoria(chave, dados)))
  }
}
