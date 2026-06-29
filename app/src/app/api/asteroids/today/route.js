import { NextResponse } from 'next/server'
import { fetchNearEarthAsteroids } from '@/services/nasaService'

export async function GET() {
  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Format as a LOCAL YYYY-MM-DD date (matches Python's date.today()); using
  // toISOString() here would emit the UTC date, which can be a day off.
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
