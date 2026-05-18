"use client";

import { getMonsterDef } from "@/lib/monsters/definitions";
import type { PlayerState } from "@/lib/battle/types";
import { HpBar } from "./HpBar";
import { CatIcon } from "./CatIcon";

interface Props {
  player: PlayerState;
  side: "left" | "right";
}

/**
 * プレイヤー1人分のパーティ情報。
 * 名前 + 2 体のモンスター（アイコン + 名前 + HP バー）。
 *
 * 上部 2 カラムに左右並べる前提で、スマホ画面でもはみ出さないよう
 * フォント・パディング・HP バーをすべてコンパクトに寄せている。
 */
export function PartyBar({ player, side }: Props) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 rounded-lg bg-black/60 px-2 py-1.5 backdrop-blur ${
        side === "left" ? "items-start" : "items-end"
      }`}
    >
      <div className="truncate max-w-full text-xs font-bold text-white">
        {player.name}
      </div>
      {player.party.map((m, i) => {
        const def = getMonsterDef(m.defId);
        const isActive = i === player.activeIndex;
        return (
          <div
            key={i}
            className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 ${
              side === "right" ? "flex-row-reverse" : ""
            } ${
              isActive ? "bg-stadium-accent/20 ring-1 ring-stadium-accent" : ""
            } ${m.fainted ? "opacity-40 line-through" : ""}`}
          >
            <CatIcon
              color={def.displayColor}
              size={14}
              pattern={def.iconPattern}
            />
            <div className="shrink-0 text-[10px] text-gray-100">{def.name}</div>
            <div className="min-w-0 flex-1">
              <HpBar current={m.currentHp} max={def.stats.hp} compact />
            </div>
          </div>
        );
      })}
    </div>
  );
}
