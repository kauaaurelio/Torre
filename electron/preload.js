// Ponte segura main <-> renderer (contextIsolation ligado, sem nodeIntegration).
// Só expõe a API de atualização — nada além disso cruza a fronteira.

const { contextBridge, ipcRenderer } = require('electron');

const CANAIS = [
  'update:checking',
  'update:available',
  'update:none',
  'update:progress',
  'update:downloaded',
  'update:error',
];

contextBridge.exposeInMainWorld('torreUpdate', {
  // Registra um ouvinte único que recebe (canal, dados). Devolve a função de
  // desinscrição para o React limpar no unmount.
  on(cb) {
    const registrados = CANAIS.map((canal) => {
      const handler = (_evento, dados) => cb(canal, dados);
      ipcRenderer.on(canal, handler);
      return [canal, handler];
    });
    return () => {
      for (const [canal, handler] of registrados) ipcRenderer.removeListener(canal, handler);
    };
  },
  startDownload: () => ipcRenderer.invoke('update:start-download'),
  install: () => ipcRenderer.invoke('update:install'),
});
