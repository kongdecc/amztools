'use client'

import adConfig from '@/config/top-ad.json'

type Placement = 'sidebar' | 'detail-bottom'

export default function ImageAdSlot({ placement }: { placement: Placement }) {
  const config = adConfig.placements[placement]
  const imageUrl = config.imageUrl.trim()
  const linkUrl = config.linkUrl.trim()

  if (!config.enabled || !imageUrl) return null

  const image = (
    <picture>
      {'mobileImageUrl' in config && config.mobileImageUrl.trim() && (
        <source
          media="(max-width: 767px)"
          srcSet={config.mobileImageUrl.trim()}
          width={config.mobileImageWidth}
          height={config.mobileImageHeight}
        />
      )}
      <img
        src={imageUrl}
        alt={config.alt || '广告'}
        width={config.imageWidth}
        height={config.imageHeight}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full rounded-lg bg-white"
      />
    </picture>
  )

  return (
    <section
      aria-label={placement === 'sidebar' ? '侧边栏广告' : '工具详情底部广告'}
      className={placement === 'sidebar'
        ? 'hidden shrink-0 border-t border-gray-100 p-4 md:block'
        : 'mt-8 w-full rounded-xl border border-gray-100 bg-white p-3'}
    >
      {config.showLabel !== false && <div className="mb-2 text-[11px] text-gray-400">广告</div>}
      {linkUrl ? (
        <a
          href={linkUrl}
          target={config.openInNewTab ? '_blank' : '_self'}
          rel={config.openInNewTab ? 'sponsored noopener noreferrer' : 'sponsored'}
          className="block rounded-lg transition-opacity hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          {image}
        </a>
      ) : image}
    </section>
  )
}
