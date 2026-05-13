"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/net/socket";
import { useBattleStore } from "@/store/battleStore";
import { PartySelect } from "@/components/ui/PartySelect";
import { CommandPanel } from "@/components/ui/CommandPanel";
import { BattleLog } from "@/components/ui/BattleLog";
import { PartyBar } from "@/components/ui/PartyBar";
import type { Command, MonsterId, PlayerSlot } from "@/lib/battle/types";

// 3Dシーンはクライアント専用 (SSR を切る)
const BattleScene = dynamic(
  () => import("@/components/canvas/BattleScene").then((m) => m.BattleScene),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-gray-400">3D シーンを準備中…</div> },
);

// アニメーションのタイミング (ms)
const APPROACH_MS = 700;   // 攻撃側が前進する
const RETURN_MS = 600;     // 攻撃後に元の位置に戻る
const SHAKE_MS = 800;      // 被弾側の揺れ・＞＜表情
const NON_DAMAGE_MS = 700; // 変化技・スイッチなどダメージなし時の演出時間

export default function BattleRoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = params.roomId;
  const name = search.get("name") ?? "プレイヤー";

  const store = useBattleStore();

  // 演出用のローカル状態
  const [damagedSlot, setDamagedSlot] = useState<PlayerSlot | null>(null);
  const [attackerSlot, setAttackerSlot] = useState<PlayerSlot | null>(null);
  const [animating, setAnimating] = useState(false);

  // shareUrl はクライアントでしか作れないため、マウント後にセットしてハイドレーションを揃える
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(`${window.location.origin}/battle/${roomId}`);
  }, [roomId]);

  // 接続 & イベント購読
  useEffect(() => {
    const s = getSocket();
    s.on("connect", () => {
      s.emit("room:join", { roomId, name });
    });
    if (s.connected) s.emit("room:join", { roomId, name });

    s.on("room:joined", ({ yourSlot }) => {
      store.setRoom(roomId, yourSlot, name);
    });
    s.on("room:state", (st) => {
      store.setRoomState(st);
    });
    s.on("battle:start", ({ snapshot }) => {
      store.setSnapshot(snapshot);
    });

    s.on("battle:turn_resolved", ({ snapshot, events }) => {
      // 攻撃イベントを探す（最初の damage > 0 / missed=false な move）
      const damageHit = events.find(
        (e) => e.kind === "move" && !e.missed && e.damage > 0,
      );

      if (damageHit && damageHit.kind === "move") {
        // === 攻撃アニメーション ===
        const attacker = damageHit.actor;
        const victim: PlayerSlot = attacker === "p1" ? "p2" : "p1";

        setAnimating(true);
        setAttackerSlot(attacker);

        // T = APPROACH_MS: ヒット時にスナップショットを適用 → HP バーが減り始める
        const tHit = APPROACH_MS;
        setTimeout(() => {
          setDamagedSlot(victim);
          store.applyTurn(snapshot, events);
        }, tHit);

        // T = APPROACH_MS + RETURN_MS: 攻撃側がホームに戻る
        const tReturn = APPROACH_MS + RETURN_MS;
        setTimeout(() => {
          setAttackerSlot(null);
        }, tReturn);

        // T = APPROACH_MS + SHAKE_MS: 揺れ＆＞＜終了、入力解除
        const tEnd = APPROACH_MS + SHAKE_MS;
        setTimeout(() => {
          setDamagedSlot(null);
          setAnimating(false);
        }, tEnd);
      } else {
        // === ダメージ無し（変化技・スイッチ・外れ）: 短い演出 ===
        setAnimating(true);
        store.applyTurn(snapshot, events);
        setTimeout(() => setAnimating(false), NON_DAMAGE_MS);
      }
    });

    s.on("error:msg", ({ message }) => {
      store.setError(message);
    });

    return () => {
      s.emit("room:leave", { roomId });
      s.removeAllListeners();
      disconnectSocket();
      store.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, name]);

  function submitParty(party: [MonsterId, MonsterId]) {
    getSocket().emit("room:choose_party", { roomId, partyIds: party });
  }
  function submitCommand(cmd: Command) {
    if (animating) return;
    getSocket().emit("battle:submit_command", { roomId, command: cmd });
  }

  return (
    <main className="relative grid h-screen grid-rows-[auto_1fr_auto] bg-stadium-bg">
      <header className="flex items-center justify-between bg-black/40 px-4 py-2 text-sm">
        <div>
          <span className="text-gray-400">ルーム:</span>{" "}
          <span className="font-mono">{roomId}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
            title="共有URLをコピー"
          >
            URLコピー
          </button>
        </div>
        <div className="text-xs text-gray-400">
          {store.players.p1 ?? "（空き）"} vs {store.players.p2 ?? "（空き）"}
        </div>
      </header>

      <section className="relative">
        {store.errorMessage && (
          <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-sm">
            {store.errorMessage}
          </div>
        )}

        {store.phase === "lobby" && <LobbyView shareUrl={shareUrl} />}

        {store.phase === "party-select" && store.yourSlot && (
          <div className="mx-auto max-w-3xl px-4 py-6">
            <PartySelect
              onConfirm={submitParty}
              disabled={
                !!(store.yourSlot && store.parties[store.yourSlot]?.length)
              }
            />
          </div>
        )}

        {(store.phase === "battle" || store.phase === "ended") &&
          store.snapshot &&
          store.yourSlot && (
            <BattleView
              damagedSlot={damagedSlot}
              attackerSlot={attackerSlot}
              animating={animating}
              onSubmit={submitCommand}
            />
          )}
      </section>

      {store.snapshot && (
        <footer className="px-4 pb-3">
          <BattleLog log={store.snapshot.log} />
        </footer>
      )}
    </main>
  );
}

function LobbyView({ shareUrl }: { shareUrl: string }) {
  const store = useBattleStore();
  return (
    <div className="grid h-full place-items-center">
      <div className="space-y-3 rounded-lg bg-black/50 p-6 text-center">
        <div className="text-lg font-bold">対戦相手を待っています…</div>
        <div className="text-xs text-gray-400">
          このURLを相手に共有してください
        </div>
        <code className="block break-all rounded bg-stadium-bg p-2 text-xs">
          {shareUrl}
        </code>
        <div className="text-xs text-gray-500">
          現在の参加者: {store.players.p1 ?? "（空き）"} /{" "}
          {store.players.p2 ?? "（空き）"}
        </div>
      </div>
    </div>
  );
}

function BattleView({
  damagedSlot,
  attackerSlot,
  animating,
  onSubmit,
}: {
  damagedSlot: PlayerSlot | null;
  attackerSlot: PlayerSlot | null;
  animating: boolean;
  onSubmit: (cmd: Command) => void;
}) {
  const { snapshot, yourSlot, phase } = useBattleStore();
  if (!snapshot || !yourSlot) return null;
  const opponent: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";
  const isYourTurn = snapshot.currentTurnSlot === yourSlot;

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3">
      {/* 上: 相手パーティ情報 */}
      <PartyBar player={snapshot.players[opponent]} side="right" />

      {/* 中央: 3Dシーン + ターンインジケータ */}
      <div className="relative overflow-hidden rounded-lg">
        <BattleScene
          snapshot={snapshot}
          yourSlot={yourSlot}
          damagedSlot={damagedSlot}
          attackerSlot={attackerSlot}
        />

        {phase === "battle" && !snapshot.winner && !animating && (
          <div
            className={`absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-4 py-1 text-sm font-bold shadow-lg ${
              isYourTurn
                ? "bg-stadium-accent text-white"
                : "bg-black/70 text-gray-200"
            }`}
          >
            {isYourTurn ? "あなたのターン" : "相手のターン…"}
          </div>
        )}

        {snapshot.winner && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-3xl font-bold">
            {snapshot.winner === yourSlot ? "あなたの勝ち！" : "あなたの負け…"}
          </div>
        )}
      </div>

      {/* 下: 自分パーティ + コマンドパネル */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr]">
        <PartyBar player={snapshot.players[yourSlot]} side="left" />

        {phase === "battle" && isYourTurn && (
          <CommandPanel
            snapshot={snapshot}
            yourSlot={yourSlot}
            disabled={animating}
            onSubmit={onSubmit}
          />
        )}
        {phase === "battle" && !isYourTurn && (
          <div className="grid place-items-center rounded-lg bg-black/70 p-4 text-center text-sm text-gray-300 backdrop-blur">
            相手のターンです…
          </div>
        )}
      </div>
    </div>
  );
}
