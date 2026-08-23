const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');

const DEFAULT_ROOM = '8178490';
const TOOLBAR_HEIGHT = 92;

// AppImage 无法可靠保留 chrome-sandbox 的 root:root 4755 权限。
// 仅对 AppImage 关闭 Chromium sandbox；.deb 和开发运行保持正常 sandbox。
if (process.platform === 'linux' && process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox');
}
let win;
let pageView;

function liveUrl(room) {
  return `https://live.bilibili.com/${encodeURIComponent(room || DEFAULT_ROOM)}`;
}

function layout() {
  if (!win || !pageView) return;
  const [width, height] = win.getContentSize();
  pageView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(1, height - TOOLBAR_HEIGHT) });
}

function sendStatus(message) {
  if (win && !win.isDestroyed()) win.webContents.send('psd-status', message);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: 'Page Sound Delay - Bilibili',
    webPreferences: {
      preload: path.join(__dirname, 'toolbar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, 'toolbar.html'));

  pageView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });
  win.contentView.addChildView(pageView);
  layout();
  win.on('resize', layout);
  pageView.webContents.loadURL(liveUrl(DEFAULT_ROOM));
  pageView.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[page-sound-delay] preload failed: ${preloadPath}`, error);
    sendStatus('页面音频脚本加载失败：' + error.message);
  });
  pageView.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(www\.|passport\.)?bilibili\.com\//.test(url)) {
      pageView.webContents.loadURL(url);
    }
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; pageView = null; });
}

ipcMain.on('psd-command', (_event, command) => {
  if (!pageView || !command) return;
  if (command.type === 'open-room' && /^\d+$/.test(String(command.payload))) {
    pageView.webContents.loadURL(liveUrl(command.payload));
    sendStatus(`正在打开直播间 ${command.payload}…`);
    return;
  }
  pageView.webContents.send('psd-control', command);
});

ipcMain.on('psd-page-status', (_event, message) => sendStatus(String(message)));

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
