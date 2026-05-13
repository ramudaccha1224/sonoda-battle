"use client";

import { getMonsterDef } from "@/lib/monsters/definitions";
import type { PlayerState } from "@/lib/battle/types";
import { HpBar } from "./HpBar";
import { CatIcon } from "./CatIcon";

interface Props {
  player: PlayerState;
  side: "left" | "right";
}

export function PartyBar({ player, side }: Props) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg bg-black/60 p-2 backdrop-blur ${
        side === "left" ? "items-start" : "items-end"
      }`}
    >
      <div className="text-sm font-bold text-white">{player.name}</div>
      {player.party.map((m, i) => {
        const def = getMonsterDef(m.defId);
        const isActive = i === player.activeIndex;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 rounded px-2 py-1 ${
              isActive ? "bg-stadium-accent/20 ring-1 ring-stadium-accent" : ""
            } ${m.fainted ? "opacity-40 line-through" : ""}`}
          >
            <CatIcon
              color={def.displayColor}
              size={16}
              pattern={def.iconPattern}
            />
            <div className="text-xs text-gray-100">{def.name}</div>
            <HpBar current={m.currentHp} max={def.stats.hp} compact />
          </div>
        );
      })}
    </div>
  );
}
