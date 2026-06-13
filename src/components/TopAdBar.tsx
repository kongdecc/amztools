'use client'

import topAdConfig from '@/config/top-ad.json'

type TopAdConfig = {
  enabled?: boolean
  type?: string
  text?: string
  imageUrl?: string
  linkUrl?: string
  alt?: string
  ctaText?: string
  openInNewTab?: boolean
  imageHeight?: number
}

function getNormalizedConfig(raw: TopAdConfig) {
  const type = String(raw.type || 'text').trim().toLowerCase()
  const text = String(raw.text || '').trim()
  const imageUrl = String(raw.imageUrl || '').trim()
  const linkUrl = String(raw.linkUrl || '').trim()
  const ctaText = String(raw.ctaText || '点击跳转').trim()
  const imageHeight = Number(raw.imageHeight)

  return {
    enabled: Boolean(raw.enabled),
    type: type === 'image' || type === 'text' || type === 'auto' ? type : 'auto',
    text,
    imageUrl,
    linkUrl,
    alt: String(raw.alt || '页眉下广告位').trim() || '页眉下广告位',
    ctaText: ctaText || '点击跳转',
    openInNewTab: raw.openInNewTab !== false,
    imageHeight: Number.isFinite(imageHeight) && imageHeight >= 80 ? imageHeight : 200
  }
}

export default function TopAdBar() {
  const config = getNormalizedConfig(topAdConfig)

  if (!config.enabled) return null

  const hasImage = Boolean(config.imageUrl)
  const isImageMode =
    config.type === 'image' ? hasImage :
    config.type === 'text' ? false :
    hasImage
  const hasLink = Boolean(config.linkUrl)
  const target = config.openInNewTab ? '_blank' : '_self'
  const rel = config.openInNewTab ? 'noopener noreferrer' : undefined
  const image = (
    <img
      src={config.imageUrl}
      alt={config.alt}
      className="block w-full rounded-md bg-white object-contain"
      style={{ maxHeight: `${config.imageHeight}px` }}
      loading="eager"
    />
  )

  return (
    <div className="w-full border-y border-orange-200 bg-orange-50">
      <div className="mx-auto max-w-screen-2xl px-3 py-2 text-orange-700 md:px-4">
        {isImageMode ? (
          hasLink ? (
            <a href={config.linkUrl} target={target} rel={rel} className="block overflow-hidden rounded-md transition-opacity hover:opacity-95">
              {image}
            </a>
          ) : (
            image
          )
        ) : hasLink ? (
          <a
            href={config.linkUrl}
            target={target}
            rel={rel}
            className="flex min-h-10 w-full flex-col items-center justify-center gap-1 text-center text-xs md:h-10 md:flex-row md:gap-2 md:text-sm"
          >
            <span className="font-medium whitespace-normal break-words md:truncate">{config.text}</span>
            <span className="shrink-0 rounded bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
              {config.ctaText} ↗
            </span>
          </a>
        ) : (
          <div className="flex min-h-10 w-full items-center justify-center text-center text-xs md:h-10 md:text-sm">
            <span className="font-medium whitespace-normal break-words">{config.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
