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

  errorMessage: string | null;

  // mutations
  setRoom(roomId: string, slot: PlayerSlot, name: string): void;
  setRoomState(s: {
    phase: Phase;
    players: { p1: string | null; p2: string | null };
    parties: { p1: MonsterId[] | null; p2: MonsterId[] | null };
  }): void;
  setSnapshot(snap: BattleSnapshot): void;
  applyTurn(snap: BattleSnapshot, events: BattleEvent[]): void;
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
  errorMessage: null,

  setRoom(roomId, slot, name) {
    set({ roomId, yourSlot: slot, yourName: name });
  },
  setRoomState(s) {
    set({ phase: s.phase, players: s.players, parties: s.parties });
  },
  setSnapshot(snap) {
    set({ snapshot: snap, lastEvents: [] });
  },
  applyTurn(snap, events) {
    set({
      snapshot: snap,
      lastEvents: events,
      phase: snap.winner ? "ended" : "battle",
    });
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
      errorMessage: null,
    });
  },
}));

/** 送信ユーティリティ — Socket.io 直叩きをコンポーネントから隠す */
export type CommandSubmitter = (cmd: Command) => void;
