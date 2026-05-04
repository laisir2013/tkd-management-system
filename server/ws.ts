/**
 * WebSocket 即時廣播系統
 * 
 * 當任何 tRPC mutation 完成後，自動廣播事件給所有連線的客戶端，
 * 客戶端收到事件後自動 invalidate 相關的 tRPC query cache。
 * 
 * 事件格式: { type: "invalidate", router: "payments", procedure: "confirm", timestamp: number }
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

// 心跳檢測 — 清除斷線的 ghost connections
const HEARTBEAT_INTERVAL = 30_000; // 30s
const PONG_TIMEOUT = 10_000; // 10s grace period
const aliveMap = new WeakMap<WebSocket, boolean>();

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    aliveMap.set(ws, true);

    // 發送連接確認
    ws.send(JSON.stringify({ type: "connected", clientCount: clients.size, timestamp: Date.now() }));

    ws.on("pong", () => {
      aliveMap.set(ws, true);
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // 客戶端可以發送 ping，伺服器回 pong（應用層心跳）
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      aliveMap.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
      aliveMap.delete(ws);
    });
  });

  // 定期心跳檢查
  const heartbeatTimer = setInterval(() => {
    for (const ws of clients) {
      if (aliveMap.get(ws) === false) {
        // 上次 ping 沒回 pong → 斷線
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      aliveMap.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  // 伺服器關閉時清理
  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  console.log("[WebSocket] Server ready on /ws");
}

/**
 * 廣播 tRPC mutation 完成事件
 * 
 * @param routerName - tRPC router 名稱 (e.g. "payments", "students", "accounting")
 * @param procedureName - mutation 名稱 (e.g. "confirm", "create", "update")
 * @param meta - 額外資訊 (optional)
 */
export function broadcastMutation(routerName: string, procedureName: string, meta?: Record<string, any>) {
  if (clients.size === 0) return;

  const event = JSON.stringify({
    type: "invalidate",
    router: routerName,
    procedure: procedureName,
    ...(meta ? { meta } : {}),
    timestamp: Date.now(),
  });

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(event);
      } catch {
        clients.delete(ws);
      }
    }
  }
}

/**
 * 廣播自定義事件（非 mutation 觸發的更新）
 */
export function broadcastCustomEvent(eventType: string, data?: Record<string, any>) {
  if (clients.size === 0) return;

  const event = JSON.stringify({
    type: eventType,
    ...(data || {}),
    timestamp: Date.now(),
  });

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(event);
      } catch {
        clients.delete(ws);
      }
    }
  }
}

export function getWebSocketClientCount(): number {
  return clients.size;
}
