"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  type MoveAnimProfile,
} from "@/lib/battle/animations";
import { getMove } from "@/lib/monsters/moves";
import { getMoveAnimProfile } from "@/lib/battle/moveAnimProfiles";

// 3Dシーンはクライアント専用 (SSR を切る)
const BattleScene = dynamic(
  () => import("@/components/canvas/BattleScene").then((m) => m.BattleScene),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-gray-400">3D シーンを準備中…</div> },
);

// アニメーションのタイミング (ms)
const APPROACH_MS = 1500; // 攻撃の構え / 接近 / 詠唱
const IMPACT_MS = 2000;   // ヒット / 効果発動（スローモーションで）
const REACTION_MS = 3000; // 被弾側を映してダメージゲージが減る時間
const FAINT_MS = 1500;    // ひんし時の倒れ＋フェードアウト時間
const NON_MOVE_MS = 900;  // スイッチ等、技でないアクションの短い演出

export default function BattleRoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  // URL から取り出した roomId はそのまま「合言葉」として表示する。
  const roomId = decodeURIComponent(params.roomId);
  const name = search.get("name") ?? "プレイヤー";

  const store = useBattleStore();

  // 演出用のローカル状態
  const [damagedSlot, setDamagedSlot] = useState<PlayerSlot | null>(null);
  const [attackerSlot, setAttackerSlot] = useState<PlayerSlot | null>(null);
  const [defenderSlot, setDefenderSlot] = useState<PlayerSlot | null>(null);
  const [animationType, setAnimationType] = useState<ActionAnimType | null>(null);
  const [moveAnimProfile, setMoveAnimProfile] = useState<MoveAnimProfile | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [animating, setAnimating] = useState(false);
  // ひんし演出のオーバーライド (倒れていく方を見せ続けるため)
  const [faintingInfo, setFaintingInfo] = useState<{
    slot: PlayerSlot;
    partyIndex: number;
    stage: "reaction" | "fading";
  } | null>(null);

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
      // ひんしが起きたか（被弾側）
      const faintEvent = events.find((e) => e.kind === "faint");

      if (move && moveEvent && moveEvent.kind === "move") {
        const animType = classifyMoveAnim(move);
        const actor = moveEvent.actor;
        const target: PlayerSlot = actor === "p1" ? "p2" : "p1";

        // 倒れる予定のモンスターの party index を取り出す。
        // 直前 (このターン前) の被弾側 activeIndex がそのまま倒れた個体。
        const prevSnap = useBattleStore.getState().snapshot;
        const prevDefenderActiveIdx = prevSnap?.players[target]?.activeIndex ?? null;
        const willFaint =
          !!faintEvent &&
          faintEvent.kind === "faint" &&
          faintEvent.actor === target &&
          prevDefenderActiveIdx != null;
        const faintingPartyIdx = willFaint ? prevDefenderActiveIdx! : null;

        setAnimating(true);
        setAttackerSlot(actor);
        setDefenderSlot(target);
        setAnimationType(animType);
        setMoveAnimProfile(getMoveAnimProfile(moveId!));

        // === Phase 1: APPROACH ===
        setPhase("approach");

        // ダメージ反映タイミング
        const damageApplyAt = damageHit
          ? animType === "physical_attack"
            ? APPROACH_MS + 300
            : APPROACH_MS + IMPACT_MS * 0.6
          : APPROACH_MS + IMPACT_MS / 2;

        const tids: ReturnType<typeof setTimeout>[] = [];

        // → impact phase
        tids.push(
          setTimeout(() => setPhase("impact"), APPROACH_MS),
        );

        // ヒット時: ダメージ適用 + reaction phase 開始
        tids.push(
          setTimeout(() => {
            if (damageHit) setDamagedSlot(target);
            // ひんし予定なら、倒れていく方を引き続き描画するための override をセット。
            if (faintingPartyIdx != null) {
              setFaintingInfo({
                slot: target,
                partyIndex: faintingPartyIdx,
                stage: "reaction",
              });
            }
            store.applyTurn(snapshot, events);
            setPhase("reaction");
          }, damageApplyAt),
        );

        // reaction 終了
        const tReactionEnd = damageApplyAt + REACTION_MS;
        tids.push(
          setTimeout(() => {
            // ＞＜ 揺れ表示は終了。
            setDamagedSlot(null);
            if (faintingPartyIdx != null) {
              // → faint phase: 倒れる + フェード
              setFaintingInfo({
                slot: target,
                partyIndex: faintingPartyIdx,
                stage: "fading",
              });
              setPhase("faint");
            }
          }, tReactionEnd),
        );

        // 全終了
        const tEnd = faintingPartyIdx != null ? tReactionEnd + FAINT_MS : tReactionEnd;
        tids.push(
          setTimeout(() => {
            setPhase("idle");
            setAttackerSlot(null);
            setDefenderSlot(null);
            setAnimationType(null);
            setMoveAnimProfile(null);
            setDamagedSlot(null);
            setFaintingInfo(null);
            setAnimating(false);
          }, tEnd),
        );

        return () => {
          tids.forEach(clearTimeout);
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
        <div className="min-w-0">
          <span className="text-gray-400">合言葉:</span>{" "}
          <span className="font-mono">{roomId}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(roomId)}
            className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20"
            title="合言葉をコピー"
          >
            合言葉コピー
          </button>
        </div>
        <div className="text-xs text-gray-400">
          {store.players.p1 ?? "（空き）"} vs {store.players.p2 ?? "（空き）"}
        </div>
      </header>

      <section className="relative">
        {/* 致命的エラー (ルーム満員など) は中央にモーダル */}
        {store.errorMessage && <ErrorModal message={store.errorMessage} />}

        {store.phase === "lobby" && !store.errorMessage && (
          <LobbyView roomId={roomId} />
        )}

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
              moveAnimProfile={moveAnimProfile}
              phase={phase}
              animating={animating}
              faintingInfo={faintingInfo}
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

function LobbyView({ roomId }: { roomId: string }) {
  const store = useBattleStore();
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="space-y-4 rounded-lg bg-black/50 p-6 text-center max-w-md">
        <div className="text-lg font-bold">対戦相手を待っています…</div>
        <div>
          <div className="text-xs text-gray-400 mb-1">
            この合言葉を相手に伝えてください
          </div>
          <code className="block break-all rounded bg-stadium-bg p-3 text-base font-bold tracking-wider text-stadium-accent">
            {roomId}
          </code>
        </div>
        <div className="text-xs text-gray-500">
          現在の参加者: {store.players.p1 ?? "（空き）"} /{" "}
          {store.players.p2 ?? "（空き）"}
        </div>
      </div>
    </div>
  );
}

function ErrorModal({ message }: { message: string }) {
  const router = useRouter();
  // ルーム満員などのエラーはホームに戻す
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="space-y-4 rounded-lg bg-black/80 p-6 text-center max-w-md ring-1 ring-red-500/60">
        <div className="text-2xl">😿</div>
        <div className="text-base font-bold text-red-300">{message}</div>
        <button
          onClick={() => router.push("/")}
          className="rounded bg-stadium-accent px-4 py-2 text-sm font-bold text-white"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}

function BattleView({
  damagedSlot,
  attackerSlot,
  defenderSlot,
  animationType,
  moveAnimProfile,
  phase,
  animating,
  faintingInfo,
  onSubmit,
}: {
  damagedSlot: PlayerSlot | null;
  attackerSlot: PlayerSlot | null;
  defenderSlot: PlayerSlot | null;
  animationType: ActionAnimType | null;
  moveAnimProfile: MoveAnimProfile | null;
  phase: BattlePhase;
  animating: boolean;
  faintingInfo:
    | { slot: PlayerSlot; partyIndex: number; stage: "reaction" | "fading" }
    | null;
  onSubmit: (cmd: Command) => void;
}) {
  const { snapshot, yourSlot, phase: storePhase } = useBattleStore();
  if (!snapshot || !yourSlot) return null;
  const opponent: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";
  const isYourTurn = snapshot.currentTurnSlot === yourSlot;

  // 倒れていく方を「現役」として PartyBar にも反映させるための実効スナップショット。
  // これで HP ゲージや active ハイライトが、3 秒 reaction の間ずっと
  // 倒れる方を指したまま動かない。
  const effectiveSnapshot = useMemo(() => {
    if (!faintingInfo) return snapshot;
    return {
      ...snapshot,
      players: {
        ...snapshot.players,
        [faintingInfo.slot]: {
          ...snapshot.players[faintingInfo.slot],
          activeIndex: faintingInfo.partyIndex,
        },
      },
    };
  }, [snapshot, faintingInfo]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3">
      <PartyBar player={effectiveSnapshot.players[opponent]} side="right" />

      <div className="relative overflow-hidden rounded-lg">
        <BattleScene
          snapshot={snapshot}
          yourSlot={yourSlot}
          damagedSlot={damagedSlot}
          attackerSlot={attackerSlot}
          defenderSlot={defenderSlot}
          animationType={animationType}
          moveAnimProfile={moveAnimProfile}
          phase={phase}
          faintingInfo={faintingInfo}
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
        <PartyBar player={effectiveSnapshot.players[yourSlot]} side="left" />

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
