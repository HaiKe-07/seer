// 赛尔号通用工具：属性克制、练度计算、搜资讯等

// 属性克制表（简化版，覆盖主流属性）。key 为属性，value 为该属性对哪些克制。
// 完整克制来自官方图鉴，这里提供基础双属性映射用于缺口建议。
const ATTRIBUTE_VS = {
  '火': ['草', '冰', '虫', '钢'],
  '水': ['火', '地', '岩'],
  '草': ['水', '地', '岩'],
  '电': ['水', '飞行'],
  '冰': ['草', '地', '飞行', '龙'],
  '地面': ['电', '火', '岩', '钢', '毒'],
  '飞行': ['草', '虫', '格斗'],
  '岩石': ['火', '冰', '飞行', '虫'],
  '普通': [],
  '格斗': ['普通', '冰', '岩', '钢'],
  '超能': ['格斗', '毒'],
  '幽灵': ['幽灵', '超能'],
  '暗影': ['超能', '幽灵', '机械'],
  '远古': ['草', '虫'],
  '龙': ['龙'],
  '机械': ['冰', '岩石', '钢', '妖精', '暗影'],
  '邪灵': ['超能', '幽灵'],
  '圣灵': ['战斗', '龙', '幽灵', '暗影'],
  '神秘': ['超能', '幽灵'],
  '自然': [],
  '混沌': ['神秘', '邪灵', '龙'],
  '神秘': ['超能', '幽灵'],
  '轮回': ['混沌', '神秘', '邪灵', '龙', '圣灵']
};

// 种族值 → 强度分级（用于 PvP 评级）
function racetoTier(total) {
  if (total >= 745) return 'S';
  if (total >= 735) return 'A';
  if (total >= 720) return 'B';
  if (total >= 700) return 'C';
  return 'D';
}

// 根据技能/种族，粗估属性是否克制目标属性
function isEffective(attackerAttr, defenderAttr) {
  const list = ATTRIBUTE_VS[attackerAttr] || [];
  return list.includes(defenderAttr) || attackerAttr === defenderAttr;
}

// 个体值与等级 → 能力等级（粗略）
function evaluatePower(pokemon) {
  let score = 0;
  score += (pokemon.total ?? 700) - 600;
  if (pokemon.level) score += (pokemon.level - 50) * 0.5;
  if (pokemon.iv) score += (pokemon.iv - 20) * 0.2;
  return Math.round(score);
}

// 生成精灵搜索关键词/别名（用于抓取或 AI）
function altNames(mon) {
  const set = new Set([mon.name, mon.name.toUpperCase()]);
  (mon.aliases || []).forEach((a) => set.add(a));
  return [...set];
}

module.exports = { ATTRIBUTE_VS, racetoTier, isEffective, evaluatePower, altNames };