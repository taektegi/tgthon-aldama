import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // 스크린샷 업로드(이미지 분석)를 위해 요청 크기 한도 확대
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
