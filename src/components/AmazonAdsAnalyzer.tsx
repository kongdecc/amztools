'use client'

import React from 'react'

export default function AmazonAdsAnalyzer() {
  return (
    <div className="w-full h-[calc(100vh-100px)]">
      <iframe 
        src="/amazon-ads-analyzer/index.html" 
        className="w-full h-full border-0"
        title="Amazon Ads Analyzer"
      />
    </div>
  )
}
