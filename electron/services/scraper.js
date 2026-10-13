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

module.exports = { fetchURL, stripHtml, scrapeSource, UA };