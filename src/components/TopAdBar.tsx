'use client'

const TOP_AD_ENABLED = String(process.env.NEXT_PUBLIC_TOP_AD_ENABLED || 'true') === 'true'
const TOP_AD_TYPE = String(process.env.NEXT_PUBLIC_TOP_AD_TYPE || 'text').toLowerCase()
const TOP_AD_TEXT = String(process.env.NEXT_PUBLIC_TOP_AD_TEXT || '亚马逊卖家讨论群日报，海量运营干货资料免费下载，欢迎查看使用。')
const TOP_AD_IMAGE_URL = String(process.env.NEXT_PUBLIC_TOP_AD_IMAGE_URL || '').trim()
const TOP_AD_LINK = String(process.env.NEXT_PUBLIC_TOP_AD_LINK || 'https://amzlink.top/').trim()

export default function TopAdBar() {
  if (!TOP_AD_ENABLED) return null
  return (
    <div className="w-full border-y border-orange-200 bg-orange-50">
      <div className="mx-auto flex min-h-10 max-w-screen-2xl items-center justify-center px-3 py-1 text-xs text-orange-700 md:h-10 md:py-0 md:text-sm">
        <a href={TOP_AD_LINK || '#'} target="_blank" rel="noopener noreferrer" className="flex w-full flex-col items-center justify-center gap-1 md:flex-row md:gap-2">
          {TOP_AD_TYPE === 'image' && TOP_AD_IMAGE_URL ? (
            <img src={TOP_AD_IMAGE_URL} alt="广告位" className="h-full max-h-9 w-auto object-contain" />
          ) : (
            <span className="font-medium text-center whitespace-normal break-words md:truncate">{TOP_AD_TEXT}</span>
          )}
          <span className="shrink-0 rounded bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">点击跳转 ↗</span>
        </a>
      </div>
    </div>
  )
}
