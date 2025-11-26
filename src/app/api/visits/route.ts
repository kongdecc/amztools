import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const VISITS_FILE = path.join(process.cwd(), 'data', 'visits.json')

function readVisitData(): Record<string, any> {
  try {
    if (fs.existsSync(VISITS_FILE)) {
      const content = fs.readFileSync(VISITS_FILE, 'utf-8')
      const obj = JSON.parse(content)
      if (obj && typeof obj === 'object') return obj
    }
  } catch {}
  return {}
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '7d'
    let days = 7
    if (range === '30d') days = 30
    else if (range === '1y') days = 365
    const map = readVisitData()
    const list: Array<any> = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = formatDate(d)
      const row = map[key] || { total: 0, byModule: {} }
      list.push({ date: key, total: Number(row.total || 0), byModule: row.byModule || {} })
    }
    return NextResponse.json({ range, items: list })
  } catch {
    return NextResponse.json({ range: '7d', items: [] })
  }
}

