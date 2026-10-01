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
        name: 'Algodoal Digital',
        short_name: 'Algodoal',
        description: 'Mapa, serviços locais e passaporte de Algodoal — funciona sem internet.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1efe6', // --fundo
        theme_color: '#004f38', // --verde-fundo
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
            // Catálogo (lista de locais e categorias): os marcadores do mapa e a lista
            // sobrevivem a uma queda de rede. StaleWhileRevalidate responde do cache na hora e
            // atualiza em segundo plano quando há conexão — a versão nova aparece na carga
            // seguinte. Casa só pelo caminho: em produção a API pode estar em outra origem
            // (VITE_API_URL). Só 200 entra no cache, para um erro não substituir dado bom.
            //
            // ATENÇÃO: isto NÃO é a sincronização offline da S8. A S8 continua por fazer:
            // IndexedDB (Dexie) com o catálogo, pull incremental por `since` e a fila Outbox de
            // eventos (docs/arquitetura.md). Aqui é só cache HTTP de duas respostas inteiras.
            urlPattern: ({ url }) => /^\/api\/v1\/(places|categories)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'algodoal-catalogo-v1',
              expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
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
