import * as XLSX from 'xlsx';
import type { AdRecord } from '@/types';
import { nanoid } from 'nanoid';

function normalizeHeaderKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[()（）【】[\]{}%#'".,:;，；：、/\\-]+/g, "");
}

function normalizeCurrencyCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  const upper = s.toUpperCase();
  if (upper === "JPY" || s.includes("円") || s.includes("￥")) return "JPY";
  if (upper === "USD") return "USD";
  if (upper === "CNY" || upper === "RMB") return "CNY";
  if (upper === "EUR") return "EUR";
  if (upper === "GBP") return "GBP";
  if (upper === "CAD") return "CAD";
  if (upper === "AUD") return "AUD";
  if (upper === "MXN") return "MXN";
  if (upper === "BRL") return "BRL";
  if (/^[A-Z]{3}$/.test(upper)) return upper;

  return null;
}

function detectCurrencyFromRow(row: Record<string, unknown>): string | null {
  const candidates = [
    row["货币"],
    row["通貨"],
    row["通貨コード"],
    row["Currency"],
    row["currency"],
    row["貨幣"],
    row["币种"],
  ];

  for (const v of candidates) {
    const c = normalizeCurrencyCode(v);
    if (c) return c;
  }

  for (const [k, v] of Object.entries(row)) {
    const key = k.trim();
    if (!key) continue;
    if (key.includes("货币") || key.includes("幣") || key.includes("通貨") || /currency/i.test(key)) {
      const c = normalizeCurrencyCode(v);
      if (c) return c;
    }
  }
  return null;
}

function normalizeDate(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return dt.toISOString().slice(0, 10);
    }
  }

  const s = String(value).trim();
  if (!s) return "";
  const m = s.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mm - 1, d));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return s;
}

type ColumnSpec = {
  aliases: string[];
  regexes?: RegExp[];
};

function buildHeaderLookup(rows: Array<Record<string, unknown>>) {
  const keys = new Set<string>();
  for (let i = 0; i < Math.min(30, rows.length); i += 1) {
    for (const k of Object.keys(rows[i] ?? {})) keys.add(k);
  }
  const originalKeys = Array.from(keys);
  const normalizedToOriginal = new Map<string, string>();
  for (const k of originalKeys) normalizedToOriginal.set(normalizeHeaderKey(k), k);
  return { originalKeys, normalizedToOriginal };
}

export const parseExcel = async (
  file: File
): Promise<{ records: AdRecord[]; currency: string | null }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName =
          workbook.SheetNames.find((name) =>
            /搜索词|search\s*term|customer\s*search|検索語句|suchbegriff|terme\s*de\s*recherche/i.test(name)
          ) ?? workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
        const detectedCurrency = rawData.reduce<string | null>((acc, row) => acc ?? detectCurrencyFromRow(row), null);

        const { originalKeys, normalizedToOriginal } = buildHeaderLookup(rawData);
        const cache = new Map<string, string | null>();

        const resolveColumn = (name: string, spec: ColumnSpec) => {
          const cached = cache.get(name);
          if (cached !== undefined) return cached;

          for (const alias of spec.aliases) {
            const hit = normalizedToOriginal.get(normalizeHeaderKey(alias));
            if (hit) {
              cache.set(name, hit);
              return hit;
            }
          }

          const aliasNorm = spec.aliases.map(normalizeHeaderKey);
          for (const key of originalKeys) {
            const kNorm = normalizeHeaderKey(key);
            if (aliasNorm.some((a) => kNorm.includes(a) || a.includes(kNorm))) {
              cache.set(name, key);
              return key;
            }
          }

          if (spec.regexes?.length) {
            for (const key of originalKeys) {
              if (spec.regexes.some((re) => re.test(key))) {
                cache.set(name, key);
                return key;
              }
            }
          }

          cache.set(name, null);
          return null;
        };

        const columns: Record<string, ColumnSpec> = {
          date: {
            aliases: ["开始日期", "Start Date", "開始日", "Date", "Datum", "Fecha de inicio"],
            regexes: [/start\s*date/i, /开始日期/, /開始日/],
          },
          searchTerm: {
            aliases: ["客户搜索词", "Customer Search Term", "Customer search term", "検索語句", "Suchbegriff", "Terme de recherche client"],
            regexes: [/customer\s*search\s*term/i, /搜索词/, /検索語句/],
          },
          campaignName: {
            aliases: ["广告活动名称", "Campaign Name", "キャンペーン名", "Nom de la campagne", "Nombre de campaña"],
            regexes: [/campaign/i, /广告活动/],
          },
          adGroupName: {
            aliases: ["广告组名称", "Ad Group Name", "広告グループ名", "Nom du groupe d'annonces", "Grupo de anuncios"],
            regexes: [/ad\s*group/i, /广告组/],
          },
          matchType: {
            aliases: ["匹配类型", "Match Type", "マッチタイプ", "Type de correspondance", "Tipo de concordancia"],
            regexes: [/match\s*type/i, /匹配类型/],
          },
          impressions: {
            aliases: ["展示量", "Impressions", "表示回数", "Impressionen", "Impresiones"],
            regexes: [/impressions?/i, /展示量/, /表示回数/],
          },
          clicks: {
            aliases: ["点击量", "Clicks", "クリック数", "Klicks", "Clics"],
            regexes: [/clicks?/i, /点击量/, /クリック/],
          },
          spend: {
            aliases: ["花费", "Spend", "Cost", "Kosten", "Importe gastado", "支出"],
            regexes: [/spend/i, /cost/i, /花费/, /支出/],
          },
          sales: {
            aliases: ["7天总销售额", "7 Day Total Sales", "7-day total sales", "14 Day Total Sales", "14-day total sales", "7日間の総売上", "総売上"],
            regexes: [/\b\d+\s*day.*total.*sales/i, /\d+\s*天.*销售额/i, /sales/i, /売上/],
          },
          orders: {
            aliases: ["7天总订单数(#)", "7 Day Total Orders (#)", "7-day total orders", "14 Day Total Orders (#)", "14-day total orders", "7日間の総注文数", "総注文数"],
            regexes: [/\b\d+\s*day.*total.*orders/i, /\d+\s*天.*订单数/i, /orders?/i, /注文数/],
          },
        };

        const colKey = {
          date: resolveColumn("date", columns.date),
          searchTerm: resolveColumn("searchTerm", columns.searchTerm),
          campaignName: resolveColumn("campaignName", columns.campaignName),
          adGroupName: resolveColumn("adGroupName", columns.adGroupName),
          matchType: resolveColumn("matchType", columns.matchType),
          impressions: resolveColumn("impressions", columns.impressions),
          clicks: resolveColumn("clicks", columns.clicks),
          spend: resolveColumn("spend", columns.spend),
          sales: resolveColumn("sales", columns.sales),
          orders: resolveColumn("orders", columns.orders),
        };
        
        // Transform to clean internal model
        const cleanedData: AdRecord[] = rawData
          .map((row) => {
            // Safe number parsing helper
            const num = (val: unknown) => {
              if (typeof val === 'number') return val;
              if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
              return 0;
            };

            const impressions = num(colKey.impressions ? row[colKey.impressions] : 0);
            const clicks = num(colKey.clicks ? row[colKey.clicks] : 0);
            const spend = num(colKey.spend ? row[colKey.spend] : 0);
            const sales = num(colKey.sales ? row[colKey.sales] : 0);
            const orders = num(colKey.orders ? row[colKey.orders] : 0);
            
            // Skip invalid rows (e.g. summary rows or empty)
            const searchTermRaw = colKey.searchTerm ? row[colKey.searchTerm] : row["客户搜索词"];
            const campaignNameRaw = colKey.campaignName ? row[colKey.campaignName] : row["广告活动名称"];
            if (!searchTermRaw && !campaignNameRaw) return null;
            const searchTerm = String(searchTermRaw ?? "").trim();
            if (!searchTerm) return null;
            if (/^总计$|^合计$|total/i.test(searchTerm)) return null;

            const campaignName = String(campaignNameRaw ?? "Unknown").trim() || "Unknown";
            const adGroupName = String((colKey.adGroupName ? row[colKey.adGroupName] : row["广告组名称"]) ?? "Unknown").trim() || "Unknown";
            const matchType = String((colKey.matchType ? row[colKey.matchType] : row["匹配类型"]) ?? "Unknown").trim() || "Unknown";

            return {
              id: nanoid(),
              date: normalizeDate(colKey.date ? row[colKey.date] : row["开始日期"]),
              campaignName,
              adGroupName,
              matchType,
              searchTerm,
              impressions,
              clicks,
              spend,
              sales,
              orders,
              ctr: impressions > 0 ? clicks / impressions : 0,
              cpc: clicks > 0 ? spend / clicks : 0,
              acos: sales > 0 ? (spend / sales) * 100 : 0,
              roas: spend > 0 ? sales / spend : 0,
              conversionRate: clicks > 0 ? orders / clicks : 0,
            };
          })
          .filter((item): item is AdRecord => item !== null); // Remove nulls

        resolve({ records: cleanedData, currency: detectedCurrency });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
