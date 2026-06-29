import { NextResponse } from 'next/server'
import { fetchExoplanetByName } from '@/services/nasaService'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request, { params }) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { name } = await params
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  const result = await fetchExoplanetByName(name, apiKey)
  if (!result) {
    return NextResponse.json(
      { error: 'Not Found', detail: `Exoplanet '${name}' not found.`, code: 404 },
      { status: 404 }
    )
  }
  return NextResponse.json(result)
}
