/* 云调用层：只负责「怎么调云函数」和「登录态放哪」，
   业务语义（登录/绑定/读写数据）放在 utils/api.js */
const CONFIG = require('../config.js');

var _inited = false;
var _available = false;
var _token = '';

/* 初始化云开发。失败不抛错，返回 false 交给上层降级 */
function init() {
  if (_inited) return _available;
  _inited = true;
  try {
    if (!wx.cloud) {
      console.warn('[cloud] 当前基础库不支持云开发，降级为本地演示模式');
      _available = false;
      return false;
    }
    wx.cloud.init({ env: CONFIG.env, traceUser: true });
    _available = true;
  } catch (e) {
    console.warn('[cloud] 初始化失败，降级为本地演示模式：', e && e.message);
    _available = false;
  }
  return _available;
}

function available() { return _available; }

function setToken(t) {
  _token = t || '';
  try { _token ? wx.setStorageSync('cwb_mp_token', _token) : wx.removeStorageSync('cwb_mp_token'); } catch (e) {}
}

function token() {
  if (_token) return _token;
  try { _token = wx.getStorageSync('cwb_mp_token') || ''; } catch (e) { _token = ''; }
  return _token;
}

function clearToken() { setToken(''); }

/* 统一调用：Promise 化 + 自动带 token（noAuth 的接口除外） */
function call(action, data, opts) {
  var o = opts || {};
  return new Promise(function (resolve, reject) {
    if (!init()) { reject(new Error('cloud-unavailable')); return; }
    var payload = Object.assign({ action: action }, data || {});
    if (!o.noAuth) {
      var tk = token();
      if (tk) payload.token = tk;
    }
    wx.cloud.callFunction({
      name: CONFIG.fn,
      data: payload,
      success: function (res) {
        var r = res && res.result;
        if (r == null) { reject(new Error('empty-result')); return; }
        resolve(r);
      },
      fail: function (err) { reject(err); }
    });
  });
}

module.exports = {
  init: init,
  available: available,
  call: call,
  setToken: setToken,
  token: token,
  clearToken: clearToken
};
