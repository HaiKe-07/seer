<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <div class="mark">巅</div>
        <div>
          <h1>巅峰之战攻略助手</h1>
          <div class="sub">SEER Peak Battle</div>
        </div>
      </div>
      <nav>
        <div
          class="nav-item"
          :class="{ active: page === 'pool' }"
          @click="page = 'pool'"
        >
          <span class="ico">⚔</span> 精灵池
        </div>
        <div
          class="nav-item"
          :class="{ active: page === 'pve' }"
          @click="page = 'pve'"
        >
          <span class="ico">🗺</span> PvE 攻略
        </div>
        <div
          class="nav-item"
          :class="{ active: page === 'pvp' }"
          @click="page = 'pvp'"
        >
          <span class="ico">🏆</span> PvP 对战
        </div>
      </nav>
      <div style="flex: 1"></div>
      <div class="nav-item" :class="{ active: page === 'settings' }" @click="page = 'settings'">
        <span class="ico">⚙</span> 设置
      </div>
    </aside>

    <main class="main">
      <PoolView v-if="page === 'pool'" />
      <PveView v-else-if="page === 'pve'" />
      <PvpView v-else-if="page === 'pvp'" />
      <SettingsView v-else-if="page === 'settings'" />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PoolView from './views/PoolView.vue';
import PveView from './views/PveView.vue';
import PvpView from './views/PvpView.vue';
import SettingsView from './views/SettingsView.vue';

const page = ref('pool');
</script>