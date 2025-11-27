import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // YYYY-MM-DD
    
    const allData = readVisitData()
    
    if (date) {
      // Return specific date data
      const dayData = allData[date] || { total: 0, byModule: {} }
      return NextResponse.json(dayData)
    } else {
      // Return today's data by default
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      const todayStr = `${y}-${m}-${d}`
      
      const todayData = allData[todayStr] || { total: 0, byModule: {} }
      return NextResponse.json(todayData)
    }
  } catch (e) {
    return NextResponse.json({ total: 0, byModule: {} })
  }
}
