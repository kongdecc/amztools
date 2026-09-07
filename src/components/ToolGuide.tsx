import Link from 'next/link'
import { PUBLIC_MODULES, toolPath } from '@/lib/published-content'

const notes: Record<string, string[]> = {
  'ad-calc': ['选择固定竞价、动态提高和降低或仅降低策略，再填写出价与广告位加价百分比。', '最高 CPC 按出价 × (1 + 加价百分比 / 100) × 策略倍数计算。输入 28 表示 28%。', '结果用于比较设置下的最高竞价，不代表每次点击的实际扣费。'],
  'cpc-compass': ['填写商品售价与成本，并核对 FBA 费用和佣金输入。', '结合转化率评估盈亏平衡 CPC 与 ACOS，比较不同出价下的利润空间。', '预测结果依赖输入假设；实际扣费和订单利润应与卖家后台核对。'],
  'fba-label-editor': ['选择需要编辑的标签 PDF，添加文字并调整位置和大小。', '检查页面预览后，将文字应用到需要处理的页面并导出。', '打印前先抽查一页，确认条码和原有标签信息没有被遮挡。'],
  'txt-excel-batch-converter': ['选择 TXT 转 Excel 或 Excel 转 TXT，再导入待转换文件。', 'TXT 文件按来源选择分隔符和编码；出现中文乱码时检查 GBK、GB18030 与 UTF-8 选项。', '先预览一个文件，确认列和文本正确后再批量导出。'],
  'listing-check': ['准备标题、商品亮点、五点描述及其他需要检查的文案。', '根据工具中的字段填写内容，逐项查看字符、用词及信息完整性提示。', '自检提示不能代替类目审核；发布前请核对卖家后台适用的规则。'],
  'image-resizer': ['选择图片后，设置目标尺寸、格式和压缩选项。', '先检查输出图片的比例与清晰度，再下载用于商品展示的图片。'],
  'amazon-eu-fba-calculator': ['按工具中的站点、尺寸、重量和费用类型填写参数。', '比较配送费、仓储费或退仓费用，检查单位与适用条件。', '费用估算以工具所列规则为准；实际账单请与卖家后台核对。']
}

export default function ToolGuide({ tool }: { tool: { key: string; title: string; desc: string; category: string } }) {
  const related = PUBLIC_MODULES.filter(item => item.category === tool.category && item.key !== tool.key).slice(0, 4)
  return <section className="max-w-5xl mx-auto p-6 my-6 rounded-xl bg-white text-slate-700 space-y-4" aria-label="工具使用说明">
    <h1 className="text-2xl font-bold">{tool.title}</h1>
    <p>{tool.desc}。本工具由跨境工具魔方 AmzToolBox 提供，可免费使用。</p>
    {notes[tool.key] && <><h2 className="text-lg font-semibold">使用说明</h2><ol className="list-decimal pl-6 space-y-2">{notes[tool.key].map(note => <li key={note}>{note}</li>)}</ol></>}
    <h2 className="text-lg font-semibold">相关工具</h2>
    <ul className="list-disc pl-6 space-y-2">{related.map(item => <li key={item.key}><Link className="text-blue-700 underline" href={toolPath(item)}>{item.title}</Link>：{item.desc}</li>)}</ul>
    <Link href="/functionality" className="text-blue-700 underline">查看跨境工具魔方全部工具</Link>
  </section>
}
