const STORAGE_KEY = 'freight-invoice-products-v1';
const EXPORT_KEY = 'freight-invoice-export-count-v1';
const BACKUP_DB_NAME = 'freight-invoice-browser-backup-v1';
const BACKUP_STORE_NAME = 'snapshots';
const CURRENCIES = ['USD','EUR','GBP','CNY','JPY','HKD','CAD','AUD'];
const API_BASE = window.FREIGHT_INVOICE_API_BASE || '/api/freight-invoice-python';
const ORIGINAL_FETCH = window.fetch.bind(window);

function freightInvoiceApiUrl(apiUrl){
  const source=new URL(apiUrl,window.location.origin),target=new URL(API_BASE,window.location.origin);
  target.searchParams.set('path',source.pathname.slice(4)||'/config');
  source.searchParams.forEach((value,key)=>target.searchParams.append(key,value));
  return target.toString();
}

function resolveApiInput(input){
  if(typeof input==='string'&&input.startsWith('/api/'))return freightInvoiceApiUrl(input);
  if(input instanceof Request&&input.url.startsWith(window.location.origin+'/api/')){
    return new Request(freightInvoiceApiUrl(input.url),input);
  }
  return input;
}

window.fetch=(input,init)=>ORIGINAL_FETCH(resolveApiInput(input),init);

const state = {
  products: loadProducts(),
  config: { templates: [], channels: [] },
  templateCatalog: [],
  templateFieldCatalog: { fixed: [], items: [] },
  fieldCatalogAll: { fixed: [], items: [] },
  preventBrowserMirror: false,
  templateEditor: null,
  templateId: '',
  shipment: {},
  items: [],
  previewWorkbook: null,
  previewSheetIndex: 0,
  previewZoom: 1.4,
  previewEdits: [],
  addressAuto: {},
  warehouseResults: [],
  selectedWarehouse: null,
  warehouseSearchSequence: 0,
  history: [],
  draftUpdatedAt: '',
  draftRecord: null,
  draftDirty: false,
  draftRevision: 0,
  selectedProductIds: new Set(),
  selectedTemplateIds: new Set(),
  selectedHistoryIds: new Set()
};

const commonFields = [
  ['receiverCompany','收件公司','text','美国亚马逊'], ['receiverName','收件人','text','Amazon Fulfillment Center'],
  ['address1','收件地址一','textarea',''], ['address2','收件地址二','text',''],
  ['city','城市','text',''], ['state','省份 / 州','text',''], ['postalCode','邮编','text',''],
  ['countryCode','国家二字代码','text','US'], ['phone','联系电话','text',''], ['email','邮箱','email',''],
  ['fbaNumber','FBA 号 / 客户订单号 *','text',''], ['amazonReferenceId','Amazon Reference ID *','text','']
];

const yuntuoFields = [
  ['service','服务渠道 *','channel',''], ['boxCount','总箱数','number','1'], ['currency','申报币种','currency','USD'],
  ['hasBattery','整票带电','yesno','否'], ['hasMagnet','整票带磁','yesno','否'], ['customsMode','报关方式','customs','买单报关'],
  ['vatNumber','VAT 号','text',''], ['eori','EORI','text',''], ['vatName','VAT 注册名','text',''],
  ['vatAddress','VAT 注册地址','textarea',''], ['notes','备注','textarea','']
];

const customTemplateFields = [
  ['address3','收件地址三','text',''], ['warehouseCode','地址库编码','text',''],
  ['hasLiquid','整票含液体','yesno','否'], ['hasPowder','整票含粉末','yesno','否'],
  ['clearanceMode','清关方式','text','一般贸易清关'], ['taxMode','交税方式','text','包税'],
  ['incoterm','交货条款','text','DDP'], ['vatCountry','VAT 注册国家','text',''],
  ['appointmentWindow','预约配送时段','text','']
];

function $(selector, root=document){ return root.querySelector(selector); }
function $$(selector, root=document){ return [...root.querySelectorAll(selector)]; }
function esc(value=''){ return String(value ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function uid(){ return (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`); }
function num(value){ const n = Number(value); return Number.isFinite(n) ? n : 0; }
function fmt(value, digits=2){ return num(value).toLocaleString('zh-CN',{maximumFractionDigits:digits,minimumFractionDigits:digits}); }
function normalizeProduct(product={}){const value=product.productWeight!==undefined?product.productWeight:(product.unitNetWeight||product.unitGrossWeight||0);return {...product,exportSku:product.exportSku||'',productWeight:num(value),weightUnit:product.weightUnit||'kg'}}
function weightToKg(value,unit='kg'){const factors={g:.001,kg:1,oz:.028349523125,lb:.45359237};return num(value)*(factors[unit]||1)}
function weightText(value,unit='kg'){return `${fmt(value,4).replace(/\.?(0+)$/,'')} ${unit}`}

function loadProducts(){ try { return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(normalizeProduct); } catch { return []; } }
function openBackupDatabase(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('当前浏览器不支持完整本地备份'));return}const request=indexedDB.open(BACKUP_DB_NAME,1);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(BACKUP_STORE_NAME))database.createObjectStore(BACKUP_STORE_NAME,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('浏览器备份数据库打开失败'))})}
async function saveBrowserBackup(blob,counts={}){const database=await openBackupDatabase();return new Promise((resolve,reject)=>{const transaction=database.transaction(BACKUP_STORE_NAME,'readwrite');transaction.objectStore(BACKUP_STORE_NAME).put({id:'latest',blob,counts,updatedAt:new Date().toISOString()});transaction.oncomplete=()=>{database.close();const status=$('#appStorageMode');if(status&&!status.textContent.includes('浏览器已备份'))status.textContent=`${status.textContent} · 浏览器已备份`;resolve()};transaction.onerror=()=>{database.close();reject(transaction.error)}})}
async function readBrowserBackup(){try{const database=await openBackupDatabase();return await new Promise((resolve,reject)=>{const transaction=database.transaction(BACKUP_STORE_NAME,'readonly'),request=transaction.objectStore(BACKUP_STORE_NAME).get('latest');request.onsuccess=()=>{database.close();resolve(request.result||null)};request.onerror=()=>{database.close();reject(request.error)}})}catch{return null}}
async function clearBrowserBackup(){try{const database=await openBackupDatabase();await new Promise((resolve,reject)=>{const transaction=database.transaction(BACKUP_STORE_NAME,'readwrite');transaction.objectStore(BACKUP_STORE_NAME).delete('latest');transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error)});database.close()}catch{/* Server data is still cleared when IndexedDB is unavailable. */}}
function backupCountsFromResponse(response){try{const encoded=response.headers.get('X-Backup-Counts');return encoded?JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)))):{}}catch{return {}}}
function backupCountsHaveUserData(counts={}){return num(counts.products)>0||num(counts.templates)>0||num(counts.history)>0||counts.hasDraft===true}
async function refreshBrowserMirror(){if(state.preventBrowserMirror)return;try{const response=await fetch('/api/backup');if(!response.ok)return;const counts=backupCountsFromResponse(response),blob=await response.blob();if(state.preventBrowserMirror)return;if(!backupCountsHaveUserData(counts)){await clearBrowserBackup();return}await saveBrowserBackup(blob,counts)}catch{/* Manual ZIP backup remains available if IndexedDB is unavailable. */}}
function scheduleBrowserMirror(){clearTimeout(scheduleBrowserMirror.timer);if(state.preventBrowserMirror)return;scheduleBrowserMirror.timer=setTimeout(refreshBrowserMirror,900)}
async function restoreBackupBlob(blob){const response=await fetch('/api/restore',{method:'POST',headers:{'Content-Type':'application/zip'},body:blob});const data=await response.json();if(!response.ok)throw new Error(data.error||'完整备份恢复失败');await saveBrowserBackup(blob,data.restored||{});return data.restored||{}}
function saveProducts(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));persistProductsToServer();renderProducts();updateStats(); }
async function persistProductsToServer(){try{const response=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products:state.products})});if(response.ok)scheduleBrowserMirror()}catch{/* Browser storage remains as a fallback. */}}
async function syncProductsFromServer(){
  try{
    const response=await fetch('/api/products');if(!response.ok)return;const serverProducts=((await response.json()).products||[]).map(normalizeProduct);
    state.products=serverProducts;localStorage.setItem(STORAGE_KEY,JSON.stringify(state.products));
  }catch{/* Continue with browser storage when the local service is unavailable. */}
}
function toast(message, error=false){ const el=$('#toast'); el.textContent=message; el.className=`toast show${error?' error':''}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='toast',2600); }
function invalidatePreview(saveDraft=true){state.previewWorkbook=null;state.previewEdits=[];if(saveDraft)scheduleDraftSave()}

function invoiceDraftPayload(){return {templateId:state.templateId,shipment:state.shipment,items:state.items,selectedWarehouse:state.selectedWarehouse,cellEdits:state.previewEdits||[]}}
function setDraftStatus(text,status=''){const element=$('#draftStatus');if(!element)return;element.textContent=text;element.className=`draft-status${status?' '+status:''}`}
function scheduleDraftSave(){state.draftDirty=true;state.draftRevision++;clearTimeout(scheduleDraftSave.timer);setDraftStatus('草稿待保存','saving');scheduleDraftSave.timer=setTimeout(saveDraftNow,500)}
async function saveDraftNow(){
  clearTimeout(scheduleDraftSave.timer);const revision=state.draftRevision;setDraftStatus('正在保存草稿…','saving');
  try{const payload=invoiceDraftPayload();const response=await fetch('/api/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw new Error(data.error||'草稿保存失败');state.draftUpdatedAt=data.updatedAt||'';state.draftRecord={updatedAt:data.updatedAt,payload:structuredClone(payload)};if(revision===state.draftRevision){state.draftDirty=false;setDraftStatus(`草稿已保存 ${new Date(data.updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`,'saved')}renderDraftManager();scheduleBrowserMirror()}
  catch{setDraftStatus('草稿保存失败','error')}
}
async function restoreDraft(){
  try{const response=await fetch('/api/draft');const data=await response.json();if(!response.ok||!data.draft){state.draftRecord=null;state.draftDirty=false;renderDraftManager();return false}const payload=data.draft.payload||{};state.draftRecord=data.draft;state.templateId=payload.templateId||'ruichi';state.shipment=structuredClone(payload.shipment||{});state.items=(payload.items||[]).map(item=>({...normalizeProduct(structuredClone(item)),id:item.id||uid()}));state.selectedWarehouse=payload.selectedWarehouse||null;state.previewEdits=payload.cellEdits||[];state.draftUpdatedAt=data.draft.updatedAt||'';state.draftDirty=false;setDraftStatus(`已恢复草稿 ${new Date(data.draft.updatedAt).toLocaleString('zh-CN',{hour12:false})}`,'saved');renderDraftManager();return true}catch{return false}
}
async function clearDraft(){clearTimeout(scheduleDraftSave.timer);try{const response=await fetch('/api/draft',{method:'DELETE'});if(response.ok)scheduleBrowserMirror()}catch{}state.draftUpdatedAt='';state.draftRecord=null;state.draftDirty=false;setDraftStatus('尚未保存草稿');renderDraftManager()}

function parseShippingAddress(value=''){
  const text=String(value).replace(/\r/g,'').trim();if(!text)return {};
  const result={};
  const usLocation=text.match(/(?:^|\n)\s*([^\n,]+?)\s*,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:\s|$)/i);
  if(usLocation){result.city=usLocation[1].trim().toUpperCase();result.state=usLocation[2].toUpperCase();result.postalCode=usLocation[3];result.countryCode='US'}
  const knownCodes=new Set(['US','GB','DE','FR','IT','ES','PL','CA','MX','AU','JP','NL','BE','SE','NO','DK','AT','CZ','CH','IE','PT']);
  const lines=text.split('\n').map(line=>line.trim()).filter(Boolean);
  const firstToken=(lines[0]||'').match(/^([A-Z0-9]{3,6})(?:\s|\(|$)/i)?.[1]||'';
  const parenthesized=text.match(/\(([A-Z0-9]{3,6})\)/i)?.[1]||'';
  const possibleWarehouseCode=firstToken||parenthesized;
  if(/[A-Z]/i.test(possibleWarehouseCode)&&/\d/.test(possibleWarehouseCode))result.warehouseCode=possibleWarehouseCode.toUpperCase();
  for(const line of [...lines].reverse()){
    const match=line.match(/^([A-Z]{2})(?:\s*\(|\s*$)/i);
    if(match&&knownCodes.has(match[1].toUpperCase())){result.countryCode=match[1].toUpperCase();break}
  }
  return result;
}

function applyAddressAutofill(value){
  const parsed=parseShippingAddress(value);let changed=false;
  for(const key of ['warehouseCode','city','state','postalCode','countryCode']){
    if(!parsed[key])continue;
    const current=state.shipment[key]||'';
    if(!current||current===state.addressAuto[key]){
      state.shipment[key]=parsed[key];state.addressAuto[key]=parsed[key];
      const input=$(`[data-shipment="${key}"]`);if(input)input.value=parsed[key];changed=true;
    }
  }
  if(changed){invalidatePreview();toast(`已识别：${[parsed.warehouseCode,parsed.city,parsed.state,parsed.postalCode,parsed.countryCode].filter(Boolean).join(' / ')}`)}
}

function requiredValueMissing(value){return value===undefined||value===null||(typeof value==='string'&&!value.trim())}
function templateFieldLabel(category,key){return (state.templateFieldCatalog?.[category]||[]).find(field=>field.key===key)?.label||key}
function customRequiredFixedValue(key){
  if(key==='fullAddress'||key==='fullAddressInline')return [state.shipment.warehouseCode,state.shipment.address1,state.shipment.address2,state.shipment.address3,state.shipment.city,state.shipment.state,state.shipment.postalCode,state.shipment.countryCode].filter(Boolean).join(' ');
  if(key==='currency')return state.items[0]?.currency||state.shipment.currency;
  if(key==='totalCartons')return state.items.reduce((sum,item)=>sum+Math.max(1,Math.floor(num(item.cartons)||1)),0);
  if(key==='totalQuantity')return state.items.reduce((sum,item)=>sum+num(item.quantity)*Math.max(1,Math.floor(num(item.cartons)||1)),0);
  if(key==='totalGrossWeight')return state.items.reduce((sum,item)=>sum+num(item.grossWeight)*Math.max(1,Math.floor(num(item.cartons)||1)),0);
  if(key==='totalNetWeight')return state.items.reduce((sum,item)=>sum+num(item.netWeight)*Math.max(1,Math.floor(num(item.cartons)||1)),0);
  if(key==='totalValue')return state.items.reduce((sum,item)=>sum+num(item.quantity)*num(item.unitPrice)*Math.max(1,Math.floor(num(item.cartons)||1)),0);
  return state.shipment[key];
}
function customRequiredItemValue(item,key){
  if(key==='material')return [item.materialZh,item.materialEn].filter(Boolean).join(' ');
  if(key==='purpose')return [item.purposeZh,item.purposeEn].filter(Boolean).join(' ');
  if(key==='productWeightText')return item.unitWeightText||item.productWeight||item.unitWeight;
  if(key==='boxNumber')return item.boxNumber||state.shipment.fbaNumber;
  if(key==='poNumber')return item.poNumber||state.shipment.amazonReferenceId;
  if(key==='appointmentWindow')return item.appointmentWindow||state.shipment.appointmentWindow;
  if(key==='totalQuantity')return num(item.quantity)*Math.max(1,Math.floor(num(item.cartons)||1));
  if(key==='totalAmount')return num(item.quantity)*num(item.unitPrice)*Math.max(1,Math.floor(num(item.cartons)||1));
  return item[key];
}
function invoiceValidationErrors(){
  const errors=[];
  if(!state.templateId)errors.push('请先在模板中心上传并配置一个 Excel 模板');
  if((isRuichiTemplate()||isYuntuoTemplate())&&!String(state.shipment.fbaNumber||'').trim())errors.push('请填写客户订单号(FBA#)');
  if((isRuichiTemplate()||isYuntuoTemplate())&&!String(state.shipment.amazonReferenceId||'').trim())errors.push(isYuntuoTemplate()?'请填写 Amazon Reference ID（将自动作为 PO Number）':'请填写 Amazon Reference ID');
  if(isYuntuoTemplate()&&!String(state.shipment.service||'').trim())errors.push('请选择云拓服务渠道');
  if(isYuntuoTemplate()&&state.items.some(item=>!String(item.exportSku||'').trim()))errors.push('请为所有商品填写导出 SKU（内部 SKU 不会写入货代表格）');
  const template=activeTemplateConfig(),mappedFixed=new Set(template.fixedFieldKeys||[]),mappedItems=new Set(template.itemFieldKeys||[]);
  for(const key of template.requiredFixedKeys||[]){if(mappedFixed.has(key)&&requiredValueMissing(customRequiredFixedValue(key)))errors.push(`请填写${templateFieldLabel('fixed',key)}`)}
  for(const key of template.requiredItemKeys||[]){if(!mappedItems.has(key))continue;const missing=state.items.map((item,index)=>requiredValueMissing(customRequiredItemValue(item,key))?index+1:null).filter(Boolean);if(missing.length)errors.push(`${templateFieldLabel('items',key)}为必填项（第 ${missing.slice(0,8).join('、')}${missing.length>8?'等':''} 个商品）`)}
  return [...new Set(errors)];
}

function requireValidInvoice(){const errors=invoiceValidationErrors();if(!errors.length)return true;toast(errors[0],true);return false}
function activeTemplateConfig(){return state.config.templates.find(template=>template.id===state.templateId)||{}}
function templateOrigin(){return activeTemplateConfig().migratedFromBuiltin||state.templateId}
function isRuichiTemplate(){return templateOrigin()==='ruichi'}
function isYuntuoTemplate(){return templateOrigin()==='yuntuo'}
function isCartonTemplate(){return isYuntuoTemplate()||activeTemplateConfig().rowMode==='carton'}
function syncYuntuoBoxCountFromItems(){if(!isCartonTemplate()||!state.items.length)return;const total=state.items.reduce((sum,item)=>sum+Math.max(1,Math.floor(num(item.cartons)||1)),0);state.shipment.boxCount=total;const input=$('[data-shipment="boxCount"]');if(input)input.value=total}

function navigate(page){
  $$('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
  $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  const titles={dashboard:['OVERVIEW','工作台'],products:['PRODUCT LIBRARY','产品资料库'],invoice:['CREATE INVOICE','新建发票'],drafts:['AUTO DRAFT','草稿箱'],history:['EXPORT HISTORY','导出历史'],templates:['TEMPLATE CENTER','模板中心']};
  $('#pageEyebrow').textContent=titles[page][0]; $('#pageTitle').textContent=titles[page][1];
  if(page==='invoice'){ renderInvoice(); }
  if(page==='drafts'){ loadDraftManager(); }
  if(page==='history'){ loadHistory(); }
  if(page==='templates'&&typeof loadTemplateCatalog==='function'){ loadTemplateCatalog(); }
}

function updateStats(){
  $('#statProducts').textContent=state.products.length;
  $('#statTemplates').textContent=state.config.templates.length;
  $('#statExports').textContent=state.history.length || localStorage.getItem(EXPORT_KEY) || '0';
}

function renderAppMeta(){
  const edition=$('#appEdition'),version=$('#appVersion'),storage=$('#appStorageMode');
  if(edition)edition.textContent=state.config.appEdition||'通用服务器版';
  if(version)version.textContent=`v${state.config.appVersion||'3.0.0-beta'}`;
  if(storage)storage.textContent=state.config.storageMode||'服务已连接';
}

function renderDraftManager(){
  const container=$('#draftManagerContent');if(!container)return;
  const record=state.draftRecord;
  if(!record){container.innerHTML='<div class="empty-state"><div class="empty-icon">✎</div><h3>目前没有自动草稿</h3><p>进入新建发票页面并开始填写后，系统会自动保存到这里。</p><button class="btn primary" data-go="invoice">开始制作发票</button></div>';return}
  const payload=record.payload||{},shipment=payload.shipment||{},items=payload.items||[];
  const template=state.config.templates.find(item=>item.id===payload.templateId);const templateName=template?.name||payload.templateId||'未选择模板';
  const cartons=items.reduce((sum,item)=>sum+Math.max(1,Math.floor(num(item.cartons)||1)),0);
  container.innerHTML=`<div class="draft-card"><div class="draft-card-head"><div><small>最后自动保存：${esc(formatHistoryTime(record.updatedAt))}</small><h3>${esc(shipment.fbaNumber||'尚未填写 FBA 号')}</h3></div><span class="draft-template-chip">${esc(templateName)}</span></div><div class="draft-details"><div><span>Amazon Reference ID</span><strong>${esc(shipment.amazonReferenceId||'—')}</strong></div><div><span>收件公司</span><strong>${esc(shipment.receiverCompany||shipment.receiverName||'—')}</strong></div><div><span>商品数量</span><strong>${items.length} 个 SKU</strong></div><div><span>总箱数</span><strong>${cartons} 箱</strong></div></div><div class="draft-manager-actions"><button class="btn primary" data-continue-draft>继续编辑</button><button class="btn ghost danger" data-delete-managed-draft>删除并清空草稿</button></div></div>`;
}

async function loadDraftManager(){
  try{const response=await fetch('/api/draft');const data=await response.json();if(!response.ok)throw new Error(data.error||'草稿读取失败');state.draftRecord=data.draft||null;renderDraftManager()}
  catch(error){toast(error.message,true)}
}

async function continueManagedDraft(){const restored=await restoreDraft();if(restored){navigate('invoice');toast('已继续编辑自动草稿')}else toast('草稿不存在或已被清除',true)}
async function deleteManagedDraft(){
  if(!confirm('确定删除自动草稿并清空当前发票内容吗？'))return;
  state.shipment={};state.items=[];state.selectedWarehouse=null;state.warehouseResults=[];state.addressAuto={};invalidatePreview(false);await clearDraft();renderInvoice();toast('自动草稿已删除');
}

function formatHistoryTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?String(value||'—'):date.toLocaleString('zh-CN',{hour12:false})}
function historyAmount(totals={}){return Object.entries(totals).map(([currency,value])=>`${currency} ${fmt(value)}`).join(' / ')||'—'}

function renderHistory(){
  const input=$('#historySearch');if(!input)return;
  const keyword=input.value.trim().toLowerCase();
  const rows=state.history.filter(record=>[record.fbaNumber,record.amazonReferenceId,record.receiver,record.templateName,record.filename].some(value=>String(value||'').toLowerCase().includes(keyword)));
  const existingIds=new Set(state.history.map(record=>record.id));state.selectedHistoryIds.forEach(id=>{if(!existingIds.has(id))state.selectedHistoryIds.delete(id)});
  $('#historyCount').textContent=`${rows.length} 条记录`;
  $('#historyEmpty').style.display=rows.length?'none':'block';
  $('#historyTableWrap').style.display=rows.length?'block':'none';
  $('#historyRows').innerHTML=rows.map(record=>`<tr>
    <td class="select-column"><input class="record-select" type="checkbox" data-select-history-record="${esc(record.id)}" ${state.selectedHistoryIds.has(record.id)?'checked':''} aria-label="选择 ${esc(record.filename||'导出记录')}"></td>
    <td>${esc(formatHistoryTime(record.createdAt))}</td>
    <td class="history-main"><span class="history-template">${esc(record.templateName||record.templateId)}</span><strong>${esc(record.filename||'未命名文件')}</strong></td>
    <td class="history-reference"><strong>${esc(record.fbaNumber||'—')}</strong><small>${esc(record.amazonReferenceId||'—')}</small></td>
    <td class="history-receiver"><strong>${esc(record.receiver||'—')}</strong></td>
    <td><strong>${num(record.itemCount)} 个 SKU</strong><br><small>${num(record.cartonCount)} 箱</small></td>
    <td class="history-amount">${esc(historyAmount(record.totals))}</td>
    <td><div class="history-actions"><button class="mini-btn" data-download-history="${esc(record.id)}" data-history-filename="${esc(record.filename||'历史发票.xlsx')}" ${record.fileStored?'':'disabled title="旧记录没有保存 Excel 文件"'}>重新下载</button><button class="mini-btn" data-load-history="${esc(record.id)}">加载并新建</button><button class="mini-btn delete" data-delete-history="${esc(record.id)}">删除</button></div></td>
  </tr>`).join('');
  updateBulkSelectionControl($('#selectAllHistory'),$('#deleteSelectedHistoryBtn'),rows.map(row=>row.id),state.selectedHistoryIds,'删除所选');
}

async function loadHistory(silent=false){
  try{const response=await fetch('/api/history');const data=await response.json();if(!response.ok)throw new Error(data.error||'历史读取失败');state.history=data.history||[];renderHistory();updateStats()}
  catch(error){if(!silent)toast(error.message,true)}
}

async function loadHistoryRecord(id){
  try{
    const response=await fetch(`/api/history/${encodeURIComponent(id)}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'历史记录读取失败');
    const payload=data.record.payload||{};state.templateId=payload.templateId||'ruichi';state.shipment=structuredClone(payload.shipment||{});state.items=(payload.items||[]).map(item=>({...normalizeProduct(structuredClone(item)),id:uid()}));state.selectedWarehouse=null;state.addressAuto={};invalidatePreview();
    const search=$('#warehouseSearch');if(search)search.value='';navigate('invoice');toast('历史数据已加载；修改后导出将创建一条新记录');
  }catch(error){toast(error.message,true)}
}

async function downloadHistoryFile(id,fallbackName='历史发票.xlsx'){
  try{
    const response=await fetch(`/api/history/${encodeURIComponent(id)}/file`);if(!response.ok){const data=await response.json();throw new Error(data.error||'历史文件下载失败')}
    const blob=await response.blob();let filename=fallbackName;const encoded=response.headers.get('X-Filename');if(encoded)filename=new TextDecoder().decode(Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast('历史 Excel 已重新下载');
  }catch(error){toast(error.message,true)}
}

async function deleteHistoryRecord(id){
  if(!confirm('确定删除这条导出历史吗？已下载的 Excel 文件不会被删除。'))return;
  try{const response=await fetch(`/api/history/${encodeURIComponent(id)}`,{method:'DELETE'});const data=await response.json();if(!response.ok)throw new Error(data.error||'删除失败');await loadHistory(true);scheduleBrowserMirror();toast('历史记录已删除')}
  catch(error){toast(error.message,true)}
}

async function deleteSelectedHistory(){
  const ids=[...state.selectedHistoryIds];if(!ids.length)return;if(!confirm(`确定删除选中的 ${ids.length} 条导出历史及其服务端 Excel 文件吗？已下载到电脑的文件不受影响。`))return;
  try{const response=await fetch('/api/history/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});const data=await response.json();if(!response.ok)throw new Error(data.error||'批量删除失败');state.selectedHistoryIds.clear();await loadHistory(true);scheduleBrowserMirror();toast(`已删除 ${num(data.deleted)} 条导出历史`)}catch(error){toast(error.message,true)}
}

function productImage(product, cls='product-thumb'){
  return product.image ? `<img class="${cls}" src="${esc(product.image)}" alt="">` : `<div class="${cls} placeholder">${esc((product.nameZh||product.sku||'产').slice(0,1))}</div>`;
}

function renderProducts(){
  const keyword=$('#productSearch')?.value.trim().toLowerCase() || '';
  const sort=$('#productSort')?.value || 'updated-desc';
  const rows=state.products.filter(p=>[p.sku,p.exportSku,p.nameZh,p.nameEn,p.model,p.hsCode].some(v=>String(v||'').toLowerCase().includes(keyword)));
  const textCompare=(a,b)=>String(a||'').localeCompare(String(b||''),'zh-CN',{numeric:true,sensitivity:'base'});
  rows.sort((a,b)=>{
    if(sort==='sku-asc')return textCompare(a.sku,b.sku);
    if(sort==='name-asc')return textCompare(a.nameZh,b.nameZh);
    if(sort==='price-asc')return num(a.unitPrice)-num(b.unitPrice);
    if(sort==='price-desc')return num(b.unitPrice)-num(a.unitPrice);
    return String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
  });
  const existingIds=new Set(state.products.map(product=>product.id));state.selectedProductIds.forEach(id=>{if(!existingIds.has(id))state.selectedProductIds.delete(id)});
  $('#productCount').textContent=`${rows.length} 个产品`;
  $('#productEmpty').style.display=state.products.length?'none':'block';
  $('#productTableWrap').style.display=state.products.length?'block':'none';
  $('#productRows').innerHTML=rows.map(p=>`<tr>
    <td class="select-column"><input class="record-select" type="checkbox" data-select-product-record="${esc(p.id)}" ${state.selectedProductIds.has(p.id)?'checked':''} aria-label="选择 ${esc(p.nameZh||p.sku||'产品')}"></td>
    <td><div class="product-cell">${productImage(p)}<div><strong>${esc(p.nameZh||'未命名产品')}</strong><small>${esc(p.nameEn||'—')}</small></div></div></td>
    <td><strong>${esc(p.sku||'—')}</strong><br><small>导出：${esc(p.exportSku||'未设置')} · ${esc(p.model||'无型号')}</small></td>
    <td><strong>${esc(p.currency||'USD')} ${fmt(p.unitPrice)}</strong></td>
    <td><strong>${weightText(p.productWeight,p.weightUnit)}</strong></td>
    <td>${fmt(p.cartonLength,1)} × ${fmt(p.cartonWidth,1)} × ${fmt(p.cartonHeight,1)} cm<br><small>${num(p.unitsPerCarton)} 件/箱</small></td>
    <td>${esc(p.hsCode||'—')}</td>
    <td><div class="row-actions"><button class="mini-btn" data-edit-product="${p.id}">编辑</button><button class="mini-btn" data-copy-product="${p.id}">复制</button><button class="mini-btn delete" data-delete-product="${p.id}">删除</button></div></td>
  </tr>`).join('');
  updateBulkSelectionControl($('#selectAllProducts'),$('#deleteSelectedProductsBtn'),rows.map(row=>row.id),state.selectedProductIds,'删除所选');
}

function updateBulkSelectionControl(selectAll,button,visibleIds,selected,label){if(selectAll){const selectedVisible=visibleIds.filter(id=>selected.has(id)).length;selectAll.checked=visibleIds.length>0&&selectedVisible===visibleIds.length;selectAll.indeterminate=selectedVisible>0&&selectedVisible<visibleIds.length;selectAll.disabled=!visibleIds.length}if(button){button.disabled=!selected.size;button.textContent=`${label}（${selected.size}）`}}

async function deleteSelectedProducts(){
  const ids=[...state.selectedProductIds];if(!ids.length)return;if(!confirm(`确定删除选中的 ${ids.length} 个产品吗？已经保存到草稿和历史记录中的数据不会改变。`))return;
  try{const response=await fetch('/api/products/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});const data=await response.json();if(!response.ok)throw new Error(data.error||'批量删除失败');state.selectedProductIds.clear();await syncProductsFromServer();renderProducts();updateStats();scheduleBrowserMirror();toast(`已删除 ${num(data.deleted)} 个产品`)}catch(error){toast(error.message,true)}
}

async function deleteSelectedTemplates(){
  const ids=[...state.selectedTemplateIds];if(!ids.length)return;if(!confirm(`确定删除选中的 ${ids.length} 个模板及其 Excel 原文件吗？导出历史和已下载文件不会改变。`))return;
  try{const response=await fetch('/api/templates/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});const data=await response.json();if(!response.ok)throw new Error(data.error||'批量删除失败');state.selectedTemplateIds.clear();state.config=await fetch('/api/config').then(result=>result.json());await loadTemplateCatalog(true);renderTemplates();renderInvoice();scheduleBrowserMirror();toast(`已删除 ${num(data.deleted)} 个模板`)}catch(error){toast(error.message,true)}
}

function fillCurrencies(select, selected='USD'){
  select.innerHTML=CURRENCIES.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('');
}

function openProductModal(product=null){
  const form=$('#productForm'); form.reset();
  renderCustomProductFields(product||{});
  fillCurrencies(form.elements.currency,product?.currency||'USD');
  $('#productModalTitle').textContent=product?'编辑产品资料':'新增产品资料';
  [...form.elements].forEach(el=>{ if(el.name && el.type!=='file' && product && product[el.name]!==undefined) el.value=product[el.name]; });
  if(!product) form.elements.id.value='';
  updateImagePreview(form.elements.image.value);
  openModal('productModal');
}

function openModal(id){ const el=$(`#${id}`); el.classList.add('open'); el.setAttribute('aria-hidden','false'); }
function closeModals(){ $$('.modal').forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')}); }
function updateImagePreview(src=''){ const box=$('#productForm .image-preview'); const img=$('img',box); $('span',box).style.display=src?'none':'block'; img.style.display=src?'block':'none'; img.src=src||''; }

async function compressImage(file){
  const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=reject;el.src=source});
  const max=900, scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.82);
}

function formObject(form){
  const data=Object.fromEntries(new FormData(form).entries()); delete data.imageFile;
  ['unitPrice','salePrice','productLength','productWidth','productHeight','productWeight','cartonLength','cartonWidth','cartonHeight','unitsPerCarton','cartonGrossWeight','cartonNetWeight'].forEach(k=>data[k]=num(data[k]));
  (state.templateFieldCatalog?.items||[]).filter(field=>!field.builtIn&&field.inputType==='number').forEach(field=>{if(data[field.key]!==undefined)data[field.key]=num(data[field.key])});
  return data;
}

function customFieldControl(field,value='',name=''){
  const attribute=name?`name="${esc(name)}"`:'';
  if(field.inputType==='textarea')return `<textarea ${attribute} rows="2">${esc(value)}</textarea>`;
  return `<input ${attribute} type="${field.inputType==='number'?'number':'text'}" ${field.inputType==='number'?'step="any"':''} value="${esc(value)}">`;
}

function customItemCatalogFields(){return (state.templateFieldCatalog?.items||[]).filter(field=>!field.builtIn&&field.enabled!==false)}
function customFixedCatalogFields(){return (state.templateFieldCatalog?.fixed||[]).filter(field=>!field.builtIn&&field.enabled!==false)}
function mappedCustomFields(category){const keys=new Set(activeTemplateConfig()[category==='fixed'?'fixedFieldKeys':'itemFieldKeys']||[]),fields=category==='fixed'?customFixedCatalogFields():customItemCatalogFields();return fields.filter(field=>keys.has(field.key))}
function renderCustomProductFields(product={}){const fields=customItemCatalogFields(),section=$('#customProductFieldSection'),container=$('#customProductFields');if(!section||!container)return;section.hidden=!fields.length;container.innerHTML=fields.map(field=>`<label><span>${esc(field.label)}</span>${customFieldControl(field,product?.[field.key]??'',field.key)}</label>`).join('')}

function renderTemplates(){
  const templates=state.config.templates||[];
  if(!templates.some(template=>template.id===state.templateId))state.templateId=templates[0]?.id||'';
  $('#templatePicker').innerHTML=templates.length?templates.map(t=>`<div class="template-option ${state.templateId===t.id?'active':''}" data-template="${t.id}"><div class="radio"></div><div><strong>${esc(t.name)}</strong><small>${esc(t.description)}</small></div></div>`).join(''):'<div class="template-picker-empty"><strong>尚未设置模板</strong><small>请先进入模板中心，上传货代 Excel 并完成字段映射。</small><button type="button" class="btn secondary" data-go="templates">上传第一个模板</button></div>';
  const catalog=state.templateCatalog||[];
  const existingIds=new Set(catalog.map(template=>template.id));state.selectedTemplateIds.forEach(id=>{if(!existingIds.has(id))state.selectedTemplateIds.delete(id)});
  $('#templateList').innerHTML=catalog.length?catalog.map(t=>`<div class="template-card"><label class="template-select"><input type="checkbox" data-select-template-record="${esc(t.id)}" ${state.selectedTemplateIds.has(t.id)?'checked':''} aria-label="选择 ${esc(t.name)}"></label><div class="template-logo">${esc((t.name||'模').slice(0,1))}</div><div class="template-card-copy"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><small>${t.configured?'● 已配置，可直接导出':'○ 待校对字段映射'}</small></div><div class="template-card-actions"><button class="mini-btn" data-configure-template="${esc(t.id)}">${t.configured?'编辑映射':'继续配置'}</button><button class="mini-btn delete" data-delete-template="${esc(t.id)}">删除</button></div></div>`).join(''):'<div class="empty-state template-empty"><div class="empty-icon">▤</div><h3>当前没有任何模板</h3><p>上传货代提供的 .xls、.xlsx 或 .xlsm 文件，识别并校对字段后即可使用。</p></div>';
  updateBulkSelectionControl($('#selectAllTemplates'),$('#deleteSelectedTemplatesBtn'),catalog.map(template=>template.id),state.selectedTemplateIds,'删除所选');
}

function fieldHtml([key,label,type,placeholder]){
  if(isYuntuoTemplate()&&key==='address1'&&!placeholder)placeholder='可粘贴完整地址，系统会自动识别城市、州、邮编和国家代码';
  if(isYuntuoTemplate()&&key==='amazonReferenceId')label='Amazon Reference ID / PO Number *';
  if(!isRuichiTemplate()&&!isYuntuoTemplate()&&['fbaNumber','amazonReferenceId'].includes(key))label=label.replace(' *','');
  const customTemplate=!['ruichi','yuntuo'].includes(state.templateId);
  const templateExample=customTemplate?activeTemplateConfig().fixedExamples?.[key]:'';
  const displayPlaceholder=templateExample?`模板示例：${templateExample}`:placeholder;
  const value=state.shipment[key] ?? (customTemplate?'':(placeholder??''));
  let input='';
  if(type==='textarea') input=`<textarea rows="2" data-shipment="${key}" placeholder="${esc(displayPlaceholder)}">${esc(value)}</textarea>`;
  else if(type==='currency') input=`<select data-shipment="${key}">${CURRENCIES.map(c=>`<option ${c===value?'selected':''}>${c}</option>`).join('')}</select>`;
  else if(type==='yesno') input=`<select data-shipment="${key}"><option ${value==='否'?'selected':''}>否</option><option ${value==='是'?'selected':''}>是</option></select>`;
  else if(type==='customs') input=`<select data-shipment="${key}"><option ${value==='买单报关'?'selected':''}>买单报关</option><option ${value==='报关退税'?'selected':''}>报关退税</option><option ${value===''?'selected':''} value="">空白</option></select>`;
  else if(type==='channel'&&isYuntuoTemplate()) input=`<select data-shipment="${key}"><option value="">请选择服务渠道</option>${state.config.channels.map(c=>`<option value="${esc(c.name)}" ${value===c.name?'selected':''}>${esc(c.label)}</option>`).join('')}</select>`;
  else if(type==='channel') input=`<input data-shipment="${key}" type="text" value="${esc(value)}" placeholder="${esc(displayPlaceholder||'填写模板需要的服务渠道')}">`;
  else input=`<input data-shipment="${key}" type="${type}" value="${esc(value)}" placeholder="${esc(displayPlaceholder)}">`;
  return `<label class="${type==='textarea'?'span-2':''}"><span>${label}</span>${input}</label>`;
}

function renderShipmentFields(){
  const fields=isRuichiTemplate()?[...commonFields]:(isYuntuoTemplate()?[...commonFields,...yuntuoFields]:[...commonFields,...yuntuoFields,...customTemplateFields]);
  const existing=new Set(fields.map(field=>field[0]));mappedCustomFields('fixed').forEach(field=>{if(!existing.has(field.key))fields.push([field.key,field.label,field.inputType||'text',''])});
  if(['ruichi','yuntuo'].includes(state.templateId))fields.forEach(([key,,type,placeholder])=>{if(state.shipment[key]===undefined&&placeholder!==''&&type!=='channel')state.shipment[key]=placeholder});
  $('#shipmentFields').innerHTML=fields.map(fieldHtml).join('');
}

function warehouseLocation(warehouse){
  return [warehouse.city,warehouse.state,warehouse.postalCode,warehouse.countryCode].filter(Boolean).join(', ');
}

function normalizedWarehouseCode(warehouse){const raw=String(warehouse?.code||'').trim().toUpperCase();const token=raw.match(/[A-Z0-9]{3,6}/)?.[0]||raw;return /[A-Z]/.test(token)&&/\d/.test(token)?token:raw}

function syncSelectedWarehouseCode(){if(!state.selectedWarehouse||String(state.shipment.warehouseCode||'').trim())return;state.shipment.warehouseCode=normalizedWarehouseCode(state.selectedWarehouse)}

function renderWarehouseResults(message=''){
  const box=$('#warehouseResults');
  if(!box)return;
  if(message){box.innerHTML=`<div class="warehouse-result-empty">${esc(message)}</div>`;box.hidden=false;return}
  box.innerHTML=state.warehouseResults.map((warehouse,index)=>`<button type="button" class="warehouse-result" data-warehouse-index="${index}">
    <span class="warehouse-result-code"><strong>${esc(warehouse.code)}</strong><small>${esc([warehouse.country,warehouse.region].filter(Boolean).join(' · '))}</small></span>
    <span class="warehouse-result-address"><strong>${esc(warehouse.address||'未填写街道地址')}</strong><small>${esc(warehouseLocation(warehouse))}</small></span>
  </button>`).join('');
  box.hidden=!state.warehouseResults.length;
}

function renderSelectedWarehouse(){
  const box=$('#selectedWarehouse');if(!box)return;
  const warehouse=state.selectedWarehouse;
  box.hidden=!warehouse;
  box.innerHTML=warehouse?`<strong>✓ 已选 ${esc(warehouse.code)}，地址已自动填入</strong><span>${esc(warehouse.address)} · ${esc(warehouseLocation(warehouse))}</span><button type="button" title="取消关联（保留已填地址）" data-clear-warehouse>×</button>`:'';
  const count=$('#warehouseCount');if(count)count.textContent=state.config.warehouseCount?`${state.config.warehouseCount} 个仓库`:'';
}

async function searchWarehouses(keyword=''){
  const sequence=++state.warehouseSearchSequence;
  renderWarehouseResults('正在搜索…');
  try{
    const response=await fetch(`/api/warehouses?q=${encodeURIComponent(keyword.trim())}&limit=30`);
    if(!response.ok)throw new Error('仓库数据读取失败');
    const data=await response.json();if(sequence!==state.warehouseSearchSequence)return;
    state.warehouseResults=data.warehouses||[];
    if(!state.warehouseResults.length)renderWarehouseResults('没有找到匹配的仓库');else renderWarehouseResults();
  }catch(error){if(sequence===state.warehouseSearchSequence)renderWarehouseResults(error.message)}
}

function selectWarehouse(warehouse){
  if(!warehouse)return;
  state.selectedWarehouse=warehouse;
  Object.assign(state.shipment,{
    receiverCompany:'Amazon Fulfillment Center',receiverName:'Amazon Fulfillment Center',
    address1:warehouse.address||'',address2:'',city:warehouse.city||'',state:warehouse.state||'',
    postalCode:warehouse.postalCode||'',countryCode:warehouse.countryCode||'',warehouseCode:normalizedWarehouseCode(warehouse)
  });
  state.addressAuto={city:state.shipment.city,state:state.shipment.state,postalCode:state.shipment.postalCode,countryCode:state.shipment.countryCode};
  const search=$('#warehouseSearch');if(search)search.value=warehouse.code||'';
  $('#warehouseResults').hidden=true;
  renderShipmentFields();renderSelectedWarehouse();invalidatePreview();updateSummary();
  toast(`已带入 ${warehouse.code} 仓库地址`);
}

function productToItem(product={}){
  product=normalizeProduct(product);
  const quantity=num(product.unitsPerCarton)||1;
  const productWeightKg=weightToKg(product.productWeight,product.weightUnit);
  return {...structuredClone(product),id:uid(),productId:product.id||'',quantity,cartons:1,boxNumber:'',poNumber:'',grossWeight:num(product.cartonGrossWeight)||productWeightKg*quantity,netWeight:num(product.cartonNetWeight)||productWeightKg*quantity,currency:product.currency||'USD'};
}

function itemField(item,key,label,type='number',extra=''){
  const value=item[key] ?? '';
  const step=type==='number'?'step="any" min="0"':'';
  return `<label><span>${label}</span><input data-item-id="${item.id}" data-item-key="${key}" type="${type}" ${step} value="${esc(value)}" ${extra}></label>`;
}
function itemWeightUnitField(item){return `<label><span>重量单位</span><select data-item-id="${item.id}" data-item-key="weightUnit"><option value="g" ${item.weightUnit==='g'?'selected':''}>g（克）</option><option value="kg" ${item.weightUnit==='kg'?'selected':''}>kg（千克）</option><option value="oz" ${item.weightUnit==='oz'?'selected':''}>oz（盎司）</option><option value="lb" ${item.weightUnit==='lb'?'selected':''}>lb（磅）</option></select></label>`}
function dynamicItemField(item,field){const value=item[field.key]??'';if(field.inputType==='textarea')return `<label><span>${esc(field.label)}</span><textarea rows="2" data-item-id="${item.id}" data-item-key="${esc(field.key)}">${esc(value)}</textarea></label>`;return itemField(item,field.key,esc(field.label),field.inputType==='number'?'number':'text')}

function renderItems(){
  const cartonMode=isCartonTemplate();
  const dynamicFields=mappedCustomFields('items');
  $('#invoiceItems').innerHTML=state.items.length?state.items.map((item,index)=>`<div class="invoice-item">
    <div class="item-head"><div class="item-index">${String(index+1).padStart(2,'0')}</div>${productImage(item,'item-image')}<div class="item-name"><strong>${esc(item.nameZh||'临时商品')}</strong><small>${esc(item.sku||'未填写 SKU')} · ${esc(item.nameEn||'未填写英文品名')}</small></div><div class="item-order-actions"><button class="order-btn" title="上移" data-move-item="${item.id}" data-direction="up" ${index===0?'disabled':''}>↑</button><button class="order-btn" title="下移" data-move-item="${item.id}" data-direction="down" ${index===state.items.length-1?'disabled':''}>↓</button></div><button class="item-delete" data-delete-item="${item.id}">移除</button></div>
    <div class="item-body">
      ${cartonMode?itemField(item,'boxNumber','货箱编号（导出时自动生成）','text'):`<label><span>单号（自动取 FBA 号）</span><input data-auto-fba type="text" value="${esc(state.shipment.fbaNumber||'')}" placeholder="请在收件与票件信息中填写" disabled></label>`}${itemField(item,'quantity','每箱申报数量')}${itemField(item,'unitPrice','申报单价')}
      <label><span>币种</span><select data-item-id="${item.id}" data-item-key="currency">${CURRENCIES.map(c=>`<option ${c===(item.currency||'USD')?'selected':''}>${c}</option>`).join('')}</select></label>
      ${itemField(item,'cartons','箱数')}
      ${itemField(item,'grossWeight',cartonMode?'每箱毛重 kg':'总毛重 kg')}${itemField(item,'netWeight',cartonMode?'每箱净重 kg':'总净重 kg')}${itemField(item,'cartonLength','箱长 cm')}${itemField(item,'cartonWidth','箱宽 cm')}${itemField(item,'cartonHeight','箱高 cm')}
      <div class="item-details">${itemField(item,'sku','内部 SKU（不导出）','text')}${itemField(item,'exportSku','导出 SKU（给货代）','text')}${itemField(item,'asin','ASIN','text')}${itemField(item,'fnsku','FNSKU','text')}${itemField(item,'model','型号','text')}${itemField(item,'hsCode','海关编码','text')}${itemField(item,'brand','品牌','text')}${itemField(item,'nameZh','中文品名','text')}${itemField(item,'nameEn','英文品名','text')}${itemField(item,'productWeight','单个产品重量')}${itemWeightUnitField(item)}${itemField(item,'materialZh','材质（中）','text')}${itemField(item,'materialEn','Material','text')}${itemField(item,'purposeZh','用途（中）','text')}${itemField(item,'purposeEn','Purpose','text')}${itemField(item,'salePrice','销售价格')}${itemField(item,'saleUrl','销售链接','text')}${dynamicFields.map(field=>dynamicItemField(item,field)).join('')}</div>
    </div>
  </div>`).join(''):`<div class="empty-state"><div class="empty-icon">＋</div><h3>还没有商品明细</h3><p>从产品资料库选择，所有预设参数会自动带入。</p><button class="btn primary" data-action="add-item">添加商品</button></div>`;
  updateSummary();
}

function updateSummary(){
  let qty=0,cartons=0,gross=0,cbm=0;const totals={};
  state.items.forEach(item=>{const itemCartons=Math.max(1,num(item.cartons)||1),grossFactor=isCartonTemplate()?itemCartons:1,currency=item.currency||'USD';cartons+=itemCartons;qty+=num(item.quantity)*itemCartons;gross+=num(item.grossWeight)*grossFactor;cbm+=num(item.cartonLength)*num(item.cartonWidth)*num(item.cartonHeight)*itemCartons/1e6;totals[currency]=(totals[currency]||0)+num(item.quantity)*num(item.unitPrice)*itemCartons});
  $('#sumKinds').textContent=state.items.length;$('#sumQuantity').textContent=qty;$('#sumCartons').textContent=cartons;$('#sumGross').textContent=`${fmt(gross,3)} kg`;$('#sumCbm').textContent=`${fmt(cbm,4)} m³`;
  $('#sumValue').textContent=Object.entries(totals).map(([c,v])=>`${c} ${fmt(v)}`).join(' / ')||'0.00';
  const warning=$('#summaryWarning'); const missing=state.items.filter(i=>!i.nameZh||!i.nameEn||!i.hsCode).length;const requiredErrors=invoiceValidationErrors();
  warning.textContent=!state.items.length?'请至少添加一个商品。':requiredErrors.length?requiredErrors.join('；'):missing?`${missing} 个商品缺少中英文品名或海关编码。`:'资料检查通过，可以导出。';
  const hasWarning=missing||requiredErrors.length||!state.items.length;warning.style.color=hasWarning?'#a16d28':'#167857';warning.style.background=hasWarning?'#fff7e8':'#ecfaf4';
}

function renderInvoice(){ renderTemplates();syncSelectedWarehouseCode();renderShipmentFields();renderSelectedWarehouse();syncYuntuoBoxCountFromItems();renderItems(); }

function openItemModal(){ renderProductSelect();openModal('itemModal'); }
function updateItemModalSummary(){const skuCount=state.items.length;const boxes=state.items.reduce((sum,item)=>sum+Math.max(1,Math.floor(num(item.cartons)||1)),0);$('#itemModalSkuCount').textContent=skuCount;$('#itemModalBoxCount').textContent=boxes}
function renderProductSelect(){
  const key=$('#itemProductSearch').value.trim().toLowerCase(); const products=state.products.filter(p=>[p.sku,p.exportSku,p.nameZh,p.nameEn,p.model].some(v=>String(v||'').toLowerCase().includes(key)));
  $('#productSelectList').innerHTML=products.length?products.map(p=>{const selected=state.items.find(item=>item.productId===p.id);return `<div class="select-product ${selected?'selected':''}" data-select-product="${p.id}">${productImage(p)}<div><strong>${esc(p.nameZh||p.sku)}</strong><small>内部：${esc(p.sku)} · 导出：${esc(p.exportSku||'未设置')} · ${esc(p.nameEn||'')}</small></div>${selected?`<span class="selected-badge">✓ 已选</span><div class="select-product-cartons"><label>箱数</label><input type="number" min="1" step="1" value="${Math.max(1,Math.floor(num(selected.cartons)||1))}" data-modal-cartons="${selected.id}"></div>`:'<b class="select-product-add">＋</b>'}</div>`}).join(''):'<div class="empty-state"><p>没有匹配的产品资料</p></div>';
  updateItemModalSummary();
}

function excelColumnName(number){let name='';while(number){number--;name=String.fromCharCode(65+(number%26))+name;number=Math.floor(number/26)}return name}

function renderWorkbookSheet(sheetIndex=0){
  const workbook=state.previewWorkbook;if(!workbook)return;
  state.previewSheetIndex=sheetIndex;
  const sheet=workbook.sheets[sheetIndex], mergeStarts=new Map(), covered=new Set(), images=new Map();
  sheet.merges.forEach(merge=>{mergeStarts.set(`${merge.minRow}:${merge.minCol}`,merge);for(let row=merge.minRow;row<=merge.maxRow;row++)for(let col=merge.minCol;col<=merge.maxCol;col++)if(row!==merge.minRow||col!==merge.minCol)covered.add(`${row}:${col}`)});
  sheet.images.forEach(image=>{const key=`${image.row}:${image.col}`;if(!images.has(key))images.set(key,[]);images.get(key).push(image.src)});
  const cells=new Map(sheet.cells.map(cell=>[`${cell.row}:${cell.col}`,cell]));
  const visibleColumns=Array.from({length:sheet.maxCol},(_,index)=>index+1).filter(col=>!sheet.hiddenCols.includes(col));
  const columns=visibleColumns.map(col=>`<col style="width:${sheet.columnWidths[String(col)]||70}px">`).join('');
  const tableWidth=42+visibleColumns.reduce((total,col)=>total+(sheet.columnWidths[String(col)]||70),0);
  let rows='';
  for(let row=1;row<=sheet.maxRow;row++){
    if(sheet.hiddenRows.includes(row))continue;
    const rowHeight=sheet.rowHeights[String(row)]||22;
    let cellsHtml=`<th class="excel-row-head">${row}</th>`;
    for(const col of visibleColumns){
      if(covered.has(`${row}:${col}`))continue;
      const cell=cells.get(`${row}:${col}`)||{address:`${excelColumnName(col)}${row}`,display:'',value:'',style:''};
      const edit=state.previewEdits.find(item=>item.sheet===sheet.name&&item.address===cell.address);
      const display=edit?edit.value:cell.display;
      const merge=mergeStarts.get(`${row}:${col}`), rowspan=merge?merge.maxRow-merge.minRow+1:1, colspan=merge?merge.maxCol-merge.minCol+1:1;
      const cellHeight=merge?Array.from({length:rowspan},(_,index)=>sheet.rowHeights[String(row+index)]||22).reduce((sum,height)=>sum+height,0):rowHeight;
      const pictures=(images.get(`${row}:${col}`)||[]).map(src=>`<img class="excel-image" src="${esc(src)}" alt="">`).join('');
      cellsHtml+=`<td data-sheet="${esc(sheet.name)}" data-address="${cell.address}" rowspan="${rowspan}" colspan="${colspan}" style="${esc(cell.style)};height:${cellHeight}px;max-height:${cellHeight}px" class="excel-cell${cell.formula?' formula-cell':''}">${pictures}<span class="cell-value" style="max-height:${Math.max(16,cellHeight-5)}px" contenteditable="true" spellcheck="false">${esc(display)}</span></td>`;
    }
    rows+=`<tr style="height:${rowHeight}px;max-height:${rowHeight}px">${cellsHtml}</tr>`;
  }
  const headers=visibleColumns.map(col=>`<th class="excel-col-head">${excelColumnName(col)}</th>`).join('');
  const tabs=workbook.sheets.map((item,index)=>`<button class="sheet-tab ${index===sheetIndex?'active':''}" data-preview-sheet="${index}">${esc(item.name)}</button>`).join('');
  const zoomPercent=Math.round((state.previewZoom||1)*100),zoomOptions=[100,125,140,150].map(value=>`<option value="${value}" ${value===zoomPercent?'selected':''}>${value}%</option>`).join('');
  $('#previewContent').innerHTML=`<div class="excel-preview-toolbar"><div><strong>${esc(workbook.filename)}</strong><small>点击单元格即可修改；网页不显示 Excel 的箭头、文本框等绘图对象</small></div><div class="excel-preview-controls"><label>预览缩放 <select data-preview-zoom>${zoomOptions}</select></label><span>${sheet.maxRow} 行 × ${sheet.maxCol} 列</span></div></div><div class="excel-viewport"><table class="excel-grid" style="width:${tableWidth}px;min-width:${tableWidth}px;zoom:${state.previewZoom||1}"><colgroup><col style="width:42px">${columns}</colgroup><thead><tr><th class="excel-corner"></th>${headers}</tr></thead><tbody>${rows}</tbody></table></div><div class="sheet-tabs">${tabs}</div>`;
}

async function openPreview(){
  if(!state.items.length){toast('请先添加商品',true);return}
  if(!requireValidInvoice())return;
  state.previewEdits=[];state.previewWorkbook=null;scheduleDraftSave();
  $('#previewContent').innerHTML='<div class="preview-loading"><div class="loading-spinner"></div><h3>正在按原模板生成预览…</h3><p>表格生成后可直接编辑单元格</p></div>';
  openModal('previewModal');
  try{
    const response=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId:state.templateId,shipment:state.shipment,items:state.items})});
    const contentType=response.headers.get('Content-Type')||'';
    if(!contentType.includes('application/json'))throw new Error(`当前地址未连接到货代发票后台，请重新运行启动器（当前端口：${location.port}）`);
    const data=await response.json();if(!response.ok)throw new Error(data.error||'预览生成失败');state.previewWorkbook=data;renderWorkbookSheet(0);
  }catch(error){$('#previewContent').innerHTML=`<div class="preview-empty"><h3>预览生成失败</h3><p>${esc(error.message)}</p></div>`}
}

async function exportInvoice(){
  if(!state.items.length){toast('请先添加商品',true);return}
  if(!requireValidInvoice())return;
  const button=$('#exportBtn'), original=button.textContent; button.disabled=true;button.textContent='正在生成 Excel…';
  try{
    const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId:state.templateId,shipment:state.shipment,items:state.items,cellEdits:state.previewEdits||[]})});
    if(!response.ok){const data=await response.json();throw new Error(data.error||'导出失败')}
    const blob=await response.blob();let filename='货代发票.xlsx';const encoded=response.headers.get('X-Filename');if(encoded){filename=new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)))}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    localStorage.setItem(EXPORT_KEY,String(num(localStorage.getItem(EXPORT_KEY))+1));await loadHistory(true);updateStats();scheduleBrowserMirror();toast('Excel 已导出并保存到历史记录');
  }catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}
}

function resetInvoice(){ if(!confirm('确定清空当前发票内容和自动草稿吗？'))return;state.shipment={};state.items=[];state.selectedWarehouse=null;state.warehouseResults=[];const search=$('#warehouseSearch');if(search)search.value='';const results=$('#warehouseResults');if(results)results.hidden=true;invalidatePreview(false);clearDraft();renderInvoice(); }

async function backupData(){
  const button=$('#backupBtn'),original=button.textContent;button.disabled=true;button.textContent='正在整理完整备份…';
  try{const response=await fetch('/api/backup');if(!response.ok)throw new Error('完整备份生成失败');const counts=backupCountsFromResponse(response),blob=await response.blob();await saveBrowserBackup(blob,counts);let filename=`货代发票完整备份-${new Date().toISOString().slice(0,10)}.zip`;const encoded=response.headers.get('X-Filename');if(encoded)filename=new TextDecoder().decode(Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);toast(`完整备份已导出：${num(counts.products)} 个产品、${num(counts.templates)} 个模板、${num(counts.history)} 条历史`)}
  catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}
}

async function clearAllData(){
  if(!confirm('这会永久清空产品、模板及原文件、导出历史及 Excel、草稿和字段库设置。\n仓库预设会保留。\n\n建议先导出完整 ZIP 备份。是否继续？'))return;
  if(prompt('此操作无法撤销。请输入“清空全部数据”继续：')!=='清空全部数据'){toast('已取消清空',true);return}
  const button=$('#clearAllDataBtn'),original=button.textContent;button.disabled=true;button.textContent='正在清空…';
  try{
    state.preventBrowserMirror=true;clearTimeout(scheduleDraftSave.timer);clearTimeout(scheduleBrowserMirror.timer);state.draftDirty=false;
    const response=await fetch('/api/data/clear-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'CLEAR_ALL_DATA'})});const data=await response.json();if(!response.ok)throw new Error(data.error||'清空所有数据失败');
    localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(EXPORT_KEY);await clearBrowserBackup();state.products=[];state.items=[];state.shipment={};state.templateCatalog=[];state.templateId='';state.history=[];state.draftRecord=null;toast('所有数据已清空，正在恢复初始状态…');setTimeout(()=>location.reload(),650);
  }catch(error){state.preventBrowserMirror=false;button.disabled=false;button.textContent=original;toast(error.message,true)}
}

function serverHasUserData(){return Boolean(state.products.length||state.templateCatalog.length||state.history.length||state.draftRecord)}
async function offerBrowserRestoreIfNeeded(){
  const snapshot=await readBrowserBackup();if(!snapshot||serverHasUserData())return false;
  if(!backupCountsHaveUserData(snapshot.counts||{})){await clearBrowserBackup();return false}
  const updated=snapshot.updatedAt?new Date(snapshot.updatedAt).toLocaleString('zh-CN',{hour12:false}):'未知时间';
  if(!confirm(`当前服务端没有任何数据，但这个浏览器中保存着 ${updated} 的完整备份。\n是否现在恢复产品、模板、草稿和导出历史？`))return true;
  try{await restoreBackupBlob(snapshot.blob);toast('浏览器完整备份已恢复，正在重新加载…');setTimeout(()=>location.reload(),500);return true}catch(error){toast(error.message,true);return true}
}

async function init(){
  try{state.config=await fetch('/api/config').then(r=>r.json());if(typeof loadTemplateCatalog==='function')await loadTemplateCatalog(true);await syncProductsFromServer();await loadHistory(true);await restoreDraft();const preserveExistingBrowserBackup=await offerBrowserRestoreIfNeeded();if(!preserveExistingBrowserBackup)scheduleBrowserMirror()}catch{toast('未连接到本地导出服务',true)}
  fillCurrencies($('#productForm').elements.currency);renderAppMeta();renderProducts();renderTemplates();renderInvoice();updateStats();
}

document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]');if(nav)navigate(nav.dataset.page);
  const go=event.target.closest('[data-go]');if(go)navigate(go.dataset.go);
  if(event.target.closest('[data-close-modal]'))closeModals();
  if(event.target.closest('[data-action="new-product"]')||event.target.closest('#newProductBtn'))openProductModal();
  if(event.target.closest('[data-action="add-item"]')||event.target.closest('#addInvoiceItemBtn'))openItemModal();
  const edit=event.target.closest('[data-edit-product]');if(edit)openProductModal(state.products.find(p=>p.id===edit.dataset.editProduct));
  const copyBtn=event.target.closest('[data-copy-product]');if(copyBtn){const source=state.products.find(p=>p.id===copyBtn.dataset.copyProduct);state.products.push({...structuredClone(source),id:uid(),sku:`${source.sku}-COPY`,updatedAt:new Date().toISOString()});saveProducts();toast('产品资料已复制')}
  const del=event.target.closest('[data-delete-product]');if(del&&confirm('确定删除这条产品资料吗？')){state.products=state.products.filter(p=>p.id!==del.dataset.deleteProduct);saveProducts()}
  const template=event.target.closest('[data-template]');if(template){state.templateId=template.dataset.template;invalidatePreview();renderInvoice()}
  const loadHistoryButton=event.target.closest('[data-load-history]');if(loadHistoryButton)loadHistoryRecord(loadHistoryButton.dataset.loadHistory);
  const downloadHistoryButton=event.target.closest('[data-download-history]');if(downloadHistoryButton&&!downloadHistoryButton.disabled)downloadHistoryFile(downloadHistoryButton.dataset.downloadHistory,downloadHistoryButton.dataset.historyFilename);
  const deleteHistoryButton=event.target.closest('[data-delete-history]');if(deleteHistoryButton)deleteHistoryRecord(deleteHistoryButton.dataset.deleteHistory);
  if(event.target.closest('[data-continue-draft]'))continueManagedDraft();
  if(event.target.closest('[data-delete-managed-draft]'))deleteManagedDraft();
  const warehouseOption=event.target.closest('[data-warehouse-index]');if(warehouseOption){selectWarehouse(state.warehouseResults[num(warehouseOption.dataset.warehouseIndex)])}
  if(event.target.closest('[data-clear-warehouse]')){state.selectedWarehouse=null;renderSelectedWarehouse();scheduleDraftSave()}
  const previewSheet=event.target.closest('[data-preview-sheet]');if(previewSheet)renderWorkbookSheet(num(previewSheet.dataset.previewSheet));
  const select=event.target.closest('[data-select-product]');if(select&&!event.target.closest('[data-modal-cartons]')){const p=state.products.find(p=>p.id===select.dataset.selectProduct);const existing=state.items.find(item=>item.productId===p.id);if(existing){toast('该 SKU 已添加，可直接修改箱数')}else{state.items.push(productToItem(p));syncYuntuoBoxCountFromItems();invalidatePreview();renderItems();renderProductSelect();toast('商品已加入，可继续选择其他 SKU')}}
  const move=event.target.closest('[data-move-item]');if(move&&!move.disabled){const index=state.items.findIndex(i=>i.id===move.dataset.moveItem);const next=move.dataset.direction==='up'?index-1:index+1;if(index>=0&&next>=0&&next<state.items.length){[state.items[index],state.items[next]]=[state.items[next],state.items[index]];invalidatePreview();renderItems()}}
  const delItem=event.target.closest('[data-delete-item]');if(delItem){state.items=state.items.filter(i=>i.id!==delItem.dataset.deleteItem);syncYuntuoBoxCountFromItems();invalidatePreview();renderItems()}
});

document.addEventListener('change',event=>{
  const product=event.target.dataset.selectProductRecord;if(product){event.target.checked?state.selectedProductIds.add(product):state.selectedProductIds.delete(product);renderProducts();return}
  const history=event.target.dataset.selectHistoryRecord;if(history){event.target.checked?state.selectedHistoryIds.add(history):state.selectedHistoryIds.delete(history);renderHistory();return}
  const template=event.target.dataset.selectTemplateRecord;if(template){event.target.checked?state.selectedTemplateIds.add(template):state.selectedTemplateIds.delete(template);renderTemplates();return}
  if(event.target.id==='selectAllProducts'){$$('[data-select-product-record]').forEach(input=>event.target.checked?state.selectedProductIds.add(input.dataset.selectProductRecord):state.selectedProductIds.delete(input.dataset.selectProductRecord));renderProducts();return}
  if(event.target.id==='selectAllHistory'){$$('[data-select-history-record]').forEach(input=>event.target.checked?state.selectedHistoryIds.add(input.dataset.selectHistoryRecord):state.selectedHistoryIds.delete(input.dataset.selectHistoryRecord));renderHistory();return}
  if(event.target.id==='selectAllTemplates'){$$('[data-select-template-record]').forEach(input=>event.target.checked?state.selectedTemplateIds.add(input.dataset.selectTemplateRecord):state.selectedTemplateIds.delete(input.dataset.selectTemplateRecord));renderTemplates()}
});

$('#productForm').addEventListener('submit',event=>{event.preventDefault();const product=formObject(event.target);product.id=product.id||uid();product.updatedAt=new Date().toISOString();const index=state.products.findIndex(p=>p.id===product.id);if(index>=0)state.products[index]=product;else state.products.unshift(product);saveProducts();closeModals();toast('产品资料已保存')});
$('#productForm [name=imageFile]').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const data=await compressImage(file);event.target.form.elements.image.value=data;updateImagePreview(data)}catch{toast('图片读取失败',true)}});
$('#productSearch').addEventListener('input',renderProducts);$('#productSort').addEventListener('change',renderProducts);$('#itemProductSearch').addEventListener('input',renderProductSelect);
$('#historySearch').addEventListener('input',renderHistory);$('#refreshHistoryBtn').addEventListener('click',()=>loadHistory());
$('#deleteSelectedProductsBtn').addEventListener('click',deleteSelectedProducts);$('#deleteSelectedHistoryBtn').addEventListener('click',deleteSelectedHistory);$('#deleteSelectedTemplatesBtn').addEventListener('click',deleteSelectedTemplates);
$('#warehouseSearch').addEventListener('input',event=>{clearTimeout(searchWarehouses.timer);searchWarehouses.timer=setTimeout(()=>searchWarehouses(event.target.value),180)});
$('#warehouseSearch').addEventListener('focus',event=>searchWarehouses(event.target.value));
$('#addBlankItemBtn').addEventListener('click',()=>{state.items.push(productToItem({currency:'USD'}));syncYuntuoBoxCountFromItems();invalidatePreview();renderItems();renderProductSelect();toast('已添加临时商品，可继续选择')});
$('#finishAddingItemsBtn').addEventListener('click',closeModals);
$('#productSelectList').addEventListener('input',event=>{const itemId=event.target.dataset.modalCartons;if(!itemId)return;const item=state.items.find(value=>value.id===itemId);if(!item)return;item.cartons=Math.max(1,Math.floor(num(event.target.value)||1));syncYuntuoBoxCountFromItems();invalidatePreview();renderItems();updateItemModalSummary()});
$('#shipmentFields').addEventListener('input',event=>{const key=event.target.dataset.shipment;if(!key)return;state.shipment[key]=event.target.value;if(key==='fbaNumber')$$('[data-auto-fba]').forEach(input=>input.value=event.target.value);if(key==='boxCount'&&isCartonTemplate()&&state.items.length===1){state.items[0].cartons=Math.max(1,Math.floor(num(event.target.value)||1));renderItems()}if(['city','state','postalCode','countryCode'].includes(key)&&event.target.value!==state.addressAuto[key])delete state.addressAuto[key];if(key==='address1'||key==='address2')applyAddressAutofill(`${state.shipment.address1||''}\n${state.shipment.address2||''}`);invalidatePreview();updateSummary()});
$('#invoiceItems').addEventListener('input',event=>{const {itemId,itemKey}=event.target.dataset;if(!itemId)return;const item=state.items.find(i=>i.id===itemId);if(!item)return;item[itemKey]=event.target.type==='number'?num(event.target.value):event.target.value;if(itemKey==='cartons')syncYuntuoBoxCountFromItems();invalidatePreview();updateSummary();if(['nameZh','nameEn','sku'].includes(itemKey)){const head=event.target.closest('.invoice-item').querySelector('.item-name');head.querySelector('strong').textContent=item.nameZh||'临时商品';head.querySelector('small').textContent=`${item.sku||'未填写 SKU'} · ${item.nameEn||'未填写英文品名'}`}});
$('#previewContent').addEventListener('input',event=>{const value=event.target.closest('.cell-value');if(!value)return;const cell=value.closest('[data-sheet][data-address]');if(!cell)return;const edit={sheet:cell.dataset.sheet,address:cell.dataset.address,value:value.innerText};const index=state.previewEdits.findIndex(item=>item.sheet===edit.sheet&&item.address===edit.address);if(index>=0)state.previewEdits[index]=edit;else state.previewEdits.push(edit);cell.classList.add('edited-cell');scheduleDraftSave()});
$('#previewContent').addEventListener('change',event=>{if(!event.target.matches('[data-preview-zoom]'))return;state.previewZoom=Math.max(1,Math.min(1.5,num(event.target.value)/100));renderWorkbookSheet(state.previewSheetIndex||0)});
$('#previewContent').addEventListener('wheel',event=>{const viewport=event.target.closest('.excel-viewport');if(viewport&&event.shiftKey){event.preventDefault();viewport.scrollLeft+=event.deltaY}},{passive:false});
$('#previewBtn').addEventListener('click',openPreview);$('#previewExportBtn').addEventListener('click',()=>{closeModals();exportInvoice()});$('#exportBtn').addEventListener('click',exportInvoice);$('#resetInvoiceBtn').addEventListener('click',resetInvoice);$('#backupBtn').addEventListener('click',backupData);
$('#importDataBtn').addEventListener('click',()=>$('#importDataInput').click());
$('#importDataInput').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(/\.json$/i.test(file.name)||file.type==='application/json'){const data=JSON.parse(await file.text());if(!Array.isArray(data.products))throw new Error('旧版产品备份格式不正确');state.products=data.products.map(normalizeProduct);saveProducts();toast(`已兼容导入 ${data.products.length} 个旧版产品`);return}if(!confirm('恢复完整备份会用备份中的产品、模板、草稿和历史记录替换当前全部数据。是否继续？'))return;const restored=await restoreBackupBlob(file);toast(`恢复完成：${num(restored.products)} 个产品、${num(restored.templates)} 个模板、${num(restored.history)} 条历史`);setTimeout(()=>location.reload(),700)}catch(error){toast(error.message,true)}finally{event.target.value=''}});
$('#clearDataBtn').addEventListener('click',()=>{if(confirm('确定清空全部产品资料吗？此操作无法撤销。')){state.products=[];saveProducts();toast('本地产品资料已清空')}});
$('#clearAllDataBtn').addEventListener('click',clearAllData);

init();
window.addEventListener('beforeunload',()=>{clearTimeout(scheduleDraftSave.timer);if(!state.draftDirty)return;try{navigator.sendBeacon(freightInvoiceApiUrl('/api/draft'),new Blob([JSON.stringify(invoiceDraftPayload())],{type:'application/json'}))}catch{}});
