import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const VISITS_FILE = path.join(process.cwd(), 'data', 'visits.json')
const MODULES_FILE = path.join(process.cwd(), 'data', 'modules.json')

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

function writeVisitData(obj: Record<string, any>) {
  try {
    const dir = path.dirname(VISITS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(VISITS_FILE, JSON.stringify(obj, null, 2))
  } catch {}
}

function updateModuleViews(key: string) {
  try {
    if (fs.existsSync(MODULES_FILE)) {
      const content = fs.readFileSync(MODULES_FILE, 'utf-8')
      const modules = JSON.parse(content)
      if (Array.isArray(modules)) {
        const module = modules.find((m: any) => m.key === key)
        if (module) {
          module.views = Number(module.views || 0) + 1
          fs.writeFileSync(MODULES_FILE, JSON.stringify(modules, null, 2))
        }
      }
    }
  } catch {}
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { module } = body
    
    if (!module) {
      return NextResponse.json({ error: 'Module key is required' }, { status: 400 })
    }

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    const allData = readVisitData()
    const dayData = allData[dateStr] || { total: 0, byModule: {} }
    
    dayData.total = Number(dayData.total || 0) + 1
    dayData.byModule = dayData.byModule || {}
    dayData.byModule[module] = Number(dayData.byModule[module] || 0) + 1
    
    allData[dateStr] = dayData
    writeVisitData(allData)
    
    // Also update total views in modules.json
    updateModuleViews(module)
    
    return NextResponse.json({ success: true, count: dayData.byModule[module] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to track visit' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // YYYY-MM-DD
    const start = searchParams.get('start') // YYYY-MM-DD
    const end = searchParams.get('end') // YYYY-MM-DD
    
    console.log('[API] Visits Request:', { date, start, end })

    const allData = readVisitData()
    console.log('[API] All Data Keys:', Object.keys(allData).length)
    
    if (date) {
      const dayData = allData[date] || { total: 0, byModule: {} }
      return NextResponse.json(dayData)
    } else if (start && end) {
      // Use UTC to avoid timezone issues
      const parseYMD = (s: string) => {
        const [yy, mm, dd] = s.split('-').map(x => Number(x))
        return new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1))
      }
      const formatYMD = (d: Date) => {
        return d.toISOString().split('T')[0]
      }
      
      let s = parseYMD(start)
      let e = parseYMD(end)
      if (s > e) { const tmp = s; s = e; e = tmp }
      
      let total = 0
      const byModule: Record<string, number> = {}
      const cur = new Date(s)
      
      // console.log('[API] Range (UTC):', s.toISOString(), 'to', e.toISOString())
      
      while (cur <= e) {
        const key = formatYMD(cur)
        const dayData = allData[key] || { total: 0, byModule: {} }
        total += Number(dayData.total || 0)
        if (dayData.byModule) {
          for (const modKey of Object.keys(dayData.byModule)) {
            byModule[modKey] = (byModule[modKey] || 0) + Number(dayData.byModule[modKey] || 0)
          }
        }
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
      // console.log('[API] Result:', { total })
      return NextResponse.json({ total, byModule })
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
