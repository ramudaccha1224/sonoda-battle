"use client";

import { useState } from "react";
import { MONSTERS, MONSTER_IDS } from "@/lib/monsters/definitions";
import type { MonsterId } from "@/lib/battle/types";
import { CharacterDetailModal } from "./CharacterDetailModal";
import { CatIcon } from "./CatIcon";

interface Props {
  onConfirm: (party: [MonsterId, MonsterId]) => void;
  disabled?: boolean;
}

/**
 * パーティ選択画面。
 * 表示するのは「名前」と「アイコン」のみ。
 * ロールや能力値は内部に保持しつつ、UI では出さない（モーダルでも表示しない）。
 */
export function PartySelect({ onConfirm, disabled }: Props) {
  const [picks, setPicks] = useState<MonsterId[]>([]);
  const [detail, setDetail] = useState<MonsterId | null>(null);

  function toggle(id: MonsterId) {
    setPicks((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 2) return cur;
      return [...cur, id];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-gray-300">
          パーティを 2 体選んでください（ {picks.length} / 2 ）
        </div>
        <div className="text-[10px] text-gray-500">
          「詳細」でキャラクターの情報を確認できます
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MONSTER_IDS.map((id) => {
          const def = MONSTERS[id];
          const selected = picks.includes(id);
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => toggle(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(id);
                }
              }}
              className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition ${
                selected
                  ? "border-stadium-accent bg-stadium-accent/15 ring-2 ring-stadium-accent"
                  : "border-white/15 bg-black/40 hover:bg-black/60"
              }`}
            >
              {selected && (
                <span className="absolute right-2 top-2 rounded-full bg-stadium-accent px-2 py-0.5 text-[10px] font-bold text-white">
                  選択中
                </span>
              )}
              <div className="rounded-full bg-black/30 p-2">
                <CatIcon color={def.displayColor} size={72} pattern={def.iconPattern} />
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
                詳細
              </button>
            </div>
          );
        })}
      </div>

      <button
        disabled={picks.length !== 2 || disabled}
        onClick={() => onConfirm(picks as [MonsterId, MonsterId])}
        className="w-full rounded-lg bg-stadium-accent px-4 py-2 font-bold text-white disabled:opacity-40"
      >
        {disabled ? "相手を待っています…" : "このパーティで決定"}
      </button>

      <CharacterDetailModal monsterId={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
