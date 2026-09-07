'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

import publishedSettings from '@/config/site-seo.json'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'

type SiteSettings = {
  siteName: string
  logoUrl: string
  faviconUrl?: string
  siteDescription: string
  siteKeywords: string
  analyticsHeadHtml?: string
  analyticsBodyHtml?: string
  copyrightText?: string
  homeHeroTitle?: string
  homeHeroSubtitle?: string
  hideHomeHeroIfEmpty?: string
  friendLinks?: string
  privacyPolicy?: string
  showFriendLinksLabel?: string
  aboutTitle?: string
  aboutContent?: string
  seoDescription?: string
  sitemapEnabled?: string
  robotsContent?: string
  robotsDisallowQuery?: string
  robotsDisallowAdmin?: string
  robotsDisallowPageParam?: string
  robotsDisallowUtmParams?: string
  functionalityTitle?: string
  functionalitySubtitle?: string
  homeCardLimit?: string
  googleVerification?: string
  baiduVerification?: string
}

type Ctx = {
  settings: SiteSettings
  loading: boolean
  refreshSettings: () => Promise<void>
}

const defaults: SiteSettings = {
  siteName: DEFAULT_SITE_SETTINGS.siteName,
  logoUrl: '',
  faviconUrl: '',
  siteDescription: DEFAULT_SITE_SETTINGS.siteDescription,
  siteKeywords: '工具箱, 广告计算, 文本处理',
  analyticsHeadHtml: '',
  analyticsBodyHtml: '',
  copyrightText: DEFAULT_SITE_SETTINGS.copyrightText,
  homeHeroTitle: '一站式图像与运营处理工具',
  homeHeroSubtitle: '轻松处理您的数据，提升工作效率',
  hideHomeHeroIfEmpty: 'false',
  friendLinks: '[]',
  privacyPolicy: DEFAULT_SITE_SETTINGS.privacyPolicy,
  showFriendLinksLabel: 'false',
  aboutTitle: '关于我们',
  aboutContent: DEFAULT_SITE_SETTINGS.aboutContent || '',
  seoDescription: '',
  sitemapEnabled: 'true',
  robotsContent: 'User-agent: *\nAllow: /',
  robotsDisallowQuery: 'true',
  robotsDisallowAdmin: 'true',
  robotsDisallowPageParam: 'true',
  robotsDisallowUtmParams: 'true',
  functionalityTitle: '功能中心',
  functionalitySubtitle: '探索我们提供的所有工具和功能，帮助您更高效地管理亚马逊业务',
  homeCardLimit: '6',
  googleVerification: '',
  baiduVerification: ''
}

const SettingsContext = createContext<Ctx | undefined>(undefined)

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Partial<SiteSettings> }) {
  const [settings, setSettings] = useState<SiteSettings>({ ...defaults, ...publishedSettings, ...initial })
  const [loading, setLoading] = useState(!initial)

  const fetchSettings = async () => {
    try {
      const isAdmin = window.location.pathname.startsWith('/admin')
      const r = await fetch(isAdmin ? '/api/settings' : '/api/published/settings', { cache: 'no-store' })
      if (r.ok) {
        const data = await r.json()
        setSettings({ ...defaults, ...data })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      if (!initial && window.location.pathname.startsWith('/admin')) {
        const raw = localStorage.getItem('settings_cache')
        if (raw) {
          const obj = JSON.parse(raw)
          if (obj && typeof obj === 'object') setSettings(prev => ({ ...prev, ...obj }))
        }
      }
    } catch {}
    if (!initial) fetchSettings()
  }, [])
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!window.location.pathname.startsWith('/admin')) return
      if (e.key === 'settings_updated') refreshSettings()
      if (e.key === 'settings_cache' && e.newValue) {
        try { const obj = JSON.parse(e.newValue); if (obj && typeof obj === 'object') setSettings(prev => ({ ...prev, ...obj })) } catch {}
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible' && window.location.pathname.startsWith('/admin')) refreshSettings() }
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const refreshSettings = async () => { setLoading(true); await fetchSettings() }

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) return { settings: { ...defaults, ...publishedSettings }, loading: false, refreshSettings: async () => {} }
  return ctx
}
