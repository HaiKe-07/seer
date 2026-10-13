const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const store = require('./store');
const ai = require('./services/ai');
const poolSvc = require('./services/pool');
const pveSvc = require('./services/pve');
const pvpSvc = require('./services/pvp');

function registerIpc() {
  // 设置
  ipcMain.handle('settings:get', () => store.db.settings);
  ipcMain.handle('settings:set', (_e, data) => {
    store.db.settings = { ...store.db.settings, ...data };
    return store.saveCollection('settings');
  });

  // 精灵池
  ipcMain.handle('pool:list', () => poolSvc.list());
  ipcMain.handle('pool:save', (_e, mon) => poolSvc.upsert(mon));
  ipcMain.handle('pool:remove', (_e, id) => poolSvc.remove(id));
  ipcMain.handle('pool:import', (_e, items) => poolSvc.batchImport(items));

  // PvE
  ipcMain.handle('pve:list', () => pveSvc.trustworthy());
  ipcMain.handle('pve:save', (_e, rec) => pveSvc.upsert(rec));
  ipcMain.handle('pve:remove', (_e, id) => pveSvc.remove(id));
  ipcMain.handle('pve:fetchAndTidy', async (_e, opts) =>
    pveSvc.fetchAndTidy(opts.target, opts.keywords, opts.rawText)
  );
  ipcMain.handle('pve:match', (_e, record) => pveSvc.matchPool(record));

  // PvP
  ipcMain.handle('pvp:recalc', (_e, banned) => pvpSvc.recalc(banned));
  ipcMain.handle('pvp:analyze', (_e, team, opts) => pvpSvc.analyzeForTeam(team, opts));
  ipcMain.handle('pvp:models', () => store.db.pvpModels);
  ipcMain.handle('pvp:getRestricted', () => pvpSvc.getRestricted());
  ipcMain.handle('pvp:setRestricted', (_e, list) => pvpSvc.setRestricted(list));
  ipcMain.handle('pvp:getMeta', () => pvpSvc.getMeta());
  ipcMain.handle('pvp:setMeta', (_e, list) => pvpSvc.setMeta(list));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: '巅峰之战攻略助手',
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  store.loadAll();
  ai.init(() => store.db.settings);
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  ['pool', 'pve', 'pvpModels', 'settings', 'enemies', 'restrictedPool', 'pvpMeta'].forEach((k) => {
    try {
      store.saveCollection(k);
    } catch (e) {}
  });
});