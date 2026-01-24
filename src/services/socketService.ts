const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "ws://localhost:3000/api/v1/ws/matches";

type EventCallback = (data: any) => void;

interface WSMessage {
  type: string;
  data?: any;
  timestamp: string;
  matchId?: string;
}

class SocketService {
  private socket: WebSocket | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimeout: number | null = null;
  private subscribedMatches: Set<string> = new Set();

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem("token");
    const url = token ? `${SOCKET_URL}?token=${token}` : SOCKET_URL;

    try {
      this.socket = new WebSocket(url);
      this.setupListeners();
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
      this.subscribedMatches.clear();
    }
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit("connect", null);

      // Re-subscribe to matches after reconnection
      this.subscribedMatches.forEach((matchId) => {
        this.subscribeToMatch(matchId);
      });
    };

    this.socket.onclose = () => {
      this.connected = false;
      this.emit("disconnect", null);
      this.handleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.emit("error", error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        // Emit the message type as an event
        this.emit(message.type, message);

        // Also emit specific event formats for backwards compatibility
        if (message.type.startsWith("match:")) {
          this.emit(message.type, message.data);
        } else if (message.type.startsWith("fight:")) {
          this.emit(message.type, message.data);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
    }
  }

  subscribeToMatch(matchId: string): void {
    this.subscribedMatches.add(matchId);
    this.send({
      type: "subscribe",
      data: { matchId },
    });
  }

  unsubscribeFromMatch(matchId: string): void {
    this.subscribedMatches.delete(matchId);
    this.send({
      type: "unsubscribe",
      data: { matchId },
    });
  }

  // Alias methods for backwards compatibility
  joinMatchRoom(matchId: string): void {
    this.subscribeToMatch(matchId);
  }

  leaveMatchRoom(matchId: string): void {
    this.unsubscribeFromMatch(matchId);
  }

  joinAdminRoom(): void {
    // Admin room subscription - may need backend implementation
    this.send({
      type: "subscribe",
      data: { room: "admin" },
    });
  }

  leaveAdminRoom(): void {
    this.send({
      type: "unsubscribe",
      data: { room: "admin" },
    });
  }

  // Event subscription methods
  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Convenience methods for common events
  onConnect(callback: EventCallback): () => void {
    return this.on("connect", callback);
  }

  onDisconnect(callback: EventCallback): () => void {
    return this.on("disconnect", callback);
  }

  onError(callback: EventCallback): () => void {
    return this.on("error", callback);
  }

  // Match events (using documentation format)
  onMatchCreated(callback: EventCallback): () => void {
    return this.on("match:created", callback);
  }

  onMatchUpdated(callback: EventCallback): () => void {
    return this.on("match:updated", callback);
  }

  onMatchStarted(callback: EventCallback): () => void {
    return this.on("match:started", callback);
  }

  onMatchCompleted(callback: EventCallback): () => void {
    return this.on("match:completed", callback);
  }

  onMatchCancelled(callback: EventCallback): () => void {
    return this.on("match:cancelled", callback);
  }

  // Fight events (using documentation format)
  onFightReported(callback: EventCallback): () => void {
    return this.on("fight:reported", callback);
  }

  onFightConfirmed(callback: EventCallback): () => void {
    return this.on("fight:confirmed", callback);
  }

  onFightDisputed(callback: EventCallback): () => void {
    return this.on("fight:disputed", callback);
  }

  onFightCompleted(callback: EventCallback): () => void {
    return this.on("fight:completed", callback);
  }

  // Subscription events
  onSubscribed(callback: EventCallback): () => void {
    return this.on("subscribed", callback);
  }

  onUnsubscribed(callback: EventCallback): () => void {
    return this.on("unsubscribed", callback);
  }

  // Legacy event names for backwards compatibility
  onMatchStarting(callback: EventCallback): () => void {
    return this.on("match:started", callback);
  }

  onPendingPlayerAdded(callback: EventCallback): () => void {
    return this.on("player:pending", callback);
  }

  onPendingClubAdded(callback: EventCallback): () => void {
    return this.on("club:pending", callback);
  }

  // Expose off method for cleanup
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
}

// Singleton instance
const socketService = new SocketService();

export default socketService;
