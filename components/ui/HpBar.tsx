"use client";

interface Props {
  current: number;
  max: number;
  /** 数値テキスト (current/max) を出さない、親の幅にフィットさせる省スペース表示。 */
  compact?: boolean;
}

export function HpBar({ current, max, compact }: Props) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const color =
    ratio > 0.5 ? "bg-green-500" : ratio > 0.2 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full">
      <div className="h-2 w-full rounded bg-gray-700 overflow-hidden">
        <div
          className={`h-full ${color} transition-[width] duration-[2500ms] ease-out`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-0.5 text-right text-[10px] text-gray-300">
          {current} / {max}
        </div>
      )}
    </div>
  );
}
