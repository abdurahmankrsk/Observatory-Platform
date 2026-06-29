import { NextResponse } from 'next/server'
import { KNOWN_OBJECTS, SOLAR_SYSTEM, MOONS, ASTEROIDS } from '@/services/simbadService'
import { fetchExoplanetByName } from '@/services/nasaService'

export async function GET(_request, { params }) {
  const { id } = await params
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  for (const catalog of [KNOWN_OBJECTS, SOLAR_SYSTEM, MOONS, ASTEROIDS]) {
    if (catalog[id]) return NextResponse.json(catalog[id])
  }

  try {
    const exo = await fetchExoplanetByName(id.replace(/_/g, ' '), apiKey)
    if (exo) return NextResponse.json(exo)
  } catch {
    // Non-critical
  }

  return NextResponse.json({ error: 'Not Found', detail: `Object '${id}' not found.`, code: 404 }, { status: 404 })
}
