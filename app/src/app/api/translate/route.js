import { NextResponse } from 'next/server'
import { translateBatch } from '@/services/translationService'

export async function POST(request) {
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
    return NextResponse.json({ error: 'Translation failed', detail: err.message, code: 500 }, { status: 500 })
  }
}
