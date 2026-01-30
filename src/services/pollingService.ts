import { pollMatchUpdates } from "../api/matches";
import { pollMatchFights } from "../api/fights";
import type { Match, Fight } from "../types";
import { MatchStatus as MatchStatusEnum } from "../types";

type EventCallback = (data: any) => void;

interface PollingState {
  matchId: string;
  lastMatchUpdate: string;
  lastFightUpdate: string;
  interval: number;
  timerId: number | null;
  completedAt: string | null;
  isActive: boolean; // Whether user is actively viewing this match
}

class PollingService {
  private pollingStates: Map<string, PollingState> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isPageVisible: boolean = true;
  private defaultActiveInterval = 3000; // 3 seconds for active matches
  private defaultBackgroundInterval = 15000; // 15 seconds for background matches
  private completionGracePeriod = 180000; // 3 minutes after completion
  private visibilitySlowdownFactor = 3; // Reduce frequency by 3x when hidden

  constructor() {
    this.setupPageVisibilityListener();
  }

  private setupPageVisibilityListener(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.isPageVisible = !document.hidden;
        console.log(
          `📊 Page visibility changed: ${this.isPageVisible ? "visible" : "hidden"}`,
        );
        this.adjustPollingIntervals();
      });
    }
  }

  private adjustPollingIntervals(): void {
    this.pollingStates.forEach((state, matchId) => {
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = this.createPollingInterval(matchId, state);
      }
    });
  }

  private getEffectiveInterval(state: PollingState): number {
    const baseInterval = state.isActive
      ? this.defaultActiveInterval
      : this.defaultBackgroundInterval;

    return this.isPageVisible
      ? baseInterval
      : baseInterval * this.visibilitySlowdownFactor;
  }

  private createPollingInterval(
    matchId: string,
    state: PollingState,
  ): number {
    const interval = this.getEffectiveInterval(state);

    return window.setInterval(async () => {
      await this.pollMatch(matchId);
    }, interval);
  }

  private async pollMatch(matchId: string): Promise<void> {
    const state = this.pollingStates.get(matchId);
    if (!state) return;

    // Check if we should stop polling (3 minutes after completion)
    if (state.completedAt) {
      const timeSinceCompletion =
        Date.now() - new Date(state.completedAt).getTime();
      if (timeSinceCompletion > this.completionGracePeriod) {
        console.log(
          `⏹️ Stopping polling for completed match ${matchId} (3 minutes elapsed)`,
        );
        this.unsubscribeFromMatch(matchId);
        return;
      }
    }

    try {
      // Poll for match updates
      const matchResponse = await pollMatchUpdates(
        matchId,
        state.lastMatchUpdate,
      );

      if (matchResponse.hasChanges && matchResponse.match) {
        console.log(`📬 Match update detected for ${matchId}`);
        this.handleMatchUpdate(matchId, matchResponse.match);
      }

      // Poll for fight updates
      const fightsResponse = await pollMatchFights(
        matchId,
        state.lastFightUpdate,
      );

      if (fightsResponse.hasChanges && fightsResponse.fights) {
        console.log(
          `⚔️ Fight updates detected for ${matchId}: ${fightsResponse.fights.length} fights`,
        );
        this.handleFightUpdates(matchId, fightsResponse.fights);
      }
    } catch (error) {
      console.error(`❌ Polling error for match ${matchId}:`, error);
      this.emit("polling:error", { matchId, error });
    }
  }

  private handleMatchUpdate(matchId: string, match: Match): void {
    const state = this.pollingStates.get(matchId);
    if (!state) return;

    // Update last seen timestamp
    state.lastMatchUpdate = match.updatedAt;

    // Check if match just completed
    if (
      match.status === MatchStatusEnum.COMPLETED ||
      match.status === MatchStatusEnum.CANCELLED
    ) {
      if (!state.completedAt) {
        state.completedAt = new Date().toISOString();
        console.log(
          `🏁 Match ${matchId} completed/cancelled, will stop polling in 3 minutes`,
        );
      }
    }

    // Emit match update event
    this.emit("match:updated", {
      type: "match:updated",
      data: match,
      timestamp: new Date().toISOString(),
      matchId,
    });

    // Emit specific status events for backwards compatibility
    if (match.status === MatchStatusEnum.ACTIVE) {
      this.emit("match:started", {
        type: "match:started",
        data: match,
        timestamp: new Date().toISOString(),
        matchId,
      });
    } else if (match.status === MatchStatusEnum.COMPLETED) {
      this.emit("match:completed", {
        type: "match:completed",
        data: match,
        timestamp: new Date().toISOString(),
        matchId,
      });
    } else if (match.status === MatchStatusEnum.CANCELLED) {
      this.emit("match:cancelled", {
        type: "match:cancelled",
        data: match,
        timestamp: new Date().toISOString(),
        matchId,
      });
    }
  }

  private handleFightUpdates(matchId: string, fights: Fight[]): void {
    const state = this.pollingStates.get(matchId);
    if (!state) return;

    // Update last seen timestamp
    if (fights.length > 0) {
      const latestFight = fights.reduce((latest, fight) =>
        new Date(fight.updatedAt) > new Date(latest.updatedAt) ? fight : latest,
      );
      state.lastFightUpdate = latestFight.updatedAt;
    }

    // Emit fight events based on status
    fights.forEach((fight) => {
      switch (fight.status) {
        case "pending_captain_confirmation":
          this.emit("fight:reported", {
            type: "fight:reported",
            data: fight,
            timestamp: new Date().toISOString(),
            matchId,
          });
          break;
        case "confirmed":
          this.emit("fight:confirmed", {
            type: "fight:confirmed",
            data: fight,
            timestamp: new Date().toISOString(),
            matchId,
          });
          this.emit("fight:completed", {
            type: "fight:completed",
            data: fight,
            timestamp: new Date().toISOString(),
            matchId,
          });
          break;
        case "disputed":
          this.emit("fight:disputed", {
            type: "fight:disputed",
            data: fight,
            timestamp: new Date().toISOString(),
            matchId,
          });
          break;
      }
    });
  }

  subscribeToMatch(matchId: string, isActive: boolean = false): void {
    if (this.pollingStates.has(matchId)) {
      // Update active status if already subscribed
      const state = this.pollingStates.get(matchId)!;
      state.isActive = isActive;
      console.log(
        `♻️ Updated polling subscription for match ${matchId} (active: ${isActive})`,
      );
      return;
    }

    console.log(
      `📬 Starting polling for match ${matchId} (active: ${isActive})`,
    );

    const state: PollingState = {
      matchId,
      lastMatchUpdate: new Date().toISOString(),
      lastFightUpdate: new Date().toISOString(),
      interval: isActive
        ? this.defaultActiveInterval
        : this.defaultBackgroundInterval,
      timerId: null,
      completedAt: null,
      isActive,
    };

    this.pollingStates.set(matchId, state);

    // Start polling immediately
    this.pollMatch(matchId);

    // Setup interval
    state.timerId = this.createPollingInterval(matchId, state);

    this.emit("subscribed", { matchId });
  }

  unsubscribeFromMatch(matchId: string): void {
    const state = this.pollingStates.get(matchId);
    if (!state) return;

    console.log(`📪 Stopping polling for match ${matchId}`);

    if (state.timerId) {
      clearInterval(state.timerId);
    }

    this.pollingStates.delete(matchId);
    this.emit("unsubscribed", { matchId });
  }

  updateMatchActivity(matchId: string, isActive: boolean): void {
    const state = this.pollingStates.get(matchId);
    if (!state) return;

    if (state.isActive !== isActive) {
      state.isActive = isActive;
      console.log(
        `🔄 Changed match ${matchId} polling mode to ${isActive ? "active" : "background"}`,
      );

      // Restart polling with new interval
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = this.createPollingInterval(matchId, state);
      }
    }
  }

  stopAll(): void {
    console.log("⏹️ Stopping all polling");
    this.pollingStates.forEach((state) => {
      if (state.timerId) {
        clearInterval(state.timerId);
      }
    });
    this.pollingStates.clear();
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

  getActiveSubscriptions(): string[] {
    return Array.from(this.pollingStates.keys());
  }

  isPolling(matchId: string): boolean {
    return this.pollingStates.has(matchId);
  }
}

// Singleton instance
const pollingService = new PollingService();

export default pollingService;
