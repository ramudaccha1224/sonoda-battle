"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { MonsterId, MoveDefinition, MoveEffect } from "@/lib/battle/types";
import { getMonsterDef } from "@/lib/monsters/definitions";
import { getMove } from "@/lib/monsters/moves";
import { CatIcon } from "./CatIcon";

const MonsterPreview = dynamic(
  () => import("@/components/canvas/MonsterPreview").then((m) => m.MonsterPreview),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-xs text-gray-400">プレビュー読み込み中…</div> },
);

interface Props {
  monsterId: MonsterId | null;
  onClose: () => void;
}

/**
 * キャラクター詳細モーダル。表示内容:
 *   - 名前
 *   - ビジュアル（3D プレビュー）
 *   - 誕生日 / 好きな食べ物
 *   - ディスクリプション
 *   - 覚えているわざ + 説明
 *
 * 内部データ（role / stats）は意図的に表示しない。
 */
export function CharacterDetailModal({ monsterId, onClose }: Props) {
  // ESCで閉じる
  useEffect(() => {
    if (!monsterId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [monsterId, onClose]);

  if (!monsterId) return null;
  const def = getMonsterDef(monsterId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-stadium-bg shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-2 py-1 text-sm text-white transition hover:bg-white/20"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr]">
          {/* 左: 3D プレビュー + プロフィール */}
          <div className="flex flex-col gap-2">
            <div className="h-64 overflow-hidden rounded-lg bg-black/40">
              <MonsterPreview defId={monsterId} />
            </div>
            <div className="rounded-lg bg-black/40 p-3 text-xs text-gray-200">
              <ProfileRow label="誕生日" value={def.birthday} />
              <ProfileRow label="好きな食べ物" value={def.favoriteFood} />
            </div>
          </div>

          {/* 右: 名前・説明・技 */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <CatIcon
                  color={def.displayColor}
                  size={28}
                  pattern={def.iconPattern}
                />
                <h2 className="text-2xl font-bold leading-none">{def.name}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-200">
                {def.description}
              </p>
            </div>

            <div>
              <div className="mb-1 text-xs text-gray-400">覚えているわざ</div>
              <div className="space-y-2">
                {def.moveIds.map((mid) => (
                  <MoveCard key={mid} move={getMove(mid)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[10px] text-gray-400">{label}</span>
      <span className="text-right text-sm text-white">{value}</span>
    </div>
  );
}

function MoveCard({ move }: { move: MoveDefinition }) {
  const power = move.power > 0 ? move.power : "—";
  const accuracy = move.alwaysHit ? "必中" : move.accuracy;
  const cat =
    move.category === "physical" ? "物理" :
    move.category === "special" ? "特殊" : "変化";
  return (
    <div className="rounded-lg bg-black/40 p-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="font-bold text-white">{move.name}</div>
        <div className="text-[10px] text-gray-400">
          {cat}
          {move.priority ? "・先制" : ""}
          ／威 {power}／命 {accuracy}／PP {move.pp}
        </div>
      </div>
      {move.effects && move.effects.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {move.effects.map((e, i) => (
            <span
              key={i}
              className="rounded bg-stadium-accent/15 px-1.5 py-0.5 text-[10px] text-stadium-accent"
            >
              {effectLabel(e)}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs leading-relaxed text-gray-300">{move.description}</p>
    </div>
  );
}

const STAT_LABEL_SHORT: Record<string, string> = {
  attack: "攻",
  defense: "防",
  spAttack: "特攻",
  spDefense: "特防",
  speed: "速",
};

const STATUS_LABEL_SHORT: Record<string, string> = {
  paralysis: "まひ",
  confusion: "こんらん",
  sleep: "ねむり",
  drowsy: "うとうと",
};

function effectLabel(effect: MoveEffect): string {
  switch (effect.kind) {
    case "heal_self":
      return `HP +${effect.percent}%`;
    case "heal_both":
      return `双方 HP +${effect.percent}%`;
    case "stat_change": {
      const who = effect.target === "self" ? "自分" : "相手";
      const sign = effect.stages > 0 ? "↑" : "↓";
      return `${who}${STAT_LABEL_SHORT[effect.stat]}${sign}${Math.abs(effect.stages)}`;
    }
    case "recoil":
      return `反動 ${Math.round(effect.ratio * 100)}%`;
    case "multi_hit":
      return `${effect.min}〜${effect.max}回連続`;
    case "body_press":
      return "ぼうぎょ依存ダメージ";
    case "protect":
      return "このターン守る";
    case "inflict_status":
      return `${STATUS_LABEL_SHORT[effect.status]} ${effect.chance}%`;
    case "flinch":
      return `ひるみ ${effect.chance}%`;
    case "cure_status":
      return "状態異常を治す";
    case "random_extra":
      return "ランダム追加効果";
  }
}
