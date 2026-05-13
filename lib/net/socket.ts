"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (socket) return socket;
  const url =
    process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
  socket = io(url, {
    // ["polling", "websocket"] (デフォルト) に戻す。
    // モバイル回線・社内プロキシで websocket が貼れないとき
    // polling で繋ぎ直してアップグレードを試みる。
    autoConnect: true,
    // 再接続ポリシーを少しだけ親切に
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
