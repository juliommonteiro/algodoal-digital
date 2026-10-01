/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        // Identidade estável do app instalado: se o start_url mudar um dia, o Android continua
        // tratando como o mesmo app (e não como um segundo).
        id: '/',
        name: 'Algodoal Digital',
        short_name: 'Algodoal',
        description:
          'Mapa da Ilha de Algodoal, praias, trilhas e serviços locais com contato pelo ' +
          'WhatsApp — funciona sem internet depois de aberto uma vez.',
        lang: 'pt-BR',
        dir: 'ltr',
        // O mapa é público: abrir o app instalado nunca cai no login.
        start_url: '/',
        // Todas as rotas do app (/, /local/:id, /diretorio, /carroca, /passaporte, /entrar,
        // /admin...) ficam sob /, então nenhuma abre fora da janela do app.
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1efe6', // --fundo
        theme_color: '#004f38', // --verde-fundo
        categories: ['travel', 'navigation', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Desenho reduzido a 72% para caber nos 80% centrais que o Android não recorta,
          // com o fundo (céu e mar) preenchendo até a borda.
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Capturas do app rodando (não do protótipo): o Android mostra um convite de instalação
        // completo em vez da barra mínima. Ficam fora do precache — só servem para instalar.
        screenshots: [
          {
            src: 'capturas/mapa.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mapa da ilha com praias, trilhas e serviços',
          },
          {
            src: 'capturas/diretorio.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Diretório de locais com busca e filtros',
          },
          {
            src: 'capturas/detalhe.jpg',
            sizes: '780x1688',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Detalhe do local com horário e contato pelo WhatsApp',
          },
        ],
      },
      workbox: {
        // Entram no precache, para o app abrir offline: fontes auto-hospedadas (woff2), o mapa
        // da ilha (pmtiles, 707 kB) e os glifos e o sprite do estilo do mapa.
        globPatterns: ['**/*.{js,css,html,woff2,pmtiles}', 'mapa/**/*.{pbf,json,png}'],
        // App shell: todas as rotas caem no index.html quando offline.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Catálogo (lista de locais, detalhe de um local e categorias): os marcadores do mapa,
            // a lista e o detalhe sobrevivem a uma queda de rede. StaleWhileRevalidate responde do cache na hora e
            // atualiza em segundo plano quando há conexão — a versão nova aparece na carga
            // seguinte. Casa só pelo caminho: em produção a API pode estar em outra origem
            // (VITE_API_URL). Só 200 entra no cache, para um erro não substituir dado bom.
            //
            // ATENÇÃO: isto NÃO é a sincronização offline da S8. A S8 continua por fazer:
            // IndexedDB (Dexie) com o catálogo, pull incremental por `since` e a fila Outbox de
            // eventos (docs/arquitetura.md). Aqui é só cache HTTP de duas respostas inteiras.
            urlPattern: ({ url }) =>
              /^\/api\/v1\/(categories|places(\/[0-9a-f-]{36})?)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'algodoal-catalogo-v1',
              // Uma entrada por local aberto, mais a lista e as categorias.
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // O worker do MapLibre é um módulo ES (importa código compartilhado): empacota como ES.
  worker: { format: 'es' },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    // Os testes sempre usam o mock, mesmo que o .env local de quem roda aponte para a API
    // real (VITE_USAR_MOCK=false): sem isso, a suíte depende de um backend no ar.
    env: { VITE_USAR_MOCK: 'true' },
    setupFiles: ['./src/test/setup.ts'],
    // CSS desligado nos testes, menos o tokens.css: o teste das cores do mapa o lê (?raw).
    css: { include: [/styles\/tokens\.css/] },
  },
})
