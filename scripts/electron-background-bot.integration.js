'use strict';

// Medição A5: comportamento de aba oculta com WebContentsView + setBackgroundThrottling(false)
// enquanto a janela principal (BrowserWindow) está minimizada no Electron v45 / Chromium v134.
// Referência técnica: issue electron/electron#42140.

const { app, BrowserWindow, WebContentsView, session } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zero-bg-bot-measure-'));
app.setPath('userData', path.join(tempRoot, 'user-data'));

async function measureBackgroundExecution() {
  const ses = session.fromPartition('persist:navegante-bot-benchmark');
  
  const mainWindow = new BrowserWindow({
    width: 640,
    height: 480,
    show: true,
    webPreferences: {
      session: ses,
      contextIsolation: true
    }
  });

  mainWindow.minimize();
  const isMinimized = mainWindow.isMinimized();

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 300, height: 200 });

  // Ponto crítico: desliga o estrangulamento de segundo plano da aba do Bot
  view.webContents.setBackgroundThrottling(false);

  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Bot Background Benchmark</title></head>
      <body>
        <div id="counter">0</div>
        <script>
          window.ticks = 0;
          window.tickTimestamps = [];
          const timer = setInterval(() => {
            window.ticks++;
            window.tickTimestamps.push(Date.now());
            const el = document.getElementById('counter');
            if (el) el.innerText = String(window.ticks);
          }, 100);
        </script>
      </body>
    </html>
  `;

  await view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`);

  const startTime = Date.now();
  // Aguarda 2200 ms com a janela minimizada
  await new Promise((resolve) => setTimeout(resolve, 2200));
  const elapsed = Date.now() - startTime;

  const result = await view.webContents.executeJavaScript(`({
    ticks: window.ticks,
    domText: document.getElementById('counter') ? document.getElementById('counter').innerText : '',
    sampleCount: window.tickTimestamps.length,
    firstTick: window.tickTimestamps[0],
    lastTick: window.tickTimestamps[window.tickTimestamps.length - 1]
  })`);

  mainWindow.destroy();

  const measurement = {
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    windowMinimized: isMinimized,
    elapsedMs: elapsed,
    ticksRecorded: result.ticks,
    expectedTicksMin: 18,
    domUpdated: result.domText === String(result.ticks),
    backgroundThrottlingDisabled: true,
    verdict: result.ticks >= 18 ? 'PASS' : 'THROTTLED',
    details: `Registrados ${result.ticks} ticks em ${elapsed}ms com janela minimizada (taxa ~${((result.ticks / (elapsed / 1000))).toFixed(1)} ticks/s, esperado ~10/s).`
  };

  console.log('__ZERO_BG_BOT_MEASUREMENT__' + JSON.stringify(measurement, null, 2));

  if (measurement.verdict !== 'PASS') {
    throw new Error(`Segundo plano estrangulado com janela minimizada: ${measurement.details}`);
  }
}

app.whenReady().then(async () => {
  try {
    await measureBackgroundExecution();
    app.exit(0);
  } catch (error) {
    console.error('Falha na medição de segundo plano:', error);
    app.exit(1);
  } finally {
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  }
});

