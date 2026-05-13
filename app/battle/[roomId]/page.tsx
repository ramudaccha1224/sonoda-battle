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
import {
  classifyMoveAnim,
  type ActionAnimType,
  type BattlePhase,
} from "@/lib/battle/animations";
import { getMove } from "@/lib/monsters/moves";

// 3Dシーンはクライアント専用 (SSR を切る)
const BattleScene = dynamic(
  () => import("@/components/canvas/BattleScene").then((m) => m.BattleScene),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-gray-400">3D シーンを準備中…</div> },
);

// アニメーションのタイミング (ms)
const APPROACH_MS = 1500; // 攻撃の構え / 接近 / 詠唱
const IMPACT_MS = 2000;   // ヒット / 効果発動（スローモーションで）
const REACTION_MS = 1500; // 被弾リアクション + 帰宅
const NON_MOVE_MS = 900;  // スイッチ等、技でないアクションの短い演出

export default function BattleRoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = params.roomId;
  const name = search.get("name") ?? "プレイヤー";

  const store = useBattleStore();

  // 演出用のローカル状態
  const [damagedSlot, setDamagedSlot] = useState<PlayerSlot | null>(null);
  const [attackerSlot, setAttackerSlot] = useState<PlayerSlot | null>(null);
  const [defenderSlot, setDefenderSlot] = useState<PlayerSlot | null>(null);
  const [animationType, setAnimationType] = useState<ActionAnimType | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("idle");
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
      // どの技が使われたか取得
      const moveEvent = events.find((e) => e.kind === "move");
      const moveId = moveEvent && moveEvent.kind === "move" ? moveEvent.moveId : null;
      const move = moveId ? getMove(moveId) : null;

      // ダメージが入る技か
      const damageHit = events.find(
        (e) => e.kind === "move" && !e.missed && e.damage > 0,
      );

      if (move && moveEvent && moveEvent.kind === "move") {
        const animType = classifyMoveAnim(move);
        const actor = moveEvent.actor;
        const target: PlayerSlot = actor === "p1" ? "p2" : "p1";

        setAnimating(true);
        setAttackerSlot(actor);
        setDefenderSlot(target);
        setAnimationType(animType);

        // === Phase 1: APPROACH (1500ms) ===
        setPhase("approach");

        // === Phase 2: IMPACT (2000ms) ===
        const tImpact = APPROACH_MS;
        const damageApplyAt =
          animType === "physical_attack"
            ? APPROACH_MS + 300       // 物理: 飛び込み直後（着弾）にHP変化
            : APPROACH_MS + IMPACT_MS * 0.6; // 魔法/変化: エフェクト到達のタイミング

        const t1 = setTimeout(() => {
          setPhase("impact");
        }, tImpact);

        const t2 = setTimeout(() => {
          // ダメージ系: 揺れ+＞＜ をトリガし、HPバーが減り始める
          if (damageHit) {
            setDamagedSlot(target);
          }
          store.applyTurn(snapshot, events);
        }, damageApplyAt);

        // === Phase 3: REACTION (1500ms) ===
        const tReaction = APPROACH_MS + IMPACT_MS;
        const t3 = setTimeout(() => {
          setPhase("reaction");
        }, tReaction);

        // === Phase 4: END ===
        const tEnd = APPROACH_MS + IMPACT_MS + REACTION_MS;
        const t4 = setTimeout(() => {
          setPhase("idle");
          setAttackerSlot(null);
          setDefenderSlot(null);
          setAnimationType(null);
          setDamagedSlot(null);
          setAnimating(false);
        }, tEnd);

        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
          clearTimeout(t4);
        };
      } else {
        // 技イベントなし（switch のみ等）: 短い演出
        setAnimating(true);
        store.applyTurn(snapshot, events);
        const t = setTimeout(() => setAnimating(false), NON_MOVE_MS);
        return () => clearTimeout(t);
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
              defenderSlot={defenderSlot}
              animationType={animationType}
              phase={phase}
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
  defenderSlot,
  animationType,
  phase,
  animating,
  onSubmit,
}: {
  damagedSlot: PlayerSlot | null;
  attackerSlot: PlayerSlot | null;
  defenderSlot: PlayerSlot | null;
  animationType: ActionAnimType | null;
  phase: BattlePhase;
  animating: boolean;
  onSubmit: (cmd: Command) => void;
}) {
  const { snapshot, yourSlot, phase: storePhase } = useBattleStore();
  if (!snapshot || !yourSlot) return null;
  const opponent: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";
  const isYourTurn = snapshot.currentTurnSlot === yourSlot;

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3">
      <PartyBar player={snapshot.players[opponent]} side="right" />

      <div className="relative overflow-hidden rounded-lg">
        <BattleScene
          snapshot={snapshot}
          yourSlot={yourSlot}
          damagedSlot={damagedSlot}
          attackerSlot={attackerSlot}
          defenderSlot={defenderSlot}
          animationType={animationType}
          phase={phase}
        />

        {storePhase === "battle" && !snapshot.winner && !animating && (
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr]">
        <PartyBar player={snapshot.players[yourSlot]} side="left" />

        {storePhase === "battle" && isYourTurn && (
          <CommandPanel
            snapshot={snapshot}
            yourSlot={yourSlot}
            disabled={animating}
            onSubmit={onSubmit}
          />
        )}
        {storePhase === "battle" && !isYourTurn && (
          <div className="grid place-items-center rounded-lg bg-black/70 p-4 text-center text-sm text-gray-300 backdrop-blur">
            相手のターンです…
          </div>
        )}
      </div>
    </div>
  );
}
