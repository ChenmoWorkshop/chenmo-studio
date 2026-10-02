# 创作工坊 · Chenmo Studio

**一个单文件的个人创作工作台：待办 / 灵感 / 内容 / 复盘，数据存腾讯云开发 CloudBase，多设备自动同步，带完整账号体系。**

**A single-file personal workbench — tasks, ideas, content and reviews in one page, with a real account system, cloud sync via Tencent CloudBase, zero build step.**

[![在线体验](https://img.shields.io/badge/在线体验-立即打开-brightgreen)](https://chenmo-studio.app.workbuddy.host/)
![前端](https://img.shields.io/badge/前端-单文件%20index.html-blue)
![构建](https://img.shields.io/badge/构建-零构建-lightgrey)
![后端](https://img.shields.io/badge/后端-腾讯云%20CloudBase-orange)
![账号](https://img.shields.io/badge/账号-注册登录%20%2B%20数据隔离-success)
![许可](https://img.shields.io/badge/license-MIT-green)

> 整个前端就是**一个 `index.html`**：没有框架、没有 npm、没有打包、没有构建步骤。双击能开，扔到任何静态托管也能跑。
> 后端是**一个云函数 + 三个数据集合**，免费额度对个人使用绰绰有余。

---

## 目录

- [这是什么](#这是什么)
- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [自部署指南](#自部署指南)
- [二次创作：配套技能包](#二次创作配套技能包)
- [目录结构](#目录结构)
- [微信小程序（已接云端）](#微信小程序已接云端)
- [管理后台（admin/）](#管理后台admin)
- [管理后台（admin/）](#管理后台admin)
- [成本与续期](#成本与续期)
- [安全说明](#安全说明)
- [踩坑记录](#踩坑记录)
- [更新日志](CHANGELOG.md)

## 这是什么

一个给自己用的工作台。它把日常创作里最常打交道的四件事收在了一个页面里，并且解决了一个小工具最容易忽略的问题——**换台设备内容就没了**。

所以它的数据不在浏览器里，而在云端：手机加进主屏幕、电脑开浏览器，看到的是同一份内容。再加上一套账号体系，它就从「一个人的本地小工具」变成了「可以给别人用的在线产品」——每个人有自己的账号、自己的工作台名称和头像，数据互不可见。

适合这些人：需要轻量个人管理工具的创作者、想找一个**可读可改的单文件全栈示例**来学 CloudBase 的开发者、以及想把「单文件页面 + Serverless 后端」这套做法复制到自己项目上的人。

## 功能特性

**四大模块**

| 模块 | 用途 |
|---|---|
| 待办 | 带优先级的任务清单，勾选完成、拖动排序 |
| 灵感 | 随手记下来的想法，不打断思路 |
| 内容 | 创作内容的进度管理 |
| 复盘 | 定期回顾与总结 |

**账号体系**（完整自研，不依赖 CloudBase 内置登录）

- 注册 / 登录 / 退出，账号规则同微信号：6–20 位、字母开头，只能含字母、数字、下划线、中划线
- 密码用 `scrypt` 加随机盐派生，不存明文；比对走恒定时间算法
- **密保邮箱 + 自助找回密码**：绑定邮箱后，忘记密码可用邮箱验证码自助重置（免费 SMTP 发信，不依赖短信）；重置后全部旧登录态失效
- **微信扫码登录（网页版）**：网页显示配对二维码，小程序「网页登录授权」扫码/输码确认后免密进入——官方网站应用扫码登录需企业资质，此处用小程序当授权钥匙自建实现
- 登录下发 90 天 token，二次打开自动免登录
- **数据按账号隔离**：每个账号只查得到自己的内容
- 可自定义工作台名称、副标题与头像（图片本地压缩到 256×256 再上传）
- **游客体验模式**：无需注册即可浏览示例数据，但改动不写入云端

**每日名言**

- 内置 162 条中外哲学家词库（中方 72 条 / 西方 90 条）
- 每天 10 条，**中方 5 条与西方 5 条交替**出现
- 每 2.4 小时按时段自动轮换一条，午夜自动换新的一天
- 点一下切换下一条，点满 10 次精确回到当天第一条

**其他**

- PWA：可添加到主屏幕，像原生 App 一样打开
- 断网时保存失败会明确提示且不丢内容，恢复后自动重试
- 浏览器本地**只存登录 token 和主题偏好**，业务数据一条不落地

## 技术架构

```
浏览器  index.html（单文件 · 原生 JS · 无构建）
   │
   │  ① 账号门：注册 / 登录 → 拿回 token
   │  ② 业务读写：POST JSON（自动带上 token）
   ▼
云函数 chenmo-api（Node.js + @cloudbase/node-sdk · 管理员权限 · 函数侧下发 CORS）
   │
   │  校验 token → 解析出 uid → 只读写该 uid 的数据
   ▼
CloudBase 文档数据库
   ├── workbench_state   业务数据，_id = <uid>__<key>
   ├── chenmo_users      账号，_id = 账号名（小写，天然唯一）
   ├── chenmo_sessions   登录会话，_id = token，有效期 90 天
   ├── chenmo_wxbind     微信绑定关系，_id = openid
   └── chenmo_verify     邮箱验证码（只存 sha256 哈希），_id = 用途__账号
```

**为什么用云函数代理，而不是前端直连 JS SDK？**

这是本项目最关键的一个架构决定，原因是两条硬限制：体验版 CloudBase 环境无法添加自定义安全域名；而 CloudBase 的测试域名在浏览器里直接导航时会触发微信风控提示页。把页面托管在别处、让云函数在云端用管理员权限读写数据库，两个问题一起解决。

**云函数的接口划分**

| 无需登录 | 需要 token |
|---|---|
| `ping` 健康检查 | `loadAll` 读取当前账号全部数据 |
| `getDayQuotes` / `getQuote` 每日名言 | `save` 保存某个模块 |
| `register` / `login` 换 token | `importAll` 批量导入 |
| `sendEmailCode`（reset）找回密码发码 | `sendEmailCode`（bind）绑定邮箱发码 |
| `resetPassword` 凭邮箱验证码重置密码 | `bindEmail` 绑定/换绑密保邮箱 |
| `pairCreate` 网页配对码 / `pairPoll` 轮询换 token | `pairConfirm` 小程序确认网页登录授权 |
| | `me` 校验登录态 / `logout` 退出 / `updateProfile` 改资料 |

鉴权失败统一返回 **HTTP 200 + `{ok:false, needAuth:true}`**，而不是 401——跨域场景下前端读不到 401 响应体的语义。

## 自部署指南

想跑在自己的环境里，照做即可。全程大约十分钟，不需要写一行新代码。

### 1. 创建 CloudBase 环境

登录 [腾讯云开发控制台](https://tcb.cloud.tencent.com/dev)，创建环境（**上海地域**、云数据库类型）。

免费体验版有效期 6 个月、每月 3000 资源点，本项目个人使用实测约 30–60 点/月。

### 2. 创建三个集合并设置权限

在数据库里创建：`workbench_state`、`chenmo_users`、`chenmo_sessions`。

**三个集合的权限都设为「仅管理端可读写」。**

> 这一点和早期版本不同：加了账号体系之后，**所有数据库读写都经过云函数**（管理员权限），前端不再直连数据库。
> 所以集合对外可以完全关闭读写——既满足跨设备同步，又不会让数据暴露在公网。
> 如果沿用老的「读写全开」规则，等于把数据库挂在公网上，请务必改掉。

### 3. 部署云函数

```bash
cd functions/chenmo-api
npm install
```

用 CloudBase CLI 部署：

```bash
npm install -g @cloudbase/cli
tcb login
tcb fn code update chenmo-api --envId <你的环境ID> --dir functions/chenmo-api
```

> **踩坑警告**：`tcb fn deploy` 可能提示部署成功，但云端代码其实没更新（空包、交互卡住等原因）。
> 遇到「部署成功但行为没变」，改用上面的 `tcb fn code update`，或用 CloudBase MCP 工具的
> `updateFunctionCode`（`functionRootPath` 指向 `functions` 目录本身）。

首次创建的函数需要在控制台开启 **HTTP 访问服务**，拿到默认域名，形如：

```
https://<环境ID>-<后缀>.ap-shanghai.app.tcloudbase.com/chenmo-api
```

### 4. 修改两处配置

**`index.html`** 脚本开头有一块配置区（约第 800 行，有注释标注）：

| 常量 | 说明 |
|---|---|
| `CB_ENV` | 你的环境 ID |
| `CB_API` | 你的云函数 HTTP 访问地址 |
| `HOME_URL` | 你部署静态页的正式地址 |
| `OLD_HOSTS` | 曾用过、需要 301 到正式地址的旧域名（没有就留空数组） |

**`functions/chenmo-api/index.js`** 中的 `ALLOW_ORIGINS`：加入你的静态页域名。

> 文件里已经写好了逻辑：所有 `*.app.workbuddy.host` 的域名一律放行，所以如果你也用这个域名托管，可以不改。

### 5. 托管静态页

`index.html` + `logo.jpeg` 扔到任意静态托管：CloudBase 静态托管、GitHub Pages、对象存储 + CDN 都可以。没有构建步骤。

### 6. 注册你的第一个账号

打开 `functions/chenmo-api/index.js`，把开关打开：

```js
const ALLOW_REGISTER = true;   // 默认是 false
```

重新部署云函数 → 在页面上注册你的账号 → **再改回 `false` 并重新部署一次**。

**为什么默认关闭**：本仓库源码里硬编码了访问地址，环境标识是公开的。如果开放注册，任何人扫到这个地址都能批量建号，把账号表撑大、把资源点刷空——免费版超量会直接停服（不扣费，但也无法临时加钱），届时你自己也打不开。

### 7. 完成

首次打开页面时，云端无数据会自动写入空的初始结构，无需手动建数据。

## 二次创作：配套技能包

仓库里的 [`skills/`](skills/) 目录附带**两个可直接使用的 WorkBuddy 技能包**，是本项目真实走过的两条路，用来把这套做法复制到你自己的项目上。

| 技能包 | 用途 |
|---|---|
| [`workbench-cloud-sync-upgrade`](skills/workbench-cloud-sync-upgrade/SKILL.md) | 把已有项目的数据（localStorage / IndexedDB / mock JSON）迁到 CloudBase，含扫描、选型、迁移、验收全流程 |
| [`workbench-cloudbase-auth`](skills/workbench-cloudbase-auth/SKILL.md) | 给已上云的单文件工作台加注册登录、token 会话、按账号隔离数据、游客模式 |

**安装方式**——把目录复制到 WorkBuddy 技能目录即可：

```bash
cp -r skills/workbench-cloud-sync-upgrade ~/.workbuddy/skills/
cp -r skills/workbench-cloudbase-auth   ~/.workbuddy/skills/
```

**使用方式**——用大白话描述目标，技能会自动匹配：

- 「把这个项目的客户列表数据存到 CloudBase」→ 触发 `workbench-cloud-sync-upgrade`
- 「给这个工作台加注册登录，每个账号看到自己的数据」→ 触发 `workbench-cloudbase-auth`

**使用顺序不能反**：先上云（技能一），再加账号（技能二）。第二个技能强依赖第一个建好的云函数代理。

> 详细说明（含每个技能的完整流程、前置条件与设计取舍）见 [skills/README.md](skills/README.md)。

## 目录结构

```
.
├── index.html                        # 全部前端：页面 + 样式 + 逻辑（单文件）
├── logo.jpeg                         # 默认头像
├── functions/
│   └── chenmo-api/
│       ├── index.js                  # 云函数：鉴权 + 数据读写 + 名言词库
│       ├── package.json
│       └── package-lock.json
├── miniprogram/                      # 微信小程序（已接云端，与网页版同账号同数据）
├── skills/                           # 配套技能包（二次创作用）
│   ├── README.md
│   ├── workbench-cloud-sync-upgrade/SKILL.md
│   └── workbench-cloudbase-auth/SKILL.md
├── CHANGELOG.md                      # 更新日志
├── LICENSE
└── README.md
```

## 微信小程序（已接云端）

`miniprogram/` 是与网页版视觉一致的微信小程序工程，含登录绑定、工作台、灵感、进度、日历、复盘、资料共 7 个页面。**数据层已接入云端**，与网页版共用同一账号与数据：

- **微信一键登录**：云函数新增 `wxlogin` / `wxbind` / `wxunbind` 动作，小程序内通过 `wx.cloud.callFunction` 调用（微信内网通道，免合法域名、免备案域名配置）；首次登录可输入网页版账号密码完成绑定，之后免密直达
- **云端同步**：`app.js` 内置完整云端数据层——token 验活 + 全量拉取、本地脏检测增量上传、离线改动进待补队列、连接就绪后自动补传；云端未就绪时提交的改动不丢失
- **目录结构**：`config.js`（环境配置）→ `utils/cloud.js`（云调用与 token 管理）→ `utils/api.js`（语义化接口封装）→ 各页面按需调用

上线前仍需：注册小程序取得 AppID，并完成 ICP 备案（管局终审 1–20 个工作日）。

预览方式：微信开发者工具 → 导入项目 → 选择 `miniprogram/` 目录（游客 AppID 可预览界面，云端登录需填入真实 AppID）。

## 管理后台（admin/）

用户端是零构建的单文件，服务端是这个之外的第三块：**一个用 Vue 3 + Vite 构建的独立管理后台**，两者完全分离，通过同一云函数的 `admin*` 动作读写数据。

```
用户端 index.html  ──fetch──┐
                            ├──> 云函数 chenmo-api ──> CloudBase 数据库
管理后台 admin-app/ ──fetch──┘      （admin* 动作）
```

**访问**：https://chenmo-studio.app.workbuddy.host/admin-app/

| 模块 | 能力 |
|---|---|
| 数据总览 | 注册/绑邮箱/停用/内容量四项指标，近 7 天注册趋势，四模块分布，账号内容量排行 |
| 用户管理 | 搜索、封禁/解封、重置密码、强制下线、解绑邮箱、删除账号 |
| 用户详情 | 按四个模块展开任意账号的真实数据明细 |
| 运维工具 | 清理过期会话与验证码、一键登出全部管理员 |

**安全设计**：后台用**独立管理员密钥**（云函数环境变量 `ADMIN_KEY`）登录，与普通账号体系完全隔离；令牌仅 8 小时有效；未配置密钥时所有管理动作自动拒绝；删号需手输账号名确认，且会连带清除该账号全部数据。

详细的开发、构建与部署说明见 [`admin/README.md`](admin/README.md)。

## 成本与续期

- 免费体验版每月 **3000 资源点**，本项目个人使用实测约 **30–60 点/月**（占比 1–2%）
- 计费大头是**文档数据库调用**（200 点/万次），云函数调用只有 13.3 点/万次
- 按此折算，3000 点大约可以支撑 **50–100 个正常活跃用户**；要对外开放到上百人，建议升级个人版（¥19.9/月，40000 点）
- 体验版有效期 6 个月，**只能在到期前 1 个月内续期**，单次续 6 个月
- 到期后进入停服隔离期（约 15 个自然日），再不续费环境将被销毁、数据不可恢复

**请务必在腾讯云控制台配好到期提醒（短信 / 微信），或自己设个日历提醒。**

**数据备份**：数据在云端，建议定期导出——控制台 → 数据库 → `workbench_state` → 导出 JSON。

## 安全说明

这是一个**公开部署的开源项目**，所以把已知的安全边界写在明处，方便你评估后再决定要不要照搬：

- **访问地址是公开的**。环境 ID 硬编码在前端里（因为页面需要调用它），所以任何拿到代码的人都能找到你的云函数入口。
- **风险敞口主要是注册**。`loadAll` / `save` 全部要求有效 token，但 `register` 一旦开放，陌生人就能建号消耗你的额度。**这就是 `ALLOW_REGISTER` 默认关闭的原因**（见[自部署第 6 步](#6-注册你的第一个账号)）。
- **CORS 白名单不是安全边界**。函数侧的 `Origin` 校验只能拦住浏览器，`curl` 和 Postman 不受限制。真正的防护是 token 校验，不是 CORS。
- **密码是安全的**：`scrypt` 加 16 字节随机盐派生 32 字节密钥，比对走 `timingSafeEqual`，数据库里没有明文，源码里也没有。
- **token 是唯一凭据**。90 天有效期，存浏览器 localStorage，没有刷新机制；退出登录会吊销服务端会话。
- **头像存在数据库里**（256×256 JPEG 的 base64，约 25 KB/人）。个人规模无所谓，上万用户时应该改走云存储、数据库只存 URL。

如果公开部署给你自己的真实数据用，建议至少做一件事：**保持 `ALLOW_REGISTER = false`，只在需要开号时临时打开。**

## 踩坑记录

都是实际撞过、花时间才定位到的，记下来省你一次：

1. **`tcb fn deploy` 报成功但代码没更新** —— 改用 `tcb fn code update`，或用 MCP 的 `updateFunctionCode`。
2. **CDN 边缘缓存让你看到旧版本** —— 静态页发布后 CDN 可能仍返回旧 HTML。用带 `?v=xxx` 的地址验证源站，并提醒用户 `Ctrl+F5` 强刷。页内 `<!-- build 时间戳 -->` 标记可用来确认线上版本。
3. **数据隔离要改的是 `loadAll`** —— 加了账号之后，`loadAll` 必须从「整表查询后按 key 映射」改成「按 `uid` 过滤查询」，否则会把**所有账号的数据混在一起**返回。
4. **`doc(id).get()` 在文档不存在时会抛错**，要包一层 try/catch 返回 null，不然注册时的查重逻辑会误判。
5. **老数据迁移不能用「第一个注册的人继承」** —— 必须用账号白名单，否则陌生人抢先注册就把数据拿走了。
6. **前端暴露 `ME`**：`localStorage` 里绝对不能存密码和业务数据，只存 token。

## 关键词

<details>
<summary>搜索索引 / Search keywords（点击展开）</summary>

个人工作台 · 个人仪表盘 · 待办清单 · 任务管理 · 灵感记录 · 内容管理 · 复盘 · 每日名言 · 单文件应用 · 零构建 · 原生 JavaScript · 云同步 · 多设备同步 · 账号体系 · 注册登录 · 数据隔离 · 游客模式 · 免费部署 · 自部署 · 腾讯云开发 · 云函数 · 文档数据库 · PWA · 可离线 · 开源工作台

personal workbench · personal dashboard · productivity app · task manager · todo app · notes app · idea capture · content planner · daily quotes · single-file app · single HTML file · zero build · no framework · vanilla JavaScript · cloud sync · multi-device sync · user authentication · register login · session token · per-user data isolation · guest mode · serverless · Tencent CloudBase · cloud function · document database · PWA · self-hosted · open source

</details>

## License

[MIT](LICENSE) —— 随便用，随便改。
