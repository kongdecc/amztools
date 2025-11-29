'use client'

import React, { useState } from 'react'

export default function RewardImage({ src, alt }: { src: string, alt: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="text-gray-400 text-sm">
        暂未配置打赏二维码
      </div>
    )
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className="max-w-full h-auto max-h-[400px] rounded shadow-sm"
      onError={() => setError(true)}
    />
  )
}
