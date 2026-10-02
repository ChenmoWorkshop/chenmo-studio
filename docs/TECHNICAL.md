# 创作工坊 · 技术文档

面向要改代码的人。这里写的是接口契约、数据结构与调试方法，使用层面的说明见 [README.md](../README.md)。

---

## 1. 运行环境

| 项 | 值 |
|---|---|
| CloudBase 环境 | `chenmo-d9gcmpopbed61c597`（ap-shanghai） |
| 云函数 | `chenmo-api`，**Nodejs16.13 / 256MB / 超时 20 秒** |
| HTTP 端点 | `https://<env>-1314109349.ap-shanghai.app.tcloudbase.com/chenmo-api` |
| 主站 | https://chenmo-studio.app.workbuddy.host/ |
| 管理后台 | https://chenmo-studio.app.workbuddy.host/admin-app/ |
| 前端 | 单文件 `index.html`，零构建、零依赖框架（二维码库 `qrcode.min.js` 本地内置） |

三端（网页 / 后台 / 小程序）共用同一个云函数，靠 `action` 字段区分业务。

---

## 2. 请求与响应约定

**请求**：全部 `POST`，`Content-Type: application/json`，主体形如 `{ action: 'login', user: 'xxx', pass: 'xxx' }`。

小程序端例外：经 `wx.cloud.callFunction` 调用时，事件没有 HTTP 包装，函数会自动回退到「把 event 自身当业务参数」（见 `parseBody`）。因此**业务代码不需要区分两端**。

**响应**：**一律 HTTP 200**，业务成败放在响应体里。

```jsonc
// 成功
{ "ok": true, /* 业务字段 */ }
// 失败
{ "ok": false, "error": "给用户看的中文提示" }
```

为什么不用 401/403：跨域场景下，非 2xx 响应的响应体在浏览器里读不到，前端只能拿到一个看不懂的网络错误。把成败放进 200 的响应体，前端才能展示「登录已过期，请重新登录」这类有用信息。

**鉴权相关的两个标记字段**：

| 字段 | 含义 | 前端应做的事 |
|---|---|---|
| `needAuth` | 用户 token 无效或过期 | 清空本地 token，回到账号门 |
| `needAdminAuth` | 管理员令牌无效或过期 | 后台跳回登录页 |

**CORS**：函数侧下发 `Access-Control-Allow-Origin`。白名单在 `ALLOW_ORIGINS`，另外所有 `*.app.workbuddy.host` 子域一律放行。

> CORS 只防浏览器，拦不住 `curl`。它从来不是安全边界。

---

## 3. 数据模型

五个集合。生产环境建议全部设为**「仅管理端可读写」**（因为读写都走云函数的管理员权限）。

### `workbench_state` — 业务数据

| 字段 | 说明 |
|---|---|
| `_id` | `<uid>__<key>`，例如 `chenmo__todos` |
| `uid` | 归属账号（小写） |
| `key` | `todos` / `ideas` / `contents` / `reviews` 之一 |
| `items` | 数组，元素结构由前端决定，后端不校验 |
| `updated_at` | ISO 时间字符串 |

`KEYS = ['todos', 'ideas', 'contents', 'reviews']`，后端只接受这四个 key。

### `chenmo_users` — 账号

| 字段 | 说明 |
|---|---|
| `_id` | 小写账号名（天然唯一，兼作 uid） |
| `user` | 原始账号名（保留大小写） |
| `name` / `sub` / `avatar` | 工作台名称、副标题、头像（256×256 JPEG 的 base64 字符串） |
| `salt` / `hash` | scrypt 盐与派生密钥，**永不出网**（`publicProfile()` 会剔除） |
| `email` | 密保邮箱，出网时掩码显示 |
| `banned` | 是否被管理员停用 |
| `created_at` / `last_login` | 时间 |

### `chenmo_sessions` — 登录会话

| 字段 | 说明 |
|---|---|
| `_id` | token，48 位十六进制（`randomBytes(24)`） |
| `uid` | 归属账号；管理员令牌的 uid 是 `__admin__` |
| `exp` | 到期时间戳（毫秒）。用户 90 天，管理员 8 小时 |
| `role` | 管理员令牌带 `role: 'admin'` |

### `chenmo_wxbind` — 微信绑定

`_id` = openid，值 `{ uid, last_login }`。

### `chenmo_verify` — 验证码与限流计数

同一个集合复用三种用途，靠 `_id` 前缀区分：

| `_id` | 用途 | 关键字段 |
|---|---|---|
| `bind__<uid>` | 绑定邮箱的验证码 | `hash`（sha256）`exp` `attempts` `last_send` `sent_date` |
| `reset__<uid>` | 找回密码的验证码 | 同上 |
| `lock__<uid>` | **登录失败计数** | `fails` `locked_until` `exp` |

验证码只存哈希，明文仅在邮件里出现一次。限流计数带 `exp`，运维页的「清理过期验证码」会顺带清掉。

---

## 4. 接口契约

### 公开动作

#### `ping`
- 请求：`{}`
- 响应：`{ ok, pong: true, env, auth }`

#### `register`
- 请求：`{ user, pass, name?, sub?, avatar? }`
- 校验：账号 `/^[a-z][a-z0-9_-]{5,19}$/`（小写后匹配，6–20 位、字母开头）；密码 ≥ 6 位；账号未被占用
- 响应：`{ ok: true, token, profile }`
- 失败：「该环境未开放自助注册」「账号需 6-20 位…」「密码至少 6 位」「这个账号已被注册」

#### `login`
- 请求：`{ user, pass }`
- 流程：先查限流 → 冷却中直接拒绝 → 校验密码 → 失败记一次数 → 成功清零计数
- 成功：`{ ok: true, token, profile }`
- 失败：`{ ok: false, left, error: '账号或密码不对，还可以试 N 次' }`
- 触发冷却：`{ ok: false, locked: true, error: '密码错得太多了，请 10 分钟后再试' }`
- 已停用：`{ ok: false, error: '该账号已被管理员停用…' }`

#### `sendEmailCode`
- 请求：`{ purpose: 'bind' | 'reset', email? , user? }`
  - `bind` 需 token；`reset` 不需要（只需账号名，验证码发到该账号已绑定的邮箱）
- 限制：60 秒冷却、每账号每天 5 条、验证码 10 分钟有效、最多试错 5 次
- 未配置 SMTP 时返回「邮件服务未配置，请联系作者」

#### `resetPassword`
- 请求：`{ user, code, pass }`
- 成功后该账号**全部会话失效**，各端需重新登录

#### `pairCreate` / `pairPoll` / `pairConfirm`
- `pairCreate`：网页端生成 6 位配对码 + 48 位 pairId，2 分钟有效
- `pairConfirm`：小程序端用**已登录身份**确认（需登录，相当于持有人当面授权）
- `pairPoll`：网页轮询，确认后换回 token，**一次一用、用后即删**

### 需用户 token

#### `loadAll`
- 请求：`{ token }`
- 响应：`{ ok: true, data: { todos: [], ideas: [], contents: [], reviews: [] } }`
- 按 `uid` 过滤查询。**不能改成整表扫描后映射**，否则会返回所有账号的数据

#### `save`
- 请求：`{ token, key, items }`
- ⚠️ 字段名是 **`items`**，不是 `data`。`items` 必须是数组，否则返回 `items must be array`
- 语义是**整体覆盖**，不是追加

#### `deleteAccount`（v3.7）
- 请求：`{ token, pass, confirm }`
- 三重校验：有效 token → 密码正确 → `confirm` 与账号名完全一致
- 成功后清除：账号、全部会话、密保邮箱、微信绑定、四类业务数据
- 响应：`{ ok: true, msg: '账号已注销，会话 N 条、数据 N 份、微信绑定 N 条已全部清除' }`

#### `me` / `logout` / `updateProfile` / `importAll`
- 见源码，语义直观。`updateProfile` 接受 `{ name, sub, avatar }` 的部分更新

#### `wxlogin` / `wxbind` / `wxunbind`
- 仅小程序内可用（依赖微信透传的 openid）。在网页环境调用会返回 `needWx: true` 与引导文案

### 管理员动作

先用 `adminLogin` 换令牌，之后每个请求都带 `token`（字段名是 **`token`**，不是 `adminToken`）。

| 动作 | 请求 | 说明 |
|---|---|---|
| `adminLogin` | `{ key }` | 比对 `ADMIN_KEY`，返回 `{ ok, token, exp }`。**未配置 `ADMIN_KEY` 时永远失败** |
| `adminLogout` | `{ token }` | 吊销令牌 |
| `adminStats` | `{ token }` | 总览指标：注册数、绑邮箱数、停用数、内容总量、7 日趋势、模块分布、账号排行 |
| `adminUsers` | `{ token }` | 返回 `{ ok, list, total }`（⚠️ 字段是 `list`） |
| `adminUserDetail` | `{ token, uid }` | 单账号资料 + 四类数据明细 + 会话数 |
| `adminUserAction` | `{ token, uid, op, newPass? }` | `op` 取 `ban` / `unban` / `resetPass` / `revokeSessions` / `unbindEmail` / `delete` |
| `adminOps` | `{ token, op }` | `scan`（扫描过期数据）/ `cleanSessions` / `cleanVerify` / `cleanAdminSessions` |

---

## 5. 鉴权与限流

**用户 token**：登录时由 `issueToken()` 生成 48 位随机串，写入 `chenmo_sessions`（90 天）。每次带 token 的请求都查一次集合并比对 `exp`。前端存在 localStorage 的 `cwb_session`。

**管理员令牌**：同样的机制，但 uid 固定为 `__admin__`、`role: 'admin'`、TTL 8 小时。`ADMIN_KEY` 未配置时 `authAdmin()` 恒返回 null，即所有管理动作不可用（fail-closed）。

**登录限流**（v3.7）：

```
同一 uid 连续失败 → loginGuardFail() 累加 fails
  fails >= 5  → 写入 locked_until = now + 10min
冷却期内      → loginGuardCheck() 直接拒绝，连密码都不比对
登录成功      → loginGuardClear() 清零
```

计数落在 `chenmo_verify` 的 `lock__<uid>` 文档，带 `exp`，随过期验证码一起被清理。

---

## 6. 环境变量

| 变量 | 作用 | 缺失时的行为 |
|---|---|---|
| `ADMIN_KEY` | 管理后台密钥 | 管理后台完全不可用（fail-closed），不影响用户端 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | 发信（验证码） | 找回密码/绑邮箱提示「邮件服务未配置」，其余功能正常 |
| `WX_OPENID` | 小程序身份相关 | 小程序端取不到 openid 时返回 `needWx` |

密钥只存环境变量，**不要写进代码或仓库**。

---

## 7. 前端结构（index.html）

单文件，约 2446 行，按以下顺序组织：

| 区段 | 内容 |
|---|---|
| `<head>` | meta / PWA manifest 引用 / 内联 `<style>`（CSS 变量定义四套主题） |
| `<body>` 上半 | 静态 DOM：账号门、资料弹窗、侧栏、各模块视图、 toast、二维码库 |
| `<body>` 下半 | 全部 JS（配置区 → 工具 → API 封装 → 各模块渲染 → 事件绑定 → 启动） |

**配置区**（约第 970 行）：`CB_ENV` / `CB_API` / `HOME_URL` / `OLD_HOSTS`。

**本机存储只有两个键**：`cwb_session`（token 与资料快照）、`cwb_theme`（主题偏好）。业务数据一概不落地。游客模式的 session 是 `{ guest: true, ... }`，**不含 token**，因此不会触碰云端。

**启动时序**：显示 boot mask → `ping` 验活 → 有 token 则 `me` 验活 → `loadAll` → 进入工作台。连接就绪前的改动进本地队列，就绪后自动补传（这条修复了「手机上第一次填写复盘会丢失」的问题）。

---

## 8. 管理后台（admin/）

Vue 3 + Vite，`outDir` 指向 `../admin-app`，随主站一起发布为子路径。

```
admin/src/
├── api.js         统一请求封装：自动带管理员 token，失效时抛 needAdminAuth
├── router.js      路由：/login /（总览） /users /users/:uid /ops
├── App.vue        外壳与导航
└── views/         Login / Dashboard / Users / UserDetail / Ops
```

构建：`cd admin && npx vite build`。

> **Vue 布尔属性陷阱（本项目踩过两次）**：`:disabled="someRef"` 在该 ref 为**空字符串**时，Vue 会把它判为 `true`，按钮从第一帧就是禁用态，表现为「点了完全没反应」。v3.6.1 修了用户管理页，v3.6.2 修了运维页。一律写成 `:disabled="!!someRef"`。

---

## 9. 微信小程序（miniprogram/）

```
config.js          环境配置
utils/cloud.js     wx.cloud 初始化、token 存取、call 封装
utils/api.js       语义化接口（wxLogin / loadAll / save / pairConfirm …）
app.js             云端数据层：验活 → 全量拉取 → 脏检测增量上传 → 离线队列补传
pages/             8 个页面
```

调用链：`wx.cloud.callFunction({ name: 'chenmo-api', data: {...} })`，走微信内网，不需要配置合法域名，也不受备案域名限制。

**关键点**：微信传进来的 event 是裸对象，没有 `body`。云函数的 `parseBody` 已兼容两种情况。

---

## 10. 本地开发与调试

**CORS 限制**：函数白名单里只有 `localhost:8899` / `127.0.0.1:8899`。要在别的端口调试，二选一：

1. 把你的端口加进 `ALLOW_ORIGINS` 并重新部署（仅开发环境建议）
2. **推荐**：起本地静态服务 + 用 Playwright 的 `page.route` 拦截 `/chenmo-api` 请求，由 Node 侧 `fetch` 转发到真实云端并补上 `Access-Control-Allow-Origin: *`。这样不改代码、不改云端配置，且测的是最新本地文件。

**测试脚本**（`.workbuddy/tools/`，未纳入 git）：

```bash
NODE_PATH="<node workspace>/node_modules" node .workbuddy/tools/api-test.js      # 接口与安全（18 项）
NODE_PATH="<node workspace>/node_modules" node .workbuddy/tools/ui-smoke.js      # UI 冒烟（20 项）
NODE_PATH="<node workspace>/node_modules" node .workbuddy/tools/func-test.js     # 注册专项
node .workbuddy/tools/stress-test.js                                             # 并发压测
node .workbuddy/tools/code-scan.js                                               # DOM 引用一致性
node .workbuddy/tools/audit-static.js                                            # 后台+小程序静态审计
```

> 压测脚本打的是**生产环境**，请求量请自行控制。测试账号请以 `qa` 开头，方便用后台接口批量清理。

**确认线上版本**：`index.html` 顶部有 `<!-- build YYYYMMDD-HHMM -->` 注释；后台看 `admin-app/index.html` 引用的 bundle 文件名。CDN 可能返回旧版，用 `?v=xxx` 的 URL 验证源站，并提醒用户 `Ctrl+F5`。

---

## 11. 常见改动指南

| 想做的事 | 改哪里 |
|---|---|
| 加一个业务模块 | 云函数 `KEYS` 数组 + 前端对应视图与导航 + 后台 `TABS` |
| 加一个用户端动作 | 云函数加 `if (action === 'xxx')` 分支（需要登录的先 `authUser`）+ 前端 `api()` 调用 |
| 加一个管理动作 | 云函数 `admin*` 段落 + 后台 `api.js` 与对应视图 |
| 改限流阈值 | `LOGIN_MAX_FAILS` / `LOGIN_LOCK_MS` |
| 改会话有效期 | `SESSION_TTL`；管理员是 `ADMIN_TTL` |
| 换主题 | `index.html` 里的 `body[data-theme="..."]` CSS 变量块 |
| 改名言词库 | 云函数内的 quotes 数组（162 条，中 72 / 西 90） |

**改动后必做的三件事**：语法检查 → 部署云函数（`--force`）→ 跑一遍 `api-test.js` 与 `ui-smoke.js`。

---

## 12. 已知边界

- 头像以 base64 存在数据库（约 25 KB/人），量大时应改走云存储
- token 无刷新机制，90 天固定过期，到期需重新登录
- 未开通匿名登录，因此「已登录用户跨账号读取」这一项未实测，仅代码层确认按 uid 隔离
- 运营者（持 `ADMIN_KEY`）在技术上可读任意用户数据，已在隐私政策中如实写明
