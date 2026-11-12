import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SyncGate from './linecook/SyncGate.jsx'
import { cleanUpTestData } from './lib/cleanup.js'

// Before this phone shares anything, clear the old test data off it.
cleanUpTestData()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SyncGate>
      <App />
    </SyncGate>
  </StrictMode>,
)
