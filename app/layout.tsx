import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TETRIS BATTLE - Online",
  description: "Real-time online Tetris battle game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
