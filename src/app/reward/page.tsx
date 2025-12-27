import { db } from '@/lib/db'
import { Metadata } from 'next'
import { LayoutDashboard, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import RewardImage from '@/components/RewardImage'
import { DEFAULT_NAV_ITEMS, DEFAULT_TOOLS, DEFAULT_CATEGORIES, DEFAULT_SITE_SETTINGS } from '@/lib/constants'

export const revalidate = 0

export const metadata: Metadata = {
  title: '打赏支持',
  description: '如果您觉得本工具箱对您有帮助，欢迎打赏支持！'
}

async function getSettings() {
  try {
    let settings: any = {}
    try {
      const rows = await (db as any).siteSettings.findMany()
      for (const r of rows as any) settings[String((r as any).key)] = String((r as any).value ?? '')
    } catch (e) {
      console.error('Error fetching site settings:', e)
    }
    
    // Get navigation
    let navItems: any[] = []
    try {
      const navRow = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
      const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
      navItems = Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_NAV_ITEMS
    } catch {
      navItems = DEFAULT_NAV_ITEMS
    }
    
    // Ensure "Functionality" menu item exists
    const hasFuncMenu = navItems.some((item: any) => String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality')
    if (!hasFuncMenu) {
      navItems.splice(0, 0, { id: 'functionality', label: '功能分类', order: 0, children: [] })
    }

    let modules: any[] = []
    let categories: any[] = []
    try {
      modules = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
      categories = await (db as any).toolCategory.findMany({ orderBy: { order: 'asc' } })
      if (categories.length === 0) {
        categories = DEFAULT_CATEGORIES
      }
      
      // Merge logic for modules
      const ensure = (arr: any[]) => {
        const keys = new Set(arr.map((x: any) => x.key))
        const merged = arr.slice()
        for (const d of DEFAULT_TOOLS) if (!keys.has(d.key)) merged.push(d)
        return merged
      }
      modules = ensure(Array.isArray(modules) ? modules : [])
      
      // Force override status for 'word-count' if it is '维护'
      modules = modules.map((m: any) => {
        if (m.key === 'word-count' && m.status === '维护') {
          return { ...m, status: '启用' }
        }
        return m
      })

    } catch (e) {
      console.error('Error fetching modules/categories:', e)
      categories = DEFAULT_CATEGORIES
      modules = DEFAULT_TOOLS
    }

    return {
      siteName: settings.siteName || DEFAULT_SITE_SETTINGS.siteName,
      copyrightText: settings.copyrightText || DEFAULT_SITE_SETTINGS.copyrightText,
      friendLinks: settings.friendLinks || '[]',
      showFriendLinksLabel: String(settings.showFriendLinksLabel || 'false') === 'true',
      rewardDescription: settings.rewardDescription || '如果您觉得本工具箱对您有帮助，欢迎打赏支持我们继续维护和开发！',
      navItems,
      modules,
      categories
    }
  } catch (e) {
    console.error('Critical error in getSettings:', e)
    return {
      siteName: DEFAULT_SITE_SETTINGS.siteName,
      copyrightText: DEFAULT_SITE_SETTINGS.copyrightText,
      friendLinks: '[]',
      showFriendLinksLabel: false,
      rewardDescription: '如果您觉得本工具箱对您有帮助，欢迎打赏支持我们继续维护和开发！',
      navItems: DEFAULT_NAV_ITEMS,
      modules: DEFAULT_TOOLS,
      categories: DEFAULT_CATEGORIES
    }
  }
}

function hasRewardQr() {
  return true // We check dynamically via API now since data is in DB
}

export default async function RewardPage() {
  const { siteName, copyrightText, friendLinks, showFriendLinksLabel, rewardDescription, navItems, modules, categories } = await getSettings()
  const hasQr = hasRewardQr()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-4 md:px-10 shadow-md z-20 sticky top-0">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{siteName}</span>
        </Link>
        <nav className="ml-auto hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm text-white/90 hover:text-white cursor-pointer">首页</Link>
          {navItems
            .slice()
            .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
            .map((item: any) => {
              const isFuncMenu = String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality'
              const hasChildren = Array.isArray(item.children) && item.children.length > 0
              
              if (isFuncMenu) {
                return (
                  <div key={item.id || 'function-menu'} className="relative group">
                    <Link href="/functionality" className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                      {item.label || '功能分类'}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </Link>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-[80vh] overflow-y-auto">
                      <div className="p-2 space-y-2">
                        {categories.map((cat: any) => {
                          const catModules = modules.filter((m: any) => m.status !== '下架' && (m.category === cat.key || (!m.category && cat.key === 'image-text')))
                          if (catModules.length === 0) return null
                          return (
                            <div key={cat.key}>
                              <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase">{cat.label}</div>
                              {catModules.map((m: any) => (
                                <Link 
                                  key={m.key}
                                  href={`/?tab=${m.key}`}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                                >
                                  {m.title}
                                </Link>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              }
              
              if (hasChildren) {
                return (
                  <div key={item.id} className="relative group">
                    <button className="text-sm text-white/90 hover:text-white flex items-center gap-1 cursor-pointer">
                      {item.label}
                      <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    </button>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                      <div className="p-2 space-y-1">
                        {item.children.map((c: any) => (
                          c.isExternal ? (
                            <a key={c.id} href={c.href || '#'} target="_blank" rel="noopener noreferrer" className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                              {c.label}
                            </a>
                          ) : (
                            <Link key={c.id} href={c.href || '#'} className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                              {c.label}
                            </Link>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              return item.isExternal ? (
                <a key={item.id} href={item.href || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </a>
              ) : (
                <Link key={item.id} href={item.href || '#'} className="text-sm text-white/90 hover:text-white">
                  {item.label}
                </Link>
              )
            })}
        </nav>
      </header>

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
          <div className="p-8 text-center">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-4">打赏支持</div>
            <h1 className="block mt-1 text-lg leading-tight font-medium text-black mb-6">感谢您的支持与鼓励</h1>
            
            <p className="mt-2 text-gray-500 mb-8 whitespace-pre-wrap">
              {rewardDescription}
            </p>

            <div className="flex justify-center items-center bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300 min-h-[200px]">
               <RewardImage src="/api/reward-qr" alt="打赏二维码" />
            </div>
            
            <div className="mt-8">
              <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                &larr; 返回首页
              </Link>
            </div>
          </div>
        </div>
      </main>

      <div className="mt-auto text-center py-6 bg-white border-t border-gray-100">
        <footer className="text-xs text-gray-400">
          {copyrightText}
          <span className="mx-2">|</span>
          <Link href="/privacy" className="hover:text-blue-600">隐私说明</Link>
        </footer>
        {(() => {
          try {
            const arr = JSON.parse(String(friendLinks))
            const list = Array.isArray(arr) ? arr : []
            if (list.length === 0) return null
            return (
              <div className="mt-2 text-xs text-gray-500">
                {showFriendLinksLabel && <span>友情链接： </span>}
                {list
                  .slice()
                  .sort((a: any, b: any) => (Number(a.order || 0) - Number(b.order || 0)))
                  .map((l: any, i: number) => (
                    <span key={i}>
                      <a href={l.href || '#'} target={l.isExternal ? '_blank' : '_self'} rel={l.isExternal ? 'noopener noreferrer' : undefined} className="hover:text-blue-600">
                        {l.label || '友链'}
                      </a>
                      {i < list.length - 1 ? ', ' : ''}
                    </span>
                  ))}
              </div>
            )
          } catch { return null }
        })()}
      </div>
    </div>
  )
}
