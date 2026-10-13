<template>
  <div>
    <div class="page-title">设置</div>
    <div class="page-sub">配置 DeepSeek AI、攻略可信度阈值与抓取来源。</div>

    <div class="card section">
      <div class="sec-title">DeepSeek AI 配置</div>
      <div class="form">
        <label>API Key
          <input v-model="form.deepseekApiKey" type="password" placeholder="sk-…" />
        </label>
        <label>模型
          <select v-model="form.model">
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
          </select>
        </label>
        <label class="check">
          <input v-model="form.aiEnabled" type="checkbox" style="width: auto" />
          启用 AI 分析（攻略整理 / 阵容 / BP）
        </label>
      </div>
    </div>

    <div class="card section">
      <div class="sec-title">攻略可信度</div>
      <div class="form">
        <label>超过几年视为不可信攻略
          <input v-model.number="form.guidetrustYears" type="number" min="1" max="10" />
        </label>
        <div class="muted" style="font-size: 12px">默认 5 年，超过该年限的攻略将被标记为「不可信」，不采用。</div>
      </div>
    </div>

    <div class="card section">
      <div class="sec-title">抓取来源</div>
      <div v-for="s in form.sources" :key="s.key" class="src-row" @click.prevent.stop>
        <label class="check">
          <input v-model="s.enabled" type="checkbox" style="width: auto" />
          {{ s.name }}
        </label>
        <div v-if="s.key==='tieba'" class="host-row">
          <div class="muted" style="font-size:12px">贴吧吧名（作为攻略抓取来源，如：赛尔号）</div>
          <input
            v-model="tiebaFname"
            placeholder="例如 赛尔号"
            style="width:100%;margin-top:6px;background:#0b1220;border:1px solid #1f3050;color:#dfe7f5;padding:7px 10px;border-radius:8px;font-size:13px"
          />
        </div>
        <div v-else-if="s.key==='laoxiaoyi'" class="host-row">
          <div class="muted" style="font-size:12px">雷小伊社区精灵图鉴入口（host，逗号分隔，可留空）</div>
          <input
            v-model="form.sourceHosts.laoxiaoyi"
            placeholder="例如 bbs.tiepi.top, seer.tiepi.top"
            style="width:100%;margin-top:6px;background:#0b1220;border:1px solid #1f3050;color:#dfe7f5;padding:7px 10px;border-radius:8px;font-size:13px"
          />
        </div>
      </div>
    </div>

    <div class="row" style="margin-top: 16px">
      <button class="btn primary" @click="save">保存设置</button>
      <span v-if="saved" class="ok-msg">✓ 已保存</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const form = ref({});
const saved = ref(false);
const tiebaFname = ref('赛尔号');

onMounted(async () => {
  form.value = await window.seer.settings.get();
  tiebaFname.value = form.value.tiebaFname || '赛尔号';
  if (!form.value.sourceHosts) form.value.sourceHosts = { laoxiaoyi: '' };
});

async function save() {
  form.value.tiebaFname = tiebaFname.value;
  await window.seer.settings.set(form.value);
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
</script>

<style scoped>
.section { padding: 18px; margin-bottom: 16px; }
.sec-title { font-size: 15px; font-weight: 700; margin-bottom: 14px; color: var(--primary-2); }
.form { display: flex; flex-direction: column; gap: 14px; }
.form label { font-size: 12px; color: var(--text-dim); display: flex; flex-direction: column; gap: 6px; }
.check { flex-direction: row !important; align-items: center; gap: 8px !important; color: var(--text) !important; }
.src-row { margin-bottom: 6px; }
.ok-msg { align-self: center; color: var(--accent); }
</style>