// PvE 模块：攻略整理、可信度过滤、精灵池匹配
const store = require('../store');
const ai = require('./ai');
const scraper = require('./scraper');

function list() {
  return store.db.pve;
}

// 可信度过滤 + 排序：越新越可信
function withTrust(records) {
  return records
    .map((r) => ({ ...r, trustScore: r.trustScore ?? ai.localTrustScore(r) }))
    .sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0));
}

// 当前可信攻略（标注超五年为不可信）
function trustworthy() {
  const fiveYears = 5 * 365 * 86400000;
  return withTrust(store.db.pve).map((r) => ({
    ...r,
    trusted: (r.publishedAt || 0) >= Date.now() - fiveYears
  }));
}

// 新增一条攻略（可手动录入）
function upsert(record) {
  if (!record.id) record.id = 'pve_' + Date.now();
  if (!record.publishedAt) record.publishedAt = Date.now();
  const idx = store.db.pve.findIndex((r) => r.id === record.id);
  if (idx >= 0) store.db.pve[idx] = { ...store.db.pve[idx], ...record };
  else store.db.pve.push(record);
  return store.saveCollection('pve');
}

function remove(id) {
  store.db.pve = store.db.pve.filter((r) => r.id !== id);
  return store.saveCollection('pve');
}

// 抓取 + AI 整理一篇攻略
async function fetchAndTidy(target, keywords, rawText) {
  const settings = store.db.settings;
  const texts = [];
  if (rawText) texts.push({ url: 'manual', text: rawText });
  for (const src of settings.sources || []) {
    if (src.enabled) {
      try {
        // 贴吧源：使用设置里配置的吧名；其余源原样
        const srcCfg =
          src.key === 'tieba' && settings.tiebaFname ? { ...src, fname: settings.tiebaFname } : src;
        const res = await scraper.scrapeSource(srcCfg, keywords || [target]);
        if (res.length) texts.push(...res);
      } catch (e) {
        console.error('抓取来源失败', src.key, e.message);
      }
    }
  }
  if (texts.length === 0) {
    throw new Error('未抓取到任何内容，请手动粘贴原文或配置抓取源');
  }
  const tidy = await ai.tidyGuides(texts.map((t) => t.text), { target });
  const record = {
    id: 'pve_' + Date.now(),
    title: tidy.title || target,
    target: tidy.target || target,
    attributes: tidy.attributes || [],
    mechanism: tidy.mechanism || '',
    strategy: tidy.strategy || [],
    recommended: tidy.recommended || [],
    requirements: tidy.requirements || [],
    trustScore: tidy.trustScore ?? ai.localTrustScore({ ...tidy, publishedAt: Date.now() }),
    sources: texts.map((t) => t.url),
    publishedAt: Date.now(),
    createdAt: Date.now()
  };
  store.db.pve.push(record);
  store.saveCollection('pve');
  return record;
}

// 匹配精灵池，输出可行性 + 缺口建议
function matchPool(record) {
  const gaps = ai.localGapAnalysis(record.requirements || [], store.db.pool);
  const achievable = gaps.every((g) => g.status === 'ok' || g.status === 'attr_fallback' || g.status === 'weak');
  // 兜底策略：即便缺精灵，也保留可执行版本（AI 可再补）
  let fallback = null;
  if (!achievable && ai.isEnabled()) {
    fallback = '当前精灵池不完全满足，建议优先补齐缺口，或按以下兜底路线执行';
  }
  return { achievable, gaps, fallback };
}

module.exports = { list, withTrust, trustworthy, upsert, remove, fetchAndTidy, matchPool };