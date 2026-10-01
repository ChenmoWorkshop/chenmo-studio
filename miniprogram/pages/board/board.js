const app = getApp();
const mock = require('../../mock/data.js');

const COLS = [
  { key: 'idea', name: '想法', icon: '💡' },
  { key: 'doing', name: '制作中', icon: '🎬' },
  { key: 'published', name: '已发布', icon: '✅' }
];

Page({
  data: {
    filter: 'all',
    groups: []
  },

  onShow: function () {
    this.render();
  },

  render: function () {
    const db = app.db();
    const filter = this.data.filter;
    const sizeAll = 3;
    const sizeOne = 5;
    const pg = this.pg || {};

    const groups = COLS
      .filter(function (c) { return filter === 'all' || filter === c.key; })
      .map(function (c) {
        const items = db.contents.filter(function (x) { return x.status === c.key; });
        const size = filter === 'all' ? sizeAll : sizeOne;
        const pages = Math.max(1, Math.ceil(items.length / size));
        let page = pg[c.key] || 1;
        if (page > pages) page = pages;
        pg[c.key] = page;
        return {
          key: c.key,
          name: c.name,
          icon: c.icon,
          total: items.length,
          page: page,
          pages: pages,
          items: items.slice((page - 1) * size, page * size).map(function (x) {
            return {
              id: x.id,
              title: x.title,
              platform: x.platform,
              plan: x.plan,
              status: x.status,
              statusText: mock.STATUS_TEXT[x.status]
            };
          })
        };
      });

    this.pg = pg;
    this.setData({ groups: groups });
  },

  setFilter: function (e) {
    this.pg = {};
    this.setData({ filter: e.currentTarget.dataset.f });
    this.render();
  },

  turn: function (e) {
    const key = e.currentTarget.dataset.key;
    const d = Number(e.currentTarget.dataset.d);
    this.pg = this.pg || {};
    this.pg[key] = (this.pg[key] || 1) + d;
    this.render();
  },

  find: function (id) {
    return app.db().contents.filter(function (x) { return x.id === id; })[0];
  },

  editContent: function (e) {
    const self = this;
    const c = this.find(e.currentTarget.dataset.id);
    if (!c) return;
    wx.showModal({
      title: '编辑标题',
      editable: true,
      placeholderText: '内容标题',
      content: c.title,
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          c.title = res.content.trim();
          app.save();
          self.render();
        }
      }
    });
  },

  changeStatus: function (e) {
    const self = this;
    const c = this.find(e.currentTarget.dataset.id);
    if (!c) return;
    const keys = ['idea', 'doing', 'published'];
    wx.showActionSheet({
      itemList: ['想法', '制作中', '已发布', '删除这条'],
      success: function (res) {
        if (res.tapIndex === 3) {
          const db = app.db();
          db.contents = db.contents.filter(function (x) { return x.id !== c.id; });
          app.save();
          self.pg = {};
          self.render();
          app.toast('已删除');
          return;
        }
        c.status = keys[res.tapIndex];
        app.save();
        self.pg = {};
        self.render();
        app.toast('已切换到「' + mock.STATUS_TEXT[c.status] + '」');
      }
    });
  },

  addContent: function () {
    const self = this;
    wx.showModal({
      title: '新建内容',
      editable: true,
      placeholderText: '例如 公众号：本周选题',
      success: function (res) {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        app.db().contents.unshift({
          id: app.uid(),
          title: res.content.trim(),
          platform: '公众号',
          status: 'idea',
          plan: '',
          note: ''
        });
        app.save();
        self.pg = {};
        self.setData({ filter: 'all' });
        self.render();
        app.toast('已创建');
      }
    });
  }
});
