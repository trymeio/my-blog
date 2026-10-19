"use client";

import TwikooComment from './TwikooComment';

interface MomentCommentsProps {
  id: string; // 说说的专属 ID，作为评论归属路径
}

export default function MomentComments({ id }: MomentCommentsProps) {
  return <TwikooComment path={id} />;
}
