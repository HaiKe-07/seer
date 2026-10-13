// Electron 端到端验证：打开原生页面注入抓取脚本，验证在真实 DOM 上能提取精灵候选
const { app, BrowserWindow } = require('electron');
const path = require('path');
const scraper = require('../electron/services/scraper');
const syncSvc = require('../electron/services/sync');

app.whenReady().then(async () => {
  // 1) 用 sync 服务创建窗口（验证 webview + preload 配置不报错）
  const win = syncSvc.openSyncWindow();
  await new Promise((r) => setTimeout(r, 500));
  console.log('✓ 抓取窗口已创建');
  // 我们并不真正登录外部站点，构造一个本地 html 页验证 webview 执行脚本
  const html = `<!DOCTYPE html><html><body>
    <img alt="圣雷·布鲁" src="x" />
    <div class="mon-elite">玄武·霸</div>
    <p>遇到 白泽·光 可用 玄武·霸 压制；左侧：青龙·霖</p>
    <span>普通文本</span>
  </body></html>`;
  const webview = win.webContents ? null : null; // webview tag 在 renderer；这里改用加载该 html 到窗口自身验证
  // 直接在窗口页面执行抓取脚本（窗口自身 DUID load 我们提供的 html）
  const dv = win.webContents;
  dv.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  dv.on('did-finish-load', async () => {
    // 注入提取脚本执行
    const res = await win.webContents.executeJavaScript(scraper.extractPokemonScript);
    const parsed = typeof res === 'string' ? JSON.parse(res) : res;
    const names = (parsed.items || []).map((i) => i.name);
    console.log('抓取结果数:', parsed.count, '名称:', names.join('、'));
    const hasLei = names.includes('圣雷·布鲁');
    const hasXW = names.includes('玄武·霸');
    const hasBZ = names.includes('白泽·光');
    const hasQL = names.includes('青龙·霖');
    console.log('✓ 捕获 img alt(圣雷·布鲁):', hasLei);
    console.log('✓ 捕获卡片文本(玄武·霸):', hasXW);
    console.log('✓ 捕获正文·精灵(白泽·光/青龙·霖):', hasBZ && hasQL);
    // validate parseExtracted 接入导入
    const cleaned = scraper.parseExtracted(parsed.items, 'browser');
    console.log('✓ parseExtracted 清洗后:', cleaned.length);
    console.log('RESULT:', hasLei && hasXW && hasBZ && hasQL && cleaned.length >= 4 ? 'PASS' : 'FAIL');
    app.exit(hasLei && hasXW && hasBZ && hasQL && cleaned.length >= 4 ? 0 : 1);
  });
});