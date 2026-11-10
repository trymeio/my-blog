// scripts/generate-briefing.mjs
// 每天由 GitHub Actions 触发：抓取公开科技资讯 → 交给 AI 整理成中文日报 → 写入 data/dailyBriefing.json
// 不依赖任何私有数据源，只用 Hacker News 公开 API + OpenRouter 模型。

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

const CATEGORY_IDS = ['tech', 'ai', 'dev', 'life'];

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

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 1) 抓公开资讯（Hacker News 首页热榜）
async function collectStories(limit = 10) {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
  const picked = [];
  for (const id of ids.slice(0, limit * 3)) {
    if (picked.length >= limit) break;
    try {
      const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 10000);
      if (!item || item.type !== 'story' || !item.url || !item.title) continue;
      if (picked.some((p) => p.url === item.url)) continue;
      picked.push({
        title: item.title,
        url: item.url,
        source: new URL(item.url).hostname.replace(/^www\./, ''),
        date: beijingDate(new Date(item.time * 1000)),
        score: item.score ?? 0,
      });
    } catch {
      // 单条失败不影响整体
    }
  }
  return picked;
}

// 2) 交给模型整理成中文日报
function buildPrompt(stories, offset = 0) {
  return `你是一名中文科技编辑。下面是一批今天的英文科技资讯（标题、来源站点、链接）：

${stories
  .map(
    (s, i) => `${offset + i + 1}. 标题：${s.title}
   来源：${s.source}
   链接：${s.url}`
  )
  .join('\n')}

请为每一条写成中文日报条目，并且只输出一个 JSON 对象，不要输出任何解释文字、不要加代码块标记。JSON 结构必须是：
{
  "items": [
    {
      "index": 1,
      "title": "中文标题，不超过 24 个字，直白准确",
      "summary": "中文摘要，40 到 70 个字，说明发生了什么、为什么值得看",
      "highlights": ["中文要点一，不超过 20 字", "中文要点二，不超过 20 字"],
      "category": "tech 或 ai 或 dev 或 life 四选一",
      "tags": ["中文标签，1 到 3 个"],
      "readingNote": "写在页边的一句中文点评，20 到 40 字，说说这条消息对普通读者意味着什么"
    }
  ]
}

分类规则：ai 指人工智能与大模型，dev 指开发工具、开源项目、编程语言，tech 指硬件、芯片、公司动态、科学发现，life 指其他有趣内容。
要求：index 必须对应上面给出的序号；不得编造事实，不确定的地方用概括表述；全部使用简体中文。
语言要求：标题、摘要、要点、标签都用通顺的简体中文；专有名词（如 Rust、Blender、OpenAI）保留原文即可，但绝不能中英混写，例如不要出现“grandfathered 传奇”这种写法，要写成“祖父条款”这类完整中文表意。`;
}

async function askModel(prompt, retries = 4) {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY 未配置');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: '你是严谨的中文科技编辑，只输出合法 JSON。' },
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

// 3) 合成一条合法的日报 issue
function buildIssue(stories, modelItems, date) {
  const items = [];
  stories.forEach((story, i) => {
    const generated = modelItems.find((m) => Number(m?.index) === i + 1) || modelItems[i] || {};
    const category = CATEGORY_IDS.includes(generated?.category) ? generated.category : 'tech';
    items.push({
      id: `${date.replaceAll('.', '')}-${String(i + 1).padStart(2, '0')}`,
      category,
      title: trim(generated?.title || story.title, 40),
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
  return {
    edition: {
      date,
      weekday: beijingWeekday(),
      label: 'AI 日报',
      notice: `本期由 ${MODEL} 整理自公开科技资讯，共 ${items.length} 则。`,
    },
    items,
  };
}

async function main() {
  const today = beijingDate();
  console.log(`🗓️  生成 ${today} 的日报`);

  const stories = await collectStories(8);
  console.log(`📥 抓到 ${stories.length} 条资讯`);
  if (stories.length < 3) throw new Error('资讯太少，跳过本次生成');

  // 分批生成：每批 3 条，避免模型一次输出太长被截断
  const BATCH = 3;
  const modelItems = [];
  for (let start = 0; start < stories.length; start += BATCH) {
    const slice = stories.slice(start, start + BATCH);
    try {
      const raw = await askModel(buildPrompt(slice, start));
      const parsed = extractJson(raw);
      const got = Array.isArray(parsed?.items) ? parsed.items : [];
      modelItems.push(...got);
      console.log(`  ✓ 第 ${start + 1}-${start + slice.length} 条整理完成`);
    } catch (error) {
      console.warn(`  ✗ 第 ${start + 1}-${start + slice.length} 条失败：${error.message}`);
    }
    if (start + BATCH < stories.length) await sleep(2500); // 让出免费额度
  }
  if (modelItems.length === 0) throw new Error('模型没有产出条目');
  console.log(`🧠 模型共产出 ${modelItems.length} 条`);

  const issue = buildIssue(stories, modelItems, today);
  const current = await readJson(CURRENT_FILE, { edition: {}, items: [] });
  const archive = await readJson(ARCHIVE_FILE, { windowDays: 90, asOfDate: today, issues: [] });

  // 归档：保留最近 90 天，同一天只留一份
  const merged = [];
  for (const candidate of [current, ...(archive.issues || [])]) {
    const date = candidate?.edition?.date;
    if (!date || !/^\d{4}\.\d{2}\.\d{2}$/.test(date)) continue;
    if (date === today) continue;
    if (candidate.items?.length === 0) continue;
    if (merged.some((m) => m.edition.date === date)) continue;
    merged.push(candidate);
  }
  const kept = merged
    .sort((a, b) => b.edition.date.localeCompare(a.edition.date))
    .slice(0, archive.windowDays || 90);

  await fs.writeFile(CURRENT_FILE, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    ARCHIVE_FILE,
    `${JSON.stringify({ windowDays: 90, asOfDate: today, issues: kept }, null, 2)}\n`,
    'utf8'
  );

  console.log(`✅ 已写入 ${issue.items.length} 条日报，历史保留 ${kept.length} 期`);
}

main().catch((error) => {
  console.error(`❌ 生成失败：${error.message}`);
  process.exit(1);
});
