const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pageSoundDelay', {
  send: (type, payload) => ipcRenderer.send('psd-command', { type, payload }),
  onStatus: (handler) => ipcRenderer.on('psd-status', (_event, status) => handler(status)),
  onState: (handler) => ipcRenderer.on('psd-state', (_event, state) => handler(state)),
  reportHeight: (height) => ipcRenderer.send('psd-toolbar-height', Number(height) || 92),
});
/* The toolbar can wrap when the window is resized; report its actual height. */
window.addEventListener('DOMContentLoaded', () => {
  const report = () => window.pageSoundDelay.reportHeight(document.body.scrollHeight);
  report();
  new ResizeObserver(report).observe(document.body);
});
