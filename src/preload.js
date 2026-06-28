const { contextBridge, ipcRenderer } = require('electron');

// Expose a small, safe API to the renderer process.
contextBridge.exposeInMainWorld('petAPI', {
  // Persistence
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),

  // Window control
  setMode: (mode) => ipcRenderer.send('window:setMode', mode),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),

  // Window drag
  dragStart: (x, y) => ipcRenderer.send('window:dragStart', { mouseX: x, mouseY: y }),
  dragMove: (x, y) => ipcRenderer.send('window:dragMove', { mouseX: x, mouseY: y }),
  dragEnd: () => ipcRenderer.send('window:dragEnd'),
});
