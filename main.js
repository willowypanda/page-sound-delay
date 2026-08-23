const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

const DEFAULT_ROOM = '8178490';
let win;

function liveUrl(room) {
  return `https://live.bilibili.com/${encodeURIComponent(room || DEFAULT_ROOM)}`;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    title: 'Page Sound Delay - Bilibili',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  win.loadURL(liveUrl(DEFAULT_ROOM));
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  // 保留 Bilibili 的登录 Cookie,但不保存本应用之外的站点数据。
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
