/**
 * Auth callback entry point
 *
 * This page handles the magic link redirect from Supabase Auth.
 * It extracts the token from the URL and completes the sign-in process.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { Callback } from './Callback'
import '../index.css'

// Render the callback component
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Callback />
  </React.StrictMode>
)
