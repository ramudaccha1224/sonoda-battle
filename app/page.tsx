"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function join() {
    const pw = password.trim();
    if (!pw) return;
    const n = name.trim() || "プレイヤー";
    // 合言葉をそのまま roomId として使う。Next.js のパスに渡すので encode する。
    router.push(`/battle/${encodeURIComponent(pw)}?name=${encodeURIComponent(n)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") join();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-center text-3xl font-bold">
        おかえりそのだくん・バトル
      </h1>
      <p className="text-center text-sm text-gray-400">
        ねこのぬいぐるみで対戦するターン制ゲーム
      </p>

      <div className="w-full space-y-3 rounded-lg bg-black/40 p-4">
        <label className="block text-sm">
          プレイヤー名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="そのだくん"
            className="mt-1 w-full rounded border border-white/20 bg-stadium-bg px-3 py-2 text-white outline-none focus:border-stadium-accent"
          />
        </label>

        <label className="block text-sm">
          合言葉
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="例: にゃんにゃん"
            className="mt-1 w-full rounded border border-white/20 bg-stadium-bg px-3 py-2 text-white outline-none focus:border-stadium-accent"
            autoComplete="off"
          />
        </label>

        <button
          onClick={join}
          disabled={!password.trim()}
          className="w-full rounded bg-stadium-accent px-4 py-2 font-bold text-white disabled:opacity-40"
        >
          この合言葉で入室
        </button>

        <p className="pt-1 text-center text-[11px] leading-relaxed text-gray-400">
          対戦相手にも同じ合言葉を伝えてください。<br />
          2 人が同じ合言葉で入室するとバトル開始です。
        </p>
      </div>

      <p className="text-center text-[10px] text-gray-500">
        合言葉は何でも OK（ひらがな・英数・記号など）。<br />
        既に 2 人入室済みの合言葉では入れません。
      </p>

      <Link
        href="/characters"
        className="w-full rounded-lg border border-white/20 bg-black/30 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
      >
        🐱 キャラクター情報をみる
      </Link>
    </main>
  );
}
