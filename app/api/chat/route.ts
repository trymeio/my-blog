// app/api/chat/route.ts
// 右下角 AI 小猫「煤球」后端：OpenRouter + NVIDIA Nemotron（多模态，支持文字与图片）
import { siteConfig } from '../../../siteConfig';

export const runtime = 'edge';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ChatImage = { url: string }; // data:image/...;base64,... 或公网 http(s) 图片地址

async function callOpenRouter(apiKey: string, body: unknown, retry = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retry; attempt++) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter 必填的应用标识头（HTTP 头只能是 ASCII，不能用中文标题）
        'HTTP-Referer': siteConfig.siteUrl,
        'X-Title': 'mmzhw-blog',
      },
      body: JSON.stringify(body),
    });

    // 免费额度限流 / 上游抖动时退避重试
    if ((res.status === 429 || res.status >= 500) && attempt < retry) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    return res;
  }
  throw new Error('OpenRouter unreachable');
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as { message?: string; images?: ChatImage[] };
    const message = (payload?.message || '').toString().trim();
    const images = Array.isArray(payload?.images) ? payload.images.filter((i) => i?.url).slice(0, 2) : [];

    if (!message && images.length === 0) {
      return new Response(JSON.stringify({ error: '空消息' }), { status: 400 });
    }

    const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!apiKey) {
      console.error('❌ OPENROUTER_API_KEY 未配置');
      return new Response(JSON.stringify({ error: 'Key missing' }), { status: 500 });
    }

    const cfg = siteConfig.aiCatConfig;

    // 多模态：文字 + 图片走 content 数组；纯文字用字符串以省 token
    const userContent: unknown = images.length
      ? [
          { type: 'text', text: message || '看看这张图，用你的风格评论一下喵~' },
          ...images.map((img) => ({ type: 'image_url', image_url: { url: img.url } })),
        ]
      : message;

    const body = {
      model: cfg.modelId,
      messages: [
        { role: 'system', content: cfg.systemPrompt },
        { role: 'user', content: userContent },
      ],
      // 关闭思考过程：Nemotron 会把大量 token 花在 reasoning 上，响应变慢且正文容易为空
      max_tokens: cfg.maxOutputTokens,
      temperature: cfg.temperature,
      reasoning: { enabled: false },
    };

    const res = await callOpenRouter(apiKey, body);
    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = data?.error?.message || `HTTP ${res.status}`;
      console.error('🚨 OpenRouter 拒绝:', detail);
      return new Response(JSON.stringify({ error: '模型暂时不可用', details: detail }), { status: 502 });
    }

    const reply = (data?.choices?.[0]?.message?.content || '').toString().trim();

    return new Response(
      JSON.stringify({
        reply: reply || '本喵刚刚走神了喵…再说一遍好不好喵~',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('🔥 运行时崩溃:', error?.message);
    return new Response(JSON.stringify({ error: error?.message || 'unknown' }), { status: 500 });
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: 'Ready', provider: 'openrouter', model: siteConfig.aiCatConfig.modelId }),
    { status: 200 }
  );
}
