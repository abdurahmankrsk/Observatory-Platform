import { NextResponse } from 'next/server'
import { searchSimbadMany } from '@/services/simbadService'
import { fetchExoplanetByName } from '@/services/nasaService'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 1) {
    return NextResponse.json({ error: 'q parameter is required', code: 400 }, { status: 400 })
  }

  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  // 1. SIMBAD + curated catalogs
  const results = await searchSimbadMany(q, 12)

  // 2. Check NASA Exoplanet Archive (if not already found as an exoplanet)
  if (!results.length || results[0].type !== 'exoplanet') {
    try {
      const exo = await fetchExoplanetByName(q, apiKey)
      if (exo && !results.some((r) => r.id === exo.id)) {
        results.push(exo)
      }
    } catch {
      // Non-critical — swallow
    }
  }

  return NextResponse.json({ query: q, results, total: results.length })
}
