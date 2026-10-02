/* 管理后台 → 云函数 chenmo-api 的统一调用层
   前后端分离的关键约定：所有管理动作都必须带管理员令牌，
   令牌由 adminLogin 用独立密钥换取，与普通用户账号完全隔离。 */
const API = 'https://chenmo-d9gcmpopbed61c597-1314109349.ap-shanghai.app.tcloudbase.com/chenmo-api'

const TOKEN_KEY = 'cm_admin_token'
const EXP_KEY = 'cm_admin_exp'

export function getToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY) || ''
    const exp = Number(localStorage.getItem(EXP_KEY) || 0)
    if (!t) return ''
    if (exp && Date.now() > exp) { clearToken(); return '' }
    return t
  } catch (e) { return '' }
}
export function setToken(t, exp) {
  try {
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(EXP_KEY, String(exp || Date.now() + 8 * 3600 * 1000))
  } catch (e) {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(EXP_KEY) } catch (e) {}
}

/* 统一请求：失败时抛出中文错误，页面直接展示 */
export async function call(action, payload = {}, opts = {}) {
  const body = Object.assign({}, payload)
  if (!opts.noAuth) {
    const t = getToken()
    if (!t) { clearToken(); throw new Error('登录已失效，请重新登录') }
    body.token = t
  }
  let res
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action }, body))
    })
  } catch (e) {
    throw new Error('连不上云端服务，请检查网络')
  }
  let json
  try { json = await res.json() } catch (e) { throw new Error('云端返回异常（HTTP ' + res.status + '）') }
  if (json.needAdminAuth) { clearToken(); throw new Error(json.error || '登录已失效，请重新登录') }
  if (!json.ok) throw new Error(json.error || '操作失败')
  return json
}

/* 语义化封装 */
export const api = {
  login: key => call('adminLogin', { key }, { noAuth: true }).then(r => {
    setToken(r.token, r.exp); return r
  }),
  logout: () => { try { call('adminLogout') } catch (e) {} clearToken() },
  stats: () => call('adminStats'),
  users: kw => call('adminUsers', { kw: kw || '' }),
  userDetail: uid => call('adminUserDetail', { uid }),
  userAction: (uid, op, extra) => call('adminUserAction', Object.assign({ uid, op }, extra || {})),
  ops: op => call('adminOps', { op })
}
