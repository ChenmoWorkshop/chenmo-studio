# 配套技能包 · Companion Skills

本仓库自带两个 [WorkBuddy](https://www.workbuddy.cn/) **技能包（Agent Skill）**，用来把「单文件 HTML + 腾讯云 CloudBase」这套做法复用到你自己的项目上。

它们就是本项目真实走过的两条路：**先把本地数据搬上云，再给云上加一套账号体系**。不是事后补写的教程，而是当时执行时用的操作手册。

| 技能包 | 一句话用途 | 用在本项目的哪一步 |
|---|---|---|
| [`workbench-cloud-sync-upgrade`](workbench-cloud-sync-upgrade/SKILL.md) | 把已有项目里的数据（localStorage / IndexedDB / mock JSON）迁到 CloudBase | 工作台原本的数据存在浏览器里，这一步让它变成多设备同步 |
| [`workbench-cloudbase-auth`](workbench-cloudbase-auth/SKILL.md) | 给已经上云的单文件工作台加注册登录、token 会话、按账号隔离数据 | 从「一台设备一个人用」变成「多用户各自一份数据」 |

---

## 什么是技能包

技能包就是一份 `SKILL.md`——用自然语言写成的操作流程。WorkBuddy 在对话中遇到匹配的场景时会自动读取并照做。

它不包含可执行代码，也不依赖特定模型，本质是**把踩过的坑固化成流程**，这样下次不用重新踩。

## 安装

把两个目录整个复制到你的 WorkBuddy 技能目录：

```bash
# macOS / Linux
cp -r skills/workbench-cloud-sync-upgrade ~/.workbuddy/skills/
cp -r skills/workbench-cloudbase-auth   ~/.workbuddy/skills/

# Windows (PowerShell)
Copy-Item -Recurse skills\workbench-cloud-sync-upgrade $env:USERPROFILE\.workbuddy\skills\
Copy-Item -Recurse skills\workbench-cloudbase-auth   $env:USERPROFILE\.workbuddy\skills\
```

也可以直接在 WorkBuddy 里说「帮我安装本地技能包」并把路径指给它。复制完后重启 WorkBuddy 生效。

> 想放在单个项目里而不是全局生效，就复制到项目的 `.workbuddy/skills/` 目录下。

---

## 技能一：workbench-cloud-sync-upgrade —— 让数据上云

**什么时候用**：你已经有页面了，数据还在浏览器里（localStorage / IndexedDB / 写死的 JSON），想让电脑和手机看到同一份数据。

**怎么触发**——直接用大白话描述目标即可，比如：

- 「把这个项目的客户列表数据存到 CloudBase」
- 「我想让电脑和手机打开同一个工作台页面时看到同一份数据」
- 「帮我把这个页面的数据从 localStorage 改成云端」

**它会带你走的流程**（五个阶段，每步都会先问你确认）：

1. **扫描项目** —— 只读代码，输出一份「项目数据扫描表」：入口、页面、数据来源、读写位置、模块字段、现有数据层、外部依赖、风险点。这一步不改任何文件。
2. **让你选模块** —— 列出哪些模块可以上云、各自被谁依赖、迁移影响是什么，由你决定迁哪几个。**不会擅自扩大范围**。
3. **推荐数据库** —— 在文档型数据库和 MySQL 之间给出推荐并说明依据，你也可以改选。
4. **实施** —— 先备份、再收拢读写点、然后建资源跑迁移，并保留回退路径。
5. **验收** —— 逐条验证增删改查、刷新恢复、失败重试、迁移前后数据一致性。

**前置条件**：一个 CloudBase 环境；对项目有写权限（它会改代码）。

---

## 技能二：workbench-cloudbase-auth —— 加账号体系

**什么时候用**：数据已经在 CloudBase 上了，但现在谁打开页面都能读写，你想让每个用户有自己的一份数据。

**怎么触发**：

- 「给这个工作台加注册登录，每个账号看到自己的数据」
- 「加一个游客模式，能体验但不保存」
- 「数据要按用户隔离」

**它为什么自己写而不用现成方案**——这点很关键，也是这个技能包存在的理由：

> CloudBase 内置登录都不适合静态页：短信登录要收费、邮箱登录要配 SMTP、微信登录限小程序。
> 所以正解是**自己写**：一个云函数 + 两个集合，半小时能跑通。

**它会做的事**：

- 建两个集合：`<前缀>_users`（账号，`_id` 用账号名小写天然去重）、`<前缀>_sessions`（会话 token）
- 密码用 `scrypt` 加随机盐派生，比对走 `timingSafeEqual`，**源码里不留任何明文密码**
- 数据文档 `_id` 改成 `<uid>__<key>` 并带 `uid` 字段，读写按 `uid` 过滤——这是隔离的关键，漏改一处就会串号
- 老数据迁移：只在指定账号名下触发复制（**用账号白名单，不能用「第一个注册的人继承」**，否则陌生人抢先注册就能拿走数据）
- 前端加账号门、`authGate()` 启动闸门、`api()` 自动补 token、游客模式走内置演示数据
- 账号名规则同微信号：`/^[a-z][a-z0-9_-]{5,19}$/`
- 最后用 curl + Playwright 做端到端验证，并清理测试账号

**前置条件**：**必须已经有云函数代理**（页面托管域名不在 CloudBase 安全域名白名单里，无法直连 JS SDK）。

---

## 组合使用的顺序

```
你的单文件页面（数据在浏览器里）
        │
        │  ① workbench-cloud-sync-upgrade   ← 先让数据上云
        ▼
CloudBase 云函数 + 文档数据库（全网可读写，没有账号概念）
        │
        │  ② workbench-cloudbase-auth        ← 再加账号与隔离
        ▼
多用户各自一份数据 + 游客体验模式
```

顺序不能反：第②步强依赖第①步建好的云函数代理。本仓库当前的代码就是走完这两步之后的状态。

---

## 顺带一提

如果你不是改造已有项目，而是**想从零生成一个工作台**，那是另一个技能包 `workbench-generator` 的职责（通过场景模板和界面骨架提问，帮你把工作台搭出来）。本仓库不附带它。
