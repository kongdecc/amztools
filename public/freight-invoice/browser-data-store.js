(function () {
  'use strict';
  // Keep the existing private namespace and ZIP format: no user data migration
  // or cloud copy is needed when upgrading from the full-snapshot transport.
  const DB_NAME = 'freight-invoice-private-data-v1';
  const STORE = 'data';
  const PROTOCOL = 'freight-browser-v2';
  const MAX_WIRE_BYTES = 4000000;
  const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
  const ROOTS = ['products.json', 'export_history.json', 'custom_templates.json', 'template_settings.json', 'invoice_draft.json'];
  const nativeFetch = window.fetch.bind(window);
  const encoder = new TextEncoder();
  let pending = Promise.resolve();

  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('无法打开本地数据，请允许浏览器存储后重试'));
    });
  }
  async function snapshot(value, counts) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(STORE);
      const record = { encoded: value, counts: counts || {} };
      const request = value === undefined ? store.get('snapshot') : store.put(record, 'snapshot');
      transaction.oncomplete = () => { db.close(); resolve(value === undefined ? request.result || { encoded: '', counts: {} } : record); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('浏览器存储失败，本次修改未保存；请释放存储空间后重试')); };
    });
  }
  const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  function bytesBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }
  const textBase64 = value => bytesBase64(encoder.encode(value));
  const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
  const read = async (zip, name, fallback) => zip.file(name) ? JSON.parse(await zip.file(name).async('string')) : fallback;
  const write = (zip, name, value) => zip.file(name, JSON.stringify(value));
  const scopedFile = name => ['custom_templates.json', 'template_settings.json'].includes(name) || /^custom_templates\/tpl-[0-9a-f]{10}\.(xlsx|xlsm|xls)$/.test(name);
  async function counts(zip) {
    return { products: (await read(zip, 'products.json', [])).length, templates: (await read(zip, 'custom_templates.json', [])).length,
      history: (await read(zip, 'export_history.json', [])).length, hasDraft: !!zip.file('invoice_draft.json') };
  }
  async function archive(zip) {
    const count = await counts(zip);
    write(zip, 'backup_manifest.json', { format: 'freight-invoice-full-backup', formatVersion: 1, appVersion: '3.0.0-beta',
      exportedAt: new Date().toISOString(), files: Object.values(zip.files).filter(file => !file.dir && file.name !== 'backup_manifest.json').map(file => file.name), counts: count });
    return { encoded: await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' }), counts: count };
  }
  async function validateBackup(bytes) {
    if (bytes.byteLength > MAX_BACKUP_BYTES) throw new Error('备份超过本地恢复容量（256MB）');
    const zip = await JSZip.loadAsync(bytes);
    let expanded = 0;
    for (const file of Object.values(zip.files)) {
      if (file.dir) continue;
      const name = file.unsafeOriginalName || file.name;
      if (name !== file.name || name.includes('\\') || name.split('/').includes('..') ||
          !(ROOTS.includes(name) || name === 'backup_manifest.json' || name === 'warehouses.json' ||
            /^custom_templates\/tpl-[0-9a-f]{10}\.(xls|xlsx|xlsm)$/.test(name) || /^history_files\/\d{14}-[0-9a-f]{8}\.xlsx$/.test(name))) {
        throw new Error('备份包含未知或不安全的文件路径');
      }
      expanded += file._data.uncompressedSize;
      if (!Number.isFinite(expanded) || expanded > MAX_BACKUP_BYTES) throw new Error('备份解压后超过本地恢复容量（256MB）');
    }
    const manifest = await read(zip, 'backup_manifest.json', {});
    if (manifest.format !== 'freight-invoice-full-backup' || Number(manifest.formatVersion) !== 1) throw new Error('这不是受支持的完整备份');
    for (const name of ROOTS) {
      if (!zip.file(name)) continue;
      const data = await read(zip, name, null);
      const list = ['products.json', 'export_history.json', 'custom_templates.json'].includes(name);
      if (!data || typeof data !== 'object' || Array.isArray(data) !== list) throw new Error(`备份中的 ${name} 格式不正确`);
    }
    for (const record of await read(zip, 'custom_templates.json', [])) {
      if (!record || !/^tpl-[0-9a-f]{10}\.(xls|xlsx|xlsm)$/.test(record.storedFile) || !zip.file(`custom_templates/${record.storedFile}`)) throw new Error('备份缺少模板 Excel 原文件');
    }
    zip.remove('warehouses.json'); // Independently managed; never restored.
    return zip;
  }
  async function requestRemote(path, method, payload, files) {
    const envelope = { protocol: PROTOCOL, path, method, files };
    if (payload !== null) envelope.payload = payload;
    const serialized = JSON.stringify(envelope);
    if (new Blob([serialized]).size > MAX_WIRE_BYTES) throw new Error('当前模板和本次票件超过单次在线传输上限 4 MB（4,000,000 字节，含编码数据），请减小当前模板/商品图片或拆分票件；无需删除历史，本地数据未修改');
    const response = await nativeFetch('/api/freight-invoice-python', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized, cache: 'no-store' });
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) throw new Error(`Excel 处理服务返回网页错误（HTTP ${response.status}），本地数据未修改`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Excel 处理失败，本地数据未修改');
    if (result.protocol !== PROTOCOL || !Number.isInteger(result.status) || typeof result.body !== 'string') throw new Error('后端版本不匹配，请等待部署完成后刷新；本地数据未修改');
    return result;
  }
  async function perform(url, input, init) {
    if (!window.JSZip) throw new Error('本地数据模块未加载，请刷新页面');
    const stored = await snapshot(), original = stored.encoded;
    let zip = original ? await JSZip.loadAsync(original, { base64: true }) : new JSZip();
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = decodeURIComponent(url.pathname.slice(4));
    const body = init?.body !== undefined ? init.body : input instanceof Request && method !== 'GET' ? await input.clone().blob() : null;
    const payload = body === null || path === '/restore' ? null : JSON.parse(await new Response(body).text());
    const commit = async () => {
      const saved = await archive(zip);
      if ((await snapshot()).encoded !== original) throw new Error('另一个标签页已更新本地数据，请刷新后重试');
      await snapshot(saved.encoded, saved.counts);
      return saved.counts;
    };
    if (path === '/backup' && method === 'GET') {
      const saved = original ? stored : await archive(zip);
      return new Response(fromBase64(saved.encoded), { headers: { 'Content-Type': 'application/zip', 'X-Backup-Counts': textBase64(JSON.stringify(saved.counts)) } });
    }
    if (path === '/restore' && method === 'POST') {
      zip = await validateBackup(new Uint8Array(await new Response(body).arrayBuffer()));
      return jsonResponse({ status: 'ok', restored: await commit() });
    }
    if (path === '/data/clear-all' && method === 'POST') {
      if (payload?.confirmation !== 'CLEAR_ALL_DATA') throw new Error('清空确认信息不正确');
      const cleared = await counts(zip); zip = new JSZip(); await commit();
      return jsonResponse({ status: 'ok', cleared });
    }
    if (path === '/products' || path === '/products/bulk-delete') {
      const products = await read(zip, 'products.json', []);
      if (method === 'GET' && path === '/products') return jsonResponse({ products });
      if (method === 'POST') {
        const next = path.endsWith('bulk-delete') ? products.filter(product => !(payload.ids || []).includes(product.id)) : payload.products;
        if (!Array.isArray(next)) throw new Error('产品资料格式不正确');
        write(zip, 'products.json', next); await commit();
        return jsonResponse({ status: 'ok', count: next.length, deleted: products.length - next.length });
      }
    }
    if (path === '/draft') {
      if (method === 'GET') return jsonResponse({ draft: await read(zip, 'invoice_draft.json', null) });
      if (method === 'POST' || method === 'DELETE') {
        const updatedAt = new Date().toISOString();
        if (method === 'DELETE') zip.remove('invoice_draft.json'); else write(zip, 'invoice_draft.json', { updatedAt, payload });
        await commit(); return jsonResponse({ status: 'ok', updatedAt });
      }
    }
    if (path === '/history' || path.startsWith('/history/')) {
      const history = await read(zip, 'export_history.json', []);
      if (path === '/history' && method === 'GET') return jsonResponse({ history: history.map(({ payload, ...summary }) => summary) });
      const id = path.split('/')[2], record = history.find(item => item.id === id);
      if (method === 'DELETE' || (method === 'POST' && id === 'bulk-delete')) {
        const ids = method === 'DELETE' ? [id] : payload.ids || [];
        const removed = history.filter(item => ids.includes(item.id));
        if (method === 'DELETE' && !removed.length) return jsonResponse({ error: '历史记录不存在' }, 404);
        for (const item of removed) zip.remove(`history_files/${item.id}.xlsx`);
        write(zip, 'export_history.json', history.filter(item => !ids.includes(item.id))); await commit();
        return jsonResponse({ status: 'ok', deleted: removed.length });
      }
      if (method === 'GET') {
        if (!record) return jsonResponse({ error: '历史记录不存在' }, 404);
        if (!path.endsWith('/file')) return jsonResponse({ record });
        const file = zip.file(`history_files/${id}.xlsx`);
        if (!file) return jsonResponse({ error: '该历史记录没有保存 Excel 文件' }, 404);
        return new Response(await file.async('uint8array'), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'X-Filename': textBase64(record.filename || 'invoice.xlsx') } });
      }
    }
    const records = await read(zip, 'custom_templates.json', []);
    if ((method === 'DELETE' && /^\/templates\/tpl-/.test(path)) || (method === 'POST' && path === '/templates/bulk-delete')) {
      const ids = method === 'DELETE' ? [path.split('/')[2]] : payload.ids || [];
      const removed = records.filter(record => ids.includes(record.id));
      if (method === 'DELETE' && !removed.length) return jsonResponse({ error: '模板不存在' }, 404);
      for (const record of removed) for (const file of [record.storedFile, record.storedOriginalFile]) if (file) zip.remove(`custom_templates/${file}`);
      write(zip, 'custom_templates.json', records.filter(record => !ids.includes(record.id))); await commit();
      return jsonResponse({ status: 'ok', deleted: removed.length });
    }
    // Read catalogs need metadata only. Excel operations receive a single
    // selected workbook, never the product library, drafts, or history files.
    const selectedId = payload?.templateId || path.match(/^\/templates\/(tpl-[0-9a-f]{10})/)?.[1];
    const selected = records.filter(record => record.id === selectedId);
    const catalogRequest = ['/config', '/templates'].includes(path);
    const files = {};
    if (zip.file('template_settings.json')) files['template_settings.json'] = await zip.file('template_settings.json').async('base64');
    // Old desktop backups may predate required-field metadata. Infer it once
    // from each affected workbook, rather than silently dropping validation
    // when future catalog reads intentionally omit workbook binaries.
    if (catalogRequest && method === 'GET') {
      let repaired = false;
      for (const record of records) {
        if (!record.mapping || record.mapping.required) continue;
        const name = `custom_templates/${record.storedFile}`;
        if (!scopedFile(name) || !zip.file(name)) throw new Error('旧模板原文件缺失，请恢复备份');
        const detail = await requestRemote(`/templates/${record.id}`, 'GET', null, { ...files,
          'custom_templates.json': textBase64(JSON.stringify([record])), [name]: await zip.file(name).async('base64') });
        const data = JSON.parse(new TextDecoder().decode(fromBase64(detail.body)));
        if (detail.status !== 200 || !data.template?.mapping?.required) throw new Error(data.error || '旧模板必填字段读取失败');
        record.mapping.required = data.template.mapping.required; repaired = true;
      }
      if (repaired) { write(zip, 'custom_templates.json', records); await commit(); }
    }
    files['custom_templates.json'] = textBase64(JSON.stringify(catalogRequest ? records : selected));
    for (const record of selected) {
      const name = `custom_templates/${record.storedFile}`;
      if (!scopedFile(name) || !zip.file(name)) throw new Error('当前模板原文件缺失，请恢复备份或重新上传');
      files[name] = await zip.file(name).async('base64');
    }
    const result = await requestRemote(path, method, payload, files);
    const resultBody = fromBase64(result.body);
    if (result.status >= 200 && result.status < 300 && method !== 'GET' && path !== '/preview') {
      for (const name of result.removed || []) {
        if (!scopedFile(name)) throw new Error('处理服务返回了无效数据');
        zip.remove(name);
      }
      for (const [name, value] of Object.entries(result.changes || {})) {
        if (!scopedFile(name)) throw new Error('处理服务返回了无效数据');
        if (name === 'custom_templates.json') {
          const changed = JSON.parse(new TextDecoder().decode(fromBase64(value)));
          const changedIds = new Set(changed.map(record => record.id));
          write(zip, name, [...records.filter(record => !changedIds.has(record.id)), ...changed]);
        } else zip.file(name, fromBase64(value));
      }
      if (path === '/export') {
        const record = result.historyRecord;
        if (!record || !/^\d{14}-[0-9a-f]{8}$/.test(record.id)) throw new Error('导出历史数据无效，本地数据未修改');
        const history = await read(zip, 'export_history.json', []);
        history.unshift({ ...record, payload });
        // Preserve all existing records: users decide when to remove history.
        write(zip, 'export_history.json', history);
        zip.file(`history_files/${record.id}.xlsx`, resultBody);
      }
      await commit();
    }
    return new Response(resultBody, { status: result.status, headers: { ...result.headers, 'Cache-Control': 'private, no-store' } });
  }
  window.freightInvoiceDataFetch = function (input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !/^\/api\/(config|products|templates|field-catalog|draft|history|backup|restore|preview|export|data)(\/|$)/.test(url.pathname)) return null;
    const run = () => navigator.locks ? navigator.locks.request(DB_NAME, () => perform(url, input, init)) : perform(url, input, init);
    const result = pending.then(run); pending = result.catch(() => {}); return result;
  };
})();
