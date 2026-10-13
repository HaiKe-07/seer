// PvP 模块：自动组队、BP 重算、限制池、热门环境、分析
const store = require('../store');
const ai = require('./ai');
const seer = require('../seer-utils');

// ---------------- 限制池 / 热门环境 ----------------
function getRestricted() {
  return store.db.restrictedPool;
}

// 设置整份限制池 [{name, remark}]，自动去重
function setRestricted(list) {
  const seen = new Set();
  store.db.restrictedPool = (Array.isArray(list) ? list : [])
    .map((r) => ({ name: (r.name || '').trim(), remark: r.remark || '' }))
    .filter((r) => r.name && !seen.has(r.name) && !!seen.add(r.name));
  return store.saveCollection('restrictedPool');
}

function getMeta() {
  return store.db.pvpMeta;
}

// 设置热门环境描述（字符串数组）
function setMeta(list) {
  store.db.pvpMeta = (Array.isArray(list) ? list : []).filter((s) => typeof s === 'string' && s.trim());
  return store.saveCollection('pvpMeta');
}

// 某只精灵是否在限制池/被禁
function isRestricted(mon) {
  const names = store.db.restrictedPool.map((r) => r.name);
  return names.some((n) => mon.name.includes(n) || n.includes(mon.name));
}

// ---------------- 自动组队 ----------------
// 依据限制池 + 手动 ban + 热门环境亲和度，自动组建主力与替补
function autoTeam(bannedIds = [], opts = {}) {
  const pool = store.db.pool.map((p) => ({ ...p }));
  const banned = new Set(bannedIds || []);
  // 排除：手动 ban 的 id/name + 限制池（版本环境禁用的精灵不参与组队）
  const available = pool.filter(
    (p) => !banned.has(p.id) && !banned.has(p.name) && !isRestricted(p)
  );

  const ranked = available
    .map((p) => ({ ...p, _score: competitiveScore(p, opts.meta || []) }))
    .filter((p) => p._score > 0)
    .sort((a, b) => b._score - a._score);

  const team = [];
  const roles = ['tank', 'support', 'control', 'output'];
  const used = new Set();
  let cursor = 0;
  // 先按位置意图匹配 suggestRole，否则按强度顺位
  for (const role of roles) {
    const defRole = store.db.pvpModels.find((m) => m.id === role);
    const keywords = [role].concat(defRole ? defRole.roles : []);
    let pick = ranked.find((p, i) => !used.has(p.id) && roleMatch(p, keywords));
    if (!pick) pick = ranked.find((p) => !used.has(p.id));
    if (pick) {
      used.add(pick.id);
      team.push({ mon: pick, role });
    }
  }
  // 补充替补（剩余高竞争力精灵），最多到 6
  for (const p of ranked) {
    if (used.has(p.id)) continue;
    team.push({ mon: p, role: 'bench' });
    used.add(p.id);
    if (team.length >= 6) break;
  }
  return team;
}

function roleMatch(mon, keywords) {
  const base = (mon.suggestRole || '').toLowerCase();
  const attrs = (mon.attributes || []).join(' ').toLowerCase();
  return keywords.some((k) => base.includes(k) || attrs.includes(k));
}

// 竞技评分：种族 + 练度 + 属性强度 + 热门环境亲和
function competitiveScore(mon, meta) {
  let s = 0;
  s += (mon.total || 600) - 600;
  if (mon.level) s += (mon.level - 50) * 0.4;
  if (mon.iv) s += (mon.iv - 20) * 0.2;
  // 热门环境：与当前强势环境关键词命中的精灵加分（表示"当前版本好用/必须克制"）
  const hay = mon.name + ' ' + (mon.attributes || []).join(' ');
  const hayL = hay.toLowerCase();
  for (const m of meta || []) {
    if (hayL.includes(String(m).toLowerCase())) s += 20;
  }
  return s;
}

// ---------------- 手动重算 ----------------
// 返回主力、替补，以及每个位置可替换的候选（供前端手动换将）
function recalc(bannedIds) {
  const team = autoTeam(bannedIds || []);
  // 被用于主力的 id
  const usedIds = new Set(team.filter((t) => t.role !== 'bench').map((t) => t.mon.id));
  // 候选池：未被用作主力、未被 ban、不在限制池 的精灵，供换将
  const banned = new Set(bannedIds || []);
  const candidates = store.db.pool
    .filter((p) => !banned.has(p.id) && !banned.has(p.name) && !isRestricted(p) && !usedIds.has(p.id))
    .map((p) => ({ ...p }));

  const main = team.filter((t) => t.role !== 'bench').map((t) => ({ ...t.mon, suggestedRole: t.role }));
  const bench = team.filter((t) => t.role === 'bench').map((t) => t.mon);
  return { main, bench, candidates, banned: bannedIds || [] };
}

// ---------------- 分析 ----------------
async function analyzeForTeam(teamPayload, opts = {}) {
  const poolSnap = store.db.pool;
  if (ai.isEnabled()) {
    try {
      const result = await ai.pvpAnalyze(teamPayload, {
        pool: poolSnap.slice(0, 30),
        bans: opts.bans || [],
        meta: opts.meta || store.db.pvpMeta
      });
      return result;
    } catch (e) {
      console.error('AI 分析失败，回退本地', e.message);
    }
  }
  return localAnalyze(teamPayload, { meta: opts.meta || store.db.pvpMeta });
}

// 本地兜底分析（含培养思路 + BP 建议 + 克制）
function localAnalyze(teamPayload, opts = {}) {
  const list = teamPayload.map((t) => t && t.name);
  const byName = {};
  teamPayload.forEach((t) => { if (t) byName[t.name] = t; });

  const breakdown = list.map((name) => {
    const mon = byName[name] || {};
    return {
      name,
      rough: (mon.total || mon.power) >= 735 ? '高强度核心' : '常规',
      roles: mon.suggestedRole || '综合',
      notes: '以种族值与当前热门环境为主的手动兜底分析，建议开启 AI 获取深度解读。'
    };
  });

  // 粗略克制：按属性和高的位置上场
  let counters = '由本地规则推断：优先保留属性、练度俱佳的精灵拉扯，规避明显被反克的目标。';
  const top = list[0];
  if (top) counters += ` 目前核心为 ${top}，常见需要规避的属性型对手可在对局中灵活换阵。`;

  return {
    playstyle: `围绕当前热门环境组成的综合型阵容。整体思路：以高强度精灵建立压制，坦克牵制、辅助增益、控制干扰、输出收割，替补兜底抗压。${list.join('、')} 各司其职。`,
    breakdown,
    cultivation: breakdown.map((b) => ({
      name: b.name,
      advice: `优先提升种族值与练度(Lv/个体)，性格与技能按 ${(byName[b.name] || {}).note || '主流套路'} 方向培养。`
    })),
    counters,
    teach: [
      '开局观察对手阵容，优先用坦克/控制探底，保住主C',
      '利用属性克制规避反克，避免把主力暴露给克制它的精灵',
      'BP 阶段优先 ban 掉会针对你主C的精灵，守护输出核心',
      '当主C被后手压制时，及时切换替补吸收伤害'
    ],
    bpAdvice: {
      priorityBan: top ? `优先禁 ${top} 的克制者，保障核心生存环境` : '可先人工根据环境模拟 BP',
      firstPick: list.slice(0, 2).length ? `首选 ${list.slice(0, 2).join('、')}，快速建立阵容骨架` : ''
    },
    banFallbacks: '建议开启 AI 获取被 ban 后的自动替换方案；也可手动调整候选池中的精灵。'
  };
}

module.exports = {
  autoTeam,
  recalc,
  analyzeForTeam,
  localAnalyze,
  competitiveScore,
  getRestricted,
  setRestricted,
  getMeta,
  setMeta,
  isRestricted
};