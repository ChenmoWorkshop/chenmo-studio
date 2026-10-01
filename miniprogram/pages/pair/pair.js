/* 网页扫码/配对登录：网页上显示 6 位配对码，这里扫码或手输后确认授权。
   确认动作必须来自已登录账号，等于「持有账号的人当面放行」。 */
const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    code: '',
    busy: false,
    err: '',
    okUser: ''
  },

  onInput: function (e) {
    /* 只留数字，最多 6 位 */
    const v = String(e.detail.value || '').replace(/\D/g, '').slice(0, 6);
    this.setData({ code: v, err: '' });
  },

  /* 扫网页上的二维码（二维码内容是 CHENMOPAIR:123456） */
  scan: function () {
    const self = this;
    wx.scanCode({
      onlyFromCamera: false,
      success: function (res) {
        const m = String(res.result || '').match(/(\d{6})\s*$/);
        if (!m) { self.setData({ err: '这不是创作工坊的配对码' }); return; }
        self.setData({ code: m[1], err: '' });
        self.confirm();
      },
      fail: function () { /* 用户取消扫描，不打扰 */ }
    });
  },

  confirm: function () {
    if (this.data.busy) return;
    const code = this.data.code;
    if (!/^\d{6}$/.test(code)) { this.setData({ err: '请输入 6 位配对码' }); return; }
    const self = this;
    this.setData({ busy: true, err: '' });
    api.pairConfirm(code).then(function (r) {
      self.setData({ busy: false });
      if (r.ok) {
        self.setData({ okUser: r.user || '' });
        app.toast('已授权网页登录');
        return;
      }
      self.setData({ err: r.error || '授权失败，请稍后再试' });
    });
  },

  back: function () { wx.navigateBack(); }
});
