'use strict';

const { Tray, Menu, nativeImage } = require('electron');

function createSystemTray({
  mainWindow,
  botRunner,
  iconPath,
  onQuit
} = {}) {
  let icon = null;
  if (iconPath) {
    try {
      icon = nativeImage.createFromPath(iconPath);
      // No Windows, ícone da bandeja é tipicamente 16x16 ou 32x32
      if (icon && !icon.isEmpty()) {
        icon = icon.resize({ width: 16, height: 16 });
      }
    } catch {}
  }
  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  const tray = new Tray(icon);
  tray.setToolTip('Zero Browser');

  const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Zero Browser',
      click: () => showMainWindow()
    },
    {
      label: 'Parar tudo',
      click: () => {
        try { botRunner?.stopAllBots(); } catch {}
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        if (typeof onQuit === 'function') {
          onQuit();
        }
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.focus();
    } else {
      showMainWindow();
    }
  });

  return {
    tray,
    showMainWindow,
    destroy() {
      try { tray.destroy(); } catch {}
    }
  };
}

module.exports = { createSystemTray };

