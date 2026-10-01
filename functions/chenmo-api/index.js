/* 尘墨工坊 · 云端数据代理
   前端页面部署在 WorkBuddy 域名（不在 CloudBase 安全域名白名单内，无法直接调 SDK），
   因此由本函数代为读写数据库：函数本身运行在 CloudBase 内，拥有管理员权限，
   并按需下发 CORS 头，让 WorkBuddy 域名可以跨域调用。 */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const ENV = 'chenmo-d9gcmpopbed61c597';
const COL = 'workbench_state';
const USERS_COL = 'chenmo_users';      /* 账号：_id = 小写账号名 */
const SESS_COL = 'chenmo_sessions';    /* 会话：_id = token */
const WXBIND_COL = 'chenmo_wxbind';    /* 微信绑定：_id = openid，值 = { uid } */
const KEYS = ['todos', 'ideas', 'contents', 'reviews'];
const LEGACY_UID = 'chenmo';           /* 加账号前的老数据归属：首个账号自动继承 */
const TOKEN_TTL = 90 * 24 * 3600 * 1000; /* 登录态 90 天 */

/* ── 自助注册开关 ──────────────────────────────────────────────────────
   为什么默认关闭：本仓库 index.html 里硬编码了作者自己的云函数访问地址，
   环境标识是公开的。一旦开放自助注册，任何人扫到这个地址都能批量建号，
   把账号表撑大、把免费资源点刷空——体验版超量会直接停服（不扣费也无法加钱），
   届时作者自己和所有真实用户一起打不开。

   需要给朋友开号时：
     1. 把 ALLOW_REGISTER 改成 true，重新部署本函数
     2. 让对方完成注册
     3. 改回 false，再部署一次
   ──────────────────────────────────────────────────────────────────── */
const ALLOW_REGISTER = false;
const DOC_IDS = {
  todos:    '00000000c0ffee0000000001',
  ideas:    '00000000c0ffee0000000002',
  contents: '00000000c0ffee0000000003',
  reviews:  '00000000c0ffee0000000004'
};
const QUOTE_DOC_ID = '00000000c0ffee0000000005';

/* ============ 每日一言词库（哲学家/思想家为主，中西方古今） ============ */
const QUOTES = [
  ['知人者智，自知者明。', '老子'],
  ['千里之行，始于足下。', '老子'],
  ['上善若水，水善利万物而不争。', '老子'],
  ['知足者富，强行者有志。', '老子'],
  ['知之者不如好之者，好之者不如乐之者。', '孔子'],
  ['君子和而不同，小人同而不和。', '孔子'],
  ['三人行，必有我师焉。', '孔子'],
  ['岁寒，然后知松柏之后凋也。', '孔子'],
  ['虽千万人，吾往矣。', '孟子'],
  ['生于忧患，死于安乐。', '孟子'],
  ['富贵不能淫，贫贱不能移，威武不能屈。', '孟子'],
  ['吾生也有涯，而知也无涯。', '庄子'],
  ['君子之交淡若水，小人之交甘若醴。', '庄子'],
  ['相濡以沫，不如相忘于江湖。', '庄子'],
  ['不积跬步，无以至千里；不积小流，无以成江海。', '荀子'],
  ['锲而不舍，金石可镂。', '荀子'],
  ['志不强者智不达，言不信者行不果。', '墨子'],
  ['天行健，君子以自强不息。', '《周易》'],
  ['穷则变，变则通，通则久。', '《周易》'],
  ['工欲善其事，必先利其器。', '《论语》'],
  ['路漫漫其修远兮，吾将上下而求索。', '屈原'],
  ['博学之，审问之，慎思之，明辨之，笃行之。', '《中庸》'],
  ['非淡泊无以明志，非宁静无以致远。', '诸葛亮'],
  ['盛年不重来，一日难再晨。', '陶渊明'],
  ['穷且益坚，不坠青云之志。', '王勃'],
  ['长风破浪会有时，直挂云帆济沧海。', '李白'],
  ['会当凌绝顶，一览众山小。', '杜甫'],
  ['业精于勤，荒于嬉；行成于思，毁于随。', '韩愈'],
  ['沉舟侧畔千帆过，病树前头万木春。', '刘禹锡'],
  ['先天下之忧而忧，后天下之乐而乐。', '范仲淹'],
  ['腹有诗书气自华。', '苏轼'],
  ['竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。', '苏轼'],
  ['纸上得来终觉浅，绝知此事要躬行。', '陆游'],
  ['问渠那得清如许？为有源头活水来。', '朱熹'],
  ['人生自古谁无死，留取丹心照汗青。', '文天祥'],
  ['青山遮不住，毕竟东流去。', '辛弃疾'],
  ['知是行之始，行是知之成。', '王阳明'],
  ['此心光明，亦复何言。', '王阳明'],
  ['风来疏竹，风过而竹不留声。', '《菜根谭》'],
  ['千磨万击还坚劲，任尔东西南北风。', '郑板桥'],
  ['天下兴亡，匹夫有责。', '顾炎武'],
  ['海纳百川，有容乃大；壁立千仞，无欲则刚。', '林则徐'],
  ['发上等愿，结中等缘，享下等福。', '左宗棠'],
  ['物来顺应，未来不迎，当时不杂，既过不恋。', '曾国藩'],
  ['天下事，在局外呐喊议论总是无益，必须躬身入局。', '曾国藩'],
  ['为天地立心，为生民立命，为往圣继绝学，为万世开太平。', '张载'],
  ['我自横刀向天笑，去留肝胆两昆仑。', '谭嗣同'],
  ['愿中国青年都摆脱冷气，只是向上走。', '鲁迅'],
  ['其实地上本没有路，走的人多了，也便成了路。', '鲁迅'],
  ['无穷的远方，无数的人们，都和我有关。', '鲁迅'],
  ['青年之字典，无困难之字；青年之口头，无障碍之语。', '李大钊'],
  ['捧着一颗心来，不带半根草去。', '陶行知'],
  ['独立之精神，自由之思想。', '陈寅恪'],
  ['人不可有傲气，但不可无傲骨。', '徐悲鸿'],
  ['怕什么真理无穷，进一寸有一寸的欢喜。', '胡适'],
  ['未经审视的人生不值得过。', '苏格拉底'],
  ['我唯一知道的，就是我一无所知。', '苏格拉底'],
  ['耐心是一切聪明才智的基础。', '柏拉图'],
  ['良好的开端，等于成功的一半。', '柏拉图'],
  ['人生最终的价值在于觉醒和思考的能力，而不只在于生存。', '亚里士多德'],
  ['优秀不是一种行为，而是一种习惯。', '亚里士多德'],
  ['吾爱吾师，吾更爱真理。', '亚里士多德'],
  ['只要一息尚存，就应该不断学习。', '西塞罗'],
  ['死亡与我们无关，因为我们存在时，死亡尚未来临。', '伊壁鸠鲁'],
  ['人不能两次踏进同一条河流。', '赫拉克利特'],
  ['不要挡住我的阳光。', '第欧根尼'],
  ['生命并非短促，是我们荒废了太多。', '塞涅卡'],
  ['扰乱人心的不是事情本身，而是我们对事情的看法。', '爱比克泰德'],
  ['人所失去的，只是他此刻拥有的生活。', '马可·奥勒留'],
  ['一个人退隐到哪里，都不如退入自己的心灵更为宁静。', '马可·奥勒留'],
  ['人是一根会思想的芦苇。', '帕斯卡尔'],
  ['我思，故我在。', '笛卡尔'],
  ['自由的人最少想到死。', '斯宾诺莎'],
  ['美不是事物本身的属性，它只存在于观赏者的心中。', '休谟'],
  ['人生而自由，却无往不在枷锁之中。', '卢梭'],
  ['头顶的星空和心中的道德律，越是思考越觉常新。', '康德'],
  ['一个民族有一群仰望星空的人，他们才有希望。', '黑格尔'],
  ['人生就像钟摆，在痛苦和无聊之间摆动。', '叔本华'],
  ['读书，是让别人在我们的脑袋里跑马。', '叔本华'],
  ['生活只能倒着被理解，但必须正着被经历。', '克尔凯郭尔'],
  ['哲学家们只是用不同的方式解释世界，而问题在于改变世界。', '马克思'],
  ['在科学上没有平坦的大道，只有不畏劳苦沿着陡峭山路攀登的人，才有希望达到光辉的顶点。', '马克思'],
  ['任何时候我也不会满足，越是多读书，就越是深刻地感到不满足，越感到自己知识贫乏。', '马克思'],
  ['有所作为是生活的最高境界。', '恩格斯'],
  ['每一个不曾起舞的日子，都是对生命的辜负。', '尼采'],
  ['凡杀不死我的，必使我更强大。', '尼采'],
  ['对待生命，你不妨大胆一点，因为我们终要失去它。', '尼采'],
  ['其实人跟树是一样的，越是向往高处的阳光，根就越要伸向深深的地底。', '尼采'],
  ['当你凝视深渊时，深渊也在凝视你。', '尼采'],
  ['人充满劳绩，但仍然诗意地栖居在这片大地上。', '荷尔德林'],
  ['我们都生活在阴沟里，但仍有人仰望星空。', '王尔德'],
  ['做你自己，因为别人都有人做了。', '王尔德'],
  ['世界上只有一种真正的英雄主义，那就是认清生活的真相之后依然热爱生活。', '罗曼·罗兰'],
  ['向外看的人在做梦，向内看的人才清醒。', '荣格'],
  ['你没有觉察到的事情，就会变成你的命运。', '荣格'],
  ['未被表达的情绪永远不会消亡，它们只是被活埋了，有朝一日会以更丑陋的方式涌现。', '弗洛伊德'],
  ['幸运的人一生都被童年治愈，不幸的人一生都在治愈童年。', '阿德勒'],
  ['不成熟的爱是因为我需要你，所以我爱你；成熟的爱是因为我爱你，所以我需要你。', '弗洛姆'],
  ['凡是可说的，都可以说清楚；凡是不可说的，就应当保持沉默。', '维特根斯坦'],
  ['人是自己选择的总和。', '萨特'],
  ['在隆冬，我终于知道，我身上有一个不可战胜的夏天。', '加缪'],
  ['对未来的真正慷慨，是把一切献给现在。', '加缪'],
  ['攀登山顶的奋斗本身，就足以充实人的心灵。', '加缪'],
  ['须知参差多态，乃是幸福的本源。', '罗素'],
  ['对知识的追求、对人类苦难不可遏制的同情，是支配我一生的单纯而强烈的力量。', '罗素'],
  ['大多数人都生活在平静的绝望之中。', '梭罗'],
  ['怎样思想，就有怎样的生活。', '爱默生'],
  ['在任何境遇中选择自己态度的自由，是谁也夺不走的。', '弗兰克尔'],
  ['凡是过往，皆为序章。', '莎士比亚'],
  ['简洁是智慧的灵魂，冗长是肤浅的藻饰。', '莎士比亚'],
  ['谁不能主宰自己，永远是一个奴隶。', '歌德'],
  ['人可以在社会中学习，然而灵感只有在孤独的时候才会涌现。', '歌德'],
  ['人只有在游戏时，才是完整的人。', '席勒'],
  ['卓越的人的一大优点，是在不利与艰难的遭遇里百折不挠。', '贝多芬'],
  ['假如生活欺骗了你，不要悲伤，不要心急。', '普希金'],
  ['每个人都想改变世界，却没有人想改变自己。', '托尔斯泰'],
  ['我只怕一件事：怕我配不上自己所受的苦难。', '陀思妥耶夫斯基'],
  ['要爱具体的人，不要爱抽象的人。', '陀思妥耶夫斯基'],
  ['明天，明天，还有明天——这个明天足以把人送进坟墓。', '屠格涅夫'],
  ['生活总让我们遍体鳞伤，但到后来，那些受伤的地方一定会变成我们最强壮的地方。', '海明威'],
  ['命运赠送的礼物，早已在暗中标好了价格。', '茨威格'],
  ['一句真话比整个世界的分量还重。', '索尔仁尼琴'],
  ['人不是活一辈子，而是活那么几个难忘的瞬间。', '帕斯捷尔纳克'],
  ['书必须是砍向我们内心冰封大海的斧头。', '卡夫卡'],
  ['哪有什么胜利可言，挺住意味着一切。', '里尔克'],
  ['要容忍心里难解的疑惑，试着去爱问题本身。', '里尔克'],
  ['如果你觉得日常生活很贫乏，不要抱怨生活，要抱怨你自己。', '里尔克'],
  ['对每个人而言，真正的职责只有一个：找到自我。', '黑塞'],
  ['世界以痛吻我，要我报之以歌。', '泰戈尔'],
  ['天空没有留下翅膀的痕迹，但我已经飞过。', '泰戈尔'],
  ['我们已经走得太远，以至于忘记了为什么而出发。', '纪伯伦'],
  ['如果有天堂，天堂应该是图书馆的模样。', '博尔赫斯'],
  ['生活不是我们活过的日子，而是我们记住的日子。', '马尔克斯'],
  ['如果你想造一艘船，先不要雇人收集木头，而是先唤起人们对大海的渴望。', '圣埃克苏佩里'],
  ['想象力比知识更重要。', '爱因斯坦'],
  ['不要试图去做一个成功的人，要努力成为一个有价值的人。', '爱因斯坦'],
  ['生活中没有什么可怕的东西，只有需要理解的东西。', '居里夫人'],
  ['空袋子难以直立。', '富兰克林'],
  ['以温柔的方式，你可以撼动世界。', '甘地'],
  ['生命中最伟大的光辉不在于永不坠落，而是坠落后总能再度升起。', '曼德拉'],
  ['求知若饥，虚心若愚。', '乔布斯'],
  ['内心不渴望的东西，它不可能靠近自己。', '稻盛和夫'],
  ['世界上最伟大的事，是一个人懂得如何做自己的主人。', '蒙田'],
  ['知识就是力量。', '培根'],
  ['林中有两条路，我选了人迹更少的那条，从此决定了我一生的道路。', '弗罗斯特'],
  ['你来人间一趟，你要看看太阳。', '海子'],
  ['黑夜给了我黑色的眼睛，我却用它寻找光明。', '顾城'],
  ['岁月不饶人，我亦未曾饶过岁月。', '木心'],
  ['所谓无底深渊，下去，也是前程万里。', '木心'],
  ['你的问题主要在于读书不多而想得太多。', '杨绛'],
  ['走好选择的路，别选择好走的路。', '杨绛'],
  ['人的一切痛苦，本质上都是对自己无能的愤怒。', '王小波'],
  ['一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。', '王小波'],
  ['且视他人之疑目如盏盏鬼火，大胆地去走你的夜路。', '史铁生'],
  ['命定的局限尽可永在，不屈的挑战却不可须臾或缺。', '史铁生'],
  ['四方食事，不过一碗人间烟火。', '汪曾祺'],
  ['人是为活着本身而活着的，而不是为了活着之外的任何事物所活着。', '余华'],
  ['心之何如，有似万丈迷津，遥亘千里，其中并无舟子可以渡人，除了自渡，他人爱莫能助。', '三毛'],
  ['假话全不说，真话不全说。', '季羡林'],
  ['说真话不应当是艰难的事情。', '巴金'],
  ['天下就没有偶然，那不过是化了妆的、戴了面具的必然。', '钱钟书'],
  ['如今我们深夜饮酒，杯子碰到一起，都是梦破碎的声音。', '北岛']
];

/* 中方作者（含中国典籍）：其余一律归入西方/外国，用于每日“中西各五条” */
const CN_AUTHORS = [
  '老子', '孔子', '孟子', '庄子', '荀子', '墨子', '《周易》', '《论语》', '屈原', '《中庸》',
  '诸葛亮', '陶渊明', '王勃', '李白', '杜甫', '韩愈', '刘禹锡', '范仲淹', '苏轼', '陆游',
  '朱熹', '文天祥', '辛弃疾', '王阳明', '《菜根谭》', '郑板桥', '顾炎武', '林则徐', '左宗棠',
  '曾国藩', '张载', '谭嗣同', '鲁迅', '李大钊', '陶行知', '陈寅恪', '徐悲鸿', '胡适',
  '海子', '顾城', '木心', '杨绛', '王小波', '史铁生', '汪曾祺', '余华', '三毛', '季羡林',
  '巴金', '钱钟书', '北岛'
];
const CN_POOL = QUOTES.filter(function (q) { return CN_AUTHORS.indexOf(q[1]) >= 0; });
const WEST_POOL = QUOTES.filter(function (q) { return CN_AUTHORS.indexOf(q[1]) < 0; });

/* 每天 10 条：中方 5 条 + 西方 5 条，交替排列；跨天整体顺推 5 条，保证每天都是新的一组 */
function dailyQuotes(dayKey) {
  const out = [];
  const cnStart = ((dayKey * 5) % CN_POOL.length + CN_POOL.length) % CN_POOL.length;
  const westStart = ((dayKey * 5) % WEST_POOL.length + WEST_POOL.length) % WEST_POOL.length;
  for (let i = 0; i < 5; i++) {
    const c = CN_POOL[(cnStart + i) % CN_POOL.length];
    const w = WEST_POOL[(westStart + i) % WEST_POOL.length];
    out.push({ text: c[0], author: c[1], side: 'cn' });
    out.push({ text: w[0], author: w[1], side: 'west' });
  }
  return out;
}

/* 允许跨域的来源白名单（体验版无法在控制台加安全域名，改由函数侧下发 CORS） */
const ALLOW_ORIGINS = [
  'https://chenmo.app.workbuddy.host',
  'https://chenmo-studio.app.workbuddy.host',
  'http://localhost:8899',
  'http://127.0.0.1:8899'
];

let _app = null;
function app() {
  if (!_app) _app = cloudbase.init({ env: ENV });
  return _app;
}

/* WorkBuddy 托管域一律放行，这样以后换短域名不用重新部署函数 */
function hostOf(origin) {
  return String(origin || '').replace(/^https?:\/\//, '').split(':')[0].toLowerCase();
}
function isAllowed(origin) {
  if (ALLOW_ORIGINS.indexOf(origin) >= 0) return true;
  const h = hostOf(origin);
  return h === 'app.workbuddy.host' || /\.app\.workbuddy\.host$/.test(h);
}

function corsHeaders(origin) {
  const allow = isAllowed(origin) && origin ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function resp(statusCode, headers, obj) {
  return {
    isBase64Encoded: false,
    statusCode: statusCode,
    headers: headers,
    body: JSON.stringify(obj)
  };
}

function parseBody(event) {
  let raw = event.body;
  /* 小程序 wx.cloud.callFunction 没有 HTTP 包装，event 本身就是业务参数对象 */
  if ((raw == null || raw === '') && !event.httpMethod) {
    return Object.assign({}, event);
  }
  if (raw == null || raw === '') return {};
  if (event.isBase64Encoded) {
    try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) {}
  }
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

/* 北京时间今天 'YYYY-MM-DD'（函数容器是 UTC，手动 +8h） */
function todayCN() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/* 北京时间“天序号 + 时段序号”：每天 10 个时段（每 2.4 小时轮换一条） */
function quoteClock() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const dayKey = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const slot = Math.floor((d.getUTCHours() * 60 + d.getUTCMinutes()) / 144); /* 0-9 */
  return { dayKey: dayKey, slot: slot };
}

/* 全局序号：dayKey*10 让词库逐日顺推，覆盖完所有条目后循环 */
function quoteIndexAt(dayKey, slot) {
  return ((dayKey * 10 + slot) % QUOTES.length + QUOTES.length) % QUOTES.length;
}

/* ============ 账号体系：加盐哈希 + 会话 token ============ */
function uidOf(user) { return String(user || '').trim().toLowerCase(); }

/* ============ 微信身份（小程序端专用） ============
   两条链路天然隔离：
   - 网页版走 HTTP 访问服务 → 平台不注入微信上下文，本函数拿不到 openid
   - 小程序走 wx.cloud.callFunction → 平台注入进程环境变量 WX_OPENID
   因此「HTTP 请求里带 openid」一律不认，避免伪造他人身份登录。 */
function wxOpenid(event) {
  if (event && event.httpMethod) return '';
  const fromEnv = process.env.WX_OPENID || process.env.OPENID || '';
  if (fromEnv) return String(fromEnv).trim();
  const ui = (event && event.userInfo) || {};
  const fromInfo = ui.openId || ui.OPENID || ui.openid || '';
  if (fromInfo) return String(fromInfo).trim();
  /* 最后兜底：非 HTTP 调用只可能来自本环境绑定的小程序，允许显式传入 */
  return String((event && event.openid) || '').trim();
}
function newSalt() { return crypto.randomBytes(16).toString('hex'); }
function hashOf(pass, salt) { return crypto.scryptSync(String(pass), salt, 32).toString('hex'); }
function safeEq(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && A.length > 0 && crypto.timingSafeEqual(A, B);
}
function docId(uid, key) { return uid + '__' + key; }

/* 取单文档：SDK 在文档不存在时会抛错，这里统一吞掉返回 null */
async function getDoc(db, col, id) {
  try {
    const r = await db.collection(col).doc(id).get();
    let d = (r.data && (r.data[0] || r.data)) || null;
    if (Array.isArray(d)) d = d[0] || null;
    return d || null;
  } catch (e) { return null; }
}

async function getUser(db, uid) { return getDoc(db, USERS_COL, uid); }

function publicProfile(u) {
  return { user: u.user, name: u.name || '我的工作台', sub: u.sub || '灵感 · 进度 · 复盘', avatar: u.avatar || '' };
}

async function issueToken(db, uid) {
  const t = crypto.randomBytes(24).toString('hex');
  await db.collection(SESS_COL).doc(t).set({
    uid: uid, exp: Date.now() + TOKEN_TTL, created_at: new Date().toISOString()
  });
  return t;
}

/* 校验 token → 返回 { uid, user }；无效/过期返回 null */
async function authUser(db, token) {
  if (!token) return null;
  const s = await getDoc(db, SESS_COL, String(token));
  if (!s || !s.uid) return null;
  if (s.exp && Date.now() > s.exp) return null;
  const u = await getUser(db, s.uid);
  return u ? { uid: s.uid, user: u } : null;
}

/* 加账号前的老数据（无 uid 字段）：仅 LEGACY_UID 首次登录时继承一份副本，原文档保留不动 */
async function readLegacy(db) {
  const out = {};
  for (let i = 0; i < KEYS.length; i++) {
    const d = await getDoc(db, COL, DOC_IDS[KEYS[i]]);
    if (d && Array.isArray(d.items)) out[KEYS[i]] = d.items;
  }
  return out;
}
async function claimLegacy(db, uid) {
  const legacy = await readLegacy(db);
  const keys = Object.keys(legacy);
  if (!keys.length) return {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    await db.collection(COL).doc(docId(uid, k)).set({
      uid: uid, key: k, items: legacy[k], updated_at: new Date().toISOString()
    });
  }
  return legacy;
}

async function handle(event) {
  const hd = event.headers || {};
  const origin = hd.origin || hd.Origin || '';
  const headers = corsHeaders(origin);
  const method = (event.httpMethod || event.method || 'POST').toUpperCase();

  if (method === 'OPTIONS') return resp(204, headers, {});

  try {
    const body = parseBody(event);
    const q = event.queryStringParameters || {};
    const action = body.action || q.action || '';
    const db = app().database();

    if (action === 'ping') {
      return resp(200, headers, { ok: true, pong: true, env: ENV, auth: true });
    }

    /* ---------- 注册（受 ALLOW_REGISTER 开关保护） ---------- */
    if (action === 'register') {
      if (!ALLOW_REGISTER) {
        return resp(200, headers, { ok: false, error: '该环境未开放自助注册（作者已关闭公开注册）' });
      }
      const uid = uidOf(body.user);
      const pass = String(body.pass || '');
      if (!/^[a-z][a-z0-9_-]{5,19}$/.test(uid)) {
        return resp(200, headers, { ok: false, error: '账号需 6-20 位、字母开头，只能含字母/数字/下划线/中划线（同微信号规则）' });
      }
      if (pass.length < 6) return resp(200, headers, { ok: false, error: '密码至少 6 位' });
      if (await getUser(db, uid)) {
        return resp(200, headers, { ok: false, error: '这个账号已被注册，换个名字或直接登录' });
      }
      const salt = newSalt();
      const doc = {
        user: String(body.user).trim(),
        uid: uid,
        name: String(body.name || '').trim() || '我的工作台',
        sub: String(body.sub || '').trim() || '灵感 · 进度 · 复盘',
        avatar: typeof body.avatar === 'string' ? body.avatar : '',
        salt: salt,
        hash: hashOf(pass, salt),
        created_at: new Date().toISOString()
      };
      await db.collection(USERS_COL).doc(uid).set(doc);
      const token = await issueToken(db, uid);
      return resp(200, headers, { ok: true, token: token, profile: publicProfile(doc) });
    }

    /* ---------- 登录 ---------- */
    if (action === 'login') {
      const uid = uidOf(body.user);
      const u = await getUser(db, uid);
      if (!u || !u.salt || !safeEq(hashOf(String(body.pass || ''), u.salt), u.hash)) {
        return resp(200, headers, { ok: false, error: '账号或密码不对' });
      }
      const token = await issueToken(db, uid);
      return resp(200, headers, { ok: true, token: token, profile: publicProfile(u) });
    }

    /* ---------- 小程序：微信身份 ↔ 账号（一次绑定，之后免密） ---------- */
    if (action === 'wxlogin' || action === 'wxbind' || action === 'wxunbind') {
      const openid = wxOpenid(event);
      if (!openid) {
        return resp(200, headers, {
          ok: false, needWx: true,
          error: '未取到微信身份（该接口只在小程序内可用，网页版请用账号密码登录）'
        });
      }

      /* 微信一键登录：已绑过就换发登录态，没绑过让前端引导绑定 */
      if (action === 'wxlogin') {
        const bind = await getDoc(db, WXBIND_COL, openid);
        if (bind && bind.uid) {
          const u = await getUser(db, bind.uid);
          if (!u) {
            try { await db.collection(WXBIND_COL).doc(openid).remove(); } catch (e) {}
            return resp(200, headers, { ok: true, bound: false, error: '绑定的账号已不存在，请重新绑定' });
          }
          const token = await issueToken(db, bind.uid);
          try { await db.collection(WXBIND_COL).doc(openid).update({ last_login: new Date().toISOString() }); } catch (e) {}
          return resp(200, headers, { ok: true, bound: true, token: token, profile: publicProfile(u) });
        }
        return resp(200, headers, { ok: true, bound: false });
      }

      /* 首次绑定：必须验账号密码，防止别人把自己的微信绑到你的账号上 */
      if (action === 'wxbind') {
        const uid = uidOf(body.user);
        const u = await getUser(db, uid);
        if (!u || !u.salt || !safeEq(hashOf(String(body.pass || ''), u.salt), u.hash)) {
          return resp(200, headers, { ok: false, error: '账号或密码不对' });
        }
        const now = new Date().toISOString();
        await db.collection(WXBIND_COL).doc(openid).set({
          openid: openid, uid: uid, created_at: now, last_login: now
        });
        const token = await issueToken(db, uid);
        return resp(200, headers, { ok: true, bound: true, token: token, profile: publicProfile(u) });
      }

      /* 解绑：换微信号/换手机时用，需登录态；账号数据本身不受影响 */
      const a = await authUser(db, body.token);
      if (!a) return resp(200, headers, { ok: false, needAuth: true, error: '登录已过期，请重新登录' });
      try { await db.collection(WXBIND_COL).doc(openid).remove(); } catch (e) {}
      return resp(200, headers, { ok: true, unbound: true });
    }

    /* ---------- 会话校验：拿 token 换资料（前端启动时验活） ---------- */
    if (action === 'me') {
      const a = await authUser(db, body.token);
      if (!a) return resp(200, headers, { ok: false, needAuth: true, error: '登录已过期，请重新登录' });
      return resp(200, headers, { ok: true, profile: publicProfile(a.user) });
    }

    /* ---------- 退出：吊销当前 token ---------- */
    if (action === 'logout') {
      if (body.token) { try { await db.collection(SESS_COL).doc(String(body.token)).remove(); } catch (e) {} }
      return resp(200, headers, { ok: true });
    }

    /* ---------- 改资料：工作台名称 / 副标题 / 头像 ---------- */
    if (action === 'updateProfile') {
      const a = await authUser(db, body.token);
      if (!a) return resp(200, headers, { ok: false, needAuth: true, error: '登录已过期，请重新登录' });
      const patch = {};
      if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 16) || a.user.name || '我的工作台';
      if (typeof body.sub === 'string') patch.sub = body.sub.trim().slice(0, 24) || a.user.sub || '灵感 · 进度 · 复盘';
      if (typeof body.avatar === 'string') patch.avatar = body.avatar;
      patch.updated_at = new Date().toISOString();
      await db.collection(USERS_COL).doc(a.uid).update(patch);
      const u = await getUser(db, a.uid);
      return resp(200, headers, { ok: true, profile: publicProfile(u || a.user) });
    }

    /* ---------- 以下为数据读写：必须带有效 token ---------- */
    if (action === 'loadAll' || action === 'save' || action === 'importAll') {
      const a = await authUser(db, body.token);
      if (!a) return resp(200, headers, { ok: false, needAuth: true, error: '登录已过期，请重新登录' });
      const uid = a.uid;

      if (action === 'loadAll') {
        let res;
        try { res = await db.collection(COL).where({ uid: uid }).limit(100).get(); }
        catch (e) { res = { data: [] }; }
        const out = {};
        KEYS.forEach(function (k) { out[k] = []; });
        (res.data || []).forEach(function (d) {
          if (d && KEYS.indexOf(d.key) >= 0 && Array.isArray(d.items)) out[d.key] = d.items;
        });
        const empty = KEYS.every(function (k) { return !out[k].length; });
        if (empty && uid === LEGACY_UID) {
          const legacy = await claimLegacy(db, uid); /* 老数据迁移给首个账号（原文档保留作备份） */
          KEYS.forEach(function (k) { if (Array.isArray(legacy[k])) out[k] = legacy[k]; });
        }
        return resp(200, headers, { ok: true, data: out, migrated: empty && uid === LEGACY_UID });
      }

      if (action === 'save') {
        const key = body.key;
        if (KEYS.indexOf(key) < 0) return resp(200, headers, { ok: false, error: 'bad key' });
        if (!Array.isArray(body.items)) return resp(200, headers, { ok: false, error: 'items must be array' });
        await db.collection(COL).doc(docId(uid, key)).set({
          uid: uid, key: key, items: body.items, updated_at: new Date().toISOString()
        });
        return resp(200, headers, { ok: true });
      }

      /* importAll：整体覆盖当前账号的数据（迁移/恢复备份用） */
      const data = body.data || {};
      const missing = KEYS.filter(function (k) { return !Array.isArray(data[k]); });
      if (missing.length) return resp(200, headers, { ok: false, error: '缺少数组: ' + missing.join(',') });
      for (let i = 0; i < KEYS.length; i++) {
        const k = KEYS[i];
        await db.collection(COL).doc(docId(uid, k)).set({
          uid: uid, key: k, items: data[k], updated_at: new Date().toISOString()
        });
      }
      return resp(200, headers, { ok: true });
    }

    if (action === 'getDayQuotes') {
      /* 当天 10 条（中西各 5、交替排列）：前端一次取回，点击即时切换无需再请求 */
      const ck = quoteClock();
      return resp(200, headers, {
        ok: true,
        dayKey: ck.dayKey,
        slot: ck.slot,
        list: dailyQuotes(ck.dayKey),
        counts: { cn: CN_POOL.length, west: WEST_POOL.length },
        date: todayCN()
      });
    }

    if (action === 'getQuote') {
      /* 支持 idx：前端点击切换/分时段轮换时按序号取词库条目；不带 idx 则按北京时间天+时段自动算 */
      let idx = (body && typeof body.idx === 'number') ? body.idx : null;
      let slot = null;
      if (idx === null) {
        const ck = quoteClock();
        slot = ck.slot;
        idx = quoteIndexAt(ck.dayKey, ck.slot);
      }
      idx = ((idx % QUOTES.length) + QUOTES.length) % QUOTES.length;
      const qa = QUOTES[idx];
      return resp(200, headers, { ok: true, text: qa[0], author: qa[1], idx: idx, slot: slot, total: QUOTES.length, date: todayCN() });
    }

    return resp(200, headers, { ok: false, error: 'unknown action: ' + action });
  } catch (e) {
    return resp(200, headers, { ok: false, error: String((e && e.message) || e) });
  }
}

/* 出口适配：网页版经 HTTP 访问服务调用，需要 { statusCode, headers, body } 包装；
   小程序 wx.cloud.callFunction 则期望直接拿到业务对象，这里统一把包装拆掉，
   两种链路共用同一套业务分支，不必写两遍。 */
exports.main = async function (event) {
  const e = event || {};
  const r = await handle(e);
  if (!e.httpMethod && r && typeof r === 'object' && typeof r.body === 'string') {
    try { return JSON.parse(r.body); } catch (err) { return { ok: false, error: '响应解析失败' }; }
  }
  return r;
};
