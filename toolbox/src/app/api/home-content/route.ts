import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionByToken } from '@/lib/auth'

export async function GET() {
  try {
    let row = await db.homeContent.findFirst()
    if (!row) {
      row = await db.homeContent.create({ data: {} })
    }
    return NextResponse.json(row)
  } catch {
    return NextResponse.json({
      featuredTitle: 'Featured Tools',
      featuredSubtitle: 'Explore productivity tools designed for operations and content workflows',
      whyChooseTitle: 'Why Choose This Toolbox',
      whyChooseSubtitle: 'Unified frontend-backend architecture with secure deployment',
      feature1Title: 'Fast',
      feature1Description: 'Optimized Next.js runtime with edge-ready APIs',
      feature2Title: 'Secure',
      feature2Description: 'Session-based admin with hashed passwords',
      feature3Title: 'Scalable',
      feature3Description: 'Prisma Postgres with global acceleration'
    })
  }
}

export async function PUT(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const token = cookie.match(/admin_session=([^;]+)/)?.[1]
    if (!token || !(await getSessionByToken(token))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const data = await request.json()
    let row = await db.homeContent.findFirst()
    if (row) {
      row = await db.homeContent.update({ where: { id: row.id }, data })
    } else {
      row = await db.homeContent.create({ data })
    }
    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}