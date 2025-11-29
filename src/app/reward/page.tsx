import { db } from '@/lib/db'
import { Metadata } from 'next'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '打赏支持',
  description: '如果您觉得本工具箱对您有帮助，欢迎打赏支持！'
}

async function getRewardSettings() {
  try {
    const descRow = await (db as any).siteSettings.findUnique({ where: { key: 'rewardDescription' } })
    return {
      description: descRow?.value || '如果您觉得本工具箱对您有帮助，欢迎打赏支持我们继续维护和开发！'
    }
  } catch {
    return { description: '如果您觉得本工具箱对您有帮助，欢迎打赏支持我们继续维护和开发！' }
  }
}

function hasRewardQr() {
  try {
    const dataDir = path.join(process.cwd(), '.data')
    const exts = ['png','jpg','jpeg','webp','svg']
    for (const ext of exts) {
      if (fs.existsSync(path.join(dataDir, `reward-qr.${ext}`))) return true
    }
  } catch {}
  return false
}

export default async function RewardPage() {
  const { description } = await getRewardSettings()
  const hasQr = hasRewardQr()

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="p-8 text-center">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-4">打赏支持</div>
          <h1 className="block mt-1 text-lg leading-tight font-medium text-black mb-6">感谢您的支持与鼓励</h1>
          
          <p className="mt-2 text-gray-500 mb-8 whitespace-pre-wrap">
            {description}
          </p>

          <div className="flex justify-center items-center bg-gray-100 p-6 rounded-lg border-2 border-dashed border-gray-300 min-h-[200px]">
            {hasQr ? (
              <img 
                src="/api/reward-qr" 
                alt="打赏二维码" 
                className="max-w-full h-auto max-h-[400px] rounded shadow-sm"
              />
            ) : (
              <div className="text-gray-400 text-sm">
                暂未配置打赏二维码
              </div>
            )}
          </div>
          
          <div className="mt-8">
            <a href="/" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
              &larr; 返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
