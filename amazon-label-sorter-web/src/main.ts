import './styles.css';
import { generateZip, scanPdfs, summarizeGroups, type ScanResult } from './pdf-engine';

const VERSION = 'Web v1.0.0';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="site-header-container">
    <header class="tb-header">
      <div class="tb-logo-area"><span class="tb-logo-icon">▦</span><span>跨境工具魔方 AmzToolBox</span></div>
      <nav class="tb-nav-desktop"><a href="/" class="tb-nav-link">首页</a><a href="/functionality" class="tb-nav-link">功能分类</a><a href="/about" class="tb-nav-link">关于</a><a href="/blog" class="tb-nav-link">博客</a><a href="/suggest" class="tb-nav-link">提需求</a><a href="/reward" class="tb-nav-link">打赏支持</a></nav>
    </header>
  </div>
  <div id="page-top-ad-anchor"></div>
  <header class="hero">
    <nav class="nav wrap"><div class="brand"><span class="brand-mark">SKU</span><span>箱唛归集工具</span></div><span class="version">${VERSION}</span></nav>
    <div class="hero-body wrap">
      <div class="eyebrow">AMAZON FBA / AWD LABEL SORTER</div>
      <h1>跨仓箱唛，<span>按 SKU 一次归好</span></h1>
      <p>上传多个仓库混排标签 PDF，自动生成每个 SKU 的跨仓合集，贴标连续作业，不再来回翻文件。</p>
      <div class="privacy-pill"><span>✓</span><strong>纯浏览器本地处理</strong> · PDF 不上传服务器</div>
    </div>
  </header>

  <main class="wrap workspace">
    <section class="card upload-card">
      <div class="step-head"><span class="step">01</span><div><h2>选择标签 PDF</h2><p>支持同时选择多个 FBA / AWD 标签文件</p></div></div>
      <div id="dropzone" class="dropzone" tabindex="0">
        <div class="upload-icon">↑</div><h3>拖放 PDF 到这里</h3><p>或从电脑中选择，可多选</p>
        <button id="chooseBtn" class="button secondary" type="button">选择 PDF 文件</button>
        <input id="fileInput" type="file" accept="application/pdf,.pdf" multiple hidden>
      </div>
      <div id="fileList" class="file-list"></div>
    </section>

    <section class="card options-card">
      <div class="step-head"><span class="step">02</span><div><h2>处理选项</h2><p>根据出货要求自由勾选</p></div></div>
      <label class="option">
        <input id="removeCompany" type="checkbox"><span class="check"></span>
        <span><strong>去掉公司名</strong><small>删除 FBA: / AWD: 后面的公司名文字，不是简单白色遮盖</small></span>
      </label>
      <label class="option">
        <input id="addMade" type="checkbox"><span class="check"></span>
        <span><strong>添加 Made in China</strong><small>按 FBA / AWD 模板自动放到标签安全区域</small></span>
      </label>
    </section>

    <section class="card action-card">
      <div class="step-head"><span class="step">03</span><div><h2>识别并归集</h2><p>先预览识别结果，再生成下载包</p></div></div>
      <div class="actions">
        <button id="scanBtn" class="button primary" type="button" disabled>开始识别</button>
        <button id="generateBtn" class="button success" type="button" hidden>生成并下载 ZIP</button>
        <button id="resetBtn" class="button ghost" type="button" hidden>重新选择</button>
      </div>
      <div id="progressBox" class="progress-box" hidden>
        <div class="progress-meta"><span id="statusText">准备中…</span><span id="progressText">0%</span></div>
        <div class="progress-track"><div id="progressBar"></div></div>
      </div>
      <div id="result" class="result" hidden></div>
    </section>

    <section class="notice">
      <strong>使用提示</strong>
      <p>推荐使用最新版 Chrome 或 Edge。加密 PDF、扫描图片型 PDF 或全新未知模板可能无法识别；工具会列出未识别页面，不会把它们误归到其他 SKU。</p>
    </section>
  </main>

  <footer class="site-footer">
    © 2025 跨境工具魔方 AmzToolBox. All rights reserved.
    <span class="footer-separator">|</span><a href="/privacy">隐私说明</a>
  </footer>
`;

function renderTopAd(config: Record<string, unknown>): void {
  const anchor = document.querySelector<HTMLDivElement>('#page-top-ad-anchor');
  if (!anchor || !config?.enabled) { anchor?.remove(); return; }
  const imageUrl = String(config.imageUrl || '').trim();
  const linkUrl = String(config.linkUrl || '').trim();
  const showImage = config.type === 'image' ? Boolean(imageUrl) : config.type === 'text' ? false : Boolean(imageUrl);
  const innerClass = `page-top-ad__inner${showImage ? ' page-top-ad__inner--image' : ''}`;
  const target = config.openInNewTab === false ? '' : ' target="_blank" rel="noopener noreferrer"';
  let content = '';
  if (showImage) {
    const image = `<img class="page-top-ad__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(String(config.alt || '页眉下广告位'))}" style="max-height:${Number(config.imageHeight || 200)}px">`;
    content = linkUrl ? `<a class="page-top-ad__image-link" href="${escapeHtml(linkUrl)}"${target}>${image}</a>` : image;
  } else {
    const adText = String(config.text || '').trim();
    if (!adText) { anchor.remove(); return; }
    content = linkUrl
      ? `<a class="page-top-ad__link" href="${escapeHtml(linkUrl)}"${target}><span class="page-top-ad__text">${escapeHtml(adText)}</span><span class="page-top-ad__cta">${escapeHtml(String(config.ctaText || '点击跳转'))} ↗</span></a>`
      : `<div class="page-top-ad__plain">${escapeHtml(adText)}</div>`;
  }
  anchor.outerHTML = `<section class="page-top-ad"><div class="${innerClass}">${content}</div></section>`;
}

fetch('/api/top-ad', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then(renderTopAd).catch(() => document.querySelector('#page-top-ad-anchor')?.remove());

const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;
const chooseBtn = document.querySelector<HTMLButtonElement>('#chooseBtn')!;
const dropzone = document.querySelector<HTMLDivElement>('#dropzone')!;
const fileList = document.querySelector<HTMLDivElement>('#fileList')!;
const scanBtn = document.querySelector<HTMLButtonElement>('#scanBtn')!;
const generateBtn = document.querySelector<HTMLButtonElement>('#generateBtn')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#resetBtn')!;
const removeCompany = document.querySelector<HTMLInputElement>('#removeCompany')!;
const addMade = document.querySelector<HTMLInputElement>('#addMade')!;
const progressBox = document.querySelector<HTMLDivElement>('#progressBox')!;
const progressBar = document.querySelector<HTMLDivElement>('#progressBar')!;
const progressText = document.querySelector<HTMLSpanElement>('#progressText')!;
const statusText = document.querySelector<HTMLSpanElement>('#statusText')!;
const result = document.querySelector<HTMLDivElement>('#result')!;

let selectedFiles: File[] = [];
let scanResult: ScanResult | undefined;

function escapeHtml(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function updateProgress(done: number, total: number, message: string): void {
  progressBox.hidden = false;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  statusText.textContent = message;
}

function setBusy(busy: boolean): void {
  scanBtn.disabled = busy || selectedFiles.length === 0;
  generateBtn.disabled = busy;
  chooseBtn.disabled = busy;
  removeCompany.disabled = busy;
  addMade.disabled = busy;
}

function renderFiles(): void {
  scanBtn.disabled = selectedFiles.length === 0;
  fileList.innerHTML = selectedFiles.map((file, index) => `
    <div class="file-row"><span class="pdf-badge">PDF</span><span class="file-name">${escapeHtml(file.name)}<small>${fileSize(file.size)}</small></span><button type="button" data-remove="${index}" aria-label="移除">×</button></div>
  `).join('');
  fileList.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedFiles.splice(Number(button.dataset.remove), 1);
      scanResult = undefined;
      generateBtn.hidden = true;
      result.hidden = true;
      renderFiles();
    });
  });
}

function addFiles(list: FileList | File[]): void {
  const incoming = [...list].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  const keys = new Set(selectedFiles.map((file) => `${file.name}|${file.size}|${file.lastModified}`));
  for (const file of incoming) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (!keys.has(key)) selectedFiles.push(file);
  }
  scanResult = undefined;
  generateBtn.hidden = true;
  result.hidden = true;
  renderFiles();
}

chooseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files) addFiles(fileInput.files); fileInput.value = ''; });
dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.click(); });
for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('dragging'); });
dropzone.addEventListener('drop', (event) => { if (event.dataTransfer?.files) addFiles(event.dataTransfer.files); });

scanBtn.addEventListener('click', async () => {
  setBusy(true);
  result.hidden = true;
  generateBtn.hidden = true;
  resetBtn.hidden = false;
  try {
    updateProgress(0, 1, '正在读取 PDF…');
    scanResult = await scanPdfs(selectedFiles, updateProgress);
    const groups = summarizeGroups(scanResult.pages);
    if (groups.length === 0) throw new Error('没有识别到可归集的 SKU，请确认 PDF 是文字型 Amazon 标签。');
    const skippedHtml = scanResult.skipped.length
      ? `<div class="warning">⚠ 有 ${scanResult.skipped.length} 页未识别，生成时将跳过。请核对后再下载。</div>`
      : '';
    result.innerHTML = `
      <div class="stats"><div><strong>${selectedFiles.length}</strong><span>源文件</span></div><div><strong>${scanResult.pages.length}</strong><span>有效标签</span></div><div><strong>${groups.length}</strong><span>SKU 合集</span></div></div>
      ${skippedHtml}
      <div class="table-wrap"><table><thead><tr><th>SKU</th><th>标签数</th><th>仓库</th><th>模板</th></tr></thead><tbody>${groups.map((group) => `<tr><td><strong>${escapeHtml(group.sku)}</strong></td><td>${group.pages}</td><td>${group.warehouses.map(escapeHtml).join('、')}</td><td>${group.templates.join(' / ')}</td></tr>`).join('')}</tbody></table></div>
    `;
    result.hidden = false;
    generateBtn.hidden = false;
    updateProgress(1, 1, '识别完成，可以生成下载包');
  } catch (error) {
    result.innerHTML = `<div class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    result.hidden = false;
    updateProgress(0, 1, '识别失败');
  } finally {
    setBusy(false);
  }
});

generateBtn.addEventListener('click', async () => {
  if (!scanResult) return;
  setBusy(true);
  try {
    updateProgress(0, scanResult.pages.length, '正在准备输出文件…');
    const zip = await generateZip(scanResult, { removeCompany: removeCompany.checked, addMadeInChina: addMade.checked, onProgress: updateProgress });
    const blob = new Blob([zip as BlobPart], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Amazon箱唛按SKU归集_${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    updateProgress(scanResult.pages.length, scanResult.pages.length, '生成完成，下载已开始');
  } catch (error) {
    result.innerHTML = `<div class="error">生成失败：${escapeHtml(error instanceof Error ? error.message : String(error))}</div>` + result.innerHTML;
    result.hidden = false;
    updateProgress(0, 1, '生成失败，请查看提示');
  } finally {
    setBusy(false);
  }
});

resetBtn.addEventListener('click', () => {
  selectedFiles = [];
  scanResult = undefined;
  result.hidden = true;
  progressBox.hidden = true;
  generateBtn.hidden = true;
  resetBtn.hidden = true;
  renderFiles();
});
