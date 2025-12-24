import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'modules.json')

const defaults = [
  { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', views: 0, color: 'blue', order: 1, category: 'advertising' },
  { key: 'cpc-compass', title: 'CPC利润测算', desc: '集成FBA费率、佣金计算，精准推导盈亏平衡CPC及ACOS', status: '启用', views: 0, color: 'blue', order: 1.5, category: 'advertising' },
  { key: 'amazon-promotion-stacking', title: '亚马逊促销叠加计算器', desc: '自动计算促销叠加或互斥，基于2025版《各类促销叠加情况》矩阵表逻辑', status: '启用', views: 0, color: 'blue', order: 1.8, category: 'operation' },
  { key: 'storage-fee-calc', title: '亚马逊 FBA 全能仓储费计算器', desc: '集成月度仓储费、利用率附加费及超龄库存附加费（含2026新规）', status: '启用', views: 0, color: 'blue', order: 17, category: 'operation' },
  { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器', status: '启用', views: 0, color: 'fuchsia', order: 2, category: 'image-text' },
  { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', views: 0, color: 'emerald', order: 3, category: 'operation' },
  { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', views: 0, color: 'violet', order: 4, category: 'image-text' },
  { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '维护', views: 0, color: 'sky', order: 5, category: 'image-text' },
  { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', views: 0, color: 'rose', order: 6, category: 'image-text' },
  { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '启用', views: 0, color: 'orange', order: 7, category: 'operation' },
  { key: 'returns-v2', title: '退货报告分析V2', desc: '上传退货报告，原因/趋势/仓库/评论多维分析', status: '启用', views: 0, color: 'red', order: 8, category: 'operation' },
  { key: 'listing-check', title: 'Listing文案合规', desc: '标题/五点/ST/长描述合规与关键词埋入检查', status: '启用', views: 0, color: 'teal', order: 9, category: 'operation' },
  { key: 'forbidden-words', title: '亚马逊文案违禁词检测', desc: '检测亚马逊文案中的违禁词，支持自定义词库和批量替换', status: '启用', views: 0, color: 'red', order: 10, category: 'operation' },
  { key: 'text-compare', title: '文本比较工具', desc: '对比两个文本的差异，显示新增、删除和修改内容，支持详细统计分析', status: '启用', views: 0, color: 'green', order: 11, category: 'image-text' },
  { key: 'duplicate-remover', title: '去除重复文本工具', desc: '智能去重，多种模式，支持按行、空格、逗号等分隔符，支持排序和过滤', status: '启用', views: 0, color: 'purple', order: 12, category: 'image-text' },
  { key: 'content-filter', title: '英文文本过滤工具', desc: '智能筛选和删除英文文本中的介词、连词、冠词等无实际意义的词汇', status: '启用', views: 0, color: 'teal', order: 13, category: 'image-text' },
  { key: 'image-resizer', title: '图片尺寸修改工具', desc: '批量修改图片尺寸、格式转换和压缩，支持JPEG/PNG/GIF', status: '启用', views: 0, color: 'indigo', order: 14, category: 'image-text' },
  { key: 'invoice-generator', title: '发票生成工具', desc: '在线生成和打印发票，支持多币种、自定义Logo，可导出PDF', status: '启用', views: 0, color: 'cyan', order: 15, category: 'operation' },
  { key: 'amazon-global', title: '亚马逊批量查询', desc: '关键词排名监控与ASIN全球跟卖侦查，支持多站点一键打开', status: '启用', views: 0, color: 'orange', order: 16, category: 'operation' },
  { key: 'rating-sales-reverse', title: '好评及销量反推计算器', desc: 'Listing 补单计算 + 销量反推 (支持自定义留评率)', status: '启用', views: 0, color: 'indigo', order: 17, category: 'operation' },
  { key: 'max-reserve-fee', title: '白嫖库容的最高预留费计算工具', desc: '根据销售额预估和库容申请计划，计算出不亏本的最高预留费单价', status: '启用', views: 0, color: 'emerald', order: 18, category: 'operation' },
  { key: 'keyword-strategy', title: '亚马逊投放关键词选择策略', desc: '根据ASIN转化份额和ABA排名范围，精准筛选和分类关键词（头部/腰部/尾部）', status: '启用', views: 0, color: 'indigo', order: 19, category: 'operation' },
  { key: 'search-term-volatility', title: '快速查询波动率高的搜索词', desc: '对比分析多份CSV报告，快速识别ABA排名、点击份额和转化份额波动较大的搜索词', status: '启用', views: 0, color: 'purple', order: 20, category: 'operation' },
  { key: 'partner-equity-calculator', title: '合伙人股权分配计算器', desc: '支持2人/3人合伙模式，自动计算资金股/人力股比例及股权价值，支持Excel导出和打印', status: '启用', views: 0, color: 'teal', order: 21, category: 'operation' },
  { key: 'carton-calc-advanced', title: '箱规装箱 & 体积重/实重 计算器', desc: '支持 6 种朝向 + 单层补洞混合摆放，估算更接近实际装箱结果', status: '启用', views: 0, color: 'orange', order: 22, category: 'other' },
  { key: 'pinyin-converter', title: '在线汉字转拼音', desc: '支持声调/无声调拼音转换，拼音对照，语音朗读', status: '启用', views: 0, color: 'blue', order: 23, category: 'image-text' },
  { key: 'natural-traffic-tool', title: '多个自然位额外获得自然流量处理工具', desc: '自动化匹配/拆分/计算Excel数据，识别变体类型并计算子体额外自然流量', status: '启用', views: 0, color: 'blue', order: 24, category: 'operation' },
  { key: 'keyword-combiner', title: '关键词组合工具 Pro', desc: '专业版长尾词生成器：支持多组词根、自定义分隔符及批量处理', status: '启用', views: 0, color: 'blue', order: 25, category: 'operation' },
  { key: 'fba-warehouses', title: 'FBA 仓库数据查询', desc: '查询FBA仓库地址、邮编等信息，支持国家、地区筛选和偏远地区查询', status: '启用', views: 0, color: 'indigo', order: 26, category: 'other' },
  { key: 'fba-label-editor', title: 'FBA 标签编辑器', desc: '在线编辑FBA标签PDF，支持添加文字（如批量添加Made in China)、手动拖拽调整位置和大小，自动应用到所有页面', status: '启用', views: 0, color: 'red', order: 27, category: 'other' }
]

function getLocalData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch {}
  return null
}

function saveLocalData(data: Array<any>) {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
  } catch {}
}


export async function GET() {
  try {
    let rows = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    const existing = new Set(rows.map((r: any) => r.key))
    const missing = defaults.filter(d => !existing.has(d.key))
    if (missing.length) {
      await db.$transaction(missing.map(d => (db as any).toolModule.upsert({
        where: { key: d.key },
        update: d,
        create: d
      })))
      rows = await (db as any).toolModule.findMany({ orderBy: { order: 'asc' } })
    }
    return NextResponse.json(rows)
  } catch {
    const local = getLocalData()
    const data = (local || defaults).slice().sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
    return NextResponse.json(data)
  }
}

export async function PUT(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let list: Array<any> = []
  try {
    list = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  try {
    const existing = await (db as any).toolModule.findMany({ select: { key: true } })
    const keepKeys = new Set(list.map(item => item.key))
    const toDelete = existing.map((r: any) => r.key).filter((k: any) => !keepKeys.has(k))
    const ops: Array<any> = []
    if (toDelete.length) ops.push((db as any).toolModule.deleteMany({ where: { key: { in: toDelete } } }))
    ops.push(...list.map(item => (db as any).toolModule.upsert({
      where: { key: item.key },
      update: { title: item.title, desc: item.desc, status: item.status, views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' },
      create: { key: item.key, title: item.title, desc: item.desc, status: item.status ?? '启用', views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' }
    })))
    await db.$transaction(ops)
    return NextResponse.json({ ok: true })
  } catch {
    const mapped = list.map((x, i) => ({ ...x, id: x.key, updatedAt: new Date().toISOString(), order: Number(x.order ?? i + 1) }))
    saveLocalData(mapped)
    return NextResponse.json({ ok: true, dev: true })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const key = body?.key
    if (!key) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    try {
      const row = await (db as any).toolModule.update({ where: { key }, data: { views: { increment: 1 } } })
      return NextResponse.json({ ok: true, views: row.views })
    } catch {
      const arr = (getLocalData() || defaults).slice()
      const idx = arr.findIndex((x: any) => x.key === key)
      if (idx >= 0) arr[idx] = { ...arr[idx], views: Number(arr[idx].views || 0) + 1 }
      saveLocalData(arr)
      return NextResponse.json({ ok: true, dev: true })
    }
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
export async function PATCH(request: Request) {
  const cookie = request.headers.get('cookie') || ''
  const token = cookie.match(/admin_session=([^;]+)/)?.[1]
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let item: any = null
  try { item = await request.json() } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }
  const key = item?.key
  if (!key) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  try {
    await (db as any).toolModule.upsert({
      where: { key },
      update: { title: item.title, desc: item.desc, status: item.status, views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' },
      create: { key, title: item.title, desc: item.desc, status: item.status ?? '启用', views: item.views ?? 0, color: item.color ?? 'blue', order: item.order ?? 0, category: item.category || 'other' }
    })
    return NextResponse.json({ ok: true, key })
  } catch {
    const arr = (getLocalData() || defaults).slice()
    const idx = arr.findIndex((x: any) => x.key === key)
    const next = { ...item, id: key, updatedAt: new Date().toISOString() }
    if (idx >= 0) arr[idx] = { ...arr[idx], ...next }
    else arr.push(next)
    saveLocalData(arr)
    return NextResponse.json({ ok: true, dev: true, key })
  }
}
