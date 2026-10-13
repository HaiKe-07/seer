const { contextBridge, ipcRenderer } = require('electron');

// 内置浏览器同步窗口专用的 preload
contextBridge.exposeInMainWorld('syncAPI', {
  // 导入抓取到的精灵
  import: (items) => ipcRenderer.invoke('sync:import', items),
  // 获取抓取脚本
  getScript: (url) => ipcRenderer.invoke('sync:getScript', url),
  // 获取正文抽取脚本（攻略素材）
  getTextScript: () => ipcRenderer.invoke('sync:getTextScript')
});