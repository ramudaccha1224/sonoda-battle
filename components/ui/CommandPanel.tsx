"use client";

import { useMemo, useState } from "react";
import type {
  BattleSnapshot,
  Command,
  MoveDefinition,
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
  /** 相手が技を決めたか。disabled でない時のヒント表示用。 */
  opponentCommitted?: boolean;
  onSubmit: (cmd: Command) => void;
}

type Tab = "fight" | "switch";

const CATEGORY_LABEL = {
  physical: "物理",
  special: "特殊",
  status: "変化",
} as const;

export function CommandPanel({ snapshot, yourSlot, disabled, opponentCommitted, onSubmit }: Props) {
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
                  威 {movePowerLabel(move)} / 命 {move.accuracy} / PP {pp}/{move.pp}
                </div>
                {(move.effects?.length || hasSpecialFlag(move)) && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {specialFlagsHint(move).map((s, i) => (
                      <span key={`sp-${i}`} className="text-[10px] text-rose-300">
                        {s}
                      </span>
                    ))}
                    {move.effects?.map((e, i) => (
                      <span key={`ef-${i}`} className="text-[10px] text-stadium-accent">
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

      {disabled ? (
        <div className="mt-2 text-center text-xs text-yellow-300">
          相手の入力を待っています…
        </div>
      ) : opponentCommitted ? (
        <div className="mt-2 text-center text-xs text-stadium-accent">
          相手は技を決めました（あなたの入力を待っています）
        </div>
      ) : null}
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
  confusion: "こんらん",
};

function movePowerLabel(move: MoveDefinition): string {
  if (move.fixedDamage != null) return `${move.fixedDamage}固定`;
  if (move.instantKo) return "—";
  if (move.timeConditionalPower) {
    return `${move.timeConditionalPower.day}/${move.timeConditionalPower.night}`;
  }
  if (move.effects?.some((e) => e.kind === "body_press")) return "防御依存";
  return move.power > 0 ? String(move.power) : "—";
}

function hasSpecialFlag(move: MoveDefinition): boolean {
  return !!(
    move.fixedDamage != null ||
    move.instantKo ||
    move.timeConditionalPower ||
    move.setTimeOfDay ||
    move.physicalCounter
  );
}

function specialFlagsHint(move: MoveDefinition): string[] {
  const out: string[] = [];
  if (move.fixedDamage != null) out.push(`固定${move.fixedDamage}`);
  if (move.instantKo) out.push("命中で即死");
  if (move.timeConditionalPower) {
    out.push(`昼${move.timeConditionalPower.day} / 夜${move.timeConditionalPower.night}`);
  }
  if (move.setTimeOfDay) {
    out.push(move.setTimeOfDay === "night" ? "→夜に" : "→昼に");
  }
  if (move.physicalCounter) {
    out.push(`HP-${move.physicalCounter.hpCostPercent}% / 物理反射×${move.physicalCounter.multiplier}`);
  }
  return out;
}

function effectHint(effect: MoveEffect): string {
  switch (effect.kind) {
    case "heal_self":
      if (effect.flat != null) return `自HP +${effect.flat}`;
      return `自HP +${effect.percent ?? 0}%`;
    case "heal_all_alive":
      return `全員 HP +${effect.percent}%`;
    case "stat_change": {
      const who = effect.target === "self" ? "自" : "相";
      const sign = effect.stages > 0 ? "↑" : "↓";
      return `${who}${STAT_LABEL_SHORT[effect.stat]}${sign}${Math.abs(effect.stages)}`;
    }
    case "flat_stat_bonus": {
      const who = effect.target === "self" ? "自" : "相";
      const sign = effect.amount >= 0 ? "+" : "";
      return `${who}${STAT_LABEL_SHORT[effect.stat]}${sign}${effect.amount}`;
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
  }
}
