import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createHashHistory } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './styles.css'

// Hash history because published apps are served from a sub-path on object storage,
// where a deep link to /book has no server route to answer it.
const queryClient = new QueryClient()
const router = createRouter({ routeTree, history: createHashHistory(), context: { queryClient }, scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
