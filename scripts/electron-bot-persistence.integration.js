'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const WebSocket = require('ws');
const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-panel-persist-'));
let child;
async function port() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
async function evaluate(target, expression) {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Timeout CDP')); }, 15000);
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })));
    ws.on('message', (raw) => {
      const response = JSON.parse(raw.toString());
      if (response.id !== 1) return;
      clearTimeout(timer); ws.close();
      if (response.error || response.result?.exceptionDetails) return reject(new Error(JSON.stringify(response.error || response.result.exceptionDetails)));
      resolve(response.result?.result?.value);
    });
    ws.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}
async function start() {
  const debugPort = await port();
  const env = { ...process.env, APPDATA: path.join(scratch, 'appdata'), ZERO_USER_DATA: path.join(scratch, 'profile'), ZERO_TEST_PROFILES_ROOT: path.join(scratch, 'profiles') };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(require('electron'), [root, `--remote-debugging-port=${debugPort}`, '--no-first-run'], { cwd: root, windowsHide: true, env, stdio: 'ignore' });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Aplicativo encerrou: ${child.exitCode}`);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = targets.find((item) => item.type === 'page' && item.url.endsWith('/index.html'));
      if (target && await evaluate(target, 'Boolean(window.app && window.zeroBrowser?.bots)')) return target;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Interface isolada não iniciou');
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else child.kill('SIGTERM');
  await new Promise((resolve) => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); });
}
(async () => {
  let target = await start();
  const result = await evaluate(target, `(async () => {
    const before = await window.zeroBrowser.bots.listTasks();
    const bot = await window.zeroBrowser.bots.createTask({ name: 'Persistência de teste', goal: 'Ler página de teste', specialty: 'custom-specialist', mascot: 7 });
    const saved = await window.zeroBrowser.bots.updateSchedule(bot.id, true, '23:59');
    const memory = await window.zeroBrowser.bots.addMemory(bot.id, 'Preferência de teste');
    return { countBefore: before.length, id: bot.id, saved, memory };
  })()`);
  assert.equal(result.countBefore, 0, 'perfil novo não recebe bots agendados');
  assert.equal(result.saved.schedule.dailyAt, '23:59');
  assert.equal(result.memory.text, 'Preferência de teste');
  await stop();
  target = await start();
  const restored = await evaluate(target, `window.zeroBrowser.bots.listTasks()`);
  const bot = restored.find((entry) => entry.id === result.id);
  assert.ok(bot, 'bot persiste após reinício');
  assert.equal(bot.specialty, 'custom-specialist');
  assert.equal(bot.mascot, 7);
  assert.equal(bot.schedule.enabled, true);
  assert.equal(bot.schedule.dailyAt, '23:59');
  assert.equal(bot.memory[0].text, 'Preferência de teste');
  const disabled = await evaluate(target, `window.zeroBrowser.bots.updateSchedule(${JSON.stringify(result.id)}, false, '')`);
  assert.equal(disabled.schedule.enabled, false);
  await stop();
  target = await start();
  const after = await evaluate(target, `window.zeroBrowser.bots.listTasks()`);
  assert.equal(after.find((entry) => entry.id === result.id).schedule.enabled, false);
  console.log(JSON.stringify({ status: 'PASS', isolated: true, restarts: 2, scheduleAndMemoryPersist: true }));
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  await stop();
  const resolved = path.resolve(scratch);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('zero-panel-persist-')) fs.rmSync(resolved, { recursive: true, force: true });
});
