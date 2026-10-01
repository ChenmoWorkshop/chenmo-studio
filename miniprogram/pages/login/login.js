const app = getApp();

Page({
  data: {
    profile: {},
    showForm: false,
    bindMode: true,
    user: '',
    pass: '',
    err: ''
  },

  onLoad: function () {
    this.setData({ profile: app.profile() });
  },

  onWxLogin: function () {
    if (app.globalData.bound) {
      app.toast('已绑定，直接进入');
      this.enter();
      return;
    }
    this.setData({ showForm: true, bindMode: true, err: '' });
  },

  showPwd: function () {
    this.setData({ showForm: true, bindMode: false, err: '' });
  },

  backToWx: function () {
    this.setData({ showForm: false, err: '' });
  },

  onUser: function (e) {
    this.setData({ user: e.detail.value, err: '' });
  },

  onPass: function (e) {
    this.setData({ pass: e.detail.value, err: '' });
  },

  onSubmit: function () {
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
    if (this.data.bindMode) app.setBound(true);
    app.toast(this.data.bindMode ? '绑定成功' : '登录成功');
    this.enter();
  },

  onGuest: function () {
    app.toast('游客体验：改动不会保存');
    this.enter();
  },

  enter: function () {
    wx.reLaunch({ url: '/pages/home/home' });
  }
});
