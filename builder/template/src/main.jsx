// TEMPLATE — identical for every generated app. Mounts <App/> inside HashRouter with the auth + toast providers.
// The generator does NOT emit this file; the scaffold copies it in, so it costs 0 output tokens.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './lib/auth.jsx'
import { ToastProvider } from './lib/toast.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
)
