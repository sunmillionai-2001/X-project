import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "X Studio · AI 创作工作台",
  description: "从热点、证据和自己的实践，创作有价值的 X 内容。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
