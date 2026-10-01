/* 应用入口：演示版数据存本地缓存（结构与云端一致），
   接入云函数后把 db()/save() 换成 wx.cloud.callFunction 调用即可 */
const mock = require('./mock/data.js');

App({
  globalData: {
    db: null,
    profile: null,
    bound: false
  },

  onLaunch: function () {
    const cached = wx.getStorageSync('cwb_mp_db');
    if (cached && cached.todos) {
      this.globalData.db = cached;
    } else {
      this.globalData.db = JSON.parse(JSON.stringify(mock.DB));
    }
    const p = wx.getStorageSync('cwb_mp_profile');
    this.globalData.profile = p && p.name ? p : JSON.parse(JSON.stringify(mock.PROFILE));
    this.globalData.bound = !!wx.getStorageSync('cwb_mp_bound');
  },

  db: function () {
    if (!this.globalData.db) this.globalData.db = JSON.parse(JSON.stringify(mock.DB));
    return this.globalData.db;
  },

  save: function () {
    wx.setStorageSync('cwb_mp_db', this.globalData.db);
  },

  profile: function () {
    return this.globalData.profile;
  },

  saveProfile: function (p) {
    this.globalData.profile = p;
    wx.setStorageSync('cwb_mp_profile', p);
  },

  setBound: function (v) {
    this.globalData.bound = !!v;
    wx.setStorageSync('cwb_mp_bound', v ? 1 : 0);
  },

  uid: function () {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  greeting: function () {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，早点休息';
    if (h < 9) return '早上好，开始今天的创作';
    if (h < 12) return '上午好，开始今天的创作';
    if (h < 14) return '中午好，开始今天的创作';
    if (h < 18) return '下午好，开始今天的创作';
    return '晚上好，开始今天的创作';
  },

  todayText: function () {
    const d = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return '今天是 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日，星期' + wk + '，今天也要产出好内容 ✨';
  },

  toast: function (m) {
    wx.showToast({ title: m, icon: 'none' });
  }
});
