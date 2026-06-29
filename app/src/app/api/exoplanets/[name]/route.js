import { NextResponse } from 'next/server'
import { fetchExoplanetByName } from '@/services/nasaService'

export async function GET(_request, { params }) {
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
