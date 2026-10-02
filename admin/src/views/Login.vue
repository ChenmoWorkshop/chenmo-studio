<script setup>
/* 管理员登录：用独立密钥换取 8 小时令牌，与普通用户账号完全隔离 */
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const route = useRoute()
const key = ref('')
const busy = ref(false)
const err = ref('')

async function submit() {
  if (busy.value) return
  if (!key.value.trim()) { err.value = '请输入管理员密钥'; return }
  busy.value = true; err.value = ''
  try {
    await api.login(key.value.trim())
    router.push(route.query.from || '/')
  } catch (e) {
    err.value = e.message || '登录失败'
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <div class="card">
      <img src="../assets/logo.jpeg" class="logo" alt="创作工坊" />
      <h1>创作工坊 · 管理后台</h1>
      <p class="sub">请输入管理员密钥进入（与用户账号无关）</p>

      <label class="field-label">管理员密钥</label>
      <input
        class="input" type="password" v-model="key"
        placeholder="ADMIN_KEY" autocomplete="current-password"
        @keyup.enter="submit" />

      <button class="btn primary block go" :disabled="busy" @click="submit">
        <span v-if="busy"><i class="spin"></i> 验证中…</span>
        <span v-else>进入后台</span>
      </button>

      <div class="msg" v-if="err">{{ err }}</div>

      <div class="foot">
        密钥保存在云端环境变量，不出现在本仓库任何文件中；<br />
        连续输错不会锁定，但每次登录仅 8 小时有效。
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { height: 100%; display: grid; place-items: center; padding: 20px; }
.card {
  width: 340px; max-width: 92vw; background: var(--panel);
  border: 1px solid var(--line); border-radius: 16px; padding: 28px 24px 20px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, .4);
}
.logo { width: 46px; height: 46px; border-radius: 12px; display: block; margin: 0 auto 12px; }
h1 { text-align: center; font-size: 17px; margin: 0 0 5px; font-weight: 600; }
.sub { text-align: center; color: var(--muted); font-size: 12px; margin: 0 0 20px; }
.go { margin-top: 14px; padding: 10px; font-size: 14px; }
.foot { margin-top: 16px; font-size: 11px; color: var(--muted); text-align: center; line-height: 1.7; }
</style>
