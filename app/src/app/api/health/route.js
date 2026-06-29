import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    service: 'AstroObservatory API',
    version: '1.0.0',
    nasa_key_configured: (process.env.NASA_API_KEY ?? 'DEMO_KEY') !== 'DEMO_KEY',
  })
}
