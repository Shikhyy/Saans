import '@fontsource-variable/archivo'
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './state/app'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

// Hide motion targets before the first paint so nothing flashes into place. The motion layer
// removes this class again under reduced motion, and every target is visible without it.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('has-motion')
}

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // offline support is a bonus, never a requirement
    })
  })
}
