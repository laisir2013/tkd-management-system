import type { Response } from "express";

interface SSEClient {
  id: string;
  res: Response;
  examId: number;
}

const clients: Map<string, SSEClient> = new Map();
let clientIdCounter = 0;

export function addSSEClient(res: Response, examId: number): string {
  const clientId = `sse-${++clientIdCounter}-${Date.now()}`;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);
  clients.set(clientId, { id: clientId, res, examId });
  res.on("close", () => { clients.delete(clientId); });
  const heartbeat = setInterval(() => {
    if (clients.has(clientId)) {
      try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); clients.delete(clientId); }
    } else { clearInterval(heartbeat); }
  }, 15000); // 15s heartbeat
  return clientId;
}

function broadcastToExam(examId: number, event: string) {
  for (const client of Array.from(clients.values())) {
    if (client.examId === examId) {
      try { client.res.write(`data: ${event}\n\n`); } catch { clients.delete(client.id); }
    }
  }
}

export function broadcastScoreUpdate(examId: number, data: {
  candidateId: number;
  scores?: Array<{ scoringItemId: number; itemName: string; score: string }>;
  candidateStatus?: string;
  hasLakLakAward?: boolean;
  updatedBy?: string;
}) {
  const event = JSON.stringify({ type: "score_update", examId, ...data, timestamp: Date.now() });
  broadcastToExam(examId, event);
}

export function broadcastCandidateUpdate(examId: number, data: {
  candidateId: number;
  status: string;
  hasLakLakAward?: boolean;
  name?: string;
}) {
  const event = JSON.stringify({ type: "candidate_update", examId, ...data, timestamp: Date.now() });
  broadcastToExam(examId, event);
}

export function broadcastStatsUpdate(examId: number, stats: any) {
  const event = JSON.stringify({ type: "stats_update", examId, stats, timestamp: Date.now() });
  broadcastToExam(examId, event);
}

// 點名更新廣播
export function broadcastAttendanceUpdate(examId: number, data: {
  candidateId: number;
  candidateName: string;
  action: 'check_in' | 'undo_check_in' | 'mark_absent' | 'undo_absent' | 'bulk_check_in';
  newStatus: string;
  checkedInCount?: number;
  totalCount?: number;
}) {
  const event = JSON.stringify({ type: "attendance_update", examId, ...data, timestamp: Date.now() });
  broadcastToExam(examId, event);
}

export function getConnectedClientCount(examId?: number): number {
  if (examId !== undefined) {
    let count = 0;
    for (const c of Array.from(clients.values())) { if (c.examId === examId) count++; }
    return count;
  }
  return clients.size;
}
