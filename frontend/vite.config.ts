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
        // Cache de conteúdo da API e dos tiles entra na S8 (runtimeCaching).
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
    css: false,
  },
})
