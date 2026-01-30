# Notification System Debugging Guide

## Issue
Notifications were not appearing for active matches with pending fight confirmations.

## Root Cause
The notification detection logic was comparing TypeScript enum constants against runtime string values:
- TypeScript: `match.status === MatchStatus.ACTIVE` (where `MatchStatus.ACTIVE` is a constant)
- Runtime: `match.status === "active"` (actual string value from API)

## Fix Applied
Changed from enum comparison to direct string comparison:

```typescript
// Before (INCORRECT)
if (match.status === MatchStatus.ACTIVE && isUserCaptain) {
  notifications.hasPendingActions = true;
}

// After (CORRECT)
if (match.status === "active" && isUserCaptain) {
  notifications.hasPendingActions = true;
}
```

## Debug Logging Added

### 1. matchNotifications.ts
Added logging when active match notification is detected:
```typescript
console.log("🔔 Notification detected:", {
  matchId: match._id || match.id,
  matchName: match.name,
  status: match.status,
  isUserCaptain,
  userId,
});
```

### 2. MatchesListPage.tsx
Added logging for match card rendering (filtered to specific matches):
```typescript
if ((match._id || match.id) === 'your-match-id-here' || match.name === 'test2') {
  console.log("🔍 Match card rendering:", {
    matchId: match._id || match.id,
    matchName: match.name,
    matchStatus: match.status,
    userId: user?._id || user?.id,
    notifications,
    notificationLabel,
    teams: match.teams,
  });
}
```

## WebSocket Disabled (Polling Only Mode)

Added environment variable `VITE_ENABLE_WEBSOCKET` to control WebSocket usage:

### .env.development
```env
VITE_ENABLE_WEBSOCKET=false
```

### .env.production
```env
VITE_ENABLE_WEBSOCKET=true
```

### realtimeService.ts
```typescript
const WEBSOCKET_ENABLED = import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false';

connect(): void {
  if (!WEBSOCKET_ENABLED) {
    console.log('🔕 WebSocket disabled via VITE_ENABLE_WEBSOCKET=false');
    this.switchToPolling();
    return;
  }
  // ... WebSocket connection logic
}
```

## Testing Instructions

1. **Restart dev server** to pick up environment variable changes:
   ```bash
   npm run dev
   ```

2. **Check console for these logs:**
   - `🔕 WebSocket disabled via VITE_ENABLE_WEBSOCKET=false`
   - `📡 WebSocket disabled - using polling only`
   - For "test2" match: `🔔 Notification detected:` (if notification should appear)
   - For "test2" match: `🔍 Match card rendering:` (showing notification data)

3. **Verify notification appears:**
   - Notification bell icon with badge showing pending count
   - "Action Required" chip on the match card
   - Orange/yellow highlighting for pending actions

4. **Monitor Network tab:**
   - Polling requests to `/api/v1/polling/matches/:matchId/updates`
   - Should occur every 3 seconds for active matches
   - Should occur every 15 seconds for background updates

## Expected Console Output (for "test2" match)

```
🔕 WebSocket disabled via VITE_ENABLE_WEBSOCKET=false
📡 WebSocket disabled - using polling only
� Checking captain: {
  teamId: "team1",
  captainId: "69759b32f81f442b742dcfa4",
  userId: "69759b32f81f442b742dcfa4",
  match: true,
  captain: { playerId: "69759b32f81f442b742dcfa4", ... }
}
🔍 Captain check result: {
  matchId: "...",
  matchName: "test2",
  matchStatus: "active",
  isUserCaptain: true,
  userId: "69759b32f81f442b742dcfa4",
  teamsCount: 2
}
🔔 Notification detected: {
  matchId: "...",
  matchName: "test2",
  status: "active",
  isUserCaptain: true,
  userId: "69759b32f81f442b742dcfa4"
}
🔍 Match card rendering: {
  matchId: "...",
  matchName: "test2",
  matchStatus: "active",
  userId: "69759b32f81f442b742dcfa4",
  notifications: {
    hasPendingActions: true,
    totalPending: 1,
    captainConfirmationNeeded: false,
    playerConfirmationNeeded: false,
    readyToStart: false
  },
  notificationLabel: "Action Required"
}
```

**Key Things to Look For:**
1. `isUserCaptain: true` in the captain check result
2. `🔔 Notification detected:` log appears
3. `notifications.hasPendingActions: true` in match card rendering
4. `notificationLabel: "Action Required"` appears

## Status Constants Reference

From `src/types/index.ts`:
```typescript
export const MatchStatus = {
  PENDING_CAPTAIN_CONFIRMATION: "pending_captain_confirmation",
  PENDING_PARTICIPANTS: "pending_participants",
  READY_TO_START: "ready_to_start",
  READY: "ready_to_start",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  SCHEDULED: "pending_captain_confirmation",
  LIVE: "active",
  DISPUTED: "disputed",
} as const;
```

Note: `MatchStatus.LIVE` and `MatchStatus.ACTIVE` both equal the string `"active"`.

## Next Steps

If notifications still don't appear:
1. Check that user is actually a captain (verify team captain IDs)
2. Check match status is exactly "active" (not "ACTIVE" or "live")
3. Verify userId matches captain ID in teams array
4. Check browser console for the debug logs above
