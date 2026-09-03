(function () {
  'use strict';
  const DB_NAME = 'freight-invoice-private-data-v1';
  const STORE = 'data';
  const PROTOCOL = 'freight-browser-v1';
  const ENDPOINT = '/api/freight-invoice-python';
  const MAX_WIRE_BYTES = 4000000;
  const nativeFetch = window.fetch.bind(window);
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
      transaction.onabort = transaction.onerror = () => {
        db.close(); reject(new Error('浏览器存储失败，本次修改未保存；请释放存储空间后重试'));
      };
    });
  }

  function fromBase64(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  async function toBase64(body) {
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    return btoa(binary);
  }

  async function perform(url, input, init) {
    const stored = await snapshot();
    const original = stored.encoded;
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = url.pathname.slice(4);
    // A backup is a local file download, including when the network is offline.
    if (path === '/backup' && method === 'GET' && original) {
      return new Response(fromBase64(original), { headers: { 'Content-Type': 'application/zip', 'X-Backup-Counts': btoa(JSON.stringify(stored.counts)) } });
    }
    const requestHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));
    const body = init?.body !== undefined ? init.body : input instanceof Request && method !== 'GET' ? await input.clone().blob() : null;
    const envelope = {
      protocol: PROTOCOL, method, path,
      contentType: requestHeaders.get('Content-Type') || 'application/json',
      body: body === null ? '' : await toBase64(body),
      snapshot: path === '/restore' ? '' : original,
    };
    const serialized = JSON.stringify(envelope);
    if (new Blob([serialized]).size > MAX_WIRE_BYTES) {
      throw new Error('数据超过在线处理容量，本地原数据未修改；请先导出备份并减少历史文件或图片');
    }
    const response = await nativeFetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: serialized, cache: 'no-store',
    });
    if (!(response.headers.get('Content-Type') || '').includes('application/json')) {
      throw new Error(`Excel 处理服务返回网页错误（HTTP ${response.status}），本地数据未修改`);
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Excel 处理失败，本地数据未修改');
    if (result.protocol !== PROTOCOL || !Number.isInteger(result.status) || typeof result.body !== 'string') {
      throw new Error('后端版本不匹配，请等待部署完成后刷新；本地数据未修改');
    }
    // Commit before acknowledging success; quota/network failures retain old data.
    if (result.status >= 200 && result.status < 300 && typeof result.snapshot === 'string') {
      if ((await snapshot()).encoded !== original) throw new Error('另一个标签页已更新本地数据，请刷新后重试');
      await snapshot(result.snapshot, result.counts);
    }
    return new Response(fromBase64(result.body), {
      status: result.status, headers: { ...result.headers, 'Cache-Control': 'private, no-store' },
    });
  }

  window.freightInvoiceDataFetch = function (input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !/^\/api\/(config|products|templates|field-catalog|draft|history|backup|restore|preview|export|data)(\/|$)/.test(url.pathname)) return null;
    const run = () => navigator.locks
      ? navigator.locks.request(DB_NAME, () => perform(url, input, init))
      : perform(url, input, init);
    const result = pending.then(run);
    pending = result.catch(() => {});
    return result;
  };
})();
