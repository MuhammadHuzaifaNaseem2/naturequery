import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { initialize } from './store/app-store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

initialize().catch((error) => {
  console.error('Startup failed', error)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = ''
    const box = document.createElement('div')
    box.style.cssText = 'padding:48px;font:14px system-ui;line-height:1.6'
    box.textContent = `NatureQuery could not start: ${error?.message ?? error}. Restart the app, and contact support if this keeps happening.`
    root.append(box)
  }
})
