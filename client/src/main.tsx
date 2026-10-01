import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setTokenProvider } from './utils/httpClient'
import { useAuthStore } from './store/useAuthStore'

setTokenProvider(() => useAuthStore.getState().accessToken)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
