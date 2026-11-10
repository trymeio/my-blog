import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import DailyBriefing from '../../components/DailyBriefing';
import { siteConfig } from '@/siteConfig';

export const metadata = {
  title: 'AI 日报 | ' + siteConfig.title,
  description: '每天一份由 AI 整理的中文简报：科技、AI 前沿、开发与产品、趣味杂谈',
};

export default function DailyPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28 mx-auto w-full max-w-4xl px-4 sm:px-6">
          <DailyBriefing />
          <p className="mt-6 text-center text-[11px] leading-6 text-slate-500 dark:text-slate-400">
            日报由 AI 自动整理，每日更新一次；内容来自公开资讯，仅供阅读参考。
          </p>
        </div>
      </PageTransition>
    </div>
  );
}
