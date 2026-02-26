import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface SSEEvent {
  type: "connected" | "score_update" | "candidate_update" | "stats_update" | "attendance_update";
  examId?: number;
  candidateId?: number;
  candidateName?: string;
  scores?: Array<{ scoringItemId: number; itemName: string; score: string }>;
  candidateStatus?: string;
  hasLakLakAward?: boolean;
  updatedBy?: string;
  status?: string;
  name?: string;
  stats?: any;
  action?: string;
  newStatus?: string;
  checkedInCount?: number;
  totalCount?: number;
  timestamp?: number;
  clientId?: string;
}

interface UseExamSSEOptions {
  examId: number;
  enabled?: boolean;
  onScoreUpdate?: (data: SSEEvent) => void;
  onCandidateUpdate?: (data: SSEEvent) => void;
  onStatsUpdate?: (data: SSEEvent) => void;
  onAttendanceUpdate?: (data: SSEEvent) => void;
  onConnected?: (clientId: string) => void;
  /** 自動使 tRPC query invalidate（預設 true） */
  autoInvalidate?: boolean;
}

/**
 * SSE Hook: 監聽考試即時更新事件
 * 
 * 當收到 SSE 事件時：
 * 1. 觸發相應 callback
 * 2. 自動 invalidate 相關 tRPC queries（可選）
 */
export function useExamSSE({
  examId,
  enabled = true,
  onScoreUpdate,
  onCandidateUpdate,
  onStatsUpdate,
  onAttendanceUpdate,
  onConnected,
  autoInvalidate = true,
}: UseExamSSEOptions) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // 存最新的 callback refs，避免每次 render 重新建連
  const callbacksRef = useRef({
    onScoreUpdate,
    onCandidateUpdate,
    onStatsUpdate,
    onAttendanceUpdate,
    onConnected,
  });
  callbacksRef.current = {
    onScoreUpdate,
    onCandidateUpdate,
    onStatsUpdate,
    onAttendanceUpdate,
    onConnected,
  };

  const invalidateExamQueries = useCallback(() => {
    if (!autoInvalidate) return;
    // Invalidate all exam-related queries for this examId
    queryClient.invalidateQueries({ queryKey: [["exam"]] });
  }, [queryClient, autoInvalidate]);

  const connect = useCallback(() => {
    if (!enabledRef.current || !examId) return;
    
    // 清除舊連接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `/api/exam/sse/${examId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        
        switch (data.type) {
          case "connected":
            reconnectAttemptsRef.current = 0;
            callbacksRef.current.onConnected?.(data.clientId || '');
            break;

          case "score_update":
            callbacksRef.current.onScoreUpdate?.(data);
            if (autoInvalidate) {
              // 精確 invalidate scores + candidates + statistics
              queryClient.invalidateQueries({ queryKey: [["exam", "scores"]] });
              queryClient.invalidateQueries({ queryKey: [["exam", "candidates"]] });
              queryClient.invalidateQueries({ queryKey: [["exam", "statistics"]] });
            }
            break;

          case "candidate_update":
            callbacksRef.current.onCandidateUpdate?.(data);
            if (autoInvalidate) {
              queryClient.invalidateQueries({ queryKey: [["exam", "candidates"]] });
              queryClient.invalidateQueries({ queryKey: [["exam", "statistics"]] });
            }
            break;

          case "stats_update":
            callbacksRef.current.onStatsUpdate?.(data);
            if (autoInvalidate) {
              queryClient.invalidateQueries({ queryKey: [["exam", "statistics"]] });
            }
            break;

          case "attendance_update":
            callbacksRef.current.onAttendanceUpdate?.(data);
            if (autoInvalidate) {
              queryClient.invalidateQueries({ queryKey: [["exam", "candidates"]] });
              queryClient.invalidateQueries({ queryKey: [["exam", "statistics"]] });
            }
            break;
        }
      } catch (err) {
        console.warn("[SSE] Failed to parse event:", err);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      
      if (!enabledRef.current) return;
      
      // 指數退避重連
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.warn("[SSE] Max reconnect attempts reached, falling back to polling");
      }
    };
  }, [examId, autoInvalidate, queryClient]);

  useEffect(() => {
    if (enabled && examId) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [examId, enabled, connect]);

  return {
    isConnected: !!eventSourceRef.current,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
}
