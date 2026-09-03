async function loadTemplateCatalog(silent=false){
  try{
    const response=await fetch('/api/templates');const data=await response.json();if(!response.ok)throw new Error(data.error||'模板列表读取失败');
    state.templateCatalog=data.templates||[];state.templateFieldCatalog={fixed:data.fixedFields||[],items:data.itemFields||[]};renderTemplates();updateStats();
  }catch(error){if(!silent)toast(error.message,true)}
}

function templateColumnNumber(value){if(/^\d+$/.test(String(value||'')))return num(value);let result=0;for(const char of String(value||'').toUpperCase())if(char>='A'&&char<='Z')result=result*26+char.charCodeAt(0)-64;return result}

function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('模板文件读取失败'));reader.readAsDataURL(file)})}

async function uploadCustomTemplate(file){
  if(!file)return;
  if(!/\.(xls|xlsx|xlsm)$/i.test(file.name)){toast('目前支持 .xls、.xlsx 和 .xlsm 模板',true);return}
  if(file.size>20*1024*1024){toast('模板文件过大：单次在线传输上限为 4 MB（含编码数据），建议将模板精简至 2 MB 以内后重试',true);return}
  const button=$('#uploadTemplateBtn'),original=button.textContent;button.disabled=true;button.textContent='正在分析模板…';
  try{
    const data=await readFileAsDataUrl(file);const name=file.name.replace(/\.(xls|xlsx|xlsm)$/i,'');
    const response=await fetch('/api/templates/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,name,data})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'模板上传失败');await loadTemplateCatalog(true);scheduleBrowserMirror();await openTemplateEditor(result.template.id);toast('模板已上传，请校对字段映射');
  }catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original;$('#templateUploadInput').value=''}
}

async function openTemplateEditor(templateId){
  const preview=$('#templateDesignerPreview');preview.innerHTML='<div class="preview-loading"><div class="loading-spinner"></div><h3>正在读取模板结构…</h3></div>';openModal('templateEditorModal');
  try{
    const [detailResponse,previewResponse]=await Promise.all([fetch(`/api/templates/${encodeURIComponent(templateId)}`),fetch(`/api/templates/${encodeURIComponent(templateId)}/preview`)]);
    const detail=await detailResponse.json(),workbook=await previewResponse.json();if(!detailResponse.ok)throw new Error(detail.error||'模板配置读取失败');if(!previewResponse.ok)throw new Error(workbook.error||'模板预览读取失败');
    state.templateEditor={record:detail.template,fixedFields:detail.fixedFields||[],itemFields:detail.itemFields||[],workbook,activeInput:null};renderTemplateEditor();
  }catch(error){preview.innerHTML=`<div class="preview-empty"><h3>模板读取失败</h3><p>${esc(error.message)}</p></div>`}
}

function renderTemplateEditor(){
  const editor=state.templateEditor;if(!editor)return;const record=editor.record,mapping=record.mapping||{fixed:{},items:{columns:{}}};mapping.fixed=mapping.fixed||{};mapping.items=mapping.items||{};mapping.items.columns=mapping.items.columns||{};record.mapping=mapping;
  $('#templateEditorTitle').textContent=`字段映射 · ${record.name}`;$('#customTemplateName').value=record.name||'';
  const fixedLabels=new Map(editor.fixedFields.map(field=>[field.key,field.label])),itemLabels=new Map(editor.itemFields.map(field=>[field.key,field.label]));
  const fixedEntries=Object.entries(mapping.fixed).map(([field,cell])=>`${fixedLabels.get(field)||field}（${cell}）`);
  const itemEntries=Object.entries(mapping.items.columns).map(([field,column])=>`${itemLabels.get(field)||field}（${/^\d+$/.test(String(column))?excelColumnName(num(column)):column}列）`);
  const activeSheet=editor.workbook.sheets.find(sheet=>sheet.name===mapping.sheet)||editor.workbook.sheets[0],mappedColumns=new Set(Object.values(mapping.items.columns).map(value=>/^\d+$/.test(String(value))?num(value):templateColumnNumber(value))),headerRow=num(mapping.items.headerRow),headerStartRow=Math.max(1,num(mapping.items.headerStartRow)||headerRow),headerLabels=new Map();
  (activeSheet?.cells||[]).filter(cell=>cell.row>=headerStartRow&&cell.row<=headerRow&&String(cell.display||'').trim()).forEach(cell=>{const labels=headerLabels.get(cell.col)||[];if(!labels.includes(String(cell.display).trim()))labels.push(String(cell.display).trim());headerLabels.set(cell.col,labels)});
  const missedHeaders=[...headerLabels.entries()].filter(([col])=>!mappedColumns.has(col)).map(([col,labels])=>`${excelColumnName(col)}列：${labels.join(' / ')}`);
  $('#templateDetectionSummary').innerHTML=`<div><b>固定字段 ${fixedEntries.length} 个</b><span>${esc(fixedEntries.join('、')||'暂未识别')}</span></div><div><b>商品列 ${itemEntries.length} 个</b><span>${esc(itemEntries.join('、')||'暂未识别')}</span></div>${missedHeaders.length?`<div class="mapping-missed"><b>未识别的表头</b><span>${esc(missedHeaders.join('、'))}</span></div>`:'<div class="mapping-complete">✓ 当前表头均已识别</div>'}`;
  $('#templateSheetSelect').innerHTML=editor.workbook.sheets.map(sheet=>`<option value="${esc(sheet.name)}" ${sheet.name===mapping.sheet?'selected':''}>${esc(sheet.name)}</option>`).join('');
  mapping.required=mapping.required||{fixed:[],items:[]};const requiredFixed=new Set(mapping.required.fixed||[]),requiredItems=new Set(mapping.required.items||[]);
  $('#fixedMappingFields').innerHTML=editor.fixedFields.map(field=>`<div class="mapping-field-entry"><div class="mapping-field-heading"><span>${esc(field.label)}</span><label class="mapping-required-toggle"><input type="checkbox" data-required-kind="fixed" data-required-field="${esc(field.key)}" ${requiredFixed.has(field.key)?'checked':''}>必填</label></div><input data-map-kind="fixed" data-map-field="${esc(field.key)}" value="${esc(mapping.fixed[field.key]||'')}" placeholder="如 B2"></div>`).join('');
  $('#itemMappingSettings').innerHTML=`<label><span>表头起始行</span><input id="mappingHeaderStartRow" type="number" min="1" value="${headerStartRow}"></label><label><span>表头结束行</span><input id="mappingHeaderRow" type="number" min="1" value="${Math.max(1,num(mapping.items.headerRow)||1)}"></label><label><span>明细起始行</span><input id="mappingStartRow" type="number" min="1" value="${Math.max(1,num(mapping.items.startRow)||1)}"></label><label><span>模板预留明细行</span><input id="mappingReservedRows" type="number" min="1" value="${Math.max(1,num(mapping.items.reservedRows)||1)}"></label><label><span>一行代表</span><select id="mappingRowMode"><option value="sku" ${mapping.items.rowMode!=='carton'?'selected':''}>一个 SKU</option><option value="carton" ${mapping.items.rowMode==='carton'?'selected':''}>一箱</option></select></label><label><span>图片最大宽度 px</span><input id="mappingImageWidth" type="number" min="10" value="${Math.max(10,num(mapping.items.imageMaxWidth)||72)}"></label><label><span>图片最大高度 px</span><input id="mappingImageHeight" type="number" min="10" value="${Math.max(10,num(mapping.items.imageMaxHeight)||50)}"></label>`;
  $('#itemMappingFields').innerHTML=editor.itemFields.map(field=>`<div class="mapping-field-entry"><div class="mapping-field-heading"><span>${esc(field.label)}</span><label class="mapping-required-toggle"><input type="checkbox" data-required-kind="item" data-required-field="${esc(field.key)}" ${requiredItems.has(field.key)?'checked':''}>必填</label></div><input data-map-kind="item" data-map-field="${esc(field.key)}" value="${esc(mapping.items.columns[field.key]||'')}" placeholder="如 E"></div>`).join('');
  renderTemplateMappingPreview();
  if(editor.selectedCell)showDirectMappingPanel(editor.selectedCell);else $('#directMappingPanel').hidden=true;
}

function showDirectMappingPanel(selected){
  const editor=state.templateEditor;if(!editor)return;const headerRow=num(editor.record.mapping.items?.headerRow),headerStartRow=Math.max(1,num(editor.record.mapping.items?.headerStartRow)||headerRow),kind=selected.row>=headerStartRow&&selected.row<=headerRow?'item':'fixed',fields=kind==='item'?editor.itemFields:editor.fixedFields,mapping=kind==='item'?(editor.record.mapping.items?.columns||{}):(editor.record.mapping.fixed||{}),target=kind==='item'?selected.column:selected.address;
  const current=Object.entries(mapping).find(([,value])=>kind==='item'?templateColumnNumber(value)===templateColumnNumber(target):String(value).toUpperCase()===String(target).toUpperCase())?.[0]||'';
  const mappedKeys=new Set(Object.keys(mapping)),ordered=[...fields].sort((a,b)=>(mappedKeys.has(a.key)?1:0)-(mappedKeys.has(b.key)?1:0));
  editor.selectedCell={...selected,kind};const panel=$('#directMappingPanel');panel.hidden=false;panel.innerHTML=`<div class="direct-mapping-title"><b>已选择 ${esc(selected.address)}${kind==='item'?`（${esc(selected.column)} 列）`:''}</b><span>${kind==='item'?'这是商品表头行，将映射整列':'这是固定信息位置，将映射该单元格'}</span></div><div class="direct-mapping-controls"><select id="directMappingField"><option value="">请选择对应字段…</option>${ordered.map(field=>`<option value="${esc(field.key)}" ${field.key===current?'selected':''}>${esc(field.label)}${mappedKeys.has(field.key)?' · 已映射':''}</option>`).join('')}</select><button class="btn primary" type="button" data-apply-direct-mapping>确认指定</button><button class="btn ghost" type="button" data-cancel-direct-mapping>取消</button></div>`;panel.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function designerSheet(){const editor=state.templateEditor;if(!editor)return null;const name=editor.record.mapping.sheet;return editor.workbook.sheets.find(sheet=>sheet.name===name)||editor.workbook.sheets[0]}

function renderTemplateMappingPreview(){
  const editor=state.templateEditor,sheet=designerSheet(),container=$('#templateDesignerPreview');if(!editor||!sheet||!container)return;
  const mergeStarts=new Map(),covered=new Set(),cells=new Map(sheet.cells.map(cell=>[`${cell.row}:${cell.col}`,cell]));
  sheet.merges.forEach(merge=>{mergeStarts.set(`${merge.minRow}:${merge.minCol}`,merge);for(let row=merge.minRow;row<=merge.maxRow;row++)for(let col=merge.minCol;col<=merge.maxCol;col++)if(row!==merge.minRow||col!==merge.minCol)covered.add(`${row}:${col}`)});
  const visibleColumns=Array.from({length:sheet.maxCol},(_,index)=>index+1).filter(col=>!sheet.hiddenCols.includes(col));const columns=visibleColumns.map(col=>`<col style="width:${sheet.columnWidths[String(col)]||70}px">`).join('');const tableWidth=42+visibleColumns.reduce((total,col)=>total+(sheet.columnWidths[String(col)]||70),0);
  const fixedTargets=new Set(Object.values(editor.record.mapping.fixed||{}).map(value=>String(value).toUpperCase()));const itemColumns=new Set(Object.values(editor.record.mapping.items?.columns||{}).map(value=>/^\d+$/.test(String(value))?excelColumnName(num(value)):String(value).toUpperCase()));const selectedAddress=String(editor.selectedCell?.address||'').toUpperCase();let rows='';
  for(let row=1;row<=sheet.maxRow;row++){
    if(sheet.hiddenRows.includes(row))continue;const rowHeight=sheet.rowHeights[String(row)]||22;let cellsHtml=`<th class="excel-row-head">${row}</th>`;
    for(const col of visibleColumns){if(covered.has(`${row}:${col}`))continue;const cell=cells.get(`${row}:${col}`)||{address:`${excelColumnName(col)}${row}`,display:'',style:''};const merge=mergeStarts.get(`${row}:${col}`),rowspan=merge?merge.maxRow-merge.minRow+1:1,colspan=merge?merge.maxCol-merge.minCol+1:1;const columnName=excelColumnName(col),mapped=fixedTargets.has(cell.address.toUpperCase())||itemColumns.has(columnName),selected=selectedAddress===cell.address.toUpperCase();cellsHtml+=`<td class="excel-cell${mapped?' mapped-target':''}${selected?' mapping-selected-cell':''}" data-template-cell="${cell.address}" data-template-col="${columnName}" rowspan="${rowspan}" colspan="${colspan}" style="${esc(cell.style)};height:${rowHeight}px"><span class="cell-value">${esc(cell.display)}</span></td>`}
    rows+=`<tr style="height:${rowHeight}px">${cellsHtml}</tr>`;
  }
  const headers=visibleColumns.map(col=>`<th class="excel-col-head">${excelColumnName(col)}</th>`).join('');container.innerHTML=`<table class="excel-grid" style="width:${tableWidth}px;min-width:${tableWidth}px"><colgroup><col style="width:42px">${columns}</colgroup><thead><tr><th class="excel-corner"></th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function collectTemplateMapping(){
  const editor=state.templateEditor,mapping=structuredClone(editor.record.mapping||{}),modal=$('#templateEditorModal');mapping.sheet=$('#templateSheetSelect').value;mapping.fixed={};$$('[data-map-kind="fixed"]',modal).forEach(input=>{if(input.value.trim())mapping.fixed[input.dataset.mapField]=input.value.trim().toUpperCase()});mapping.items=mapping.items||{};mapping.items.headerRow=Math.max(1,Math.floor(num($('#mappingHeaderRow').value)||1));mapping.items.headerStartRow=Math.min(mapping.items.headerRow,Math.max(1,Math.floor(num($('#mappingHeaderStartRow').value)||mapping.items.headerRow)));mapping.items.startRow=Math.max(1,Math.floor(num($('#mappingStartRow').value)||1));mapping.items.reservedRows=Math.max(1,Math.floor(num($('#mappingReservedRows').value)||1));mapping.items.rowMode=$('#mappingRowMode').value;mapping.items.imageMaxWidth=Math.max(10,Math.floor(num($('#mappingImageWidth').value)||72));mapping.items.imageMaxHeight=Math.max(10,Math.floor(num($('#mappingImageHeight').value)||50));mapping.items.columns={};$$('[data-map-kind="item"]',modal).forEach(input=>{if(input.value.trim())mapping.items.columns[input.dataset.mapField]=input.value.trim().toUpperCase()});mapping.required={fixed:[],items:[]};$$('[data-required-kind="fixed"]:checked',modal).forEach(input=>{if(mapping.fixed[input.dataset.requiredField])mapping.required.fixed.push(input.dataset.requiredField)});$$('[data-required-kind="item"]:checked',modal).forEach(input=>{if(mapping.items.columns[input.dataset.requiredField])mapping.required.items.push(input.dataset.requiredField)});return mapping;
}

async function saveTemplateMapping(){
  const editor=state.templateEditor;if(!editor)return;const button=$('#saveTemplateMappingBtn'),original=button.textContent;button.disabled=true;button.textContent='正在保存…';
  try{const mapping=collectTemplateMapping();if(!Object.keys(mapping.items.columns).length)throw new Error('请至少映射一个商品明细列');const response=await fetch(`/api/templates/${encodeURIComponent(editor.record.id)}/mapping`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#customTemplateName').value,mapping})});const data=await response.json();if(!response.ok)throw new Error(data.error||'模板映射保存失败');state.config=await fetch('/api/config').then(result=>result.json());await loadTemplateCatalog(true);if(!state.config.templates.some(template=>template.id===state.templateId))state.templateId=state.config.templates[0]?.id||'';renderTemplates();closeModals();scheduleBrowserMirror();toast('自定义模板已保存并启用')}
  catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}
}

async function reanalyzeTemplate(){
  const editor=state.templateEditor;if(!editor||!confirm('重新识别会覆盖当前字段映射，是否继续？'))return;const button=$('#reanalyzeTemplateBtn'),original=button.textContent;button.disabled=true;button.textContent='正在识别…';
  try{const response=await fetch(`/api/templates/${encodeURIComponent(editor.record.id)}/reanalyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw new Error(data.error||'重新识别失败');editor.record=data.template;renderTemplateEditor();await loadTemplateCatalog(true);scheduleBrowserMirror();toast(`已识别 ${data.template.detectedFixed} 个固定字段、${data.template.detectedItemColumns} 个商品列，请检查后保存`)}
  catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}
}

async function deleteCustomTemplate(templateId){
  const target=state.templateCatalog.find(template=>template.id===templateId),label=target?.builtIn?'内置模板会从模板列表移除，已生成的历史文件不受影响。':'模板原文件会删除，已生成的历史 Excel 不受影响。';if(!confirm(`确定删除“${target?.name||'该模板'}”吗？\n${label}`))return;
  try{const response=await fetch(`/api/templates/${encodeURIComponent(templateId)}`,{method:'DELETE'});const data=await response.json();if(!response.ok)throw new Error(data.error||'模板删除失败');state.config=await fetch('/api/config').then(result=>result.json());if(state.templateId===templateId)state.templateId=state.config.templates[0]?.id||'';await loadTemplateCatalog(true);renderInvoice();scheduleBrowserMirror();toast('模板已删除')}
  catch(error){toast(error.message,true)}
}

async function convertBuiltinTemplate(templateId){
  const target=state.templateCatalog.find(template=>template.id===templateId);if(!confirm(`将“${target?.name||'内置模板'}”转换为可编辑的通用模板吗？\n转换后原内置入口会隐藏，历史记录不受影响。`))return;
  try{const response=await fetch(`/api/templates/${encodeURIComponent(templateId)}/convert`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok)throw new Error(data.error||'模板转换失败');state.config=await fetch('/api/config').then(result=>result.json());await loadTemplateCatalog(true);scheduleBrowserMirror();await openTemplateEditor(data.template.id);toast('已转换为通用模板，请检查映射后保存启用')}
  catch(error){toast(error.message,true)}
}

async function openFieldCatalogManager(){
  openModal('fieldCatalogModal');$('#fieldDefinitionList').innerHTML='<div class="field-empty">正在读取字段库…</div>';
  try{const response=await fetch('/api/field-catalog'),data=await response.json();if(!response.ok)throw new Error(data.error||'字段库读取失败');state.fieldCatalogAll=data;resetFieldDefinitionForm();renderFieldCatalogList()}
  catch(error){$('#fieldDefinitionList').innerHTML=`<div class="field-empty">${esc(error.message)}</div>`}
}

function currentFieldCategory(){return $('#fieldCatalogCategoryFilter').value||'fixed'}
function setFieldEditorVisible(visible){const form=$('#fieldDefinitionForm'),empty=$('#fieldDefinitionEmpty');form.hidden=!visible;empty.hidden=visible;if(visible){form.classList.remove('form-activated');void form.offsetWidth;form.classList.add('form-activated')}}
function resetFieldDefinitionForm(category=currentFieldCategory(),open=false){
  const form=$('#fieldDefinitionForm');form.reset();form.elements.key.value='';form.elements.category.value=category;form.elements.inputType.value='text';$('#fieldDefinitionFormTitle').textContent=`新增${category==='fixed'?'固定票件':'商品明细'}字段`;$('#fieldDefinitionNote').textContent='新增字段会参与以后上传模板的自动识别；固定字段可在票件区填写，商品字段可保存到产品资料并在商品明细中填写。';setFieldEditorVisible(open);if(open)setTimeout(()=>form.elements.label.focus(),30);
}

function renderFieldCatalogList(){
  const category=currentFieldCategory(),keyword=$('#fieldCatalogSearch').value.trim().toLowerCase(),fields=(state.fieldCatalogAll?.[category]||[]).filter(field=>[field.label,field.key,...(field.aliases||[])].some(value=>String(value||'').toLowerCase().includes(keyword)));
  $('#fieldDefinitionList').innerHTML=fields.length?fields.map(field=>`<div class="field-definition-row${field.enabled===false?' disabled':''}"><div class="field-definition-copy"><strong>${esc(field.label)} <span class="field-origin">${field.builtIn?'内置':'自定义'}${field.enabled===false?' · 已停用':''}</span></strong><small>${esc((field.aliases||[]).join('、')||'尚未设置识别别名')}</small></div><div class="field-definition-actions"><button type="button" class="mini-btn" data-edit-field="${esc(field.key)}" data-field-category="${category}">${field.enabled===false?'恢复 / 编辑':'编辑'}</button><button type="button" class="mini-btn delete" data-delete-field="${esc(field.key)}" data-field-category="${category}">${field.builtIn?'停用':'删除'}</button></div></div>`).join(''):'<div class="field-empty">没有匹配的字段</div>';
}

function editFieldDefinition(category,key){
  const field=(state.fieldCatalogAll?.[category]||[]).find(item=>item.key===key);if(!field)return;resetFieldDefinitionForm(category,true);const form=$('#fieldDefinitionForm');form.elements.key.value=field.key;form.elements.category.value=category;form.elements.label.value=field.label||'';form.elements.inputType.value=field.inputType||'text';form.elements.aliases.value=(field.aliases||[]).join('\n');$('#fieldDefinitionFormTitle').textContent=`编辑 · ${field.label}`;$('#fieldDefinitionNote').textContent=field.builtIn?'内置字段的内部键保持不变；可修改显示名称、数据类型和识别别名。停用不会破坏已经保存的模板映射。':'自定义字段可修改名称、类型和别名；内部键保持不变，已有模板和产品数据仍能对应。';setTimeout(()=>form.elements.label.focus(),30);
}

async function saveFieldDefinition(event){
  event.preventDefault();const form=event.currentTarget,payload={key:form.elements.key.value,category:form.elements.category.value||currentFieldCategory(),label:form.elements.label.value,inputType:form.elements.inputType.value,aliases:form.elements.aliases.value};const button=$('button[type="submit"]',form),original=button.textContent;button.disabled=true;button.textContent='正在保存…';
  try{const response=await fetch('/api/field-catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json();if(!response.ok)throw new Error(data.error||'字段保存失败');const catalogResponse=await fetch('/api/field-catalog');state.fieldCatalogAll=await catalogResponse.json();await loadTemplateCatalog(true);resetFieldDefinitionForm(payload.category);renderFieldCatalogList();renderInvoice();scheduleBrowserMirror();toast('字段已保存，将参与新模板自动识别')}
  catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}
}

async function deleteFieldFromCatalog(category,key){
  const field=(state.fieldCatalogAll?.[category]||[]).find(item=>item.key===key);if(!field)return;const action=field.builtIn?'停用':'删除';if(!confirm(`确定${action}“${field.label}”吗？\n已有模板中的映射和历史数据不会被删除。`))return;
  try{const response=await fetch(`/api/field-catalog/${category}/${encodeURIComponent(key)}`,{method:'DELETE'}),data=await response.json();if(!response.ok)throw new Error(data.error||`${action}失败`);state.fieldCatalogAll=await fetch('/api/field-catalog').then(result=>result.json());await loadTemplateCatalog(true);resetFieldDefinitionForm(category);renderFieldCatalogList();renderInvoice();scheduleBrowserMirror();toast(`字段已${action}`)}catch(error){toast(error.message,true)}
}

$('#uploadTemplateBtn').addEventListener('click',()=>$('#templateUploadInput').click());
$('#templateUploadInput').addEventListener('change',event=>uploadCustomTemplate(event.target.files[0]));
$('#saveTemplateMappingBtn').addEventListener('click',saveTemplateMapping);
$('#reanalyzeTemplateBtn').addEventListener('click',reanalyzeTemplate);
$('#manageFieldCatalogBtn').addEventListener('click',openFieldCatalogManager);
$('#fieldCatalogCategoryFilter').addEventListener('change',()=>{resetFieldDefinitionForm();renderFieldCatalogList()});
$('#fieldCatalogSearch').addEventListener('input',renderFieldCatalogList);
$('#newFieldDefinitionBtn').addEventListener('click',()=>resetFieldDefinitionForm(currentFieldCategory(),true));
$('#cancelFieldDefinitionBtn').addEventListener('click',()=>resetFieldDefinitionForm());
$('#fieldDefinitionForm').addEventListener('submit',saveFieldDefinition);
$('#fieldDefinitionList').addEventListener('click',event=>{const edit=event.target.closest('[data-edit-field]');if(edit){editFieldDefinition(edit.dataset.fieldCategory,edit.dataset.editField);return}const remove=event.target.closest('[data-delete-field]');if(remove)deleteFieldFromCatalog(remove.dataset.fieldCategory,remove.dataset.deleteField)});
$('#templateSheetSelect').addEventListener('change',event=>{if(!state.templateEditor)return;state.templateEditor.record.mapping.sheet=event.target.value;renderTemplateMappingPreview()});
$('#templateEditorModal').addEventListener('focusin',event=>{const input=event.target.closest('[data-map-kind]');if(!input)return;$$('[data-map-kind]',$('#templateEditorModal')).forEach(element=>element.classList.remove('mapping-active'));input.classList.add('mapping-active');state.templateEditor.activeInput=input;$('#templateMappingHint').textContent=input.dataset.mapKind==='item'?'现在点击左侧任意单元格，将取它所在的列':'现在点击左侧目标单元格'});
$('#templateDesignerPreview').addEventListener('click',event=>{const cell=event.target.closest('[data-template-cell]');if(!cell)return;const editor=state.templateEditor,input=editor?.activeInput,address=cell.dataset.templateCell,column=cell.dataset.templateCol,row=num((address.match(/\d+$/)||[])[0]);if(input){input.value=input.dataset.mapKind==='item'?column:address;editor.record.mapping=collectTemplateMapping();editor.activeInput=null;editor.selectedCell={address,column,row,kind:input.dataset.mapKind};$$('[data-map-kind]',$('#templateEditorModal')).forEach(element=>element.classList.remove('mapping-active'));$('#templateMappingHint').textContent='已完成映射；蓝色为当前选中单元格，绿色为已映射位置';renderTemplateMappingPreview();toast('字段位置已更新');return}editor.selectedCell={address,column,row};renderTemplateMappingPreview();showDirectMappingPanel(editor.selectedCell)});
$('#directMappingPanel').addEventListener('click',event=>{if(event.target.closest('[data-cancel-direct-mapping]')){state.templateEditor.selectedCell=null;$('#directMappingPanel').hidden=true;renderTemplateMappingPreview();return}if(!event.target.closest('[data-apply-direct-mapping]'))return;const editor=state.templateEditor,selected=editor?.selectedCell,field=$('#directMappingField').value;if(!selected||!field){toast('请先选择对应字段',true);return}const input=$(`[data-map-kind="${selected.kind}"][data-map-field="${field}"]`,$('#templateEditorModal'));if(!input){toast('字段不存在',true);return}input.value=selected.kind==='item'?selected.column:selected.address;editor.record.mapping=collectTemplateMapping();editor.selectedCell={...selected,mappedField:field};renderTemplateEditor();toast(`已把 ${selected.kind==='item'?selected.column+' 列':selected.address} 指定为该字段；蓝色边框表示当前选中`)});
document.addEventListener('click',event=>{const configure=event.target.closest('[data-configure-template]');if(configure)openTemplateEditor(configure.dataset.configureTemplate);const convert=event.target.closest('[data-convert-builtin]');if(convert)convertBuiltinTemplate(convert.dataset.convertBuiltin);const remove=event.target.closest('[data-delete-template]');if(remove)deleteCustomTemplate(remove.dataset.deleteTemplate)});
