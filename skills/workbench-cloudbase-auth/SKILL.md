---
name: workbench-cloudbase-auth
description: Add a real account system (register / login / session token / per-user data isolation / guest demo mode) to a single-file web workbench whose data already lives in Tencent CloudBase behind a cloud-function proxy. Use when the user wants 注册登录、账号体系、多用户、每个账号一份数据、数据按用户隔离、游客体验不保存 for a CloudBase-backed page.
agent_created: true
---

# 给 CloudBase 工作台加账号体系

适用前提：页面是单文件（index.html + 原生 JS），数据已经在 CloudBase，且读写走**云函数代理**（因为页面托管域名不在 CloudBase 安全域名白名单里，不能直连 JS SDK）。

**不要**改用 CloudBase 内置登录（邮箱/短信/微信）：短信收费、邮箱要配 SMTP、微信登录限小程序，都不适合静态页。**正解是自己写**——一个云函数 + 两个集合，半小时能跑通。

## 一、云端（云函数）

### 1. 两个新集合

用 CloudBase MCP `writeNoSqlDatabaseStructure`：

```
{"action":"createCollection","envId":"<envId>","collectionName":"chenmo_users"}
{"action":"createCollection","envId":"<envId>","collectionName":"chenmo_sessions"}
```

命名建议 `<项目前缀>_users` / `<项目前缀>_sessions`，避免和业务集合混在一起。

### 2. 密码与 token

```js
const crypto = require('crypto');
function newSalt(){ return crypto.randomBytes(16).toString('hex'); }
function hashOf(pass, salt){ return crypto.scryptSync(String(pass), salt, 32).toString('hex'); }
function safeEq(a, b){
  const A = Buffer.from(String(a||'')), B = Buffer.from(String(b||''));
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
}
```

- 用户文档：`_id` = **账号名小写**（天然唯一，不用额外查重索引），字段 `user/name/sub/avatar/salt/hash/created_at`
- 会话文档：`_id` = 32 字节随机 hex token，字段 `uid/exp`（建议 90 天）
- **不要在源码里留任何明文密码**，演示期内置账号也要在部署前删掉

### 3. 动作划分

| 公开 | 需 token |
|---|---|
| `ping`、静态资源类（如取每日名言） | `loadAll` `save` `importAll` `updateProfile` |
| `register` `login`（发 token） | `me` `logout` |

统一入口写法：

```js
async function authUser(db, token){
  if (!token) return null;
  const s = await getDoc(db, SESS_COL, String(token));
  if (!s || !s.uid) return null;
  if (s.exp && Date.now() > s.exp) return null;
  const u = await getUser(db, s.uid);
  return u ? { uid: s.uid, user: u } : null;
}
```

失败一律返回 **HTTP 200 + `{ok:false, needAuth:true, error:'登录已过期，请重新登录'}`**——前端据此判断"踢回账号门"，不要用 401（跨域下前端读不到语义）。

> `db.collection(c).doc(id).get()` 在文档不存在时**会抛错**，包一层 try/catch 返回 null，否则"查重"逻辑会误判。

### 4. 数据隔离（关键）

文档 `_id` 改成 **`<uid>__<key>`**，并写入 `uid` 字段：

```js
await db.collection(COL).doc(uid + '__' + key).set({ uid, key, items, updated_at });
// 读：
await db.collection(COL).where({ uid }).limit(100).get();
```

注意：`loadAll` 从"整表 get 后按 key 映射"改成"按 uid 查"，否则老代码会把**所有账号的数据混在一起**返回。

### 5. 老数据迁移（必须做，否则用户打开会觉得数据没了）

策略：**当某账号的数据为空、且该账号是"老数据的主人"时，把老文档复制一份过去；原文档保留当备份。**

```js
const LEGACY_UID = '<老数据的主人账号小写名>';
// loadAll 内：
const empty = KEYS.every(k => !out[k].length);
if (empty && uid === LEGACY_UID) {
  const legacy = await claimLegacy(db, uid);  // 读老 _id → 写 <uid>__<key>
  KEYS.forEach(k => { if (Array.isArray(legacy[k])) out[k] = legacy[k]; });
}
```

**必须用账号白名单而不是"第一个注册的人继承"**——否则陌生人抢先注册就把数据拿走了。

## 二、前端（单文件页面）

### 1. 会话

本机只存 `cwb_session = { token, user, name, sub, avatar }`（或 `{ guest:true }`），**不存密码、不存业务数据**。`api()` 里自动补 token：

```js
async function api(action, payload){
  const body = Object.assign({ action }, payload || {});
  if (!body.token && SESSION && SESSION.token) body.token = SESSION.token;
  // ... fetch ...
  if (!j.ok){ const e = new Error(j.error); if (j.needAuth) e.needAuth = true; throw e; }
  return j;
}
```

### 2. 启动闸门

把原来的 `boot()` 入口包一层 `authGate()`：有 session 先调 `me` 验活（失败回账号门）→ 再 `enterApp()` → `boot()`。`boot()` 的 catch 里判断 `err.needAuth` 就调用 `sessionExpired()`（清 session + 回账号门 + 提示），不要弹"未知错误"。

### 3. 游客模式

**让游客看内置演示数据，不要给真实数据。** 加了账号体系之后再让匿名游客读到真实内容，等于鉴权白做。

```js
if (_guest){ applyMap(DEMO_SAMPLE); _cloudReady = false; syncState('saved'); /* 不调云端 */ }
```

并在 `save()` 最前面 `if (_guest) return;`，同步状态文案固定为「游客体验 · 改动不保存」。

### 4. 账号名规则（同微信号）

前后端都要校验：`/^[a-z][a-z0-9_-]{5,19}$/`（小写化后判断）。前端给友好提示，后端是**唯一可信**的那道（前端可绕过）。三种提示要分别给：太短/规则不符/已被注册。

## 三、验证（必做，别只看界面）

用 curl 打真实线上接口，逐条确认：

1. 无 token 调 `loadAll` → `needAuth:true`
2. 注册 → 拿到 token
3. 重复注册 → 被拒
4. 错密码 → "账号或密码不对"
5. 正确登录 → 带 token 取数 → **老数据是否迁移到位**（数量对得上）
6. `save` 一个键 → 再取，确认只有该键变化
7. 非法 token → `needAuth:true`

再用 Playwright 跑端到端（等 `#authMask` 和 `#bootMask` **都** hidden 再断言，别用 `waitForSelector('.hidden')`——隐藏元素永远不算 visible，会一直超时）：

注册 → 侧栏显示自定义头像/名称 → 改资料 → 刷新会话保持 → 退出 → 错密码 → 正确登录 → 游客模式 → 新账号数据与老账号隔离。

## 四、收尾（最容易忘）

- **删掉测试账号**：`chenmo_users` 里的 `probe*` 账号、`workbench_state` 里的 `probe*__*` 数据文档、对应会话
- **还原被测试改动的资料**（副标题之类）
- 仓库 README 里"数据对所有人开放读写"的描述此时已经**过时**，要同步更新
- 原集合权限若还是"读写全开"，现在所有读写都走云函数（管理员权限），可考虑收紧

## 五、开源 / 公开部署前（关键，别漏）

加了账号体系之后，**前端里的云函数访问地址依然是公开的**——页面必须能调它，藏不住。所以：

- `loadAll` / `save` 有 token 保护，**但 `register` 是无门槛的写入口**。任何人扫到地址就能批量建号，撑大账号表、刷空免费资源点；免费版超量是**直接停服**（不扣费、也无法临时加钱），届时作者自己也打不开。
- 解法是加一个部署级开关，**默认关闭注册**：

```js
const ALLOW_REGISTER = false;            // 源码里默认 false
// register 分支最前面：
if (!ALLOW_REGISTER) {
  return resp(200, headers, { ok: false, error: '该环境未开放自助注册（作者已关闭公开注册）' });
}
```

- 要给朋友开号时：临时改 `true` → 部署 → 对方注册完 → 改回 `false` → 再部署。**不要图省事常年开着。**
- **CORS 白名单不是安全边界**，它只拦浏览器，`curl` / Postman 不受限。真正的防护是 token 校验。
- 公开仓库前扫一遍源码：`grep -i -E "密码明文|secretkey|secretid|cwb_demo|BUILTIN"`，确认没有测试账号、演示分支、明文凭据残留。
- 换域名或换人部署时，记得 `ALLOW_ORIGINS` 要加新域名（可写成"放行某个域名后缀"以减少后续改动）。

## 常见坑

- 部署云函数用 MCP `manageFunctions(action=updateFunctionCode, functionRootPath=functions父目录)`；`tcb fn deploy` 常报成功但代码不更新
- 发布页面后 CDN 边缘缓存可能仍是旧版：用带 `?v=xxx` 的 URL 验证源站，并提醒用户强刷
- 页内 `<!-- build YYYYMMDD-HHMM -->` 版本标记若写在 `<!DOCTYPE>` **之前**，`document.documentElement.outerHTML` 里拿不到它（它在 `<html>` 之外），用它做端到端断言会假失败——用 `curl` 抓源码判断版本更可靠
- **发布网页版时，若项目根目录存在 `miniprogram/` 目录，站点发布会被识别成"小程序应用"**（返回 appId、不给分享链接、不部署网页），网页版不会更新。手法：发布前把该目录临时移出项目根（如 `mv miniprogram ../_mp_hold/`）→ 发布网页版 → 移回并确认 `git status` 干净。小程序工程放子目录不受影响，但发布动作本身要看不到它
