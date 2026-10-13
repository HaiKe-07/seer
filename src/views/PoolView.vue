<template>
  <div>
    <div class="page-title">精灵池</div>
    <div class="page-sub">管理你的账号精灵信息与配置，支持手动/批量录入、培育与属性匹配。</div>

    <!-- 工具栏 -->
    <div class="card" style="padding: 14px; margin-bottom: 16px">
      <div class="row" style="align-items: center">
        <input
          v-model="keyword"
          placeholder="按名称 / 属性搜索…"
          style="max-width: 260px"
          @input="refresh"
        />
        <span style="flex: 1"></span>
        <button class="btn" @click="openImport">批量导入</button>
        <button class="btn primary" @click="openAdd">＋ 新增精灵</button>
      </div>
    </div>

    <!-- 精灵列表 -->
    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
      <div v-for="mon in filtered" :key="mon.id" class="card mon-card">
        <div class="mon-head">
          <div class="mon-name">{{ mon.name }}</div>
          <div class="mon-tier" :class="'t' + (mon.tier || 'D')">{{ mon.tier || 'D' }}</div>
        </div>
        <div class="mon-meta">
          <span class="tag">{{ (mon.attributes || []).join('/') || '未知属性' }}</span>
          <span class="tag">种族 {{ mon.total || '—' }}</span>
          <span class="tag">练度 Lv{{ mon.level || '—' }}</span>
        </div>
        <div class="mon-desc">{{ mon.note || '暂无备注' }}</div>
        <div class="mon-foot">
          <span class="badge">战力 {{ mon.power || 0 }}</span>
          <span class="badge" :class="{ 'warn': mon.suggestRole }">{{ mon.suggestRole || '未有定位' }}</span>
          <span style="flex: 1"></span>
          <button class="btn sm" @click="edit(mon)">编辑</button>
          <button class="btn sm danger" @click="remove(mon)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="card empty">
      还没有精灵，点击「新增精灵」或「批量导入」开始。
    </div>

    <!-- 弹窗：新增/编辑 -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal card" style="width: 520px; max-width: 92vw">
        <div class="modal-title">{{ form.id ? '编辑精灵' : '新增精灵' }}</div>
        <div class="form-grid">
          <label>名称
            <input v-model="form.name" placeholder="如：圣雷·布鲁" />
          </label>
          <label>属性（逗号分隔）
            <input v-model="form.attrText" placeholder="如：电, 龙" />
          </label>
          <label>种族值
            <input v-model.number="form.total" type="number" placeholder="如：730" />
          </label>
          <label>等级
            <input v-model.number="form.level" type="number" placeholder="如：100" />
          </label>
          <label>个体
            <input v-model.number="form.iv" type="number" placeholder="如：31" />
          </label>
          <label>定位（坦克/输出/辅助/控制）
            <input v-model="form.suggestRole" placeholder="如：输出" />
          </label>
          <label style="grid-column: 1 / -1">备注 / 技能配置
            <input v-model="form.note" placeholder="配置方案、技能组…" />
          </label>
        </div>
        <div class="row" style="justify-content: flex-end; margin-top: 16px">
          <button class="btn" @click="showModal = false">取消</button>
          <button class="btn primary" @click="save">保存</button>
        </div>
      </div>
    </div>

    <!-- 批量导入弹窗 -->
    <div v-if="showImport" class="modal-mask" @click.self="showImport = false">
      <div class="modal card" style="width: 560px; max-width: 92vw">
        <div class="modal-title">批量导入精灵</div>
        <div class="muted" style="margin-bottom: 10px">
          从游戏页面复制的一批精灵信息（每行一条：名称，属性，种族值），或粘贴 JSON 数组。
        </div>
        <textarea
          v-model="importText"
          rows="10"
          placeholder="名称,属性,种族值,等级&#10;圣雷·布鲁,电,730,100&#10;或直接粘贴 JSON 数组"
        ></textarea>
        <div class="row" style="justify-content: flex-end; margin-top: 12px">
          <button class="btn" @click="showImport = false">取消</button>
          <button class="btn primary" @click="doImport">导入</button>
        </div>
        <div v-if="importResult" class="ok-msg">导入成功：{{ importResult.added.join('、') || '（空）' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const pool = ref([]);
const keyword = ref('');
const showModal = ref(false);
const showImport = ref(false);
const importText = ref('');
const importResult = ref(null);
const form = ref(defaultForm());

function defaultForm() {
  return { id: '', name: '', attrText: '', total: undefined, level: undefined, iv: undefined, suggestRole: '', note: '' };
}

async function refresh() {
  pool.value = await window.seer.pool.list();
}

onMounted(refresh);

const filtered = computed(() => {
  const q = keyword.value.toLowerCase();
  if (!q) return pool.value;
  return pool.value.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.attributes || []).join(',').toLowerCase().includes(q)
  );
});

function openAdd() {
  form.value = defaultForm();
  showModal.value = true;
}

function edit(mon) {
  form.value = {
    id: mon.id,
    name: mon.name,
    attrText: (mon.attributes || []).join(','),
    total: mon.total,
    level: mon.level,
    iv: mon.iv,
    suggestRole: mon.suggestRole || '',
    note: mon.note || ''
  };
  showModal.value = true;
}

async function save() {
  const mon = {
    ...form.value,
    attributes: form.value.attrText.split(/[,，\s]+/).filter(Boolean),
    name: form.value.name.trim()
  };
  if (!mon.name) return;
  await window.seer.pool.save(mon);
  showModal.value = false;
  refresh();
}

async function remove(mon) {
  if (confirm('确认删除 ' + mon.name + ' 吗？')) {
    await window.seer.pool.remove(mon.id);
    refresh();
  }
}

function openImport() {
  importText.value = '';
  importResult.value = null;
  showImport.value = true;
}

async function doImport() {
  const text = importText.value.trim();
  if (!text) return;
  let items = [];
  try {
    const parsed = JSON.parse(text);
    items = Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    // CSV 格式
    items = text.split('\n').map((line) => {
      const parts = line.split(/[,，]/).map((s) => s.trim());
      return {
        name: parts[0],
        attributes: parts[1] ? [parts[1]] : undefined,
        total: parts[2] ? Number(parts[2]) : undefined,
        level: parts[3] ? Number(parts[3]) : undefined
      };
    }).filter((x) => x.name);
  }
  importResult.value = await window.seer.pool.import(items);
  refresh();
}
</script>

<style scoped>
.mon-card {
  padding: 14px;
}
.mon-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.mon-name {
  font-size: 16px;
  font-weight: 700;
}
.mon-tier {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #fff;
}
.tS { background: #ff5a6e; }
.tA { background: #ff8a2a; }
.tB { background: #ffc22a; }
.tC { background: #19d3a6; }
.tD { background: #5a6b8a; }
.mon-meta { margin-bottom: 8px; }
.mon-desc {
  color: var(--text-dim);
  font-size: 12px;
  margin-bottom: 10px;
  min-height: 18px;
}
.mon-foot {
  display: flex;
  align-items: center;
  gap: 6px;
}
.badge.warn {
  border-color: var(--primary);
  color: var(--primary-2);
}
.empty {
  padding: 40px;
  text-align: center;
  color: var(--text-dim);
}
</style>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 16, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(3px);
}
.modal {
  padding: 20px;
}
.modal-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 14px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.form-grid label {
  font-size: 12px;
  color: var(--text-dim);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ok-msg {
  margin-top: 12px;
  color: var(--accent);
  font-size: 13px;
}
</style>