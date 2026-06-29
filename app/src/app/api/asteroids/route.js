import { NextResponse } from 'next/server'
import { fetchNearEarthAsteroids } from '@/services/nasaService'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request) {
  const limited = rateLimit(request)
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start_date and end_date are required (YYYY-MM-DD)', code: 422 },
      { status: 422 }
    )
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Dates must be in YYYY-MM-DD format.', code: 422 }, { status: 422 })
  }

  const diffDays = (end - start) / (1000 * 60 * 60 * 24)
  if (diffDays > 7) {
    return NextResponse.json(
      { error: 'Date range cannot exceed 7 days (NASA API limit).', code: 422 },
      { status: 422 }
    )
  }

  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  try {
    const results = await fetchNearEarthAsteroids(startDate, endDate, apiKey)
    return NextResponse.json(results)
  } catch (err) {
    console.error('[api/asteroids]', err)
    return NextResponse.json({ error: 'Service Unavailable', detail: 'Upstream asteroid service unavailable.', code: 503 }, { status: 503 })
  }
}
