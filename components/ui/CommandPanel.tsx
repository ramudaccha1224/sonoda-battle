"use client";

import { useMemo, useState } from "react";
import type {
  BattleSnapshot,
  Command,
  MoveEffect,
  PlayerSlot,
} from "@/lib/battle/types";
import { getMonsterDef } from "@/lib/monsters/definitions";
import { getMove } from "@/lib/monsters/moves";

interface Props {
  snapshot: BattleSnapshot;
  yourSlot: PlayerSlot;
  /** アニメーション中などに UI を無効化する。 */
  disabled?: boolean;
  onSubmit: (cmd: Command) => void;
}

type Tab = "fight" | "switch";

const CATEGORY_LABEL = {
  physical: "物理",
  special: "特殊",
  status: "変化",
} as const;

export function CommandPanel({ snapshot, yourSlot, disabled, onSubmit }: Props) {
  const [tab, setTab] = useState<Tab>("fight");
  const you = snapshot.players[yourSlot];
  const active = you.party[you.activeIndex];
  const def = useMemo(() => getMonsterDef(active.defId), [active.defId]);

  return (
    <div className="rounded-lg bg-black/70 p-3 backdrop-blur">
      <div className="mb-2 flex gap-2 text-xs">
        <TabBtn label="たたかう" active={tab === "fight"} onClick={() => setTab("fight")} />
        <TabBtn label="交代" active={tab === "switch"} onClick={() => setTab("switch")} />
      </div>

      {tab === "fight" && (
        <div className="grid grid-cols-2 gap-2">
          {def.moveIds.map((mid) => {
            const move = getMove(mid);
            const pp = active.ppLeft[mid] ?? 0;
            const noPp = pp <= 0;
            return (
              <button
                key={mid}
                disabled={disabled || noPp || active.fainted}
                onClick={() => onSubmit({ type: "move", moveId: mid })}
                className="rounded border border-white/20 bg-stadium-bg p-2 text-left text-sm text-white transition hover:bg-stadium-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
                title={move.description}
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-bold">{move.name}</div>
                  <div className="text-[10px] text-gray-400">
                    {CATEGORY_LABEL[move.category]}
                    {move.priority ? "・先制" : ""}
                  </div>
                </div>
                <div className="text-[10px] text-gray-300">
                  威 {move.power || "-"} / 命 {move.alwaysHit ? "必中" : move.accuracy} / PP {pp}/{move.pp}
                </div>
                {move.effects && move.effects.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {move.effects.map((e, i) => (
                      <span key={i} className="text-[10px] text-stadium-accent">
                        {effectHint(e)}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {tab === "switch" && (
        <div className="grid grid-cols-2 gap-2">
          {you.party.map((m, i) => {
            const partyDef = getMonsterDef(m.defId);
            const isCurrent = i === you.activeIndex;
            const cannot = disabled || m.fainted || isCurrent;
            return (
              <button
                key={i}
                disabled={cannot}
                onClick={() => onSubmit({ type: "switch", toIndex: i })}
                className="flex items-center gap-2 rounded border border-white/20 bg-stadium-bg p-2 text-left text-sm text-white transition hover:bg-stadium-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div
                  className="h-4 w-4 rounded-full border border-white/30"
                  style={{ background: partyDef.displayColor }}
                />
                <div>
                  <div className="font-bold">{partyDef.name}</div>
                  <div className="text-[10px] text-gray-300">
                    HP {m.currentHp}/{partyDef.stats.hp}
                    {isCurrent ? "（場に出ている）" : m.fainted ? "（ひんし）" : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {disabled && (
        <div className="mt-2 text-center text-xs text-yellow-300">
          バトル演出中…
        </div>
      )}
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 ${
        active ? "bg-stadium-accent text-white" : "bg-white/10 text-gray-300"
      }`}
    >
      {label}
    </button>
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

function effectHint(effect: MoveEffect): string {
  switch (effect.kind) {
    case "heal_self":
      return `自HP +${effect.percent}%`;
    case "heal_both":
      return `双方 HP +${effect.percent}%`;
    case "stat_change": {
      const who = effect.target === "self" ? "自" : "相";
      const sign = effect.stages > 0 ? "↑" : "↓";
      return `${who}${STAT_LABEL_SHORT[effect.stat]}${sign}${Math.abs(effect.stages)}`;
    }
    case "recoil":
      return `反動${Math.round(effect.ratio * 100)}%`;
    case "multi_hit":
      return `${effect.min}〜${effect.max}回連続`;
    case "body_press":
      return "防御依存";
    case "protect":
      return "守る";
    case "inflict_status":
      return `${STATUS_LABEL_SHORT[effect.status]}${effect.chance}%`;
    case "flinch":
      return `ひるみ${effect.chance}%`;
    case "cure_status":
      return "状態回復";
    case "random_extra":
      return "ランダム効果";
  }
}
