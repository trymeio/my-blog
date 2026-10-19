"use client";

import TwikooComment from './TwikooComment';

// 炼金实验室评论：统一接入 Twikoo，pageId 作为评论归属路径
export default function LabComments({ pageId }: { pageId?: string }) {
  return <TwikooComment path={pageId} />;
}
