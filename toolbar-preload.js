const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pageSoundDelay', {
  send: (type, payload) => ipcRenderer.send('psd-command', { type, payload }),
  onStatus: (handler) => ipcRenderer.on('psd-status', (_event, status) => handler(status)),
});
