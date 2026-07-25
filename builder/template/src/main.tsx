// TEMPLATE — identical for every generated app. Mounts <App/> inside HashRouter with the auth + toast providers.
// The generator does NOT emit this file; the scaffold copies it in, so it costs 0 output tokens.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './lib/auth.tsx'
import { ToastProvider } from './lib/toast.tsx'

// The engine behind useResource(). Configured ONCE here so no generated page ever has to think about caching
// policy. retry:1 covers a dropped connection without making a genuine 400 take four round-trips to surface;
// window-focus refetch is off because a list silently reloading under a half-filled form reads as a glitch.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false } },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
