import { SettingsProvider } from '@/components/SettingsProvider'
import HomeLayoutClient from './HomeClient'
import { db } from '@/lib/db'
import { Suspense } from 'react'
export const revalidate = 0

export default async function Page({ searchParams }: { searchParams?: Record<string, string> }) {
  const settingsPromise = (db as any).siteSettings.findMany().catch(() => [])
  const navPromise = (db as any).siteSettings.findUnique({ where: { key: 'navigation' } }).catch(() => null)
  const modulesPromise = (db as any).toolModule.findMany({ orderBy: { order: 'asc' } }).catch(() => [])
  const categoriesPromise = (db as any).toolCategory.findMany({ where: { enabled: true }, orderBy: { order: 'asc' } }).catch(() => [])

  const [settingsRows, navRow, modulesRows, categoriesRows] = await Promise.all([
    settingsPromise,
    navPromise,
    modulesPromise,
    categoriesPromise
  ])

  // Auto-seed for image-compression if missing
  if (Array.isArray(modulesRows) && !modulesRows.some((m: any) => m.key === 'image-compression')) {
    try {
      const existing = await (db as any).toolModule.findUnique({ where: { key: 'image-compression' } })
      if (!existing) {
        await (db as any).toolModule.create({
          data: {
            key: 'image-compression',
            title: '图片压缩与格式转换',
            desc: '批量压缩、格式转换，本地处理不上传服务器',
            status: '启用',
            views: 0,
            color: 'blue',
            order: 14,
            category: 'image-text'
          }
        })
      }
      const existingCat = await (db as any).toolCategory.findUnique({ where: { key: 'image-text' } })
      if (!existingCat) {
        await (db as any).toolCategory.create({
          data: { key: 'image-text', label: '图片文本', order: 3, enabled: true }
        })
      }
    } catch (e) {
      console.error('Auto-seed failed:', e)
    }
  }

  let initialSettings: Record<string, any> = {}
  try {
    for (const r of settingsRows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}

  let navItems: any[] = []
  try {
    const arr = navRow && (navRow as any).value ? JSON.parse(String((navRow as any).value)) : []
    navItems = Array.isArray(arr) && arr.length > 0 ? arr : [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  } catch {
    navItems = [
      { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
      { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
      { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
    ]
  }

  let modules: any[] = modulesRows
  try {
    const ensure = (arr: any[]) => {
      const keys = new Set(arr.map((x: any) => x.key))
      const need = [
        { key: 'cpc-compass', title: 'CPC利润测算', desc: '集成FBA费率、佣金计算，精准推导盈亏平衡CPC及ACOS', status: '启用', views: 0, color: 'blue', order: 1.5, category: 'advertising' },
        { key: 'amazon-promotion-stacking', title: '亚马逊促销叠加计算器', desc: '自动计算促销叠加或互斥，基于2025版《各类促销叠加情况》矩阵表逻辑', status: '启用', views: 0, color: 'blue', order: 1.8, category: 'operation' },
        { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '启用', views: 0, color: 'orange', order: 7 },
        { key: 'returns-v2', title: '退货报告分析V2', desc: '上传退货报告，原因/趋势/仓库/评论多维分析', status: '启用', views: 0, color: 'blue', order: 8 },
        { key: 'image-compression', title: '图片压缩与格式转换', desc: '批量压缩、格式转换，本地处理不上传服务器', status: '启用', views: 0, color: 'blue', order: 14, category: 'image-text' }
      ]
      const merged = arr.slice()
      for (const d of need) if (!keys.has(d.key)) merged.push(d)
      return merged
    }
    modules = ensure(Array.isArray(modules) ? modules : [])
    if (!Array.isArray(modules) || modules.length === 0) {
      // Fallback modules list (kept same as original)
      modules = [
        { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', views: 0, color: 'blue', order: 1, category: 'advertising' },
        { key: 'cpc-compass', title: 'CPC利润测算', desc: '集成FBA费率、佣金计算，精准推导盈亏平衡CPC及ACOS', status: '启用', views: 0, color: 'blue', order: 1.5, category: 'advertising' },
        { key: 'amazon-promotion-stacking', title: '亚马逊促销叠加计算器', desc: '自动计算促销叠加或互斥，基于2025版《各类促销叠加情况》矩阵表逻辑', status: '启用', views: 0, color: 'blue', order: 1.8, category: 'advertising' },
        { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器，支持一键复制源码', status: '启用', views: 0, color: 'indigo', order: 2 },
          { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', views: 0, color: 'cyan', order: 3 },
          { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', views: 0, color: 'violet', order: 4 },
          { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '维护', views: 0, color: 'sky', order: 5 },
          { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', views: 0, color: 'purple', order: 6 },
          { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '启用', views: 0, color: 'orange', order: 7 },
          { key: 'returns-v2', title: '退货报告分析V2', desc: '上传退货报告，原因/趋势/仓库/评论多维分析', status: '启用', views: 0, color: 'blue', order: 8 },
          { key: 'forbidden-words', title: '亚马逊文案违禁词检测', desc: '检测亚马逊文案中的违禁词，支持自定义词库和批量替换', status: '启用', views: 0, color: 'red', order: 9 },
          { key: 'text-compare', title: '文本比较工具', desc: '对比两个文本的差异，显示新增、删除和修改内容，支持详细统计分析', status: '启用', views: 0, color: 'green', order: 10 },
          { key: 'duplicate-remover', title: '去除重复文本工具', desc: '智能去重，多种模式，支持按行、空格、逗号等分隔符，支持排序和过滤', status: '启用', views: 0, color: 'purple', order: 11 },
          { key: 'content-filter', title: '英文文本过滤工具', desc: '智能筛选和删除英文文本中的介词、连词、冠词等无实际意义的词汇', status: '启用', views: 0, color: 'teal', order: 12 },
          { key: 'image-resizer', title: '图片尺寸修改工具', desc: '批量修改图片尺寸、格式转换和压缩，支持JPEG/PNG/GIF', status: '启用', views: 0, color: 'indigo', order: 14, category: 'image-text' },
          { key: 'invoice-generator', title: '发票生成工具', desc: '在线生成和打印发票，支持多币种、自定义Logo，可导出PDF', status: '启用', views: 0, color: 'cyan', order: 15, category: 'operation' },
          { key: 'amazon-global', title: '亚马逊批量查询', desc: '关键词排名监控与ASIN全球跟卖侦查，支持多站点一键打开', status: '启用', views: 0, color: 'orange', order: 16, category: 'operation' }
        ]
    }
  } catch {
    modules = [
      { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', views: 0, color: 'blue', order: 1, category: 'advertising' },
      { key: 'cpc-compass', title: 'CPC利润测算', desc: '集成FBA费率、佣金计算，精准推导盈亏平衡CPC及ACOS', status: '启用', views: 0, color: 'blue', order: 1.5, category: 'advertising' },
      { key: 'amazon-promotion-stacking', title: '亚马逊促销叠加计算器', desc: '自动计算促销叠加或互斥，基于2025版《各类促销叠加情况》矩阵表逻辑', status: '启用', views: 0, color: 'blue', order: 1.8, category: 'operation' },
      { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器，支持一键复制源码', status: '启用', views: 0, color: 'indigo', order: 2 },
      { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', views: 0, color: 'cyan', order: 3 },
      { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', views: 0, color: 'violet', order: 4 },
      { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '维护', views: 0, color: 'sky', order: 5 },
      { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', views: 0, color: 'purple', order: 6 },
      { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '启用', views: 0, color: 'orange', order: 7 },
      { key: 'returns-v2', title: '退货报告分析V2', desc: '上传退货报告，原因/趋势/仓库/评论多维分析', status: '启用', views: 0, color: 'blue', order: 8 },
      { key: 'forbidden-words', title: '亚马逊文案违禁词检测', desc: '检测亚马逊文案中的违禁词，支持自定义词库和批量替换', status: '启用', views: 0, color: 'red', order: 9 },
      { key: 'text-compare', title: '文本比较工具', desc: '对比两个文本的差异，显示新增、删除和修改内容，支持详细统计分析', status: '启用', views: 0, color: 'green', order: 10 },
      { key: 'duplicate-remover', title: '去除重复文本工具', desc: '智能去重，多种模式，支持按行、空格、逗号等分隔符，支持排序和过滤', status: '启用', views: 0, color: 'purple', order: 11 },
      { key: 'content-filter', title: '英文文本过滤工具', desc: '智能筛选和删除英文文本中的介词、连词、冠词等无实际意义的词汇', status: '启用', views: 0, color: 'teal', order: 12 },
      { key: 'image-resizer', title: '图片尺寸修改工具', desc: '批量修改图片尺寸、格式转换和压缩，支持JPEG/PNG/GIF', status: '启用', views: 0, color: 'indigo', order: 13 },
      { key: 'image-compression', title: '图片压缩与格式转换', desc: '批量压缩、格式转换，本地处理不上传服务器', status: '启用', views: 0, color: 'blue', order: 13.5 },
      { key: 'invoice-generator', title: '发票生成工具', desc: '在线生成和打印发票，支持多币种、自定义Logo，可导出PDF', status: '启用', views: 0, color: 'cyan', order: 14 },
      { key: 'amazon-global', title: '亚马逊批量查询', desc: '关键词排名监控与ASIN全球跟卖侦查，支持多站点一键打开', status: '启用', views: 0, color: 'orange', order: 15 }
    ]
  }

  let categories = categoriesRows
  if (!categories || categories.length === 0) {
    categories = [
      { key: 'operation', label: '运营工具', enabled: true },
      { key: 'advertising', label: '广告工具', enabled: true },
      { key: 'image-text', label: '图片文本', enabled: true }
    ]
  }

  // Ensure "Functionality" menu item exists
  const hasFuncMenu = navItems.some((item: any) => String(item.label || '').includes('功能分类') || String(item.id || '') === 'functionality')
  if (!hasFuncMenu) {
    navItems.splice(0, 0, { id: 'functionality', label: '功能分类', order: 0, children: [] })
  }

  const initialActiveTab = String(searchParams?.tab || '')
  const initialFull = String(searchParams?.full || '') === '1'
  return (
    <SettingsProvider initial={initialSettings}>
      <Suspense fallback={null}>
        <HomeLayoutClient initialModules={modules} initialNavItems={navItems} initialActiveTab={initialActiveTab} initialFull={initialFull} initialCategories={categories} />
      </Suspense>
    </SettingsProvider>
  )
}
