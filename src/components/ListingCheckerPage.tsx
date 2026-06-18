import React, { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard } from 'lucide-react'

const Card = ({ children, className = "", onClick, ...props }: any) => (
  <div onClick={onClick} className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`} {...props}>{children}</div>
)

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const newRulePromoWords = [
  'free shipping', '100% quality', 'guaranteed', 'best', 'cheapest',
  'discount', 'sale', '赠品', '包邮', '最优', '保证', '正品保证'
]

const newRuleStopWords = new Set(['for', 'and', 'or', 'the', 'a', 'an', 'with', 'of', 'to', 'in'])

const countChars = (text: string) => Array.from(text || '').length

const normalizeWords = (text: string) => (
  (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
)

const repeatedWords = (text: string) => {
  const counts = new Map<string, number>()
  normalizeWords(text).forEach((word) => {
    if (newRuleStopWords.has(word)) return
    const key = word.replace(/s$/i, '')
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts.entries()).filter(([, count]) => count > 2).map(([word]) => word)
}

const findPromoWords = (text: string) => {
  const lower = (text || '').toLowerCase()
  return newRulePromoWords.filter((word) => lower.includes(word.toLowerCase()))
}

const hasDecorativeSymbols = (text: string) => /([!！?？*★☆<>【】]{2,})|([|丨]{2,})/.test(text || '')

function buildTitleSuggestion(fields: Record<string, string>) {
  const parts = [
    fields.brand,
    fields.type,
    fields.spec,
    fields.feature,
    fields.size,
    fields.model,
    fields.compat,
    fields.qty
  ]
  return parts.map((item) => item.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function buildHighlightSuggestion(fields: Record<string, string>) {
  const parts = [
    fields.material,
    fields.usage,
    fields.secondary,
    fields.highlightCompat,
    fields.scene
  ]
  return parts.map((item) => item.trim()).filter(Boolean).join('; ').replace(/\s+/g, ' ').trim()
}

function NewRulesTitleChecker() {
  const [title, setTitle] = useState('')
  const [highlight, setHighlight] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({
    brand: '',
    type: '',
    spec: '',
    feature: '',
    size: '',
    model: '',
    compat: '',
    qty: '',
    material: '',
    usage: '',
    secondary: '',
    highlightCompat: '',
    scene: ''
  })

  const titleCount = countChars(title)
  const highlightCount = countChars(highlight)
  const titlePromos = findPromoWords(title)
  const highlightPromos = findPromoWords(highlight)
  const titleRepeats = repeatedWords(title)
  const highlightRepeats = repeatedWords(highlight)
  const titleSuggestion = buildTitleSuggestion(fields)
  const highlightSuggestion = buildHighlightSuggestion(fields)

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const titleIssues = [
    titleCount > 75 ? `标题超过 75 字符，当前 ${titleCount}/75` : '',
    titlePromos.length ? `标题包含促销/绝对化词：${titlePromos.join('、')}` : '',
    hasDecorativeSymbols(title) ? '标题包含连续装饰符号' : '',
    titleRepeats.length ? `标题重复词偏多：${titleRepeats.join('、')}` : ''
  ].filter(Boolean)

  const highlightIssues = [
    highlightCount > 125 ? `商品亮点超过 125 字符，当前 ${highlightCount}/125` : '',
    highlightPromos.length ? `商品亮点包含促销/绝对化词：${highlightPromos.join('、')}` : '',
    hasDecorativeSymbols(highlight) ? '商品亮点包含连续装饰符号' : '',
    highlightRepeats.length ? `商品亮点重复词偏多：${highlightRepeats.join('、')}` : ''
  ].filter(Boolean)

  const score = Math.max(0, 100
    - Math.max(0, titleCount - 75) * 2
    - Math.max(0, highlightCount - 125)
    - (titlePromos.length + highlightPromos.length) * 12
    - (titleRepeats.length + highlightRepeats.length) * 8
    - (hasDecorativeSymbols(title) ? 10 : 0)
    - (hasDecorativeSymbols(highlight) ? 8 : 0)
    - (!fields.type.trim() ? 8 : 0)
  )

  const batchRows = batchInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cols = line.split(/\t|,/).map((item) => item.trim()).filter(Boolean)
      const candidate = cols.length >= 3 ? cols.slice(2).join(' ') : line
      const len = countChars(candidate)
      const promos = findPromoWords(candidate)
      const repeats = repeatedWords(candidate)
      const issues = [
        len > 75 ? '超过75字符' : '',
        promos.length ? `促销词：${promos.join('、')}` : '',
        repeats.length ? `重复词：${repeats.join('、')}` : '',
        hasDecorativeSymbols(candidate) ? '装饰符号偏多' : ''
      ].filter(Boolean)
      return { index: index + 1, sku: cols[0] || `第${index + 1}行`, title: candidate, len, issues }
    })

  const loadDemo = () => {
    setTitle('Example Brand Stainless Steel Insulated Water Bottle 32 oz Leakproof BPA Free for Gym Office Hiking')
    setHighlight('Stainless Steel; Gym, Office and Hiking; BPA Free; Daily Hydration')
    setFields({
      brand: 'Example Brand',
      type: 'Insulated Water Bottle',
      spec: '32 oz Leakproof',
      feature: 'Leakproof',
      size: '32 oz',
      model: '',
      compat: '',
      qty: '',
      material: 'Stainless Steel',
      usage: 'Gym, Office and Hiking',
      secondary: 'BPA Free',
      highlightCompat: '',
      scene: 'Daily Hydration'
    })
  }

  const applySuggestions = () => {
    setTitle(titleSuggestion)
    setHighlight(highlightSuggestion)
  }

  return (
    <div className="space-y-6">

      <Card className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-teal-600" />
              <h3 className="text-lg font-bold text-gray-800">2026 标题与商品亮点新规自检</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">按标题 75 字符、商品亮点 125 字符进行初筛，并提示促销词、重复词和结构缺失。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={loadDemo}>载入示例</button>
            <button className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700" onClick={applySuggestions}>应用建议</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="space-y-5">
            <div>
              <label className="font-bold text-sm text-gray-700">主标题</label>
              <textarea value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 h-28 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder="粘贴现有主标题，建议不超过 75 字符" />
              <div className={`mt-1 text-sm font-semibold ${titleCount > 75 ? 'text-red-600' : 'text-green-600'}`}>{titleCount}/75 字符</div>
            </div>
            <div>
              <label className="font-bold text-sm text-gray-700">商品亮点</label>
              <textarea value={highlight} onChange={(e) => setHighlight(e.target.value)} className="mt-2 h-28 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder="填写商品亮点，建议不超过 125 字符" />
              <div className={`mt-1 text-sm font-semibold ${highlightCount > 125 ? 'text-red-600' : 'text-green-600'}`}>{highlightCount}/125 字符</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['brand', '品牌', 'Example Brand'],
                ['type', '产品类型/核心词', 'Insulated Water Bottle'],
                ['spec', '关键规格/型号', '32 oz Leakproof'],
                ['feature', '关键特性', 'Leakproof'],
                ['size', '尺寸/容量', '32 oz'],
                ['model', '型号/接口', ''],
                ['compat', '兼容信息', ''],
                ['qty', '数量', '']
              ].map(([key, label, placeholder]) => (
                <label key={key} className="text-sm font-semibold text-gray-700">
                  {label}
                  <input value={fields[key]} onChange={(e) => updateField(key, e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm shadow-sm" placeholder={placeholder} />
                </label>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['material', '材质', 'Stainless Steel'],
                ['usage', '建议用途', 'Gym, Office and Hiking'],
                ['secondary', '次要特性', 'BPA Free'],
                ['highlightCompat', '兼容/适配', ''],
                ['scene', '使用场景', 'Daily Hydration']
              ].map(([key, label, placeholder]) => (
                <label key={key} className="text-sm font-semibold text-gray-700">
                  {label}
                  <input value={fields[key]} onChange={(e) => updateField(key, e.target.value)} className="mt-1 h-9 w-full rounded-md border border-gray-300 px-3 text-sm shadow-sm" placeholder={placeholder} />
                </label>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">综合评分</div>
              <div className={`mt-1 text-4xl font-black ${score >= 85 ? 'text-green-600' : score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{score}</div>
              <div className="mt-2 text-sm text-gray-600">{score >= 85 ? '整体合规度较高' : score >= 70 ? '需要局部调整' : '建议优先精简重写'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800">问题提示</h4>
              <div className="mt-3 space-y-2 text-sm">
                {[...titleIssues, ...highlightIssues].length === 0 ? (
                  <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">未发现主要新规风险。</div>
                ) : (
                  [...titleIssues, ...highlightIssues].map((issue) => <div key={issue} className="rounded-md bg-red-50 px-3 py-2 text-red-700">{issue}</div>)
                )}
                {!fields.type.trim() && <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-700">建议补充产品类型/核心词。</div>}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800">建议文案</h4>
              <div className="mt-3 text-xs font-semibold text-gray-500">建议标题</div>
              <div className="mt-1 rounded-md bg-gray-50 p-3 text-sm text-gray-700">{titleSuggestion || '等待输入结构字段'}</div>
              <div className="mt-3 text-xs font-semibold text-gray-500">建议商品亮点</div>
              <div className="mt-1 rounded-md bg-gray-50 p-3 text-sm text-gray-700">{highlightSuggestion || '等待输入结构字段'}</div>
            </div>
          </aside>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-800">批量标题诊断</h3>
        <p className="mt-1 text-sm text-gray-500">每行一个标题；也支持 SKU、ASIN、标题用 Tab 或逗号分隔。</p>
        <textarea value={batchInput} onChange={(e) => setBatchInput(e.target.value)} className="mt-4 h-32 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder={'SKU-DEMO-001\\tB0DEMO001\\tExample Brand Stainless Steel Insulated Water Bottle 32 oz Leakproof BPA Free for Gym Office Hiking'} />
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">序号/SKU</th>
                <th className="px-3 py-2">标题</th>
                <th className="px-3 py-2">字符数</th>
                <th className="px-3 py-2">诊断</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-gray-400" colSpan={4}>等待批量输入</td></tr>
              ) : batchRows.map((row) => (
                <tr key={row.index} className="border-t">
                  <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                  <td className="max-w-xl px-3 py-2 text-gray-700">{row.title}</td>
                  <td className={`px-3 py-2 font-semibold ${row.len > 75 ? 'text-red-600' : 'text-green-600'}`}>{row.len}</td>
                  <td className="px-3 py-2 text-gray-600">{row.issues.length ? row.issues.join('；') : '未发现主要问题'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const ListingCheckerPage = () => {
  const [mode, setMode] = useState<'new-rules' | 'classic'>('new-rules')
  const [title, setTitle] = useState('')
  const [bullets, setBullets] = useState<string[]>(['','','','',''])
  const [longdesc, setLongdesc] = useState('')
  const [st, setSt] = useState('')
  const [keywords, setKeywords] = useState('')
  const [results, setResults] = useState<any>({ title:'', titleHl:'', bulletRes: Array(5).fill(''), bulletHl: Array(5).fill(''), longRes:'', longHl:'', stRes:'', stHl:'', kwStat:'' })

  const debouncedTitle = useDebounce(title, 500)
  const debouncedBullets = useDebounce(bullets, 500)
  const debouncedLongdesc = useDebounce(longdesc, 500)
  const debouncedSt = useDebounce(st, 500)

  const forbiddenTitle = /[!_{}^¬¦]/g
  const forbiddenBullets = /[™®€…✅❌]/g
  const forbiddenPhrases = ["生态友好", "全额退款"]
  const forbiddenBulletPhrases = ["ASIN", "公司", "外部链接", "http", "https", "促销", "折扣", "优惠", "满减", "包邮", "限时"]
  const stopWords = ["的","和","或","与","在","以","于","为","to","of","and","in","on","for","with","by","a","an","the","at"]
  const forbiddenEndPunct = /[,.，。;；、!！?？:：]$/

  const getKeywordsArr = useCallback(() => {
    const raw = keywords.trim()
    if (!raw) return [] as string[]
    const arr: string[] = []
    raw.split('\n').forEach(line => {
      line.split(/[,，]/).forEach(token => {
        const kw = token.trim()
        if (kw) arr.push(kw)
      })
    })
    return Array.from(new Set(arr))
  }, [keywords])

  const highlightKeywords = useCallback((str: string, kws: string[]) => {
    if (!str) return ''
    let safe = str.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const sorted = [...kws].sort((a,b)=>b.length-a.length)
    sorted.forEach(kw => {
      const pattern = kw.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
      const reg = new RegExp(pattern, 'gi')
      safe = safe.replace(reg, m => `<span class="bg-yellow-100 font-bold rounded px-1">${m}</span>`)
    })
    return safe
  }, [])

  const checkTitle = useCallback((t: string) => {
    let html = ''
    let errors = 0
    if (t.length > 200) { html += `<div class="text-red-600 font-medium">字符数超限：${t.length}/200</div>`; errors++ }
    else if (t.length > 80) { html += `<div class="text-orange-600 font-medium">字符数：${t.length}，建议80字符内以适配移动端</div>` }
    else if (t.length === 0) { html += `<div class="text-red-600 font-medium">标题不能为空</div>`; errors++ }
    else { html += `<div class="text-green-600 font-medium">字符数合规：${t.length}/200</div>` }
    if (forbiddenTitle.test(t)) { html += `<div class="text-red-600 font-medium">包含禁用符号（!、_、{}、^、¬、¦）</div>`; errors++ }
    const wordCount: Record<string, number> = {}
    const wordPattern = /\b[a-z0-9\u4e00-\u9fa5\-]+\b/gi
    let match: RegExpExecArray | null
    while ((match = wordPattern.exec(t)) !== null) {
      const w = match[0]
      if (!stopWords.includes(w.toLowerCase())) {
        const key = w.replace(/s$/i, '').toLowerCase()
        wordCount[key] = (wordCount[key] || 0) + 1
      }
    }
    const repeated = Object.entries(wordCount).filter(([_, n]) => n > 2)
    if (repeated.length > 0) { html += `<div class="text-red-600 font-medium">以下词语重复超过2次：${repeated.map(([w, n]) => `"${w}"(${n}次)`).join("，")}</div>`; errors++ }
    const notCap: string[] = []
    const titleWords = t.split(/\s+/)
    titleWords.forEach(word => {
      if (word && !stopWords.includes(word.toLowerCase()) && /^[a-zA-Z]/.test(word) && word[0] !== word[0].toUpperCase()) notCap.push(word)
    })
    if (notCap.length > 0) { html += `<div class="text-orange-600">部分词语未首字母大写（介词/冠词/连词除外）：${notCap.join(', ')}</div>` }
    html += `<div>结构建议：品牌名→核心属性→产品类型→关键卖点→颜色/尺寸→型号。</div>`
    if (errors === 0) html = `<div class="text-green-600 font-bold">标题合规</div>` + html
    const kws = getKeywordsArr()
    const hl = kws.length>0 ? "关键词高亮：" + highlightKeywords(t, kws) : ''
    setResults((p:any)=>({ ...p, title: html, titleHl: hl }))
  }, [forbiddenTitle, stopWords, getKeywordsArr, highlightKeywords])

  const checkBullet = useCallback((val: string, idx: number) => {
    val = val.trim()
    let html = ''
    let errors = 0
    if (!val) { html += `<span class="text-red-600">内容为空</span>`; errors++ }
    if (forbiddenBullets.test(val)) { html += `<span class="text-red-600">含禁用符号（™、®、€、…、✅、❌）</span>`; errors++ }
    forbiddenPhrases.forEach(p => { if (val.includes(p)) { html += `<span class="text-red-600">含禁用短语：“${p}”</span>`; errors++ } })
    forbiddenBulletPhrases.forEach(p => { if (val.toLowerCase().includes(p.toLowerCase())) { html += `<span class="text-red-600">含违禁内容：“${p}”</span>`; errors++ } })
    if (val.length > 300) html += `<span class="text-orange-600">字符数：${val.length}，建议不超300字符，移动端可能被折叠</span>`
    else if(val.length>0) html += `<span class="text-green-600">字符数：${val.length}/500</span>`
    if (val.length > 500) { html += `<span class="text-red-600">字符数超限：${val.length}/500</span>`; errors++ }
    if (/[,.，。;；、!！?？:：]$/.test(val)) { html += `<span class="text-red-600">结尾不能有标点（, . ， 。 ; ； 、 ! ！ ? ？ : ：等）</span>`; errors++ }
    if(errors===0 && val.length>0){ html = `<span class="text-green-600 font-medium">该要点合规</span> ` + html }
    const kws = getKeywordsArr()
    const hl = kws.length>0 ? "关键词高亮：" + highlightKeywords(val, kws) : ''
    
    setResults((p:any)=>{ 
      const br = [...p.bulletRes]; 
      const bh = [...p.bulletHl]; 
      br[idx] = html; 
      bh[idx] = hl; 
      return { ...p, bulletRes: br, bulletHl: bh } 
    })
  }, [forbiddenBullets, forbiddenPhrases, forbiddenBulletPhrases, getKeywordsArr, highlightKeywords])

  const checkLongDesc = useCallback((val: string) => {
    val = val.trim()
    let html = ''
    let errors = 0
    if (!val) { html += `<span class="text-red-600">内容为空</span>`; errors++ }
    if (forbiddenBullets.test(val)) { html += `<span class="text-red-600">含禁用符号（™、®、€、…、✅、❌）</span>`; errors++ }
    forbiddenPhrases.forEach(p => { if (val.includes(p)) { html += `<span class="text-red-600">含禁用短语：“${p}”</span>`; errors++ } })
    forbiddenBulletPhrases.forEach(p => { if (val.toLowerCase().includes(p.toLowerCase())) { html += `<span class="text-red-600">含违禁内容：“${p}”</span>`; errors++ } })
    if (val.length > 2000) { html += `<span class="text-red-600">字符数：${val.length}/2000，超限</span>`; errors++ }
    else if(val.length>0) { html += `<span class="text-green-600">字符数：${val.length}/2000</span>` }
    if(errors===0 && val.length>0){ html = `<span class="text-green-600 font-medium">长描述合规</span> ` + html }
    const kws = getKeywordsArr(); const hl = kws.length>0 ? "关键词高亮：" + highlightKeywords(val, kws) : ''
    setResults((p:any)=>({ ...p, longRes: html, longHl: hl }))
  }, [forbiddenBullets, forbiddenPhrases, forbiddenBulletPhrases, getKeywordsArr, highlightKeywords])

  const checkST = useCallback((val: string) => {
    const s = val.trim()
    let html = ''
    let errors = 0
    if (!s) { html += `<div class="text-red-600">ST关键词不能为空</div>`; errors++ }
    if (s.length > 250) { html += `<div class="text-red-600">字符数超限：${s.length}/250</div>`; errors++ }
    else { html += `<div class="text-green-600">字符数：${s.length}/250</div>` }
    if (/[,.;，。；、]/.test(s)) { html += `<div class="text-red-600">请仅用空格分隔关键词，不要使用标点符号</div>`; errors++ }
    const words = s.split(/\s+/).filter(w => w.length > 0)
    const hasVerb = words.some(w => /ing$|ed$|en$|ize$|use$|make$|do$|is$|are$|be$/.test(w))
    if (hasVerb) html += `<div class="text-orange-600">建议仅填写名词或名词词组，避免动词</div>`
    const wordSet = new Set<string>(); const repeats: string[] = []
    words.forEach(w => { const key = w.toLowerCase(); if (wordSet.has(key)) repeats.push(w); wordSet.add(key) })
    if (repeats.length > 0) html += `<div class="text-orange-600">有重复关键词：${[...new Set(repeats)].join(" / ")}</div>`
    if (errors === 0) html = `<div class="text-green-600">ST关键词合规</div>` + html
    const kws = getKeywordsArr(); const hl = kws.length>0 ? "关键词高亮：" + highlightKeywords(s, kws) : ''
    setResults((p:any)=>({ ...p, stRes: html, stHl: hl }))
  }, [getKeywordsArr, highlightKeywords])

  const checkKeywordEmbedding = useCallback(() => {
    const kws = getKeywordsArr()
    if (kws.length === 0) { setResults((p:any)=>({ ...p, kwStat: `<div class='text-red-600'>请先输入关键词</div>` })); return }
    const titleV = title || ''
    const bulletsV = bullets.map(b=>b||'')
    const longV = longdesc || ''
    const stV = st || ''
    const stats = kws.map(kw => {
      const pattern = kw.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")
      const reg = new RegExp(pattern, 'gi')
      let count = 0
      count += (titleV.match(reg) || []).length
      bulletsV.forEach(b=>{ count += (b.match(reg) || []).length })
      count += (longV.match(reg) || []).length
      count += (stV.match(reg) || []).length
      return { kw, count }
    })
    stats.sort((a,b)=> b.count !== a.count ? b.count - a.count : a.kw.localeCompare(b.kw))
    let table = `<table class='w-full text-xs border border-gray-200'><tr class='bg-gray-50'><th class='border p-2'>关键词</th><th class='border p-2'>埋入总次数</th></tr>`
    stats.forEach(it => { table += `<tr><td class='border p-2'>${it.kw}</td><td class='border p-2'>${it.count}</td></tr>` })
    table += `</table>`
    const titleHl = kws.length>0 ? "关键词高亮：" + highlightKeywords(titleV, kws) : ''
    const bh = bulletsV.map(b => kws.length>0 ? "关键词高亮：" + highlightKeywords(b, kws) : '')
    const longHl = kws.length>0 ? "关键词高亮：" + highlightKeywords(longV, kws) : ''
    const stHl = kws.length>0 ? "关键词高亮：" + highlightKeywords(stV, kws) : ''
    setResults((p:any)=>({ ...p, kwStat: `<div class='text-green-600'>关键词埋入统计：</div>` + table + `<div class='text-orange-600 mt-2'>如需刷新高亮/统计，请重新点击本按钮</div>`, titleHl, bulletHl: bh, longHl, stHl }))
  }, [getKeywordsArr, highlightKeywords, title, bullets, longdesc, st])

  // Effects for auto-check
  useEffect(() => {
    checkTitle(debouncedTitle)
  }, [debouncedTitle, checkTitle])

  useEffect(() => {
    debouncedBullets.forEach((b, i) => checkBullet(b, i))
  }, [debouncedBullets, checkBullet])

  useEffect(() => {
    checkLongDesc(debouncedLongdesc)
  }, [debouncedLongdesc, checkLongDesc])

  useEffect(() => {
    checkST(debouncedSt)
  }, [debouncedSt, checkST])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('new-rules')}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'new-rules' ? 'bg-teal-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          2026 标题新规
        </button>
        <button
          type="button"
          onClick={() => setMode('classic')}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === 'classic' ? 'bg-indigo-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          完整文案自检
        </button>
      </div>

      {mode === 'new-rules' ? (
        <NewRulesTitleChecker />
      ) : (      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Listing文案合规及埋词检查</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="font-bold text-sm text-gray-700">商品标题：</label>
            <div className="flex items-start gap-2 mt-2">
              <textarea value={title} onChange={(e:any)=>setTitle(e.target.value)} className="flex-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder="请输入商品标题（建议80字符内）"></textarea>
              <div className="text-xs text-gray-500 min-w-[80px]">{title.length}/200</div>
              <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={() => checkTitle(title)}>检查</button>
            </div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.title }}></div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.titleHl }}></div>
          </div>

          <div>
            <label className="font-bold text-sm text-gray-700">五点描述（每个要点单独填写）：</label>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="mt-3">
                <div className="flex items-start gap-2">
                  <textarea value={bullets[i]} onChange={(e:any)=>{ const arr=[...bullets]; arr[i]=e.target.value; setBullets(arr) }} className="flex-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder={`要点${i+1}`}></textarea>
                  <div className="text-xs text-gray-500 min-w-[80px]">{(bullets[i]||'').length}/500</div>
                  <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={()=>checkBullet(bullets[i], i)}>检查</button>
                </div>
                <div className="mt-1 text-sm" dangerouslySetInnerHTML={{ __html: results.bulletRes[i] }}></div>
                <div className="mt-1 text-sm" dangerouslySetInnerHTML={{ __html: results.bulletHl[i] }}></div>
              </div>
            ))}
          </div>

          <div>
            <label className="font-bold text-sm text-gray-700">长描述：</label>
            <div className="flex items-start gap-2 mt-2">
              <textarea value={longdesc} onChange={(e:any)=>setLongdesc(e.target.value)} className="flex-1 h-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder="请输入长描述"></textarea>
              <div className="text-xs text-gray-500 min-w-[80px]">{longdesc.length}/2000</div>
              <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={() => checkLongDesc(longdesc)}>检查</button>
            </div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.longRes }}></div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.longHl }}></div>
          </div>

          <div>
            <label className="font-bold text-sm text-gray-700">ST关键词（建议用空格分隔）：</label>
            <div className="flex items-start gap-2 mt-2">
              <textarea value={st} onChange={(e:any)=>setSt(e.target.value)} className="flex-1 h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder="如：shoe shoes men women running"></textarea>
              <div className="text-xs text-gray-500 min-w-[80px]">{st.length}/250</div>
              <button className="px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={() => checkST(st)}>检查</button>
            </div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.stRes }}></div>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.stHl }}></div>
          </div>

          <div>
            <label className="font-bold text-sm text-gray-700">产品关键词（用逗号分隔或分行填写）：</label>
            <textarea value={keywords} onChange={(e:any)=>setKeywords(e.target.value)} className="w-full h-20 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm" placeholder={"如：running shoes, waterproof,\n或每行一个词/词组"}></textarea>
            <button className="mt-2 px-3 py-2 rounded bg-indigo-600 text-white text-sm" onClick={checkKeywordEmbedding}>检查关键词埋入</button>
            <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: results.kwStat }}></div>
          </div>
        </div>
      </Card>
      )}
    </div>
  )
}

export default ListingCheckerPage

