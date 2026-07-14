'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ExternalLink, LayoutDashboard, MoreHorizontal } from 'lucide-react'
import TopAdBar from '@/components/TopAdBar'
import { useSettings } from '@/components/SettingsProvider'
import { DEFAULT_SITE_SETTINGS } from '@/lib/constants'

type Module = {
  key: string
  title: string
  desc: string
  status: string
  order: number
  category?: string
  href?: string
  isExternal?: boolean
}

type Category = {
  key: string
  label: string
  order?: number
  enabled?: boolean
}

type NavItem = {
  id?: string
  label?: string
  href?: string
  isExternal?: boolean
  active?: boolean
}

export default function AmazonCategorySelectionCenterClient({
  initialNavItems,
  initialCategories,
  initialModules,
  rawSrc
}: {
  initialNavItems: NavItem[]
  initialCategories: Category[]
  initialModules: Module[]
  rawSrc: string
}) {
  const router = useRouter()
  const { settings } = useSettings()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const categories = useMemo(
    () =>
      (initialCategories || [])
        .filter((item) => item.enabled !== false)
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [initialCategories]
  )

  const modules = useMemo(
    () =>
      (initialModules || [])
        .filter((item) => item.status !== '下架')
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    [initialModules]
  )

  const groupedModules = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          modules: modules.filter((module) => module.category === category.key)
        }))
        .filter((category) => category.modules.length > 0),
    [categories, modules]
  )

  const handleToolClick = (module: Module) => {
    if (module.href) {
      window.open(
        module.href,
        module.isExternal ? '_blank' : '_self',
        module.isExternal ? 'noopener,noreferrer' : undefined
      )
      return
    }

    router.push(`/functionality/${module.key}`)
  }

  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName
  const copyrightText = settings.copyrightText || DEFAULT_SITE_SETTINGS.copyrightText

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-4 md:px-10 shadow-md z-20 justify-between md:justify-start">
        <div className="flex items-center gap-2 font-bold text-lg min-w-0 flex-1">
          <div className="bg-white/20 p-1 rounded shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span className="truncate md:text-lg text-base">{siteName}</span>
        </div>

        <nav className="hidden md:flex ml-auto mr-6 items-center gap-6 shrink-0">
          <Link href="/" className="text-sm text-white/90 hover:text-white">
            首页
          </Link>
          {initialNavItems.map((item) => {
            const isFuncMenu =
              String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'

            if (isFuncMenu) {
              return (
                <div key={item.id || 'function-menu'} className="relative group">
                  <button
                    onClick={() => router.push('/functionality')}
                    className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {item.label || '功能分类'}
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </button>
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-[80vh] overflow-y-auto">
                    <div className="p-2 space-y-2">
                      {groupedModules.map((category) => (
                        <div key={category.key}>
                          <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">
                            {category.label}
                          </div>
                          {category.modules.map((module) =>
                            module.href ? (
                              <a
                                key={module.key}
                                href={module.href}
                                target={module.isExternal ? '_blank' : '_self'}
                                rel={module.isExternal ? 'noopener noreferrer' : undefined}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                              >
                                {module.title}
                              </a>
                            ) : (
                              <button
                                key={module.key}
                                onClick={() => handleToolClick(module)}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                              >
                                {module.title}
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }

            return item.isExternal ? (
              <a
                key={item.id}
                href={item.href || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/90 hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <a key={item.id} href={item.href || '/'} className="text-sm text-white/90 hover:text-white">
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="md:hidden flex items-center gap-3 shrink-0 ml-2">
          <div className="relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-white/10 rounded transition-colors"
            >
              <MoreHorizontal className="h-6 w-6 text-white" />
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-lg shadow-xl py-2 z-50 text-gray-800 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] overflow-y-auto">
                  <Link
                    href="/"
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-blue-600"
                  >
                    首页
                  </Link>
                  {initialNavItems.map((item) => {
                    const isFuncMenu =
                      String(item.label || '').includes('功能分类') ||
                      String(item.id || '') === 'functionality'
                    if (isFuncMenu) {
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setMobileMenuOpen(false)
                            router.push('/functionality')
                          }}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                        >
                          {item.label || '功能分类'}
                        </button>
                      )
                    }
                    if (item.isExternal) {
                      return (
                        <a
                          key={item.id}
                          href={item.href || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                        >
                          {item.label}
                        </a>
                      )
                    }
                    return (
                      <a
                        key={item.id}
                        href={item.href || '/'}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        {item.label}
                      </a>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <TopAdBar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-semibold">
                  运营工具
                </div>
                <h1 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900">
                  Amazon类目选品管理中心
                </h1>
                <p className="mt-3 text-slate-600 leading-7">
                  这里保留了原始工具的完整分类树、叶子清单和进度管理能力，并补上了站内统一的导航栏、广告区和页脚，方便从系统里直接进入使用。
                </p>
              </div>

              <a
                href={rawSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                新窗口直接打开原工具
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-100 p-3 md:p-4">
              <iframe
                title="Amazon类目选品管理中心"
                src={rawSrc}
                className="w-full h-[calc(100vh-220px)] min-h-[960px] rounded-xl bg-white"
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>{copyrightText}</div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              首页
            </Link>
            <Link href="/functionality" className="hover:text-slate-900 transition-colors">
              功能分类
            </Link>
            <Link href="/reward" className="hover:text-slate-900 transition-colors">
              打赏支持
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
