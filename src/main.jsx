import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SyncGate from './linecook/SyncGate.jsx'
import { cleanUpTestData } from './lib/cleanup.js'
import OfflineBar from './linecook/OfflineBar.jsx'

// Before this phone shares anything, clear the old test data off it.
cleanUpTestData()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OfflineBar />
    <SyncGate>
      <App />
    </SyncGate>
  </StrictMode>,
)

// Keep a copy of the app on the phone so it opens with no signal.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
