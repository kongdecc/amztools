import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { setTimeout as delay } from 'timers/promises'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_BACKEND = 'http://127.0.0.1:8765'
const STARTUP_TIMEOUT_MS = 12000

declare global {
  // eslint-disable-next-line no-var
  var __freightInvoiceStartupPromise: Promise<boolean> | undefined
}

function backendBaseUrl() {
  return (process.env.FREIGHT_INVOICE_BASE_URL || DEFAULT_BACKEND).replace(/\/+$/, '')
}

function backendUrlObject() {
  return new URL(backendBaseUrl())
}

function isLocalBackendTarget() {
  const { hostname } = backendUrlObject()
  return hostname === '127.0.0.1' || hostname === 'localhost'
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

async function fetchUpstream(request: Request, path: string[]) {
  const targetUrl = buildTargetUrl(request, path)
  const method = request.method.toUpperCase()

  return fetch(targetUrl, {
    method,
    headers: copyRequestHeaders(request),
    body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
    cache: 'no-store',
  })
}

function localServiceAppPath() {
  const candidates = [
    path.join(process.cwd(), 'fbafapiao', 'app.py'),
    path.join(process.cwd(), 'server', 'freight-invoice', 'app.py'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

async function checkBackendHealth() {
  try {
    const response = await fetch(new URL('/health', backendBaseUrl()), { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

async function startLocalBackend() {
  if (!isLocalBackendTarget() || process.env.FREIGHT_INVOICE_DISABLE_AUTOSTART === '1') {
    return false
  }

  if (await checkBackendHealth()) {
    return true
  }

  if (!globalThis.__freightInvoiceStartupPromise) {
    globalThis.__freightInvoiceStartupPromise = (async () => {
      const appPath = localServiceAppPath()
      if (!appPath) {
        return false
      }

      const backendUrl = backendUrlObject()
      const dataDir = path.join(process.cwd(), 'data', 'freight-invoice-service')
      fs.mkdirSync(dataDir, { recursive: true })

      const child = spawn(
        process.env.FREIGHT_INVOICE_PYTHON || 'python',
        [appPath, '--host', backendUrl.hostname, '--port', backendUrl.port || '8765'],
        {
          cwd: path.dirname(appPath),
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          env: {
            ...process.env,
            FREIGHT_INVOICE_HOST: backendUrl.hostname,
            FREIGHT_INVOICE_DATA_DIR: dataDir,
            FREIGHT_INVOICE_NO_BROWSER: '1',
          },
        }
      )

      child.unref()

      const startedAt = Date.now()
      while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
        await delay(500)
        if (await checkBackendHealth()) {
          return true
        }
      }

      return false
    })().finally(() => {
      globalThis.__freightInvoiceStartupPromise = undefined
    })
  }

  return globalThis.__freightInvoiceStartupPromise
}

async function proxy(request: Request, path: string[]) {
  let upstream: Response

  try {
    upstream = await fetchUpstream(request, path)
  } catch (error) {
    const started = await startLocalBackend()
    if (started) {
      try {
        upstream = await fetchUpstream(request, path)
      } catch (retryError) {
        return NextResponse.json(
          {
            error: '货代发票服务暂时不可用',
            detail: retryError instanceof Error ? retryError.message : 'Unknown upstream error',
            backend: backendBaseUrl(),
            autoStarted: true,
          },
          { status: 502 }
        )
      }
    } else {
      return NextResponse.json(
        {
          error: '货代发票服务暂时不可用',
          detail: error instanceof Error ? error.message : 'Unknown upstream error',
          backend: backendBaseUrl(),
          autoStarted: false,
        },
        { status: 502 }
      )
    }
  }

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-length')
  responseHeaders.set('x-freight-invoice-proxy', 'nextjs')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
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
