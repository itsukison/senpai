import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SenpAI Sensei",
  description: "職場チャットをAIが改善。「チームが動く」プロフェッショナルな表現へ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white font-spotify">{children}</body>
    </html>
  );
}
