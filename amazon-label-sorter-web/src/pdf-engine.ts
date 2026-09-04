import {
  PDFArray,
  PDFDocument,
  PDFFont,
  PDFName,
  PDFPage,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
  rgb,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { zipSync, strToU8 } from 'fflate';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type TemplateKind = 'FBA' | 'AWD' | '未知';

export interface SourcePdf {
  file: File;
  bytes: Uint8Array;
  pageCount: number;
}

export interface LabelPage {
  sourceIndex: number;
  sourceName: string;
  pageIndex: number;
  sku: string;
  warehouse: string;
  template: TemplateKind;
  companyPresent: boolean;
  madeInChinaPresent: boolean;
}

export interface ScanResult {
  sources: SourcePdf[];
  pages: LabelPage[];
  skipped: Array<{ sourceName: string; page: number; reason: string }>;
}

export interface GroupSummary {
  sku: string;
  pages: number;
  warehouses: string[];
  templates: TemplateKind[];
}

export interface GenerateOptions {
  removeCompany: boolean;
  addMadeInChina: boolean;
  onProgress?: (done: number, total: number, message: string) => void;
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function safeFilePart(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return (cleaned || '未命名SKU').slice(0, 120);
}

function findSku(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const inline = line.match(/Single\s+SKU\s*[:：]?\s*(\S.+)$/i);
    if (inline?.[1]) return clean(inline[1]);
    if (/^Single\s+SKU\s*[:：]?$/i.test(line)) {
      const next = lines.slice(i + 1).find((entry) => entry.length > 0);
      if (next) return clean(next);
    }
  }
  for (const line of lines) {
    const match = line.match(/^SKU\s*[:：]\s*(.+)$/i);
    if (match?.[1]) return clean(match[1]);
  }
  return undefined;
}

function findWarehouse(lines: string[], filename: string): string {
  const joined = lines.join(' ');
  const fba = joined.match(/FBA\s+STA\s*\([^)]*\)\s*-\s*([A-Z0-9]{3,8})/i);
  if (fba?.[1]) return fba[1].toUpperCase();

  const awdIndex = lines.findIndex((line) => /^AWD\s*:/i.test(line));
  if (awdIndex >= 0) {
    for (const candidate of lines.slice(awdIndex + 1, awdIndex + 7)) {
      if (/^[A-Z]{3,5}[0-9]{0,2}$/i.test(candidate)) return candidate.toUpperCase();
    }
  }

  const fromFile = filename.match(/(?:^|[\s_-])([A-Z]{3,5}[0-9]{1,2})(?:[\s_-]|$)/i);
  return fromFile?.[1]?.toUpperCase() ?? '未识别仓库';
}

function identifyTemplate(lines: string[]): TemplateKind {
  const joined = lines.join(' ');
  if (/Single\s+SKU|FBA\s+STA/i.test(joined)) return 'FBA';
  if (/SSCC\s*:|^AWD\s*:/im.test(lines.join('\n')) || lines.some((line) => /^SKU\s*:/i.test(line))) return 'AWD';
  return '未知';
}

export async function scanPdfs(files: File[], onProgress?: GenerateOptions['onProgress']): Promise<ScanResult> {
  const sources: SourcePdf[] = [];
  const pages: LabelPage[] = [];
  const skipped: ScanResult['skipped'] = [];
  let processed = 0;

  for (let sourceIndex = 0; sourceIndex < files.length; sourceIndex += 1) {
    const file = files[sourceIndex];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const task = pdfjsLib.getDocument({
      data: bytes.slice(),
      useSystemFonts: true,
      cMapUrl: `${assetBase}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
    });
    const doc = await task.promise;
    sources.push({ file, bytes, pageCount: doc.numPages });

    for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex += 1) {
      const page = await doc.getPage(pageIndex + 1);
      const content = await page.getTextContent();
      const lines = content.items
        .flatMap((item) => ('str' in item ? [clean(item.str)] : []))
        .filter(Boolean);
      const sku = findSku(lines);
      if (!sku) {
        skipped.push({ sourceName: file.name, page: pageIndex + 1, reason: '未识别到 SKU' });
      } else {
        pages.push({
          sourceIndex,
          sourceName: file.name,
          pageIndex,
          sku,
          warehouse: findWarehouse(lines, file.name),
          template: identifyTemplate(lines),
          companyPresent: lines.some((line) => /^(?:FBA|AWD)\s*[:：]\s*\S+/i.test(line)),
          madeInChinaPresent: lines.some((line) => /Made\s+in\s+China/i.test(line)),
        });
      }
      processed += 1;
      onProgress?.(processed, processed + 1, `正在识别：${file.name} · 第 ${pageIndex + 1} 页`);
      page.cleanup();
    }
    await doc.destroy();
  }
  onProgress?.(processed, processed, `识别完成：${pages.length} 张有效标签`);
  return { sources, pages, skipped };
}

export function summarizeGroups(pages: LabelPage[]): GroupSummary[] {
  const groups = new Map<string, LabelPage[]>();
  for (const page of pages) {
    const group = groups.get(page.sku) ?? [];
    group.push(page);
    groups.set(page.sku, group);
  }
  return [...groups].map(([sku, group]) => ({
    sku,
    pages: group.length,
    warehouses: [...new Set(group.map((page) => page.warehouse))],
    templates: [...new Set(group.map((page) => page.template))],
  }));
}

function bytesToBinary(bytes: Uint8Array): string {
  let result = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    result += String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length)));
  }
  return result;
}

function binaryToBytes(value: string): Uint8Array {
  const result = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) result[i] = value.charCodeAt(i) & 0xff;
  return result;
}

function removeCompanyOperators(decoded: Uint8Array): { bytes: Uint8Array; changed: boolean } {
  const original = bytesToBinary(decoded);
  let changed = false;
  let updated = original.replace(/\((FBA|AWD):\s(?:\\.|[^\\)])*\)\s*Tj/g, (_all, prefix: string) => {
    changed = true;
    return `(${prefix}:)Tj`;
  });

  const awdPrefix = '\x00\xbc\x00\xd2\x00\xbf\x00\x05';
  const awdWithCompany = new RegExp(`\\(${awdPrefix}\\x00\\x03(?:\\\\.|[^\\\\)])*\\)\\s*Tj`, 'g');
  updated = updated.replace(awdWithCompany, () => {
    changed = true;
    return `(${awdPrefix})Tj`;
  });
  return { bytes: changed ? binaryToBytes(updated) : decoded, changed };
}

function removeCompanyFromPage(doc: PDFDocument, page: PDFPage): boolean {
  const contents = page.node.Contents();
  if (!contents) return false;
  let changed = false;

  const replaceStream = (stream: PDFRawStream): ReturnType<PDFDocument['context']['register']> | undefined => {
    const decoded = decodePDFRawStream(stream).decode();
    const replacement = removeCompanyOperators(decoded);
    if (!replacement.changed) return undefined;
    changed = true;
    return doc.context.register(doc.context.flateStream(replacement.bytes));
  };

  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const stream = contents.lookupMaybe(i, PDFRawStream);
      if (!stream) continue;
      const replacement = replaceStream(stream);
      if (replacement) contents.set(i, replacement);
    }
  } else if (contents instanceof PDFRawStream) {
    const replacement = replaceStream(contents);
    if (replacement) page.node.set(PDFName.of('Contents'), replacement);
  }
  return changed;
}

function addMadeInChina(page: PDFPage, font: PDFFont, template: TemplateKind): void {
  const { width, height } = page.getSize();
  const sx = width / 595.72;
  const sy = height / 841.89;
  const text = 'Made in China';
  const size = 9 * Math.min(sx, sy);
  const textWidth = font.widthOfTextAtSize(text, size);
  const areaLeft = (template === 'AWD' ? 170 : 60) * sx;
  const areaWidth = (template === 'AWD' ? 120 : 107) * sx;
  const yFromTop = (template === 'AWD' ? 260 : 226.56) * sy;
  page.drawText(text, {
    x: areaLeft + Math.max(0, (areaWidth - textWidth) / 2),
    y: height - yFromTop,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(pages: LabelPage[]): string {
  const rows = [['SKU', '仓库', '模板', '来源文件', '原页码']];
  for (const page of pages) {
    rows.push([page.sku, page.warehouse, page.template, page.sourceName, String(page.pageIndex + 1)]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export async function generateZip(scan: ScanResult, options: GenerateOptions): Promise<Uint8Array> {
  const sourceDocs = await Promise.all(scan.sources.map((source) => PDFDocument.load(source.bytes.slice())));
  const groups = new Map<string, LabelPage[]>();
  for (const page of scan.pages) {
    const group = groups.get(page.sku) ?? [];
    group.push(page);
    groups.set(page.sku, group);
  }
  const zipFiles: Record<string, Uint8Array> = {};
  let done = 0;

  for (const [sku, pages] of groups) {
    const out = await PDFDocument.create();
    const font = options.addMadeInChina ? await out.embedFont(StandardFonts.HelveticaBold) : undefined;
    out.setTitle(`Amazon 标签归集 - ${sku}`);
    out.setSubject('按 SKU 跨仓库归集');
    out.setCreator('Amazon 箱唛按 SKU 归集工具 Web v1.0.0');

    for (const label of pages) {
      const sourceDoc = sourceDocs[label.sourceIndex];
      if (options.removeCompany && label.companyPresent) {
        const changed = removeCompanyFromPage(sourceDoc, sourceDoc.getPage(label.pageIndex));
        if (!changed) {
          throw new Error(`${label.sourceName} 第 ${label.pageIndex + 1} 页的公司名使用了暂不支持的编码。为避免只遮盖但仍可复制，已停止生成。`);
        }
      }
      const [copied] = await out.copyPages(sourceDoc, [label.pageIndex]);
      out.addPage(copied);
      if (options.addMadeInChina && !label.madeInChinaPresent && font) addMadeInChina(copied, font, label.template);
      done += 1;
      options.onProgress?.(done, scan.pages.length, `正在生成：${sku} · ${done}/${scan.pages.length}`);
    }
    zipFiles[`${safeFilePart(sku)}_${pages.length}张.pdf`] = await out.save();
  }

  zipFiles['分组明细.csv'] = strToU8(buildCsv(scan.pages));
  zipFiles['使用说明.txt'] = strToU8(
    'Amazon 箱唛按 SKU 归集工具 Web v1.0.0\r\n' +
      '文件均在您的浏览器本地处理，不会上传服务器。\r\n' +
      `本次共处理 ${scan.sources.length} 个源文件、${scan.pages.length} 张标签、${groups.size} 个 SKU。\r\n`,
  );
  return zipSync(zipFiles, { level: 6 });
}
