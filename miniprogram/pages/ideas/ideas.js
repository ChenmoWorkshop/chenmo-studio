const app = getApp();

Page({
  data: {
    formOpen: true,
    title: '',
    cat: '',
    cats: [],
    filter: 'all',
    list: [],
    page: 1,
    size: 5,
    pages: 1
  },

  onShow: function () {
    const cats = [];
    app.db().ideas.forEach(function (i) {
      if (i.cat && cats.indexOf(i.cat) < 0) cats.push(i.cat);
    });
    this.setData({ cats: cats });
    this.render();
  },

  render: function () {
    const all = app.db().ideas;
    const f = this.data.filter;
    let items = all.slice();
    if (f !== 'all') {
      items = items.filter(function (i) { return i.cat === f; });
    }
    const size = this.data.size;
    const pages = Math.max(1, Math.ceil(items.length / size));
    let page = Math.min(this.data.page, pages);
    this.setData({
      list: items.slice((page - 1) * size, page * size),
      page: page,
      pages: pages
    });
  },

  toggleForm: function () {
    this.setData({ formOpen: !this.data.formOpen });
  },

  onTitle: function (e) {
    this.setData({ title: e.detail.value });
  },

  onCat: function (e) {
    this.setData({ cat: e.detail.value });
  },

  addIdea: function () {
    const t = (this.data.title || '').trim();
    if (!t) {
      app.toast('先写点内容吧');
      return;
    }
    const d = new Date();
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    app.db().ideas.unshift({
      id: app.uid(),
      title: t,
      cat: (this.data.cat || '').trim() || '未分类',
      tags: [],
      note: '',
      time: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    });
    app.save();
    this.setData({ title: '', cat: '', page: 1, filter: 'all' });
    this.onShow();
    app.toast('已记录');
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

  editIdea: function (e) {
    const id = e.currentTarget.dataset.id;
    const i = app.db().ideas.filter(function (x) { return x.id === id; })[0];
    if (!i) return;
    const self = this;
    wx.showModal({
      title: '编辑灵感',
      editable: true,
      placeholderText: '灵感内容',
      content: i.title,
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          i.title = res.content.trim();
          app.save();
          self.render();
        }
      }
    });
  }
});
