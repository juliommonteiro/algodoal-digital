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
        // Fica de fora o painel administrativo (src/admin/, chunk PainelAdmin-*.js e .css): o
        // código dele não vai para o celular do turista. Quem abre /admin baixa com rede; sem
        // rede, a rota mostra "O painel não abriu" (pages/AdminPage.tsx). O nome do chunk vem
        // do arquivo importado em pages/AdminPage.tsx — renomeou lá, renomeie aqui.
        globIgnores: ['**/PainelAdmin-*'],
        // App shell: todas as rotas caem no index.html quando offline.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  // O worker do MapLibre é um módulo ES (importa código compartilhado): empacota como ES.
  worker: { format: 'es' },
  server: {
    proxy: { '/api': 'http://localhost:8001' },
  },
  test: {
    environment: 'jsdom',
    fileParallelism: false,
    // Os testes sempre usam o mock, mesmo que o .env local de quem roda aponte para a API
    // real (VITE_USAR_MOCK=false): sem isso, a suíte depende de um backend no ar.
    env: { VITE_USAR_MOCK: 'true' },
    setupFiles: ['./src/test/setup.ts'],
    // CSS desligado nos testes, menos o tokens.css e o mapa.css: os testes das cores do mapa
    // os leem (?raw) para conferir que os pinos pintam com os tokens.
    css: { include: [/styles\/tokens\.css/, /components\/mapa\/mapa\.css/] },
  },
})
