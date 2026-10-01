const app = getApp();

Page({
  data: {
    done: '',
    stuck: '',
    next: '',
    hi: '',
    list: [],
    total: 0,
    page: 1,
    size: 3,
    pages: 1
  },

  onShow: function () {
    this.render();
  },

  render: function () {
    const all = app.db().reviews;
    const size = this.data.size;
    const pages = Math.max(1, Math.ceil(all.length / size));
    let page = Math.min(this.data.page, pages);
    this.setData({
      list: all.slice((page - 1) * size, page * size),
      total: all.length,
      page: page,
      pages: pages
    });
  },

  onDone: function (e) { this.setData({ done: e.detail.value }); },
  onStuck: function (e) { this.setData({ stuck: e.detail.value }); },
  onNext: function (e) { this.setData({ next: e.detail.value }); },
  onHi: function (e) { this.setData({ hi: e.detail.value }); },

  clearForm: function () {
    this.setData({ done: '', stuck: '', next: '', hi: '' });
  },

  weekText: function () {
    const d = new Date();
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + ' 第' + week + '周';
  },

  saveReview: function () {
    const d = this.data.done.trim();
    const s = this.data.stuck.trim();
    const n = this.data.next.trim();
    const h = this.data.hi.trim();
    if (!d && !s && !n && !h) {
      app.toast('写点什么再保存吧');
      return;
    }
    app.db().reviews.unshift({
      id: app.uid(),
      week: this.weekText(),
      done: d,
      stuck: s,
      next: n,
      hi: h
    });
    app.save();
    this.setData({ done: '', stuck: '', next: '', hi: '', page: 1 });
    this.render();
    app.toast('复盘已保存');
  },

  turn: function (e) {
    const d = Number(e.currentTarget.dataset.d);
    const next = this.data.page + d;
    if (next < 1 || next > this.data.pages) return;
    this.setData({ page: next });
    this.render();
  },

  removeReview: function (e) {
    const id = e.currentTarget.dataset.id;
    const self = this;
    wx.showModal({
      title: '删除这条复盘？',
      content: '删除后无法恢复',
      success: function (res) {
        if (!res.confirm) return;
        const db = app.db();
        db.reviews = db.reviews.filter(function (x) { return x.id !== id; });
        app.save();
        self.render();
        app.toast('已删除');
      }
    });
  }
});
