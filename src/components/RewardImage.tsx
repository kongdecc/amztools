'use client'

import React, { useState, useEffect } from 'react'

export default function RewardImage({ src, alt }: { src: string, alt: string }) {
  const [error, setError] = useState(false)
  const [imgSrc, setImgSrc] = useState<string>('')

  useEffect(() => {
    // Check cache first
    try {
      const cached = localStorage.getItem('reward_qr_cache')
      const cachedTs = localStorage.getItem('reward_qr_ts')
      if (cached && cachedTs && Date.now() - Number(cachedTs) < 3600000) { // Cache for 1 hour
        setImgSrc(cached)
        return
      }
    } catch {}

    // Fetch and cache if not cached
    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error('Load failed')
        return res.blob()
      })
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          setImgSrc(base64)
          try {
            localStorage.setItem('reward_qr_cache', base64)
            localStorage.setItem('reward_qr_ts', String(Date.now()))
          } catch {}
        }
        reader.readAsDataURL(blob)
      })
      .catch(() => {
        // Fallback to direct URL if fetch/cache fails, let img tag handle it
        setImgSrc(src)
      })
  }, [src])

  if (error) {
    return (
      <div className="text-gray-400 text-sm">
        暂未配置打赏二维码
      </div>
    )
  }

  if (!imgSrc) return <div className="w-32 h-32 bg-gray-100 animate-pulse rounded" />

  return (
    <img 
      src={imgSrc} 
      alt={alt} 
      className="max-w-full h-auto max-h-[300px] w-[300px] object-contain rounded shadow-sm"
      onError={() => setError(true)}
    />
  )
}
