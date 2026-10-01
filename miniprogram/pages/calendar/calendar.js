const app = getApp();

Page({
  data: {
    dows: ['一', '二', '三', '四', '五', '六', '日'],
    title: '',
    cells: [],
    monthList: []
  },

  onLoad: function () {
    const n = new Date();
    this.y = n.getFullYear();
    this.m = n.getMonth();
    this.render();
  },

  onShow: function () {
    this.render();
  },

  render: function () {
    const y = this.y;
    const m = this.m;
    const db = app.db();
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMon = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const dayNum = i - startDow + 1;
      const cd = new Date(y, m, dayNum);
      const date = cd.getFullYear() + '-' + pad(cd.getMonth() + 1) + '-' + pad(cd.getDate());
      const evs = db.contents.filter(function (c) { return c.plan === date; }).map(function (c) {
        return { id: c.id, title: c.title, status: c.status };
      });
      cells.push({
        date: date,
        num: dayNum < 1 ? prevDays + dayNum : dayNum > daysInMon ? dayNum - daysInMon : dayNum,
        other: dayNum < 1 || dayNum > daysInMon,
        today: today.getFullYear() === y && today.getMonth() === m && today.getDate() === dayNum,
        evs: evs
      });
    }

    const prefix = y + '-' + pad(m + 1);
    const monthList = db.contents
      .filter(function (c) { return c.plan && c.plan.indexOf(prefix) === 0; })
      .sort(function (a, b) { return a.plan < b.plan ? -1 : 1; });

    this.setData({
      title: y + '年' + (m + 1) + '月',
      cells: cells,
      monthList: monthList
    });
  },

  prevMonth: function () {
    this.m--;
    if (this.m < 0) {
      this.m = 11;
      this.y--;
    }
    this.render();
  },

  nextMonth: function () {
    this.m++;
    if (this.m > 11) {
      this.m = 0;
      this.y++;
    }
    this.render();
  },

  tapDay: function (e) {
    const date = e.currentTarget.dataset.date;
    const items = app.db().contents.filter(function (c) { return c.plan === date; });
    if (!items.length) return;
    wx.showModal({
      title: date,
      content: items.map(function (c) { return '· ' + c.title; }).join('\n'),
      showCancel: false
    });
  },

  tapEvent: function (e) {
    const id = e.currentTarget.dataset.id;
    const c = app.db().contents.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    wx.showModal({
      title: c.title,
      content: (c.platform ? '平台：' + c.platform + '\n' : '') + '计划：' + (c.plan || '未排期'),
      showCancel: false
    });
  }
});
