import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { TopMenuBarHost } from "@/components/top-menu-bar-host";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodexOS",
  description: "개인 개발 AI 에이전트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <ThemeProvider>
          <TopMenuBarHost />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
