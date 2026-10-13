const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('seer', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (data) => ipcRenderer.invoke('settings:set', data)
  },
  pool: {
    list: () => ipcRenderer.invoke('pool:list'),
    save: (mon) => ipcRenderer.invoke('pool:save', mon),
    remove: (id) => ipcRenderer.invoke('pool:remove', id),
    import: (items) => ipcRenderer.invoke('pool:import', items)
  },
  pve: {
    list: () => ipcRenderer.invoke('pve:list'),
    save: (record) => ipcRenderer.invoke('pve:save', record),
    remove: (id) => ipcRenderer.invoke('pve:remove', id),
    fetchAndTidy: (opts) => ipcRenderer.invoke('pve:fetchAndTidy', opts),
    match: (record) => ipcRenderer.invoke('pve:match', record)
  },
  pvp: {
    recalc: (banned) => ipcRenderer.invoke('pvp:recalc', banned),
    analyze: (team, opts) => ipcRenderer.invoke('pvp:analyze', team, opts),
    models: () => ipcRenderer.invoke('pvp:models')
  }
});