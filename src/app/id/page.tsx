"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IdBadge } from "@/components/screens/IdBadge";
import { decodeCard } from "@/lib/idcard";

function Shared() {
  const q = useSearchParams().get("c");
  const card = q ? decodeCard(q) : null;
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center gap-4 p-6 text-center">
      <p className="hud-label !text-orange">Space Mission Design · Crew ID</p>
      {card ? <IdBadge card={card} /> : <p className="text-ink2">This crew ID link isn&apos;t valid.</p>}
      <Link href="/menu" className="mx-auto mt-2 rounded-lg border border-orange bg-orange px-5 py-2.5 font-display font-bold text-[#1a0b00]">Play the game</Link>
    </main>
  );
}
export default function Page() { return <Suspense fallback={null}><Shared /></Suspense>; }
