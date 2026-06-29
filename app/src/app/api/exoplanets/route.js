import { NextResponse } from 'next/server'
import { fetchExoplanets } from '@/services/nasaService'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500)
  const habitable = searchParams.get('habitable') === 'true'
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  try {
    const results = await fetchExoplanets(limit, habitable, apiKey)
    return NextResponse.json(results)
  } catch (err) {
    console.error('[api/exoplanets]', err)
    return NextResponse.json({ error: 'Service Unavailable', detail: 'Upstream exoplanet service unavailable.', code: 503 }, { status: 503 })
  }
}
