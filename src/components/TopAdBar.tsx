'use client'

const TOP_AD_ENABLED = String(process.env.NEXT_PUBLIC_TOP_AD_ENABLED || 'true') === 'true'
const TOP_AD_TYPE = String(process.env.NEXT_PUBLIC_TOP_AD_TYPE || 'text').toLowerCase()
const TOP_AD_TEXT = String(process.env.NEXT_PUBLIC_TOP_AD_TEXT || '跨境乐趣园：卖家讨论群日报，海量运营干货名费下载，欢迎查看使用。')
const TOP_AD_IMAGE_URL = String(process.env.NEXT_PUBLIC_TOP_AD_IMAGE_URL || '').trim()
const TOP_AD_LINK = String(process.env.NEXT_PUBLIC_TOP_AD_LINK || 'https://amzlink.top/').trim()

export default function TopAdBar() {
  if (!TOP_AD_ENABLED) return null
  return (
    <div className="w-full border-y border-orange-200 bg-orange-50">
      <div className="mx-auto flex h-10 max-w-screen-2xl items-center justify-center px-3 text-xs text-orange-700 md:text-sm">
        <a href={TOP_AD_LINK || '#'} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center overflow-hidden">
          {TOP_AD_TYPE === 'image' && TOP_AD_IMAGE_URL ? (
            <img src={TOP_AD_IMAGE_URL} alt="广告位" className="h-full max-h-9 w-auto object-contain" />
          ) : (
            <span className="truncate font-medium">{TOP_AD_TEXT}</span>
          )}
        </a>
      </div>
    </div>
  )
}
