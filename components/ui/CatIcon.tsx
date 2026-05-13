"use client";

import { useId } from "react";
import type { IconPattern } from "@/lib/battle/types";

/**
 * キャラクターの 2D 円形アイコン。
 *
 * - 形は単純な円。耳・目・口などの顔パーツは描かない。
 * - 色と「模様（spots / paths）」だけでキャラを表現する。
 * - 選択画面のサムネ・HPバー横の小さな丸印・モーダル名前横の点など、
 *   全部この 1 コンポーネントを size 違いで使い回す。
 */
export function CatIcon({
  color,
  size = 56,
  pattern,
}: {
  color: string;
  size?: number;
  pattern?: IconPattern;
}) {
  const id = useId().replace(/[:]/g, "_");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`clip-${id}`}>
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>

      {/* ベースの円 */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill={color}
        stroke="#0006"
        strokeWidth="0.8"
      />

      {/* 模様は円の内側にクリップして描画 */}
      {(pattern?.paths || pattern?.spots) && (
        <g clipPath={`url(#clip-${id})`}>
          {pattern.paths?.map((p, i) => (
            <path key={`path-${i}`} d={p.d} fill={p.color} />
          ))}
          {pattern.spots?.map((s, i) => (
            <ellipse
              key={`spot-${i}`}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              fill={s.color}
              transform={
                s.rotation
                  ? `rotate(${s.rotation} ${s.cx} ${s.cy})`
                  : undefined
              }
            />
          ))}
        </g>
      )}
    </svg>
  );
}
