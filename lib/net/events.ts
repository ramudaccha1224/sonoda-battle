/**
 * クライアントとサーバーで共有する Socket.io イベント契約。
 * バックエンド (server/index.mjs) はこのファイルをそのまま読まないが、
 * 名前と payload は揃えること。
 */

import type {
  BattleSnapshot,
  Command,
  MonsterId,
  PlayerSlot,
  RoundResult,
} from "../battle/types";

export interface JoinRoomPayload {
  roomId: string;
  name: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  yourSlot: PlayerSlot;
  players: { p1: string | null; p2: string | null };
}

export interface ChoosePartyPayload {
  roomId: string;
  partyIds: [MonsterId, MonsterId];
}

export interface SubmitCommandPayload {
  roomId: string;
  command: Command;
}

/** ラウンド解決時のペイロード。両プレイヤーの行動を速度順に並べた actions を含む。 */
export type RoundResolvedPayload = RoundResult;

export interface RoomStatePayload {
  phase: "lobby" | "party-select" | "battle" | "ended";
  players: { p1: string | null; p2: string | null };
  parties: { p1: MonsterId[] | null; p2: MonsterId[] | null };
}

/**
 * クライアント → サーバー
 */
export interface ClientToServerEvents {
  "room:join": (p: JoinRoomPayload) => void;
  "room:choose_party": (p: ChoosePartyPayload) => void;
  "battle:submit_command": (p: SubmitCommandPayload) => void;
  "room:leave": (p: { roomId: string }) => void;
}

/**
 * サーバー → クライアント
 */
export interface ServerToClientEvents {
  "room:joined": (p: RoomJoinedPayload) => void;
  "room:state": (p: RoomStatePayload) => void;
  "battle:start": (p: { snapshot: BattleSnapshot }) => void;
  "battle:round_resolved": (p: RoundResolvedPayload) => void;
  /** 相手が先に技を決定した。受信側は「相手が決めた」表示だけ出す。操作はブロックしない。 */
  "battle:opponent_committed": () => void;
  "error:msg": (p: { message: string }) => void;
}
