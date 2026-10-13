// 抓取适配器注册表：根据目标页面 host/路径选择最贴合的提取脚本。
// 不同站点结构差异大，无法靠单一通用脚本保证质量。每个适配器声明：
//   - id/name：识别名
//   - match(url)：判断是否命中该站点
//   - extractScript：注入到该页面执行的提取脚本（返回 { count, items }）
// 未命中任何适配器时回退到通用启发式（generic）。
// 雷小伊社区入口可通过 settings.sourceHosts.laoxiaoyi 配置，格式为逗号分隔的 host。

const genericScript = `(() => {
  const found = new Map();
  const add = (name, source) => {
    name = (name || '').replace(/\\s+/g, ' ').trim();
    if (!name) return;
    if (name.length < 1 || name.length > 16) return;
    if (/^(搜索|首页|登录|注册|返回|下一页|上一页|确定|取消|退出|更多|menu|index)$/i.test(name)) return;
    if (!found.has(name)) found.set(name, { name, source });
  };
  // 1) 图片 alt/title
  document.querySelectorAll('img').forEach((img) => {
    const a = (img.getAttribute('alt') || '').trim();
    const t = (img.getAttribute('title') || '').trim();
    if (a) add(a, 'img:alt');
    if (t && t !== a) add(t, 'img:title');
  });
  // 2) 含间隔号·的正文文本（按分句/按词元各取一次）
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = (node.textContent || '').replace(/\\s+/g, ' ').trim();
    if (txt && txt.includes('·')) {
      txt.split(/[，,；;。.]+/).forEach((seg) => {
        seg = seg.trim();
        if (seg.includes('·') && seg.length >= 2 && seg.length <= 16) add(seg, 'text');
      });
      txt.split(/[\\s，,；;。.()（）|：:]+/).forEach((tok) => {
        tok = tok.trim();
        if (tok.includes('·') && tok.length >= 2 && tok.length <= 16) add(tok, 'text');
      });
    }
  }
  // 3) 卡片类容器文本
  document.querySelectorAll('[class*="mon"], [class*="card"], [class*="elite"], [id*="pokemon"], [class*="pet"]').forEach((el) => {
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (t && t.includes('·') && t.length <= 16) add(t, 'card');
  });
  return JSON.stringify({ count: found.size, items: Array.from(found.values()) });
})()`;

// 雷小伊社区 / 赛尔号图鉴类页面适配器。
// 在通用启发式基础上，针对图鉴卡片网格增强：
//   - data-name / title 属性直取
//   - a[href*="poke"] / .pk-box / 图鉴卡片容器
//   - 精灵头像 img（src 含 pet/mon/sprite 等）的 alt
const laoxiaoyiScript = `(() => {
  const found = new Map();
  const add = (name, source) => {
    name = (name || '').replace(/\\s+/g, ' ').trim();
    if (!name) return;
    if (name.length < 1 || name.length > 16) return;
    if (/^(搜索|首页|登录|注册|返回|下一页|上一页|确定|取消|退出|更多|menu|index)$/i.test(name)) return;
    if (!found.has(name)) found.set(name, { name, source });
  };
  // 1) data-* 属性（社区图鉴常用 data-name 承载精灵名）
  document.querySelectorAll('[data-name], [data-monname]').forEach((el) => {
    const v = el.getAttribute('data-name') || el.getAttribute('data-monname');
    if (v) add(v, 'attr');
  });
  // 2) 精灵头像/卡片图片 alt/title
  document.querySelectorAll('img').forEach((img) => {
    const a = (img.getAttribute('alt') || '').trim();
    const t = (img.getAttribute('title') || '').trim();
    if (a) add(a, 'img:alt');
    if (t && t !== a) add(t, 'img:title');
  });
  // 3) 图鉴卡片容器（宽泛但聚焦）
  const cardSel = '[class*="mon-item"],[class*="elite-item"],[class*="poke-item"]' +
    ',[class*="mon-card"],[class*="pk-box"],[class*="sprite-item"],' +
    '[class*="-精灵"],[class*="pet-item"],[class*="poke-list"]';
  const take = (el) => (el.textContent || '').split(/[\\n\\r；;，,]/g);
  document.querySelectorAll(cardSel).forEach((el) => {
    take(el).forEach((p) => {
      p = p.trim();
      if (p.includes('·') && p.length >= 2 && p.length <= 16) add(p, 'card');
    });
  });
  // 4) 含·正文文本（兜底覆盖，按词元拆分）
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = (node.textContent || '').replace(/\\s+/g, ' ').trim();
    if (txt && txt.includes('·')) {
      txt.split(/[\\s，,；;。.()（）|：:]+/).forEach((tok) => {
        tok = tok.trim();
        if (tok.includes('·') && tok.length >= 2 && tok.length <= 16) add(tok, 'text');
      });
    }
  }
  return JSON.stringify({ count: found.size, items: Array.from(found.values()) });
})()`;

const adapters = [
  {
    id: 'laoxiaoyi',
    name: '雷小伊社区 / 赛尔号图鉴',
    extractScript: laoxiaoyiScript,
    // 已知 host + 用户可在设置里扩展
    hosts: ['bbs.tiepi.top', 'www.tiepi.top', 'tiepi.top', 'seer.tiepi.top'],
    match(url) {
      const host = hostOf(url);
      return host && (this.hosts.includes(host) || (this.pickedHosts || []).includes(host));
    }
  }
];

function hostOf(url) {
  try {
    const u = new URL(url || '');
    return u.hostname.toLowerCase();
  } catch (e) {
    return null;
  }
}

// 把用户配置的入口字符串规范为 host 列表
function toHostList(str) {
  return String(str || '')
    .split(',')
    .map((s) => {
      const t = String(s).trim();
      if (!t) return '';
      // 用 URL 解析出 hostname，规避各种协议/路径写法
      if (t.includes('://')) {
        try { return new URL(t).hostname.toLowerCase(); } catch (e) { return ''; }
      }
      // 无协议时补 http 解析
      try { return new URL('http://' + t).hostname.toLowerCase(); } catch (e) { return t.toLowerCase(); }
    })
    .filter(Boolean);
}

// 生成通用兜底适配器
function generic() {
  return { id: 'generic', name: '通用启发式', extractScript: genericScript };
}

// 解析最贴合的适配器。settings 可选，用于读取用户扩展的源 host。
// settings.sourceHosts = { laoxiaoyi: 'a.com,b.com' }
function resolve(url, settings) {
  const extra = (settings && settings.sourceHosts) || {};
  const lao = adapters.find((a) => a.id === 'laoxiaoyi');
  if (lao && extra.laoxiaoyi) {
    lao.pickedHosts = toHostList(extra.laoxiaoyi);
  }
  const hit = adapters.find((a) => a.match && a.match(url));
  return hit || generic();
}

module.exports = { resolve, generic, adapters, hostOf, toHostList };