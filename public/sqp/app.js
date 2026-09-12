const state = { reports: [], scopeKey: '', selectedIds: new Set(), selectedQueries:new Set(), currentPageQueries:[], pageSize:20, page:1, sortKey:'volume', sortDir:'desc', detailQuery:'', detailSortKey:'date', detailSortDir:'desc', rules:{volumeTop:20,shareThreshold:null,minFixClicks:3} };
const DB_NAME='sqp-lens-local', DB_STORE='workspace', DB_VERSION=1;
const $ = s => document.querySelector(s);
const fmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const pct = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
const safeDiv = (a,b) => b ? a / b : 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DB_STORE))req.result.createObjectStore(DB_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbSet(key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(value,key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)})}
async function dbGet(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),req=tx.objectStore(DB_STORE).get(key);req.onsuccess=()=>{db.close();resolve(req.result)};req.onerror=()=>reject(req.error)})}
async function dbDelete(key){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)})}
async function persistReports(){try{await dbSet('reports',state.reports);updateSavedActions()}catch(e){toast('本机保存失败，请先备份后减少导入文件');console.error(e)}}

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], next=text[i+1];
    if(c==='"' && quoted && next==='"'){cell+='"';i++;}
    else if(c==='"'){quoted=!quoted;}
    else if(c===',' && !quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}

function metadata(line){
  // The first metadata row resembles CSV but contains JSON-like brackets.
  // Our CSV reader correctly consumes the quotes, so accept both quoted and unquoted values here.
  const get = key => (line.match(new RegExp(`${key}=\\["?([^\\]"]+)"?\\]`))||[])[1] || '';
  const entity = get('品牌') || get('ASIN 或商品') || '未知对象';
  const view = line.includes('品牌=') ? 'brand' : 'asin';
  return { entity, view, range:get('报告范围'), period:get('选择周')||get('选择月份')||get('选择季度')||'' };
}

function findHeader(headers, ...tokens){ return headers.find(h => tokens.every(t => h.includes(t))); }
function findAnyHeader(headers, variants){for(const tokens of variants){const found=findHeader(headers,...tokens);if(found)return found}return undefined}
function number(v){ const n=parseFloat(String(v??'').replace(/[%,$]/g,'')); return Number.isFinite(n)?n:0; }

function normalizeReport(name, text){
  const raw=parseCSV(text); if(raw.length<3) throw new Error('文件没有可读取的数据行');
  const meta=metadata(raw[0].join(',')), headers=raw[1].map(x=>x.trim());
  if(!headers.includes('搜索查询')) throw new Error('不是受支持的 SQP CSV');
  const col=(...t)=>findHeader(headers,...t),any=(...variants)=>findAnyHeader(headers,variants);
  const map={
    query:'搜索查询',score:'搜索查询得分',volume:'搜索查询量',date:'报告日期',
    impTotal:col('曝光','总量'),impMine:meta.view==='brand'?col('曝光','品牌数量'):col('曝光','ASIN 计数'),
    clickTotal:col('点击量','总次数'),clickMine:meta.view==='brand'?col('点击量','点击的品牌数'):col('点击量','ASIN'),
    cartTotal:col('购物车添加','总数'),cartMine:meta.view==='brand'?col('加入购物车','涉及品牌数'):any(['加购','ASIN 数量'],['加入购物车','ASIN']),
    buyTotal:col('购买','下单总数'),buyMine:meta.view==='brand'?col('购买次数','品牌数量'):any(['下单成交','ASIN 数量'],['购买次数','ASIN']),
    clickMarketPrice:col('点击量','价格','中位数'),clickMinePrice:meta.view==='brand'?col('点击量','品牌售价'):col('点击量','ASIN 售价'),
    clickShipSame:col('点击量','当日达'),clickShipOne:col('点击量','1 天配送'),clickShipTwo:any(['点击','2天配送'],['点击','2 天配送'])
  };
  const idx=Object.fromEntries(Object.entries(map).map(([k,h])=>[k,headers.indexOf(h)]));
  const required=new Set(['query','score','volume','date','impTotal','impMine','clickTotal','clickMine','cartTotal','cartMine','buyTotal','buyMine']);
  const missing=Object.entries(idx).filter(([k,i])=>required.has(k)&&i<0).map(([k])=>k);
  if(missing.length) throw new Error(`缺少必要指标列：${missing.join(', ')}`);
  const rows=raw.slice(2).filter(r=>r[idx.query]).map(r=>({
    query:r[idx.query].trim(),score:number(r[idx.score]),volume:number(r[idx.volume]),date:r[idx.date],
    impTotal:number(r[idx.impTotal]),impMine:number(r[idx.impMine]),clickTotal:number(r[idx.clickTotal]),clickMine:number(r[idx.clickMine]),
    cartTotal:number(r[idx.cartTotal]),cartMine:number(r[idx.cartMine]),buyTotal:number(r[idx.buyTotal]),buyMine:number(r[idx.buyMine]),
    clickMarketPrice:number(r[idx.clickMarketPrice]),clickMinePrice:number(r[idx.clickMinePrice]),clickShipSame:number(r[idx.clickShipSame]),clickShipOne:number(r[idx.clickShipOne]),clickShipTwo:number(r[idx.clickShipTwo])
  }));
  const date=rows[0]?.date || (name.match(/\d{4}_\d{2}_\d{2}/)||[''])[0].replaceAll('_','-');
  const periodLabel=meta.period || `${meta.range || '报告'} · ${date}`;
  const mineEvents=rows.reduce((n,r)=>n+r.impMine+r.clickMine+r.cartMine+r.buyMine,0);
  const quality={possibleTopN:[100,1000].includes(rows.length),noObjectEvents:mineEvents===0};
  return {id:`${meta.view}-${meta.entity}-${date}-${Math.random().toString(36).slice(2,7)}`,name,meta,date,periodLabel,rows,quality};
}

async function importFiles(files){
  const errors=[];
  for(const f of files){try{const text=await f.text();state.reports.push(normalizeReport(f.name,text));}catch(e){errors.push(`${f.name}: ${e.message}`)}}
  const duplicates=dedupeReports();
  if(errors.length) toast(`有 ${errors.length} 个文件无法读取`);
  else if(duplicates) toast(`已用新文件替换 ${duplicates} 份重复周期报告`);
  if(state.reports.length){setDefaultScope();await persistReports();showDashboard();}
  input.value='';
}

function dedupeReports(){const before=state.reports.length,m=new Map();state.reports.forEach(r=>m.set(`${r.meta.view}|${r.meta.entity}|${r.date}`,r));state.reports=[...m.values()].sort((a,b)=>a.date.localeCompare(b.date));return before-state.reports.length;}
function scopeOf(r){return `${r.meta.view}|${r.meta.entity}`}
function setDefaultScope(){
  const groups=groupScopes();
  if(!groups.has(state.scopeKey)) state.scopeKey=[...groups.entries()].sort((a,b)=>b[1].at(-1).date.localeCompare(a[1].at(-1).date))[0]?.[0]||'';
  const ids=groups.get(state.scopeKey).map(r=>r.id); state.selectedIds=new Set(ids);
}
function groupScopes(){const m=new Map();state.reports.forEach(r=>{const k=scopeOf(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)});return m;}
function activeReports(){return state.reports.filter(r=>scopeOf(r)===state.scopeKey && state.selectedIds.has(r.id));}

function aggregate(reports){
  const byQuery=new Map();
  for(const report of reports)for(const r of report.rows){
    const key=r.query.toLowerCase(); if(!byQuery.has(key))byQuery.set(key,{query:r.query,score:0,periods:0,volume:0,impTotal:0,impMine:0,clickTotal:0,clickMine:0,cartTotal:0,cartMine:0,buyTotal:0,buyMine:0,clickShipSame:0,clickShipOne:0,clickShipTwo:0,marketPriceNum:0,marketPriceWeight:0,minePriceNum:0,minePriceWeight:0});
    const x=byQuery.get(key);x.periods++;x.score+=r.score;['volume','impTotal','impMine','clickTotal','clickMine','cartTotal','cartMine','buyTotal','buyMine','clickShipSame','clickShipOne','clickShipTwo'].forEach(k=>x[k]+=number(r[k]));
    if(number(r.clickMarketPrice)>0&&r.clickTotal>0){x.marketPriceNum+=r.clickMarketPrice*r.clickTotal;x.marketPriceWeight+=r.clickTotal}
    if(number(r.clickMinePrice)>0&&r.clickMine>0){x.minePriceNum+=r.clickMinePrice*r.clickMine;x.minePriceWeight+=r.clickMine}
  }
  const rows=[...byQuery.values()].map(x=>enrich({...x,score:safeDiv(x.score,x.periods),clickMarketPrice:safeDiv(x.marketPriceNum,x.marketPriceWeight),clickMinePrice:safeDiv(x.minePriceNum,x.minePriceWeight)},reports.length));
  const sortedVolumes=rows.map(r=>r.volume).sort((a,b)=>a-b),reliable=rows.filter(r=>r.buyMine>0&&r.buyTotal>=3),fallback=rows.filter(r=>r.buyMine>0&&r.buyTotal>=2),positiveShares=(reliable.length>=5?reliable:fallback.length>=5?fallback:rows.filter(r=>r.buyMine>0)).map(r=>r.buyShare).sort((a,b)=>a-b);
  const volumePercentile=1-state.rules.volumeTop/100,volGate=sortedVolumes[Math.floor(Math.max(0,sortedVolumes.length-1)*volumePercentile)]||0;
  const autoShareGate=positiveShares[Math.floor(Math.max(0,positiveShares.length-1)*.55)]||1,shareGate=state.rules.shareThreshold===null?autoShareGate:state.rules.shareThreshold;
  rows.forEach(x=>{x.segment=x.clickMine>=state.rules.minFixClicks&&x.buyMine===0?'fix':x.volume>=volGate&&x.buyTotal>=3&&x.buyMine>0&&x.buyShare>=shareGate?'defend':x.volume>=volGate?'growth':'watch'});
  const total={};['volume','impTotal','impMine','clickTotal','clickMine','cartTotal','cartMine','buyTotal','buyMine'].forEach(k=>total[k]=rows.reduce((s,r)=>s+r[k],0));
  return {rows:rows.sort((a,b)=>b.volume-a.volume),total,thresholds:{volGate,shareGate}};
}

function enrich(x,totalPeriods){
  x.marketCTR=safeDiv(x.clickTotal,x.volume)*100;x.marketCart=safeDiv(x.cartTotal,x.volume)*100;x.marketBuy=safeDiv(x.buyTotal,x.volume)*100;
  x.impShare=safeDiv(x.impMine,x.impTotal)*100;x.clickShare=safeDiv(x.clickMine,x.clickTotal)*100;x.cartShare=safeDiv(x.cartMine,x.cartTotal)*100;x.buyShare=safeDiv(x.buyMine,x.buyTotal)*100;
  x.priceGap=x.clickMarketPrice&&x.clickMinePrice?(x.clickMinePrice-x.clickMarketPrice)/x.clickMarketPrice*100:null;x.fastShipRate=x.clickTotal?safeDiv(number(x.clickShipSame)+number(x.clickShipOne)+number(x.clickShipTwo),x.clickTotal)*100:null;
  x.segment='watch';
  x.coverage=`${x.periods}/${totalPeriods}`;return x;
}

function navigate(page){
  const dashboardEmpty=page==='dashboard'&&!state.reports.length;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#emptyState').classList.toggle('hidden',page!=='home'&&!dashboardEmpty);
  $('#dashboard').classList.toggle('hidden',page!=='dashboard'||dashboardEmpty);
  $('#guide').classList.toggle('hidden',page!=='guide');
  try{localStorage.setItem('sqp-lens-last-page',page)}catch{}updateSavedActions();
  if(page==='dashboard'&&state.reports.length)render();
}
function updateSavedActions(){const has=state.reports.length>0;$('#savedActions').classList.toggle('hidden',!has);$('#savedReportCount').textContent=state.reports.length}
function showDashboard(){navigate('dashboard')}
function render(){renderSidebar();renderPeriods();const reports=activeReports();if(!reports.length)return;const data=aggregate(reports);renderHeader(reports);renderKPIs(data,reports);renderInsights(data,reports);renderTrend(reports);renderFunnel(data);renderDecisionMatrix(data);renderTable(data);}

function renderSidebar(){
  const groups=groupScopes();$('#datasetList').innerHTML=[...groups.entries()].map(([k,reports])=>{const [view,entity]=k.split('|');return `<div class="dataset-item ${k===state.scopeKey?'active':''}" data-scope="${esc(k)}"><b>${esc(entity)}</b><span>${view==='brand'?'品牌视图':'ASIN 视图'} · ${reports.length} 个周期</span><button class="dataset-remove" data-remove-scope="${esc(k)}">删除此数据集</button></div>`}).join('');
  document.querySelectorAll('.dataset-item').forEach(el=>el.onclick=()=>{state.scopeKey=el.dataset.scope;state.selectedIds=new Set(groupScopes().get(state.scopeKey).map(r=>r.id));state.selectedQueries.clear();state.page=1;render()});
  document.querySelectorAll('.dataset-remove').forEach(el=>el.onclick=e=>{e.stopPropagation();removeScope(el.dataset.removeScope)});
}
function renderPeriods(){
  const reports=groupScopes().get(state.scopeKey)||[];$('#periodPills').innerHTML=reports.map(r=>`<button class="period-pill ${state.selectedIds.has(r.id)?'active':''}" data-id="${r.id}">${esc(shortPeriod(r))}</button>`).join('');
  document.querySelectorAll('.period-pill').forEach(b=>b.onclick=()=>{if(state.selectedIds.has(b.dataset.id)&&state.selectedIds.size>1)state.selectedIds.delete(b.dataset.id);else state.selectedIds.add(b.dataset.id);state.selectedQueries.clear();state.page=1;syncPeriodMode(reports);render()});
  syncPeriodMode(reports);
}
function setPeriodEditing(editing,reports){$('#periodPills').classList.toggle('editing',editing);$('#periodHint').classList.toggle('hidden',!editing);if(editing)$('#periodHint').textContent=`自定义模式：点击上方周期标签选择或取消，当前已选择 ${reports.filter(r=>state.selectedIds.has(r.id)).length}/${reports.length} 个周期（至少保留 1 个）。`}
function syncPeriodMode(reports){const selected=reports.filter(r=>state.selectedIds.has(r.id)),mode=selected.length===reports.length?'all':selected.length===1&&selected[0]===reports.at(-1)?'latest':'custom';$('#periodMode').value=mode;$('#periodMode').querySelector('[value="custom"]').disabled=reports.length<2;setPeriodEditing(mode==='custom',reports);}
function shortPeriod(r){const week=r.name.match(/(\d{4}年\d+周)/);const quarter=r.name.match(/(\d{4}年第\d季度)/);return week?.[1]||quarter?.[1]||r.date;}
function renderHeader(reports){const [view,entity]=state.scopeKey.split('|');$('#scopeLabel').textContent=view==='brand'?'品牌视图 · BRAND':'ASIN 视图 · PRODUCT';$('#entityTitle').textContent=entity;$('#periodSummary').textContent=`已选择 ${reports.length} 个周期 · ${reports[0].date} 至 ${reports.at(-1).date} · ${aggregate(reports).rows.length} 个去重查询`;}

function renderKPIs(data,reports){
  const t=data.total,last=aggregate([reports.at(-1)]).total,prev=reports.length>1?aggregate([reports.at(-2)]).total:null;const delta=(k)=>prev?pct((last[k]-prev[k])/Math.max(prev[k],1)*100):'单周期';
  const objectName=state.scopeKey.startsWith('brand|')?'当前品牌':'当前 ASIN';
  const cards=[
    ['搜索查询量',fmt.format(t.volume),delta('volume'),'所选周期内买家提交相关搜索查询的次数。同一买家在 24 小时内多次提交相同查询，也会分别计入查询量。'],
    ['市场点击率',pct(safeDiv(t.clickTotal,t.volume)*100),`${fmt.format(t.clickTotal)} 次点击`,'该查询在 Amazon 搜索结果中产生的总点击次数 ÷ 搜索查询量，用于衡量买家搜索后与商品互动的整体程度。'],
    ['对象点击份额',pct(safeDiv(t.clickMine,t.clickTotal)*100),`${fmt.format(t.clickMine)} 次`,`${objectName}获得的点击次数 ÷ 该查询的市场总点击次数。品牌视图会汇总品牌目录下相关 ASIN 的表现。`],
    ['市场加购率',pct(safeDiv(t.cartTotal,t.volume)*100),`${fmt.format(t.cartTotal)} 次加购`,'该查询带来的市场加购总次数 ÷ 搜索查询量。买家可能在搜索结果页或进入商品详情页后完成加购。'],
    ['市场购买率',pct(safeDiv(t.buyTotal,t.volume)*100),`${fmt.format(t.buyTotal)} 次购买`,'该查询归因的市场购买总次数 ÷ 搜索查询量。购买通常归因于查询发生后的 24 小时窗口，可能与业务报告销量不同。'],
    ['对象购买份额',pct(safeDiv(t.buyMine,t.buyTotal)*100),`${fmt.format(t.buyMine)} 次`,`${objectName}的购买次数 ÷ 该查询在市场中的购买总次数，用于判断最终成交份额和流量承接能力。`]
  ];
  $('#kpiGrid').innerHTML=cards.map((c,i)=>`<article class="kpi-card"><label>${c[0]}</label><button class="metric-help" type="button" aria-label="查看${c[0]}释义">?<span class="metric-tooltip"><b>${c[0]}</b>${c[3]}</span></button><strong>${c[1]}</strong><small class="${i===0&&prev?(last.volume>=prev.volume?'delta up':'delta down'):''}">${i===0&&prev?'最新周期 '+c[2]:c[2]}</small></article>`).join('');
}

function renderInsights(data,reports){
  const rows=data.rows,groups={growth:rows.filter(x=>x.segment==='growth').sort((a,b)=>b.volume-a.volume),fix:rows.filter(x=>x.segment==='fix').sort((a,b)=>b.clickMine-a.clickMine),defend:rows.filter(x=>x.segment==='defend').sort((a,b)=>b.buyMine-a.buyMine),watch:rows.filter(x=>x.segment==='watch').sort((a,b)=>b.volume-a.volume)};
  const config={growth:['高潜增长词','opportunity'],fix:['转化修复词','warning'],defend:['优势防守词','defend'],watch:['持续观察词','watch']};
  const descriptions={growth:r=>r?`“${esc(r.query)}”搜索量 ${fmt.format(r.volume)}，购买份额 ${pct(r.buyShare)}。建议：${recommendedAction(r)}`:'当前没有关键词。',fix:r=>r?`“${esc(r.query)}”已有对象点击，但尚未形成购买。建议：${recommendedAction(r)}`:'当前没有关键词。',defend:r=>r?`“${esc(r.query)}”购买份额 ${pct(r.buyShare)}。建议：${recommendedAction(r)}`:'当前没有关键词。',watch:r=>r?`“${esc(r.query)}”信号尚未达到优先阈值。建议：${recommendedAction(r)}`:'当前没有关键词。'};
  $('#insightStrip').innerHTML=Object.entries(config).map(([key,[title,cls]])=>`<div class="insight ${cls}"><div class="insight-head"><b>${groups[key].length} 个${title}</b><button class="insight-export" data-export-segment="${key}">导出</button></div>${descriptions[key](groups[key][0])}</div>`).join('');
  document.querySelectorAll('[data-export-segment]').forEach(b=>b.onclick=()=>exportSegment(b.dataset.exportSegment));
}

function reportTotals(report){return aggregate([report]).total}
function renderTrend(reports){
  $('#trendPurpose').innerHTML=reports.length<2?'<b>当前只有 1 个周期：</b>只能查看该期规模和购买率，无法判断增长或下降；请再选择至少一个同粒度周期。':'<b>用途：</b>同时观察搜索需求和市场购买率是否同向变化；建议比较至少 2–3 个相同粒度的连续周期。';
  const values=reports.map(r=>{const t=reportTotals(r);return {label:shortPeriod(r).replace(/^\d{4}年/,''),volume:t.volume,rate:safeDiv(t.buyTotal,t.volume)*100}});const w=680,h=220,p={l:40,r:35,t:14,b:30};const maxV=Math.max(...values.map(v=>v.volume),1),maxR=Math.max(...values.map(v=>v.rate),1);const x=i=>p.l+(values.length===1?(w-p.l-p.r)/2:i*(w-p.l-p.r)/(values.length-1));const yV=v=>p.t+(1-v/maxV)*(h-p.t-p.b),yR=v=>p.t+(1-v/maxR)*(h-p.t-p.b);const path=(key,y)=>values.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v[key])}`).join(' ');
  $('#trendChart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10233f" stop-opacity=".16"/><stop offset="1" stop-color="#10233f" stop-opacity="0"/></linearGradient></defs>${[0,.25,.5,.75,1].map(q=>`<line class="axis" x1="${p.l}" x2="${w-p.r}" y1="${p.t+q*(h-p.t-p.b)}" y2="${p.t+q*(h-p.t-p.b)}"/>`).join('')}<path class="trend-area" d="${path('volume',yV)} L${x(values.length-1)},${h-p.b} L${x(0)},${h-p.b}Z"/><path class="trend-line" d="${path('volume',yV)}"/><path class="rate-line" d="${path('rate',yR)}"/>${values.map((v,i)=>`<circle class="chart-point" stroke="#10233f" cx="${x(i)}" cy="${yV(v.volume)}" r="3"/><circle class="chart-point" stroke="#1fb99a" cx="${x(i)}" cy="${yR(v.rate)}" r="3"/><text class="axis-label" text-anchor="middle" x="${x(i)}" y="${h-8}">${esc(v.label)}</text>`).join('')}</svg>`;
}

function renderFunnel(data){const t=data.total;const items=[['曝光',t.impTotal,t.impMine],['点击',t.clickTotal,t.clickMine],['加购',t.cartTotal,t.cartMine],['购买',t.buyTotal,t.buyMine]],max=t.impTotal||1;$('#funnelChart').innerHTML=items.map(([name,total,mine])=>`<div class="funnel-row"><b>${name}</b><div class="funnel-track"><div class="funnel-market" style="width:${Math.max(3,safeDiv(total,max)*100)}%"></div><div class="funnel-selected" style="width:${Math.max(mine?1:0,safeDiv(mine,max)*100)}%"></div></div><div class="funnel-value">${pct(safeDiv(mine,total)*100)}</div></div>`).join('')+`<p class="funnel-note">灰色为市场漏斗，绿色为所选品牌 / ASIN。右侧显示阶段份额；份额在漏斗后段上升，通常意味着承接效率更强。</p>`;}

function renderMap(data){
  // Show only the leading queries and reserve labels for the side ranking. SQP datasets
  // commonly contain many zero-share terms; a small deterministic beeswarm keeps them legible.
  const rows=data.rows.filter(r=>r.volume>0).slice(0,60),w=760,h=330,p={l:48,r:18,t:24,b:38};
  if(!rows.length){$('#opportunityMap').innerHTML='<div class="funnel-note">当前范围没有可绘制的查询。</div>';$('#mapHighlights').innerHTML='';return;}
  const maxV=Math.max(...rows.map(r=>r.volume),1),shares=rows.map(r=>r.buyShare).sort((a,b)=>a-b);
  const p90=shares[Math.floor((shares.length-1)*.9)]||0,maxS=Math.max(1,Math.min(Math.max(...shares),p90>0?p90*1.35:1));
  const medV=[...rows].sort((a,b)=>a.volume-b.volume)[Math.floor(rows.length/2)]?.volume||0;
  const plotBottom=h-p.b,x=v=>p.l+Math.log1p(v)/Math.log1p(maxV)*(w-p.l-p.r),y=v=>p.t+(1-Math.min(v,maxS)/maxS)*(plotBottom-p.t-28);
  const qx=x(medV),qy=y(Math.min(1,maxS*.5));
  const hash=s=>[...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  const bubbles=rows.map(r=>{const cx=x(r.volume),nearZero=r.buyShare<.05,cy=nearZero?plotBottom-5-(hash(r.query)%18):y(r.buyShare),rad=Math.max(3,Math.min(10,3+Math.sqrt(r.buyTotal)*.55));return `<circle class="bubble ${r.segment}" cx="${cx}" cy="${cy}" r="${rad}" opacity="${nearZero ? .48 : .72}"><title>${esc(r.query)}｜搜索量 ${fmt.format(r.volume)}｜购买量 ${fmt.format(r.buyTotal)}｜对象购买份额 ${pct(r.buyShare)}</title></circle>`}).join('');
  $('#opportunityMap').innerHTML=`<svg viewBox="0 0 ${w} ${h}"><rect x="${p.l}" y="${p.t}" width="${w-p.l-p.r}" height="${plotBottom-p.t}" rx="8" fill="#fbfcfc"/><rect class="baseline-band" x="${p.l}" y="${plotBottom-27}" width="${w-p.l-p.r}" height="27"/><line class="axis" x1="${qx}" x2="${qx}" y1="${p.t}" y2="${plotBottom-28}" stroke-dasharray="4 4"/><line class="axis" x1="${p.l}" x2="${w-p.r}" y1="${qy}" y2="${qy}" stroke-dasharray="4 4"/><text class="quadrant-label" x="${p.l+9}" y="${p.t+16}">小众优势</text><text class="quadrant-label" x="${qx+9}" y="${p.t+16}">优势防守</text><text class="quadrant-label" x="${p.l+9}" y="${qy+17}">持续观察</text><text class="quadrant-label" x="${qx+9}" y="${qy+17}">高潜增长</text><text class="axis-label" x="${p.l+5}" y="${plotBottom-10}">购买份额 ≈ 0</text>${bubbles}<text class="axis-label" transform="rotate(-90 12 ${h/2})" x="12" y="${h/2}">对象购买份额（显示上限 ${pct(maxS)}）</text><text class="axis-label" text-anchor="middle" x="${w/2}" y="${h-7}">搜索查询量（对数尺度）</text></svg>`;

  const preferred=rows.filter(r=>r.segment==='growth'||r.segment==='fix'),highlights=(preferred.length?preferred:rows).slice(0,6);
  $('#mapHighlights').innerHTML=highlights.map((r,i)=>`<div class="highlight-item"><span class="highlight-rank">${i+1}</span><span class="highlight-query"><b title="${esc(r.query)}">${esc(r.query)}</b><span>${strategy(r.segment)} · 搜索量 ${fmt.format(r.volume)}</span></span><span class="highlight-share">${pct(r.buyShare)}<small>购买份额</small></span></div>`).join('');
}

function renderDecisionMatrix(data){
  const configs=[['growth','高潜增长','高搜索量 · 购买份额待提升'],['fix','转化修复','已有对象点击 · 尚未形成购买'],['defend','优势防守','高搜索量 · 购买份额较强'],['watch','持续观察','规模或信号尚未达到优先阈值']];
  const counts=Object.fromEntries(configs.map(([key])=>[key,data.rows.filter(r=>r.segment===key).length]));
  const maxVolume=Math.max(...data.rows.map(r=>r.volume),1);
  $('#opportunityMap').innerHTML=`<div class="decision-grid">${configs.map(([key,title,hint])=>{const all=data.rows.filter(r=>r.segment===key),top=all.slice(0,5);return `<section class="decision-card ${key}"><div class="decision-card-head"><div><b>${title}</b><p>${hint}</p></div><span>${all.length}</span></div>${top.length?top.map(r=>`<div class="decision-query" data-detail-query="${esc(r.query)}"><div class="decision-query-name"><b title="${esc(r.query)}">${esc(r.query)}</b><span>搜索量 ${fmt.format(r.volume)}</span></div><div class="decision-bar"><i style="width:${Math.max(3,r.volume/maxVolume*100)}%"></i></div><div class="decision-value">${pct(r.buyShare)}<small>购买份额</small></div></div>`).join(''):'<div class="decision-empty">当前没有关键词</div>'}</section>`}).join('')}</div>`;
  $('#mapHighlights').innerHTML=`<div class="threshold-item"><span>高搜索量门槛</span><b>${fmt.format(data.thresholds.volGate)}</b><p>当前范围内搜索量约前 ${state.rules.volumeTop}%</p></div><div class="threshold-item"><span>较强购买份额门槛</span><b>${pct(data.thresholds.shareGate)}</b><p>${state.rules.shareThreshold===null?'优先用市场购买 ≥ 3 的词自动计算':'使用自定义固定门槛'}</p></div><div class="threshold-item"><span>转化修复门槛</span><b>≥ ${state.rules.minFixClicks} 次对象点击</b><p>达到门槛但对象购买为 0 时优先归入转化修复</p></div><div class="threshold-item"><span>对比范围</span><b>${activeReports().length} 个周期</b><p>切换周期后自动门槛会同步重算</p></div>`;
  $('#ruleFlow').innerHTML=`<b>系统按以下顺序判定</b><ol><li class="fix"><span>1</span><div><strong>先找转化修复</strong><p>对象点击 ≥ ${state.rules.minFixClicks} 且对象购买 = 0</p></div><em>${counts.fix} 个</em></li><li class="defend"><span>2</span><div><strong>再找优势防守</strong><p>搜索量 ≥ ${fmt.format(data.thresholds.volGate)}、购买份额 ≥ ${pct(data.thresholds.shareGate)}，且市场购买 ≥ 3</p></div><em>${counts.defend} 个</em></li><li class="growth"><span>3</span><div><strong>再找高潜增长</strong><p>达到高搜索量门槛，但未满足可靠的防守条件</p></div><em>${counts.growth} 个</em></li><li class="watch"><span>4</span><div><strong>其余持续观察</strong><p>未达到以上条件，不需要单独设置门槛</p></div><em>${counts.watch} 个</em></li></ol>`;
  $('#ruleVolumeTop').value=String(state.rules.volumeTop);$('#ruleShareThreshold').value=state.rules.shareThreshold??'';$('#ruleMinFixClicks').value=String(state.rules.minFixClicks);
  document.querySelectorAll('[data-detail-query]').forEach(el=>el.onclick=()=>openQueryDetail(el.dataset.detailQuery));
}

function strategy(s){return {defend:'优势防守',growth:'高潜增长',fix:'转化修复',watch:'持续观察'}[s]}
function recommendedAction(r){
  if(!r.impMine)return '争取曝光：拓词、收录或广告测试';
  if(!r.clickMine)return '提升点击：检查主图、标题与价格';
  if(!r.cartMine)return '提升加购：强化卖点、评价与价格力';
  if(!r.buyMine)return '促进成交：检查优惠、详情与配送';
  if(r.segment==='defend')return '守住排名、库存与价格稳定';
  if(r.segment==='growth')return '扩大有效流量并提升自然排名';
  return '维持观察，等待更多周期信号';
}
function filteredRows(data){
  const q=$('#querySearch').value.trim().toLowerCase(),seg=$('#segmentFilter').value,minVolume=number($('#minVolume').value),minBuyShare=number($('#minBuyShare').value),coverage=$('#coverageFilter').value,signal=$('#signalFilter').value,totalPeriods=activeReports().length;
  return data.rows.filter(r=>(!q||r.query.toLowerCase().includes(q))&&(seg==='all'||r.segment===seg)&&r.volume>=minVolume&&r.buyShare>=minBuyShare&&(coverage==='all'||coverage==='continuous'&&r.periods===totalPeriods||coverage==='multi'&&r.periods>=2||coverage==='single'&&r.periods===1)&&(signal==='all'||signal==='hasBuy'&&r.buyMine>0||signal==='clickNoBuy'&&r.clickMine>0&&r.buyMine===0||signal==='hasVisibility'&&r.impMine>0||signal==='noVisibility'&&r.impMine===0));
}
function renderTable(data){
  const rows=filteredRows(data).sort((a,b)=>{let av=state.sortKey==='segment'?strategy(a.segment):a[state.sortKey],bv=state.sortKey==='segment'?strategy(b.segment):b[state.sortKey];if(typeof av==='string')return av.localeCompare(bv)*(state.sortDir==='asc'?1:-1);return ((av||0)-(bv||0))*(state.sortDir==='asc'?1:-1)});
  const pageSize=state.pageSize==='all'?Math.max(rows.length,1):Number(state.pageSize),totalPages=Math.max(1,Math.ceil(rows.length/pageSize));state.page=Math.min(Math.max(1,state.page),totalPages);const start=(state.page-1)*pageSize,end=Math.min(start+pageSize,rows.length),pageRows=rows.slice(start,end);
  state.currentPageQueries=pageRows.map(r=>r.query.toLowerCase());
  $('#queryTable').innerHTML=pageRows.map(r=>{const key=r.query.toLowerCase();return `<tr data-table-query="${esc(r.query)}"><td class="selection-col"><input class="row-select" type="checkbox" data-select-query="${esc(key)}" ${state.selectedQueries.has(key)?'checked':''} aria-label="选择 ${esc(r.query)}"></td><td title="${esc(r.query)}">${esc(r.query)}</td><td><span class="tag ${r.segment}">${strategy(r.segment)}</span></td><td>${fmt.format(r.score)}</td><td>${fmt.format(r.volume)}</td><td>${pct(r.marketCTR)}</td><td>${pct(r.clickShare)}</td><td>${pct(r.marketBuy)}</td><td>${pct(r.buyShare)}</td><td>${r.coverage}</td></tr>`}).join('');
  document.querySelectorAll('[data-table-query]').forEach(el=>el.onclick=()=>openQueryDetail(el.dataset.tableQuery));
  document.querySelectorAll('.row-select').forEach(box=>{box.onclick=e=>e.stopPropagation();box.onchange=e=>{const key=e.target.dataset.selectQuery;e.target.checked?state.selectedQueries.add(key):state.selectedQueries.delete(key);updateSelectionControls()}});
  document.querySelectorAll('.sort-button').forEach(b=>{const active=b.dataset.sort===state.sortKey;b.classList.toggle('active',active);let i=b.querySelector('i');if(active){if(!i){i=document.createElement('i');b.append(i)}i.textContent=state.sortDir==='asc'?'↑':'↓'}else if(i)i.remove()});
  $('#rowCount').textContent=rows.length?`第 ${start+1}–${end} 条，共 ${rows.length} 个查询`:'当前条件下没有查询';$('#pageSize').value=String(state.pageSize);
  $('#firstPage').disabled=$('#prevPage').disabled=state.page===1;$('#nextPage').disabled=$('#lastPage').disabled=state.page===totalPages;
  const visible=[];for(let p=1;p<=totalPages;p++)if(p===1||p===totalPages||Math.abs(p-state.page)<=2)visible.push(p);let html='',last=0;for(const p of visible){if(last&&p-last>1)html+='<span class="page-ellipsis">…</span>';html+=`<button class="page-number ${p===state.page?'active':''}" data-page="${p}">${p}</button>`;last=p}$('#pageNumbers').innerHTML=html;
  document.querySelectorAll('.page-number').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);renderTable(data)});
  updateSelectionControls();
}

function updateSelectionControls(){
  const selectedOnPage=state.currentPageQueries.filter(q=>state.selectedQueries.has(q)).length,allOnPage=state.currentPageQueries.length>0&&selectedOnPage===state.currentPageQueries.length,selectPage=$('#selectPage');
  selectPage.disabled=!state.currentPageQueries.length;selectPage.checked=allOnPage;selectPage.indeterminate=selectedOnPage>0&&!allOnPage;
  $('#selectedCount').textContent=state.selectedQueries.size;$('#exportSelected').disabled=!state.selectedQueries.size;
}

const detailMetrics={volume:['搜索查询量',false],impShare:['对象曝光份额',true],clickShare:['对象点击份额',true],cartShare:['对象加购份额',true],buyShare:['对象购买份额',true],marketCTR:['市场 CTR',true],marketBuy:['市场购买率',true],priceGap:['对象点击价差',true],fastShipRate:['市场 2 日内配送点击占比',true]};
function queryPeriodData(query){return activeReports().map(report=>{const raw=report.rows.find(r=>r.query.toLowerCase()===query.toLowerCase());if(!raw)return {report,value:null};const value={...raw,marketCTR:safeDiv(raw.clickTotal,raw.volume)*100,marketBuy:safeDiv(raw.buyTotal,raw.volume)*100,impShare:safeDiv(raw.impMine,raw.impTotal)*100,clickShare:safeDiv(raw.clickMine,raw.clickTotal)*100,cartShare:safeDiv(raw.cartMine,raw.cartTotal)*100,buyShare:safeDiv(raw.buyMine,raw.buyTotal)*100,priceGap:raw.clickMarketPrice&&raw.clickMinePrice?(raw.clickMinePrice-raw.clickMarketPrice)/raw.clickMarketPrice*100:null,fastShipRate:raw.clickTotal?safeDiv(number(raw.clickShipSame)+number(raw.clickShipOne)+number(raw.clickShipTwo),raw.clickTotal)*100:null};return {report,value}})}
function openQueryDetail(query){state.detailQuery=query;$('#queryDetailTitle').textContent=query;$('#queryModal').classList.remove('hidden');document.body.classList.add('modal-open');renderQueryDetail()}
function closeQueryDetail(){$('#queryModal').classList.add('hidden');if($('#recordModal').classList.contains('hidden'))document.body.classList.remove('modal-open')}
function renderQueryDetail(){
  const series=queryPeriodData(state.detailQuery),present=series.filter(x=>x.value),metric=$('#detailMetric').value,[label,isPercent]=detailMetrics[metric];
  $('#queryDetailMeta').textContent=`${state.scopeKey.split('|').slice(1).join('|')} · 出现在 ${present.length}/${series.length} 个所选周期`;
  const agg=aggregate(activeReports()).rows.find(r=>r.query.toLowerCase()===state.detailQuery.toLowerCase());
  const first=present[0]?.value,last=present.at(-1)?.value,firstMetric=first?.[metric],lastMetric=last?.[metric],change=first!==last&&Number.isFinite(firstMetric)&&Number.isFinite(lastMetric)?safeDiv(lastMetric-firstMetric,Math.abs(firstMetric)||1)*100:null;
  $('#queryDetailSummary').innerHTML=`<span>合并搜索量<b>${fmt.format(agg?.volume||0)}</b></span><span>合并购买份额<b>${pct(agg?.buyShare||0)}</b></span><span>对象/市场点击价<b>${agg?.priceGap===null?'无对象价格':`${pct(agg.priceGap)} · $${fmt.format(agg.clickMinePrice)}/$${fmt.format(agg.clickMarketPrice)}`}</b></span><span>建议动作<b>${esc(recommendedAction(agg||{}))}</b></span><span>${label} 首末变化<b class="${change>=0?'delta up':'delta down'}">${change===null?'—':`${change>=0?'+':''}${pct(change)}`}</b></span>`;
  const w=940,h=205,p={l:45,r:24,t:18,b:34},values=series.map(x=>x.value?.[metric]??null),valid=values.filter(v=>v!==null),max=Math.max(...valid,1),min=Math.min(...valid,0),span=Math.max(max-min,1),x=i=>p.l+(series.length===1?(w-p.l-p.r)/2:i*(w-p.l-p.r)/(series.length-1)),y=v=>p.t+(max-v)/span*(h-p.t-p.b);let path='',drawing=false;
  values.forEach((v,i)=>{if(v===null){drawing=false;return}path+=`${drawing?' L':' M'}${x(i)},${y(v)}`;drawing=true});
  $('#queryTrendChart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${[0,.25,.5,.75,1].map(q=>`<line class="axis" x1="${p.l}" x2="${w-p.r}" y1="${p.t+q*(h-p.t-p.b)}" y2="${p.t+q*(h-p.t-p.b)}"/>`).join('')}<path class="rate-line" d="${path}"/>${series.map((s,i)=>s.value?`<circle class="chart-point" stroke="#1fb99a" cx="${x(i)}" cy="${y(s.value[metric])}" r="4"><title>${isPercent?pct(s.value[metric]):fmt.format(s.value[metric])}</title></circle>`:`<circle cx="${x(i)}" cy="${h-p.b}" r="3" fill="#f5a947"><title>未进入 Top N</title></circle>`).join('')}${series.map((s,i)=>`<text class="axis-label" text-anchor="middle" x="${x(i)}" y="${h-9}">${esc(shortPeriod(s.report).replace(/^\d{4}年/,''))}</text>`).join('')}<text class="axis-label" x="3" y="${p.t+4}">${isPercent?pct(max):fmt.format(max)}</text></svg>`;
  const tableSeries=[...series].sort((a,b)=>{const key=state.detailSortKey,av=key==='date'?a.report.date:a.value?.[key],bv=key==='date'?b.report.date:b.value?.[key];if(av===null||av===undefined)return bv===null||bv===undefined?0:1;if(bv===null||bv===undefined)return -1;const result=typeof av==='string'?av.localeCompare(bv):av-bv;return result*(state.detailSortDir==='asc'?1:-1)});
  $('#queryPeriodRows').innerHTML=tableSeries.map(({report,value})=>value?`<tr><td>${esc(shortPeriod(report))}</td><td>${fmt.format(value.score)}</td><td>${fmt.format(value.volume)}</td><td>${pct(value.impShare)}</td><td>${pct(value.clickShare)}</td><td>${pct(value.cartShare)}</td><td>${pct(value.buyShare)}</td><td>${pct(value.marketCTR)}</td><td>${pct(value.marketBuy)}</td><td>${value.priceGap===null?'—':pct(value.priceGap)}</td><td>${pct(value.fastShipRate)}</td></tr>`:`<tr><td>${esc(shortPeriod(report))}</td><td class="missing-period" colspan="10">未进入该周期报告 Top N</td></tr>`).join('');
  document.querySelectorAll('.detail-sort').forEach(b=>{const active=b.dataset.detailSort===state.detailSortKey;b.classList.toggle('active',active);b.querySelector('i').textContent=active?(state.detailSortDir==='asc'?'↑':'↓'):''});
}

function openRecordManager(){renderRecordManager();$('#recordModal').classList.remove('hidden');document.body.classList.add('modal-open')}
function closeRecordManager(){$('#recordModal').classList.add('hidden');document.body.classList.remove('modal-open')}
function renderRecordManager(){
  const reports=[...state.reports].sort((a,b)=>b.date.localeCompare(a.date)),scopes=groupScopes().size,totalRows=reports.reduce((n,r)=>n+r.rows.length,0);
  $('#recordSummary').innerHTML=`<div class="record-stat"><span>导入报告</span><b>${reports.length}</b></div><div class="record-stat"><span>品牌 / ASIN 对象</span><b>${scopes}</b></div><div class="record-stat"><span>数据行</span><b>${fmt.format(totalRows)}</b></div>`;
  const mixed=[...groupScopes().values()].filter(rs=>new Set(rs.map(r=>r.meta.range)).size>1).length,possibleCaps=reports.filter(r=>r.quality?.possibleTopN).length,noEvents=reports.filter(r=>r.quality?.noObjectEvents).length,issues=mixed+noEvents;
  $('#qualitySummary').innerHTML=`<div class="quality-banner ${issues?'':'good'}"><span class="quality-dot"></span><span><b>${issues?'发现数据注意项':'数据结构检查通过'}</b><br>${mixed?`${mixed} 个对象混用了不同周期粒度；`:''}${noEvents?`${noEvents} 份报告没有识别到对象事件；`:''}${possibleCaps?`${possibleCaps} 份报告可能达到 Top N 行数上限。`:''}${!mixed&&!noEvents&&!possibleCaps?'必要字段完整，未发现周期粒度混用。':''}</span></div>`;
  $('#recordList').innerHTML=reports.length?reports.map(r=>`<div class="record-row"><div class="record-name"><b>${esc(r.meta.entity)}</b><span title="${esc(r.name)}">${esc(r.name)}</span></div><span class="record-view">${r.meta.view==='brand'?'品牌视图':'ASIN 视图'}</span><span class="record-period">${esc(shortPeriod(r))}</span><span class="record-count">${fmt.format(r.rows.length)} 行</span><button class="record-delete" data-delete-id="${r.id}">删除</button></div>`).join(''):'<div class="record-empty">当前没有导入记录</div>';
  document.querySelectorAll('[data-delete-id]').forEach(b=>b.onclick=()=>removeReport(b.dataset.deleteId));
}
function removeReport(id){
  const report=state.reports.find(r=>r.id===id);if(!report)return;
  if(!confirm(`删除“${report.meta.entity}”的 ${shortPeriod(report)} 报告？\n此操作只删除当前页面中的记录，不影响原始 CSV 文件。`))return;
  state.reports=state.reports.filter(r=>r.id!==id);persistReports();reconcileRecords(scopeOf(report));toast('已删除 1 份报告');
}
function removeScope(key){
  const reports=state.reports.filter(r=>scopeOf(r)===key);if(!reports.length)return;const entity=key.split('|').slice(1).join('|');
  if(!confirm(`删除“${entity}”的全部 ${reports.length} 个周期记录？\n原始 CSV 文件不会被删除。`))return;
  state.reports=state.reports.filter(r=>scopeOf(r)!==key);persistReports();reconcileRecords(key);toast(`已删除 ${reports.length} 份报告`);
}
function clearAllRecords(){
  if(!state.reports.length)return;if(!confirm(`清空当前页面中的全部 ${state.reports.length} 份导入记录？\n原始 CSV 文件不会被删除。`))return;
  state.reports=[];dbDelete('reports');reconcileRecords('');toast('已清空全部导入记录');
}
function reconcileRecords(previousScope){
  state.selectedQueries.clear();state.page=1;
  if(!state.reports.length){state.scopeKey='';state.selectedIds.clear();closeRecordManager();navigate('home');return;}
  const groups=groupScopes();
  if(!groups.has(state.scopeKey)||state.scopeKey===previousScope&&!groups.has(previousScope)){state.scopeKey='';setDefaultScope();}
  else{const valid=new Set(groups.get(state.scopeKey).map(r=>r.id));state.selectedIds=new Set([...state.selectedIds].filter(id=>valid.has(id)));if(!state.selectedIds.size)state.selectedIds=valid;}
  render();if(!$('#recordModal').classList.contains('hidden'))renderRecordManager();
}

function backupRecords(){
  if(!state.reports.length)return toast('当前没有可备份的记录');
  const payload={format:'SQP_LENS_BACKUP',version:1,exportedAt:new Date().toISOString(),reports:state.reports};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));a.download=`SQP_Lens_Backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('备份文件已生成');
}
async function restoreBackup(file){
  try{const payload=JSON.parse(await file.text());if(payload.format!=='SQP_LENS_BACKUP'||payload.version!==1||!Array.isArray(payload.reports))throw Error('备份格式不正确');
    const valid=payload.reports.every(r=>r&&r.meta&&Array.isArray(r.rows)&&r.date);if(!valid)throw Error('备份内容不完整');
    state.reports.push(...payload.reports.map(r=>({...r,id:r.id||`restored-${Math.random().toString(36).slice(2)}`})));const duplicates=dedupeReports();state.scopeKey='';setDefaultScope();await persistReports();showDashboard();openRecordManager();toast(`已恢复 ${payload.reports.length-duplicates} 份记录`);
  }catch(e){toast(`恢复失败：${e.message}`)}finally{$('#backupInput').value=''}
}

function exportRows(rows,label){
  if(!rows.length)return toast('当前条件下没有可导出的关键词');
  const headers=['搜索查询','策略','建议动作','查询得分','搜索查询量','市场CTR%','对象曝光份额%','对象点击份额%','市场加购率%','对象加购份额%','市场购买率%','对象购买份额%','市场点击中位参考价','对象点击中位参考价','对象点击价差%','市场2日内配送点击占比%','对象曝光数','对象点击数','对象加购数','对象购买数','周期覆盖'];
  const body=rows.map(r=>[r.query,strategy(r.segment),recommendedAction(r),r.score,r.volume,r.marketCTR,r.impShare,r.clickShare,r.marketCart,r.cartShare,r.marketBuy,r.buyShare,r.clickMarketPrice||'',r.clickMinePrice||'',r.priceGap??'',r.fastShipRate??'',r.impMine,r.clickMine,r.cartMine,r.buyMine,r.coverage]);
  const csv='\uFEFF'+[headers,...body].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`SQP_${label}_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast(`已导出 ${rows.length} 个关键词`);
}
function exportCurrent(){exportRows(filteredRows(aggregate(activeReports())),'当前筛选')}
function exportSelectedRows(){const selected=state.selectedQueries;exportRows(aggregate(activeReports()).rows.filter(r=>selected.has(r.query.toLowerCase())),'选中关键词')}
function exportSegment(segment){exportRows(aggregate(activeReports()).rows.filter(r=>r.segment===segment),strategy(segment))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}

const input=$('#fileInput');['#chooseFiles','#uploadTop','#addFiles'].forEach(s=>$(s).onclick=()=>input.click());input.onchange=()=>importFiles([...input.files]);
['#manageRecords','#manageRecordsSide'].forEach(s=>$(s).onclick=openRecordManager);
$('#closeRecords').onclick=closeRecordManager;
$('#clearRecords').onclick=clearAllRecords;
$('#backupRecords').onclick=backupRecords;
$('#restoreRecords').onclick=()=>$('#backupInput').click();
$('#restoreFromEmpty').onclick=()=>$('#backupInput').click();
$('#backupInput').onchange=()=>{if($('#backupInput').files[0])restoreBackup($('#backupInput').files[0])};
$('#addFromRecords').onclick=()=>{closeRecordManager();input.click()};
$('#continueAnalysis').onclick=showDashboard;
$('#manageFromHome').onclick=openRecordManager;
$('#recordModal').onclick=e=>{if(e.target===$('#recordModal'))closeRecordManager()};
$('#closeQueryDetail').onclick=closeQueryDetail;
$('#detailMetric').onchange=renderQueryDetail;
document.querySelectorAll('.detail-sort').forEach(b=>b.onclick=()=>{const key=b.dataset.detailSort;if(state.detailSortKey===key)state.detailSortDir=state.detailSortDir==='asc'?'desc':'asc';else{state.detailSortKey=key;state.detailSortDir=key==='date'?'desc':'desc'}renderQueryDetail()});
$('#queryModal').onclick=e=>{if(e.target===$('#queryModal'))closeQueryDetail()};
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('#queryModal').classList.contains('hidden'))closeQueryDetail();else if(!$('#recordModal').classList.contains('hidden'))closeRecordManager()});
const dz=$('#dropZone');['dragenter','dragover'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(e=>dz.addEventListener(e,x=>{x.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>importFiles([...e.dataTransfer.files].filter(f=>f.name.toLowerCase().endsWith('.csv'))));
$('#periodMode').onchange=e=>{const reports=groupScopes().get(state.scopeKey)||[];if(e.target.value==='custom'){setPeriodEditing(true,reports);return}state.selectedIds=new Set((e.target.value==='latest'?[reports.at(-1)]:reports).filter(Boolean).map(r=>r.id));state.selectedQueries.clear();state.page=1;render()};
const refreshFilteredTable=()=>{state.page=1;renderTable(aggregate(activeReports()))};
$('#querySearch').oninput=refreshFilteredTable;$('#segmentFilter').onchange=refreshFilteredTable;
['#minVolume','#minBuyShare'].forEach(s=>$(s).oninput=refreshFilteredTable);['#coverageFilter','#signalFilter'].forEach(s=>$(s).onchange=refreshFilteredTable);
$('#toggleAdvanced').onclick=()=>{const hidden=$('#advancedFilters').classList.toggle('hidden');$('#toggleAdvanced').textContent=hidden?'更多筛选':'收起筛选'};
$('#resetFilters').onclick=()=>{$('#querySearch').value='';$('#segmentFilter').value='all';$('#minVolume').value='';$('#minBuyShare').value='';$('#coverageFilter').value='all';$('#signalFilter').value='all';refreshFilteredTable()};
$('#pageSize').onchange=e=>{state.pageSize=e.target.value==='all'?'all':Number(e.target.value);state.page=1;renderTable(aggregate(activeReports()))};
$('#firstPage').onclick=()=>{state.page=1;renderTable(aggregate(activeReports()))};$('#prevPage').onclick=()=>{state.page--;renderTable(aggregate(activeReports()))};$('#nextPage').onclick=()=>{state.page++;renderTable(aggregate(activeReports()))};$('#lastPage').onclick=()=>{const data=aggregate(activeReports()),count=filteredRows(data).length,size=state.pageSize==='all'?Math.max(count,1):Number(state.pageSize);state.page=Math.max(1,Math.ceil(count/size));renderTable(data)};
$('#exportCsv').onclick=exportCurrent;
$('#exportSelected').onclick=exportSelectedRows;
$('#selectPage').onchange=e=>{state.currentPageQueries.forEach(q=>e.target.checked?state.selectedQueries.add(q):state.selectedQueries.delete(q));renderTable(aggregate(activeReports()))};
function applyRuleInputs(){state.rules.volumeTop=number($('#ruleVolumeTop').value)||20;const share=$('#ruleShareThreshold').value.trim();state.rules.shareThreshold=share===''?null:Math.max(0,Math.min(100,number(share)));state.rules.minFixClicks=Math.max(1,Math.round(number($('#ruleMinFixClicks').value)||3));try{localStorage.setItem('sqp-lens-rules',JSON.stringify(state.rules))}catch{}state.page=1;render();toast('分群标准已更新')}
$('#applyRules').onclick=applyRuleInputs;
$('#resetRules').onclick=()=>{state.rules={volumeTop:20,shareThreshold:null,minFixClicks:3};try{localStorage.removeItem('sqp-lens-rules')}catch{}state.page=1;render();toast('已恢复推荐标准')};
document.querySelectorAll('[data-rule-preset]').forEach(b=>b.onclick=()=>{$('#ruleVolumeTop').value=b.dataset.volume;$('#ruleShareThreshold').value='';$('#ruleMinFixClicks').value=b.dataset.clicks;applyRuleInputs()});
document.querySelectorAll('.sort-button').forEach(b=>b.onclick=()=>{const key=b.dataset.sort;if(state.sortKey===key)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sortKey=key;state.sortDir=key==='query'||key==='segment'?'asc':'desc'}state.page=1;renderTable(aggregate(activeReports()))});
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.page));

async function bootstrap(){
  try{const savedRules=JSON.parse(localStorage.getItem('sqp-lens-rules')||'null');if(savedRules&&[10,20,30].includes(Number(savedRules.volumeTop)))state.rules={volumeTop:Number(savedRules.volumeTop),shareThreshold:savedRules.shareThreshold===null?null:Math.max(0,Math.min(100,number(savedRules.shareThreshold))),minFixClicks:Math.max(1,Math.round(number(savedRules.minFixClicks)||3))}}catch{}
  try{const saved=await dbGet('reports');if(Array.isArray(saved)){state.reports=saved;dedupeReports();if(state.reports.length)setDefaultScope()}}catch(e){console.warn('无法读取本机记录',e)}
  let page='home';try{page=localStorage.getItem('sqp-lens-last-page')||'home'}catch{}
  navigate(page);
}
bootstrap();
