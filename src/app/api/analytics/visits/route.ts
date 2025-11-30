import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { module } = body
    
    if (!module) {
      return NextResponse.json({ error: 'Module key is required' }, { status: 400 })
    }

    // Get IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded ? forwarded.split(',')[0].trim() : (realIp ? realIp.trim() : '127.0.0.1')

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    // Check if this IP has already visited this module today
    const existingVisit = await (db as any).ipVisit.findUnique({
      where: {
        ip_date_module: {
          ip,
          date: dateStr,
          module
        }
      }
    })

    if (existingVisit) {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Record the visit for this IP
    await (db as any).ipVisit.create({
      data: {
        ip,
        date: dateStr,
        module
      }
    })

    // Update DB daily visits (independent of module specific logic)
    if (module !== 'total') {
      await (db as any).dailyVisit.upsert({
        where: { date_module: { date: dateStr, module } },
        update: { count: { increment: 1 } },
        create: { date: dateStr, module, count: 1 }
      })
    }

    // Track TOTAL site UV (Unique Visitor) for the day
    // This logic ensures that regardless of how many modules a user visits,
    // they are only counted ONCE per day as a site visitor.
    const existingTotalVisit = await (db as any).ipVisit.findUnique({
      where: {
        ip_date_module: {
          ip,
          date: dateStr,
          module: 'total'
        }
      }
    })

    if (!existingTotalVisit) {
        await (db as any).ipVisit.create({
        data: {
          ip,
          date: dateStr,
          module: 'total'
        }
      })
      
      await (db as any).dailyVisit.upsert({
        where: { date_module: { date: dateStr, module: 'total' } },
        update: { count: { increment: 1 } },
        create: { date: dateStr, module: 'total', count: 1 }
      })
    }
    
    // Update module total views (All time views)
    if (module !== 'total') {
      try {
        await (db as any).toolModule.update({
          where: { key: module },
          data: { views: { increment: 1 } }
        })
      } catch {}
    }
    
    return NextResponse.json({ success: true })
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
    
    if (date) {
      const rows = await (db as any).dailyVisit.findMany({ where: { date } })
      const totalRow = rows.find((r: any) => r.module === 'total')
      const total = totalRow ? totalRow.count : 0
      const byModule: Record<string, number> = {}
      rows.forEach((r: any) => {
        if (r.module !== 'total') byModule[r.module] = r.count
      })
      return NextResponse.json({ total, byModule })
    } else if (start && end) {
      const rows = await (db as any).dailyVisit.findMany({
        where: {
          date: { gte: start, lte: end }
        }
      })
      
      let total = 0
      const byModule: Record<string, number> = {}
      
      rows.forEach((r: any) => {
        if (r.module === 'total') {
          total += r.count
        } else {
          byModule[r.module] = (byModule[r.module] || 0) + r.count
        }
      })
      
      return NextResponse.json({ total, byModule })
    } else {
      // Return today's data by default
      const today = new Date()
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const d = String(today.getDate()).padStart(2, '0')
      const todayStr = `${y}-${m}-${d}`
      
      const rows = await (db as any).dailyVisit.findMany({ where: { date: todayStr } })
      const totalRow = rows.find((r: any) => r.module === 'total')
      const total = totalRow ? totalRow.count : 0
      const byModule: Record<string, number> = {}
      rows.forEach((r: any) => {
        if (r.module !== 'total') byModule[r.module] = r.count
      })
      return NextResponse.json({ total, byModule })
    }
  } catch (e) {
    return NextResponse.json({ total: 0, byModule: {} })
  }
}
