import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "알다마",
  description: "흩어진 대학 공지와 마감을 한눈에 정리하는 일정 카드 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
