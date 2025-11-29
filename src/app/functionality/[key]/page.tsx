'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { SettingsProvider, useSettings } from '@/components/SettingsProvider'
import EditorPage from '@/components/EditorPage'
import FBACalculatorPage from '@/components/FBACalculator'
import ForbiddenWordsChecker from '@/components/ForbiddenWordsChecker'
import TextComparator from '@/components/TextComparator'
import DuplicateRemover from '@/components/DuplicateRemover'
import ContentFilter from '@/components/ContentFilter'

const DetailClient = () => {
  const { key } = useParams<{ key: string }>()
  const { settings } = useSettings()

  const renderTool = () => {
    switch (key) {
      case 'delivery':
        return <FBACalculatorPage />
      case 'editor':
        return <EditorPage />
      case 'forbidden-words':
        return <ForbiddenWordsChecker />
      case 'text-compare':
        return <TextComparator />
      case 'duplicate-remover':
        return <DuplicateRemover />
      case 'content-filter':
        return <ContentFilter />
      default:
        return (
          <div className="bg-white p-6 rounded-xl border">
            <p className="text-gray-600">该功能的独立详情页暂未提供，请从首页进入。</p>
            <div className="mt-3 text-sm">
              <Link href={`/?tab=${key}`} className="text-blue-600 hover:underline">从首页打开该功能</Link>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-[#5b5bd6] text-white flex items-center px-10 shadow-md z-20">
        <div className={`flex items-center gap-2 font-bold text-lg`}>
          <div className="bg-white/20 p-1 rounded"><LayoutDashboard className="h-5 w-5" /></div>
          <span>{settings.siteName}</span>
        </div>
        <nav className="ml-auto mr-6 flex items-center gap-6">
          <Link href="/functionality" className="text-sm text-white/90 hover:text-white">功能中心</Link>
        </nav>
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {renderTool()}
        </div>
      </main>
      <div className="mt-auto text-center py-6">
        <footer className="text-xs text-gray-400">
          {settings.copyrightText || '© 2025 运营魔方 ToolBox. All rights reserved.'}
          <span className="mx-2">|</span>
          <a href="/privacy" className="hover:text-blue-600">隐私说明</a>
        </footer>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <SettingsProvider>
      <DetailClient />
    </SettingsProvider>
  )
}

