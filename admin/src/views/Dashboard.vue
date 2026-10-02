<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'

const loading = ref(true)
const err = ref('')
const s = ref(null)

const KEY_LABEL = { todos: '待办', ideas: '灵感', contents: '内容进度', reviews: '复盘' }

/* 近 7 天注册趋势：纯 SVG 折线+柱状，不引第三方图表库 */
const maxTrend = computed(() => {
  if (!s.value) return 1
  return Math.max(1, ...s.value.users.trend.map(d => d.n))
})
const contentTotal = computed(() => s.value ? s.value.content.total : 0)
const byKey = computed(() => s.value ? s.value.content.byKey : {})

function barWidth(n) {
  return (n / maxTrend.value * 100).toFixed(1) + '%'
}
function dayLabel(d) { return d.slice(5).replace('-', '/') }

async function load() {
  loading.value = true; err.value = ''
  try { s.value = await api.stats() }
  catch (e) { err.value = e.message }
  loading.value = false
}
onMounted(load)
</script>

<template>
  <div>
    <div class="hd">
      <h2>数据总览</h2>
      <button class="btn sm" @click="load" :disabled="loading">
        <span v-if="loading"><i class="spin"></i> 加载中</span><span v-else>刷新</span>
      </button>
    </div>

    <div class="msg" v-if="err">{{ err }}</div>
    <div v-if="loading && !s" class="empty">正在读取云端数据…</div>

    <template v-if="s">
      <!-- 用户指标 -->
      <div class="cards">
        <div class="card stat">
          <div class="k">注册用户</div>
          <div class="v">{{ s.users.total }}</div>
          <div class="d">本周 +{{ s.users.week }} · 今日 +{{ s.users.today }}</div>
        </div>
        <div class="card stat">
          <div class="k">绑定邮箱</div>
          <div class="v green">{{ s.users.withEmail }}</div>
          <div class="d">可自助找回密码</div>
        </div>
        <div class="card stat">
          <div class="k">停用账号</div>
          <div class="v" :class="{ red: s.users.banned > 0 }">{{ s.users.banned }}</div>
          <div class="d">已被管理员封禁</div>
        </div>
        <div class="card stat">
          <div class="k">内容总量</div>
          <div class="v blue">{{ contentTotal }}</div>
          <div class="d">四类记录总和</div>
        </div>
      </div>

      <div class="grid">
        <!-- 注册趋势 -->
        <div class="panel">
          <div class="panel-title">近 7 天注册趋势</div>
          <div class="trend">
            <div class="bar-row" v-for="d in s.users.trend" :key="d.date">
              <div class="bar-label muted">{{ dayLabel(d.date) }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: barWidth(d.n) }"></div>
              </div>
              <div class="bar-num">{{ d.n }}</div>
            </div>
          </div>
        </div>

        <!-- 内容分布 -->
        <div class="panel">
          <div class="panel-title">各模块内容分布</div>
          <div class="dist">
            <div class="dist-row" v-for="(n, k) in byKey" :key="k">
              <div class="dist-name">{{ KEY_LABEL[k] || k }}</div>
              <div class="dist-track">
                <div
                  class="dist-fill"
                  :style="{ width: (contentTotal ? (n / contentTotal * 100) : 0) + '%', background: k === 'contents' ? 'var(--blue)' : 'var(--green)' }"></div>
              </div>
              <div class="dist-num">{{ n }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 内容量排行 -->
      <div class="panel mt">
        <div class="panel-title">账号内容量排行</div>
        <table v-if="s.content.top.length">
          <thead>
            <tr><th>归属</th><th class="num">待办</th><th class="num">灵感</th><th class="num">内容</th><th class="num">复盘</th><th class="num">合计</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in s.content.top" :key="u.uid">
              <td>
                <router-link :to="'/users/' + u.uid" class="link" v-if="u.uid !== 'legacy'">{{ u.uid }}</router-link>
                <span v-else class="muted">legacy（加账号前的老数据）</span>
              </td>
              <td class="num">{{ u.todos }}</td>
              <td class="num">{{ u.ideas }}</td>
              <td class="num">{{ u.contents }}</td>
              <td class="num">{{ u.reviews }}</td>
              <td class="num"><b>{{ u.total }}</b></td>
            </tr>
          </tbody>
        </table>
        <div class="empty" v-else>还没有内容数据</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.hd h2 { margin: 0; font-size: 17px; font-weight: 600; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 11px; margin-bottom: 14px; }
.card.stat { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
.card .k { font-size: 12px; color: var(--muted); }
.card .v { font-size: 27px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
.card .v.green { color: var(--green-light); }
.card .v.blue { color: #7fb2d8; }
.card .v.red { color: var(--red); }
.card .d { font-size: 11px; color: var(--muted); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.mt { margin-top: 14px; }
.link { color: var(--green-light); }
.link:hover { text-decoration: underline; }

.trend { display: flex; flex-direction: column; gap: 7px; margin-top: 4px; }
.bar-row { display: flex; align-items: center; gap: 9px; font-size: 12px; }
.bar-label { width: 38px; flex: none; font-size: 11px; }
.bar-track { flex: 1; height: 15px; background: var(--bg-soft); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--green), var(--green-light)); border-radius: 4px; min-width: 2px; }
.bar-num { width: 20px; text-align: right; font-variant-numeric: tabular-nums; }

.dist { display: flex; flex-direction: column; gap: 9px; margin-top: 4px; }
.dist-row { display: flex; align-items: center; gap: 9px; font-size: 12px; }
.dist-name { width: 52px; flex: none; }
.dist-track { flex: 1; height: 15px; background: var(--bg-soft); border-radius: 4px; overflow: hidden; }
.dist-fill { height: 100%; border-radius: 4px; min-width: 2px; }
.dist-num { width: 30px; text-align: right; font-variant-numeric: tabular-nums; }

@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
