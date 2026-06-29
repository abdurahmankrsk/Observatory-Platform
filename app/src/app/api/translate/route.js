import { NextResponse } from 'next/server'
import { translateBatch } from '@/services/translationService'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request) {
  const limited = rateLimit(request)
  if (limited) return limited

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 400 }, { status: 400 })
  }

  const texts = Array.isArray(body.texts) ? body.texts : []
  const target = body.target ?? 'en'
  const source = body.source ?? 'en'

  try {
    const translations = await translateBatch(texts, target, source)
    return NextResponse.json({ translations })
  } catch (err) {
    console.error('[api/translate]', err)
    return NextResponse.json({ error: 'Translation failed', detail: 'Translation service error.', code: 500 }, { status: 500 })
  }
}
