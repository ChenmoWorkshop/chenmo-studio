/* 演示用示例数据：字段结构与云端数据库完全一致，
   接入云函数后只需把 mock 换成 wx.cloud.callFunction 的返回值即可 */

const DB = {
  todos: [
    { id: 't1', text: '写完公众号文章大纲', done: false, pri: 'mid' },
    { id: 't2', text: '录制本期播客片段', done: false, pri: 'mid' },
    { id: 't3', text: '回复粉丝评论', done: true, pri: 'low' },
    { id: 't4', text: '整理本周素材库', done: false, pri: 'mid' },
    { id: 't5', text: '剪辑短视频片头', done: false, pri: 'high' }
  ],
  ideas: [
    { id: 'i1', title: '用「一句话钩子」开头，前 3 秒抓住人', cat: '脚本', tags: [], note: '', time: '2026-09-30 21:12' },
    { id: 'i2', title: '做一期关于「灵感库怎么攒」的问答', cat: '选题', tags: [], note: '', time: '2026-09-29 09:40' },
    { id: 'i3', title: '把复盘模板做成可打印的一页纸', cat: '工具', tags: [], note: '', time: '2026-09-28 18:05' }
  ],
  contents: [
    { id: 'c1', title: '短视频脚本拆解：三幕结构怎么用', platform: '抖音', status: 'idea', plan: '2026-10-03', note: '' },
    { id: 'c2', title: '播客第 12 期：创作者的时间管理', platform: '小宇宙', status: 'doing', plan: '2026-10-05', note: '' },
    { id: 'c3', title: '公众号：如何建立一个不会崩的创作系统', platform: '公众号', status: 'doing', plan: '2026-10-08', note: '' },
    { id: 'c4', title: '九月创作复盘', platform: '公众号', status: 'published', plan: '2026-09-30', note: '' }
  ],
  reviews: [
    {
      id: 'r1',
      week: '2026-09 第40周',
      done: '公众号更新 2 篇，播客录了 1 期',
      stuck: '剪片子总是卡在配乐，一卡就拖两天',
      next: '先把配乐库整理好，剪片前定好 3 首备选',
      hi: '有读者留言说文章帮他理清了思路'
    }
  ]
};

const PROFILE = { name: '我的工作台', sub: '灵感 · 进度 · 复盘', avatar: '' };

const PRI_TEXT = { high: '高', mid: '中', low: '低' };
const STATUS_TEXT = { idea: '想法', doing: '制作中', published: '已发布' };

module.exports = { DB, PROFILE, PRI_TEXT, STATUS_TEXT };
