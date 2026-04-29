'use client'

import { useEffect, useMemo, useState } from 'react'

import promoConfig from '@/config/promo-popup.json'

type PromoConfig = {
  enabled?: boolean
  imageUrl?: string
  linkUrl?: string
  alt?: string
  autoCloseSeconds?: number
  hideForHours?: number
  backdropClose?: boolean
  showCloseButton?: boolean
  startAt?: string
  endAt?: string
  version?: string
}

const STORAGE_PREFIX = 'global_promo_popup'

function parseOptionalDateTime(value?: string) {
  const raw = String(value || '').trim()
  if (!raw) return undefined

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const parsed = Date.parse(normalized)

  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function getNormalizedConfig(raw: PromoConfig) {
  const imageUrl = String(raw.imageUrl || '').trim()
  const linkUrl = String(raw.linkUrl || '').trim()
  const autoCloseSeconds = Number(raw.autoCloseSeconds)
  const hideForHours = Number(raw.hideForHours)
  const startAt = parseOptionalDateTime(raw.startAt)
  const endAt = parseOptionalDateTime(raw.endAt)

  return {
    enabled: Boolean(raw.enabled) && imageUrl.length > 0,
    imageUrl,
    linkUrl,
    alt: String(raw.alt || '宣传活动'),
    autoCloseSeconds: Number.isFinite(autoCloseSeconds) && autoCloseSeconds > 0 ? autoCloseSeconds : 120,
    hideForHours: Number.isFinite(hideForHours) && hideForHours >= 0 ? hideForHours : 12,
    backdropClose: raw.backdropClose !== false,
    showCloseButton: raw.showCloseButton !== false,
    startAt,
    endAt,
    version: String(raw.version || 'default')
  }
}

export default function GlobalPromoPopup() {
  const config = useMemo(() => getNormalizedConfig(promoConfig), [])
  const [open, setOpen] = useState(false)

  const isWithinSchedule = useMemo(() => {
    const now = Date.now()
    if (typeof config.startAt === 'number' && now < config.startAt) return false
    if (typeof config.endAt === 'number' && now > config.endAt) return false
    return true
  }, [config])

  useEffect(() => {
    if (!config.enabled || !isWithinSchedule) return

    const dismissKey = `${STORAGE_PREFIX}:${config.version}`

    try {
      const raw = window.localStorage.getItem(dismissKey)
      if (raw) {
        const expiresAt = Number(raw)
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return
        window.localStorage.removeItem(dismissKey)
      }
    } catch {}

    setOpen(true)
  }, [config, isWithinSchedule])

  useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      dismiss('auto')
    }, config.autoCloseSeconds * 1000)

    return () => window.clearTimeout(timer)
  }, [config.autoCloseSeconds, open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss('manual')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, config.version, config.hideForHours])

  const dismiss = (_reason: 'manual' | 'auto') => {
    const dismissKey = `${STORAGE_PREFIX}:${config.version}`
    const expiresAt = Date.now() + config.hideForHours * 60 * 60 * 1000

    try {
      window.localStorage.setItem(dismissKey, String(expiresAt))
    } catch {}

    setOpen(false)
  }

  if (!open) return null

  const image = (
    <img
      src={config.imageUrl}
      alt={config.alt}
      className="block max-h-[80vh] w-full rounded-2xl object-contain shadow-2xl"
      loading="eager"
    />
  )

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-[2px]"
      aria-hidden={!open}
      onClick={() => {
        if (config.backdropClose) dismiss('manual')
      }}
    >
      <div
        className="relative w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-label={config.alt}
        onClick={(event) => event.stopPropagation()}
      >
        {config.showCloseButton && (
          <button
            type="button"
            onClick={() => dismiss('manual')}
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-2xl leading-none text-white transition hover:bg-black/85"
            aria-label="关闭宣传弹窗"
          >
            ×
          </button>
        )}

        {config.linkUrl ? (
          <a
            href={config.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            onClick={() => dismiss('manual')}
          >
            {image}
          </a>
        ) : (
          image
        )}
      </div>
    </div>
  )
}
