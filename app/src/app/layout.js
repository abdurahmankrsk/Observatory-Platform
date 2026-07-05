import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'AstroObservatory',
  description:
    'Explore exoplanets, stars, nebulae, asteroids, black holes and other celestial objects — powered by real NASA data & the SIMBAD database.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100vw', height: '100vh' }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
