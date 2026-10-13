<template>
  <div>
    <div class="page-title">PvE 攻略</div>
    <div class="page-sub">
      整理每周新精灵与关卡打法，多来源抓取 + AI 清洗整理。攻略时间越近越可信，超过 5 年视为不可信不采用。
    </div>

    <!-- 抓取/新建攻略 -->
    <div class="card" style="padding: 16px; margin-bottom: 16px">
      <div class="row" style="align-items: center; margin-bottom: 10px">
        <input
          v-model="target"
          placeholder="关卡/新精灵名称，如：上古神兽·雷伊"
          style="max-width: 320px"
        />
        <input
          v-model="rawText"
          placeholder="（可选）粘贴你抓到的原文，交给 AI 整理"
          style="max-width: 340px"
        />
        <button class="btn primary" :disabled="loading" @click="fetchAndTidy">
          {{ loading ? '整理中…' : '抓取 + AI 整理' }}
        </button>
      </div>
      <div class="muted" style="font-size: 12px">
        注：真实站点结构易变。若自动抓取无结果，请粘贴原文后由 AI 整理，或手动录入攻略。
      </div>
      <div v-if="newRecord" class="ok-msg">
        已生成攻略：<strong>{{ newRecord.title }}</strong>　
        <button class="btn sm" @click="saveNew">保存到攻略库</button>
        <button class="btn sm" @click="newRecord = null">丢弃</button>
      </div>
      <div v-if="errorMsg" class="err-msg">{{ errorMsg }}</div>
    </div>

    <!-- 攻略列表 -->
    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))">
      <div v-for="rec in records" :key="rec.id" class="card pve-card">
        <div class="head">
          <div class="title">{{ rec.title }}</div>
          <span class="badge" :class="rec.trusted ? 'ok' : 'no'">
            {{ rec.trusted ? '可信' : '不可信' }}
          </span>
        </div>
        <div class="meta">
          <span v-for="a in rec.attributes" :key="a" class="tag">{{ a }}</span>
          <span class="badge score">{{ rec.trustScore ?? '—' }}分</span>
          <span class="badge">{{ fmtDate(rec.publishedAt) }}</span>
        </div>
        <div class="mechanism" v-if="rec.mechanism">机制：{{ rec.mechanism }}</div>
        <ol class="strategy" v-if="rec.strategy && rec.strategy.length">
          <li v-for="(s, i) in rec.strategy" :key="i">{{ s }}</li>
        </ol>
        <div class="recs" v-if="rec.recommended && rec.recommended.length">
          <div class="label">推荐精灵</div>
          <div v-for="r in rec.recommended" :key="r.name" class="rec-item">
            <strong>{{ r.name }}</strong>　{{ r.reason || '' }}
          </div>
        </div>
        <div class="foot">
          <button class="btn sm primary" @click="matchRecord(rec)">匹配精灵池</button>
          <button class="btn sm" @click="editRecord(rec)">编辑</button>
          <button class="btn sm danger" @click="del(rec)">删除</button>
        </div>
        <div v-if="rec.matchResult" class="match-result" :class="{ bad: !rec.matchResult.achievable }">
          <div class="label">
            {{ rec.matchResult.achievable ? '✅ 可用精灵池完成' : '⚠ 需要补齐' }}
          </div>
          <div v-if="rec.matchResult.gaps.length">
            <div v-for="g in rec.matchResult.gaps" :key="g.name" class="gap">{{ g.reason }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const records = ref([]);
const target = ref('');
const rawText = ref('');
const loading = ref(false);
const newRecord = ref(null);
const errorMsg = ref('');
const editing = ref(null);

async function refresh() {
  records.value = await window.seer.pve.list();
}
onMounted(refresh);

async function fetchAndTidy() {
  if (!target.value.trim()) return;
  loading.value = true;
  errorMsg.value = '';
  newRecord.value = null;
  try {
    newRecord.value = await window.seer.pve.fetchAndTidy({
      target: target.value.trim(),
      keywords: [target.value.trim()],
      rawText: rawText.value
    });
  } catch (e) {
    errorMsg.value = e.message || '抓取/整理失败';
  } finally {
    loading.value = false;
  }
}

async function saveNew() {
  if (!newRecord.value) return;
  await window.seer.pve.save(newRecord.value);
  newRecord.value = null;
  target.value = '';
  rawText.value = '';
  refresh();
}

async function editRecord(rec) {
  const text = prompt('编辑攻略内容（机制/步骤以换行分隔）', rec.mechanism + '\n' + (rec.strategy || []).join('\n'));
  if (text === null) return;
  const lines = text.split('\n').filter((l) => l.trim());
  await window.seer.pve.save({
    ...rec,
    mechanism: lines[0],
    strategy: lines.slice(1)
  });
  refresh();
}

async function del(rec) {
  if (confirm('确认删除攻略《' + rec.title + '》？')) {
    await window.seer.pve.remove(rec.id);
    refresh();
  }
}

async function matchRecord(rec) {
  rec.matchResult = await window.seer.pve.match(rec);
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
</script>

<style scoped>
.pve-card { padding: 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.title { font-size: 15px; font-weight: 700; }
.meta { margin: 8px 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.badge.ok { border-color: var(--accent); color: var(--accent); }
.badge.no { border-color: var(--danger); color: var(--danger); }
.badge.score { color: var(--warn); }
.mechanism { color: var(--text-dim); font-size: 12px; margin-bottom: 8px; }
.strategy { margin: 0 0 10px 18px; color: var(--text); font-size: 13px; }
.strategy li { margin-bottom: 4px; }
.recs .label, .label { font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
.rec-item { font-size: 13px; margin-bottom: 4px; }
.foot { display: flex; gap: 6px; margin-top: 12px; }
.match-result {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(25, 211, 166, 0.08);
  border: 1px solid rgba(25, 211, 166, 0.3);
  font-size: 13px;
}
.match-result.bad {
  background: rgba(255, 176, 32, 0.08);
  border-color: rgba(255, 176, 32, 0.4);
}
.gap { margin-top: 4px; }
.ok-msg {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(25, 211, 166, 0.1);
  border: 1px solid rgba(25, 211, 166, 0.3);
}
.err-msg {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 90, 110, 0.1);
  border: 1px solid rgba(255, 90, 110, 0.3);
  color: var(--danger);
  font-size: 13px;
}
</style>