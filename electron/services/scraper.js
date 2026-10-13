// 抓取服务：攻略 / 精灵数据抓取
// 采用「可配置来源 + 手动粘贴兜底」策略。
// 说明：真实站点结构易变，这里提供 Fetch + 基础解析框架，并允许用户
// 通过“手动导入原始文本”让 AI 清洗。未来可针对雷小伊社区等做专属适配器。
const axios = require('axios');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

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
  // 不同来源应实现专属解析。这里给出通用处理：
  // 若来源配了 url 模板，则抓取；否则返回空，等待用户手动粘贴。
  if (!source.urlTemplate) {
    return [];
  }
  const url = source.urlTemplate.replace('{q}', encodeURIComponent(keywords.join(' ')));
  const res = await fetchURL(url, { baseUrl: source.base });
  return [{ url: res.url, text: stripHtml(res.text) }];
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

module.exports = { fetchURL, stripHtml, scrapeSource, UA, extractPokemonScript, parseExtracted };