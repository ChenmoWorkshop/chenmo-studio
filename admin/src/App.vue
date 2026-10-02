<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './api'

const route = useRoute()
const router = useRouter()
const isLogin = computed(() => route.path === '/login')

const nav = [
  { to: '/', label: '数据总览', icon: '◲' },
  { to: '/users', label: '用户管理', icon: '☰' },
  { to: '/ops', label: '运维工具', icon: '⚙' }
]

function logout() {
  api.logout()
  router.push('/login')
}
</script>

<template>
  <!-- 登录页独占整屏，不套侧边栏 -->
  <router-view v-if="isLogin" />

  <div class="shell" v-else>
    <aside class="side">
      <div class="brand">
        <img src="./assets/logo.jpeg" alt="Logo" class="logo" />
        <div>
          <div class="brand-name">创作工坊</div>
          <div class="brand-sub">管理后台</div>
        </div>
      </div>
      <nav>
        <router-link v-for="n in nav" :key="n.to" :to="n.to" class="nav-item" active-class="on">
          <span class="ico">{{ n.icon }}</span>{{ n.label }}
        </router-link>
      </nav>
      <div class="side-foot">
        <button class="btn sm block" @click="logout">退出登录</button>
        <div class="tip">会话 8 小时后自动失效</div>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell { display: flex; height: 100%; }
.side {
  width: 196px; flex: none; background: var(--bg-soft);
  border-right: 1px solid var(--line); display: flex; flex-direction: column;
  padding: 16px 12px;
}
.brand { display: flex; align-items: center; gap: 9px; padding: 4px 6px 18px; }
.logo { width: 30px; height: 30px; border-radius: 8px; }
.brand-name { font-weight: 600; font-size: 14px; }
.brand-sub { font-size: 11px; color: var(--muted); }
nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.nav-item {
  padding: 8px 10px; border-radius: 8px; color: var(--muted);
  font-size: 13px; display: flex; align-items: center; gap: 8px;
  transition: background .15s, color .15s;
}
.nav-item:hover { background: var(--panel); color: var(--ink); }
.nav-item.on { background: var(--panel-2); color: var(--ink); font-weight: 500; }
.nav-item .ico { font-size: 13px; width: 15px; text-align: center; }
.side-foot { border-top: 1px solid var(--line); padding-top: 12px; }
.side-foot .tip { font-size: 11px; color: var(--muted); margin-top: 7px; text-align: center; }
.main { flex: 1; overflow: auto; padding: 20px 24px; }

@media (max-width: 720px) {
  .shell { flex-direction: column; }
  .side { width: 100%; flex-direction: row; align-items: center; gap: 10px; padding: 10px; }
  .brand { padding: 0; }
  nav { flex-direction: row; gap: 4px; }
  .nav-item { padding: 6px 9px; font-size: 12px; }
  .side-foot { border: none; padding: 0; margin-left: auto; }
  .side-foot .tip { display: none; }
  .main { padding: 14px; }
}
</style>
