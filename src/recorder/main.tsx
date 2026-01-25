import React from 'react'
import ReactDOM from 'react-dom/client'
import { Recorder } from './Recorder'
import { initSystemTheme } from '@/shared/theme'
import '@/index.css'

// Initialize theme before rendering
initSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Recorder />
  </React.StrictMode>
)
