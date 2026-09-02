(function () {
  const STORAGE_KEY = 'freight-invoice-browser-warehouses-v1';
  const scriptUrl = document.currentScript && document.currentScript.src;
  const defaultsUrl = new URL('./warehouses.json', scriptUrl || window.location.href).toString();
  const nativeFetch = window.fetch.bind(window);
  let defaultsPromise;

  function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      };
    } catch {
      return { overrides: {}, custom: [], deletedIds: [] };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function loadDefaults() {
    if (!defaultsPromise) {
      defaultsPromise = nativeFetch(defaultsUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('仓库预设文件读取失败');
          return response.json();
        })
        .then((rows) => Array.isArray(rows) ? rows : []);
    }
    return defaultsPromise;
  }

  async function warehouseSnapshot() {
    const defaults = await loadDefaults();
    const state = readState();
    const deleted = new Set(state.deletedIds);
    const records = defaults
      .filter((record) => !deleted.has(record.id))
      .map((record) => state.overrides[record.id] || record);
    const defaultIds = new Set(defaults.map((record) => record.id));
    state.custom.forEach((record) => {
      if (!defaultIds.has(record.id)) records.push(record);
    });
    return { defaults, state, records };
  }

  function searchableText(record) {
    return [record.code, record.address, record.city, record.state, record.postalCode,
      record.country, record.countryCode, record.region].filter(Boolean).join(' ').toLocaleLowerCase();
  }

  function newWarehouseId() {
    const hex = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    return `wh-${hex.slice(0, 12).padEnd(12, '0')}`;
  }

  function normalizedRecord(payload) {
    return {
      id: /^wh-[0-9a-f]{12}$/.test(String(payload.id || '')) ? payload.id : newWarehouseId(),
      code: String(payload.code || '').trim().toUpperCase(),
      country: String(payload.country || '').trim(),
      countryCode: String(payload.countryCode || '').trim().toUpperCase(),
      region: String(payload.region || '').trim(),
      address: String(payload.address || '').trim(),
      city: String(payload.city || '').trim(),
      state: String(payload.state || '').trim().toUpperCase(),
      postalCode: String(payload.postalCode || '').trim(),
    };
  }

  async function handleGet(url) {
    const { records } = await warehouseSnapshot();
    const query = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 30));
    const matches = records.filter((record) => {
      const haystack = searchableText(record);
      return words.every((word) => haystack.includes(word));
    }).sort((left, right) => {
      const leftCode = String(left.code || '').replace(/\s*\(.*?\)\s*$/, '').toLocaleLowerCase();
      const rightCode = String(right.code || '').replace(/\s*\(.*?\)\s*$/, '').toLocaleLowerCase();
      const rank = (code) => query && code === query ? 0 : query && code.startsWith(query) ? 1 : 2;
      return rank(leftCode) - rank(rightCode) || leftCode.localeCompare(rightCode);
    });
    return jsonResponse({ warehouses: matches.slice(0, limit), total: matches.length });
  }

  async function handlePost(init) {
    const payload = JSON.parse(String(init && init.body || '{}'));
    const record = normalizedRecord(payload);
    if (!record.code || record.code.length > 30) {
      return jsonResponse({ error: '仓库代码不能为空且不能超过 30 个字符' }, 400);
    }
    const snapshot = await warehouseSnapshot();
    const duplicate = snapshot.records.find((item) => item.id !== record.id
      && String(item.code || '').toLocaleLowerCase() === record.code.toLocaleLowerCase()
      && String(item.address || '').toLocaleLowerCase() === record.address.toLocaleLowerCase());
    if (duplicate) return jsonResponse({ error: '相同代码和地址的仓库已存在' }, 400);

    const defaultIds = new Set(snapshot.defaults.map((item) => item.id));
    if (defaultIds.has(record.id)) snapshot.state.overrides[record.id] = record;
    else {
      const index = snapshot.state.custom.findIndex((item) => item.id === record.id);
      if (index >= 0) snapshot.state.custom[index] = record;
      else snapshot.state.custom.push(record);
    }
    snapshot.state.deletedIds = snapshot.state.deletedIds.filter((id) => id !== record.id);
    saveState(snapshot.state);
    const total = (await warehouseSnapshot()).records.length;
    return jsonResponse({ status: 'ok', warehouse: record, total });
  }

  async function handleDelete(warehouseId) {
    const snapshot = await warehouseSnapshot();
    if (!snapshot.records.some((record) => record.id === warehouseId)) {
      return jsonResponse({ error: '仓库不存在' }, 404);
    }
    const defaultIds = new Set(snapshot.defaults.map((record) => record.id));
    if (defaultIds.has(warehouseId)) {
      if (!snapshot.state.deletedIds.includes(warehouseId)) snapshot.state.deletedIds.push(warehouseId);
      delete snapshot.state.overrides[warehouseId];
    } else {
      snapshot.state.custom = snapshot.state.custom.filter((record) => record.id !== warehouseId);
    }
    saveState(snapshot.state);
    const total = (await warehouseSnapshot()).records.length;
    return jsonResponse({ status: 'ok', total });
  }

  window.freightInvoiceWarehouseFetch = async function (input, init) {
    const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    const url = new URL(rawUrl, window.location.origin);
    const match = url.pathname.match(/^\/api\/warehouses(?:\/(wh-[0-9a-f]{12}))?$/);
    if (!match) return null;
    const method = String((init && init.method) || (input instanceof Request && input.method) || 'GET').toUpperCase();
    if (method === 'GET' && !match[1]) return handleGet(url);
    if (method === 'POST' && !match[1]) return handlePost(init);
    if (method === 'DELETE' && match[1]) return handleDelete(match[1]);
    return jsonResponse({ error: '不支持的仓库操作' }, 405);
  };
})();
