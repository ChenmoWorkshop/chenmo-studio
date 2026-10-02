<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'

const router = useRouter()
const list = ref([])
const kw = ref('')
const loading = ref(true)
const err = ref('')
const msg = ref('')
/* 注意：acting 保存到 Vue 的 :disabled 上时必须是布尔值。
   Vue 处理 boolean 型 DOM 属性（disabled/checked 等）时会把空字符串当成 true，
   即 acting = '' 反而会让按钮变成禁用态，所以下面统一用 !!acting 传布尔。 */
const acting = ref('')

/* 二次确认：删号不可撤销，必须手动输入账号名 */
const confirmDelete = ref(null)
const deletePhrase = ref('')

/* 重置密码弹窗（不再用 window.prompt，内嵌浏览器里会被静默拦截） */
const pwdUser = ref(null)
const newPass = ref('')

/* 每行每个按钮各自的忙碌标记，便于就地显示转圈 */
function keyOf(u, op) { return u.uid + '|' + op }

async function load() {
  loading.value = true; err.value = ''
  try { list.value = (await api.users(kw.value)).list }
  catch (e) { err.value = e.message }
  loading.value = false
}

function search() { load() }

/* 常规操作：封禁/解封/吊销会话/解绑邮箱 */
async function act(u, op, label, extra) {
  if (acting.value) return
  acting.value = keyOf(u, op); err.value = ''; msg.value = ''
  try {
    const r = await api.userAction(u.uid, op, extra)
    msg.value = label + '成功：' + (r.msg || '')
    await load()
  } catch (e) { err.value = e.message }
  acting.value = ''
}

/* 重置密码：页面内弹窗取新密码，避免 prompt 被浏览器拦截导致"点了没反应" */
function openPwd(u) {
  pwdUser.value = u; newPass.value = ''; err.value = ''
}
async function doResetPass() {
  const u = pwdUser.value
  if (!u) return
  if (String(newPass.value).length < 6) { err.value = '新密码至少 6 位'; return }
  await act(u, 'resetPass', '密码重置', { newPass: newPass.value })
  pwdUser.value = null
}

async function doDelete() {
  const u = confirmDelete.value
  if (!u) return
  if (deletePhrase.value.trim() !== u.user) { err.value = '账号名输入不一致，未执行删除'; return }
  await act(u, 'delete', '删除账号')
  confirmDelete.value = null; deletePhrase.value = ''
}

function fmt(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d)) return '—'
  const p = n => String(n).padStart(2, '0')
  return (d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

onMounted(load)
</script>

<template>
  <div>
    <div class="hd">
      <h2>用户管理 <span class="muted count" v-if="!loading">共 {{ list.length }} 人</span></h2>
      <div class="rowline">
        <input class="input search" v-model="kw" placeholder="搜索账号 / 名称 / 邮箱" @keyup.enter="search" />
        <button class="btn sm" @click="search" :disabled="loading">搜索</button>
        <button class="btn sm" @click="load" :disabled="loading">
          <span v-if="loading"><i class="spin"></i></span><span v-else>刷新</span>
        </button>
      </div>
    </div>

    <div class="msg" v-if="err">{{ err }}</div>
    <div class="msg ok" v-if="msg">{{ msg }}</div>

    <div class="panel" style="padding: 0; overflow: hidden;">
      <table v-if="list.length">
        <thead>
          <tr>
            <th>账号</th><th>工作台名称</th><th>密保邮箱</th>
            <th>注册时间</th><th>最后登录</th><th>状态</th><th style="width: 260px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.uid">
            <td>
              <router-link :to="'/users/' + u.uid" class="link"><b>{{ u.user }}</b></router-link>
              <div class="muted tiny">{{ u.uid }}</div>
            </td>
            <td>{{ u.name }}</td>
            <td>
              <span v-if="u.email" class="small">{{ u.email }}</span>
              <span v-else class="badge mute">未绑定</span>
            </td>
            <td class="muted small">{{ fmt(u.created_at) }}</td>
            <td class="muted small">{{ fmt(u.last_login) }}</td>
            <td>
              <span class="badge bad" v-if="u.banned">已停用</span>
              <span class="badge ok" v-else>正常</span>
              <div class="tiny muted" v-if="u.wxBound">已绑微信</div>
            </td>
            <td>
              <div class="ops">
                <router-link :to="'/users/' + u.uid" class="btn sm">数据</router-link>
                <button
                  class="btn sm" :disabled="!!acting"
                  @click="act(u, u.banned ? 'unban' : 'ban', u.banned ? '解封' : '封禁')">
                  <span v-if="acting === keyOf(u, 'ban') || acting === keyOf(u, 'unban')"><i class="spin"></i></span>
                  <span v-else>{{ u.banned ? '解封' : '封禁' }}</span>
                </button>
                <button class="btn sm" :disabled="!!acting" @click="openPwd(u)">
                  <span v-if="acting === keyOf(u, 'resetPass')"><i class="spin"></i></span>
                  <span v-else>改密</span>
                </button>
                <button class="btn sm" :disabled="!!acting" @click="act(u, 'revokeSessions', '吊销会话')">
                  <span v-if="acting === keyOf(u, 'revokeSessions')"><i class="spin"></i></span>
                  <span v-else>下线</span>
                </button>
                <button class="btn sm danger" :disabled="!!acting" @click="confirmDelete = u; deletePhrase = ''">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty" v-else-if="!loading">没有匹配的用户</div>
    </div>

    <!-- 删除确认弹窗 -->
    <div class="mask" v-if="confirmDelete" @click.self="confirmDelete = null">
      <div class="dlg">
        <h3>⚠️ 确认删除账号</h3>
        <p>
          即将删除 <b>{{ confirmDelete.user }}</b>（{{ confirmDelete.name }}），
          该账号的<b>全部会话、业务数据、微信绑定关系</b>都会被一并清除，且<b>不可恢复</b>。
        </p>
        <div class="field-label">请输入账号名 <b>{{ confirmDelete.user }}</b> 以确认：</div>
        <input class="input" v-model="deletePhrase" :placeholder="confirmDelete.user" />
        <div class="rowline btns">
          <button class="btn danger block" :disabled="!!acting" @click="doDelete">
            <span v-if="acting"><i class="spin"></i> 删除中…</span><span v-else>确认删除</span>
          </button>
          <button class="btn block" :disabled="!!acting" @click="confirmDelete = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 重置密码弹窗 -->
    <div class="mask" v-if="pwdUser" @click.self="pwdUser = null">
      <div class="dlg">
        <h3 class="ok-t">重置登录密码</h3>
        <p>
          为 <b>{{ pwdUser.user }}</b>（{{ pwdUser.name }}）设置新密码，
          保存后该账号的<b>全部会话会被强制下线</b>，需要用新密码重新登录。
        </p>
        <div class="field-label">新密码（至少 6 位）</div>
        <input
          class="input" type="text" v-model="newPass" placeholder="输入新密码"
          @keyup.enter="doResetPass" />
        <div class="rowline btns">
          <button class="btn primary block" :disabled="!!acting" @click="doResetPass">
            <span v-if="acting"><i class="spin"></i> 保存中…</span><span v-else>确认重置</span>
          </button>
          <button class="btn block" :disabled="!!acting" @click="pwdUser = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
.hd h2 { margin: 0; font-size: 17px; font-weight: 600; }
.count { font-size: 12px; font-weight: 400; margin-left: 5px; }
.search { width: 200px; }
.small { font-size: 12px; }
.tiny { font-size: 11px; }
.link { color: var(--green-light); }
.link:hover { text-decoration: underline; }
.ops { display: flex; gap: 4px; flex-wrap: wrap; }
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.62); display: grid; place-items: center; padding: 20px; z-index: 50; }
.dlg { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; width: 400px; max-width: 92vw; }
.dlg h3 { margin: 0 0 10px; font-size: 15px; color: var(--red); }
.dlg h3.ok-t { color: var(--green-light); }
.dlg p { font-size: 13px; line-height: 1.75; margin: 0 0 14px; }
.btns { margin-top: 14px; gap: 8px; }
.btns .btn { flex: 1; }
@media (max-width: 720px) { .search { width: 130px; } }
</style>
