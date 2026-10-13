<template>
  <div>
    <div class="page-title">PvP 对战</div>
    <div class="page-sub">
      依据精灵池、限制池与主流环境自动组建阵容；手动模拟 BP（禁选）后自动重算，并生成打法/培养分析与教学。
    </div>

    <!-- 控制面板 -->
    <div class="card" style="padding: 16px; margin-bottom: 16px">
      <div class="row" style="align-items: center; margin-bottom: 12px">
        <div class="ctl-title">① 选择被禁（Ban）精灵</div>
        <span style="flex: 1"></span>
        <button class="btn" @click="resetBans">清空禁选</button>
        <button class="btn primary" :disabled="analyzing" @click="reCalc">
          {{ analyzing ? '分析中…' : '自动组队 + 分析' }}
        </button>
      </div>
      <div class="muted" style="margin-bottom: 6px; font-size: 12px">
        从精灵池点选要 ban 掉的精灵（用于模拟对手禁了你核心，或你自己想规避的环境）。
      </div>
      <div class="ban-list">
        <span
          v-for="m in allPool"
          :key="m.id"
          class="ban-chip"
          :class="{ banned: bannedSet.has(m.id) }"
          @click="toggleBan(m.id)"
        >
          {{ m.name }}
          <span v-if="bannedSet.has(m.id)">✕</span>
        </span>
      </div>
    </div>

    <!-- 阵容结果 -->
    <div v-if="result" class="card" style="padding: 18px; margin-bottom: 16px">
      <div class="ctl-title">② 推荐阵容</div>
      <div class="team-grid">
        <div v-for="m in result.main" :key="m.id" class="slot">
          <div class="slot-role">
            <span class="role-ico" :class="m.suggestedRole">{{ roleIcon(m.suggestedRole) }}</span>
            {{ roleName(m.suggestedRole) }}
          </div>
          <div class="slot-name">{{ m.name }}</div>
          <div class="slot-tags">
            <span class="tag">{{ (m.attributes || []).join('/') }}</span>
            <span class="tag">种族{{ m.total || '—' }}</span>
          </div>
        </div>
      </div>
      <div v-if="result.bench.length" class="bench">
        <span class="muted">替补：</span>
        <span v-for="b in result.bench" :key="b.id" class="tag">{{ b.name }}</span>
      </div>
      <div class="row" style="margin-top: 14px">
        <button class="btn primary" :disabled="analyzing" @click="runAnalysis">
          {{ analyzing ? '生成分析中…' : '生成打法 / 培养 / BP 分析' }}
        </button>
        <span class="muted" style="align-self: center">或对任意精灵执行 BP 重算（修改禁用后点上方按钮）</span>
      </div>
    </div>

    <!-- 分析结果 -->
    <div v-if="analysis" class="card" style="padding: 20px">
      <div class="ctl-title">③ 阵容分析与教学</div>

      <div class="ana-block">
        <div class="ana-title">💡 整体打法思路</div>
        <p>{{ analysis.playstyle }}</p>
      </div>

      <div class="ana-block">
        <div class="ana-title">📋 逐精灵职责</div>
        <div v-for="b in analysis.breakdown" :key="b.name" class="breakdown">
          <strong>{{ b.name }}</strong>（{{ b.rough || '常规' }} / {{ (b.roles || []).join('、') || '综合' }}）{{ b.notes || '' }}
        </div>
      </div>

      <div class="ana-block">
        <div class="ana-title">⚖ 克制与优劣势</div>
        <p>{{ analysis.counters }}</p>
      </div>

      <div class="ana-block">
        <div class="ana-title">🎓 教学要点</div>
        <ol>
          <li v-for="(t, i) in (analysis.teach || [])" :key="i">{{ t }}</li>
        </ol>
      </div>

      <div class="ana-block">
        <div class="ana-title">🚫 BP 建议</div>
        <p>{{ analysis.bpAdvice }}</p>
      </div>

      <div class="ana-block" v-if="analysis.banFallbacks && analysis.banFallbacks.length">
        <div class="ana-title">🔁 被 ban 后的替换方案</div>
        <div v-for="(f, i) in analysis.banFallbacks" :key="i" class="breakdown">{{ matchFallback(f) }}</div>
      </div>
    </div>

    <div v-if="!result" class="card empty">点击上方「自动组队 + 分析」开始组建阵容。</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const allPool = ref([]);
const banned = ref([]);
const result = ref(null);
const analysis = ref(null);
const analyzing = ref(false);

const bannedSet = computed(() => new Set(banned.value));

onMounted(async () => {
  allPool.value = await window.seer.pool.list();
});

function toggleBan(id) {
  const idx = banned.value.indexOf(id);
  if (idx >= 0) banned.value.splice(idx, 1);
  else banned.value.push(id);
  analysis.value = null;
}

function resetBans() {
  banned.value = [];
  analysis.value = null;
}

async function reCalc() {
  analyzing.value = true;
  try {
    const r = await window.seer.pvp.recalc(banned.value);
    result.value = r;
    analysis.value = null;
  } finally {
    analyzing.value = false;
  }
}

async function runAnalysis() {
  if (!result.value) return;
  analyzing.value = true;
  try {
    analysis.value = await window.seer.pvp.analyze(result.value.main, {
      bans: banned.value,
      meta: []
    });
  } finally {
    analyzing.value = false;
  }
}

function roleIcon(role) {
  return { tank: '🛡', support: '✨', control: '🌀', output: '⚔', bench: '🎽' }[role] || '•';
}
function roleName(role) {
  return { tank: '坦克', support: '辅助', control: '控制', output: '输出', bench: '替补' }[role] || role;
}
function matchFallback(f) {
  return typeof f === 'string' ? f : (f.from + ' → ' + f.to + (f.reason ? '（' + f.reason + '）' : ''));
}
</script>

<style scoped>
.ctl-title { font-size: 15px; font-weight: 700; }
.ban-list { display: flex; flex-wrap: wrap; gap: 8px; }
.ban-chip {
  padding: 5px 11px;
  border-radius: 8px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.ban-chip:hover { border-color: var(--primary); }
.ban-chip.banned {
  background: rgba(255, 90, 110, 0.15);
  border-color: var(--danger);
  color: var(--danger);
}
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.slot {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
}
.slot-role {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.role-ico { font-size: 16px; }
.slot-name { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.bench { margin-top: 12px; font-size: 13px; }
.ana-block { margin-bottom: 18px; }
.ana-title { font-size: 14px; font-weight: 700; color: var(--primary-2); margin-bottom: 6px; }
.ana-block p, .ana-block ol, .ana-block li { line-height: 1.7; }
.breakdown { font-size: 13px; line-height: 1.7; margin-bottom: 4px; }
.empty { padding: 40px; text-align: center; color: var(--text-dim); }
</style>