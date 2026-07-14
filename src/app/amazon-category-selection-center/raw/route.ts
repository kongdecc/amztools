import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SOURCE_FILE = 'Amazon类目选品管理中心.html'

export async function GET() {
  const sourcePath = path.join(process.cwd(), SOURCE_FILE)

  try {
    const html = await fs.readFile(sourcePath, 'utf8')
    return new NextResponse(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate'
      }
    })
  } catch (error) {
    console.error(`Failed to read ${SOURCE_FILE}`, error)
    return new NextResponse(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amazon类目选品管理中心</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
    .card { max-width: 560px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0; line-height: 1.7; color: #475569; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Amazon类目选品管理中心暂时不可用</h1>
      <p>没有读取到源文件 <code>${SOURCE_FILE}</code>，请确认该文件仍位于项目根目录后再试。</p>
    </div>
  </div>
</body>
</html>`,
      {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      }
    )
  }
}
