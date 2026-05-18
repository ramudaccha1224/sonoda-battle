"use client";

import Link from "next/link";
import { CharacterRoster } from "@/components/ui/CharacterRoster";

/**
 * 【閲覧専用】キャラクター情報ページ。TOP からアクセス可能。
 * 対戦用パーティ選択（ルーム内）とは別物。決定ボタンは持たない。
 */
export default function CharactersPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">キャラクター情報</h1>
        <Link
          href="/"
          className="rounded border border-white/20 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
        >
          ← TOPに戻る
        </Link>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-gray-400">
        対戦に登場するキャラクターたちの一覧です。<br />
        カードをタップすると詳細とわざがみられます。
      </p>

      <CharacterRoster />

      <div className="mt-6">
        <Link
          href="/"
          className="block w-full rounded-lg bg-stadium-accent px-4 py-3 text-center text-base font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
        >
          TOPに戻る
        </Link>
      </div>
    </main>
  );
}
