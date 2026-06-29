import { NextResponse } from 'next/server'
import { getPopularObjects } from '@/services/simbadService'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(request) {
  const limited = rateLimit(request)
  if (limited) return limited

  try {
    const objects = getPopularObjects()
    return NextResponse.json(objects)
  } catch (err) {
    console.error('[api/popular]', err)
    return NextResponse.json({ error: 'Internal Server Error', detail: 'Failed to load popular objects.', code: 500 }, { status: 500 })
  }
}
