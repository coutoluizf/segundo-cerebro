import React from 'react'
import ReactDOM from 'react-dom/client'
import { Popup } from './Popup'
import { initSystemTheme } from '@/shared/theme'
import '@/index.css'

// Initialize theme before rendering
initSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
)
