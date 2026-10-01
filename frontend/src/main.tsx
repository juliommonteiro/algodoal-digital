import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { aquecerCacheDoCatalogo } from './lib/cacheDoCatalogo'
import { api } from './lib/cliente'

aquecerCacheDoCatalogo(() => Promise.all([api.categorias(), api.locais()]))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
