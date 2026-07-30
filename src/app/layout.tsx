import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "갈피",
  applicationName: "갈피",
  description: "흩어진 대학 공지와 마감을 한눈에 정리하는 일정 카드 서비스",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/galpi-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/galpi-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "갈피",
  },
};

export const viewport: Viewport = {
  themeColor: "#303133",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
