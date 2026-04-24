'use client'

import React from 'react'

export default function AmazonAdsAnalyzer() {
  return (
    <div className="w-full h-[calc(100vh-100px)] space-y-3">
      <div className="flex justify-end">
        <a
          href="/amazon-ads-analyzer/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          新窗口打开
        </a>
      </div>
      <iframe 
        src="/amazon-ads-analyzer/index.html" 
        className="w-full h-[calc(100%-44px)] border-0"
        title="Amazon Ads Analyzer"
      />
    </div>
  )
}
