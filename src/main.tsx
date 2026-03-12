import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize test hooks for E2E testing (only in dev mode)
if (import.meta.env.DEV) {
  import('./test/hooks/test-hooks').then(({ initializeTestHooks }) => {
    initializeTestHooks();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
