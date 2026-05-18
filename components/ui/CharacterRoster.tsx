"use client";

import { useState } from "react";
import { MONSTERS, MONSTER_IDS } from "@/lib/monsters/definitions";
import type { MonsterId } from "@/lib/battle/types";
import { CharacterDetailModal } from "./CharacterDetailModal";
import { CatIcon } from "./CatIcon";

/**
 * 【閲覧専用】キャラクター情報一覧。
 * TOP からアクセスする「キャラクター情報」ページで使う。
 *
 * 機能はカードをクリック → 詳細モーダル（わざ一覧）を開く、それだけ。
 * パーティ選択や決定ボタンは持たない。対戦用は {@link PartySelect} を使うこと。
 */
export function CharacterRoster() {
  const [detail, setDetail] = useState<MonsterId | null>(null);

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-gray-500">
        カードまたは「わざをみる」をタップすると、そのキャラの詳細とわざを確認できます
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MONSTER_IDS.map((id) => {
          const def = MONSTERS[id];
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => setDetail(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDetail(id);
                }
              }}
              className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-white/15 bg-black/40 p-4 transition hover:bg-black/60"
            >
              <div className="rounded-full bg-black/30 p-2">
                <CatIcon
                  color={def.displayColor}
                  size={72}
                  pattern={def.iconPattern}
                />
              </div>
              <div className="text-lg font-bold text-white">{def.name}</div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetail(id);
                }}
                className="rounded border border-white/20 px-3 py-1 text-xs text-gray-200 transition hover:bg-white/10"
              >
                わざをみる
              </button>
            </div>
          );
        })}
      </div>

      <CharacterDetailModal monsterId={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
