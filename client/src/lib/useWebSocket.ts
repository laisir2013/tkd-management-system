/**
 * useWebSocket — 全域 WebSocket 即時更新 hook
 * 
 * 連接伺服器 WebSocket，收到 mutation 完成事件後自動 invalidate 相關 tRPC query cache。
 * 支持自動重連、心跳保活、以及智能 invalidation mapping。
 */
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

// ── Router → Query key 映射表 ──────────────────────────────────────────
// 當某個 router 的 mutation 完成時，需要 invalidate 哪些 query key
// tRPC v11 的 queryKey 格式: [["routerName", "procedureName"], ...]
// invalidateQueries({ queryKey: [["payments"]] }) 會匹配所有 payments.* 的 query
const ROUTER_INVALIDATION_MAP: Record<string, string[][]> = {
  // 付款相關 mutation → 刷新付款、統計、會計
  payments: [["payments"], ["coachStats"], ["accounting"], ["users"], ["eliteStatistics"]],
  // 學生相關
  students: [["students"], ["payments"], ["users"], ["coachStats"], ["attendance"]],
  // 道場
  dojos: [["dojos"], ["students"], ["coachStats"]],
  // 教練
  coaches: [["coaches"], ["coachStats"], ["students"]],
  // 帶級
  beltLevels: [["beltLevels"], ["students"]],
  // 會計
  accounting: [["accounting"], ["coachStats"]],
  // 用戶管理
  users: [["users"], ["students"], ["coachStats"]],
  // 出席
  attendance: [["attendance"], ["students"]],
  // 精英班統計
  eliteStatistics: [["eliteStatistics"], ["coachStats"]],
  // 教練統計
  coachStats: [["coachStats"]],
  // WhatsApp 模板
  whatsappTemplates: [["whatsappTemplates"]],
  // 精英班
  elite: [["elite"], ["eliteStatistics"], ["coachStats"], ["payments"]],
  // 活動
  events: [["events"]],
  // 考試
  exam: [["exam"]],
  // 日記帳
  journal: [["accounting"], ["coachStats"]],
  // 收據審查
  receiptReview: [["receiptReview"], ["payments"], ["accounting"]],
  // 推播審核
  pushQueue: [["pushQueue"]],
  // 收款帳戶設定
  payeeConfig: [["payeeConfig"]],
  // 系統設定
  system: [["system"]],
};

// ── 連線狀態 ────────────────────────────────────────────────────────────
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

// 全域單例: 只允許一個 WebSocket 連線
let globalWs: WebSocket | null = null;
let globalStatus: ConnectionStatus = "disconnected";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30_000; // 最長 30 秒
const BASE_RECONNECT_DELAY = 1_000; // 起始 1 秒
const HEARTBEAT_INTERVAL = 25_000;  // 25 秒心跳

// 訂閱者列表（多個 component 可以同時用）
type MessageHandler = (data: any) => void;
const subscribers = new Set<MessageHandler>();

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function cleanup() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempts++;
  // Exponential backoff with jitter
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1) + Math.random() * 500,
    MAX_RECONNECT_DELAY
  );
  globalStatus = "reconnecting";
  console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGlobal();
  }, delay);
}

function connectGlobal() {
  if (globalWs && (globalWs.readyState === WebSocket.CONNECTING || globalWs.readyState === WebSocket.OPEN)) {
    return; // 已連線或連線中
  }

  cleanup();
  globalStatus = "connecting";

  try {
    const ws = new WebSocket(getWsUrl());
    globalWs = ws;

    ws.onopen = () => {
      globalStatus = "connected";
      reconnectAttempts = 0;
      console.log("[WS] Connected");

      // 啟動心跳
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 通知所有訂閱者
        for (const handler of subscribers) {
          try {
            handler(data);
          } catch (err) {
            console.error("[WS] Handler error:", err);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      globalStatus = "disconnected";
      globalWs = null;
      cleanup();
      // 非正常關閉 → 自動重連
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose 會接著觸發，重連邏輯在 onclose 處理
    };
  } catch {
    globalStatus = "disconnected";
    scheduleReconnect();
  }
}

function disconnectGlobal() {
  cleanup();
  reconnectAttempts = 0;
  if (globalWs) {
    globalWs.close(1000, "unmount");
    globalWs = null;
  }
  globalStatus = "disconnected";
}

// ── React Hook ──────────────────────────────────────────────────────────

/**
 * 在 App 最頂層使用一次即可。
 * 自動連接 WebSocket，收到 mutation event 後 invalidate 所有相關 query。
 */
export function useWebSocket() {
  const queryClient = useQueryClient();
  const handlerRef = useRef<MessageHandler | null>(null);

  const handleMessage = useCallback((data: any) => {
    if (data.type === "invalidate" && data.router) {
      const keysToInvalidate = ROUTER_INVALIDATION_MAP[data.router];
      if (keysToInvalidate) {
        for (const key of keysToInvalidate) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      } else {
        // 未知 router → invalidate 該 router 下所有 query
        queryClient.invalidateQueries({ queryKey: [[data.router]] });
      }
    }
  }, [queryClient]);

  useEffect(() => {
    // 註冊 handler
    handlerRef.current = handleMessage;
    subscribers.add(handleMessage);

    // 第一個訂閱者負責建立連線
    if (subscribers.size === 1) {
      connectGlobal();
    }

    return () => {
      subscribers.delete(handleMessage);
      // 最後一個訂閱者離開時斷開連線
      if (subscribers.size === 0) {
        disconnectGlobal();
      }
    };
  }, [handleMessage]);

  return { status: globalStatus };
}
