const app = getApp();

Page({
  data: {
    profile: {},
    account: 'ChenMo',
    bound: false
  },

  onLoad: function () {
    this.setData({
      profile: app.profile(),
      bound: app.globalData.bound
    });
  },

  onName: function (e) {
    this.setData({ 'profile.name': e.detail.value });
  },

  onSub: function (e) {
    this.setData({ 'profile.sub': e.detail.value });
  },

  pickAvatar: function () {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: function (res) {
        const path = res.tempFiles[0].tempFilePath;
        self.setData({ 'profile.avatar': path });
      }
    });
  },

  save: function () {
    const p = this.data.profile;
    if (!p.name || !p.name.trim()) {
      app.toast('工作台名称不能为空');
      return;
    }
    app.saveProfile({ name: p.name.trim(), sub: (p.sub || '').trim(), avatar: p.avatar || '' });
    app.toast('已保存');
  },

  logout: function () {
    app.setBound(false);
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
