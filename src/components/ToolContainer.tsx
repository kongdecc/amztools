'use client'

import React, { memo } from 'react'
import dynamic from 'next/dynamic'
import { Hammer } from 'lucide-react'

// Loading component
const LoadingTool = () => <div className="p-8 text-center text-gray-500">正在加载工具...</div>

// Dynamic imports
const EditorPage = dynamic(() => import('./EditorPage'), { loading: LoadingTool })
const FBACalculatorPage = dynamic(() => import('./FBACalculator'), { loading: LoadingTool })
const ForbiddenWordsChecker = dynamic(() => import('@/components/ForbiddenWordsChecker'), { loading: LoadingTool })
const TextComparator = dynamic(() => import('./TextComparator'), { loading: LoadingTool })
const DuplicateRemover = dynamic(() => import('./DuplicateRemover'), { loading: LoadingTool })
const ContentFilter = dynamic(() => import('./ContentFilter'), { loading: LoadingTool })
const ImageResizer = dynamic(() => import('@/components/ImageResizer'), { loading: LoadingTool })
const InvoiceGenerator = dynamic(() => import('@/components/InvoiceGenerator'), { loading: LoadingTool })
const CpcCalculator = dynamic(() => import('@/components/CpcCalculator'), { loading: LoadingTool })
const AmazonGlobalTool = dynamic(() => import('@/components/AmazonGlobalTool'), { loading: LoadingTool })
const AmazonRatingSalesReverse = dynamic(() => import('@/components/AmazonRatingSalesReverse'), { loading: LoadingTool })
const ListingCheckerPage = dynamic(() => import('@/components/ListingCheckerPage'), { loading: LoadingTool })
const ReturnsV2Page = dynamic(() => import('@/components/ReturnsV2Page'), { loading: LoadingTool })
const AdCalculatorPage = dynamic(() => import('@/components/AdCalculatorPage'), { loading: LoadingTool })
const UnitConverterPage = dynamic(() => import('@/components/UnitConverterPage'), { loading: LoadingTool })
const CaseConverterPage = dynamic(() => import('@/components/CaseConverterPage'), { loading: LoadingTool })
const WordCountPage = dynamic(() => import('@/components/WordCountPage'), { loading: LoadingTool })
const CharCountPage = dynamic(() => import('@/components/CharCountPage'), { loading: LoadingTool })
const MaxReserveFeeCalculator = dynamic(() => import('@/components/MaxReserveFeeCalculator'), { loading: LoadingTool })
const KeywordStrategyTool = dynamic(() => import('@/components/KeywordStrategyTool'), { loading: LoadingTool })
const SearchTermVolatilityTool = dynamic(() => import('@/components/SearchTermVolatilityTool'), { loading: LoadingTool })
const PartnerEquityCalculator = dynamic(() => import('@/components/PartnerEquityCalculator'), { loading: LoadingTool })
const CartonCalculatorAdvanced = dynamic(() => import('@/components/CartonCalculatorAdvanced'), { loading: LoadingTool })
const PinyinConverter = dynamic(() => import('@/components/PinyinConverter'), { loading: LoadingTool })
const NaturalTrafficTool = dynamic(() => import('@/components/NaturalTrafficTool'), { loading: LoadingTool })
const AmazonPromotionStackingCalculator = dynamic(() => import('@/components/AmazonPromotionStackingCalculator'), { loading: LoadingTool })
const KeywordCombiner = dynamic(() => import('@/components/KeywordCombiner'), { loading: LoadingTool })
const FBAWarehouses = dynamic(() => import('@/components/FBAWarehouses'), { loading: LoadingTool })
const FBALabelEditor = dynamic(() => import('@/components/FBALabelEditor'), { loading: LoadingTool })
const ImageCompressionPage = dynamic(() => import('@/components/ImageCompressionPage'), { loading: LoadingTool })
const StorageFeeCalculatorPage = dynamic(() => import('@/components/StorageFeeCalculatorPage'), { loading: LoadingTool })

const PlaceholderPage = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-6 w-6 text-gray-400" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 border-dashed rounded-xl border-2 border-gray-200">
      <div className="p-6 bg-white rounded-full shadow-sm mb-6">
        <Hammer className="h-12 w-12 text-indigo-200" />
      </div>
      <h3 className="text-lg font-medium text-gray-600 mb-2">功能开发中</h3>
      <p className="text-sm text-gray-400 max-w-xs text-center">这个工具模块正在紧锣密鼓地开发中，<br/>请稍后回来查看更新。</p>
    </div>
  </div>
)

const ToolContainer = memo(({ activeTab }: { activeTab: string }) => {
  switch (activeTab) {
    case 'ad-calc': return <AdCalculatorPage />
    case 'cpc-compass': return <CpcCalculator />
    case 'unit': return <UnitConverterPage />
    case 'editor': return <EditorPage />
    case 'case': return <CaseConverterPage />
    case 'word-count': return <WordCountPage />
    case 'char-count': return <CharCountPage />
    case 'delivery': return <FBACalculatorPage />
    case 'returns-v2': return <ReturnsV2Page />
    case 'listing-check': return <ListingCheckerPage />
    case 'forbidden-words': return <ForbiddenWordsChecker />
    case 'text-compare': return <TextComparator />
    case 'duplicate-remover': return <DuplicateRemover />
    case 'content-filter': return <ContentFilter />
    case 'image-resizer': return <ImageResizer />
    case 'invoice-generator': return <InvoiceGenerator />
    case 'amazon-global': return <AmazonGlobalTool />
    case 'rating-sales-reverse': return <AmazonRatingSalesReverse />
    case 'max-reserve-fee': return <MaxReserveFeeCalculator />
    case 'keyword-strategy': return <KeywordStrategyTool />
    case 'search-term-volatility': return <SearchTermVolatilityTool />
    case 'partner-equity-calculator': return <PartnerEquityCalculator />
    case 'carton-calc-advanced': return <CartonCalculatorAdvanced />
    case 'pinyin-converter': return <PinyinConverter />
    case 'natural-traffic-tool': return <NaturalTrafficTool />
    case 'keyword-combiner': return <KeywordCombiner />
    case 'fba-warehouses': return <FBAWarehouses />
    case 'fba-label-editor': return <FBALabelEditor />
    case 'image-compression': return <ImageCompressionPage />
    case 'amazon-promotion-stacking': return <AmazonPromotionStackingCalculator />
    case 'storage-fee-calc': return <StorageFeeCalculatorPage />
    default: return <PlaceholderPage title="功能开发中" icon={Hammer} />
  }
})

ToolContainer.displayName = 'ToolContainer'

export default ToolContainer
