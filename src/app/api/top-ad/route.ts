import { NextResponse } from 'next/server'

import topAdConfig from '@/config/top-ad.json'

export async function GET() {
  return NextResponse.json(topAdConfig, {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}
