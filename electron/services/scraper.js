// 抓取服务：攻略 / 精灵数据抓取
// 采用「可配置来源 + 手动粘贴兜底」策略。
// 说明：真实站点结构易变，这里提供 Fetch + 基础解析框架，并允许用户
// 通过“手动导入原始文本”让 AI 清洗。未来可针对雷小伊社区等做专属适配器。
const axios = require('axios');
const adapters = require('./adapters');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// 移动端 UA：贴吧 alios 端 list/thread 接口对该 UA 放行（PC UA 返回 403）
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

async function fetchURL(url, { timeout = 20000, baseUrl } = {}) {
  const resp = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: baseUrl || url },
    timeout
  });
  return {
    url,
    status: resp.status,
    text: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)
  };
}

// 从 HTML 提取正文段落（去除标签），简单启发式
function stripHtml(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// 抓取一个来源（可配置），返回原始文本列表
async function scrapeSource(source, keywords) {
  if (!source.enabled) return [];
  // 贴吧：移动端帖列表（自动）→ 标题线索；正文需内置浏览器登录后抓取
  if (source.key === 'tieba') {
    const fname = source.fname || '赛尔号';
    const posts = await fetchTiebaList(fname, keywords);
    if (!posts.length) return [];
    const texts = posts.map(
      (p) => `【贴吧${p.matched ? '' : ''}线索】标题：${p.title}\n作者：${p.author}｜时间：${p.time}｜回复：${p.reply}\n链接：${p.url}\n（正文需在内置浏览器打开链接获取完整内容）`
    );
    return texts.slice(0, 8).map((text, i) => ({ url: posts[i].url, text }));
  }
  // 不同来源应实现专属解析。这里给出通用处理：
  // 若来源配了 url 模板，则抓取；否则返回空，等待用户手动粘贴。
  if (!source.urlTemplate) {
    return [];
  }
  const url = source.urlTemplate.replace('{q}', encodeURIComponent(keywords.join(' ')));
  const res = await fetchURL(url, { baseUrl: source.base });
  return [{ url: res.url, text: stripHtml(res.text) }];
}

// 抓取并解析贴吧移动端帖列表：返回结构化帖子数组（含标题/tid/作者/时间/回复），
// 并按关键词给标题打匹配标记。贴吧 PC 版接口反爬 403，移动端 alios 列表接口可用。
async function fetchTiebaList(fname, keywords = []) {
  const kw = encodeURIComponent(fname || '赛尔号');
  const url = `https://tieba.baidu.com/mo/q/mnew?kw=${kw}`;
  const resp = await axios.get(url, {
    headers: { 'User-Agent': MOBILE_UA, Referer: 'https://tieba.baidu.com/' },
    timeout: 20000
  });
  const html = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
  return parseTiebaList(html, keywords);
}

// 解析贴吧移动端列表 HTML（块级正则，结构：li[data-tid] → ti_title / ti_author / ti_time / btn_icon）
function parseTiebaList(html, keywords = []) {
  const blocks = html.match(/<li[\s\S]*?data-tid="\d+"[\s\S]*?<\/li>/g) || [];
  const kw = (keywords || []).map((k) => String(k).toLowerCase()).filter(Boolean);
  const posts = [];
  for (const b of blocks) {
    const tid = (b.match(/data-tid="(\d+)"/) || [])[1];
    if (!tid) continue;
    const raw = (b.match(/class="ti_title">([\s\S]*?)<\/div>/) || [])[1] || '';
    const title = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    if (/招募|吧主报|删除|置顶|吧务受理|提问楼|公告|申精|申诉|吧规|应征|吧主招募/.test(title)) continue;
    const author = ((b.match(/class="ti_author"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    const time = ((b.match(/class="ti_time"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '').trim();
    const reply = ((b.match(/btn_reply j_ti_reply"><span class="btn_icon">([\s\S]*?)<\/span>/) || [])[1] || '0').trim();
    const lower = title.toLowerCase();
    const matched = kw.length === 0 || kw.some((k) => lower.includes(k));
    posts.push({ tid, url: `https://tieba.baidu.com/p/${tid}`, title, author, time, reply, matched });
  }
  // 优先匹配关键词，其次最新
  const matchedPosts = posts.filter((p) => p.matched);
  const rest = posts.filter((p) => !p.matched);
  return [...matchedPosts, ...rest];
}

// 内置浏览器抓取脚本：在页面上执行，返回候选精灵列表。
// 写法上做成字符串，注入到 webview 的页面上下文中执行后再返回 JSON。
const extractPokemonScript = `(() => {
  const found = new Map(); // name -> {name, source}
  const add = (name, source) => {
    name = (name || '').replace(/\\s+/g, ' ').trim();
    if (!name) return;
    // 过滤明显非精灵名的碎片
    if (name.length < 1 || name.length > 16) return;
    if (/^(搜索|首页|登录|注册|返回|下一页|上一页|确定|取消|退出|更多|menu|index)$/i.test(name)) return;
    const key = name;
    if (!found.has(key)) found.set(key, { name, source });
  };
  // 1) 图片 alt/title（精灵卡片通常以图片承载名称）
  document.querySelectorAll('img').forEach((img) => {
    const a = (img.getAttribute('alt') || '').trim();
    const t = (img.getAttribute('title') || '').trim();
    if (a) add(a, 'img:alt');
    if (t && t !== a) add(t, 'img:title');
  });
  // 2) 含间隔号 〔·〕的文本（赛尔号精灵名常见命名，如 "圣雷·布鲁"）
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = (node.textContent || '').replace(/\\s+/g, ' ').trim();
    if (txt && txt.includes('·')) {
      // 1) 按分句符号拆分，整段含·且长度合适直接采用
      txt.split(/[，,；;。.]+/).forEach((seg) => {
        seg = seg.trim().replace(/^[\\[（(【]+|[\\]）)】]+$/g, '');
        if (seg.includes('·') && seg.length >= 2 && seg.length <= 16) add(seg, 'text');
      });
      // 2) 按空白词元拆分，提取句中每个独立的含·片段（如 "遇 白泽·光 可用 玄武·霸"）
      txt.split(/[\\s，,；;。.()（）|：:]+/).forEach((tok) => {
        tok = tok.trim();
        if (tok.includes('·') && tok.length >= 2 && tok.length <= 16) add(tok, 'text');
      });
    }
  }
  // 3) 常见的卡片类名容器文本
  document.querySelectorAll('[class*="mon"], [class*="card"], [class*="elite"], [id*="pokemon"], [class*="pet"]').forEach((el) => {
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t && t.includes('·') && t.length <= 16) add(t, 'card');
  });
  const list = Array.from(found.values());
  return JSON.stringify({ count: list.length, items: list });
})();`;

// 把抓取结果清洗为标准精灵字段；要求至少 name
function parseExtracted(raw, origin = '') {
  const out = [];
  const seen = new Set();
  const normalize = (arr) => {
    (Array.isArray(arr) ? arr : []).forEach((it) => {
      const name = (it && (it.name || it.NOMBRE || it.title)) || '';
      if (!name || name.length < 1) return;
      const key = String(name).trim();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        name: key,
        attributes: [],
        note: (it.source || origin) === 'text' ? '来自页面文本抓取' : (it.source || origin),
        source: it.source || origin
      });
    });
    return out;
  };
  try {
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      normalize(parsed.items || parsed);
      return out;
    }
    normalize(raw);
  } catch (e) {
    /* 解析失败返回空 */
  }
  return out;
}

// 按页面 URL 解析最贴合抓取适配器，返回 { id, name, extractScript }。
// 未命中专属适配器时回退到通用启发式（extractPokemonScript）。
function resolveScript(url, settings) {
  return adapters.resolve(url, settings);
}

// 通用正文抽取脚本：在页面 DOM 上执行，返回页面主要正文文本。
// 用于「抓当前页作攻略素材」（贴吧帖子正文等含登录态的页面需内置浏览器打开后抓取）。
const extractTextScript = `(() => {
  // 优先命中正文容器；再兜底取长度均衡的文本块
  const clean = (s) => (s || '').replace(/[\\t\\r]+/g, '').replace(/ {2,}/g, ' ').trim();
  const title = clean(document.title || '');
  const prefer = document.querySelectorAll('.d_post_content, .post_body, .author_content, [class*="post_content"], .post-content, .article-content, .pc_b_text, .thread_text');
  const seen = new Set();
  const out = [];
  const push = (t) => { t = clean(t); if (t && t.length >= 8 && !seen.has(t)) { seen.add(t); out.push(t); } };
  if (title) push(title);
  if (prefer.length) {
    Array.from(prefer).forEach((el) => { const t = el.innerText || el.textContent; if (t && t.trim().length) push(t); });
  }
  if (!out.length) {
    // 兜底：按 p 段落抽取正文
    document.querySelectorAll('p, li').forEach((el) => {
      const t = el.innerText || el.textContent;
      if (t && t.replace(/\\s+/g, '').length > 12) push(t);
    });
  }
  return JSON.stringify({ title, url: location.href, text: out.join('\\n\\n').slice(0, 20000) });
})()`;

module.exports = {
  fetchURL,
  fetchTiebaList,
  parseTiebaList,
  stripHtml,
  scrapeSource,
  UA,
  MOBILE_UA,
  extractPokemonScript,
  extractTextScript,
  parseExtracted,
  resolveScript,
  adapters
};