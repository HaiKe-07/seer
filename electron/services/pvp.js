// PvP 模块：自动组队、BP 重算、分析
const store = require('../store');
const ai = require('./ai');
const seer = require('../seer-utils');

// 根据精灵池 + 限制池自动组建一队
function autoTeam(bannedIds = [], opts = {}) {
  const pool = store.db.pool.map((p) => ({ ...p }));
  const banned = new Set(bannedIds || []);
  const available = pool.filter((p) => !banned.has(p.id) && !banned.has(p.name));

  // 按强度排序，尽量组满 4 个位置
  const ranked = available
    .filter((p) => p.total || p.power)
    .sort((a, b) => (b.total || b.power || 0) - (a.total || a.power || 0));

  const team = [];
  const roles = ['tank', 'support', 'control', 'output'];
  const used = new Set();
  // 依次填位置（保证位置多样性）+ 剩余高强替补
  for (const role of roles) {
    const pick = ranked.find((p) => !used.has(p.id) && (p.suggestRole || '').toLowerCase().includes(role))
      || ranked.find((p) => !used.has(p.id));
    if (pick) {
      used.add(pick.id);
      team.push({ mon: pick, role });
    }
  }
  // 补充替补
  for (const p of ranked) {
    if (used.has(p.id)) continue;
    team.push({ mon: p, role: 'bench' });
    used.add(p.id);
    if (team.length >= 6) break;
  }
  return team;
}

// 手动重算：给定被ban名单，返回主力和替补
function recalc(bannedIds) {
  const team = autoTeam(bannedIds || []);
  const main = team.filter((t) => t.role !== 'bench').map((t) => ({ ...t.mon, suggestedRole: t.role }));
  const bench = team.filter((t) => t.role === 'bench').map((t) => t.mon);
  return { main, bench, banned: bannedIds || [] };
}

// 生成完整分析（调用 AI，可回退到本地规则）
async function analyzeForTeam(teamPayload, opts = {}) {
  const poolSnap = store.db.pool;
  if (ai.isEnabled()) {
    try {
      const result = await ai.pvpAnalyze(teamPayload, {
        pool: poolSnap.slice(0, 30),
        bans: opts.bans || [],
        meta: opts.meta || []
      });
      return result;
    } catch (e) {
      console.error('AI 分析失败，回退本地', e.message);
    }
  }
  // 本地兜底分析
  return localAnalyze(teamPayload);
}

function localAnalyze(teamPayload) {
  const list = teamPayload.map((t) => t.name);
  return {
    playstyle: `基于当前精灵池自动生成的综合型阵容（可选）。核心思路：利用高种族值精灵拉扯压制，量力而行。`,
    breakdown: list.map((name) => ({ name, rough: '常规', roles: '综合', notes: '本地规则分析' })),
    counters: '无 AI 时无法深度分析克制，建议开启 AI 获得详细克制关系。',
    teach: ['优先保住主C，使用坦克牵制', '利用属性克制规避反克', '注意 BP 保护核心'],
    bpAdvice: '可先用本地数据人工模拟 bp，建议优先保主C。',
    banFallbacks: '请开启 AI 以获取被 ban 后的自动替换方案。'
  };
}

module.exports = { autoTeam, recalc, analyzeForTeam, localAnalyze };