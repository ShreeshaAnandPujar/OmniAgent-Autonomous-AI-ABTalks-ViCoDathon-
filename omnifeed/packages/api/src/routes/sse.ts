import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AppEnv } from '../types/env.js';

const app = new Hono<AppEnv>();

/** Simple in-memory event bus for SSE */
type EventListener = (event: SSEEvent) => void;

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

const listeners = new Map<string, Set<EventListener>>();

export function emitSSEEvent(agentId: string, event: SSEEvent): void {
  const agentListeners = listeners.get(agentId);
  if (agentListeners) {
    for (const listener of agentListeners) {
      listener(event);
    }
  }
}

/** Broadcast to all connected SSE clients */
export function broadcastSSEEvent(event: SSEEvent): void {
  for (const [, agentListeners] of listeners) {
    for (const listener of agentListeners) {
      listener(event);
    }
  }
}

/**
 * GET /sse/feed/:agentId - SSE stream for real-time events
 */
app.get('/feed/:agentId', async (c) => {
  const agentId = c.req.param('agentId')!;

  return streamSSE(c, async (stream) => {
    // Send initial connection event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ agentId, timestamp: new Date().toISOString() }),
    });

    const listener: EventListener = (event) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      }).catch(() => {
        // Client disconnected; cleanup handled below
      });
    };

    // Register listener
    if (!listeners.has(agentId)) {
      listeners.set(agentId, new Set());
    }
    listeners.get(agentId)!.add(listener);

    // Send heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      stream.writeSSE({
        event: 'heartbeat',
        data: JSON.stringify({ timestamp: new Date().toISOString() }),
      }).catch(() => {
        // Connection lost
      });
    }, 30_000);

    // Wait for abort (client disconnect)
    stream.onAbort(() => {
      clearInterval(heartbeat);
      const agentListeners = listeners.get(agentId);
      if (agentListeners) {
        agentListeners.delete(listener);
        if (agentListeners.size === 0) {
          listeners.delete(agentId);
        }
      }
    });

    // Keep stream alive -- the stream will end when the client disconnects
    // and the onAbort callback fires.
    await new Promise(() => {
      // This promise never resolves, keeping the SSE stream open.
      // Cleanup happens in the onAbort handler above.
    });
  });
});

export default app;
