import type { Response } from "express";

/**
 * Activity event types for real-time updates
 */
export type ActivityEventType = "play" | "download" | "upload" | "comment" | "vote";

/**
 * Activity event data structure
 */
export interface ActivityEventData {
  mediaFileId: number;
  mediaTitle: string;
  location?: string;
  timestamp: string;
}

/**
 * Activity event sent via SSE
 */
export interface ActivityEvent {
  type: ActivityEventType;
  data: ActivityEventData;
}

/**
 * SSE client connection
 */
interface SSEClient {
  id: string;
  response: Response;
  connectedAt: Date;
}

/**
 * ActivityBroadcaster manages Server-Sent Events connections and broadcasts
 * activity events to all connected clients in real-time.
 * 
 * This class implements the singleton pattern to ensure a single broadcaster
 * instance is shared across the application.
 */
export class ActivityBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter: number = 0;

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    this.clientIdCounter++;
    return `client_${Date.now()}_${this.clientIdCounter}`;
  }

  /**
   * Add a new SSE client connection.
   * 
   * @param res - Express response object for the SSE connection
   * @returns The unique client ID assigned to this connection
   */
  addClient(res: Response): string {
    const id = this.generateClientId();
    
    const client: SSEClient = {
      id,
      response: res,
      connectedAt: new Date(),
    };

    this.clients.set(id, client);
    
    console.log(`[SSE] Client connected: ${id}. Total clients: ${this.clients.size}`);
    
    return id;
  }

  /**
   * Remove an SSE client connection.
   * 
   * @param id - The unique client ID to remove
   */
  removeClient(id: string): void {
    const client = this.clients.get(id);
    
    if (client) {
      this.clients.delete(id);
      console.log(`[SSE] Client disconnected: ${id}. Total clients: ${this.clients.size}`);
    }
  }

  /**
   * Broadcast an activity event to all connected clients.
   * 
   * @param event - The activity event to broadcast
   */
  broadcast(event: ActivityEvent): void {
    if (this.clients.size === 0) {
      return;
    }

    const eventString = this.formatSSEMessage(event);
    const disconnectedClients: string[] = [];

    this.clients.forEach((client, id) => {
      try {
        // Check if the response is still writable
        if (!client.response.writableEnded) {
          client.response.write(eventString);
        } else {
          disconnectedClients.push(id);
        }
      } catch (error) {
        console.error(`[SSE] Error broadcasting to client ${id}:`, error);
        disconnectedClients.push(id);
      }
    });

    // Clean up disconnected clients
    for (const id of disconnectedClients) {
      this.removeClient(id);
    }

    if (disconnectedClients.length > 0) {
      console.log(`[SSE] Cleaned up ${disconnectedClients.length} disconnected clients`);
    }
  }

  /**
   * Format an activity event as an SSE message.
   * SSE format: "event: <type>\ndata: <json>\n\n"
   * 
   * @param event - The activity event to format
   * @returns Formatted SSE message string
   */
  private formatSSEMessage(event: ActivityEvent): string {
    const data = JSON.stringify({
      type: event.type,
      ...event.data,
    });
    
    return `event: activity\ndata: ${data}\n\n`;
  }

  /**
   * Send a heartbeat/ping to all connected clients.
   * This helps keep connections alive and detect dead connections.
   */
  sendHeartbeat(): void {
    if (this.clients.size === 0) {
      return;
    }

    const heartbeat = `: heartbeat\n\n`;
    const disconnectedClients: string[] = [];

    this.clients.forEach((client, id) => {
      try {
        if (!client.response.writableEnded) {
          client.response.write(heartbeat);
        } else {
          disconnectedClients.push(id);
        }
      } catch (error) {
        disconnectedClients.push(id);
      }
    });

    // Clean up disconnected clients
    for (const id of disconnectedClients) {
      this.removeClient(id);
    }
  }

  /**
   * Get the number of currently connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get information about all connected clients.
   */
  getClientInfo(): Array<{ id: string; connectedAt: Date }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
    }));
  }

  /**
   * Disconnect all clients and clear the client list.
   * Useful for graceful shutdown.
   */
  disconnectAll(): void {
    this.clients.forEach((client, id) => {
      try {
        if (!client.response.writableEnded) {
          client.response.end();
        }
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    
    this.clients.clear();
    console.log("[SSE] All clients disconnected");
  }
}

// Global singleton instance
export const activityBroadcaster = new ActivityBroadcaster();

/**
 * Helper function to broadcast an activity event.
 * This is a convenience wrapper around the singleton broadcaster.
 * 
 * @param type - The type of activity event
 * @param mediaFileId - The ID of the media file involved
 * @param mediaTitle - The title of the media file
 * @param location - Optional location (city/country) of the user
 */
export function broadcastActivity(
  type: ActivityEventType,
  mediaFileId: number,
  mediaTitle: string,
  location?: string
): void {
  const event: ActivityEvent = {
    type,
    data: {
      mediaFileId,
      mediaTitle,
      location,
      timestamp: new Date().toISOString(),
    },
  };

  activityBroadcaster.broadcast(event);
}

// Start heartbeat interval to keep connections alive (every 30 seconds)
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start the heartbeat interval for SSE connections.
 * Call this when the server starts.
 */
export function startHeartbeat(): void {
  if (heartbeatInterval) {
    return;
  }
  
  heartbeatInterval = setInterval(() => {
    activityBroadcaster.sendHeartbeat();
  }, 30000); // 30 seconds
  
  console.log("[SSE] Heartbeat started");
}

/**
 * Stop the heartbeat interval.
 * Call this during graceful shutdown.
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log("[SSE] Heartbeat stopped");
  }
}
