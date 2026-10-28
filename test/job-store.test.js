const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JobStore, DEFAULT_TTL_MS } = require('../src/automation/job-store');

function tempFile() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-jobs-'));
  return { directory, file: path.join(directory, 'tarefas.json') };
}

const state = (id, extra = {}) => ({
  id,
  messages: [{ role: 'system', content: 'instruções' }, { role: 'user', content: 'abra a planilha' }],
  tabId: 'tab-1',
  rootTabId: 'tab-1',
  model: 'deepseek-chat',
  provider: 'deepseek',
  taskStartedAt: 1000,
  knownDownloads: [],
  knownTabs: ['tab-1'],
  tabTrail: [],
  lastUrl: 'https://docs.google.com/spreadsheets/d/x/edit',
  expiresAt: 2000,
  ...extra
});

test('a paused run survives a restart with its history', async () => {
  const { directory, file } = tempFile();
  try {
    const first = new JobStore({ filePath: file, now: () => 1000 });
    await first.save('job-1', state('job-1'));
    const second = new JobStore({ filePath: file, now: () => 1500 });
    const jobs = await second.list();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, 'job-1');
    assert.equal(jobs[0].messages, 2);
    assert.equal(jobs[0].lastUrl, 'https://docs.google.com/spreadsheets/d/x/edit');
    assert.equal((await second.load()).get('job-1').messages.length, 2, 'histórico completo volta');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('expired runs are pruned and never offered', async () => {
  const { directory, file } = tempFile();
  try {
    let now = 1000;
    const store = new JobStore({ filePath: file, now: () => now });
    await store.save('velho', state('velho'));
    now = 1000 + DEFAULT_TTL_MS + 1;
    assert.deepEqual(await store.list(), []);
    const restored = new JobStore({ filePath: file, now: () => now });
    await restored.load();
    assert.equal((await restored.list()).length, 0, 'nada expirado volta do disco');
    await restored.prune();
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(raw.jobs, []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the store keeps at most eight runs and no secret is persisted', async () => {
  const { directory, file } = tempFile();
  try {
    const store = new JobStore({ filePath: file, now: () => 1000 });
    for (let i = 0; i < 10; i++) await store.save(`job-${i}`, state(`job-${i}`, { taskStartedAt: 1000 + i }));
    const jobs = await store.list();
    assert.equal(jobs.length, 8);
    const raw = fs.readFileSync(file, 'utf8');
    assert.ok(!/apiKey|Bearer|sk-/.test(raw), 'nenhuma chave de API vai para o disco');
    assert.ok(raw.includes('job-9'), 'a mais recente fica');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('corrupted file becomes an empty store and remove deletes from disk', async () => {
  const { directory, file } = tempFile();
  try {
    fs.writeFileSync(file, '{ quebrado');
    const store = new JobStore({ filePath: file, now: () => 1000 });
    assert.deepEqual(await store.list(), []);
    await store.save('job-1', state('job-1'));
    assert.equal(await store.remove('job-1'), true);
    const again = new JobStore({ filePath: file, now: () => 1000 });
    assert.deepEqual(await again.list(), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the service lists and forgets paused runs through the durable store', async () => {
  const { AutomationService } = require('../src/automation/service');
  const { directory, file } = tempFile();
  try {
    const service = new AutomationService();
    service.jobStore = new JobStore({ filePath: file, now: () => 1000 });
    service.rememberPausedRun('job-svc', { ...state('job-svc'), expiresAt: Date.now() + 60000 });
    assert.deepEqual(await service.listJobs().then((jobs) => jobs.map((job) => job.id)), ['job-svc']);
    service.forgetPausedRun('job-svc');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(await service.listJobs(), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
