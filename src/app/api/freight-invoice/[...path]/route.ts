import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_BACKEND = 'http://127.0.0.1:8765'

function backendBaseUrl() {
  return (process.env.FREIGHT_INVOICE_BASE_URL || DEFAULT_BACKEND).replace(/\/+$/, '')
}

function buildTargetUrl(request: Request, path: string[]) {
  const currentUrl = new URL(request.url)
  const target = new URL(`${backendBaseUrl()}/api/${path.join('/')}`)
  target.search = currentUrl.search
  return target
}

function copyRequestHeaders(request: Request) {
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')
  return headers
}

async function proxy(request: Request, path: string[]) {
  const targetUrl = buildTargetUrl(request, path)
  const method = request.method.toUpperCase()

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: copyRequestHeaders(request),
      body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    })

    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('content-length')
    responseHeaders.set('x-freight-invoice-proxy', 'nextjs')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: '货代发票服务暂时不可用',
        detail: error instanceof Error ? error.message : 'Unknown upstream error',
        backend: backendBaseUrl(),
      },
      { status: 502 }
    )
  }
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxy(request, path)
}
