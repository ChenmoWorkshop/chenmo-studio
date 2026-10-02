<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

const route = useRoute()
const router = useRouter()
const uid = route.params.uid
const loading = ref(true)
const err = ref('')
const profile = ref(null)
const data = ref({})
const sessions = ref(0)
const tab = ref(route.query.tab || 'todos')

const TABS = [
  { k: 'todos', label: '待办' },
  { k: 'ideas', label: '灵感' },
  { k: 'contents', label: '内容进度' },
  { k: 'reviews', label: '复盘' }
]

async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.userDetail(uid)
    profile.value = r.profile
    data.value = r.data
    sessions.value = r.sessions
  } catch (e) { err.value = e.message }
  loading.value = false
}

/* 不同模块的字段差异很大，统一抽取"标题 + 若干键值"再渲染 */
function fieldsOf(item) {
  const keys = ['done', 'status', 'priority', 'stage', 'tag', 'date', 'created', 'updated', 'note', 'desc']
  const out = []
  keys.forEach(k => {
    const v = item[k]
    if (v === undefined || v === null || v === '') return
    if (typeof v === 'boolean') { out.push([k, v ? '是' : '否']); return }
    if (typeof v === 'object') return
    out.push([k, String(v)])
  })
  return out
}
function titleOf(item) {
  return item.title || item.text || item.name || item.content || (item.id ? ('记录 ' + String(item.id).slice(0, 8)) : '未命名记录')
}

onMounted(load)
</script>

<template>
  <div>
    <div class="hd">
      <div class="rowline">
        <button class="btn sm" @click="router.push('/users')">← 返回</button>
        <h2 v-if="profile">{{ profile.name }} <span class="muted">@{{ profile.user }}</span></h2>
      </div>
      <button class="btn sm" @click="load" :disabled="loading">
        <span v-if="loading"><i class="spin"></i></span><span v-else>刷新</span>
      </button>
    </div>

    <div class="msg" v-if="err">{{ err }}</div>

    <template v-if="profile">
      <div class="cards">
        <div class="card"><div class="k">账号标识</div><div class="v small">{{ profile.uid }}</div></div>
        <div class="card"><div class="k">密保邮箱</div><div class="v small">{{ profile.email || '未绑定' }}</div></div>
        <div class="card"><div class="k">状态</div><div class="v small">
          <span class="badge bad" v-if="profile.banned">已停用</span>
          <span class="badge ok" v-else>正常</span>
        </div></div>
        <div class="card"><div class="k">活跃会话</div><div class="v small">{{ sessions }}</div></div>
        <div class="card"><div class="k">微信绑定</div><div class="v small">
          <span class="badge ok" v-if="profile.wxBound">已绑定</span>
          <span class="badge mute" v-else>未绑定</span>
        </div></div>
      </div>

      <div class="panel mt">
        <div class="tabs">
          <button
            v-for="t in TABS" :key="t.k"
            class="tab" :class="{ on: tab === t.k }" @click="tab = t.k">
            {{ t.label }} <span class="cnt">{{ (data[t.k] || []).length }}</span>
          </button>
        </div>

        <div v-if="(data[tab] || []).length" class="items">
          <div class="item" v-for="(it, i) in data[tab]" :key="i">
            <div class="item-hd">
              <span class="idx">{{ i + 1 }}</span>
              <span class="title">{{ titleOf(it) }}</span>
            </div>
            <div class="fields" v-if="fieldsOf(it).length">
              <span class="badge mute" v-for="([k, v], j) in fieldsOf(it)" :key="j">{{ k }}: {{ v }}</span>
            </div>
          </div>
        </div>
        <div class="empty" v-else>该模块暂无数据</div>
      </div>
    </template>
    <div class="empty" v-else-if="!loading">用户不存在或已被删除</div>
  </div>
</template>

<style scoped>
.hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
.hd h2 { margin: 0; font-size: 16px; font-weight: 600; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 11px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; }
.card .k { font-size: 11px; color: var(--muted); }
.card .v { margin-top: 2px; word-break: break-all; }
.card .v.small { font-size: 13px; }
.mt { margin-top: 14px; }
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--line); margin-bottom: 14px; flex-wrap: wrap; }
.tab {
  border: none; background: transparent; color: var(--muted); font-size: 13px;
  padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ink); }
.tab.on { color: var(--ink); border-bottom-color: var(--green); font-weight: 500; }
.tab .cnt { font-size: 11px; color: var(--muted); margin-left: 3px; }
.items { display: flex; flex-direction: column; gap: 8px; }
.item { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 9px; padding: 10px 12px; }
.item-hd { display: flex; gap: 9px; align-items: baseline; }
.idx { color: var(--muted); font-size: 11px; flex: none; }
.title { font-size: 13px; word-break: break-word; }
.fields { margin-top: 6px; display: flex; gap: 5px; flex-wrap: wrap; }
</style>
