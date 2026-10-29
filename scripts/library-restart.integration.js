const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');

const executable = process.argv[2];
if (!executable) throw new Error('Uso: node scripts/library-restart.integration.js <Zero Browser.exe>');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-library-restart-'));
const userData = path.join(scratch, 'user-data');
const site = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><head><title>SÃO PAULO — Ação</title></head><body><h1>SÃO PAULO</h1></body></html>');
});
let child = null;

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = require('node:http').get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.once('error', reject);
  });
}

async function waitForCdp(endpoint, processRef) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) throw new Error(`Zero Browser encerrou durante a inicialização (${processRef.exitCode})`);
    try { return await getJson(`${endpoint}/json/list`); }
    catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 200)); }
  }
  throw new Error(`CDP não ficou pronto: ${lastError?.message || 'timeout'}`);
}

async function waitForTarget(endpoint, predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const targets = await getJson(`${endpoint}/json/list`);
    const target = targets.find(predicate);
    if (target) return target;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Target da interface não apareceu no CDP');
}

function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const id = Math.floor(Math.random() * 1e9);
    const timeout = setTimeout(() => { socket.terminate(); reject(new Error(`CDP evaluate timeout: ${expression.slice(0, 100)}`)); }, 10000);
    socket.once('error', (error) => { clearTimeout(timeout); reject(error); });
    socket.once('message', (raw) => {
      clearTimeout(timeout);
      socket.close();
      const message = JSON.parse(raw.toString());
      if (message.error) return reject(new Error(message.error.message));
      if (message.result.exceptionDetails) return reject(new Error(message.result.exceptionDetails.text));
      resolve(message.result.result.value);
    });
    socket.once('open', () => socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true, userGesture: true }
    })));
  });
}

async function waitForValue(target, expression, predicate, label) {
  const deadline = Date.now() + 10000;
  let value;
  while (Date.now() < deadline) {
    value = await evaluate(target, expression);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Tempo esgotado aguardando ${label}; último valor: ${JSON.stringify(value)}`);
}

async function startApp() {
  const port = await new Promise((resolve, reject) => {
    const server = require('node:net').createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const assigned = server.address().port;
      server.close((error) => error ? reject(error) : resolve(assigned));
    });
  });
  const endpoint = `http://127.0.0.1:${port}`;
  child = spawn(executable, [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`, '--no-first-run'], {
    windowsHide: false,
    env: { ...process.env, NAVEGANTE_USER_DATA: userData }
  });
  let output = '';
  child.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { output += chunk.toString(); });
  child.on('error', (error) => { output += error.stack || String(error); });
  await waitForCdp(endpoint, child).catch((error) => { throw new Error(`${error.message}\n${output}`); });
  const mainTarget = await waitForTarget(endpoint, (target) => target.type === 'page' && target.url.startsWith('file://') && target.url.endsWith('/index.html'));
  await waitForValue(mainTarget, `({app:typeof window.app,api:typeof window.navegante})`, (value) => value.app === 'object' && value.api === 'object', 'interface carregar');
  return { endpoint, mainTarget };
}

async function stopAppGracefully() {
  if (!child || child.exitCode !== null) return;
  const processRef = child;
  const pid = processRef.pid;
  const exitPromise = new Promise((resolve) => processRef.once('exit', resolve));
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ZeroCloseWindow { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam); }'; $p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -ne 0 -and [ZeroCloseWindow]::PostMessage($p.MainWindowHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)){Write-Output 'CLOSED'}else{Write-Output 'NO_WINDOW'}`;
  const closeResult = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
  if (closeResult.error || closeResult.status !== 0) throw new Error(`Não foi possível solicitar fechamento normal (PID ${pid}): ${closeResult.stderr || closeResult.error || closeResult.status}`);
  if (!closeResult.stdout.includes('CLOSED') && processRef.exitCode === null) throw new Error(`A janela principal do processo ${pid} não aceitou WM_CLOSE: ${closeResult.stdout.trim()}`);
  if (processRef.exitCode !== null) return;
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`A janela não encerrou normalmente (PID ${pid}, exit=${processRef.exitCode})`)), 20000);
    exitPromise.then((exitCode) => { clearTimeout(timeout); resolve(exitCode); });
  });
  if (code !== 0) throw new Error(`Zero Browser encerrou com código ${code}`);
  child = null;
}

async function main() {
  assert.equal(fs.existsSync(executable), true, `Executável não encontrado: ${executable}`);
  await new Promise((resolve) => site.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${site.address().port}/sao-paulo`;

  const firstRun = await startApp();
  const tab = await evaluate(firstRun.mainTarget, `(async()=>{const t=await window.navegante.browser.newTab(${JSON.stringify(url)});await window.navegante.browser.switchTab(t.tabId);return t.tabId})()`);
  await waitForTarget(firstRun.endpoint, (target) => target.type === 'page' && target.url === url);
  await waitForValue(firstRun.mainTarget, `window.navegante.library.history('search',{text:'sao paulo',maxResults:100}).then(x=>x.some(i=>i.url===${JSON.stringify(url)}&&i.title.includes('SÃO PAULO')))` , Boolean, 'visita entrar no histórico persistido');
  const bookmark = await evaluate(firstRun.mainTarget, `window.navegante.library.bookmarks('create',{title:'Ação Favorita',url:${JSON.stringify(url)}})`);
  assert.equal(bookmark.title, 'Ação Favorita');

  const sourceHistorySearch = await evaluate(firstRun.mainTarget, `window.navegante.library.history('search',{text:'sao paulo',maxResults:100}).then(items=>items.some(item=>item.url===${JSON.stringify(url)}))`);
  const sourceBookmarkSearch = await evaluate(firstRun.mainTarget, `window.navegante.library.bookmarks('search',{query:'acao favorita'}).then(items=>items.some(item=>item.url===${JSON.stringify(url)}))`);
  assert.equal(sourceHistorySearch, true, 'a busca de histórico deve ignorar os acentos em títulos portugueses');
  assert.equal(sourceBookmarkSearch, true, 'a busca de favoritos deve ignorar os acentos em títulos portugueses');

  await evaluate(firstRun.mainTarget, `window.app.openLibrary('history')`);
  await evaluate(firstRun.mainTarget, `(()=>{const e=document.getElementById('library-search');e.value='sao paulo';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const firstHistoryRow = await waitForValue(firstRun.mainTarget, `document.querySelector('#library-list .library-open strong')?.textContent||''`, (value) => value.includes('SÃO PAULO'), 'busca de histórico na UI');
  await evaluate(firstRun.mainTarget, `window.app.openLibrary('bookmarks')`);
  await evaluate(firstRun.mainTarget, `(()=>{const e=document.getElementById('library-search');e.value='acao';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const firstBookmarkRow = await waitForValue(firstRun.mainTarget, `document.querySelector('#library-list .library-open strong')?.textContent||''`, (value) => value === 'Ação Favorita', 'busca de favoritos na UI');

  await stopAppGracefully();
  const secondRun = await startApp();
  const historyAfterRestart = await evaluate(secondRun.mainTarget, `window.navegante.library.history('search',{text:'sao paulo',maxResults:100}).then(items=>items.some(item=>item.url===${JSON.stringify(url)}&&item.title.includes('SÃO PAULO')))`);
  const bookmarkAfterRestart = await evaluate(secondRun.mainTarget, `window.navegante.library.bookmarks('search',{query:'acao favorita'}).then(items=>items.some(item=>item.url===${JSON.stringify(url)}))`);
  assert.equal(historyAfterRestart, true, 'o histórico precisa sobreviver à reinicialização do app');
  assert.equal(bookmarkAfterRestart, true, 'o favorito precisa sobreviver à reinicialização do app');

  await evaluate(secondRun.mainTarget, `window.app.openLibrary('history')`);
  await evaluate(secondRun.mainTarget, `(()=>{const e=document.getElementById('library-search');e.value='sao paulo';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const historyRowAfterRestart = await waitForValue(secondRun.mainTarget, `document.querySelector('#library-list .library-open strong')?.textContent||''`, (value) => value.includes('SÃO PAULO'), 'busca de histórico após reinício');
  await evaluate(secondRun.mainTarget, `window.app.openLibrary('bookmarks')`);
  await evaluate(secondRun.mainTarget, `(()=>{const e=document.getElementById('library-search');e.value='acao';e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  const bookmarkRowAfterRestart = await waitForValue(secondRun.mainTarget, `document.querySelector('#library-list .library-open strong')?.textContent||''`, (value) => value === 'Ação Favorita', 'busca de favoritos após reinício');

  console.log(JSON.stringify({ status: 'PASS', executable, persistence: { history: historyAfterRestart, bookmark: bookmarkAfterRestart }, accentInsensitiveUiSearch: { beforeRestart: { history: firstHistoryRow, bookmark: firstBookmarkRow }, afterRestart: { history: historyRowAfterRestart, bookmark: bookmarkRowAfterRestart } }, profile: 'temporary', appRestarts: 1, seedTab: tab }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.stack || error, temporaryProfile: userData }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  if (child && child.exitCode === null) {
    try { await stopAppGracefully(); }
    catch {
      const pid = child?.pid;
      spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      const profilePath = userData.replaceAll("'", "''");
      const waitForTree = `$p='${profilePath}';$end=[DateTime]::UtcNow.AddSeconds(15);do{$left=Get-CimInstance Win32_Process|Where-Object{$_.Name -eq 'Zero Browser.exe' -and $_.CommandLine -and $_.CommandLine.Contains($p)};if(-not $left){exit 0};Start-Sleep -Milliseconds 200}while([DateTime]::UtcNow -lt $end);exit 1`;
      spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', waitForTree], { windowsHide: true, stdio: 'ignore', timeout: 20000 });
    }
  }
  if (site.listening) await new Promise((resolve) => site.close(resolve));
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 12, retryDelay: 500 });
});
