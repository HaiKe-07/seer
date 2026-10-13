const path = require('path');
const fs = require('fs');

function _userData() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch (e) {
    /* 非 electron 环境（如测试） */
  }
  return process.env.SEER_USER_DATA || path.join(process.cwd(), '.seer-data');
}

// 数据存储根目录：应用用户数据目录下的 data 文件夹
let dataRoot = process.env.SEER_DATA_ROOT || path.join(_userData(), 'data');

// 内存中的全局数据
const db = {
  settings: {}, // 设置
  pool: [], // 精灵池
  pve: [], // PvE 攻略
  pvpModels: [], // PvP 套路模板
  enemies: [], // 敌人/关卡数据 (由图鉴等来源)
  restrictedPool: [], // PvP 限制池/禁限表：当前版本被禁用或受限的精灵
  pvpMeta: [] // PvP 热门对战环境描述
};

function ensureDataRoot() {
  if (!fs.existsSync(dataRoot)) {
    fs.mkdirSync(dataRoot, { recursive: true });
  }
}

function filePath(name) {
  ensureDataRoot();
  return path.join(dataRoot, `${name}.json`);
}

// 读取 JSON，若不存在则返回默认
function readJSON(name, fallback) {
  try {
    const p = filePath(name);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (e) {
    console.error('读取失败', name, e);
  }
  return fallback;
}

// 写入 JSON，先备份旧文件
function writeJSON(name, data) {
  ensureDataRoot();
  const p = filePath(name);
  try {
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, `${p}.bak`);
    }
  } catch (e) {
    /* 忽略备份失败 */
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

// 加载全部数据
function loadAll() {
  db.settings = { ...defaultSettings(), ...readJSON('settings', {}) };
  db.pool = readJSON('pool', []);
  db.pve = readJSON('pve', []);
  db.pvpModels = readJSON('pvpModels', defaultPvpModels());
  db.enemies = readJSON('enemies', []);
  db.restrictedPool = readJSON('restrictedPool', []);
  db.pvpMeta = readJSON('pvpMeta', []);
}

// 写入一个集合（按 key 更新 db 并落盘）
function saveCollection(key) {
  if (!(key in db)) return null;
  writeJSON(key, db[key]);
  return db[key];
}

function getAll() {
  return {
    settings: db.settings,
    pool: db.pool,
    pve: db.pve,
    pvpModels: db.pvpModels,
    enemies: db.enemies,
    restrictedPool: db.restrictedPool,
    pvpMeta: db.pvpMeta
  };
}

function defaultSettings() {
  return {
    deepseekApiKey: '',
    model: 'deepseek-chat',
    aiEnabled: true,
    // 攻略可信度阈值（天），超过该天数视为不可信
    guidetrustYears: 5,
    // 抓取源配置
    sources: [
      { key: 'official', name: '官方图鉴', enabled: true },
      { key: 'community', name: '社区论坛', enabled: true },
      { key: 'laoxiaoyi', name: '雷小伊社区', enabled: true },
      { key: 'tieba', name: '百度贴吧', enabled: true, fname: '赛尔号' }
    ],
    // 各来源自定义入口（host，逗号分隔）
    sourceHosts: { laoxiaoyi: '' },
    // 贴吧作为攻略来源时的目标吧名
    tiebaFname: '赛尔号'
  };
}

function defaultPvpModels() {
  return [
    {
      id: 'output',
      name: '主C输出位',
      desc: '高爆发的核心输出，负责拉扯与斩杀',
      roles: ['亡语核爆', '速攻', '强化推队']
    },
    {
      id: 'tank',
      name: '坦克/肉盾位',
      desc: '抗伤、牵制，为队友创造输出空间',
      roles: ['联防抗伤', '不死坦', '复活']
    },
    {
      id: 'support',
      name: '辅助/增益位',
      desc: '提供BUFF、解控、压血等辅助效果',
      roles: ['增益', '净化', '破甲']
    },
    {
      id: 'control',
      name: '控制/干扰位',
      desc: '控制节奏、ban位先锋，限制对手',
      roles: ['控制', '干扰', '压阵']
    }
  ];
}

module.exports = {
  db,
  loadAll,
  saveCollection,
  getAll,
  defaultSettings,
  defaultPvpModels,
  getDataRoot: () => dataRoot
};