"use client";

interface Props {
  current: number;
  max: number;
  compact?: boolean;
}

export function HpBar({ current, max, compact }: Props) {
  const ratio = Math.max(0, Math.min(1, current / max));
  const color =
    ratio > 0.5 ? "bg-green-500" : ratio > 0.2 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className={compact ? "w-24" : "w-full"}>
      <div className="h-2 w-full rounded bg-gray-700 overflow-hidden">
        <div
          className={`h-full ${color} transition-[width] duration-[800ms] ease-out`}
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
