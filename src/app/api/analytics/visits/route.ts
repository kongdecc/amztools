import { NextResponse } from 'next/server'

export async function POST(_request: Request) {
  try {
    return NextResponse.json({ success: true, disabled: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}

export async function GET(_request: Request) {
  try {
    return NextResponse.json({ total: 0, byModule: {} })
  } catch {
    return NextResponse.json({ total: 0, byModule: {} })
  }
}
