import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }

async function redirectToPython(request: Request, context: RouteContext) {
  const { path } = await context.params
  const source = new URL(request.url)
  const target = new URL('/api/freight-invoice-python', source.origin)

  target.searchParams.set('path', `/${path.join('/')}`)
  source.searchParams.forEach((value, key) => target.searchParams.append(key, value))

  // A 307 keeps the original method and body for uploads, restores, and exports.
  return NextResponse.redirect(target, 307)
}

export const GET = redirectToPython
export const POST = redirectToPython
export const PUT = redirectToPython
export const PATCH = redirectToPython
export const DELETE = redirectToPython
