const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    profile: {},
    showForm: false,
    bindMode: true,     /* true=首次绑定，false=纯账号密码登录 */
    resetMode: false,   /* 忘记密码：验证码发到密保邮箱 */
    user: '',
    pass: '',
    err: '',
    busy: false,
    note: '',
    account: '',
    /* 找回密码 */
    rUser: '',
    rCode: '',
    rPass: '',
    rSent: '',
    rCount: 0
  },

  onLoad: function () {
    this.setData({
      profile: app.profile(),
      account: app.globalData.account || '',
      note: app.globalData.canCloud
        ? '首次使用：用微信一键登录并绑定一次账号，之后每次打开直接进入。账号与网页版通用。'
        : '当前为演示模式（未接入云端），数据只保存在本机。'
    });
    /* 已有有效登录态就直接进工作台，不用再看登录页 */
    app.whenReady().then((ok) => {
      if (ok) wx.reLaunch({ url: '/pages/home/home' });
    });
  },

  onUnload: function () { this._stopCount(); },

  /* 微信一键登录 */
  onWxLogin: function () {
    if (this.data.busy) return;
    const self = this;
    this.setData({ busy: true, err: '' });
    app.wxLogin().then((r) => {
      if (r.ok && r.bound) { app.toast('欢迎回来'); self.enter(); return; }
      if (r.ok && !r.bound) {
        self.setData({
          busy: false, showForm: true, bindMode: true, resetMode: false,
          err: r.error || '这个微信还没绑定账号，输入一次账号密码即可绑定'
        });
        return;
      }
      self.setData({ busy: false, err: r.error || '微信登录失败，可以改用账号密码登录' });
    });
  },

  showPwd: function () {
    if (this.data.busy) return;
    this.setData({ showForm: true, bindMode: false, resetMode: false, err: '' });
  },

  showReset: function () {
    if (this.data.busy) return;
    this.setData({ showForm: true, resetMode: true, err: '', rErr: '', rUser: this.data.user });
  },

  backToWx: function () {
    this._stopCount();
    this.setData({ showForm: false, resetMode: false, err: '' });
  },

  onUser: function (e) { this.setData({ user: e.detail.value, err: '' }); },
  onPass: function (e) { this.setData({ pass: e.detail.value, err: '' }); },

  /* —— 找回密码 —— */
  onRUser: function (e) { this.setData({ rUser: e.detail.value, rErr: '' }); },
  onRCode: function (e) { this.setData({ rCode: e.detail.value, rErr: '' }); },
  onRPass: function (e) { this.setData({ rPass: e.detail.value, rErr: '' }); },

  _stopCount: function () {
    if (this._ct) { clearInterval(this._ct); this._ct = null; }
  },

  onResetSend: function () {
    if (this.data.rCount > 0) return;
    const u = this.data.rUser.trim();
    if (!u) { this.setData({ rErr: '请先输入账号' }); return; }
    const self = this;
    this.setData({ rErr: '' });
    api.sendEmailCode('reset', '', u).then((r) => {
      if (!r.ok) { self.setData({ rErr: r.error || '发送失败，请稍后再试' }); return; }
      self.setData({ rSent: '验证码已发送至 ' + r.email + '，10 分钟内有效' });
      let s = 60;
      self.setData({ rCount: s });
      self._ct = setInterval(function () {
        s--;
        if (s <= 0) { self._stopCount(); self.setData({ rCount: 0 }); }
        else self.setData({ rCount: s });
      }, 1000);
    });
  },

  onResetSubmit: function () {
    if (this.data.busy) return;
    const u = this.data.rUser.trim();
    const code = this.data.rCode.trim();
    const p = this.data.rPass;
    if (!u) { this.setData({ rErr: '请输入账号' }); return; }
    if (p.length < 6) { this.setData({ rErr: '新密码至少 6 位' }); return; }
    const self = this;
    this.setData({ busy: true, rErr: '' });
    api.resetPassword(u, code, p).then((r) => {
      self.setData({ busy: false });
      if (r.ok) {
        self._stopCount();
        app.toast('密码已重置，请用新密码登录');
        self.setData({ resetMode: false, bindMode: false, user: u, pass: '', rErr: '', rSent: '' });
        return;
      }
      self.setData({ rErr: r.error || '重置失败，请稍后再试' });
    });
  },

  onSubmit: function () {
    if (this.data.busy) return;
    const u = this.data.user.trim();
    const p = this.data.pass;
    if (!/^[A-Za-z][A-Za-z0-9_-]{5,19}$/.test(u)) {
      this.setData({ err: '账号需以字母开头，6–20 位字母、数字、下划线或减号' });
      return;
    }
    if (p.length < 6) {
      this.setData({ err: '密码至少 6 位' });
      return;
    }

    const self = this;
    const bind = this.data.bindMode;
    this.setData({ busy: true, err: '' });
    const task = bind ? app.wxBind(u, p) : app.login(u, p);

    task.then((r) => {
      if (r.ok) {
        app.toast(bind ? '绑定成功，以后免密进入' : '登录成功');
        self.enter();
        return;
      }
      self.setData({ busy: false, err: r.error || '登录失败，请检查账号密码' });
    });
  },

  onGuest: function () {
    if (this.data.busy) return;
    app.enterGuest();
    app.toast('游客体验：改动不会保存');
    this.enter();
  },

  enter: function () {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
