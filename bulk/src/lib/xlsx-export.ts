import * as XLSX from "xlsx";
import templateUrl from "@/assets/AmazonAdvertisingBulksheetSellerTemplate.xlsx?url";
import { HEADERS, SHEETS, rowsToAoA, type SheetName } from "@/lib/bulk";

export type WorkbookSheets = Partial<Record<SheetName, Record<string, any>[]>>;

function writeRowsToWorksheet(
  wb: XLSX.WorkBook,
  sheetName: SheetName | string,
  headers: readonly string[],
  rows: Record<string, any>[]
) {
  const aoa = rowsToAoA(headers.length ? headers : [""], rows);
  let ws = wb.Sheets[sheetName] as XLSX.WorkSheet | undefined;

  if (ws) {
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
    const maxCol = Math.max(range.e.c, Math.max(0, (headers.length || 1) - 1));
    const maxRow = Math.max(range.e.r, 2000);

    for (let r = 1; r <= maxRow; r += 1) {
      for (let c = 0; c <= maxCol; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) delete ws[addr];
      }
    }

    XLSX.utils.sheet_add_aoa(ws, [aoa[0]], { origin: "A1" });
    if (aoa.length > 1) {
      XLSX.utils.sheet_add_aoa(ws, aoa.slice(1), { origin: "A2" });
    }
  } else {
    ws = XLSX.utils.aoa_to_sheet(aoa);
    wb.Sheets[sheetName] = ws;
    if (!wb.SheetNames.includes(sheetName)) wb.SheetNames.push(sheetName);
  }
}

async function loadTemplateWorkbook(): Promise<XLSX.WorkBook> {
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error("无法加载内置模板文件");
  const buf = await res.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

export async function buildWorkbookFromTemplate(sheets: WorkbookSheets) {
  const wb = await loadTemplateWorkbook();

  // 确保模板包含我们需要的sheet；如果某些缺失，也允许追加
  const allSheets: SheetName[] = [
    SHEETS.spCampaigns,
    SHEETS.sbCampaigns,
    SHEETS.sbMultiAdGroup,
    SHEETS.sdCampaigns,
    SHEETS.rasCampaigns,
    SHEETS.portfolios,
    SHEETS.config,
  ];

  for (const name of allSheets) {
    const headers = (HEADERS as any)[name] as readonly string[];
    const rows = (sheets as any)[name];

    // 只有当调用方传入rows时，才覆盖模板内容；否则保持模板原样（包括Config完整枚举）
    if (!rows) continue;

    writeRowsToWorksheet(wb, name, headers, rows);
  }

  return wb;
}

export function cloneWorkbook(wb: XLSX.WorkBook) {
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return XLSX.read(buf, { type: "array" });
}

function getHeaderPreview(ws: XLSX.WorkSheet, count = 3) {
  const values: string[] = [];
  for (let c = 0; c < count; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    values.push(String(ws[addr]?.v ?? "").trim());
  }
  return values;
}

function isBulkUploadSheet(sheetName: string, ws: XLSX.WorkSheet | undefined) {
  if (!ws) return false;
  if (sheetName === SHEETS.config) return true;
  if ((Object.values(SHEETS) as string[]).includes(sheetName)) return true;

  const header = getHeaderPreview(ws);
  const joined = header.join("|");
  return joined === "Product|Entity|Operation" || joined === "产品|实体层级|操作";
}

export function pruneWorkbookToUploadableSheets(wb: XLSX.WorkBook) {
  const keptSheetNames = wb.SheetNames.filter((sheetName) => isBulkUploadSheet(sheetName, wb.Sheets[sheetName]));
  const keptSheets = Object.fromEntries(keptSheetNames.map((sheetName) => [sheetName, wb.Sheets[sheetName]]));
  wb.SheetNames = keptSheetNames;
  wb.Sheets = keptSheets;
  return wb;
}

export function replaceWorkbookSheetRows(
  wb: XLSX.WorkBook,
  sheetName: SheetName | string,
  headers: readonly string[],
  rows: Record<string, any>[]
) {
  writeRowsToWorksheet(wb, sheetName, headers, rows);
  return wb;
}

export async function readWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

export function readSheetRows(wb: XLSX.WorkBook, sheetName: SheetName | string) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
    defval: "",
    raw: false,
  });
}

export function readSheetAoA(wb: XLSX.WorkBook, sheetName: SheetName | string) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
