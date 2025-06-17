import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ToneCheck - Professional Writing Assistant",
  description: "Check your writing tone and professionalism in real-time",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-spotify-black font-spotify">{children}</body>
    </html>
  );
}
