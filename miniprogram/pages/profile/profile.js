const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    profile: {},
    account: '',
    bound: false,
    mode: 'guest',
    syncNote: '',
    busy: false,
    /* 密保邮箱 */
    emailMask: '',
    emailEditing: false,
    emailInput: '',
    emailCode: '',
    emailSent: '',
    emailErr: '',
    emailCount: 0
  },

  onLoad: function () { this.render(); },
  onShow: function () { this.render(); },
  onUnload: function () {
    if (this._ct) { clearInterval(this._ct); this._ct = null; }
  },

  render: function () {
    this.setData({
      profile: app.profile(),
      account: app.globalData.account || '',
      bound: !!app.globalData.bound,
      mode: app.globalData.mode,
      syncNote: app.globalData.syncNote || '',
      emailMask: (app.profile() && app.profile().email) || ''
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

  /* —— 密保邮箱绑定 —— */
  startEmailEdit: function () {
    this.setData({ emailEditing: true, emailInput: '', emailCode: '', emailSent: '', emailErr: '' });
  },
  cancelEmailEdit: function () {
    this._stopCount();
    this.setData({ emailEditing: false, emailErr: '' });
  },
  onEmailInput: function (e) { this.setData({ emailInput: e.detail.value, emailErr: '' }); },
  onEmailCode: function (e) { this.setData({ emailCode: e.detail.value, emailErr: '' }); },
  _stopCount: function () {
    if (this._ct) { clearInterval(this._ct); this._ct = null; }
  },

  sendEmailCodeTap: function () {
    if (this.data.emailCount > 0) return;
    const em = this.data.emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) {
      this.setData({ emailErr: '请输入正确的邮箱地址' });
      return;
    }
    const self = this;
    this.setData({ emailErr: '' });
    api.sendEmailCode('bind', em).then((r) => {
      if (!r.ok) { self.setData({ emailErr: r.error || '发送失败，请稍后再试' }); return; }
      self.setData({ emailSent: '验证码已发送至 ' + r.email + '，10 分钟内有效' });
      let s = 60;
      self.setData({ emailCount: s });
      self._ct = setInterval(function () {
        s--;
        if (s <= 0) { self._stopCount(); self.setData({ emailCount: 0 }); }
        else self.setData({ emailCount: s });
      }, 1000);
    });
  },

  confirmBind: function () {
    if (this.data.busy) return;
    const em = this.data.emailInput.trim();
    const code = this.data.emailCode.trim();
    if (!em || !code) { this.setData({ emailErr: '请输入邮箱和验证码' }); return; }
    const self = this;
    this.setData({ busy: true, emailErr: '' });
    api.bindEmail(em, code).then((r) => {
      self.setData({ busy: false });
      if (r.ok) {
        self._stopCount();
        app.toast('密保邮箱绑定成功');
        if (app.profile()) app.profile().email = r.email;
        self.setData({ emailEditing: false, emailMask: r.email, emailSent: '', emailCode: '' });
        return;
      }
      self.setData({ emailErr: r.error || '绑定失败，请稍后再试' });
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
