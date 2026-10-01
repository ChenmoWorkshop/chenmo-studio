# 尘墨工坊 · Chenmo Studio

> 一个单文件的个人工作台：待办 / 灵感 / 内容 / 复盘，配每日中西名言轮换。
> 数据存腾讯云开发 CloudBase，打开网页即用，多设备自动同步，浏览器本地不落任何业务数据。

[在线使用](https://chenmo-studio.app.workbuddy.host/) · [架构说明](#架构) · [自部署指南](#自部署指南五分钟)

---

## 功能特性

- **四大模块**：待办（优先级）、灵感（随手记）、内容（创作管理）、复盘（定期回顾）
- **多设备同步**：数据全部存云端，换设备打开同一网址，内容一致；断网时提示保存失败且不丢数据，恢复后自动重试
- **每日名言**：每天 10 条（中方 5 条 + 西方 5 条交替），来自 162 条哲学家词库；点击切换，点满 10 次回到起点；每 2.4 小时按时段自动轮换，午夜自动换新的一天
- **PWA**：可"添加到主屏幕"，像原生 App 一样打开
- **零构建**：整个前端就是一个 `index.html`，双击即用，无框架、无依赖、无打包

## 架构

```
浏览器 (index.html，单文件，原生 JS)
    │  fetch (POST JSON)
    ▼
云函数 chenmo-api (Node.js + @cloudbase/node-sdk，管理员权限)
    │
    ▼
CloudBase 文档数据库 (集合 workbench_state)
```

- 前端通过云函数代理读写数据库，而非 SDK 直连——因为体验版环境无法添加自定义安全域名，且 CloudBase 测试域名在浏览器导航时会触发微信风控页
- 业务键 `todos / ideas / contents / reviews` 各占一个固定 `_id` 的文档，`set()` 幂等写
- 云函数侧按 `Origin` 白名单下发 CORS（体验版无法在控制台配置安全域名）
- 浏览器 localStorage 只存主题偏好 `cwb_theme`，不存业务数据

## 自部署指南（五分钟）

想跑在自己的环境里？照做即可。

### 1. 创建 CloudBase 环境

1. 登录 [腾讯云 CloudBase 控制台](https://tcb.cloud.tencent.com/dev)，创建环境（上海地域，云数据库类型）
2. 免费体验版每月 3000 资源点，本项目实际用量约 30–60 点/月，个人使用完全免费

### 2. 创建集合并设置权限

1. 数据库中创建集合 `workbench_state`
2. 集合权限改为 **自定义安全规则**，读写全部放开：

```json
{
  "read": true,
  "write": true
}
```

> ⚠️ 默认的"仅创建者可读写"会阻断跨设备同步（每个设备的匿名登录是不同用户）。

### 3. 部署云函数 chenmo-api

```bash
cd functions/chenmo-api
npm install
```

推荐用 CloudBase CLI 部署：

```bash
npm install -g @cloudbase/cli
tcb login
tcb fn code update chenmo-api --envId <你的环境ID> --dir functions/chenmo-api
```

> ⚠️ **踩坑警告**：`tcb fn deploy` 可能提示成功但云端代码并未更新（空包 / 交互卡住等原因）。
> 遇到"部署成功但行为没变"，改用上面的 `tcb fn code update`，或用 CloudBase MCP 工具的
> `updateFunctionCode`（`functionRootPath` 指向 `functions` 目录本身）。

若函数是首次创建，需要在控制台为它开启 **HTTP 访问服务**，复制默认域名，格式形如：

```
https://<环境ID>-<后缀>.ap-shanghai.app.tcloudbase.com/chenmo-api
```

### 4. 修改前端配置

打开 `index.html`，替换以下常量（都在脚本开头附近，有注释标注）：

| 常量 | 说明 |
|---|---|
| `CB_API` | 你的云函数 HTTP 访问地址 |
| `HOME_URL` | 你部署静态页的正式地址 |
| `OLD_HOSTS` | 曾经用过、需要重定向到正式地址的旧域名（没有就留空数组） |

同时修改云函数 `functions/chenmo-api/index.js` 中的 `ALLOW_ORIGINS` 白名单，加入你的静态页域名。

### 5. 托管静态页

`index.html` + `logo.jpeg` 放到任意静态托管即可：CloudBase 静态托管、GitHub Pages、对象存储 + CDN 都行。没有构建步骤。

### 6. 初始化数据

首次打开页面时，若云端无数据会自动写入空的初始结构，无需手动建数据。

## 成本与续期提醒

- 免费体验版有效期 6 个月，**只能在到期前 1 个月内续期**，单次续 6 个月
- 到期后进入停服隔离期（约 15 个自然日），再不续费环境将被销毁、数据不可恢复
- 本仓库 `docs` 思路下可参考的守护脚本思路：查询环境到期时间 → 窗口期内调用 `tcb env renew --duration 6`（详见项目实践，此处不附带凭证）

**请务必在腾讯云控制台配置好到期提醒（短信/微信），或自行设置日历提醒。**

## 数据备份

数据在云端，建议定期导出：控制台 → 数据库 → `workbench_state` → 导出 JSON。
本项目所有数据一条不落地存在 CloudBase，浏览器换设备、清缓存都不影响。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript，单文件，无构建、无框架
- 后端：腾讯云 CloudBase 云函数（Node.js 16+）
- 数据库：CloudBase 文档型数据库
- 工具链：CloudBase CLI / CloudBase MCP（部署与运维）

## License

[MIT](LICENSE)
