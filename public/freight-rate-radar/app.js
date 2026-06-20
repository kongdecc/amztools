const state = {
  files: [],
  records: [],
  lastCode: "",
  lastResults: [],
  presetWarehouses: Array.isArray(window.PRESET_WAREHOUSES) ? window.PRESET_WAREHOUSES : [],
  localWarehouses: [],
};

const DB_NAME = "freight-rate-radar-db";
const DB_VERSION = 1;
const DB_STORE = "snapshots";
const DB_KEY = "current";

function openLocalDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("当前浏览器不支持本地持久保存。"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("打开本地报价库失败。"));
  });
}

async function withLocalStore(mode, work) {
  const db = await openLocalDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);
      const result = work(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error("本地报价库操作失败。"));
      tx.onabort = () => reject(tx.error || new Error("本地报价库操作中止。"));
    });
  } finally {
    db.close();
  }
}

async function saveLocalStore() {
  const payload = {
    savedAt: new Date().toISOString(),
    files: state.files,
    localWarehouses: state.localWarehouses,
  };
  await withLocalStore("readwrite", (store) => store.put(payload, DB_KEY));
}

async function loadLocalStore() {
  const payload = await withLocalStore("readonly", (store) => {
    const request = store.get(DB_KEY);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("读取本地报价库失败。"));
    });
  });
  if (!payload?.files?.length) return false;
  state.localWarehouses = Array.isArray(payload.localWarehouses) ? payload.localWarehouses : [];
  state.files = payload.files.map((file) => ({
    ...file,
    recordsList: Array.isArray(file.recordsList) ? file.recordsList : [],
    disabled: Boolean(file.disabled),
  }));
  return true;
}

async function clearLocalStore() {
  await withLocalStore("readwrite", (store) => store.delete(DB_KEY));
}

const els = {
  recordCount: document.querySelector("#recordCount"),
  warehouseCount: document.querySelector("#warehouseCount"),
  companyCount: document.querySelector("#companyCount"),
  companyList: document.querySelector("#companyList"),
  warehouseList: document.querySelector("#warehouseList"),
  warehouseCode: document.querySelector("#warehouseCode"),
  weightKg: document.querySelector("#weightKg"),
  companyFilter: document.querySelector("#companyFilter"),
  priceMax: document.querySelector("#priceMax"),
  transitMax: document.querySelector("#transitMax"),
  taxFilter: document.querySelector("#taxFilter"),
  unitFilter: document.querySelector("#unitFilter"),
  viewMode: document.querySelector("#viewMode"),
  uniqueCompany: document.querySelector("#uniqueCompany"),
  searchBtn: document.querySelector("#searchBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  resultTitle: document.querySelector("#resultTitle"),
  messageBox: document.querySelector("#messageBox"),
  summaryStrip: document.querySelector("#summaryStrip"),
  bestPrice: document.querySelector("#bestPrice"),
  quoteCount: document.querySelector("#quoteCount"),
  priceRange: document.querySelector("#priceRange"),
  cardDeck: document.querySelector("#cardDeck"),
  tableWrap: document.querySelector("#tableWrap"),
  resultRows: document.querySelector("#resultRows"),
  copyBestBtn: document.querySelector("#copyBestBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  manageToggle: document.querySelector("#manageToggle"),
  managePanel: document.querySelector("#managePanel"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  uploadCompany: document.querySelector("#uploadCompany"),
  uploadMarket: document.querySelector("#uploadMarket"),
  exportLibraryBtn: document.querySelector("#exportLibraryBtn"),
  importLibraryInput: document.querySelector("#importLibraryInput"),
  rebuildBtn: document.querySelector("#rebuildBtn"),
  uploadMessage: document.querySelector("#uploadMessage"),
  fileList: document.querySelector("#fileList"),
};

const IGNORE_SHEET_KEYWORDS = ["目录", "注意", "附加", "发货", "船期", "偏远", "罚款", "品牌", "收货", "查验", "海外仓"];
const ORIGIN_KEYS = ["华东", "华南", "福建", "青岛", "深圳", "广州", "中山", "汕头", "义乌", "宁波", "苏州", "厦门", "泉州", "天津", "河北"];
const PRICE_TIER_RE = /(\d+(?:\.\d+)?)\s*(KG|KGS|CBM|方)\s*\+?/i;
const FBA_TOKEN_RE = /[A-Za-z0-9]{3,6}/g;

function normalizeWarehouseCode(code) {
  const value = blank(code).toUpperCase();
  const match = value.match(/[A-Z0-9]{3,6}/);
  return match ? match[0] : value;
}

function warehouseLabel(row) {
  if (!row) return "";
  const area = [row.region, row.city, row.state, row.zip].filter(Boolean).join(" · ");
  return `${row.code}${row.remote ? "（偏远）" : ""}${area ? ` - ${area}` : ""}`;
}

function warehouseInfo(code) {
  const base = normalizeWarehouseCode(code);
  if (!base) return null;
  return [...state.localWarehouses, ...state.presetWarehouses].find((row) => row.codeBase === base || normalizeWarehouseCode(row.code) === base) || null;
}


function addWarehousesFromRecords(records) {
  const added = [];
  records.forEach((record) => {
    const base = normalizeWarehouseCode(record.warehouse_code);
    if (!base || warehouseInfo(base)) return;
    const row = {
      country: "",
      region: "报价文件新增",
      code: record.warehouse_full || record.warehouse_code || base,
      codeBase: base,
      address: "",
      city: "",
      state: "",
      zip: record.postal_code || "",
      remote: /偏远/.test(record.warehouse_full || record.warehouse_code || ""),
      source: "quote-file",
    };
    state.localWarehouses.push(row);
    added.push(row);
  });
  return added;
}
function warehouseMessage(code) {
  const row = warehouseInfo(code);
  if (!row) return "";
  const location = [row.country, row.region, row.city, row.state, row.zip].filter(Boolean).join(" · ");
  return `仓库 ${row.code}${row.remote ? "（偏远）" : ""}：${location}${row.address ? `，${row.address}` : ""}`;
}

function text(value, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  const out = String(value).replace(/\r/g, " ").replace(/\n/g, " / ").trim();
  return out || fallback;
}

function blank(value) {
  return text(value, "");
}

function compact(value) {
  return blank(value).replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setMessage(message, type = "muted") {
  els.messageBox.textContent = message;
  els.messageBox.className = `message is-${type}`;
}

function setUploadMessage(message, type = "muted") {
  els.uploadMessage.textContent = message;
  els.uploadMessage.className = `message is-${type}`;
}

function looksLikeWarehouseCode(token) {
  const value = blank(token).toUpperCase();
  if (value.length < 3 || value.length > 6) return false;
  if (["KG", "CBM", "KGS", "USA", "UPS", "FBA", "WMT", "ETD", "ETA"].includes(value)) return false;
  if (value.endsWith("KG") || value.endsWith("CBM")) return false;
  return /[A-Z]/.test(value) && (/\d/.test(value) || value.length === 4);
}

function extractWarehouseCodes(value) {
  const raw = blank(value).toUpperCase();
  const seen = new Set();
  const codes = [];
  for (const token of raw.match(FBA_TOKEN_RE) || []) {
    if (looksLikeWarehouseCode(token) && !seen.has(token)) {
      seen.add(token);
      codes.push(token);
    }
  }
  return codes;
}

function asNumber(value) {
  const raw = blank(value);
  if (!raw || ["-", "/"].includes(raw)) return null;
  if (["无服务", "暂停", "待定", "#REF", "#N/A", "渠道无此价"].some((flag) => raw.includes(flag))) return null;
  const cleaned = raw.replace(/,/g, "").replace(/[￥¥]/g, "").replace(/RMB|CNY|USD|元\/KG|\/kg|\/CBM|\/cbm/gi, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 10000) / 10000;
}

function niceNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace(/\.0+$/, "");
}

function inferCompany(fileName, override) {
  if (blank(override)) return blank(override);
  const stem = fileName.replace(/\.[^.]+$/, "");
  return stem.replace(/[-_ ]?\d{4}.*$/, "").trim() || stem;
}

function shouldSkipSheet(name) {
  if (["汇总表", "美国FBA仓库产品匹配表", "快键查询价格表", "价格快速查询"].includes(name)) return false;
  return IGNORE_SHEET_KEYWORDS.some((key) => name.includes(key));
}

function findWarehouseCol(row, nextRows) {
  const candidates = [];
  row.forEach((cell, idx) => {
    const value = compact(cell);
    let score = 0;
    if (value.includes("仓库代码简称")) score = 100;
    else if (value.includes("仓库代码")) score = 90;
    else if (value.includes("FBA仓") || value.includes("FBA代码")) score = 80;
    else if (value === "产品名称") score = 50;
    if (score) candidates.push({ score, idx });
  });
  candidates.sort((a, b) => b.score - a.score);
  for (const candidate of candidates) {
    const hits = nextRows.slice(0, 12).filter((r) => extractWarehouseCodes(r[candidate.idx]).length).length;
    if (hits) return candidate.idx;
  }
  return null;
}

function filledHeaderRows(rows, width) {
  return rows.map((row) => {
    const out = [];
    let last = "";
    for (let i = 0; i < width; i += 1) {
      const value = blank(row[i]);
      if (value) last = value;
      out.push(last);
    }
    return out;
  });
}

function isPriceCol(path) {
  const joined = compact(path.join(" "));
  if (!joined) return false;
  if (["时效", "航期", "船期", "截单", "预计", "备注", "邮编", "区域"].some((key) => joined.includes(key))) {
    if (!PRICE_TIER_RE.test(joined) && !joined.includes("报价")) return false;
  }
  return PRICE_TIER_RE.test(joined) || /1CBM/i.test(joined) || joined.includes("包税报价") || joined.includes("不包税报价");
}

function inferTier(path) {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const value = compact(path[i]).toUpperCase();
    if (PRICE_TIER_RE.test(value) || value.includes("1CBM") || value.includes("5CBM")) return blank(path[i]);
  }
  return "";
}

function inferUnit(tier, path) {
  const joined = compact([tier, ...path].join(" ")).toUpperCase();
  if (joined.includes("CBM") || joined.includes("方")) return "CBM";
  if (joined.includes("KG")) return "KG";
  return "";
}

function inferTaxType(path) {
  const joined = compact(path.join(" "));
  if (joined.includes("不含税") || joined.includes("不包税")) return "不含税/不包税";
  if (joined.includes("自税")) return "自税";
  if (joined.includes("含税") || joined.includes("包税")) return "含税/包税";
  return "";
}

function inferOrigin(path) {
  return path.find((item) => ORIGIN_KEYS.some((key) => blank(item).includes(key))) || "";
}

function inferChannel(path, sheetName, rowProduct = "") {
  if (rowProduct && !extractWarehouseCodes(rowProduct).length) return rowProduct;
  const ignored = ["含税", "不含税", "包税", "不包税", "自税", "KG", "CBM", "返回目录", "进入报价表"];
  const candidates = path.map(blank).filter((item) => {
    const value = compact(item);
    if (!value) return false;
    if (value.includes("材积重") || value.includes("产品代码")) return false;
    if (ignored.some((flag) => value.includes(flag))) return false;
    if (ORIGIN_KEYS.some((flag) => value.includes(flag))) return false;
    if (value.includes("仓库代码") || value.includes("FBA仓") || value === "产品名称") return false;
    return true;
  });
  return candidates[candidates.length - 1] || sheetName;
}

function findMetaCols(headerPaths, warehouseCol) {
  const meta = { product_code: [], transit: [], note: [], zip: [], product_name: [] };
  Object.entries(headerPaths).forEach(([colText, path]) => {
    const col = Number(colText);
    if (col === warehouseCol || isPriceCol(path)) return;
    const joined = compact(path.join(" "));
    if (joined.includes("销售产品代码") || joined.includes("产品代码")) meta.product_code.push(col);
    if (["参考时效", "理赔时效", "时效", "航期", "船期", "ETA", "开航"].some((key) => joined.includes(key))) meta.transit.push(col);
    if (joined.includes("备注") || joined.includes("说明")) meta.note.push(col);
    if (joined.includes("邮编")) meta.zip.push(col);
    if (joined.includes("产品名称")) meta.product_name.push(col);
  });
  return meta;
}

function rowValue(row, cols) {
  for (const col of cols) {
    if (blank(row[col])) return blank(row[col]);
  }
  return "";
}

function parseSection({ rows, headerIdx, warehouseCol, company, market, fileName, sheetName }) {
  let width = 0;
  rows.slice(Math.max(0, headerIdx - 4), headerIdx + 3).forEach((row) => { width = Math.max(width, row.length); });
  width = Math.min(width, 90);
  const headerStart = Math.max(0, headerIdx - 4);
  let headerEnd = headerIdx + 1;
  const nextJoined = compact((rows[headerIdx + 1] || []).join(" "));
  if (["华东", "华南", "福建", "青岛", "含税", "不含税", "KG+", "CBM+"].some((key) => nextJoined.includes(key))) headerEnd = headerIdx + 2;
  const rawHeaderRows = rows.slice(headerStart, headerEnd);
  const headerRows = filledHeaderRows(rawHeaderRows, width);
  const headerPaths = {};
  const rawHeaderPaths = {};
  for (let col = 0; col < width; col += 1) {
    headerPaths[col] = headerRows.map((r) => blank(r[col])).filter(Boolean);
    rawHeaderPaths[col] = rawHeaderRows.map((r) => blank(r[col])).filter(Boolean);
  }
  const priceCols = Object.entries(headerPaths).filter(([col, path]) => Number(col) !== warehouseCol && isPriceCol(path)).map(([col]) => Number(col));
  if (!priceCols.length) return [];
  const metaCols = findMetaCols(rawHeaderPaths, warehouseCol);
  const records = [];
  let lastProductCode = "";
  let lastProductName = "";

  for (let rowIdx = headerEnd; rowIdx < rows.length; rowIdx += 1) {
    const row = rows[rowIdx] || [];
    const codes = extractWarehouseCodes(row[warehouseCol]);
    if (!codes.length) continue;
    const fullCode = blank(row[warehouseCol]);
    let productCode = rowValue(row, metaCols.product_code);
    if (productCode) lastProductCode = productCode;
    else productCode = lastProductCode;
    let rowProduct = rowValue(row, metaCols.product_name);
    if (rowProduct && !extractWarehouseCodes(rowProduct).length) lastProductName = rowProduct;
    else rowProduct = lastProductName;
    const transit = rowValue(row, metaCols.transit);
    const note = rowValue(row, metaCols.note);
    for (const col of priceCols) {
      const value = asNumber(row[col]);
      if (value === null) continue;
      const path = headerPaths[col] || [];
      const tier = inferTier(path);
      for (const code of codes) {
        records.push({
          company,
          market,
          source_file: fileName,
          sheet: sheetName,
          warehouse_code: code,
          warehouse_full: fullCode,
          channel: inferChannel(path, sheetName, rowProduct),
          origin: inferOrigin(path),
          tier,
          unit: inferUnit(tier, path),
          tax_type: inferTaxType(path),
          price: niceNumber(value),
          price_value: value,
          product_code: productCode,
          transit,
          note,
          row: rowIdx + 1,
          column: col + 1,
        });
      }
    }
  }
  return records;
}

function dedupe(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = [record.company, record.source_file, record.sheet, record.warehouse_code, record.channel, record.origin, record.tier, record.tax_type, record.price].join("\u0001");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseWorkbook(workbook, fileName, companyOverride, market) {
  const company = inferCompany(fileName, companyOverride);
  const records = [];
  workbook.SheetNames.forEach((sheetName) => {
    if (shouldSkipSheet(sheetName)) return;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }).map((row) => row.map(blank));
    rows.forEach((row, idx) => {
      const warehouseCol = findWarehouseCol(row, rows.slice(idx + 1, idx + 15));
      if (warehouseCol === null) return;
      records.push(...parseSection({ rows, headerIdx: idx, warehouseCol, company, market, fileName, sheetName }));
    });
  });
  return dedupe(records);
}

function setOptions(select, values, emptyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  if (values.includes(current)) select.value = current;
}

function setDatalistOptions(list, values) {
  if (!list) return;
  list.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    list.append(option);
  });
}

function updateStats() {
  const activeRecords = state.files.filter((file) => !file.disabled).flatMap((file) => file.recordsList);
  state.records = activeRecords;
  const quoteWarehouses = activeRecords.map((r) => r.warehouse_code).filter(Boolean);
  const presetWarehouses = [...state.presetWarehouses, ...state.localWarehouses].map((row) => row.codeBase).filter(Boolean);
  const warehouses = [...new Set([...quoteWarehouses, ...presetWarehouses])].sort();
  const companies = [...new Set(activeRecords.map((r) => r.company).filter(Boolean))].sort();
  const taxes = [...new Set(activeRecords.map((r) => r.tax_type).filter(Boolean))].sort();
  const units = [...new Set(activeRecords.map((r) => r.unit).filter(Boolean))].sort();
  els.recordCount.textContent = String(activeRecords.length);
  els.warehouseCount.textContent = String(warehouses.length);
  els.companyCount.textContent = String(companies.length);
  setDatalistOptions(els.companyList, companies);
  setDatalistOptions(els.warehouseList, warehouses.map((code) => {
    const info = warehouseInfo(code);
    return info ? warehouseLabel(info) : code;
  }));
  setOptions(els.taxFilter, taxes, "全部税别");
  setOptions(els.unitFilter, units, "全部单位");
}


function transitDays(record) {
  const raw = blank(record?.transit).toUpperCase();
  if (!raw) return null;
  const normalized = raw.replace(/工作日|自然日|左右|约|预计|参考|时效|签收|派送|妥投|天/g, "D").replace(/HOURS?/g, "H").replace(/DAYS?/g, "D");
  const hourMatches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*H/g)].map((m) => Number(m[1]) / 24);
  const dayMatches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*D/g)].map((m) => Number(m[1]));
  const rangeMatches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
  const values = [...hourMatches, ...dayMatches, ...rangeMatches].filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return Math.max(...values);
}

function transitLabel(record) {
  const days = transitDays(record);
  if (!days) return text(record?.transit);
  const label = days < 1 ? `${Math.ceil(days * 24)}小时内` : `约${niceNumber(days)}天`;
  return record?.transit ? `${record.transit}（${label}）` : label;
}

function balancedScore(record, minPrice, fastestDays) {
  const price = Number(record.price_value);
  const days = transitDays(record);
  const pricePenalty = Number.isFinite(price) && minPrice ? price / minPrice : 1.5;
  const timePenalty = days && fastestDays ? days / fastestDays : 1.25;
  return pricePenalty * 0.68 + timePenalty * 0.32;
}
function weightMatches(record, weight) {
  if (!weight || weight <= 0) return true;
  if (!record.unit || !record.unit.toUpperCase().includes("KG")) return true;
  const tier = record.tier || "";
  let match = tier.match(/(\d+(?:\.\d+)?)\+/);
  if (match) return weight >= Number(match[1]);
  match = tier.match(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)/);
  if (match) return weight >= Number(match[1]) && weight <= Number(match[2]);
  return true;
}

function keepLowestPerCompany(records) {
  const bestByCompany = new Map();
  records.forEach((record) => {
    const key = record.company || "未识别货代";
    const current = bestByCompany.get(key);
    if (!current || (record.price_value ?? 999999) < (current.price_value ?? 999999)) {
      bestByCompany.set(key, record);
    }
  });
  return [...bestByCompany.values()].sort((a, b) => (a.price_value ?? 999999) - (b.price_value ?? 999999) || a.company.localeCompare(b.company));
}

function searchQuotes() {
  const code = normalizeWarehouseCode(els.warehouseCode.value);
  if (!code) {
    setMessage("请先输入 FBA 仓库代码。", "error");
    els.warehouseCode.focus();
    return;
  }
  if (!state.records.length) {
    const info = warehouseMessage(code);
    setMessage(info ? `${info}。请先在“报价文件库”上传 Excel 报价文件后比价。` : "请先在“报价文件库”上传 Excel 报价文件。", "error");
    return;
  }
  const company = els.companyFilter.value.trim().toLowerCase();
  const weight = els.weightKg.value ? Number(els.weightKg.value) : null;
  const priceMax = els.priceMax?.value ? Number(els.priceMax.value) : null;
  const transitMax = els.transitMax?.value ? Number(els.transitMax.value) : null;
  const tax = els.taxFilter?.value || "";
  const unit = els.unitFilter?.value || "";
  let records = state.records
    .filter((r) => r.warehouse_code.toUpperCase() === code)
    .filter((r) => !company || r.company.toLowerCase().includes(company))
    .filter((r) => weightMatches(r, weight))
    .filter((r) => !priceMax || Number(r.price_value) <= priceMax)
    .filter((r) => !transitMax || (transitDays(r) !== null && transitDays(r) <= transitMax))
    .filter((r) => !tax || r.tax_type === tax)
    .filter((r) => !unit || r.unit === unit);
  const mode = els.viewMode?.value || "price";
  const minPrice = Math.min(...records.map((r) => Number(r.price_value)).filter(Number.isFinite));
  const fastestDays = Math.min(...records.map(transitDays).filter((value) => value !== null));
  records = records.sort((a, b) => {
    if (mode === "fastest") return (transitDays(a) ?? 999999) - (transitDays(b) ?? 999999) || (a.price_value ?? 999999) - (b.price_value ?? 999999);
    if (mode === "balanced") return balancedScore(a, minPrice, fastestDays) - balancedScore(b, minPrice, fastestDays);
    return (a.price_value ?? 999999) - (b.price_value ?? 999999) || a.company.localeCompare(b.company);
  });
  if (els.uniqueCompany?.checked) records = keepLowestPerCompany(records);
  renderResults(records.slice(0, 200), code);
  if (els.uniqueCompany?.checked && records.length) {
    setMessage(`已按每家货代最低价汇总，显示 ${Math.min(records.length, 200)} 条结果。`, "good");
  }
}

function priceStats(records) {
  const prices = records.map((record) => Number(record.price_value)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!prices.length) return { best: "-", range: "-" };
  const min = prices[0];
  const max = prices[prices.length - 1];
  const bestRecord = records.find((record) => Number(record.price_value) === min);
  return { best: text(bestRecord?.price ?? min), range: min === max ? text(min) : `${text(min)} - ${text(max)}` };
}

function renderResults(records, code) {
  state.lastCode = code;
  state.lastResults = records;
  els.exportBtn.disabled = records.length === 0;
  if (els.copyBestBtn) els.copyBestBtn.disabled = records.length === 0;
  els.resultTitle.textContent = records.length ? `${code} 报价面板` : "没有匹配报价";
  els.summaryStrip.hidden = records.length === 0;
  els.tableWrap.hidden = records.length === 0;
  if (!records.length) {
    els.cardDeck.innerHTML = "";
    state.lastResults = [];
    els.resultRows.innerHTML = "";
    const info = warehouseMessage(code);
    setMessage(info ? `${info}。但当前报价库中没有匹配报价。` : "未找到该仓库报价。请确认仓库代码，或上传包含该仓库的报价 Excel。", "error");
    return;
  }
  const stats = priceStats(records);
  els.bestPrice.textContent = stats.best;
  els.quoteCount.textContent = String(records.length);
  els.priceRange.textContent = stats.range;
  const info = warehouseMessage(code);
  setMessage(`${info ? `${info}。` : ""}已找到 ${records.length} 条报价，结果按价格升序排列。`, "good");
  renderCards(records, els.viewMode?.value || "price");
  renderTable(records);
}

function groupRecords(records, mode) {
  if (!mode || mode === "price") return [{ label: "价格排序", records }];
  const keyName = mode === "company" ? "company" : "channel";
  const groups = new Map();
  records.forEach((record) => {
    const key = record[keyName] || "未填写";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return [...groups.entries()]
    .map(([label, items]) => ({ label, records: items.sort((a, b) => (a.price_value ?? 999999) - (b.price_value ?? 999999)) }))
    .sort((a, b) => (a.records[0]?.price_value ?? 999999) - (b.records[0]?.price_value ?? 999999));
}

function renderCards(records, mode = "price") {
  els.cardDeck.innerHTML = "";
  const numericPrices = records.map((record) => Number(record.price_value)).filter(Number.isFinite);
  const best = numericPrices.length ? Math.min(...numericPrices) : null;
  let rendered = 0;
  groupRecords(records, mode).forEach((group) => {
    if (mode !== "price") {
      const heading = document.createElement("div");
      heading.className = "quote-group-heading";
      heading.textContent = `${group.label} · ${group.records.length} 条`;
      els.cardDeck.append(heading);
    }
    group.records.slice(0, Math.max(0, 80 - rendered)).forEach((record, groupIndex) => {
    const index = rendered + groupIndex;
    const priceValue = Number(record.price_value);
    const delta = best !== null && Number.isFinite(priceValue) ? priceValue - best : null;
    const deltaLabel = delta && delta > 0 ? `+${niceNumber(delta)}` : "最低";
    const card = document.createElement("article");
    card.className = `quote-card quote-row${index === 0 ? " is-best" : ""}`;
    card.innerHTML = `
      <div class="quote-rank">${index + 1}</div>
      <div class="quote-main">
        <div class="quote-title-line">
          <h3>${escapeHtml(text(record.company))}</h3>
          ${index === 0 ? '<span class="badge">当前最低价</span>' : `<span class="delta-badge">${escapeHtml(deltaLabel)}</span>`}
        </div>
        <div class="quote-subline" title="${escapeHtml(text(record.channel))}">${escapeHtml(text(record.channel))}</div>
        <div class="quote-tags">
          <span>税别：${escapeHtml(text(record.tax_type))}</span>
          <span>起运：${escapeHtml(text(record.origin))}</span>
          <span>档位：${escapeHtml(text(record.tier))}</span>
          <span>单位：${escapeHtml(text(record.unit))}</span>
          <span class="transit-chip">时效：${escapeHtml(transitLabel(record))}</span>
          <span>来源：${escapeHtml(text(record.source_file))}</span>
        </div>
      </div>
      <div class="quote-price-block">
        <span>报价</span>
        <strong>${escapeHtml(text(record.price))}</strong>
      </div>
    `;
    els.cardDeck.append(card);
    });
    rendered += group.records.length;
  });
  if (records.length > 80) {
    const more = document.createElement("div");
    more.className = "message is-muted";
    more.textContent = `已显示前 80 条报价。可用重量或货代公司筛选来缩小结果。`;
    els.cardDeck.append(more);
  }
}

function renderTable(records) {
  els.resultRows.innerHTML = "";
  records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(text(record.company))}</td>
      <td>${escapeHtml(text(record.channel))}</td>
      <td>${escapeHtml(text(record.tax_type))}</td>
      <td>${escapeHtml(text(record.origin))}</td>
      <td>${escapeHtml(text(record.tier))}</td>
      <td>${escapeHtml(text(record.unit))}</td>
      <td>${escapeHtml(text(record.price))}</td>
      <td>${escapeHtml(transitLabel(record))}</td>
      <td>${escapeHtml(text(record.effective_date))}</td>
      <td title="${escapeHtml(text(record.source_file))}">${escapeHtml(text(record.source_file))}</td>
    `;
    els.resultRows.append(row);
  });
}

function csvCell(value) {
  const raw = String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}


async function copyBestQuote() {
  const best = state.lastResults[0];
  if (!best) return;
  const line = [
    `仓库：${state.lastCode || best.warehouse_code}`,
    `货代：${text(best.company)}`,
    `渠道：${text(best.channel)}`,
    `价格：${text(best.price)}/${text(best.unit)}`,
    `税别：${text(best.tax_type)}`,
    `时效：${transitLabel(best)}`,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(line);
    setMessage("已复制当前最低价信息。", "good");
  } catch {
    window.prompt("复制失败，可以手动复制以下内容：", line);
  }
}

function exportLibrary() {
  const payload = {
    type: "freight-rate-radar-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    files: state.files,
    localWarehouses: state.localWarehouses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `头程比价报价库-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importLibrary(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.type !== "freight-rate-radar-library" || !Array.isArray(payload.files)) {
      throw new Error("不是有效的头程比价报价库文件。");
    }
    state.localWarehouses = Array.isArray(payload.localWarehouses) ? payload.localWarehouses : [];
    state.files = payload.files.map((item) => ({
      ...item,
      id: item.id || `${item.name || "library"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      recordsList: Array.isArray(item.recordsList) ? item.recordsList : [],
      disabled: Boolean(item.disabled),
      error: item.error || "",
    }));
    updateStats();
    renderFiles();
    await saveLocalStore();
    setUploadMessage(`已导入报价库：${state.files.length} 个文件，${state.records.length} 条可用报价。`, "good");
    setMessage("报价库已导入，可直接输入仓库代码查价。", "good");
  } catch (error) {
    setUploadMessage(error.message || "报价库导入失败。", "error");
  } finally {
    if (els.importLibraryInput) els.importLibraryInput.value = "";
  }
}
function downloadCsv() {
  const code = state.lastCode;
  const visibleRecords = [...els.resultRows.querySelectorAll("tr")];
  if (!visibleRecords.length) return;
  const headers = ["货代", "渠道", "税别", "起运地", "档位", "单位", "价格", "时效", "生效日期", "来源"];
  const lines = [headers.map(csvCell).join(",")];
  visibleRecords.forEach((row) => {
    lines.push([...row.children].map((cell) => csvCell(cell.textContent)).join(","));
  });
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `freight-${code || "quotes"}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function uploadFiles(files) {
  if (!window.XLSX) {
    setUploadMessage("Excel 解析库没有加载成功。请确认 xlsx.full.min.js 和 index.html 在同一个文件夹内。", "error");
    return;
  }
  const chosen = Array.from(files || []).filter((file) => /\.(xls|xlsx)$/i.test(file.name));
  if (!chosen.length) {
    setUploadMessage("请选择 .xls 或 .xlsx 报价文件。", "error");
    return;
  }
  setUploadMessage(`正在解析 ${chosen.length} 个文件...`, "muted");
  for (const file of chosen) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const recordsList = parseWorkbook(workbook, file.name, els.uploadCompany.value, els.uploadMarket.value);
      const addedWarehouses = addWarehousesFromRecords(recordsList);
      state.files.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        company: inferCompany(file.name, els.uploadCompany.value),
        market: els.uploadMarket.value.trim(),
        recordsList,
        addedWarehouseCount: addedWarehouses.length,
        disabled: false,
        error: "",
      });
    } catch (error) {
      state.files.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        company: inferCompany(file.name, els.uploadCompany.value),
        market: els.uploadMarket.value.trim(),
        recordsList: [],
        disabled: false,
        error: error.message || "解析失败",
      });
    }
  }
  updateStats();
  renderFiles();
  try {
    await saveLocalStore();
    setUploadMessage(`已解析并保存 ${chosen.length} 个文件，当前可用报价 ${state.records.length} 条。刷新页面后仍可继续使用。`, state.records.length ? "good" : "error");
  } catch (error) {
    setUploadMessage(`已解析 ${chosen.length} 个文件，但本地保存失败：${error.message || "浏览器存储空间可能不足"}`, "error");
  }
  els.fileInput.value = "";
}

function renderFiles() {
  if (!state.files.length) {
    els.fileList.innerHTML = '<div class="message is-muted">暂无报价文件。</div>';
    return;
  }
  els.fileList.innerHTML = "";
  state.files.forEach((file) => {
    const row = document.createElement("div");
    const warehouseCount = new Set(file.recordsList.map((record) => record.warehouse_code).filter(Boolean)).size;
    const meta = `${text(file.company, "未识别货代")} · ${file.recordsList.length} 条 · ${warehouseCount} 个仓库 · ${Math.round((file.size || 0) / 1024)} KB${file.error ? ` · ${file.error}` : ""}`;
    row.className = `file-row${file.disabled ? " is-disabled" : ""}`;
    row.innerHTML = `
      <div class="file-title">
        <strong>${escapeHtml(text(file.name))}</strong>
        <span>${escapeHtml(meta)}</span>
      </div>
      <div class="file-actions">
        <button class="ghost-action" data-action="toggle" data-id="${file.id}">${file.disabled ? "启用" : "暂停"}</button>
        <button class="ghost-action danger-action" data-action="delete" data-id="${file.id}">删除</button>
      </div>
    `;
    els.fileList.append(row);
  });
}

async function changeFile(action, id) {
  const index = state.files.findIndex((file) => file.id === id);
  if (index < 0) return;
  if (action === "delete") state.files.splice(index, 1);
  if (action === "toggle") state.files[index].disabled = !state.files[index].disabled;
  updateStats();
  renderFiles();
  try {
    await saveLocalStore();
    setUploadMessage("本地报价库已更新。", "good");
  } catch (error) {
    setUploadMessage(`本地报价库保存失败：${error.message || "浏览器存储空间可能不足"}`, "error");
  }
}

async function clearLocalQuotes() {
  if (state.files.length && !window.confirm("确认清空当前页面里的报价数据？这也会删除刷新后可恢复的本地记录和报价文件新增的仓库。")) return;
  state.files = [];
  state.records = [];
  state.localWarehouses = [];
  try {
    await clearLocalStore();
  } catch {
    // Clearing the in-memory list is still useful even if persistent cleanup fails.
  }
  updateStats();
  renderFiles();
  renderResults([], state.lastCode || "");
  els.resultTitle.textContent = "等待查询";
  setUploadMessage("已清空本地报价。", "muted");
}

function bindEvents() {
  els.searchBtn.addEventListener("click", searchQuotes);
  els.copyBestBtn?.addEventListener("click", copyBestQuote);
  els.exportBtn.addEventListener("click", downloadCsv);
  els.exportLibraryBtn?.addEventListener("click", exportLibrary);
  els.importLibraryInput?.addEventListener("change", () => importLibrary(els.importLibraryInput.files?.[0]));
  els.clearBtn.addEventListener("click", () => {
    els.warehouseCode.value = "";
    els.weightKg.value = "";
    els.companyFilter.value = "";
    if (els.priceMax) els.priceMax.value = "";
    if (els.transitMax) els.transitMax.value = "";
    if (els.taxFilter) els.taxFilter.value = "";
    if (els.unitFilter) els.unitFilter.value = "";
    if (els.viewMode) els.viewMode.value = "price";
    if (els.uniqueCompany) els.uniqueCompany.checked = false;
    state.lastCode = "";
    els.resultTitle.textContent = "等待查询";
    els.exportBtn.disabled = true;
    els.summaryStrip.hidden = true;
    els.tableWrap.hidden = true;
    els.cardDeck.innerHTML = "";
    els.resultRows.innerHTML = "";
    setMessage("已清空条件。输入仓库代码后可重新比价。", "muted");
    els.warehouseCode.focus();
  });
  [els.warehouseCode, els.weightKg, els.companyFilter].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchQuotes();
    });
  });
  els.warehouseCode.addEventListener("input", () => {
    els.warehouseCode.value = els.warehouseCode.value.toUpperCase();
  });
  [els.priceMax, els.transitMax, els.taxFilter, els.unitFilter, els.viewMode, els.uniqueCompany].forEach((control) => {
    control?.addEventListener("change", () => {
      if (state.lastCode && state.records.length) searchQuotes();
    });
  });
  els.manageToggle.addEventListener("click", () => {
    const willShow = els.managePanel.hidden;
    els.managePanel.hidden = !willShow;
    if (willShow) {
      renderFiles();
      els.managePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  els.fileInput.addEventListener("change", () => uploadFiles(els.fileInput.files));
  els.rebuildBtn.addEventListener("click", clearLocalQuotes);
  ["dragenter", "dragover"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    els.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-over");
    });
  });
  els.dropZone.addEventListener("drop", (event) => uploadFiles(event.dataTransfer.files));
  els.fileList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    changeFile(button.dataset.action, button.dataset.id);
  });
}

async function init() {
  bindEvents();
  try {
    const restored = await loadLocalStore();
    updateStats();
    renderFiles();
    if (restored) {
      setUploadMessage(`已从本地恢复 ${state.files.length} 个报价文件，当前可用报价 ${state.records.length} 条。`, "good");
      setMessage("已恢复上次保存的本地报价，可直接输入仓库代码查价。", "good");
      return;
    }
  } catch (error) {
    setUploadMessage(`未能读取本地报价库：${error.message || "浏览器可能限制了本地存储"}`, "error");
  }
  updateStats();
  renderFiles();
}

init();















