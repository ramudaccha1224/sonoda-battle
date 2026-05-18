/**
 * Railway 上のサーバに 2 つのソケットで繋いで、両者の技送信 → round_resolved が
 * 返ってくるかを確かめる。
 *
 *   npx tsx scripts/test-round-via-socket.ts [URL]
 *
 * URL を省略すると https://sonoda-battle-production.up.railway.app に繋ぐ。
 */
import { io, type Socket } from "socket.io-client";

const URL = process.argv[2] ?? "https://sonoda-battle-production.up.railway.app";
const ROOM = "test-" + Math.random().toString(36).slice(2, 8);

console.log("Connecting to:", URL, "room:", ROOM);

const a = io(URL, { transports: ["websocket", "polling"] });
const b = io(URL, { transports: ["websocket", "polling"] });

function logger(tag: string, sock: Socket) {
  sock.on("connect", () => console.log(`[${tag}] connect`, sock.id));
  sock.on("disconnect", (r) => console.log(`[${tag}] disconnect`, r));
  sock.on("connect_error", (e) => console.error(`[${tag}] connect_error`, e.message));
  sock.on("room:joined", (p) => console.log(`[${tag}] room:joined`, p));
  sock.on("room:state", (p) => console.log(`[${tag}] room:state`, p.phase, p.players));
  sock.on("battle:start", (p) => console.log(`[${tag}] battle:start; turn=${p.snapshot.turn}`));
  sock.on("battle:opponent_committed", () => console.log(`[${tag}] opponent_committed`));
  sock.on("battle:round_resolved", (r: any) =>
    console.log(`[${tag}] round_resolved actions=${r?.actions?.length} winner=${r?.snapshot?.winner}`),
  );
  sock.on("error:msg", (p) => console.error(`[${tag}] error:msg`, p));
}
logger("A", a);
logger("B", b);

a.on("battle:start", () => {
  setTimeout(() => {
    console.log("[A] emit submit_command zenryoku_nekopunch");
    a.emit("battle:submit_command", { roomId: ROOM, command: { type: "move", moveId: "zenryoku_nekopunch" } });
  }, 200);
});
b.on("battle:start", () => {
  setTimeout(() => {
    console.log("[B] emit submit_command gabugabu_kamitsuki");
    b.emit("battle:submit_command", { roomId: ROOM, command: { type: "move", moveId: "gabugabu_kamitsuki" } });
  }, 400);
});

a.on("connect", () => {
  a.emit("room:join", { roomId: ROOM, name: "Alice" });
  setTimeout(() => {
    console.log("[A] emit choose_party");
    a.emit("room:choose_party", { roomId: ROOM, partyIds: ["sonoda", "mimura"] });
  }, 500);
});
b.on("connect", () => {
  b.emit("room:join", { roomId: ROOM, name: "Bob" });
  setTimeout(() => {
    console.log("[B] emit choose_party");
    b.emit("room:choose_party", { roomId: ROOM, partyIds: ["mimura", "sonoda"] });
  }, 700);
});

setTimeout(() => {
  console.log("=== timeout, exiting ===");
  a.disconnect();
  b.disconnect();
  process.exit(0);
}, 15_000);
