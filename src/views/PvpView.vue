<template>
  <div>
    <div class="page-title">PvP 对战</div>
    <div class="page-sub">
      依据精灵池、限制池与主流环境自动组建阵容；手动模拟 BP（禁选）后自动重算，可手动换将；生成打法 / 培养 / BP 分析与教学。
    </div>

    <!-- 环境与限制池管理 -->
    <div class="card" style="padding: 16px; margin-bottom: 16px">
      <div class="row" style="align-items: center; margin-bottom: 12px">
        <div class="ctl-title">环境基础</div>
        <span style="flex: 1"></span>
        <button class="btn sm" @click="saveEnv">保存环境</button>
        <button class="btn sm" @click="resetEnv">重置</button>
      </div>
      <div class="env-grid">
        <div>
          <div class="muted label">热门对战环境（当前强势/主流精灵，逐行填写）</div>
          <textarea v-model="metaText" rows="3" placeholder="每行一个，如：&#10;圣雷·布鲁&#10;混沌·灭界"></textarea>
        </div>
        <div>
          <div class="muted label">限制池 / 禁限表（版本禁用精灵，逐行填写）</div>
          <textarea v-model="restrictedText" rows="3" placeholder="每行一个，如：&#10;上古神兽·雷伊"></textarea>
        </div>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="card" style="padding: 16px; margin-bottom: 16px">
      <div class="row" style="align-items: center; margin-bottom: 12px">
        <div class="ctl-title">① 手动 Ban / 限制</div>
        <span style="flex: 1"></span>
        <button class="btn" @click="resetBans">清空禁选</button>
        <button class="btn primary" :disabled="analyzing" @click="reCalc">
          {{ analyzing ? '计算中…' : '自动组队' }}
        </button>
      </div>
      <div class="muted" style="margin-bottom: 6px; font-size: 12px">
        从精灵池点选要 ban 掉的精灵（模拟对手禁你核心，或规避当前限制环境）。限制池中的精灵默认已禁用。
      </div>
      <div class="ban-list">
        <span
          v-for="m in allPool"
          :key="m.id"
          class="ban-chip"
          :class="{ banned: bannedSet.has(m.id), restricted: isRestrictedName(m.name) }"
          :title="isRestrictedName(m.name) ? '已加入限制池' : ''"
          @click="toggleBan(m.id)"
        >
          {{ m.name }}
          <span v-if="bannedSet.has(m.id)">✕</span>
        </span>
      </div>
      <div v-if="allPool.length === 0" class="muted" style="margin-top: 8px; font-size: 12px">
        精灵池为空，请先在「精灵池」中添加精灵。
      </div>
    </div>

    <!-- 阵容结果 -->
    <div v-if="result" class="card" style="padding: 18px; margin-bottom: 16px">
      <div class="row" style="align-items: center; margin-bottom: 6px">
        <div class="ctl-title">② 推荐阵容</div>
        <span style="flex: 1"></span>
        <button class="btn primary" :disabled="analyzing" @click="runAnalysis">
          {{ analyzing ? '生成分析中…' : '生成打法 / 培养 / BP 分析' }}
        </button>
      </div>
      <div class="muted" style="font-size: 12px; margin-bottom: 12px">
        每个位置可通过候选池下拉手动换将。
      </div>

      <div class="team-grid">
        <div v-for="slot in mainSlots" :key="slot.suggestedRole" class="slot">
          <div class="slot-role">
            <span class="role-ico" :class="slot.suggestedRole">{{ roleIcon(slot.suggestedRole) }}</span>
            {{ roleName(slot.suggestedRole) }}
          </div>
          <div class="slot-name">{{ slot.name }}</div>
          <div class="slot-tags">
            <span class="tag">{{ (slot.attributes || []).join('/') }}</span>
            <span class="tag">种族{{ slot.total || '—' }}</span>
            <span class="tag">{{ slot.tier ? '评级 ' + slot.tier : '' }}</span>
          </div>
          <select class="swap-select" :value="slot.id" @change="swap(slot.suggestedRole, $event.target.value)">
            <option :value="slot.id">保持 {{ slot.name }}</option>
            <option v-for="c in candidates" :key="c.id" :value="c.id">{{ c.name }}（种族{{ c.total || '—' }}）</option>
          </select>
        </div>
      </div>

      <div v-if="result.bench.length" class="bench">
        <span class="muted">替补：</span>
        <span v-for="b in result.bench" :key="b.id" class="tag">{{ b.name }}</span>
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
          <strong>{{ b.name }}</strong>（{{ b.rough || '常规' }} / {{ fmtRoles(b.roles) }}）{{ b.notes || '' }}
        </div>
      </div>

      <div class="ana-block" v-if="analysis.cultivation && analysis.cultivation.length">
        <div class="ana-title">🌱 培养思路</div>
        <div v-for="c in analysis.cultivation" :key="c.name" class="breakdown">
          <strong>{{ c.name }}</strong>：{{ c.advice }}
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

      <div class="ana-block" v-if="analysis.bpAdvice">
        <div class="ana-title">🚫 BP 建议</div>
        <template v-if="typeof analysis.bpAdvice === 'object'">
          <div class="bp-line"><span class="bp-tag ban">优先 Ban</span>{{ analysis.bpAdvice.priorityBan }}</div>
          <div class="bp-line"><span class="bp-tag pick">优先 Pick</span>{{ analysis.bpAdvice.firstPick }}</div>
        </template>
        <p v-else>{{ analysis.bpAdvice }}</p>
      </div>

      <div class="ana-block" v-if="analysis.banFallbacks && analysis.banFallbacks.length">
        <div class="ana-title">🔁 被 ban 后的替换方案</div>
        <div v-for="(f, i) in analysis.banFallbacks" :key="i" class="breakdown">{{ matchFallback(f) }}</div>
      </div>
    </div>

    <div v-if="!result" class="card empty">点击上方「自动组队」开始组建阵容（需先在精灵池添加精灵）。</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const allPool = ref([]);
const banned = ref([]);
const result = ref(null);
const analysis = ref(null);
const analyzing = ref(false);
const restricted = ref([]); // 限制池 [{name, remark}]
const restrictedText = ref('');
const metaText = ref('');

const bannedSet = computed(() => new Set(banned.value));
const restrictedSet = computed(() => new Set(restricted.value.map((r) => r.name)));
const candidates = computed(() => (result.value ? result.value.candidates : []));
const mainSlots = computed(() => (result.value ? result.value.main : []));

async function refreshPool() {
  allPool.value = await window.seer.pool.list();
}

async function loadEnv() {
  restricted.value = await window.seer.pvp.getRestricted();
  const meta = await window.seer.pvp.getMeta();
  restrictedText.value = restricted.value.map((r) => r.name).join('\n');
  metaText.value = (meta || []).join('\n');
}

onMounted(async () => {
  await Promise.all([refreshPool(), loadEnv()]);
});

function isRestrictedName(name) {
  return restrictedSet.value.has(name);
}

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

// 手动换将：把某位置的精灵替换为候选池精灵
async function swap(role, newId) {
  if (!newId) return;
  const newMon = candidates.value.find((c) => c.id === newId);
  const slot = result.value.main.find((m) => m.suggestedRole === role);
  if (!newMon || !slot) return;
  // 更新主力位置；把被换下的放回候选
  const old = { ...slot, id: slot.id };
  slot.id = newMon.id;
  slot.name = newMon.name;
  slot.attributes = newMon.attributes;
  slot.total = newMon.total;
  slot.tier = newMon.tier;
  // 更新候选：去掉新选用项，加回被换下的
  result.value.candidates = result.value.candidates
    .filter((c) => c.id !== newMon.id)
    .concat(old);
  analysis.value = null;
}

async function runAnalysis() {
  if (!result.value) return;
  analyzing.value = true;
  try {
    analysis.value = await window.seer.pvp.analyze(result.value.main, {
      bans: banned.value,
      meta: metaText.value.split('\n').filter((s) => s.trim())
    });
  } finally {
    analyzing.value = false;
  }
}

async function saveEnv() {
  const list = restrictedText.value.split('\n').map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
  await window.seer.pvp.setRestricted(list);
  await window.seer.pvp.setMeta(metaText.value.split('\n').map((s) => s.trim()).filter(Boolean));
  restricted.value = list;
  analysis.value = null;
  result.value = null;
  await refreshPool();
}

function resetEnv() {
  restrictedText.value = '';
  metaText.value = '';
}

function roleIcon(role) {
  return { tank: '🛡', support: '✨', control: '🌀', output: '⚔', bench: '🎽' }[role] || '•';
}
function roleName(role) {
  return { tank: '坦克位', support: '辅助位', control: '控制位', output: '输出位', bench: '替补' }[role] || role;
}
function fmtRoles(roles) {
  if (!roles) return '综合';
  return Array.isArray(roles) ? roles.join('、') : roles;
}
function matchFallback(f) {
  return typeof f === 'string' ? f : (f.from + ' → ' + f.to + (f.reason ? '（' + f.reason + '）' : ''));
}
</script>

<style scoped>
.ctl-title { font-size: 15px; font-weight: 700; }
.label { font-size: 12px; margin-bottom: 6px; }
.env-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.env-grid textarea { resize: vertical; }
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
.ban-chip.restricted {
  border-style: dashed;
  border-color: var(--warn);
  color: var(--warn);
}
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
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
.slot-tags { margin-bottom: 10px; }
.swap-select { font-size: 12px; }
.bench { margin-top: 12px; font-size: 13px; }
.ana-block { margin-bottom: 18px; }
.ana-title { font-size: 14px; font-weight: 700; color: var(--primary-2); margin-bottom: 6px; }
.ana-block p, .ana-block ol, .ana-block li { line-height: 1.7; }
.breakdown { font-size: 13px; line-height: 1.7; margin-bottom: 4px; }
.bp-line { margin-bottom: 6px; display: flex; align-items: center; gap: 10px; }
.bp-tag {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}
.bp-tag.ban { background: rgba(255, 90, 110, 0.15); color: var(--danger); border: 1px solid var(--danger); }
.bp-tag.pick { background: rgba(25, 211, 166, 0.15); color: var(--accent); border: 1px solid var(--accent); }
.empty { padding: 40px; text-align: center; color: var(--text-dim); }
@media (max-width: 760px) { .env-grid { grid-template-columns: 1fr; } }
</style>