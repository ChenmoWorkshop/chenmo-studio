const app = getApp();

Page({
  data: {
    profile: {},
    showForm: false,
    bindMode: true,     /* true=首次绑定，false=纯账号密码登录 */
    user: '',
    pass: '',
    err: '',
    busy: false,
    note: '',
    account: ''
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

  /* 微信一键登录 */
  onWxLogin: function () {
    if (this.data.busy) return;
    const self = this;
    this.setData({ busy: true, err: '' });
    app.wxLogin().then((r) => {
      if (r.ok && r.bound) { app.toast('欢迎回来'); self.enter(); return; }
      if (r.ok && !r.bound) {
        self.setData({
          busy: false, showForm: true, bindMode: true,
          err: r.error || '这个微信还没绑定账号，输入一次账号密码即可绑定'
        });
        return;
      }
      self.setData({ busy: false, err: r.error || '微信登录失败，可以改用账号密码登录' });
    });
  },

  showPwd: function () {
    if (this.data.busy) return;
    this.setData({ showForm: true, bindMode: false, err: '' });
  },

  backToWx: function () {
    this.setData({ showForm: false, err: '' });
  },

  onUser: function (e) { this.setData({ user: e.detail.value, err: '' }); },
  onPass: function (e) { this.setData({ pass: e.detail.value, err: '' }); },

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
