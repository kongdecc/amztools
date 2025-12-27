
export const DEFAULT_SITE_SETTINGS = {
  siteName: '跨境工具魔方 AmzToolBox',
  siteDescription: '本站不需要注册，所有工具免费使用。',
  aboutContent: '本站不需要注册，所有工具免费使用。',
  copyrightText: '© 2025 跨境工具魔方 AmzToolBox. All rights reserved.',
  privacyPolicy: `特别说明
本站内容无需登录即可访问与使用，我们不主动收集任何可识别个人信息。

服务器仅保留最小化技术日志，用于安全与性能维护，且设有自动清理周期；
若接入第三方统计或广告，仅收集匿名数据并严格遵循其隐私政策，您可在浏览器中关闭相关追踪功能或清除 Cookies；
若您在本站主动提交留言，我们仅保存昵称与留言内容，支持按您的请求删除相关信息。`
}

export const DEFAULT_NAV_ITEMS = [
  { id: 'functionality', label: '功能分类', order: 0, children: [] },
  { id: 'about', label: '关于', href: '/about', order: 1, isExternal: false, active: true },
  { id: 'blog', label: '博客', href: '/blog', order: 2, isExternal: false, active: true },
  { id: 'suggest', label: '提需求', href: '/suggest', order: 3, isExternal: false, active: true }
]

export const DEFAULT_CATEGORIES = [
  { key: 'operation', label: '运营工具', enabled: true },
  { key: 'advertising', label: '广告工具', enabled: true },
  { key: 'image-text', label: '图片文本', enabled: true },
  { key: 'other', label: '其他工具', enabled: true }
]

export const DEFAULT_TOOLS = [
  // Advertising (Only 2 as requested)
  { key: 'ad-calc', title: '广告竞价计算', desc: '亚马逊广告策略实时出价计算，支持Fixed/Dynamic策略', status: '启用', color: 'blue', order: 1, category: 'advertising' },
  { key: 'cpc-compass', title: 'CPC利润测算', desc: '集成FBA费率、佣金计算，精准推导盈亏平衡CPC及ACOS', status: '启用', color: 'blue', order: 2, category: 'advertising' },

  // Operation (Moved keyword tools here or other)
  // Moving keyword tools to Operation for now as they are Amazon specific operations, unless user wants them in 'other'.
  // Given "Advertising: only two", I will move the others to Operation which seems most fit.
  { key: 'amazon-promotion-stacking', title: '亚马逊促销叠加计算器', desc: '自动计算促销叠加或互斥，基于2025版《各类促销叠加情况》矩阵表逻辑', status: '启用', color: 'blue', order: 3, category: 'operation' },
  { key: 'keyword-combiner', title: '关键词组合工具', desc: '多维度关键词组合，支持去重和多种分隔符', status: '启用', color: 'blue', order: 4, category: 'operation' },
  { key: 'keyword-strategy', title: '关键词策略工具', desc: '分析关键词分布，制定Listing埋词策略', status: '启用', color: 'blue', order: 5, category: 'operation' },
  { key: 'search-term-volatility', title: '搜索词波动分析', desc: '分析搜索词排名波动，监控市场趋势', status: '启用', color: 'blue', order: 6, category: 'operation' },
  { key: 'natural-traffic-tool', title: '自然流量分析工具', desc: '分析自然流量与广告流量占比，优化流量结构', status: '启用', color: 'blue', order: 7, category: 'operation' },

  { key: 'storage-fee-calc', title: '亚马逊 FBA 全能仓储费计算器', desc: '集成月度仓储费、利用率附加费及超龄库存附加费（含2026新规）', status: '启用', color: 'blue', order: 10, category: 'operation' },
  { key: 'delivery', title: '美国站配送费计算', desc: '按2025/2026规则计算配送费用', status: '启用', color: 'orange', order: 11, category: 'operation' },
  { key: 'returns-v2', title: '退货报告分析V2', desc: '上传退货报告，原因/趋势/仓库/评论多维分析', status: '启用', color: 'blue', order: 12, category: 'operation' },
  { key: 'invoice-generator', title: '发票生成工具', desc: '在线生成和打印发票，支持多币种、自定义Logo，可导出PDF', status: '启用', color: 'cyan', order: 13, category: 'operation' },
  { key: 'amazon-global', title: '亚马逊批量查询', desc: '关键词排名监控与ASIN全球跟卖侦查，支持多站点一键打开', status: '启用', color: 'orange', order: 14, category: 'operation' },
  { key: 'forbidden-words', title: '亚马逊文案违禁词检测', desc: '检测亚马逊文案中的违禁词，支持自定义词库和批量替换', status: '启用', color: 'red', order: 15, category: 'operation' },
  { key: 'listing-check', title: 'Listing自检工具', desc: '检查Listing标题、五点描述等是否符合亚马逊规范，检测违禁词', status: '启用', color: 'green', order: 16, category: 'operation' },
  { key: 'rating-sales-reverse', title: '亚马逊评分销量反推', desc: '根据评分数量和目标评分，反推所需的评论数量和预估销量', status: '启用', color: 'yellow', order: 17, category: 'operation' },
  
  { key: 'fba-label-editor', title: 'FBA标签编辑器', desc: '在线编辑FBA标签，支持PDF导入和自定义文本', status: '启用', color: 'blue', order: 20, category: 'operation' },
  { key: 'max-reserve-fee', title: '入库配置费计算器', desc: '计算亚马逊入库配置费，优化发货成本', status: '启用', color: 'blue', order: 21, category: 'operation' },
  { key: 'fba-warehouses', title: 'FBA仓库查询', desc: '查询全球FBA仓库地址、代码及详细信息', status: '启用', color: 'orange', order: 23, category: 'operation' },

  // Image & Text
  { key: 'editor', title: '可视化编辑器', desc: '所见即所得的HTML编辑器，支持一键复制源码', status: '启用', color: 'indigo', order: 30, category: 'image-text' },
  { key: 'case', title: '大小写转换', desc: '文本大小写一键转换，支持首字母大写', status: '启用', color: 'violet', order: 31, category: 'image-text' },
  { key: 'word-count', title: '词频统计', desc: '分析英文文本，统计单词出现频率和字符数', status: '启用', color: 'sky', order: 32, category: 'image-text' },
  { key: 'char-count', title: '字符统计', desc: '统计字符并提供清理复制等操作', status: '启用', color: 'purple', order: 33, category: 'image-text' },
  { key: 'text-compare', title: '文本比较工具', desc: '对比两个文本的差异，显示新增、删除和修改内容，支持详细统计分析', status: '启用', color: 'green', order: 34, category: 'image-text' },
  { key: 'duplicate-remover', title: '去除重复文本工具', desc: '智能去重，多种模式，支持按行、空格、逗号等分隔符，支持排序和过滤', status: '启用', color: 'purple', order: 35, category: 'image-text' },
  { key: 'content-filter', title: '英文文本过滤工具', desc: '智能筛选和删除英文文本中的介词、连词、冠词等无实际意义的词汇', status: '启用', color: 'teal', order: 36, category: 'image-text' },
  { key: 'image-resizer', title: '图片尺寸修改工具', desc: '批量修改图片尺寸、格式转换和压缩，支持JPEG/PNG/GIF', status: '启用', color: 'indigo', order: 37, category: 'image-text' },
  { key: 'image-compression', title: '图片压缩与格式转换', desc: '批量压缩、格式转换，本地处理不上传服务器', status: '启用', color: 'blue', order: 38, category: 'image-text' },
  { key: 'pinyin-converter', title: '汉字转拼音', desc: '汉字转拼音工具，支持多音字、声调标记', status: '启用', color: 'green', order: 39, category: 'image-text' },

  // Other (Moved carton and partner here)
  { key: 'unit', title: '单位换算', desc: '长度、重量、体积等多维度单位快速换算', status: '启用', color: 'cyan', order: 25, category: 'operation' },
  { key: 'carton-calc-advanced', title: '外箱装箱计算器', desc: '智能计算装箱方案，优化空间利用率', status: '启用', color: 'indigo', order: 51, category: 'other' },
  { key: 'partner-equity-calculator', title: '合伙人权益计算器', desc: '亚马逊合伙创业股权分配与利润分红计算', status: '启用', color: 'purple', order: 52, category: 'other' }
]
