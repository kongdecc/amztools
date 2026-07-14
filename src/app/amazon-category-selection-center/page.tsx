import type { Metadata } from 'next'
import AmazonCategorySelectionCenterClient from './AmazonCategorySelectionCenterClient'
import {
  getEnabledFunctionalityShellData,
  getFunctionalityMetadataSettings
} from '@/lib/functionality-data'

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await getFunctionalityMetadataSettings()

  return {
    title: `Amazon类目选品管理中心 - ${metadata.siteName}`,
    description: 'Amazon 类目选品管理中心，支持分类树浏览、叶子节点清单和选品评估进度管理。'
  }
}

export default async function AmazonCategorySelectionCenterPage() {
  const { navItems, categories, modules } = await getEnabledFunctionalityShellData()

  return (
    <AmazonCategorySelectionCenterClient
      initialNavItems={navItems}
      initialCategories={categories}
      initialModules={modules}
      rawSrc="/amazon-category-selection-center/raw"
    />
  )
}
