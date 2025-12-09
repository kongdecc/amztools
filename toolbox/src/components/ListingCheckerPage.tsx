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

const ListingCheckerPage = () => {
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
      <Card className="p-6">
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
    </div>
  )
}

export default ListingCheckerPage
