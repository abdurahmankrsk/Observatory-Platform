import { NextResponse } from 'next/server'
import { getPopularObjects } from '@/services/simbadService'

export async function GET() {
  try {
    const objects = getPopularObjects()
    return NextResponse.json(objects)
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error', detail: err.message, code: 500 }, { status: 500 })
  }
}
