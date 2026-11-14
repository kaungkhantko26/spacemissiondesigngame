import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { GameShell } from "@/components/shell/GameShell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Space Mission Design Game",
  description: "Cooperative space engineering strategy game — NASA Space Apps Challenge 2026 frontend prototype (mock data).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable}`}>
      <body>
        <GameShell>{children}</GameShell>
      </body>
    </html>
  );
}
