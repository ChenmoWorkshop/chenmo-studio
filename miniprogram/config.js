/* 小程序接入配置：换环境、换云函数名只改这一个文件 */
module.exports = {
  /* 与网页版共用同一个 CloudBase 环境 → 两条链路天然同一份数据 */
  env: 'chenmo-d9gcmpopbed61c597',

  /* 云函数名：网页版经 HTTP 访问服务调它，小程序经 wx.cloud.callFunction 调它，同一个函数 */
  fn: 'chenmo-api',

  /* 云端不可用时自动降级为本机演示模式（游客 AppID、未关联环境、断网时走到这里），
     这样开发者和纯体验用户仍能完整走一遍界面流程 */
  fallbackToLocal: true,

  version: 'v3.2'
};
