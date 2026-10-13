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

    <!-- 攻略列表（概要卡片） -->
    <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))">
      <div v-for="rec in records" :key="rec.id" class="card pve-card" @click="openDetail(rec)">
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
        <div class="mechanism" v-if="rec.mechanism">{{ truncate(rec.mechanism) }}</div>
        <div class="summary-strategy" v-if="rec.strategy && rec.strategy.length">
          <div class="label">打法要点</div>
          <div class="s-item" v-for="(s, i) in rec.strategy.slice(0, 2)" :key="i">• {{ truncate(s, 60) }}</div>
          <div v-if="rec.strategy.length > 2" class="muted more">… 共 {{ rec.strategy.length }} 步</div>
        </div>
        <div class="foot">
          <span class="recs" v-if="rec.recommended && rec.recommended.length">
            <span class="badge">推荐 {{ rec.recommended.length }} 精灵</span>
          </span>
          <span style="flex: 1"></span>
          <button class="btn sm primary" @click.stop="openDetail(rec)">查看详情</button>
        </div>
      </div>
    </div>

    <div v-if="records.length === 0" class="card empty">
      尚无攻略。输入关卡/新精灵名点击「抓取 + AI 整理」，或粘贴原文交由 AI 生成。
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detail" class="modal-mask" @click.self="closeDetail">
      <div class="modal card detail">
        <div class="modal-head">
          <div class="modal-title">
            {{ detail.title }}
            <span class="badge" :class="detail.trusted ? 'ok' : 'no'">
              {{ detail.trusted ? '可信' : '不可信' }}
            </span>
          </div>
          <button class="btn sm" @click="closeDetail">✕ 关闭</button>
        </div>

        <div class="detail-body">
        <div class="meta">
          <span class="badge score">信任分 {{ detail.trustScore ?? '—' }}</span>
          <span class="badge">发布 {{ fmtDate(detail.publishedAt) }}</span>
          <span v-for="a in detail.attributes" :key="a" class="tag">{{ a }}</span>
        </div>

        <div class="sec" v-if="detail.mechanism">
          <div class="sec-title">🎯 关卡机制</div>
          <p>{{ detail.mechanism }}</p>
        </div>

        <div class="sec" v-if="detail.strategy && detail.strategy.length">
          <div class="sec-title">⚔ 打法步骤</div>
          <ol class="strategy">
            <li v-for="(s, i) in detail.strategy" :key="i">{{ s }}</li>
          </ol>
        </div>

        <div class="sec" v-if="detail.requirements && detail.requirements.length">
          <div class="sec-title">🔒 硬性需求</div>
          <table class="req-table">
            <tr v-for="(r, i) in detail.requirements" :key="i">
              <td class="req-name">{{ r.name || '——' }}</td>
              <td class="req-total">种族 ≥ {{ r.total ?? '?' }}</td>
              <td class="req-status" :class="reqStatus(r).cls">{{ reqStatus(r).text }}</td>
            </tr>
          </table>
        </div>

        <div class="sec" v-if="detail.recommended && detail.recommended.length">
          <div class="sec-title">💡 推荐精灵与配置</div>
          <div class="rec-card" v-for="(r, i) in detail.recommended" :key="i">
            <div class="rec-name">{{ r.name || '未命名' }}</div>
            <div class="rec-reason">{{ r.reason || '推荐原因待补充' }}</div>
            <div class="rec-config" v-if="r.config">{{ r.config }}</div>
            <span v-if="poolHas(r.name)" class="tag own">✓ 已拥有</span>
            <span v-else class="tag miss">✗ 未拥有</span>
          </div>
        </div>

        <div class="sec" v-if="detail.sources && detail.sources.length">
          <div class="sec-title">🔗 来源</div>
          <div v-for="(s, i) in detail.sources" :key="i" class="src">
            <a v-if="s.startsWith('http')" :href="s" target="_blank">{{ s }}</a>
            <span v-else class="muted">{{ s === 'manual' ? '手动录入' : s }}</span>
          </div>
        </div>

        <div class="sec" v-if="detail.matchResult">
          <div class="sec-title">🧩 精灵池匹配</div>
          <div class="match-result" :class="{ bad: !detail.matchResult.achievable }">
            <div class="label">
              {{ detail.matchResult.achievable ? '✅ 可用精灵池完成' : '⚠ 需要补齐' }}
            </div>
            <div v-for="g in detail.matchResult.gaps" :key="g.name" class="gap">
              <strong>{{ g.name }}</strong>：{{ g.reason }}
              <span v-if="g.suggestion" class="gap-suggest">→ {{ g.suggestion }}</span>
            </div>
          </div>
        </div>
      </div>

        <div class="modal-foot">
          <span style="flex: 1"></span>
          <button class="btn sm" @click="editRecord(detail)">编辑</button>
          <button class="btn sm danger" @click="del(detail)">删除</button>
          <button class="btn sm primary" @click="matchRecord(detail)">匹配精灵池</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const records = ref([]);
const target = ref('');
const rawText = ref('');
const loading = ref(false);
const newRecord = ref(null);
const errorMsg = ref('');
const detail = ref(null);
const detailLock = ref(false); // 避免卡片点击与弹窗内按钮冲突

const pool = ref([]);

async function init() {
  records.value = await window.seer.pve.list();
  pool.value = await window.seer.pool.list();
}
onMounted(init);
async function refresh() {
  records.value = await window.seer.pve.list();
  const cur = detail.value;
  if (cur) {
    detail.value = records.value.find((r) => r.id === cur.id) || null;
  }
}

function truncate(s, n = 40) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function openDetail(rec) {
  if (!rec.matchResult) rec.matchResult = null;
  detail.value = { ...rec };
}

function closeDetail() {
  detail.value = null;
}

function poolHas(name) {
  if (!name) return false;
  return pool.value.some((p) => p.name.includes(name) || name.includes(p.name));
}

function reqStatus(r) {
  const name = r.name;
  const total = r.total;
  if (!name) return { text: '未知', cls: 'sk' };
  const held = pool.value.find((p) => p.name.includes(name) || name.includes(p.name));
  if (held && total && held.total && held.total >= total) return { text: '✓ 达标', cls: 'ok' };
  if (held) return { text: '✗ 练度不足', cls: 'warn' };
  return { text: '✗ 未拥有', cls: 'miss' };
}

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
    detail.value = null;
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
.pve-card { padding: 16px; cursor: pointer; transition: border-color .15s; }
.pve-card:hover { border-color: var(--primary); }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.title { font-size: 15px; font-weight: 700; }
.meta { margin: 8px 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.badge.ok { border-color: var(--accent); color: var(--accent); }
.badge.no { border-color: var(--danger); color: var(--danger); }
.badge.score { color: var(--warn); }
.mechanism { color: var(--text-dim); font-size: 12px; margin-bottom: 8px; }
.summary-strategy .label { font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
.s-item { font-size: 12px; color: var(--text); line-height: 1.6; }
.more { font-size: 11px; margin-top: 2px; }
.foot { display: flex; gap: 6px; margin-top: 12px; align-items: center; }
.recs { font-size: 12px; }

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 16, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(3px);
}
.modal.detail {
  width: 680px;
  max-width: 94vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-title { font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.modal-foot {
  display: flex;
  gap: 6px;
  padding: 14px 20px;
  border-top: 1px solid var(--line);
}
.detail-body { overflow-y: auto; padding: 18px 20px; flex: 1; min-height: 0; }
.sec { margin-bottom: 18px; }
.sec-title { font-size: 14px; font-weight: 700; color: var(--primary-2); margin-bottom: 8px; }
.sec p { line-height: 1.7; }
.strategy { margin: 0 0 0 18px; line-height: 1.7; }
.strategy li { margin-bottom: 6px; }
.req-table { width: 100%; border-collapse: collapse; }
.req-table td { padding: 7px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
.req-name { font-weight: 600; }
.req-total { color: var(--text-dim); }
.req-status.ok { color: var(--accent); }
.req-status.warn { color: var(--warn); }
.req-status.miss { color: var(--danger); }
.req-status.sk { color: var(--text-dim); }
.rec-card {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.rec-name { font-weight: 700; margin-bottom: 4px; }
.rec-reason { font-size: 13px; margin-bottom: 4px; line-height: 1.5; }
.rec-config { font-size: 12px; color: var(--primary-2); margin-bottom: 6px; }
.tag { margin: 0 3px 0 0; }
.tag.own { color: var(--accent); border-color: var(--accent); }
.tag.miss { color: var(--danger); border-color: var(--danger); }
.src { font-size: 12px; margin-bottom: 4px; word-break: break-all; }
.src a { color: var(--primary-2); }
.match-result {
  padding: 10px;
  border-radius: 8px;
  background: rgba(25, 211, 166, 0.08);
  border: 1px solid rgba(25, 211, 166, 0.3);
  font-size: 13px;
}
.match-result.bad { background: rgba(255, 176, 32, 0.08); border-color: rgba(255, 176, 32, 0.4); }
.label { font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
.gap { margin-top: 4px; }
.gap-suggest { color: var(--accent); }
.empty { padding: 40px; text-align: center; color: var(--text-dim); }
.ok-msg { margin-top: 12px; padding: 12px; border-radius: 8px; background: rgba(25,211,166,.1); border: 1px solid rgba(25,211,166,.3); }
.err-msg { margin-top: 12px; padding: 10px; border-radius: 8px; background: rgba(255,90,110,.1); border: 1px solid rgba(255,90,110,.3); color: var(--danger); font-size: 13px; }
</style>