"use client";

interface Props {
  log: string[];
}

/** 表示する直近行数。これより古いものはフェードして消えていく。 */
const VISIBLE = 3;

/**
 * バトルログ。常に直近 VISIBLE 行だけを表示する。
 * 新しい行が来ると、いちばん古いものが消えて全体が 1 つずつ上にシフトしていく。
 * 残っている行も「古いほど薄い」濃淡をつけて視線を最新行に集める。
 */
export function BattleLog({ log }: Props) {
  // 直近 VISIBLE 行だけスライス。
  const recent = log.slice(-VISIBLE);
  // 安定 key = ログ全体のインデックス（ずれてもキーがズレないようにする）
  const baseIndex = log.length - recent.length;

  return (
    <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-gray-100 backdrop-blur">
      {recent.length === 0 ? (
        <div className="leading-relaxed text-gray-500">&nbsp;</div>
      ) : (
        recent.map((line, i) => {
          // i: 0 が表示中で一番古い、recent.length-1 が一番新しい
          const isNewest = i === recent.length - 1;
          // 古いほど薄く
          const opacity =
            i === 0
              ? "opacity-40"
              : i === 1
                ? "opacity-70"
                : "opacity-100";
          return (
            <div
              key={baseIndex + i}
              className={`leading-relaxed transition-opacity duration-500 ${opacity} ${
                isNewest ? "text-white" : "text-gray-300"
              }`}
            >
              {line}
            </div>
          );
        })
      )}
    </div>
  );
}
