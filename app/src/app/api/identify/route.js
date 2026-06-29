import { NextResponse } from 'next/server'
import { identifyByCoordinates } from '@/services/simbadService'
import { fetchExoplanetByCoordinates } from '@/services/nasaService'

function angularSep(ra1, dec1, ra2, dec2) {
  const toRad = (d) => (d * Math.PI) / 180
  const r1 = toRad(ra1), d1 = toRad(dec1), r2 = toRad(ra2), d2 = toRad(dec2)
  const cosSep = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2)
  return (Math.acos(Math.max(-1, Math.min(1, cosSep))) * 180) / Math.PI
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ra = parseFloat(searchParams.get('ra'))
  const dec = parseFloat(searchParams.get('dec'))
  const radius = parseFloat(searchParams.get('radius') ?? '0.1')

  if (isNaN(ra) || ra < 0 || ra > 360) {
    return NextResponse.json({ error: 'ra must be 0–360', code: 422 }, { status: 422 })
  }
  if (isNaN(dec) || dec < -90 || dec > 90) {
    return NextResponse.json({ error: 'dec must be -90 to +90', code: 422 }, { status: 422 })
  }
  if (isNaN(radius) || radius <= 0 || radius > 5) {
    return NextResponse.json({ error: 'radius must be 0–5', code: 422 }, { status: 422 })
  }

  const apiKey = process.env.NASA_API_KEY ?? 'DEMO_KEY'

  let obj = await identifyByCoordinates(ra, dec, radius)

  if (!obj) {
    return NextResponse.json({ found: false, object: null, query_ra: ra, query_dec: dec, radius_deg: radius })
  }

  // Optional exoplanet enrichment for star hits
  if (obj.type === 'star') {
    try {
      const exo = await fetchExoplanetByCoordinates(ra, dec, 0.05, apiKey)
      if (exo) obj = exo
    } catch {
      // Non-critical
    }
  }

  const separation =
    obj.ra != null && obj.dec != null ? angularSep(ra, dec, obj.ra, obj.dec) : null

  return NextResponse.json({
    found: true,
    object: obj,
    query_ra: ra,
    query_dec: dec,
    radius_deg: radius,
    separation_deg: separation,
  })
}
