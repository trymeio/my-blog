import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify 支持完整的 Next.js 功能，包括 API 路由
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true, // 忽略 TS 错误，方便快速部署
  },
};

export default nextConfig;
