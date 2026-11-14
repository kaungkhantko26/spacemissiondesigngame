import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import "./globals.css";
import { GameShell } from "@/components/shell/GameShell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Rajdhani({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Space Mission Design Game",
  description: "Cooperative space engineering strategy game — NASA Space Apps Challenge 2026 frontend prototype (mock data).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>
        <GameShell>{children}</GameShell>
      </body>
    </html>
  );
}
