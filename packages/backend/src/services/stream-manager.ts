/**
 * WebSocket Stream Manager
 * Manages real-time streaming connections for chat responses,
 * execution updates, and pipeline events.
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { StreamEvent } from '@eadpa/shared';

export class StreamManager {
  private static instance: StreamManager;
  private clients: Map<string, WebSocket> = new Map();
  private wss: WebSocketServer | null = null;

  static getInstance(): StreamManager {
    if (!StreamManager.instance) {
      StreamManager.instance = new StreamManager();
    }
    return StreamManager.instance;
  }

  attachWebSocketServer(wss: WebSocketServer): void {
    this.wss = wss;
  }

  registerClient(sessionId: string, ws: WebSocket): void {
    this.clients.set(sessionId, ws);
  }

  unregisterClient(sessionId: string): void {
    this.clients.delete(sessionId);
  }

  /**
   * Send a stream event to a specific session
   */
  sendToSession(sessionId: string, event: StreamEvent): void {
    const client = this.clients.get(sessionId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event));
    }
  }

  /**
   * Broadcast to all connected clients in a workspace
   */
  broadcastToWorkspace(workspaceId: string, event: StreamEvent): void {
    // In production, filter by workspace membership
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event));
      }
    });
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}
