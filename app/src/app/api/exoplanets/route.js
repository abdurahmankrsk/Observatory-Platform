import { NextResponse } from 'next/server'
import { fetchExoplanets } from '@/services/nasaService'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500)
  const habitable = searchParams.get('habitable') === 'true'
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  try {
    const results = await fetchExoplanets(limit, habitable, apiKey)
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: 'Service Unavailable', detail: err.message, code: 503 }, { status: 503 })
  }
}
