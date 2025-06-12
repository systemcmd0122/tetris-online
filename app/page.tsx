"use client";

import dynamic from "next/dynamic";

const OnlineTetris = dynamic(() => import("@/components/online-tetris"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <OnlineTetris />
    </main>
  );
}
