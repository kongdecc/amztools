import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '7d'
    let days = 7
    if (range === '30d') days = 30
    else if (range === '1y') days = 365
    const today = new Date()
    const items: Array<any> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${day}`
      items.push({ date: key, total: 0, byModule: {} })
    }
    return NextResponse.json({ range, items })
  } catch {
    return NextResponse.json({ range: '7d', items: [] })
  }
}
