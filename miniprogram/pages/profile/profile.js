const app = getApp();

Page({
  data: {
    profile: {},
    account: '',
    bound: false,
    mode: 'guest',
    syncNote: '',
    busy: false
  },

  onLoad: function () { this.render(); },
  onShow: function () { this.render(); },

  render: function () {
    this.setData({
      profile: app.profile(),
      account: app.globalData.account || '',
      bound: !!app.globalData.bound,
      mode: app.globalData.mode,
      syncNote: app.globalData.syncNote || ''
    });
  },

  onName: function (e) { this.setData({ 'profile.name': e.detail.value }); },
  onSub: function (e) { this.setData({ 'profile.sub': e.detail.value }); },

  pickAvatar: function () {
    if (this.data.busy) return;
    const self = this;
    this.setData({ busy: true });
    app.pickAvatar().then((dataUrl) => {
      self.setData({ busy: false });
      /* 头像以 base64 存在账号资料里，和网页版同一形态；这里挡一下超大图 */
      if (dataUrl.length > 500 * 1024) {
        app.toast('这张图有点大，换一张更小的吧');
        return;
      }
      self.setData({ 'profile.avatar': dataUrl });
      app.toast('已选择，记得点保存');
    }).catch(() => {
      self.setData({ busy: false });
      app.toast('没有选择图片');
    });
  },

  save: function () {
    const p = this.data.profile;
    if (!p.name || !p.name.trim()) {
      app.toast('工作台名称不能为空');
      return;
    }
    if (this.data.busy) return;
    const self = this;
    this.setData({ busy: true });
    app.updateProfile({
      name: p.name.trim(),
      sub: (p.sub || '').trim(),
      avatar: p.avatar || ''
    }).then((r) => {
      self.setData({ busy: false });
      if (r.ok) {
        app.toast(r.local ? '已保存到本机（游客模式）' : '已保存到云端');
        self.render();
        return;
      }
      app.toast(r.error || '保存失败');
    });
  },

  /* 解绑微信：只解除这台微信的免密关系，账号与数据都在 */
  unbind: function () {
    const self = this;
    wx.showModal({
      title: '解除微信绑定',
      content: '解绑后这台微信需要重新用账号密码登录，账号里的数据不受影响。',
      confirmText: '解绑',
      success: function (res) {
        if (!res.confirm) return;
        app.wxUnbind().then((r) => {
          if (!r.ok) { app.toast(r.error || '解绑失败'); return; }
          app.toast('已解绑');
          self.render();
        });
      }
    });
  },

  logout: function () {
    wx.showModal({
      title: '退出登录',
      content: '退出后将回到登录页；如果你已绑定微信，下次点微信一键登录即可直接进来。',
      confirmText: '退出',
      success: function (res) {
        if (!res.confirm) return;
        app.globalData.bound = false;
        app.logout().then(function () {
          wx.reLaunch({ url: '/pages/login/login' });
        });
      }
    });
  }
});
