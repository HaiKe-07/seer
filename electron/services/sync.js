// 精灵抓取同步：内置浏览器窗口管理 + 导入
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const poolSvc = require('./pool');
const scraper = require('./scraper');

let syncWin = null;

// 配置 webview 支持的主窗口参数（需要 webpreferences: webviewTag）
function createWindowOpts() {
  return {
    width: 1100,
    height: 780,
    title: '精灵抓取 · 内置浏览器',
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, '../sync-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  };
}

// 打开抓取同步窗口（若已存在则聚焦）
function openSyncWindow() {
  if (syncWin && !syncWin.isDestroyed()) {
    syncWin.focus();
    return syncWin;
  }
  syncWin = new BrowserWindow(createWindowOpts());
  syncWin.loadFile(path.join(__dirname, '../sync-window.html'));
  syncWin.on('closed', () => { syncWin = null; });
  return syncWin;
}

// 注册抓取窗口相关 IPC
function registerIpc() {
  // 根据当前页面 URL 返回最贴合的抓取脚本 + 适配器信息
  ipcMain.handle('sync:getScript', (_e, url) => {
    const settings = require('../store').db.settings;
    const adapter = scraper.resolveScript(url, settings);
    return { script: adapter.extractScript, adapterId: adapter.id, adapterName: adapter.name };
  });
  // 获取「抓当前页正文作攻略素材」的抽取脚本（贴吧帖子正文等）
  ipcMain.handle('sync:getTextScript', () => ({ script: scraper.extractTextScript }));
  ipcMain.handle('sync:import', (_e, items) => {
    const cleaned = scraper.parseExtracted(items, 'browser');
    const res = poolSvc.batchImport(cleaned);
    return { added: cleaned, count: cleaned.length };
  });
}

module.exports = { openSyncWindow, registerIpc, createWindowOpts };