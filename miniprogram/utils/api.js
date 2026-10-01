/* 业务接口封装：每个函数对应云函数里的一个 action，
   页面只认这里的语义名，不关心 action 字符串与鉴权细节 */
const cloud = require('./cloud.js');

/* —— 登录与身份 —— */
/* 微信一键登录：已绑过直接换回登录态（bound=true），没绑过返回 bound=false 由页面引导绑定 */
function wxLogin() {
  return cloud.call('wxlogin', {}, { noAuth: true });
}

/* 首次绑定：用账号密码证明「这个账号是你的」，之后记在云端 openid 上 */
function wxBind(user, pass) {
  return cloud.call('wxbind', { user: user, pass: pass }, { noAuth: true });
}

/* 解绑当前微信（换微信号/换手机时用），需登录态 */
function wxUnbind() {
  return cloud.call('wxunbind', {});
}

/* 账号密码登录（网页版同款接口，小程序留作兜底） */
function login(user, pass) {
  return cloud.call('login', { user: user, pass: pass }, { noAuth: true });
}

/* 启动时验活：token 还有效就返回最新资料 */
function me() {
  return cloud.call('me', {});
}

function logout() {
  return cloud.call('logout', {});
}

/* —— 数据 —— */
function loadAll() { return cloud.call('loadAll', {}); }

function save(key, items) { return cloud.call('save', { key: key, items: items }); }

/* —— 资料 —— */
function updateProfile(patch) { return cloud.call('updateProfile', patch); }

/* —— 密保邮箱（找回密码 / 换绑） —— */
/* 发验证码：bind 需登录态 + email；reset 只需账号名（验证码发到该账号绑定的邮箱） */
function sendEmailCode(purpose, email, user) {
  var payload = { purpose: purpose };
  if (purpose === 'bind') payload.email = email || '';
  else payload.user = user || '';
  return cloud.call('sendEmailCode', payload, purpose === 'bind' ? {} : { noAuth: true });
}

function bindEmail(email, code) {
  return cloud.call('bindEmail', { email: email, code: code });
}

function resetPassword(user, code, pass) {
  return cloud.call('resetPassword', { user: user, code: code, pass: pass }, { noAuth: true });
}

module.exports = {
  wxLogin: wxLogin,
  wxBind: wxBind,
  wxUnbind: wxUnbind,
  login: login,
  me: me,
  logout: logout,
  loadAll: loadAll,
  save: save,
  updateProfile: updateProfile,
  sendEmailCode: sendEmailCode,
  bindEmail: bindEmail,
  resetPassword: resetPassword
};
