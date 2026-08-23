const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pageSoundDelay', {
  send: (type, payload) => ipcRenderer.send('psd-command', { type, payload }),
  onStatus: (handler) => ipcRenderer.on('psd-status', (_event, status) => handler(status)),
  onState: (handler) => ipcRenderer.on('psd-state', (_event, state) => handler(state)),
  reportHeight: (height) => ipcRenderer.send('psd-toolbar-height', Number(height) || 92),
  expandToolbar: (expanded) => ipcRenderer.send('psd-expand-toolbar', expanded),
});
/* The toolbar can wrap when the window is resized; report its actual height. */
window.addEventListener('DOMContentLoaded', () => {
  const report = () => {
    const dialog = document.getElementById('custom-dialog');
    const isOpen = dialog && !dialog.hidden;
    ipcRenderer.send('psd-toolbar-height', isOpen ? 320 : (document.body.scrollHeight || 92));
  };
  report();
  new ResizeObserver(report).observe(document.body);
});
