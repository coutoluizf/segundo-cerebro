import React from 'react'
import ReactDOM from 'react-dom/client'
import { Options } from './Options'
import { initSystemTheme } from '@/shared/theme'
import '@/index.css'

// Initialize theme before rendering
initSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
)
