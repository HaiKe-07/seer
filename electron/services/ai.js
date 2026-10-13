// DeepSeek AI 分析引擎
const axios = require('axios');

const API_URL = 'https://api.deepseek.com/chat/completions';

// 读取设置（由外部注入，避免循环依赖）
let _getSettings = () => ({});

function init(getSettingsFn) {
  _getSettings = getSettingsFn;
}

function isEnabled() {
  const s = _getSettings();
  return s.aiEnabled && s.deepseekApiKey && s.deepseekApiKey.length > 10;
}

async function chat(system, user, { temperature = 0.7, json = false } = {}) {
  const s = _getSettings();
  if (!isEnabled()) {
    throw new Error('AI 未启用或未配置 Key，请到设置中填写 DeepSeek API Key');
  }
  const resp = await axios.post(
    API_URL,
    {
      model: s.model || 'deepseek-chat',
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: json ? { type: 'json_object' } : undefined
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${s.deepseekApiKey}`
      },
      timeout: 120000
    }
  );
  const content = resp.data?.choices?.[0]?.message?.content || '';
  if (json) {
    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error('AI 返回的不是合法 JSON：' + content.slice(0, 200));
    }
  }
  return content;
}

// 攻略清洗整理：把多方抓取到的原始文本整理成结构化攻略
async function tidyGuides(rawTexts, meta) {
  const joined = rawTexts.map((t) => t.slice(0, 4000)).join('\n\n=====【独立来源分隔】=====\n\n');
  const system =
    '你是一个《赛尔号》资深攻略编辑。请把下面多个来源的巅峰之战新精灵/关卡信息，' +
    '整理成结构化、去重、可信的攻略。' +
    '输出 JSON，字段：{title, target(关卡/精灵), attributes(属性[]),' +
    'mechanism(关卡机制), strategy(打法步骤数组), recommended(推荐精灵[{name,reason,config}]其中的config为性格/技能等),' +
    'requirements(通关硬性条件[]), trustScore(0-100整数,综合时效与完整性), note(备注)}。';
  return chat(system, joined, { json: true, temperature: 0.4 });
}

// 内容质量评分（本地规则，不依赖 AI，用于兜底）
function localTrustScore(record) {
  const ageDays = (Date.now() - (record.publishedAt || 0)) / 86400000;
  let score = 100;
  if (ageDays > 5 * 365) score -= 60; // 超五年直接大扣
  else if (ageDays > 365) score -= (ageDays / 365) * 10;
  else score -= (ageDays / 365) * 3;
  if (!record.strategy || record.strategy.length === 0) score -= 20;
  if (!record.recommended || record.recommended.length === 0) score -= 10;
  return Math.max(0, Math.round(score));
}

// PvP 阵容分析：生成打法思路 / 培养思路 / 克制与优劣势
async function pvpAnalyze(team, options = {}) {
  const s = _getSettings();
  const system =
    `你是《赛尔号》巅峰之战顶级玩家。基于给定的精灵阵容与对战背景，生成一份 PvP 攻略。` +
    `请输出 JSON，字段：{playstyle(整体打法思路), breakdown(逐精灵职责分析[],每项含name/rough/roles/notes),` +
    `counters(优劣势与克制关系), teach(教学要点数组), bpAdvice(BP建议,含优先ban和首选pick), banFallbacks(若某精灵被ban后的替换方案[])}。`;
  const user =
    `可用精灵池：${JSON.stringify(options.pool || [])}\n` +
    `已选阵容：${JSON.stringify(team)}\n` +
    `限制池：${JSON.stringify(options.bans || [])}\n` +
    `当前热门环境：${JSON.stringify(options.meta || [])}\n` +
    `请给出完整分析与 BP 建议。`;
  return chat(system, user, { json: true, temperature: 0.6 });
}

// 缺口分析：本地规则为主，可叠加 AI 建议
function localGapAnalysis(requirements, pool) {
  const haveNames = new Set(pool.map((p) => p.name));
  const gaps = [];
  for (const req of requirements || []) {
    const needName = req.name;
    const nameMatch = pool.find((p) => p.name.includes(needName) || needName.includes(p.name));
    const attrMatch = req.attributes
      ? pool.find((p) => p.attributes && p.attributes.some((a) => req.attributes.includes(a)))
      : null;
    if (nameMatch) {
      // 有了，检查强度/配置是否达标
      if (req.total && nameMatch.total && nameMatch.total < req.total) {
        gaps.push({
          name: needName,
          status: 'weak',
          reason: `已拥有但种族值(${nameMatch.total})未达要求(${req.total})`,
          suggestion: `继续培养/进化提升种族值`,
          match: nameMatch
        });
      }
    } else if (attrMatch) {
      gaps.push({ name: needName, status: 'attr_fallback', reason: `无本命精灵，但可用属性相近的 ${attrMatch.name} 代替`, suggestion: attrMatch.name, match: attrMatch });
    } else {
      gaps.push({ name: needName, status: 'missing', reason: '精灵池中没有该精灵，也无属性替代', suggestion: `建议获取：${needName}`, match: null });
    }
  }
  return gaps;
}

module.exports = { init, isEnabled, chat, tidyGuides, localTrustScore, pvpAnalyze, localGapAnalysis };