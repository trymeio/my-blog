// scripts/generate-briefing.mjs
// 每天由 GitHub Actions 触发：抓取公开资讯（AI科技 / 超英 / 游戏）→ 交给 AI 整理成中文日报
// 写入 data/dailyBriefing.json，并把旧的一期归档到 data/dailyBriefingArchive.json

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DATA_DIR = path.join(ROOT, 'data');
const CURRENT_FILE = path.join(DATA_DIR, 'dailyBriefing.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'dailyBriefingArchive.json');

const API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const MODEL = process.env.BRIEFING_MODEL || 'nvidia/nemotron-3.5-lightning:free';
const URL_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const SITE_REFERER = 'https://mmzhw-blog.netlify.app/';
const SITE_TITLE = 'mmzhw-blog'; // HTTP 头必须是 ASCII，不能放中文

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 三类资讯：AI科技、超英、游戏
const CHANNELS = [
  { id: 'ai', name: 'AI 科技', target: 3 },
  { id: 'hero', name: '超英', target: 3 },
  { id: 'game', name: '游戏', target: 3 },
];

// 超英关键词：只保留强特征词，避免「thor / flash」这类词误命中游戏或科技新闻
const HERO_WORDS = [
  'marvel', 'dc studios', 'dc universe', 'dc comics', "dc's", 'spider-man', 'spiderman',
  'batman', 'superman', 'avengers', 'x-men', 'wolverine', 'deadpool', 'venom',
  'justice league', 'guardians of the galaxy', 'comics', 'superhero', 'mcu',
  'daredevil', 'fantastic four', 'green lantern', 'aquaman', 'joker', 'harley quinn',
  'captain america', 'iron man', 'black panther', 'dc studios', 'superheroes',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function beijingDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replaceAll('-', '.');
}

function beijingWeekday(now = new Date()) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const shifted = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return names[shifted.getDay()];
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 极简 RSS 解析（不引依赖，只取 title / link / pubDate / description） ----------
function decodeEntities(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return decodeEntities(String(html || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'i'));
      if (!m) return '';
      return stripTags(
        m[0].replace(new RegExp(`^<${tag}[^>]*>`, 'i'), '').replace(new RegExp(`</${tag}>`, 'i'), '')
      );
    };
    const title = pick('title');
    let link = pick('link');
    if (!link) {
      const alt = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? alt[1] : '';
    }
    const description = pick('description') || pick('summary');
    const pubDate = pick('pubDate') || pick('published') || pick('updated');
    if (title && link) items.push({ title, url: link, description, pubDate });
  }
  return items;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function toDateString(pubDate) {
  const t = Date.parse(pubDate || '');
  if (!Number.isFinite(t)) return beijingDate();
  return beijingDate(new Date(t));
}

// ---------- 三类数据源 ----------
// AI 关键词：优先挑选真正跟 AI 相关的条目
const AI_WORDS = [
  'ai', 'a.i.', 'llm', 'gpt', 'model', 'models', 'neural', 'openai', 'anthropic',
  'machine learning', 'agent', 'agents', 'transformer', 'gemini', 'claude',
  'inference', 'diffusion', 'embedding', 'copilot', 'chatgpt', 'llama',
];

async function collectAi(count = 8) {
  // 用 Algolia 的 HN 首页接口：一次请求就能拿到整页条目，比逐条查 item 更稳定
  const data = await fetchJson(
    'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40',
    20000
  );
  const pool = [];
  for (const hit of data?.hits || []) {
    if (!hit?.title) continue;
    const link = hit.url || (hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : '');
    if (!link) continue;
    if (pool.some((p) => p.url === link)) continue;
    pool.push({
      title: hit.title,
      url: link,
      description: '',
      source: hostOf(link),
      date: toDateString(hit.created_at),
    });
  }
  // 先取命中 AI 关键词的，再用剩余条目补足
  const isAi = (t) => {
    const hay = ` ${t.toLowerCase()} `;
    return AI_WORDS.some((w) => hay.includes(` ${w} `) || hay.includes(`${w} `) || hay.includes(` ${w}`));
  };
  const hits = pool.filter((p) => isAi(p.title));
  const rest = pool.filter((p) => !isAi(p.title));
  return [...hits, ...rest].slice(0, count);
}

async function collectHero(count = 8) {
  const feeds = [
    'https://www.ign.com/rss/articles/feed',
    'https://www.slashfilm.com/feed/',
    'https://www.denofgeek.com/feed/',
    'https://variety.com/feed/',
    'https://www.hollywoodreporter.com/feed/',
    'https://www.eurogamer.net/feed',
  ];
  const hits = [];
  const perSource = new Map(); // 同一个站点最多取 2 条，保证来源多样
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed, 25000);
      const items = parseRss(xml);
      for (const item of items) {
        // 只看标题判断分类：描述里常提到「漫威蜘蛛侠」等无关游戏新闻，会误判
        const hay = item.title.toLowerCase();
        const hit = HERO_WORDS.some((w) => hay.includes(w));
        if (!hit) continue;
        if (hits.some((h) => h.url === item.url)) continue;
        const src = hostOf(item.url);
        if ((perSource.get(src) || 0) >= 2) continue;
        perSource.set(src, (perSource.get(src) || 0) + 1);
        hits.push({
          title: item.title,
          url: item.url,
          description: stripTags(item.description).slice(0, 200),
          source: src,
          date: toDateString(item.pubDate),
        });
        if (hits.length >= count) break;
      }
    } catch (error) {
      console.warn(`  · 超英源跳过 ${feed}：${error.message}`);
    }
    if (hits.length >= count) break;
  }
  return hits;
}

async function collectGame(count = 8) {
  const picked = [];

  // 1) 游戏媒体 RSS（同一站点最多 2 条，保证来源多样）
  for (const feed of ['https://www.pcgamer.com/rss/', 'https://www.eurogamer.net/feed']) {
    try {
      const xml = await fetchText(feed, 30000);
      const src = hostOf(feed);
      let taken = picked.filter((p) => p.source === src).length;
      for (const item of parseRss(xml)) {
        if (picked.length >= count) break;
        if (taken >= 2) break;
        if (picked.some((p) => p.url === item.url)) continue;
        picked.push({
          title: item.title,
          url: item.url,
          description: stripTags(item.description).slice(0, 200),
          source: src,
          date: toDateString(item.pubDate),
        });
        taken += 1;
      }
    } catch (error) {
      console.warn(`  · 游戏源跳过 ${feed}：${error.message}`);
    }
    if (picked.length >= count) break;
  }

  // 2) Steam 官方新闻（补足数量）
  const appids = [1091500, 553850, 1245620, 2358720, 2651280];
  for (const appid of appids) {
    if (picked.length >= count) break;
    try {
      const data = await fetchJson(
        `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=3&maxlength=300`,
        20000
      );
      for (const n of data?.appnews?.newsitems || []) {
        if (picked.length >= count) break;
        if (!n.title || !n.url) continue;
        if (picked.some((p) => p.url === n.url)) continue;
        picked.push({
          title: n.title,
          url: n.url,
          description: stripTags(n.contents).slice(0, 200),
          source: 'steam',
          date: toDateString(new Date(n.date * 1000).toISOString()),
        });
      }
    } catch {
      /* 忽略单个 appid 失败 */
    }
  }

  return picked;
}

// ---------- 交给模型翻译整理 ----------
function buildPrompt(items, offset, channelName) {
  return `你是中文资讯编辑，负责「${channelName}」栏目。下面是今天的英文资讯：

${items
  .map(
    (s, i) => `${offset + i + 1}. 标题：${s.title}
   来源：${s.source}
   简介：${s.description || '（无）'}
   链接：${s.url}`
  )
  .join('\n')}

请为每一条写成中文日报条目，只输出一个 JSON 对象，不要解释、不要代码块标记：
{
  "items": [
    {
      "index": 1,
      "title": "中文标题，不超过 24 个字，直白准确",
      "summary": "中文摘要，40 到 70 个字，说清发生了什么、为什么值得看",
      "highlights": ["中文要点一，不超过 20 字", "中文要点二，不超过 20 字"],
      "tags": ["中文标签，1 到 3 个"],
      "readingNote": "写在页边的一句中文点评，20 到 40 字"
    }
  ]
}

要求：index 必须对应上面给出的序号；不得编造事实，不确定的地方用概括表述；全部使用简体中文。

标题规则（很重要）：
1. 必须是完整、能读懂的中文短句，不超过 24 个字，不能出现半截单词或被截断的英文。
2. 去掉 "Show HN:"、"Ask HN:"、"Show HN" 这类前缀，直接写内容本身。
3. 人名一律用常见中文译名（如 James Gunn → 詹姆斯·古恩，Jeremy Latcham → 杰瑞米·拉查姆）；没有通用译名就用简短的职务描述代替。
4. 只保留必要的品牌与技术缩写（DC、Marvel、PlayStation、GTA、AI、PC、GPU 等），其余英文单词必须译成中文，禁止在中文句子里直接夹英文短语。`;
}

async function askModel(prompt, retries = 4) {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY 未配置');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: '你是严谨的中文资讯编辑，只输出合法 JSON。' },
      { role: 'user', content: prompt },
    ],
    // 关闭思考过程：Nemotron 默认会把大半 token 花在 reasoning 上，容易把 JSON 截断
    max_tokens: 4000,
    temperature: 0.3,
    reasoning: { enabled: false },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(URL_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SITE_REFERER,
        'X-Title': SITE_TITLE,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait = 3000 * Math.pow(2, attempt);
      console.warn(`⚠️ HTTP ${res.status}，${wait}ms 后重试（第 ${attempt + 1} 次）`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter 拒绝请求：HTTP ${res.status} ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = (data?.choices?.[0]?.message?.content || '').toString();
    if (!content.trim()) {
      console.warn('⚠️ 模型正文为空，重试一次');
      await sleep(2000);
      continue;
    }
    return content;
  }
  throw new Error('模型多次失败，放弃本次生成');
}

function extractJson(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型输出里找不到 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function trim(str, max) {
  const value = String(str ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max) : value;
}

// 去掉 HN 标题里的 Show HN / Ask HN 之类前缀
function stripFeedPrefix(title) {
  return String(title || '')
    .replace(/^\s*(show|ask|tell)\s+hn\s*[:：]\s*/i, '')
    .replace(/^\s*(show|ask|tell)\s+hn\s+/i, '')
    .trim();
}

// 逐条组装成合法的日报条目
function buildItems(channel, stories, modelItems, date, startIndex) {
  const items = [];
  stories.forEach((story, i) => {
    const generated = modelItems.find((m) => Number(m?.index) === i + 1) || modelItems[i] || {};
    items.push({
      id: `${date.replaceAll('.', '')}-${channel.id}-${String(startIndex + i + 1).padStart(2, '0')}`,
      category: channel.id,
      title: trim(stripFeedPrefix(generated?.title || story.title), 40),
      originalTitle: trim(story.title, 160),
      source: story.source,
      sourceOrg: story.source,
      sourceDate: story.date,
      url: story.url,
      tags: Array.isArray(generated?.tags) ? generated.tags.slice(0, 3).map((t) => trim(t, 10)).filter(Boolean) : [],
      summary: trim(generated?.summary || '这条资讯值得关注，详情可查看原文。', 140),
      highlights: Array.isArray(generated?.highlights)
        ? generated.highlights.slice(0, 3).map((h) => trim(h, 40)).filter(Boolean)
        : [],
      readingNote: trim(generated?.readingNote || '', 80) || '这条值得留意，点开原文看看。',
      verifiedAt: date,
      verificationUrls: [story.url],
    });
  });
  return items;
}

async function main() {
  const today = beijingDate();
  console.log(`🗓️  生成 ${today} 的「米米的AI日报」`);

  const collectors = { ai: collectAi, hero: collectHero, game: collectGame };
  const allItems = [];
  let successChannels = 0;

  for (const channel of CHANNELS) {
    console.log(`\n📡 采集栏目：${channel.name}`);
    let stories = [];
    try {
      stories = await collectors[channel.id](8);
    } catch (error) {
      console.warn(`  ✗ 采集失败：${error.message}`);
    }
    if (stories.length === 0) {
      console.warn(`  ✗ ${channel.name} 没抓到资讯，跳过`);
      continue;
    }
    console.log(`  ✓ 抓到 ${stories.length} 条，开始翻译整理`);

    // 分批 3 条，避免模型一次输出过长被截断
    const BATCH = 3;
    const picked = [];
    for (let start = 0; start < Math.min(stories.length, channel.target); start += BATCH) {
      const slice = stories.slice(start, start + BATCH);
      try {
        const raw = await askModel(buildPrompt(slice, start, channel.name));
        const parsed = extractJson(raw);
        const got = Array.isArray(parsed?.items) ? parsed.items : [];
        picked.push(buildItems(channel, slice, got, today, start));
        console.log(`    ✓ 第 ${start + 1}-${start + slice.length} 条完成`);
      } catch (error) {
        console.warn(`    ✗ 第 ${start + 1}-${start + slice.length} 条失败：${error.message}`);
      }
      await sleep(2500); // 让出免费额度
    }
    const flat = picked.flat();
    if (flat.length > 0) {
      allItems.push(...flat);
      successChannels += 1;
    }
  }

  if (allItems.length === 0) throw new Error('三个栏目都没产出内容，本次放弃');

  // 兜底：某个栏目今天没产出（比如免费额度限流），就沿用上一期同栏目的内容，保证卡片不空
  const previous = await readJson(CURRENT_FILE, { items: [] });
  const reused = [];
  for (const channel of CHANNELS) {
    if (allItems.some((item) => item.category === channel.id)) continue;
    const old = (previous.items || [])
      .filter((item) => item.category === channel.id)
      .slice(0, channel.target);
    if (old.length === 0) continue;
    allItems.push(...old);
    reused.push(`${channel.name}（沿用上一期 ${old.length} 则）`);
    console.log(`  ↺ ${channel.name} 沿用上一期 ${old.length} 则`);
  }

  const countOf = (id) => allItems.filter((i) => i.category === id).length;
  const issue = {
    edition: {
      date: today,
      weekday: beijingWeekday(),
      label: '米米的AI日报',
      notice:
        `本期由 AI 整理自公开资讯，共 ${allItems.length} 则（AI科技 ${countOf('ai')} / 超英 ${countOf('hero')} / 游戏 ${countOf('game')}）。` +
        (reused.length > 0 ? `其中 ${reused.join('、')}。` : ''),
    },
    items: allItems,
  };

  const current = previous;
  const archive = await readJson(ARCHIVE_FILE, { windowDays: 90, asOfDate: today, issues: [] });

  // 归档：保留最近 90 天，同一天只留一份
  const merged = [];
  for (const candidate of [current, ...(archive.issues || [])]) {
    const date = candidate?.edition?.date;
    if (!date || !/^\d{4}\.\d{2}\.\d{2}$/.test(date)) continue;
    if (date === today) continue;
    if (!candidate.items?.length) continue;
    if (merged.some((m) => m.edition.date === date)) continue;
    merged.push(candidate);
  }
  const kept = merged.sort((a, b) => b.edition.date.localeCompare(a.edition.date)).slice(0, 90);

  await fs.writeFile(CURRENT_FILE, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    ARCHIVE_FILE,
    `${JSON.stringify({ windowDays: 90, asOfDate: today, issues: kept }, null, 2)}\n`,
    'utf8'
  );

  console.log(`\n✅ 已写入 ${allItems.length} 条日报，历史保留 ${kept.length} 期`);
  if (successChannels < 3) console.warn(`⚠️ 只有 ${successChannels}/3 个栏目成功`);
}

main().catch((error) => {
  console.error(`❌ 生成失败：${error.message}`);
  process.exit(1);
});
