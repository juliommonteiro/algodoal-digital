import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import './styles/ui-refresh.css'
import './styles/globals-redesign.css'
import App from './App'
import { iniciarSyncManager } from './lib/sync/syncManager'

iniciarSyncManager()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
