import { useEffect, useRef, useCallback } from "react";

interface SSEEvent {
  type: "connected" | "score_update" | "candidate_update" | "stats_update";
  examId: number;
  candidateId?: number;
  candidateStatus?: string;
  hasLakLakAward?: boolean;
  name?: string;
  scores?: Array<{ scoringItemId: number; itemName: string; score: string }>;
  stats?: any;
  updatedBy?: string;
  timestamp: number;
}

export function useExamSSE(
  examId: number | null,
  onScoreUpdate?: (data: SSEEvent) => void,
  onCandidateUpdate?: (data: SSEEvent) => void,
  onStatsUpdate?: (data: SSEEvent) => void,
) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (!examId) return;
    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`/api/exam/sse/${examId}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        switch (data.type) {
          case "score_update":
            onScoreUpdate?.(data);
            break;
          case "candidate_update":
            onCandidateUpdate?.(data);
            break;
          case "stats_update":
            onStatsUpdate?.(data);
            break;
          case "connected":
            console.log("[SSE] Connected:", data);
            break;
        }
      } catch (e) {
        console.warn("[SSE] Parse error:", e);
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000);
    };
  }, [examId, onScoreUpdate, onCandidateUpdate, onStatsUpdate]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return esRef;
}
