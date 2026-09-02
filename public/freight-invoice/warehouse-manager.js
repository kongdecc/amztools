function resetWarehouseManagerForm(){const form=$('#warehouseManagerForm');form.reset();form.elements.id.value='';$('#warehouseManagerFormTitle').textContent='新增仓库';setTimeout(()=>form.elements.code.focus(),20)}

async function loadWarehouseManagerResults(keyword=''){
  const list=$('#warehouseManagerList');list.innerHTML='<div class="warehouse-manager-empty">正在读取仓库库…</div>';
  try{const response=await fetch(`/api/warehouses?q=${encodeURIComponent(keyword.trim())}&limit=100`),data=await response.json();if(!response.ok)throw new Error(data.error||'仓库库读取失败');state.warehouseManagerResults=data.warehouses||[];state.config.warehouseCount=data.total||0;renderWarehouseManagerResults(data.total||0);renderSelectedWarehouse()}
  catch(error){list.innerHTML=`<div class="warehouse-manager-empty">${esc(error.message)}</div>`}
}

function renderWarehouseManagerResults(total=0){const rows=state.warehouseManagerResults||[];$('#warehouseManagerList').innerHTML=rows.length?rows.map(warehouse=>`<div class="warehouse-manager-row"><div class="warehouse-manager-code"><strong>${esc(warehouse.code)}</strong><small>${esc(warehouse.countryCode||warehouse.country||'—')}</small></div><div class="warehouse-manager-address"><strong>${esc(warehouse.address||'未填写街道地址')}</strong><small>${esc([warehouse.city,warehouse.state,warehouse.postalCode].filter(Boolean).join(', ')||'未填写城市信息')}</small></div><div class="warehouse-manager-actions"><button type="button" class="mini-btn" data-edit-warehouse="${esc(warehouse.id)}">编辑</button><button type="button" class="mini-btn delete" data-delete-warehouse="${esc(warehouse.id)}">删除</button></div></div>`).join(''):`<div class="warehouse-manager-empty">没有匹配的仓库</div>`;if(total>rows.length)$('#warehouseManagerList').insertAdjacentHTML('afterbegin',`<div class="warehouse-manager-note">共 ${total} 条，当前显示前 ${rows.length} 条；可输入关键词缩小范围。</div>`)}

async function openWarehouseManager(){openModal('warehouseManagerModal');resetWarehouseManagerForm();$('#warehouseManagerSearch').value='';await loadWarehouseManagerResults()}

function editWarehouse(warehouseId){const warehouse=(state.warehouseManagerResults||[]).find(item=>item.id===warehouseId);if(!warehouse)return;const form=$('#warehouseManagerForm');for(const element of form.elements)if(element.name&&warehouse[element.name]!==undefined)element.value=warehouse[element.name]||'';$('#warehouseManagerFormTitle').textContent=`编辑 · ${warehouse.code}`;form.elements.code.focus()}

async function saveWarehouse(event){event.preventDefault();const form=event.currentTarget,payload=Object.fromEntries(new FormData(form).entries()),button=$('button[type="submit"]',form),original=button.textContent;button.disabled=true;button.textContent='正在保存…';try{const response=await fetch('/api/warehouses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json();if(!response.ok)throw new Error(data.error||'仓库保存失败');state.config.warehouseCount=data.total||state.config.warehouseCount;resetWarehouseManagerForm();await loadWarehouseManagerResults($('#warehouseManagerSearch').value);toast('仓库预设已保存')}catch(error){toast(error.message,true)}finally{button.disabled=false;button.textContent=original}}

async function removeWarehouse(warehouseId){const warehouse=(state.warehouseManagerResults||[]).find(item=>item.id===warehouseId);if(!warehouse||!confirm(`确定删除仓库“${warehouse.code}”吗？`))return;try{const response=await fetch(`/api/warehouses/${encodeURIComponent(warehouseId)}`,{method:'DELETE'}),data=await response.json();if(!response.ok)throw new Error(data.error||'仓库删除失败');state.config.warehouseCount=data.total||0;resetWarehouseManagerForm();await loadWarehouseManagerResults($('#warehouseManagerSearch').value);toast('仓库预设已删除')}catch(error){toast(error.message,true)}}

$('#manageWarehousesBtn').addEventListener('click',openWarehouseManager);
$('#newWarehouseBtn').addEventListener('click',resetWarehouseManagerForm);
$('#cancelWarehouseEditBtn').addEventListener('click',resetWarehouseManagerForm);
$('#warehouseManagerForm').addEventListener('submit',saveWarehouse);
$('#warehouseManagerSearch').addEventListener('input',event=>{clearTimeout(loadWarehouseManagerResults.timer);loadWarehouseManagerResults.timer=setTimeout(()=>loadWarehouseManagerResults(event.target.value),180)});
$('#warehouseManagerList').addEventListener('click',event=>{const edit=event.target.closest('[data-edit-warehouse]');if(edit){editWarehouse(edit.dataset.editWarehouse);return}const remove=event.target.closest('[data-delete-warehouse]');if(remove)removeWarehouse(remove.dataset.deleteWarehouse)});
