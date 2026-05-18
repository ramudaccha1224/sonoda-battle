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
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-stadium-bg shadow-2xl ring-1 ring-white/10"
        // iOS Safari の URL バーに被って下部ボタンが見切れないよう、
        // svh（small viewport height）/ dvh（dynamic viewport height）でフォールバック付き指定。
        // svh は URL バー表示中の小さい viewport、対応しない古い環境では vh にフォールバック。
        style={{ maxHeight: "min(92vh, 88svh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-2 py-1 text-sm text-white transition hover:bg-white/20"
        >
          ✕
        </button>

        {/* スクロールするコンテンツ部分 */}
        <div className="flex-1 overflow-y-auto">
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

        {/* 下部の大きな戻るボタン（タップしやすい固定フッター）
            iPhone のホームインジケータ領域に被らないよう safe-area inset を確保 */}
        <div
          className="border-t border-white/10 bg-stadium-bg/95 px-3 pt-3 backdrop-blur"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-stadium-accent px-4 py-3 text-base font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
          >
            戻る
          </button>
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

function movePowerLabel(move: MoveDefinition): string {
  if (move.fixedDamage != null) return `${move.fixedDamage}固定`;
  if (move.instantKo) return "—";
  if (move.timeConditionalPower) {
    return `昼${move.timeConditionalPower.day}/夜${move.timeConditionalPower.night}`;
  }
  if (move.effects?.some((e) => e.kind === "body_press")) return "防御依存";
  return move.power > 0 ? String(move.power) : "—";
}

function specialFlagsHint(move: MoveDefinition): string[] {
  const out: string[] = [];
  if (move.fixedDamage != null) out.push(`固定 ${move.fixedDamage} ダメージ`);
  if (move.instantKo) out.push("命中で一撃即死");
  if (move.timeConditionalPower) {
    out.push(`昼威力${move.timeConditionalPower.day} / 夜威力${move.timeConditionalPower.night}`);
  }
  if (move.setTimeOfDay) {
    out.push(move.setTimeOfDay === "night" ? "時間帯→夜" : "時間帯→昼");
  }
  if (move.physicalCounter) {
    out.push(
      `HP -${move.physicalCounter.hpCostPercent}% / 同ラウンドの物理を ×${move.physicalCounter.multiplier} 反射`,
    );
  }
  return out;
}

function MoveCard({ move }: { move: MoveDefinition }) {
  const cat =
    move.category === "physical" ? "物理" :
    move.category === "special" ? "特殊" : "変化";
  const flags = specialFlagsHint(move);
  return (
    <div className="rounded-lg bg-black/40 p-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="font-bold text-white">{move.name}</div>
        <div className="text-[10px] text-gray-400">
          {cat}／威 {movePowerLabel(move)}／命 {move.accuracy}／PP {move.pp}
        </div>
      </div>
      {(flags.length > 0 || (move.effects && move.effects.length > 0)) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {flags.map((s, i) => (
            <span
              key={`sp-${i}`}
              className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300"
            >
              {s}
            </span>
          ))}
          {move.effects?.map((e, i) => (
            <span
              key={`ef-${i}`}
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
  confusion: "こんらん",
};

function effectLabel(effect: MoveEffect): string {
  switch (effect.kind) {
    case "heal_self":
      if (effect.flat != null) return `HP +${effect.flat}`;
      return `HP +${effect.percent ?? 0}%`;
    case "heal_all_alive":
      return `全員 HP +${effect.percent}%`;
    case "stat_change": {
      const who = effect.target === "self" ? "自分" : "相手";
      const sign = effect.stages > 0 ? "↑" : "↓";
      return `${who}${STAT_LABEL_SHORT[effect.stat]}${sign}${Math.abs(effect.stages)}`;
    }
    case "flat_stat_bonus": {
      const who = effect.target === "self" ? "自" : "相";
      const sign = effect.amount >= 0 ? "+" : "";
      return `${who}${STAT_LABEL_SHORT[effect.stat]} ${sign}${effect.amount}`;
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
  }
}
