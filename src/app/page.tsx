import { SettingsProvider } from '@/components/SettingsProvider'
import HomeLayoutClient from './HomeClient'
import { db } from '@/lib/db'

export default async function Page() {
  let initialSettings: Record<string, any> = {}
  try {
    const rows = await (db as any).siteSettings.findMany()
    for (const r of rows as any) initialSettings[String((r as any).key)] = String((r as any).value ?? '')
  } catch {}
  let navItems: any[] = []
  try {
    const row = await (db as any).siteSettings.findUnique({ where: { key: 'navigation' } })
    const arr = row && (row as any).value ? JSON.parse(String((row as any).value)) : []
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
  let modules: any[] = []
  try {
    modules = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    if (!Array.isArray(modules) || modules.length === 0) {
      modules = [
        { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', views: 0, color: 'blue', order: 1 },
        { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器，支持一键复制源码', status: '启用', views: 0, color: 'indigo', order: 2 },
        { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', views: 0, color: 'cyan', order: 3 },
        { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', views: 0, color: 'violet', order: 4 },
        { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '维护', views: 0, color: 'sky', order: 5 },
        { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', views: 0, color: 'purple', order: 6 },
        { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '下架', views: 0, color: 'orange', order: 7 }
      ]
    }
  } catch {
    modules = [
      { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', views: 0, color: 'blue', order: 1 },
      { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器，支持一键复制源码', status: '启用', views: 0, color: 'indigo', order: 2 },
      { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', views: 0, color: 'cyan', order: 3 },
      { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', views: 0, color: 'violet', order: 4 },
      { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '维护', views: 0, color: 'sky', order: 5 },
      { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', views: 0, color: 'purple', order: 6 },
      { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '下架', views: 0, color: 'orange', order: 7 }
    ]
  }
  return (
    <SettingsProvider initial={initialSettings}>
      <HomeLayoutClient initialModules={modules} initialNavItems={navItems} />
    </SettingsProvider>
  )
}