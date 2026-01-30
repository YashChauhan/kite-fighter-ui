import socketService from "./socketService";
import pollingService from "./pollingService";
import { getMatchById } from "../api/matches";

type EventCallback = (data: any) => void;
type ConnectionMode = "websocket" | "polling" | "offline";

class RealtimeService {
  private mode: ConnectionMode = "offline";
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private wsReconnectAttemptTimer: number | null = null;
  private wsReconnectInterval = 120000; // Retry WebSocket every 2 minutes
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private isInitialized = false;

  constructor() {
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    // Monitor WebSocket connection status
    socketService.onConnect(() => {
      console.log("✅ WebSocket connected - switching to WebSocket mode");
      this.switchToWebSocket();
    });

    socketService.onDisconnect(() => {
      console.log("❌ WebSocket disconnected");
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log(
          "🔄 Max WebSocket reconnection attempts reached - switching to polling mode",
        );
        this.switchToPolling();
      }
    });

    socketService.onError((error) => {
      console.error("❌ WebSocket error:", error);
      this.emit("error", error);
    });

    // Forward all WebSocket events
    this.forwardWebSocketEvents();
  }

  private forwardWebSocketEvents(): void {
    const events = [
      "match:created",
      "match:updated",
      "match:started",
      "match:completed",
      "match:cancelled",
      "match:players_added",
      "match:players_removed",
      "match:captain_changed",
      "fight:reported",
      "fight:confirmed",
      "fight:disputed",
      "fight:completed",
      "subscribed",
      "unsubscribed",
    ];

    events.forEach((event) => {
      socketService.on(event, (data) => {
        if (this.mode === "websocket") {
          this.emit(event, data);
        }
      });
    });
  }

  private forwardPollingEvents(): void {
    const events = [
      "match:created",
      "match:updated",
      "match:started",
      "match:completed",
      "match:cancelled",
      "fight:reported",
      "fight:confirmed",
      "fight:disputed",
      "fight:completed",
      "subscribed",
      "unsubscribed",
      "polling:error",
    ];

    events.forEach((event) => {
      pollingService.on(event, (data) => {
        if (this.mode === "polling") {
          this.emit(event, data);
        }
      });
    });
  }

  private async switchToWebSocket(): Promise<void> {
    if (this.mode === "websocket") return;

    console.log("🔄 Switching to WebSocket mode");

    // Stop polling
    const activeSubscriptions = pollingService.getActiveSubscriptions();
    pollingService.stopAll();

    // Clear reconnect timer
    if (this.wsReconnectAttemptTimer) {
      clearTimeout(this.wsReconnectAttemptTimer);
      this.wsReconnectAttemptTimer = null;
    }

    this.mode = "websocket";
    this.reconnectAttempts = 0;

    // Sync state: Resubscribe to all matches via WebSocket
    for (const matchId of activeSubscriptions) {
      console.log(`🔄 Re-subscribing to match ${matchId} via WebSocket`);
      socketService.subscribeToMatch(matchId);

      // Fetch latest state to catch any missed updates during transition
      try {
        const match = await getMatchById(matchId);
        this.emit("match:updated", {
          type: "match:updated",
          data: match,
          timestamp: new Date().toISOString(),
          matchId,
        });
      } catch (error) {
        console.error(
          `Failed to sync state for match ${matchId} during mode switch:`,
          error,
        );
      }
    }

    this.emit("mode:changed", { mode: "websocket" });
  }

  private switchToPolling(): void {
    if (this.mode === "polling") return;

    console.log("🔄 Switching to Polling mode");

    // Disconnect WebSocket
    socketService.disconnect();

    this.mode = "polling";

    // Setup polling event forwarding
    this.forwardPollingEvents();

    // Start retrying WebSocket connection periodically
    this.scheduleWebSocketRetry();

    this.emit("mode:changed", { mode: "polling" });
  }

  private scheduleWebSocketRetry(): void {
    if (this.wsReconnectAttemptTimer) return;

    console.log(
      `⏱️ Will retry WebSocket connection in ${this.wsReconnectInterval / 1000}s`,
    );

    this.wsReconnectAttemptTimer = window.setTimeout(() => {
      console.log("🔄 Attempting to reconnect WebSocket...");
      this.reconnectAttempts = 0;
      socketService.connect();
      this.wsReconnectAttemptTimer = null;

      // Schedule next retry if still in polling mode
      if (this.mode === "polling") {
        this.scheduleWebSocketRetry();
      }
    }, this.wsReconnectInterval);
  }

  // Public API
  connect(): void {
    if (this.isInitialized) return;

    console.log("🚀 Initializing RealtimeService");
    this.isInitialized = true;

    // Try WebSocket first
    socketService.connect();

    // If WebSocket fails to connect within 5 seconds, fall back to polling
    setTimeout(() => {
      if (!socketService.isConnected()) {
        console.log("⚠️ WebSocket connection timeout - switching to polling");
        this.switchToPolling();
      } else {
        this.mode = "websocket";
        this.emit("mode:changed", { mode: "websocket" });
      }
    }, 5000);
  }

  disconnect(): void {
    console.log("🔌 Disconnecting RealtimeService");

    socketService.disconnect();
    pollingService.stopAll();

    if (this.wsReconnectAttemptTimer) {
      clearTimeout(this.wsReconnectAttemptTimer);
      this.wsReconnectAttemptTimer = null;
    }

    this.mode = "offline";
    this.isInitialized = false;
    this.emit("mode:changed", { mode: "offline" });
  }

  subscribeToMatch(matchId: string, isActive: boolean = true): void {
    console.log(
      `📬 Subscribing to match ${matchId} via ${this.mode} (active: ${isActive})`,
    );

    if (this.mode === "websocket") {
      socketService.subscribeToMatch(matchId);
    } else if (this.mode === "polling") {
      pollingService.subscribeToMatch(matchId, isActive);
    } else {
      console.warn(
        "⚠️ Cannot subscribe: RealtimeService is offline. Call connect() first.",
      );
    }
  }

  unsubscribeFromMatch(matchId: string): void {
    console.log(`📪 Unsubscribing from match ${matchId}`);

    if (this.mode === "websocket") {
      socketService.unsubscribeFromMatch(matchId);
    } else if (this.mode === "polling") {
      pollingService.unsubscribeFromMatch(matchId);
    }
  }

  updateMatchActivity(matchId: string, isActive: boolean): void {
    if (this.mode === "polling") {
      pollingService.updateMatchActivity(matchId, isActive);
    }
    // WebSocket doesn't need activity tracking - all subscriptions are treated equally
  }

  // Alias methods for backwards compatibility
  joinMatchRoom(matchId: string): void {
    this.subscribeToMatch(matchId);
  }

  leaveMatchRoom(matchId: string): void {
    this.unsubscribeFromMatch(matchId);
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

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // Convenience methods matching socketService API
  onConnect(callback: EventCallback): () => void {
    return this.on("connect", callback);
  }

  onDisconnect(callback: EventCallback): () => void {
    return this.on("disconnect", callback);
  }

  onError(callback: EventCallback): () => void {
    return this.on("error", callback);
  }

  onModeChanged(callback: EventCallback): () => void {
    return this.on("mode:changed", callback);
  }

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

  onPlayersAdded(callback: EventCallback): () => void {
    return this.on("match:players_added", callback);
  }

  onPlayersRemoved(callback: EventCallback): () => void {
    return this.on("match:players_removed", callback);
  }

  onCaptainChanged(callback: EventCallback): () => void {
    return this.on("match:captain_changed", callback);
  }

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

  onSubscribed(callback: EventCallback): () => void {
    return this.on("subscribed", callback);
  }

  onUnsubscribed(callback: EventCallback): () => void {
    return this.on("unsubscribed", callback);
  }

  // Status methods
  isConnected(): boolean {
    return this.mode !== "offline";
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  isUsingWebSocket(): boolean {
    return this.mode === "websocket";
  }

  isUsingPolling(): boolean {
    return this.mode === "polling";
  }

  // Manual retry method
  retryConnection(): void {
    console.log("🔄 Manual reconnection requested");
    this.reconnectAttempts = 0;

    if (this.mode === "polling") {
      // Clear scheduled retry and try immediately
      if (this.wsReconnectAttemptTimer) {
        clearTimeout(this.wsReconnectAttemptTimer);
        this.wsReconnectAttemptTimer = null;
      }
      socketService.connect();
      this.scheduleWebSocketRetry();
    } else if (this.mode === "offline") {
      this.connect();
    }
  }
}

// Singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;
export type { ConnectionMode };
