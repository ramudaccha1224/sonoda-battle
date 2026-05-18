"use client";

import { create } from "zustand";
import type {
  BattleEvent,
  BattleSnapshot,
  Command,
  MonsterId,
  PlayerSlot,
} from "@/lib/battle/types";

export type Phase = "lobby" | "party-select" | "battle" | "ended";

interface BattleStore {
  // ルーム情報
  roomId: string | null;
  yourSlot: PlayerSlot | null;
  yourName: string;
  phase: Phase;
  players: { p1: string | null; p2: string | null };
  parties: { p1: MonsterId[] | null; p2: MonsterId[] | null };

  // バトル状態
  snapshot: BattleSnapshot | null;
  lastEvents: BattleEvent[];

  // ラウンド制 UI 用
  /** 自分はこのラウンドの技を送信済みか。送信後は CommandPanel を disable して「相手を待つ」表示。 */
  commandSubmitted: boolean;
  /** 相手が技を決めたか。自分の操作はブロックしないが、ヒント表示する。 */
  opponentCommitted: boolean;

  errorMessage: string | null;

  // mutations
  setRoom(roomId: string, slot: PlayerSlot, name: string): void;
  setRoomState(s: {
    phase: Phase;
    players: { p1: string | null; p2: string | null };
    parties: { p1: MonsterId[] | null; p2: MonsterId[] | null };
  }): void;
  setSnapshot(snap: BattleSnapshot): void;
  applySnapshotPartial(snap: BattleSnapshot, events: BattleEvent[]): void;
  endRound(snap: BattleSnapshot, events: BattleEvent[]): void;
  setCommandSubmitted(v: boolean): void;
  setOpponentCommitted(v: boolean): void;
  setError(msg: string | null): void;
  reset(): void;
}

export const useBattleStore = create<BattleStore>((set) => ({
  roomId: null,
  yourSlot: null,
  yourName: "",
  phase: "lobby",
  players: { p1: null, p2: null },
  parties: { p1: null, p2: null },
  snapshot: null,
  lastEvents: [],
  commandSubmitted: false,
  opponentCommitted: false,
  errorMessage: null,

  setRoom(roomId, slot, name) {
    set({ roomId, yourSlot: slot, yourName: name });
  },
  setRoomState(s) {
    set({ phase: s.phase, players: s.players, parties: s.parties });
  },
  setSnapshot(snap) {
    set({ snapshot: snap, lastEvents: [], commandSubmitted: false, opponentCommitted: false });
  },
  /** 1 アクション分のスナップショットを反映する（途中段階） */
  applySnapshotPartial(snap, events) {
    set({
      snapshot: snap,
      lastEvents: events,
      phase: snap.winner ? "ended" : "battle",
    });
  },
  /** 1 ラウンド全体終了時の処理 — フラグをリセットして次の入力を受け付ける */
  endRound(snap, events) {
    set({
      snapshot: snap,
      lastEvents: events,
      phase: snap.winner ? "ended" : "battle",
      commandSubmitted: false,
      opponentCommitted: false,
    });
  },
  setCommandSubmitted(v) {
    set({ commandSubmitted: v });
  },
  setOpponentCommitted(v) {
    set({ opponentCommitted: v });
  },
  setError(msg) {
    set({ errorMessage: msg });
  },
  reset() {
    set({
      roomId: null,
      yourSlot: null,
      yourName: "",
      phase: "lobby",
      players: { p1: null, p2: null },
      parties: { p1: null, p2: null },
      snapshot: null,
      lastEvents: [],
      commandSubmitted: false,
      opponentCommitted: false,
      errorMessage: null,
    });
  },
}));

/** 送信ユーティリティ — Socket.io 直叩きをコンポーネントから隠す */
export type CommandSubmitter = (cmd: Command) => void;
