<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const scan = ref(null)
const loading = ref(true)
const err = ref('')
const msg = ref('')
const busy = ref('')

async function loadScan() {
  loading.value = true; err.value = ''
  try { scan.value = await api.ops('scan') }
  catch (e) { err.value = e.message }
  loading.value = false
}

async function run(op, label) {
  busy.value = op; err.value = ''; msg.value = ''
  try {
    const r = await api.ops(op)
    msg.value = r.msg || (label + '完成')
    if (r.logout) { api.logout(); setTimeout(() => router.push('/login'), 800); return }
    await loadScan()
  } catch (e) { err.value = e.message }
  busy.value = ''
}

onMounted(loadScan)
</script>

<template>
  <div>
    <div class="hd">
      <h2>运维工具</h2>
      <button class="btn sm" @click="loadScan" :disabled="loading">
        <span v-if="loading"><i class="spin"></i> 扫描中</span><span v-else>重新扫描</span>
      </button>
    </div>

    <div class="msg" v-if="err">{{ err }}</div>
    <div class="msg ok" v-if="msg">{{ msg }}</div>

    <div class="grid" v-if="scan">
      <div class="panel">
        <div class="panel-title">登录会话</div>
        <div class="rowline stat-line">
          <div class="num big">{{ scan.sessions.total }}</div>
          <div class="muted">个有效会话，其中 <b class="warn">{{ scan.sessions.expired }}</b> 个已过期</div>
        </div>
        <button class="btn block" style="margin-top: 12px;" :disabled="busy || !scan.sessions.expired" @click="run('cleanSessions', '清理过期会话')">
          <span v-if="busy === 'cleanSessions'"><i class="spin"></i> 清理中…</span>
          <span v-else>清理过期会话</span>
        </button>
        <div class="tip">过期会话占库但不再可用，清理可略微回收存储空间。</div>
      </div>

      <div class="panel">
        <div class="panel-title">验证码记录</div>
        <div class="rowline stat-line">
          <div class="num big">{{ scan.verify.total }}</div>
          <div class="muted">条记录，其中 <b class="warn">{{ scan.verify.expired }}</b> 条已过期</div>
        </div>
        <button class="btn block" style="margin-top: 12px;" :disabled="busy || !scan.verify.expired" @click="run('cleanVerify', '清理过期验证码')">
          <span v-if="busy === 'cleanVerify'"><i class="spin"></i> 清理中…</span>
          <span v-else>清理过期验证码</span>
        </button>
        <div class="tip">邮箱验证码用完即应失效，清理的是已超时未使用的。</div>
      </div>

      <div class="panel">
        <div class="panel-title">管理员会话</div>
        <div class="rowline stat-line">
          <div class="num big">{{ scan.adminSessions }}</div>
          <div class="muted">个管理员登录态（含当前这个）</div>
        </div>
        <button class="btn danger block" style="margin-top: 12px;" :disabled="busy" @click="run('cleanAdminSessions', '登出全部管理员')">
          <span v-if="busy === 'cleanAdminSessions'"><i class="spin"></i> 处理中…</span>
          <span v-else>全部登出</span>
        </button>
        <div class="tip">换设备或怀疑密钥泄露时用，执行后所有后台登录（包括本机）都会掉线。</div>
      </div>
    </div>
    <div class="empty" v-else-if="!loading">扫描失败</div>
  </div>
</template>

<style scoped>
.hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.hd h2 { margin: 0; font-size: 17px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(258px, 1fr)); gap: 14px; }
.stat-line { align-items: baseline; gap: 10px; }
.num.big { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.warn { color: var(--amber); }
.tip { font-size: 11px; color: var(--muted); margin-top: 9px; line-height: 1.6; }
</style>
