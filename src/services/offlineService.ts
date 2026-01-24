/**
 * Offline Service - Manages offline caching, pinned matches, and storage quota
 *
 * Features:
 * - Pin up to 20 matches for offline access
 * - Smart cache eviction at 80% storage quota
 * - 7-day TTL for cached match data
 * - Storage size tracking and management
 */

import type { Match } from "../types";

interface CachedMatch {
  match: Match;
  cachedAt: number;
  pinnedAt?: number;
}

interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  percentUsed: number;
  pinnedCount: number;
  cacheCount: number;
}

const DB_NAME = "kite-fighters-offline";
const DB_VERSION = 1;
const MATCHES_STORE = "matches";
const METADATA_STORE = "metadata";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PINNED = 20;
const EVICTION_THRESHOLD = 0.8; // 80%

class OfflineService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create matches store with matchId as key
        if (!db.objectStoreNames.contains(MATCHES_STORE)) {
          const matchesStore = db.createObjectStore(MATCHES_STORE, {
            keyPath: "matchId",
          });
          matchesStore.createIndex("cachedAt", "cachedAt", { unique: false });
          matchesStore.createIndex("pinnedAt", "pinnedAt", { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: "key" });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Pin a match for offline access
   */
  async pinMatch(match: Match): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const pinnedCount = await this.getPinnedCount();
    if (pinnedCount >= MAX_PINNED) {
      throw new Error(`Cannot pin more than ${MAX_PINNED} matches`);
    }

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    const cachedMatch: CachedMatch & { matchId: string } = {
      matchId: match.id,
      match,
      cachedAt: Date.now(),
      pinnedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cachedMatch);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Check if we need to evict old cached items
    await this.checkAndEvict();
  }

  /**
   * Unpin a match
   */
  async unpinMatch(matchId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    // Get the match
    const getRequest = store.get(matchId);
    const cachedMatch = await new Promise<CachedMatch & { matchId: string }>(
      (resolve, reject) => {
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      },
    );

    if (!cachedMatch) return;

    // Remove pinnedAt timestamp
    delete cachedMatch.pinnedAt;

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cachedMatch);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pinned matches
   */
  async getPinnedMatches(): Promise<Match[]> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readonly");
    const store = transaction.objectStore(MATCHES_STORE);
    const index = store.index("pinnedAt");

    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      const matches: Match[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cachedMatch = cursor.value as CachedMatch & { matchId: string };
          if (cachedMatch.pinnedAt) {
            matches.push(cachedMatch.match);
          }
          cursor.continue();
        } else {
          resolve(matches);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a match is pinned
   */
  async isMatchPinned(matchId: string): Promise<boolean> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readonly");
    const store = transaction.objectStore(MATCHES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(matchId);
      request.onsuccess = () => {
        const cachedMatch = request.result as
          | (CachedMatch & { matchId: string })
          | undefined;
        resolve(!!cachedMatch?.pinnedAt);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache a match (non-pinned)
   */
  async cacheMatch(match: Match): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    // Check if already exists
    const existing = await new Promise<
      (CachedMatch & { matchId: string }) | undefined
    >((resolve, reject) => {
      const request = store.get(match.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Don't overwrite pinned matches
    if (existing?.pinnedAt) return;

    const cachedMatch: CachedMatch & { matchId: string } = {
      matchId: match.id,
      match,
      cachedAt: Date.now(),
      pinnedAt: existing?.pinnedAt,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cachedMatch);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await this.checkAndEvict();
  }

  /**
   * Get a cached match
   */
  async getCachedMatch(matchId: string): Promise<Match | null> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readonly");
    const store = transaction.objectStore(MATCHES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.get(matchId);
      request.onsuccess = () => {
        const cachedMatch = request.result as
          | (CachedMatch & { matchId: string })
          | undefined;
        if (!cachedMatch) {
          resolve(null);
          return;
        }

        // Check if expired (7 days)
        const age = Date.now() - cachedMatch.cachedAt;
        if (age > SEVEN_DAYS_MS && !cachedMatch.pinnedAt) {
          // Delete expired cache
          this.deleteMatch(matchId);
          resolve(null);
        } else {
          resolve(cachedMatch.match);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a cached match
   */
  private async deleteMatch(matchId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(matchId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get count of pinned matches
   */
  private async getPinnedCount(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readonly");
    const store = transaction.objectStore(MATCHES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cachedMatch = cursor.value as CachedMatch & { matchId: string };
          if (cachedMatch.pinnedAt) count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    // Get storage quota
    let usedBytes = 0;
    let availableBytes = 0;

    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage || 0;
      availableBytes = estimate.quota || 0;
    }

    // Get counts
    const transaction = this.db.transaction([MATCHES_STORE], "readonly");
    const store = transaction.objectStore(MATCHES_STORE);

    const { pinnedCount, cacheCount } = await new Promise<{
      pinnedCount: number;
      cacheCount: number;
    }>((resolve, reject) => {
      const request = store.openCursor();
      let pinned = 0;
      let cached = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cachedMatch = cursor.value as CachedMatch & { matchId: string };
          if (cachedMatch.pinnedAt) {
            pinned++;
          } else {
            cached++;
          }
          cursor.continue();
        } else {
          resolve({ pinnedCount: pinned, cacheCount: cached });
        }
      };

      request.onerror = () => reject(request.error);
    });

    return {
      usedBytes,
      availableBytes,
      percentUsed: availableBytes > 0 ? usedBytes / availableBytes : 0,
      pinnedCount,
      cacheCount,
    };
  }

  /**
   * Check storage quota and evict old caches if needed
   */
  private async checkAndEvict(): Promise<void> {
    const info = await this.getStorageInfo();

    if (info.percentUsed < EVICTION_THRESHOLD) return;

    // Evict old unpinned caches
    await this.evictOldMatches();
  }

  /**
   * Evict old unpinned matches (oldest first)
   */
  async evictOldMatches(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);
    const index = store.index("cachedAt");

    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      const toDelete: string[] = [];

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cachedMatch = cursor.value as CachedMatch & { matchId: string };

          // Only delete unpinned matches
          if (!cachedMatch.pinnedAt) {
            const age = Date.now() - cachedMatch.cachedAt;

            // Delete if expired
            if (age > SEVEN_DAYS_MS) {
              toDelete.push(cachedMatch.matchId);
            }
          }

          cursor.continue();
        } else {
          // Delete all marked items
          const deleteTransaction = this.db!.transaction(
            [MATCHES_STORE],
            "readwrite",
          );
          const deleteStore = deleteTransaction.objectStore(MATCHES_STORE);

          for (const matchId of toDelete) {
            deleteStore.delete(matchId);
          }

          deleteTransaction.oncomplete = () => resolve(toDelete.length);
          deleteTransaction.onerror = () => reject(deleteTransaction.error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached data (keeps pinned)
   */
  async clearCache(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      const toDelete: string[] = [];

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cachedMatch = cursor.value as CachedMatch & { matchId: string };

          // Only delete unpinned matches
          if (!cachedMatch.pinnedAt) {
            toDelete.push(cachedMatch.matchId);
          }

          cursor.continue();
        } else {
          // Delete all marked items
          const deleteTransaction = this.db!.transaction(
            [MATCHES_STORE],
            "readwrite",
          );
          const deleteStore = deleteTransaction.objectStore(MATCHES_STORE);

          for (const matchId of toDelete) {
            deleteStore.delete(matchId);
          }

          deleteTransaction.oncomplete = () => resolve();
          deleteTransaction.onerror = () => reject(deleteTransaction.error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data including pinned matches
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");

    const transaction = this.db.transaction([MATCHES_STORE], "readwrite");
    const store = transaction.objectStore(MATCHES_STORE);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const offlineService = new OfflineService();
