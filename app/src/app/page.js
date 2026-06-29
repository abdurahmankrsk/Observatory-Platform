'use client'

import dynamic from 'next/dynamic'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Skip SSR entirely — the app uses WebGL, localStorage, and Three.js,
// all of which are browser-only. There is no benefit to server-rendering this.
const App = dynamic(() => import('@/App'), { ssr: false })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
})

export default function HomePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

