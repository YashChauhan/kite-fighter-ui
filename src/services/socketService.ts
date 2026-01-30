const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "wss://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1/ws/matches";

// Log WebSocket configuration in development
if (import.meta.env.VITE_ENVIRONMENT === "development") {
  console.log(`🔌 WebSocket URL: ${SOCKET_URL}`);
  console.log(
    `🔌 VITE_SOCKET_URL env: ${import.meta.env.VITE_SOCKET_URL || "not set"}`,
  );
}

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
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log("✅ WebSocket already connected");
      return;
    }

    const token = localStorage.getItem("token");
    const url = token ? `${SOCKET_URL}?token=${token}` : SOCKET_URL;

    console.log("🔌 Attempting to connect WebSocket to:", url);
    console.log("🔑 Token present:", !!token);
    console.log("🔗 Base SOCKET_URL:", SOCKET_URL);

    try {
      this.socket = new WebSocket(url);
      this.setupListeners();
    } catch (error) {
      console.error("❌ WebSocket connection error:", error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    console.log("🔌 Disconnecting WebSocket...");

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
      console.log("✅ WebSocket connected successfully");
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit("connect", null);

      // Re-subscribe to matches after reconnection
      this.subscribedMatches.forEach((matchId) => {
        console.log(`🔄 Re-subscribing to match: ${matchId}`);
        this.subscribeToMatch(matchId);
      });
    };

    this.socket.onclose = (event) => {
      console.log("❌ WebSocket closed:", event.code, event.reason);
      this.connected = false;
      this.emit("disconnect", null);

      // Only attempt reconnect if not a normal closure
      if (event.code !== 1000) {
        this.handleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
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
      console.error(
        "❌ Max reconnection attempts reached. WebSocket will not reconnect automatically.",
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log("📤 Sending WebSocket message:", message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn(
        "⚠️ WebSocket is not connected. Cannot send message:",
        message,
      );
    }
  }

  subscribeToMatch(matchId: string): void {
    console.log(`📬 Subscribing to match: ${matchId}`);
    this.subscribedMatches.add(matchId);
    this.send({
      type: "subscribe",
      data: { matchId },
    });
  }

  unsubscribeFromMatch(matchId: string): void {
    console.log(`📪 Unsubscribing from match: ${matchId}`);
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

  // Roster management events
  onPlayersAdded(callback: EventCallback): () => void {
    return this.on("match:players_added", callback);
  }

  onPlayersRemoved(callback: EventCallback): () => void {
    return this.on("match:players_removed", callback);
  }

  onCaptainChanged(callback: EventCallback): () => void {
    return this.on("match:captain_changed", callback);
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
