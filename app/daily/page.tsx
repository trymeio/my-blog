import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import DailyBriefing from '../../components/DailyBriefing';
import { siteConfig } from '@/siteConfig';

export const metadata = {
  title: '米米的AI日报 | ' + siteConfig.title,
  description: '每天一份由 AI 整理的中文简报：AI 科技、超英、游戏',
};

export default function DailyPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28 mx-auto w-full max-w-4xl px-4 sm:px-6">
          {/* 完整日报：可展开查看今日与往期全部新闻 */}
          <DailyBriefing />

          <p className="mt-6 text-center text-[11px] leading-6 text-slate-500 dark:text-slate-400">
            日报由 AI 自动整理，每日更新一次；内容来自公开资讯，仅供阅读参考。
          </p>
        </div>
      </PageTransition>
    </div>
  );
}
