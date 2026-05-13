/**
 * Socket.io シグナリング & バトルホスト。
 *
 * - クライアントが部屋に join
 * - 2人揃ったらパーティ選択フェーズ
 * - 両者がパーティを送ったらバトル開始
 * - 両者がコマンドを送ったらサーバー側 BattleEngine がターン解決して broadcast
 *
 * 起動: npm run dev:server
 *
 * （tsx watch が間接インポートを watch しないため、BattleEngine/types を更新したら
 *   このファイルにも何か変更を入れて再起動を強制すること）
 *
 * 2026-05-13: MonsterId に izumi を追加（mimura を置換）。
 * 2026-05-13: izumi を取り消し、mimura を復元。
 * 2026-05-13: 2D アイコン共通化（円形+模様）+ あべ/おぐりの色変更。
 * 2026-05-13: ターン制バトル（速い方先 → 以降交互）+ アクション 1 件ずつ実行。
 */
import { createServer } from "node:http";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../lib/net/events";
import type { Command, MonsterId, PlayerSlot } from "../lib/battle/types";
import { BattleEngine } from "../lib/battle/BattleEngine";

const PORT = Number(process.env.PORT ?? 3001);

interface Player {
  socketId: string;
  name: string;
  partyIds: [MonsterId, MonsterId] | null;
  pendingCommand: Command | null;
}

interface Room {
  id: string;
  p1: Player | null;
  p2: Player | null;
  engine: BattleEngine | null;
  phase: "lobby" | "party-select" | "battle" | "ended";
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    r = { id, p1: null, p2: null, engine: null, phase: "lobby" };
    rooms.set(id, r);
  }
  return r;
}

function slotOf(room: Room, socketId: string): PlayerSlot | null {
  if (room.p1?.socketId === socketId) return "p1";
  if (room.p2?.socketId === socketId) return "p2";
  return null;
}

function broadcastRoomState(io: Server<ClientToServerEvents, ServerToClientEvents>, room: Room) {
  io.to(room.id).emit("room:state", {
    phase: room.phase,
    players: {
      p1: room.p1?.name ?? null,
      p2: room.p2?.name ?? null,
    },
    parties: {
      p1: room.p1?.partyIds ?? null,
      p2: room.p2?.partyIds ?? null,
    },
  });
}

// Railway などの PaaS 用に簡易ヘルスチェックを生やす。
// `/` と `/health` で 200 を返す。socket.io の HTTP ハンドラより前に処理する。
const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  // socket.io 用パスはここを通さない（io.attach で hook されている）
  // それ以外の任意のパスは 404
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  // 本番 (Vercel) と開発 (localhost) の双方を許可。
  // 必要なら NEXT_PUBLIC 側の URL に絞り込むこと。
  cors: { origin: process.env.CORS_ORIGIN ?? "*" },
});

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id} connected`);

  socket.on("room:join", ({ roomId, name }) => {
    const room = getOrCreateRoom(roomId);
    const fresh: Player = { socketId: socket.id, name, partyIds: null, pendingCommand: null };

    let slot: PlayerSlot;
    if (!room.p1) {
      room.p1 = fresh;
      slot = "p1";
    } else if (!room.p2) {
      room.p2 = fresh;
      slot = "p2";
    } else {
      socket.emit("error:msg", { message: "ルームは満員です" });
      return;
    }

    socket.join(roomId);
    socket.emit("room:joined", {
      roomId,
      yourSlot: slot,
      players: { p1: room.p1?.name ?? null, p2: room.p2?.name ?? null },
    });

    if (room.p1 && room.p2 && room.phase === "lobby") {
      room.phase = "party-select";
    }
    broadcastRoomState(io, room);
  });

  socket.on("room:choose_party", ({ roomId, partyIds }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // パーティ選択フェーズでなければ無視（再接続後の古いデータで誤発火するのを防ぐ）
    if (room.phase !== "party-select") return;
    const slot = slotOf(room, socket.id);
    if (!slot) return;

    // 2人とも在室していなければ受け付けない
    if (!room.p1 || !room.p2) return;

    room[slot]!.partyIds = partyIds;

    // 両者揃ったらバトル開始
    if (room.p1.partyIds && room.p2.partyIds && !room.engine) {
      room.engine = new BattleEngine({
        p1: { name: room.p1.name, partyIds: room.p1.partyIds },
        p2: { name: room.p2.name, partyIds: room.p2.partyIds },
      });
      room.phase = "battle";
      broadcastRoomState(io, room);
      io.to(roomId).emit("battle:start", { snapshot: room.engine.snapshot() });
    } else {
      broadcastRoomState(io, room);
    }
  });

  socket.on("battle:submit_command", ({ roomId, command }) => {
    const room = rooms.get(roomId);
    if (!room || !room.engine) return;
    const slot = slotOf(room, socket.id);
    if (!slot) return;

    // 自分のターンでなければ受け付けない
    if (slot !== room.engine.turnOf) return;

    const result = room.engine.executeAction(slot, command);
    io.to(roomId).emit("battle:turn_resolved", result);
    if (result.snapshot.winner) room.phase = "ended";
  });

  socket.on("room:leave", ({ roomId }) => {
    leave(roomId, socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    for (const room of rooms.values()) {
      if (slotOf(room, socket.id)) leave(room.id, socket.id);
    }
  });

  function leave(roomId: string, socketId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const slot = slotOf(room, socketId);
    if (!slot) return;
    room[slot] = null;
    if (!room.p1 && !room.p2) {
      rooms.delete(roomId);
      return;
    }
    // 残ったプレイヤーがまだいる場合は、再マッチに備えて
    // partyIds と pendingCommand をクリアし lobby に戻す。
    // これをしないと、後から入ってきた相手が選んだ瞬間に
    // 古い partyIds でバトルが始まってしまう。
    const other = slot === "p1" ? "p2" : "p1";
    if (room[other]) {
      room[other]!.partyIds = null;
      room[other]!.pendingCommand = null;
    }
    room.engine = null;
    room.phase = "lobby";
    broadcastRoomState(io, room);
  }
});

// 全インターフェイス (0.0.0.0) で待ち受け。
// Railway / Render などの PaaS で外から接続できるようにするため。
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[socket] listening on port ${PORT}`);
});
