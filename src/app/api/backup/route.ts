import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SESSION_COOKIE, getSessionByToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function checkAuth(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1]
  if (!token) return false
  const session = await getSessionByToken(token)
  return !!session
}

export async function GET(request: Request) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const [
      siteSettings,
      homeContent,
      toolModules,
      toolCategories,
      blogPosts,
      suggests
    ] = await Promise.all([
      db.siteSettings.findMany(),
      db.homeContent.findMany(),
      db.toolModule.findMany(),
      db.toolCategory.findMany(),
      db.blogPost.findMany(),
      db.suggest.findMany()
    ])

    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        siteSettings,
        homeContent,
        toolModules,
        toolCategories,
        blogPosts,
        suggests
      }
    }

    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`
      }
    })
  } catch (error) {
    console.error('Backup error:', error)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: 'Invalid backup file' }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      // Clear existing data
      await tx.siteSettings.deleteMany()
      await tx.homeContent.deleteMany()
      await tx.toolModule.deleteMany()
      await tx.toolCategory.deleteMany()
      await tx.blogPost.deleteMany()
      await tx.suggest.deleteMany()

      // Restore data
      if (data.siteSettings?.length) await tx.siteSettings.createMany({ data: data.siteSettings })
      if (data.homeContent?.length) await tx.homeContent.createMany({ data: data.homeContent })
      if (data.toolModules?.length) await tx.toolModule.createMany({ data: data.toolModules })
      if (data.toolCategories?.length) await tx.toolCategory.createMany({ data: data.toolCategories })
      if (data.blogPosts?.length) await tx.blogPost.createMany({ data: data.blogPosts })
      if (data.suggests?.length) await tx.suggest.createMany({ data: data.suggests })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }
}
