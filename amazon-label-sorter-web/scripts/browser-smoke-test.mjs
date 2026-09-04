// Usage: node scripts/browser-smoke-test.mjs <debug-port> <download-dir> <pdf> [pdf...]
const [port, downloadPath, ...files] = process.argv.slice(2);
if (!port || !downloadPath || files.length === 0) throw new Error('Missing debug port, download directory or PDF paths.');

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No browser page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitUntil(expression, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out: ${expression}`);
}

await command('Runtime.enable');
await command('DOM.enable');
await command('Page.enable');
await command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
const documentNode = await command('DOM.getDocument');
const input = await command('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#fileInput' });
await command('DOM.setFileInputFiles', { nodeId: input.nodeId, files });
await evaluate(`document.querySelector('#fileInput').dispatchEvent(new Event('change', { bubbles: true }))`);
await waitUntil(`!document.querySelector('#scanBtn').disabled`);
await evaluate(`document.querySelector('#scanBtn').click()`);
await waitUntil(`!document.querySelector('#result').hidden && !document.querySelector('#generateBtn').hidden && !document.querySelector('#generateBtn').disabled`);
const preview = await evaluate(`document.querySelector('#result').innerText`);
console.log(preview.replace(/\n+/g, ' | '));

await evaluate(`document.querySelector('#removeCompany').checked = true; document.querySelector('#addMade').checked = true; document.querySelector('#generateBtn').click()`);
await waitUntil(`document.querySelector('#statusText').textContent.includes('生成完成')`, 120_000);
console.log('ZIP generation completed');
socket.close();

