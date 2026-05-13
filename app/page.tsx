"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function newRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  function create() {
    const id = newRoomId();
    const n = name.trim() || "プレイヤー";
    router.push(`/battle/${id}?name=${encodeURIComponent(n)}`);
  }

  function join() {
    const id = room.trim();
    if (!id) return;
    const n = name.trim() || "プレイヤー";
    router.push(`/battle/${id}?name=${encodeURIComponent(n)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-center text-3xl font-bold">
        おかえりそのだくん・バトル
      </h1>
      <p className="text-center text-sm text-gray-400">
        ポケモンスタジアム風の 3D 2 対 2 ターン制対戦
      </p>

      <div className="w-full space-y-3 rounded-lg bg-black/40 p-4">
        <label className="block text-sm">
          プレイヤー名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="そのだくん"
            className="mt-1 w-full rounded border border-white/20 bg-stadium-bg px-3 py-2 text-white outline-none focus:border-stadium-accent"
          />
        </label>

        <button
          onClick={create}
          className="w-full rounded bg-stadium-accent px-4 py-2 font-bold text-white"
        >
          ルームを作って対戦相手を待つ
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex-1 border-t border-white/10" />
          <span>または</span>
          <span className="flex-1 border-t border-white/10" />
        </div>

        <label className="block text-sm">
          ルームID
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="abc123"
            className="mt-1 w-full rounded border border-white/20 bg-stadium-bg px-3 py-2 text-white outline-none focus:border-stadium-accent"
          />
        </label>
        <button
          onClick={join}
          className="w-full rounded border border-stadium-accent px-4 py-2 font-bold text-stadium-accent"
        >
          ルームに参加
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        ※ 起動前に <code className="rounded bg-black/50 px-1">npm run dev:server</code> で
        Socket.io サーバーを立てておいてください。
      </p>
    </main>
  );
}
