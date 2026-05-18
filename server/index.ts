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
  /**
   * バトル中の切断時に握る再接続猶予タイマー。
   * 猶予内に同じ name で room:join すれば slot を取り戻せる。
   */
  reconnectTimer?: NodeJS.Timeout;
}

interface Room {
  id: string;
  p1: Player | null;
  p2: Player | null;
  engine: BattleEngine | null;
  phase: "lobby" | "party-select" | "battle" | "ended";
}

/** バトル中の切断 → 再接続猶予 (ms)。これを過ぎたら完全離脱扱い。 */
const RECONNECT_GRACE_MS = 60_000;

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

    // 1) バトル中の再接続を最優先で扱う。
    //    engine 生存中 & 同じ name の slot があり、そこの socket がもう生きていなければ
    //    その slot を取り戻して battle:start を再送する。
    if (room.engine) {
      for (const cand of ["p1", "p2"] as const) {
        const player = room[cand];
        if (!player || player.name !== name) continue;
        const liveSock = io.sockets.sockets.get(player.socketId);
        if (liveSock && liveSock.connected && player.socketId !== socket.id) {
          // この slot は別の生きてる socket がまだ使ってる。横取りしない。
          continue;
        }
        // 再接続として slot を引き継ぐ
        player.socketId = socket.id;
        if (player.reconnectTimer) {
          clearTimeout(player.reconnectTimer);
          player.reconnectTimer = undefined;
        }
        socket.join(roomId);
        socket.emit("room:joined", {
          roomId,
          yourSlot: cand,
          players: { p1: room.p1?.name ?? null, p2: room.p2?.name ?? null },
        });
        broadcastRoomState(io, room);
        // 現在の盤面を渡してクライアント側 stuck state（commandSubmitted 等）をリセットさせる
        socket.emit("battle:start", { snapshot: room.engine.snapshot() });
        console.log(`[~] ${socket.id} reclaimed ${cand} (${name}) in room ${roomId}`);
        return;
      }
    }

    // 2) 通常新規参加
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
    if (!room || !room.engine) {
      console.warn(`[!] submit_command for ${roomId} but engine is gone (socket=${socket.id})`);
      return;
    }
    const slot = slotOf(room, socket.id);
    if (!slot) {
      console.warn(`[!] submit_command from unknown socket ${socket.id} in ${roomId}`);
      return;
    }

    // 同一ラウンドで再送信された場合は前のを上書き
    room[slot]!.pendingCommand = command;
    console.log(`[>] ${slot} (${socket.id}) submitted in ${roomId}: ${command.type}`);

    const cmdP1 = room.p1?.pendingCommand;
    const cmdP2 = room.p2?.pendingCommand;

    if (cmdP1 && cmdP2) {
      // 両方揃ったのでラウンドを解決。engine 例外で握り潰されないよう try/catch。
      let result;
      try {
        result = room.engine.resolveRound(cmdP1, cmdP2);
      } catch (err) {
        console.error(`[!] resolveRound failed for ${roomId}:`, err);
        // 両者にエラーを通知し、pendingCommand はクリアして再入力を促す
        room.p1!.pendingCommand = null;
        room.p2!.pendingCommand = null;
        io.to(roomId).emit("error:msg", {
          message: "バトル処理でエラーが発生しました。ページを再読み込みしてください。",
        });
        return;
      }
      room.p1!.pendingCommand = null;
      room.p2!.pendingCommand = null;
      io.to(roomId).emit("battle:round_resolved", result);
      if (result.snapshot.winner) room.phase = "ended";
    } else {
      // まだ相手が選んでない → 相手側に「決まったよ」通知
      const other: PlayerSlot = slot === "p1" ? "p2" : "p1";
      const otherSocketId = room[other]?.socketId;
      if (otherSocketId) io.to(otherSocketId).emit("battle:opponent_committed");
    }
  });

  socket.on("room:leave", ({ roomId }) => {
    leave(roomId, socket.id);
  });

  socket.on("disconnect", () => {
    console.log(`[-] ${socket.id} disconnected`);
    for (const room of rooms.values()) {
      const slot = slotOf(room, socket.id);
      if (!slot) continue;

      // バトル中の切断は engine を破棄しない。猶予期間内に
      // 同じ name で再接続したら room:join 側で slot を取り戻す。
      // 猶予を過ぎたら本当に離脱して engine を破棄する。
      if (room.engine && room.phase !== "ended") {
        console.log(
          `[~] ${socket.id} (${slot}) disconnected during battle; waiting up to ${RECONNECT_GRACE_MS}ms for reconnect`,
        );
        const player = room[slot]!;
        if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
        player.reconnectTimer = setTimeout(() => {
          // 猶予内に戻ってこなかった。完全離脱。
          // ただしこの間に再接続して別 socket が slot を握っていたら何もしない。
          const stillSamePlayer =
            room[slot] && room[slot]!.socketId === socket.id;
          if (stillSamePlayer) {
            console.log(`[x] ${socket.id} (${slot}) reconnect grace expired`);
            leave(room.id, socket.id);
          }
        }, RECONNECT_GRACE_MS);
        continue;
      }

      // バトル外（lobby / party-select / ended）はすぐ離脱
      leave(room.id, socket.id);
    }
  });

  function leave(roomId: string, socketId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const slot = slotOf(room, socketId);
    if (!slot) return;
    // 念のため reconnectTimer を片付け
    if (room[slot]?.reconnectTimer) {
      clearTimeout(room[slot]!.reconnectTimer);
    }
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
