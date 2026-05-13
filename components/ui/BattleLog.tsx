"use client";

import { useEffect, useRef } from "react";

interface Props {
  log: string[];
}

export function BattleLog({ log }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [log.length]);

  return (
    <div
      ref={ref}
      className="h-32 overflow-y-auto rounded-lg bg-black/70 p-2 text-xs text-gray-100 backdrop-blur"
    >
      {log.map((line, i) => (
        <div key={i} className="leading-relaxed">
          {line}
        </div>
      ))}
    </div>
  );
}
