// 精灵池模块逻辑
const store = require('../store');
const seer = require('../seer-utils');

// 新增/更新一条精灵
function upsert(mon) {
  if (!mon.id) mon.id = 'mon_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const idx = store.db.pool.findIndex((m) => m.id === mon.id || m.name === mon.name);
  const power = seer.evaluatePower(mon);
  mon.power = power;
  mon.tier = mon.total ? seer.racetoTier(mon.total) : undefined;
  if (idx >= 0) store.db.pool[idx] = { ...store.db.pool[idx], ...mon };
  else store.db.pool.push(mon);
  return store.saveCollection('pool');
}

function remove(id) {
  store.db.pool = store.db.pool.filter((m) => m.id !== id);
  return store.saveCollection('pool');
}

function search(kw) {
  if (!kw) return store.db.pool;
  const q = kw.toLowerCase();
  return store.db.pool.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.attributes && m.attributes.join(',').toLowerCase().includes(q))
  );
}

// 批量从抓取结果导入
function batchImport(items) {
  const added = [];
  for (const it of items) {
    if (it.name) {
      upsert(it);
      added.push(it.name);
    }
  }
  return { added, count: added.length };
}

module.exports = { upsert, remove, search, batchImport, list: () => store.db.pool };