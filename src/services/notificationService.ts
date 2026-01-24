type NotificationType = "info" | "success" | "warning" | "error";

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

class NotificationService {
  private queue: Notification[] = [];
  private listeners: Set<(notification: Notification | null) => void> =
    new Set();
  private sounds: Record<NotificationType, HTMLAudioElement> = {
    info: new Audio("/sounds/info.mp3"),
    success: new Audio("/sounds/success.mp3"),
    warning: new Audio("/sounds/warning.mp3"),
    error: new Audio("/sounds/error.mp3"),
  };
  private soundEnabled: boolean;

  constructor() {
    this.soundEnabled = localStorage.getItem("sound-enabled") !== "false";

    // Preload all sounds
    Object.values(this.sounds).forEach((audio) => {
      audio.load();
    });
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem("sound-enabled", enabled ? "true" : "false");
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  private playSound(type: NotificationType): void {
    if (!this.soundEnabled) return;

    const audio = this.sounds[type];
    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn("Failed to play notification sound:", error);
    });
  }

  show(
    message: string,
    type: NotificationType = "info",
    options?: {
      action?: { label: string; onClick: () => void };
      duration?: number;
    },
  ): string {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      message,
      type,
      action: options?.action,
      duration: options?.duration || 5000,
    };

    this.queue.push(notification);
    this.playSound(type);
    this.notifyListeners(notification);

    return id;
  }

  dismiss(id: string): void {
    this.queue = this.queue.filter((n) => n.id !== id);
    this.notifyListeners(null);
  }

  subscribe(listener: (notification: Notification | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(notification: Notification | null): void {
    this.listeners.forEach((listener) => listener(notification));
  }

  // Convenience methods
  info(
    message: string,
    options?: {
      action?: { label: string; onClick: () => void };
      duration?: number;
    },
  ): string {
    return this.show(message, "info", options);
  }

  success(
    message: string,
    options?: {
      action?: { label: string; onClick: () => void };
      duration?: number;
    },
  ): string {
    return this.show(message, "success", options);
  }

  warning(
    message: string,
    options?: {
      action?: { label: string; onClick: () => void };
      duration?: number;
    },
  ): string {
    return this.show(message, "warning", options);
  }

  error(
    message: string,
    options?: {
      action?: { label: string; onClick: () => void };
      duration?: number;
    },
  ): string {
    return this.show(message, "error", options);
  }
}

// Singleton instance
const notificationService = new NotificationService();

export default notificationService;
