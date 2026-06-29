import { NextResponse } from 'next/server'
import { fetchNearEarthAsteroids } from '@/services/nasaService'

export async function GET() {
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const fmt = (d) => d.toISOString().slice(0, 10)

  try {
    const results = await fetchNearEarthAsteroids(fmt(today), fmt(tomorrow), apiKey)
    results.sort((a, b) => {
      const distA = a.close_approach?.miss_distance_km ?? Infinity
      const distB = b.close_approach?.miss_distance_km ?? Infinity
      return distA - distB
    })
    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({ error: 'Service Unavailable', detail: err.message, code: 503 }, { status: 503 })
  }
}
