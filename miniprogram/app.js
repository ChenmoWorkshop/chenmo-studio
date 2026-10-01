/* 应用入口 · 数据层
   与网页版共用同一个 CloudBase 环境与同一个云函数，区别只是调用通道：
   网页版 fetch → HTTP 访问服务；小程序 wx.cloud.callFunction → 微信内网通道。

   三条设计原则（都是网页版踩过坑之后定下来的）：
   1) 页面仍用同步的 db()/save()，异步同步藏在底下 —— 不改页面写法
   2) 云端未就绪时提交的改动进待传队列，就绪后自动补传，绝不丢
   3) 云端数据回来时，对「未同步过的 key」按 id 合并，不整体覆盖
   另外：游客模式 save() 直接返回，一条都不写云端 */
const CONFIG = require('./config.js');
const mock = require('./mock/data.js');
const cloud = require('./utils/cloud.js');
const api = require('./utils/api.js');

var KEYS = ['todos', 'ideas', 'contents', 'reviews'];
var SKEY = {
  profile: 'cwb_mp_profile',
  cache: 'cwb_mp_cache',
  account: 'cwb_mp_account'
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function emptyDB() {
  var d = {};
  KEYS.forEach(function (k) { d[k] = []; });
  return d;
}

/* 合并：保留本地新增（云端还没有的 id），其余以云端为准 */
function mergeById(localArr, cloudArr) {
  var ids = {};
  (cloudArr || []).forEach(function (x) { if (x && x.id) ids[x.id] = 1; });
  var extra = (localArr || []).filter(function (x) { return x && x.id && !ids[x.id]; });
  return extra.concat(cloudArr || []);
}

App({
  globalData: {
    db: null,
    profile: null,
    account: '',        /* 登录的账号名；游客为空 */
    mode: 'guest',      /* 'guest' | 'cloud' */
    bound: false,       /* 微信是否已绑定账号 */
    cloudReady: false,  /* 数据是否已与云端对齐 */
    loading: true,
    canCloud: false,    /* 云开发是否可用（决定要不要显示"演示模式"提示） */
    syncNote: ''        /* 状态文案，页面可展示 */
  },

  _synced: {},   /* 各 key 最近一次成功同步的内容快照，用于算脏 */
  _pending: {},  /* 待补传的 key：云端未就绪或写入失败时进这里 */
  _bootPromise: null,

  /* ================= 启动 ================= */

  onLaunch: function () {
    this.globalData.canCloud = cloud.init();
    /* 有登录态就按云端模式启动并读「账号缓存」，断网时也能看到自己的数据而不是演示数据 */
    var hasSession = false;
    try { hasSession = !!cloud.token(); } catch (e) {}
    if (hasSession) {
      this.globalData.mode = 'cloud';
      this.globalData.account = this._loadAccount();
    }
    this.globalData.profile = this._loadProfile();
    this.globalData.db = this._loadCache();
    this.globalData.syncNote = this.globalData.canCloud ? '' : '演示模式：数据只存在本机';
    this._bootPromise = this.bootstrap();
  },

  /* 用已存的 token 验活并拉取云端数据；返回是否已登录 */
  bootstrap: function () {
    var self = this;
    if (!this.globalData.canCloud) { this.setLoading(false); return Promise.resolve(false); }
    if (!cloud.token()) { this.setLoading(false); return Promise.resolve(false); }

    return api.me().then(function (r) {
      if (!r || !r.ok) {                       /* token 过期/被吊销 */
        if (r && r.needAuth) { cloud.clearToken(); self._exitToGuest(); }
        self.setLoading(false);
        return false;
      }
      self._applyProfile(r.profile);
      return api.loadAll().then(function (res) {
        if (!res || !res.ok) { self.setLoading(false); return false; }
        self._applyCloud(res.data);
        return true;
      });
    }).catch(function () {
      self.setLoading(false);
      self.globalData.syncNote = '云端连接失败，已用本地数据展示';
      return false;
    });
  },

  /* 页面可 await 它来决定要不要跳首页 */
  whenReady: function () { return this._bootPromise || Promise.resolve(false); },

  _applyProfile: function (p) {
    if (!p) return;
    this.globalData.profile = p;
    this.globalData.account = p.user || this.globalData.account;
    this.globalData.mode = 'cloud';
    this.globalData.bound = true;
    try {
      wx.setStorageSync(SKEY.profile, p);
      wx.setStorageSync(SKEY.account, this.globalData.account);
    } catch (e) {}
  },

  /* 云端数据落地：未同步过的 key 做 id 合并，其余以云端为准 */
  _applyCloud: function (cloudData) {
    var local = this.globalData.db || emptyDB();
    var data = cloudData || {};
    var merging = Object.keys(this._pending);
    var next = emptyDB();
    var self = this;

    KEYS.forEach(function (k) {
      var c = Array.isArray(data[k]) ? data[k] : [];
      if (merging.indexOf(k) >= 0) {
        next[k] = mergeById(local[k], c);       /* 本地离线新增保留，且仍算未同步 */
        self._synced[k] = JSON.stringify(c);    /* 快照记云端那份，便于 flush 时判断 */
      } else {
        next[k] = c;
        self._synced[k] = JSON.stringify(c);
        delete self._pending[k];
      }
    });

    this.globalData.db = next;
    this.globalData.cloudReady = true;
    this.globalData.loading = false;
    this.globalData.syncNote = '云端自动同步';
    this._saveCache();
    this._flush();          /* 补传离线期间的改动 */
    this._saveProfileCache();
    this.notifyPages();
  },

  setLoading: function (v) {
    this.globalData.loading = !!v;
    this.notifyPages();
  },

  /* 通知当前所有页面重渲染（页面已有 render() 的统一约定） */
  notifyPages: function () {
    var pages = [];
    try { pages = getCurrentPages() || []; } catch (e) { pages = []; }
    pages.forEach(function (p) {
      try { if (p && typeof p.render === 'function') p.render(); } catch (e) {}
    });
  },

  _degrade: function (note) {
    this.globalData.syncNote = note || '已用本地数据展示';
    this.setLoading(false);
  },

  /* ================= 登录 / 绑定 ================= */

  /* 微信一键登录：已绑定直接进，未绑定返回 bound=false */
  wxLogin: function () {
    var self = this;
    return api.wxLogin().then(function (r) {
      if (!r) return { ok: false, error: '云端没有响应' };
      if (r.needWx) return { ok: false, error: '微信登录仅在小程序内可用' };
      if (r.bound === false) return { ok: true, bound: false, error: r.error || '' };
      if (!r.ok) return { ok: false, error: r.error || '登录失败' };
      return self._afterAuth(r.token, r.profile).then(function () {
        return { ok: true, bound: true };
      });
    }).catch(function (e) {
      return { ok: false, error: self._netError(e) };
    });
  },

  /* 首次绑定：账号密码换取绑定关系 */
  wxBind: function (user, pass) {
    var self = this;
    return api.wxBind(user, pass).then(function (r) {
      if (!r || !r.ok) return { ok: false, error: (r && r.error) || '绑定失败' };
      return self._afterAuth(r.token, r.profile).then(function () {
        return { ok: true, bound: true };
      });
    }).catch(function (e) { return { ok: false, error: self._netError(e) }; });
  },

  /* 账号密码登录（兜底：换手机、不想绑微信时用） */
  login: function (user, pass) {
    var self = this;
    return api.login(user, pass).then(function (r) {
      if (!r || !r.ok) return { ok: false, error: (r && r.error) || '登录失败' };
      return self._afterAuth(r.token, r.profile).then(function () {
        return { ok: true, bound: false };
      });
    }).catch(function (e) { return { ok: false, error: self._netError(e) }; });
  },

  /* 拿到 token + 资料后：切换为云端模式并拉一次数据 */
  _afterAuth: function (token, profile) {
    var self = this;
    cloud.setToken(token);
    this._applyProfile(profile);
    this.globalData.loading = true;
    return api.loadAll().then(function (res) {
      if (res && res.ok) { self._applyCloud(res.data); return true; }
      self.setLoading(false);
      self.globalData.cloudReady = true;
      return false;
    }).catch(function () {
      self.setLoading(false);
      self.globalData.cloudReady = true;
      return false;
    });
  },

  /* 解绑当前微信 */
  wxUnbind: function () {
    var self = this;
    return api.wxUnbind().then(function (r) {
      return { ok: !!(r && r.ok), error: (r && r.error) || '' };
    }).catch(function (e) { return { ok: false, error: self._netError(e) }; });
  },

  logout: function () {
    var self = this;
    return api.logout().catch(function () {}).then(function () {
      self.enterGuest();
    });
  },

  /* 游客模式：完整可用，但 save() 不写云端 */
  enterGuest: function () {
    cloud.clearToken();
    this._exitToGuest();
  },

  _exitToGuest: function () {
    this.globalData.mode = 'guest';
    this.globalData.account = '';
    this.globalData.bound = false;
    this.globalData.cloudReady = false;
    this.globalData.loading = false;
    this.globalData.syncNote = '游客模式：改动不会保存';
    this._pending = {};
    this._synced = {};
    this.globalData.db = this._loadCache(true);   /* 游客用演示数据 */
    this.globalData.profile = clone(mock.PROFILE);
    try {
      wx.removeStorageSync(SKEY.account);
      wx.removeStorageSync(SKEY.profile);
    } catch (e) {}
    this.notifyPages();
  },

  _netError: function (e) {
    var m = (e && e.message) || '';
    if (m === 'cloud-unavailable') return '当前基础库未开启云开发，已进入演示模式';
    return '网络不太好，稍后再试';
  },

  /* ================= 数据读写（页面同步调用） ================= */

  db: function () {
    if (!this.globalData.db) this.globalData.db = this._loadCache();
    return this.globalData.db;
  },

  /* 页面改完数据后调 save()：写本地缓存 + 推云端（脏 key 增量） */
  save: function () {
    this._saveCache();
    if (this.globalData.mode !== 'cloud') return;      /* 游客不写云端 */

    var dirty = this._dirty();
    if (!dirty.length) return;

    if (!this.globalData.cloudReady) {                 /* 云端还没对齐：先记着，等就绪补传 */
      var self = this;
      dirty.forEach(function (k) { self._pending[k] = true; });
      this.globalData.syncNote = '连接中，稍后自动同步';
      return;
    }
    this._push(dirty);
  },

  _dirty: function () {
    var self = this;
    return KEYS.filter(function (k) {
      return JSON.stringify(self.globalData.db[k] || []) !== (self._synced[k] || '');
    });
  },

  _push: function (keys) {
    var self = this;
    keys.forEach(function (k) {
      var payload = JSON.stringify(self.globalData.db[k] || []);
      api.save(k, JSON.parse(payload)).then(function (r) {
        if (r && r.ok) {
          self._synced[k] = payload;
          delete self._pending[k];
          self.globalData.syncNote = '云端自动同步';
        } else if (r && r.needAuth) {
          self._pending[k] = true;
          self._onExpired();
        } else {
          self._pending[k] = true;
          self.globalData.syncNote = '同步失败，稍后自动重试';
        }
      }).catch(function () {
        self._pending[k] = true;
        self.globalData.syncNote = '同步失败，稍后自动重试';
      });
    });
  },

  _flush: function () {
    var ks = Object.keys(this._pending);
    if (ks.length) this._push(ks);
  },

  /* 手动重试（页面下拉/点按钮时可调） */
  retry: function () {
    if (this.globalData.mode !== 'cloud') return;
    if (!this.globalData.cloudReady) { this.bootstrap(); return; }
    this._flush();
  },

  _onExpired: function () {
    if (this._expiredShown) return;
    this._expiredShown = true;
    var self = this;
    wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
    setTimeout(function () {
      self._expiredShown = false;
      self.enterGuest();
      wx.reLaunch({ url: '/pages/login/login' });
    }, 1200);
  },

  /* ================= 资料 ================= */

  profile: function () { return this.globalData.profile || this._loadProfile(); },

  /* 页面用：改资料。云端模式下同步到云端，失败保留本地并提示 */
  updateProfile: function (patch) {
    var self = this;
    var p = Object.assign({}, this.profile(), patch || {});
    this.globalData.profile = p;
    this._saveProfileCache();

    if (this.globalData.mode !== 'cloud') return Promise.resolve({ ok: true, local: true });

    return api.updateProfile(patch).then(function (r) {
      if (r && r.ok) { self._applyProfile(r.profile); self.notifyPages(); return { ok: true }; }
      return { ok: false, error: (r && r.error) || '保存失败' };
    }).catch(function (e) { return { ok: false, error: self._netError(e) }; });
  },

  /* 兼容旧页面写法 */
  saveProfile: function (p) { return this.updateProfile(p); },

  setBound: function (v) { this.globalData.bound = !!v; },

  /* 头像：压缩后转 base64 data URL（与网页版同一存储形态，不用另建对象存储） */
  pickAvatar: function () {
    return new Promise(function (resolve, reject) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: function (res) {
          var path = res.tempFiles[0].tempFilePath;
          /* 再压一道：质量 60，多数手机照片能落到 100KB 上下 */
          wx.compressImage({
            src: path,
            quality: 60,
            success: function (r) { resolve(r.tempFilePath); },
            fail: function () { resolve(path); }
          });
        },
        fail: function (e) { reject(e); }
      });
    }).then(function (path) {
      return new Promise(function (resolve, reject) {
        wx.getFileSystemManager().readFile({
          filePath: path,
          encoding: 'base64',
          success: function (r) { resolve('data:image/jpeg;base64,' + r.data); },
          fail: function (e) { reject(e); }
        });
      });
    });
  },

  /* ================= 本地存储 ================= */

  _loadProfile: function () {
    try {
      var p = wx.getStorageSync(SKEY.profile);
      if (p && p.name) return p;
    } catch (e) {}
    return clone(mock.PROFILE);
  },

  _loadAccount: function () {
    try { return wx.getStorageSync(SKEY.account) || ''; } catch (e) { return ''; }
  },

  _saveProfileCache: function () {
    try { wx.setStorageSync(SKEY.profile, this.globalData.profile); } catch (e) {}
  },

  /* 云端模式与游客模式用两份缓存，避免退出登录后残留上一账号的数据 */
  _cacheKey: function (guest) {
    var g = guest === undefined ? this.globalData.mode !== 'cloud' : !!guest;
    return g ? SKEY.cache + '_guest' : SKEY.cache;
  },

  _loadCache: function (guest) {
    try {
      var c = wx.getStorageSync(this._cacheKey(guest));
      if (c && c.todos) return c;
    } catch (e) {}
    return clone(mock.DB);
  },

  _saveCache: function () {
    try { wx.setStorageSync(this._cacheKey(), this.globalData.db); } catch (e) {}
  },

  /* ================= 小工具 ================= */

  uid: function () {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  greeting: function () {
    var h = new Date().getHours();
    if (h < 6) return '夜深了，早点休息';
    if (h < 9) return '早上好，开始今天的创作';
    if (h < 12) return '上午好，开始今天的创作';
    if (h < 14) return '中午好，开始今天的创作';
    if (h < 18) return '下午好，开始今天的创作';
    return '晚上好，开始今天的创作';
  },

  todayText: function () {
    var d = new Date();
    var wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return '今天是 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日，星期' + wk + '，今天也要产出好内容 ✨';
  },

  toast: function (m) {
    wx.showToast({ title: m, icon: 'none' });
  },

  version: CONFIG.version
});
