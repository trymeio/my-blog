'use client';

// 米米的AI日报 · 首页/日报页轮播卡片
// 每隔 4 秒从当天收集到的新闻里切一条：主标题固定，副标题换成当前新闻标题，封面按顺序循环使用
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { briefingEdition, briefingItems, type BriefingItem } from '../data/dailyBriefing';

const COVERS = [
  '/daily-covers/cover-1.jpg',
  '/daily-covers/cover-2.jpg',
  '/daily-covers/cover-3.jpg',
  '/daily-covers/cover-4.jpg',
  '/daily-covers/cover-5.jpg',
  '/daily-covers/cover-6.jpg',
  '/daily-covers/cover-7.jpg',
];

const CHANNEL_NAME: Record<string, string> = {
  ai: 'AI 科技',
  hero: '超英',
  game: '游戏',
};

const INTERVAL_SECONDS = 4;

export default function DailyBriefingCarousel({
  variant = 'home',
}: {
  variant?: 'home' | 'page';
}) {
  const items = useMemo<BriefingItem[]>(() => {
    const list = (briefingItems || []).filter((item) => item && item.title);
    return list.slice(0, 12);
  }, []);

  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (items.length < 2 || hovered || reduced) return;
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % items.length);
    }, INTERVAL_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [items.length, hovered, reduced]);

  if (items.length === 0) {
    return (
      <Link
        href="/daily"
        className="block w-full overflow-hidden rounded-3xl border border-white/40 bg-slate-900 shadow-xl dark:border-white/10 min-h-[190px] sm:min-h-[210px] relative group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-800/40" />
        <div className="relative flex min-h-[190px] sm:min-h-[210px] flex-col justify-center p-6 sm:px-8">
          <span className="text-[10px] tracking-[0.28em] text-indigo-200/90">DAILY SIGNAL</span>
          <span className="mb-2 mt-1 block text-xl font-black leading-snug text-white sm:text-2xl">米米的AI日报</span>
          <span className="text-[11px] leading-relaxed text-white/70">今天的日报还在路上，晚点再来看看喵~</span>
        </div>
      </Link>
    );
  }

  const current = items[index % items.length];
  // 封面按新闻顺序循环分配，用完从头接着排
  const cover = COVERS[index % COVERS.length];
  const date = briefingEdition?.date || '';

  return (
    <Link
      href="/daily"
      aria-label="打开米米的AI日报"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative block w-full overflow-hidden rounded-3xl border border-white/40 bg-slate-900 shadow-xl transition-transform duration-500 hover:scale-[1.01] dark:border-white/10 ${
        variant === 'home' ? 'min-h-[200px] sm:min-h-[230px]' : 'min-h-[210px] sm:min-h-[240px]'
      }`}
    >
      {/* 封面：交叉淡入切换 */}
      {COVERS.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          style={{ opacity: i === index % COVERS.length ? 1 : 0 }}
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[900ms] motion-reduce:transition-none"
        />
      ))}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/60 to-slate-950/15" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />

      <span className="relative flex min-h-[200px] sm:min-h-[230px] flex-col justify-between p-5 sm:px-8 sm:py-6">
        {/* 顶部：标识 + 日期 + 分类 */}
        <span className="flex flex-wrap items-center gap-2.5 text-[9px] font-bold tracking-[0.2em] text-white/75 sm:text-[10px]">
          <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 tracking-[0.15em] backdrop-blur-sm">DAILY SIGNAL</span>
          <span className="font-mono tracking-wider">{date}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 tracking-wider text-white/85">
            {CHANNEL_NAME[current.category] || '资讯'}
          </span>
          {items.length > 1 && (
            <span className="ml-auto font-mono tracking-wider text-white/50">
              {String(index + 1).padStart(2, '0')}/{String(items.length).padStart(2, '0')}
            </span>
          )}
        </span>

        {/* 中部：总标题 + 当前新闻标题（副标题） */}
        <span className="mt-5 block max-w-[92%] sm:max-w-[76%]">
          <span className="mb-1.5 block text-[10px] tracking-[0.26em] text-indigo-200/90">米米的AI日报</span>
          {/* 用 key 触发淡入，切换时只动副标题与摘要 */}
          <span key={`title-${index}`} className="briefing-fade block text-xl font-black leading-snug tracking-wide text-white drop-shadow-md sm:text-[26px]">
            {current.title}
          </span>
          <span key={`summary-${index}`} className="briefing-fade mt-2 block line-clamp-2 text-[11px] leading-relaxed tracking-wide text-white/80 sm:text-xs">
            {current.summary}
          </span>
        </span>

        {/* 底部：分类统计 + 进入提示 */}
        <span className="mt-4 flex items-end justify-between gap-3">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/70">
            {(Object.keys(CHANNEL_NAME) as string[]).map((id) => (
              <span key={id}>
                {CHANNEL_NAME[id]} <b className="ml-1 font-mono font-normal text-white">{String(items.filter((i) => i.category === id).length).padStart(2, '0')}</b>
              </span>
            ))}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[10px] text-white/85">
            <span className="hidden sm:inline">展开完整日报</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition group-hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12l-7.5 7.5M21 12H3" />
              </svg>
            </span>
          </span>
        </span>
      </span>

    </Link>
  );
}
