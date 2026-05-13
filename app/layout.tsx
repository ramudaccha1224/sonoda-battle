import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "おかえりそのだくん・バトル",
  description: "3D ターン制対戦ゲーム（プロトタイプ）",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-stadium-bg text-white">{children}</body>
    </html>
  );
}
