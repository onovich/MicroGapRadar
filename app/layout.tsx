import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MicroGap Radar",
  description:
    "A self-use-first radar for discovering low-competition AI microtool opportunities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
