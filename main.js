const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');

const DEFAULT_ROOM = '22604707';
let toolbarHeight = 92;
let toolbarExpanded = false;
let appState = { delay: 0, enabled: false, muted: false };

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
  const effectiveHeight = toolbarExpanded ? Math.min(320, height - 100) : toolbarHeight;
  pageView.setBounds({ x: 0, y: effectiveHeight, width, height: Math.max(1, height - effectiveHeight) });
}

function expandToolbar(expanded) {
  toolbarExpanded = expanded;
  layout();
}

function sendStatus(message) {
  if (win && !win.isDestroyed()) win.webContents.send('psd-status', message);
}

function sendState() {
  if (win && !win.isDestroyed()) win.webContents.send('psd-state', appState);
}

function roomUrl(value) {
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) return liveUrl(raw);
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'live.bilibili.com') return null;
    return url.href;
  } catch (_) { return null; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: 'B站直播音频延时神器',
    webPreferences: {
      preload: path.join(__dirname, 'toolbar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, 'toolbar.html')).then(sendState);

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
  win.on('maximize', layout);
  win.on('unmaximize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
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

ipcMain.on('psd-toolbar-height', (_event, height) => {
  toolbarHeight = Math.max(60, Math.min(220, Math.ceil(Number(height) || 92)));
  layout();
});

ipcMain.on('psd-expand-toolbar', (_event, expanded) => {
  expandToolbar(Boolean(expanded));
});

ipcMain.on('request-state', sendState);

ipcMain.on('psd-command', (_event, command) => {
  if (!pageView || !command) return;
  if (command.type === 'open-room' || command.type === 'open-custom') {
    const target = roomUrl(command.payload);
    if (!target) { sendStatus('直播间 ID 或 URL 无效'); return; }
    pageView.webContents.loadURL(target);
    sendStatus('正在打开直播间…');
    return;
  }
  if (command.type === 'set-delay') appState.delay = Math.max(0, Math.min(120, Number(command.payload) || 0));
  if (command.type === 'set-enabled') appState.enabled = Boolean(command.payload);
  if (command.type === 'set-muted') appState.muted = Boolean(command.payload);
  sendState();
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
