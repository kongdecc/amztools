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
  additionalImages?: TopAdImage[]
}

type TopAdImage = {
  imageUrl?: string
  linkUrl?: string
  alt?: string
  openInNewTab?: boolean
  imageHeight?: number
}

type NormalizedTopAdImage = {
  imageUrl: string
  linkUrl: string
  alt: string
  openInNewTab: boolean
  imageHeight: number
}

function normalizeImage(raw: TopAdImage, fallback: TopAdImage = {}): NormalizedTopAdImage {
  const imageHeight = Number(raw.imageHeight ?? fallback.imageHeight)

  return {
    imageUrl: String(raw.imageUrl || '').trim(),
    linkUrl: String(raw.linkUrl ?? fallback.linkUrl ?? '').trim(),
    alt: String(raw.alt ?? fallback.alt ?? '页眉下广告位').trim() || '页眉下广告位',
    openInNewTab: (raw.openInNewTab ?? fallback.openInNewTab) !== false,
    imageHeight: Number.isFinite(imageHeight) && imageHeight >= 80 ? imageHeight : 200
  }
}

function getNormalizedConfig(raw: TopAdConfig) {
  const type = String(raw.type || 'text').trim().toLowerCase()
  const text = String(raw.text || '').trim()
  const imageUrl = String(raw.imageUrl || '').trim()
  const linkUrl = String(raw.linkUrl || '').trim()
  const ctaText = String(raw.ctaText || '点击跳转').trim()
  const primaryImage = normalizeImage(raw)
  const additionalImages = Array.isArray(raw.additionalImages)
    ? raw.additionalImages.map(item => normalizeImage(item, raw)).filter(item => item.imageUrl)
    : []

  return {
    enabled: Boolean(raw.enabled),
    type: type === 'image' || type === 'text' || type === 'auto' ? type : 'auto',
    text,
    imageUrl,
    linkUrl,
    alt: String(raw.alt || '页眉下广告位').trim() || '页眉下广告位',
    ctaText: ctaText || '点击跳转',
    openInNewTab: raw.openInNewTab !== false,
    imageHeight: primaryImage.imageHeight,
    images: [primaryImage, ...additionalImages].filter(item => item.imageUrl)
  }
}

function ImageAd({ item, eager }: { item: NormalizedTopAdImage; eager: boolean }) {
  const image = (
    <img
      src={item.imageUrl}
      alt={item.alt}
      className="block h-auto w-full bg-white object-contain"
      style={{ maxHeight: `${item.imageHeight}px` }}
      loading={eager ? 'eager' : 'lazy'}
    />
  )

  return item.linkUrl ? (
    <a
      href={item.linkUrl}
      target={item.openInNewTab ? '_blank' : '_self'}
      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
      className="block w-full overflow-hidden transition-opacity hover:opacity-95"
    >
      {image}
    </a>
  ) : image
}

export default function TopAdBar() {
  const config = getNormalizedConfig(topAdConfig)

  if (!config.enabled) return null

  const hasImage = config.images.length > 0
  const isImageMode =
    config.type === 'image' ? hasImage :
    config.type === 'text' ? false :
    hasImage
  const hasLink = Boolean(config.linkUrl)
  const target = config.openInNewTab ? '_blank' : '_self'
  const rel = config.openInNewTab ? 'noopener noreferrer' : undefined
  // Image ads use a full-width container; the image itself still keeps its aspect ratio via w-full + h-auto.
  const innerClassName = isImageMode
    ? 'w-full py-2 text-orange-700'
    : 'mx-auto max-w-screen-2xl px-3 py-2 text-orange-700 md:px-4'
  return (
    <div className="w-full border-y border-orange-200 bg-orange-50">
      <div className={innerClassName}>
        {isImageMode ? (
          <div className="flex w-full flex-col gap-2">
            {config.images.map((item, index) => (
              <ImageAd key={`${item.imageUrl}-${index}`} item={item} eager={index === 0} />
            ))}
          </div>
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
