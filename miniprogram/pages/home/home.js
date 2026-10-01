const app = getApp();
const quote = require('../../utils/quote.js');
const mock = require('../../mock/data.js');

Page({
  data: {
    profile: {},
    greeting: '',
    today: '',
    quoteText: '',
    quoteAuthor: '',
    filter: 'all',
    input: '',
    pri: 'mid',
    priText: '中',
    priOpen: false,
    todos: [],
    total: 0,
    left: 0,
    page: 1,
    size: 4,
    pages: 1,
    stats: []
  },

  onLoad: function () {
    this.qs = quote.dayQuotes();
    this.qi = quote.slotIndex() % this.qs.length;
    this.setData({
      profile: app.profile(),
      greeting: app.greeting(),
      today: app.todayText()
    });
    this.showQuote();
  },

  onShow: function () {
    this.setData({ profile: app.profile(), greeting: app.greeting() });
    this.render();
  },

  /* ---------- 每日名言 ---------- */
  showQuote: function () {
    const q = this.qs[this.qi] || ['', ''];
    this.setData({ quoteText: q[0], quoteAuthor: q[1] });
  },

  nextQuote: function () {
    this.qi = (this.qi + 1) % this.qs.length;
    this.showQuote();
  },

  /* ---------- 列表渲染 ---------- */
  render: function () {
    const db = app.db();
    const all = db.todos;
    let items = all.slice();
    if (this.data.filter === 'high') items = items.filter(function (t) { return t.pri === 'high'; });
    if (this.data.filter === 'todo') items = items.filter(function (t) { return !t.done; });

    const size = this.data.size;
    const pages = Math.max(1, Math.ceil(items.length / size));
    let page = this.data.page;
    if (page > pages) page = pages;
    if (page < 1) page = 1;

    const todos = items.slice((page - 1) * size, page * size).map(function (t) {
      return { id: t.id, text: t.text, done: t.done, pri: t.pri, priText: mock.PRI_TEXT[t.pri] };
    });

    const contents = db.contents;
    const nIdea = contents.filter(function (c) { return c.status === 'idea'; }).length;
    const nDoing = contents.filter(function (c) { return c.status === 'doing'; }).length;
    const nPub = contents.filter(function (c) { return c.status === 'published'; }).length;
    const max = Math.max(nIdea, nDoing, nPub, 1);

    this.setData({
      todos: todos,
      page: page,
      pages: pages,
      total: all.length,
      left: all.filter(function (t) { return !t.done; }).length,
      stats: [
        { key: 'idea', name: '想法', n: nIdea, pct: Math.round((nIdea / max) * 100) },
        { key: 'doing', name: '制作中', n: nDoing, pct: Math.round((nDoing / max) * 100) },
        { key: 'published', name: '已发布', n: nPub, pct: Math.round((nPub / max) * 100) }
      ]
    });
  },

  /* ---------- 交互 ---------- */
  onInput: function (e) {
    this.setData({ input: e.detail.value });
  },

  togglePri: function () {
    this.setData({ priOpen: !this.data.priOpen });
  },

  pickPri: function (e) {
    const v = e.currentTarget.dataset.v;
    this.setData({ pri: v, priText: mock.PRI_TEXT[v], priOpen: false });
  },

  addTodo: function () {
    const v = (this.data.input || '').trim();
    if (!v) {
      app.toast('先写点内容吧');
      return;
    }
    app.db().todos.unshift({ id: app.uid(), text: v, done: false, pri: this.data.pri });
    app.save();
    this.setData({ input: '', page: 1 });
    this.render();
    app.toast('已添加到今日重点');
  },

  toggleDone: function (e) {
    const id = e.currentTarget.dataset.id;
    const t = app.db().todos.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    t.done = !t.done;
    app.save();
    this.render();
  },

  editTodo: function (e) {
    const id = e.currentTarget.dataset.id;
    const db = app.db();
    const t = db.todos.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    const self = this;
    wx.showModal({
      title: '编辑待办',
      editable: true,
      placeholderText: '待办内容',
      content: t.text,
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          t.text = res.content.trim();
          app.save();
          self.render();
        }
      }
    });
  },

  setFilter: function (e) {
    this.setData({ filter: e.currentTarget.dataset.f, page: 1 });
    this.render();
  },

  turn: function (e) {
    const d = Number(e.currentTarget.dataset.d);
    const next = this.data.page + d;
    if (next < 1 || next > this.data.pages) return;
    this.setData({ page: next });
    this.render();
  },

  goProfile: function () {
    wx.navigateTo({ url: '/pages/profile/profile' });
  }
});
