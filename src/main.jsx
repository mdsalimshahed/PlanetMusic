import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ResizeObserverPolyfill from 'resize-observer-polyfill'
import './index.css'
import App from './App.jsx'
import { isUnsupportedVaultBrowser } from './utils/browserSupport.js'

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = ResizeObserverPolyfill
}

if (isUnsupportedVaultBrowser(navigator.userAgent)) {
  document.documentElement.classList.add('legacy-browser')
}

document.body.classList.remove('static-fallback')
document.documentElement.classList.remove('static-fallback')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)