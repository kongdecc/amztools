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
  type PageBoundingBox,
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { zipSync, strToU8 } from 'fflate';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type TemplateKind = 'FBA' | 'AWD' | '未知';
const MIXED_SKUS_GROUP = 'Mixed SKUs';

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
  fbaCodeBox?: { y: number; height: number };
  detailBaselineY?: number;
  shipFrom?: { x: number; y: number; headingWidth: number; bottomY: number };
  shipFromCompany?: { x: number; y: number };
  contentBox?: PageBoundingBox;
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
  preserveSourceFiles: boolean;
  removeCompany: boolean;
  reduceShipFrom: boolean;
  addMadeInChina: boolean;
  cropForThermal: boolean;
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
  const joined = clean(lines.join(' '));
  const compact = joined.replace(/[\s\-‐‑‒–—_:：/]+/g, '');
  if (/Mixed\s*[\-‐‑‒–—_:：/]?\s*SKUs?\b/i.test(joined) || /MixedSKUs?/i.test(compact)) {
    return MIXED_SKUS_GROUP;
  }

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

async function detectContentBox(page: pdfjsLib.PDFPageProxy): Promise<PageBoundingBox | undefined> {
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  await page.render({ canvas, canvasContext: context, viewport, background: 'white' }).promise;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      if (Math.min(data[i], data[i + 1], data[i + 2]) > 225) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  canvas.width = canvas.height = 0;
  if (right < left || bottom < top) return undefined;
  const [viewLeft, viewBottom, viewRight, viewTop] = page.view;
  const margin = 5;
  return {
    left: Math.max(viewLeft, viewLeft + left - margin),
    bottom: Math.max(viewBottom, viewTop - bottom - margin),
    right: Math.min(viewRight, viewLeft + right + margin),
    top: Math.min(viewTop, viewTop - top + margin),
  };
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
      const textItems = content.items.flatMap((item) => {
        if (!('str' in item)) return [];
        const text = clean(item.str);
        if (!text) return [];
        return [{ text, transform: item.transform, width: item.width, height: item.height }];
      });
      const lines = textItems.map((item) => item.text);
      const sku = findSku(lines);
      if (!sku) {
        skipped.push({ sourceName: file.name, page: pageIndex + 1, reason: '未识别到 SKU' });
      } else {
        const fbaCode = textItems.find((item) => /^FBA[A-Z0-9]{8,}$/i.test(item.text));
        const detailLabel = textItems.find((item) => /^(?:Mixed\s*SKUs?|Single\s*SKU)$/i.test(item.text));
        const shipFromHeading = textItems.find((item) => /^(?:发货地|Ship\s+from)\s*[:：]?$/i.test(item.text));
        const shipFromCountry = shipFromHeading
          ? textItems.find((item) => /(?:中国|China)\s*$/i.test(item.text)
            && item.transform[4] >= shipFromHeading.transform[4] - 3
            && item.transform[4] <= shipFromHeading.transform[4] + 130
            && item.transform[5] < shipFromHeading.transform[5])
          : undefined;
        const shipFromCompany = shipFromHeading && shipFromCountry
          ? textItems
            .filter((item) => item.transform[4] >= shipFromHeading.transform[4] - 3
              && item.transform[4] <= shipFromHeading.transform[4] + 130
              && item.transform[5] < shipFromHeading.transform[5]
              && item.transform[5] >= shipFromCountry.transform[5])
            .sort((a, b) => b.transform[5] - a.transform[5])
            .find((item) => /\b(?:company|co\.?|ltd\.?|llc|inc\.?)\b|youxiangongsi|有限公司/i.test(item.text))
          : undefined;
        const prefixedCompanyPresent = lines.some((line) => /^(?:FBA|AWD)\s*[:：]\s*\S+/i.test(line));
        pages.push({
          sourceIndex,
          sourceName: file.name,
          pageIndex,
          sku,
          warehouse: findWarehouse(lines, file.name),
          template: identifyTemplate(lines),
          companyPresent: prefixedCompanyPresent || Boolean(shipFromCompany),
          madeInChinaPresent: lines.some((line) => /Made\s+in\s+China/i.test(line)),
          fbaCodeBox: fbaCode ? { y: fbaCode.transform[5], height: fbaCode.height } : undefined,
          detailBaselineY: detailLabel?.transform[5],
          shipFrom: shipFromHeading && shipFromCountry ? {
            x: shipFromHeading.transform[4],
            y: shipFromHeading.transform[5],
            headingWidth: shipFromHeading.width,
            bottomY: shipFromCountry.transform[5],
          } : undefined,
          shipFromCompany: shipFromCompany ? { x: shipFromCompany.transform[4], y: shipFromCompany.transform[5] } : undefined,
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

async function locateCropBoxes(scan: ScanResult, onProgress?: GenerateOptions['onProgress']): Promise<void> {
  let done = 0;
  for (let sourceIndex = 0; sourceIndex < scan.sources.length; sourceIndex += 1) {
    const labels = scan.pages.filter((label) => label.sourceIndex === sourceIndex);
    if (labels.length === 0) continue;
    const source = scan.sources[sourceIndex];
    const assetBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const task = pdfjsLib.getDocument({
      data: source.bytes.slice(),
      useSystemFonts: true,
      cMapUrl: `${assetBase}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${assetBase}standard_fonts/`,
    });
    const doc = await task.promise;
    for (const label of labels) {
      if (!label.contentBox) {
        const page = await doc.getPage(label.pageIndex + 1);
        label.contentBox = await detectContentBox(page);
        page.cleanup();
      }
      done += 1;
      onProgress?.(done, scan.pages.length, `正在定位裁剪区域：${source.file.name} · 第 ${label.pageIndex + 1} 页`);
    }
    await doc.destroy();
  }
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

function getTextMatrices(block: string): RegExpMatchArray[] {
  return [...block.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/g)];
}

function getTextShowOperators(block: string): RegExpMatchArray[] {
  return [...block.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[[\s\S]*?\]\s*TJ/g)];
}

function matrixMatchesAnchor(match: RegExpMatchArray, anchor: { x: number; y: number }): boolean {
  return Math.abs(Number(match[5]) - anchor.x) < 0.6 && Math.abs(Number(match[6]) - anchor.y) < 0.6;
}

function removeCompanyOperators(
  decoded: Uint8Array,
  shipFromCompany?: NonNullable<LabelPage['shipFromCompany']>,
): { bytes: Uint8Array; changed: boolean } {
  const original = bytesToBinary(decoded);
  let changed = false;
  let updated = original.replace(/\((FBA|AWD):\s(?:\\.|[^\\)])*\)\s*Tj/g, (_all, prefix: string) => {
    changed = true;
    return `(${prefix}:)Tj`;
  });

  updated = updated.replace(/\[\s*\((FBA|AWD):\s(?:\\.|[^\\)])*\)\s*\]\s*TJ/g, (_all, prefix: string) => {
    changed = true;
    return `[(${prefix}:)] TJ`;
  });

  const awdPrefix = '\x00\xbc\x00\xd2\x00\xbf\x00\x05';
  const awdWithCompany = new RegExp(`\\(${awdPrefix}\\x00\\x03(?:\\\\.|[^\\\\)])*\\)\\s*Tj`, 'g');
  updated = updated.replace(awdWithCompany, () => {
    changed = true;
    return `(${awdPrefix})Tj`;
  });

  if (shipFromCompany) {
    updated = updated.replace(/BT[\s\S]*?\bET/g, (block) => {
      const companyMatrix = getTextMatrices(block).find((match) => matrixMatchesAnchor(match, shipFromCompany));
      if (!companyMatrix || companyMatrix.index === undefined) return block;
      changed = true;
      return `${block.slice(0, companyMatrix.index).trimEnd()}\nET`;
    });
  }
  return { bytes: changed ? binaryToBytes(updated) : decoded, changed };
}

function removeCompanyFromPage(
  doc: PDFDocument,
  page: PDFPage,
  shipFromCompany?: NonNullable<LabelPage['shipFromCompany']>,
): boolean {
  const contents = page.node.Contents();
  if (!contents) return false;
  let changed = false;

  const replaceStream = (stream: PDFRawStream): ReturnType<PDFDocument['context']['register']> | undefined => {
    const decoded = decodePDFRawStream(stream).decode();
    const replacement = removeCompanyOperators(decoded, shipFromCompany);
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

function reduceShipFromOperators(
  decoded: Uint8Array,
  anchor: NonNullable<LabelPage['shipFrom']>,
): { bytes: Uint8Array; changed: boolean } {
  const original = bytesToBinary(decoded);
  const blocks = [...original.matchAll(/BT[\s\S]*?\bET/g)];
  const inShipFromRegion = (match: RegExpMatchArray): boolean => {
    const x = Number(match[5]);
    const y = Number(match[6]);
    return x >= anchor.x - 3 && x <= anchor.x + 135 && y >= anchor.bottomY - 2 && y <= anchor.y + 2;
  };
  const headingBlock = blocks.find((match) => getTextMatrices(match[0]).some((matrix) => matrixMatchesAnchor(matrix, anchor)));
  const countryBlock = [...blocks].reverse().find((match) => (
    getTextMatrices(match[0]).some((matrix) => inShipFromRegion(matrix) && Math.abs(Number(matrix[6]) - anchor.bottomY) < 0.6)
    && getTextShowOperators(match[0]).length > 0
  ));
  if (!headingBlock || !countryBlock) return { bytes: decoded, changed: false };

  const headingMatrix = getTextMatrices(headingBlock[0]).find((match) => matrixMatchesAnchor(match, anchor));
  const headingOperator = getTextShowOperators(headingBlock[0])[0];
  const countryOperators = getTextShowOperators(countryBlock[0]);
  const countryOperator = countryOperators[countryOperators.length - 1];
  if (!headingMatrix || headingOperator.index === undefined || !countryOperator) return { bytes: decoded, changed: false };

  const countryFont = [...countryBlock[0].matchAll(/\/[^\s]+\s+\d+(?:\.\d+)?\s+Tf/g)].at(-1)?.[0];
  const countryX = anchor.x + anchor.headingWidth;
  const replacement = [
    headingBlock[0].slice(0, headingOperator.index + headingOperator[0].length),
    countryFont,
    '0 Tc',
    '0 0 0 rg',
    `${headingMatrix[1]} ${headingMatrix[2]} ${headingMatrix[3]} ${headingMatrix[4]} ${countryX.toFixed(2)} ${anchor.y.toFixed(2)} Tm`,
    countryOperator[0],
    '0 g',
    'ET',
  ].filter(Boolean).join('\n');

  let cursor = 0;
  let updated = '';
  for (const block of blocks) {
    if (block.index === undefined) continue;
    updated += original.slice(cursor, block.index);
    const touchesShipFrom = getTextMatrices(block[0]).some(inShipFromRegion);
    if (block.index === headingBlock.index) updated += replacement;
    else if (!touchesShipFrom) updated += block[0];
    cursor = block.index + block[0].length;
  }
  updated += original.slice(cursor);
  return { bytes: binaryToBytes(updated), changed: true };
}

function reduceShipFromOnPage(doc: PDFDocument, page: PDFPage, anchor: NonNullable<LabelPage['shipFrom']>): boolean {
  const contents = page.node.Contents();
  if (!contents) return false;
  let changed = false;
  const replaceStream = (stream: PDFRawStream): ReturnType<PDFDocument['context']['register']> | undefined => {
    const decoded = decodePDFRawStream(stream).decode();
    const replacement = reduceShipFromOperators(decoded, anchor);
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

function addMadeInChina(page: PDFPage, font: PDFFont, label: LabelPage): void {
  const { width, height } = page.getSize();
  const sx = width / 595.72;
  const sy = height / 841.89;
  const text = 'Made in China';
  const size = 9 * Math.min(sx, sy);
  const textWidth = font.widthOfTextAtSize(text, size);
  const areaLeft = (label.template === 'AWD' ? 170 : 60) * sx;
  const areaWidth = (label.template === 'AWD' ? 120 : 107) * sx;
  const yFromTop = (label.template === 'AWD' ? 260 : 226.56) * sy;
  let y = height - yFromTop;

  if (label.template === 'FBA') {
    // The barcode and its ID move between FBA templates; the SKU detail row is
    // the reliable blank-left area, including labels with a notice above.
    y = label.detailBaselineY ?? (label.fbaCodeBox ? label.fbaCodeBox.y - 17 * sy : y);
  }
  page.drawText(text, {
    x: areaLeft + Math.max(0, (areaWidth - textWidth) / 2),
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

async function addThermalPage(out: PDFDocument, sourcePage: PDFPage, label: LabelPage): Promise<void> {
  if (label.template === '未知') throw new Error(`${label.sourceName} 第 ${label.pageIndex + 1} 页的模板类型未知，无法确定热敏纸尺寸。`);
  if (!label.contentBox) throw new Error(`${label.sourceName} 第 ${label.pageIndex + 1} 页未找到可裁剪的标签内容。`);
  const box = label.contentBox;
  const boxWidth = box.right - box.left;
  const boxHeight = box.top - box.bottom;
  if (boxWidth <= 0 || boxHeight <= 0) throw new Error(`${label.sourceName} 第 ${label.pageIndex + 1} 页的裁剪区域无效。`);
  const pointsPerMm = 72 / 25.4;
  const pageWidth = 100 * pointsPerMm;
  const pageHeight = (label.template === 'FBA' ? 100 : 150) * pointsPerMm;
  const padding = 3 * pointsPerMm;
  const scale = Math.min((pageWidth - padding * 2) / boxWidth, (pageHeight - padding * 2) / boxHeight);
  const [embedded] = await out.embedPages([sourcePage], [box]);
  const thermalPage = out.addPage([pageWidth, pageHeight]);
  thermalPage.drawPage(embedded, {
    x: (pageWidth - boxWidth * scale) / 2,
    y: (pageHeight - boxHeight * scale) / 2,
    width: boxWidth * scale,
    height: boxHeight * scale,
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
  if (options.preserveSourceFiles && options.cropForThermal && scan.skipped.length > 0) {
    const first = scan.skipped[0];
    throw new Error(`${first.sourceName} 第 ${first.page} 页未识别，无法在保持源文件完整的同时裁剪为热敏纸尺寸。`);
  }
  if (options.cropForThermal) await locateCropBoxes(scan, options.onProgress);
  const sourceDocs = await Promise.all(scan.sources.map((source) => PDFDocument.load(source.bytes.slice())));
  const groups = new Map<string, LabelPage[]>();
  for (const page of scan.pages) {
    const group = groups.get(page.sku) ?? [];
    group.push(page);
    groups.set(page.sku, group);
  }
  const zipFiles: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  const uniquePdfName = (value: string): string => {
    const base = safeFilePart(value.replace(/\.pdf$/i, ''));
    let candidate = `${base}.pdf`;
    let suffix = 2;
    while (usedNames.has(candidate.toLowerCase())) candidate = `${base}_${suffix++}.pdf`;
    usedNames.add(candidate.toLowerCase());
    return candidate;
  };
  const units = options.preserveSourceFiles
    ? scan.sources.map((source, sourceIndex) => {
      const labels = new Map(scan.pages
        .filter((page) => page.sourceIndex === sourceIndex)
        .map((page) => [page.pageIndex, page]));
      return {
        fileName: uniquePdfName(source.file.name),
        title: `Amazon 标签处理 - ${source.file.name}`,
        subject: '保持源文件页序处理',
        progressName: source.file.name,
        pages: Array.from({ length: source.pageCount }, (_, pageIndex) => ({ sourceIndex, pageIndex, label: labels.get(pageIndex) })),
      };
    })
    : [...groups].map(([sku, pages]) => ({
      fileName: `${safeFilePart(sku)}_${pages.length}张.pdf`,
      title: `Amazon 标签归集 - ${sku}`,
      subject: '按 SKU 或混装类型跨仓库归集',
      progressName: sku,
      pages: pages.map((label) => ({ sourceIndex: label.sourceIndex, pageIndex: label.pageIndex, label })),
    }));
  const totalPages = units.reduce((sum, unit) => sum + unit.pages.length, 0);
  let done = 0;

  for (const unit of units) {
    const out = await PDFDocument.create();
    const font = options.addMadeInChina ? await out.embedFont(StandardFonts.HelveticaBold) : undefined;
    out.setTitle(unit.title);
    out.setSubject(unit.subject);
    out.setCreator('Amazon 箱唛按 SKU 归集工具 Web v1.4.0');

    for (const item of unit.pages) {
      const sourceDoc = sourceDocs[item.sourceIndex];
      const label = item.label;
      if (label && options.removeCompany && label.companyPresent) {
        const changed = removeCompanyFromPage(sourceDoc, sourceDoc.getPage(item.pageIndex), label.shipFromCompany);
        if (!changed) {
          throw new Error(`${label.sourceName} 第 ${item.pageIndex + 1} 页的公司名使用了暂不支持的编码。为避免只遮盖但仍可复制，已停止生成。`);
        }
      }
      if (label && options.reduceShipFrom) {
        if (!label.shipFrom) {
          throw new Error(`${label.sourceName} 第 ${item.pageIndex + 1} 页未识别到包含“中国”的发货地址，无法安全精简。`);
        }
        const changed = reduceShipFromOnPage(sourceDoc, sourceDoc.getPage(item.pageIndex), label.shipFrom);
        if (!changed) {
          throw new Error(`${label.sourceName} 第 ${item.pageIndex + 1} 页的发货地址使用了暂不支持的编码，已停止生成。`);
        }
      }
      const [copied] = await out.copyPages(sourceDoc, [item.pageIndex]);
      if (label && options.addMadeInChina && !label.madeInChinaPresent && font) addMadeInChina(copied, font, label);
      if (label && options.cropForThermal) await addThermalPage(out, copied, label);
      else out.addPage(copied);
      done += 1;
      options.onProgress?.(done, totalPages, `正在生成：${unit.progressName} · ${done}/${totalPages}`);
    }
    zipFiles[unit.fileName] = await out.save();
  }

  zipFiles['分组明细.csv'] = strToU8(buildCsv(scan.pages));
  zipFiles['使用说明.txt'] = strToU8(
    'Amazon 箱唛按 SKU 归集工具 Web v1.4.0\r\n' +
      '文件均在您的浏览器本地处理，不会上传服务器。\r\n' +
      `输出模式：${options.preserveSourceFiles ? '保持源文件，不归集' : '按 SKU 归集'}。\r\n` +
      `本次共处理 ${scan.sources.length} 个源文件、${scan.pages.length} 张有效标签、${groups.size} 个 SKU 分组。\r\n`,
  );
  return zipSync(zipFiles, { level: 6 });
}
