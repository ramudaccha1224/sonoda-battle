"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/net/socket";
import { useBattleStore } from "@/store/battleStore";
import { PartySelect } from "@/components/ui/PartySelect";
import { CommandPanel } from "@/components/ui/CommandPanel";
import { BattleLog } from "@/components/ui/BattleLog";
import { PartyBar } from "@/components/ui/PartyBar";
import type {
  ActionResult,
  Command,
  MonsterId,
  PlayerSlot,
} from "@/lib/battle/types";
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

  // ラウンド進行用の ref 群
  const pendingActionsRef = useRef<ActionResult[]>([]);
  const prevSnapshotForActionRef = useRef<ReturnType<typeof useBattleStore.getState>["snapshot"]>(null);
  const roundFinalSnapshotRef = useRef<ReturnType<typeof useBattleStore.getState>["snapshot"]>(null);
  const playNextActionRef = useRef<(() => void) | null>(null);

  // 直近に自分が送信したコマンド。再接続時の自動再送に使う。
  const lastSubmittedCommandRef = useRef<Command | null>(null);

  // ============================================================
  // playOneAction / playNextAction
  // ============================================================
  // 1 アクション分のアニメーションを再生する。完了したら onComplete を呼ぶ。
  function playOneAction(action: ActionResult, onComplete: () => void) {
    const moveEvent = action.events.find((e) => e.kind === "move");
    const damageHit = action.events.find(
      (e) => e.kind === "move" && !e.missed && e.damage > 0,
    );
    const faintEvent = action.events.find(
      (e) => e.kind === "faint",
    );

    // 移動 (move) 以外のアクション (switch 等) は短い演出だけして次へ
    if (!moveEvent || moveEvent.kind !== "move") {
      store.applySnapshotPartial(action.snapshotAfter, action.events);
      const t = setTimeout(onComplete, NON_MOVE_MS);
      return () => clearTimeout(t);
    }

    const moveId = moveEvent.moveId;
    const move = getMove(moveId);
    const animType = classifyMoveAnim(move);
    const actor = action.actor;
    const target: PlayerSlot = actor === "p1" ? "p2" : "p1";

    // 倒れる予定のモンスター: このアクション直前のスナップショットの活性 index
    const prevSnap = prevSnapshotForActionRef.current;
    const prevDefenderActiveIdx = prevSnap?.players[target]?.activeIndex ?? null;
    const willFaint =
      !!faintEvent &&
      faintEvent.kind === "faint" &&
      faintEvent.actor === target &&
      prevDefenderActiveIdx != null;
    const faintingPartyIdx = willFaint ? prevDefenderActiveIdx! : null;

    setAttackerSlot(actor);
    setDefenderSlot(target);
    setAnimationType(animType);
    setMoveAnimProfile(getMoveAnimProfile(moveId));
    setPhase("approach");

    // ダメージ反映タイミング
    const damageApplyAt = damageHit
      ? animType === "physical_attack"
        ? APPROACH_MS + 300
        : APPROACH_MS + IMPACT_MS * 0.6
      : APPROACH_MS + IMPACT_MS / 2;

    // ダメージなし技は reaction を短くして演出感を保つ
    const reactionMs = damageHit ? REACTION_MS : 1000;

    const tids: ReturnType<typeof setTimeout>[] = [];

    tids.push(setTimeout(() => setPhase("impact"), APPROACH_MS));

    tids.push(
      setTimeout(() => {
        if (damageHit) setDamagedSlot(target);
        if (faintingPartyIdx != null) {
          setFaintingInfo({
            slot: target,
            partyIndex: faintingPartyIdx,
            stage: "reaction",
          });
        }
        // このアクション直後の状態を反映 (HP が減り始める)
        store.applySnapshotPartial(action.snapshotAfter, action.events);
        setPhase("reaction");
      }, damageApplyAt),
    );

    const tReactionEnd = damageApplyAt + reactionMs;
    tids.push(
      setTimeout(() => {
        setDamagedSlot(null);
        if (faintingPartyIdx != null) {
          setFaintingInfo({
            slot: target,
            partyIndex: faintingPartyIdx,
            stage: "fading",
          });
          setPhase("faint");
        }
      }, tReactionEnd),
    );

    const tEnd =
      faintingPartyIdx != null ? tReactionEnd + FAINT_MS : tReactionEnd;
    tids.push(
      setTimeout(() => {
        setPhase("idle");
        setAttackerSlot(null);
        setDefenderSlot(null);
        setAnimationType(null);
        setMoveAnimProfile(null);
        setDamagedSlot(null);
        setFaintingInfo(null);
        // 次のアクションの prev は、このアクションが終わった時点のスナップショット
        prevSnapshotForActionRef.current = action.snapshotAfter;
        onComplete();
      }, tEnd),
    );

    return () => {
      tids.forEach(clearTimeout);
    };
  }

  // playNextActionRef.current にセット (キューから 1 件取り出して再生)
  useEffect(() => {
    playNextActionRef.current = () => {
      const queue = pendingActionsRef.current;
      const next = queue.shift();
      if (!next) {
        // ラウンド終了
        const fs = roundFinalSnapshotRef.current;
        if (fs) {
          store.endRound(fs, []);
        }
        setAnimating(false);
        return;
      }
      playOneAction(next, () => playNextActionRef.current?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 接続 & イベント購読
  useEffect(() => {
    const s = getSocket();
    s.on("connect", () => {
      console.log("[client] socket connect", s.id);
      s.emit("room:join", { roomId, name });
      // 接続/再接続直後にもし「送信したつもり」のままなら、自動で再送して
      // サーバ側の pendingCommand と整合させる。サーバは同じ slot の pending を
      // 上書きするだけなので二重実行にはならない（冪等）。
      const st = useBattleStore.getState();
      if (st.commandSubmitted && lastSubmittedCommandRef.current) {
        console.log("[client] auto-resend submit_command on (re)connect");
        s.emit("battle:submit_command", {
          roomId,
          command: lastSubmittedCommandRef.current,
        });
      }
    });
    s.on("disconnect", (reason) => {
      console.warn("[client] socket disconnect", reason);
    });
    s.on("connect_error", (err) => {
      console.error("[client] socket connect_error", err);
    });
    if (s.connected) s.emit("room:join", { roomId, name });

    s.on("room:joined", ({ yourSlot }) => {
      store.setRoom(roomId, yourSlot, name);
    });
    s.on("room:state", (st) => {
      store.setRoomState(st);
    });
    s.on("battle:start", ({ snapshot }) => {
      // 通常のバトル開始だけでなく、サーバ側からの再接続復帰時にも飛んでくる。
      // 中途半端な animation 状態が残らないよう、進行中だった演出は全部リセットする。
      pendingActionsRef.current = [];
      roundFinalSnapshotRef.current = null;
      prevSnapshotForActionRef.current = null;
      setAnimating(false);
      setDamagedSlot(null);
      setAttackerSlot(null);
      setDefenderSlot(null);
      setAnimationType(null);
      setMoveAnimProfile(null);
      setPhase("idle");
      setFaintingInfo(null);
      store.setSnapshot(snapshot);
    });

    s.on("battle:opponent_committed", () => {
      console.log("[client] opponent_committed");
      useBattleStore.getState().setOpponentCommitted(true);
    });

    s.on("battle:round_resolved", (payload) => {
      console.log("[client] round_resolved received", {
        actionCount: payload?.actions?.length,
        winner: payload?.snapshot?.winner,
      });
      try {
        const { actions, snapshot: finalSnapshot } = payload;
        const initialSnapshot = useBattleStore.getState().snapshot;
        pendingActionsRef.current = [...actions];
        prevSnapshotForActionRef.current = initialSnapshot ?? finalSnapshot;
        roundFinalSnapshotRef.current = finalSnapshot;
        setAnimating(true);
        // 最初のアクションから順番に再生
        if (playNextActionRef.current) {
          playNextActionRef.current();
        } else {
          console.error("[client] playNextActionRef not initialized — fallback to direct endRound");
          useBattleStore.getState().endRound(finalSnapshot, []);
          setAnimating(false);
        }
      } catch (err) {
        console.error("[client] round_resolved handler threw", err);
        // 落とすよりは復旧して次の入力を受け付けるほうがマシ
        const fs = payload?.snapshot;
        if (fs) useBattleStore.getState().endRound(fs, []);
        setAnimating(false);
      }
    });

    s.on("error:msg", ({ message }) => {
      console.error("[client] error:msg from server:", message);
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
    if (store.commandSubmitted) return;
    console.log("[client] emit submit_command", cmd);
    store.setCommandSubmitted(true);
    lastSubmittedCommandRef.current = cmd;
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
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {store.snapshot && (
            <span
              className={
                store.snapshot.timeOfDay === "night"
                  ? "rounded-full bg-indigo-900/70 px-2 py-0.5 text-indigo-100"
                  : "rounded-full bg-amber-200/30 px-2 py-0.5 text-amber-100"
              }
              title="戦闘中の時間帯"
            >
              {store.snapshot.timeOfDay === "night" ? "🌙 夜" : "☀️ 昼"}
            </span>
          )}
          <span>{store.players.p1 ?? "（空き）"} vs {store.players.p2 ?? "（空き）"}</span>
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
  const {
    snapshot,
    yourSlot,
    phase: storePhase,
    commandSubmitted,
    opponentCommitted,
  } = useBattleStore();
  if (!snapshot || !yourSlot) return null;
  const opponent: PlayerSlot = yourSlot === "p1" ? "p2" : "p1";

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
          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs text-gray-200 shadow-lg">
            {/* 同時送信のラウンド制。先攻/後攻は両者送信後に速度で決まるので、
                送信前に「あなたの番」のような turn-base 風表現は出さない。 */}
            {commandSubmitted
              ? "相手の入力を待っています…"
              : opponentCommitted
                ? "相手は技を決めました（あなたの入力を待っています）"
                : "技を選んでください"}
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

        {storePhase === "battle" && (
          <CommandPanel
            snapshot={snapshot}
            yourSlot={yourSlot}
            disabled={animating || commandSubmitted}
            opponentCommitted={opponentCommitted && !commandSubmitted}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </div>
  );
}
