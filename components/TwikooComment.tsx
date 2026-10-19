"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { siteConfig } from '../siteConfig';

interface TwikooCommentProps {
  path?: string;   // 自定义评论归属路径
  pageId?: string; // 兼容旧 LabComments / MomentComments 传参
}

// 通过 CDN 动态加载 twikoo（浏览器专用库，避免打包/SSR 冲突）
const TWIKOO_CDNS = [
  'https://cdn.jsdelivr.net/npm/twikoo@2.0.15/dist/twikoo.all.min.js',
  'https://unpkg.com/twikoo@2.0.15/dist/twikoo.all.min.js',
];

let twikooScriptPromise: Promise<any> | null = null;

function loadTwikoo(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).twikoo) {
    return Promise.resolve((window as any).twikoo);
  }
  if (twikooScriptPromise) return twikooScriptPromise;

  twikooScriptPromise = new Promise((resolve, reject) => {
    const tryLoad = (index: number) => {
      if (index >= TWIKOO_CDNS.length) { reject(new Error('twikoo 加载失败')); return; }
      const script = document.createElement('script');
      script.src = TWIKOO_CDNS[index];
      script.async = true;
      script.onload = () => {
        if ((window as any).twikoo) resolve((window as any).twikoo);
        else tryLoad(index + 1);
      };
      script.onerror = () => tryLoad(index + 1);
      document.head.appendChild(script);
    };
    tryLoad(0);
  });
  return twikooScriptPromise;
}

export default function TwikooComment({ path, pageId }: TwikooCommentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const twikooRef = useRef<any>(null);

  const lastPathRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current) return;
    // 清空容器，防止 Next.js 路由切换时重复渲染
    containerRef.current.innerHTML = '';
    const commentPath = path || pageId || pathname || '/';
    lastPathRef.current = commentPath;

    loadTwikoo()
      .then((twikoo) => {
        twikooRef.current = twikoo;
        return twikoo.init({
          envId: siteConfig.twikooConfig.envId,
          el: containerRef.current,
          path: commentPath,
          lang: 'zh-CN',
          darkMode: document.documentElement.classList.contains('dark'),
        });
      })
      .catch(() => { /* 忽略加载失败 */ });
  }, [path, pageId, pathname]);

  // 监听 html 的 dark 类切换：重新 init 评论以应用新主题（Twikoo 无 setDarkMode API）
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      if (twikooRef.current && containerRef.current && lastPathRef.current) {
        twikooRef.current
          .init({
            envId: siteConfig.twikooConfig.envId,
            el: containerRef.current,
            path: lastPathRef.current,
            lang: 'zh-CN',
            darkMode: isDark,
          })
          .catch(() => { /* ignore */ });
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full mt-10 relative">
      {/* 底部环境光晕 */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none z-0"></div>
      {/* Twikoo 容器 */}
      <div ref={containerRef} className="relative z-10 twikoo-glass" />

      {/* 🌟 圆角 + 半透明毛玻璃样式（适配日间/夜间） */}
      <style jsx global>{`
        .twikoo-glass {
          border-top: 1px solid rgba(148, 163, 184, 0.25);
          padding-top: 1.5rem;
        }
        .twikoo-glass .tk-submit {
          border-radius: 18px !important;
          overflow: hidden;
        }
        .twikoo-glass .tk-input {
          background: rgba(255, 255, 255, 0.12) !important;
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 16px !important;
          transition: all 0.3s ease;
        }
        .twikoo-glass .tk-input:focus {
          background: rgba(255, 255, 255, 0.22) !important;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25) !important;
        }
        .twikoo-glass .tk-button {
          border-radius: 12px !important;
          background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
          border: none !important;
          color: #fff !important;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35) !important;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .twikoo-glass .tk-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5) !important;
        }
        .twikoo-glass .tk-comment-item {
          border-radius: 14px !important;
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(8px) !important;
          margin-bottom: 0.75rem !important;
          padding: 0.75rem !important;
        }
        .twikoo-glass .tk-comment {
          border-radius: 12px !important;
        }
        .twikoo-glass .tk-action {
          border-radius: 10px !important;
        }
        .twikoo-glass .tk-icon {
          border-radius: 8px !important;
        }
        .tk-dark .tk-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
        .tk-dark .tk-comment-item {
          background: rgba(0, 0, 0, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
