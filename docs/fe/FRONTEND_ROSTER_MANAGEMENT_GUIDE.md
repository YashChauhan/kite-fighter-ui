# Frontend Match Roster Management Guide

## Overview

This guide covers the implementation of match roster management features in the frontend, including:
- Adding/removing players from match teams (bulk operations)
- Changing team captains
- Handling partial success responses
- Feature flag-aware confirmation workflow
- WebSocket real-time updates

## Feature Flag: Captain-Only Start Mode

The backend supports a feature flag `ENABLE_CAPTAIN_ONLY_START` that simplifies the match confirmation workflow.

### When Flag is OFF (Default)
```
Match Created (PENDING_CAPTAIN_CONFIRMATION)
  ↓ Both captains confirm
PENDING_PARTICIPANTS
  ↓ 3+ players per team confirm
READY
  ↓ Organizer starts
ACTIVE
```

### When Flag is ON
```
Match Created (PENDING_CAPTAIN_CONFIRMATION)
  ↓ Both captains confirm
READY
  ↓ Organizer starts  
ACTIVE
```

**Frontend Impact:** Your UI should check match status and display appropriate messaging. The `pending_participants` status may not exist when flag is enabled.

---

## API Endpoints

### 1. Bulk Add Players to Team

**Endpoint:** `POST /api/v1/matches/:matchId/teams/:teamId/players/bulk`

**Authorization:** Requires one of:
- Match organizer
- Team captain
- Club owner/co-owner
- Admin

**Request Body:**
```typescript
{
  playerIds: string[]; // Max 20 players
}
```

**Response (Partial Success):**
```typescript
{
  success: string[]; // Successfully added player IDs
  failed: Array<{
    playerId: string;
    reason: string; // Human-readable error: "Player not found", "Player already in match", "Player not in club"
  }>;
  match: IMatch; // Updated match object
}
```

**Rate Limit:** 10 requests/minute

---

### 2. Bulk Remove Players from Team

**Endpoint:** `DELETE /api/v1/matches/:matchId/teams/:teamId/players/bulk`

**Authorization:** Same as add players

**Request Body:**
```typescript
{
  playerIds: string[]; // Max 20 players
}
```

**Response (Partial Success):**
```typescript
{
  success: string[]; // Successfully removed player IDs
  failed: Array<{
    playerId: string;
    reason: string; // "Cannot remove captain", "Cannot remove confirmed player", "Player not in team"
  }>;
  match: IMatch;
}
```

**Rate Limit:** 10 requests/minute

---

### 3. Change Team Captain

**Endpoint:** `PATCH /api/v1/matches/:matchId/teams/:teamId/captain`

**Authorization:** Same as add/remove players

**Request Body:**
```typescript
{
  captainId: string; // Must be a player already in the team
}
```

**Response:**
```typescript
{
  _id: string;
  teams: [...]; // Updated teams with new captain
  // ... rest of match object
}
```

**Rate Limit:** 10 requests/minute

**Note:** Both old and new captain receive notifications about the change.

---

## React Component Examples

### Bulk Add Players Component

```tsx
import { useState } from 'react';
import { addPlayersToTeam } from '../api/matches';

interface AddPlayersProps {
  matchId: string;
  teamId: 'team1' | 'team2';
  availablePlayers: Player[];
  onSuccess: () => void;
}

export function AddPlayersToTeam({
  matchId,
  teamId,
  availablePlayers,
  onSuccess
}: AddPlayersProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: string[];
    failed: Array<{ playerId: string; reason: string }>;
  } | null>(null);

  const handleSubmit = async () => {
    if (selectedPlayers.length === 0) return;
    if (selectedPlayers.length > 20) {
      alert('Maximum 20 players can be added at once');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await addPlayersToTeam(matchId, teamId, selectedPlayers);
      setResult(response);

      if (response.success.length > 0) {
        onSuccess();
      }

      // Show partial success summary
      if (response.failed.length > 0) {
        console.warn('Some players failed to add:', response.failed);
      }
    } catch (error) {
      alert('Failed to add players: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-players-modal">
      <h3>Add Players to Team</h3>

      {/* Player Selection */}
      <div className="player-list">
        {availablePlayers.map((player) => (
          <label key={player._id} className="player-checkbox">
            <input
              type="checkbox"
              checked={selectedPlayers.includes(player._id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedPlayers([...selectedPlayers, player._id]);
                } else {
                  setSelectedPlayers(selectedPlayers.filter(id => id !== player._id));
                }
              }}
            />
            {player.name}
          </label>
        ))}
      </div>

      {/* Selection Summary */}
      <p className="selection-count">
        {selectedPlayers.length} player(s) selected
        {selectedPlayers.length > 20 && (
          <span className="error"> (max 20 allowed)</span>
        )}
      </p>

      {/* Result Display - Partial Success Handling */}
      {result && (
        <div className="result-summary">
          {result.success.length > 0 && (
            <div className="success-msg">
              ✅ Successfully added {result.success.length} player(s)
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="failed-section">
              <p className="warning">⚠️ Failed to add {result.failed.length} player(s):</p>
              <ul className="failed-list">
                {result.failed.map(({ playerId, reason }) => {
                  const player = availablePlayers.find(p => p._id === playerId);
                  return (
                    <li key={playerId}>
                      <strong>{player?.name || playerId}:</strong> {reason}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button
          onClick={handleSubmit}
          disabled={loading || selectedPlayers.length === 0 || selectedPlayers.length > 20}
          className="btn-primary"
        >
          {loading ? 'Adding...' : `Add ${selectedPlayers.length} Player(s)`}
        </button>
      </div>
    </div>
  );
}
```

---

### Bulk Remove Players Component

```tsx
import { useState } from 'react';
import { removePlayersFromTeam } from '../api/matches';

interface RemovePlayersProps {
  matchId: string;
  teamId: 'team1' | 'team2';
  teamPlayers: MatchPlayer[];
  onSuccess: () => void;
}

export function RemovePlayersFromTeam({
  matchId,
  teamId,
  teamPlayers,
  onSuccess
}: RemovePlayersProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Filter out captain and confirmed players from selection
  const removablePlayersIds = teamPlayers
    .filter(p => 
      p.confirmationStatus !== 'confirmed' &&
      !p.isCaptain // Add captain flag check
    )
    .map(p => p.playerId._id);

  const handleSubmit = async () => {
    if (selectedPlayers.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await removePlayersFromTeam(matchId, teamId, selectedPlayers);
      setResult(response);

      if (response.success.length > 0) {
        onSuccess();
        setSelectedPlayers([]);
      }
    } catch (error) {
      alert('Failed to remove players: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="remove-players-modal">
      <h3>Remove Players from Team</h3>

      <div className="info-box">
        ℹ️ You can only remove players who are <strong>pending</strong> or <strong>declined</strong>.
        Captains and confirmed players cannot be removed.
      </div>

      <div className="player-list">
        {teamPlayers.map((player) => {
          const isRemovable = removablePlayersIds.includes(player.playerId._id);
          
          return (
            <label 
              key={player.playerId._id}
              className={`player-checkbox ${!isRemovable ? 'disabled' : ''}`}
            >
              <input
                type="checkbox"
                disabled={!isRemovable}
                checked={selectedPlayers.includes(player.playerId._id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPlayers([...selectedPlayers, player.playerId._id]);
                  } else {
                    setSelectedPlayers(selectedPlayers.filter(id => id !== player.playerId._id));
                  }
                }}
              />
              {player.playerName}
              <span className="status-badge">{player.confirmationStatus}</span>
              {player.isCaptain && <span className="captain-badge">Captain</span>}
            </label>
          );
        })}
      </div>

      <p className="selection-count">
        {selectedPlayers.length} player(s) selected
      </p>

      {/* Result Display */}
      {result && (
        <div className="result-summary">
          {result.success.length > 0 && (
            <div className="success-msg">
              ✅ Successfully removed {result.success.length} player(s)
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="failed-section">
              <p className="warning">⚠️ Failed to remove {result.failed.length} player(s):</p>
              <ul>
                {result.failed.map(({ playerId, reason }) => (
                  <li key={playerId}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="actions">
        <button
          onClick={handleSubmit}
          disabled={loading || selectedPlayers.length === 0}
          className="btn-danger"
        >
          {loading ? 'Removing...' : `Remove ${selectedPlayers.length} Player(s)`}
        </button>
      </div>
    </div>
  );
}
```

---

### Change Captain Component

```tsx
import { useState } from 'react';
import { changeCaptain } from '../api/matches';

interface ChangeCaptainProps {
  matchId: string;
  teamId: 'team1' | 'team2';
  currentCaptain: Player;
  teamPlayers: MatchPlayer[];
  onSuccess: () => void;
}

export function ChangeCaptain({
  matchId,
  teamId,
  currentCaptain,
  teamPlayers,
  onSuccess
}: ChangeCaptainProps) {
  const [newCaptainId, setNewCaptainId] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter out current captain
  const eligiblePlayers = teamPlayers.filter(
    p => p.playerId._id !== currentCaptain._id
  );

  const handleSubmit = async () => {
    if (!newCaptainId) return;

    if (!confirm('Are you sure you want to change the captain? Both captains will be notified.')) {
      return;
    }

    setLoading(true);

    try {
      await changeCaptain(matchId, teamId, newCaptainId);
      alert('Captain changed successfully');
      onSuccess();
    } catch (error) {
      alert('Failed to change captain: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-captain-modal">
      <h3>Change Team Captain</h3>

      <div className="current-captain">
        <p><strong>Current Captain:</strong> {currentCaptain.name}</p>
      </div>

      <div className="info-box">
        ℹ️ Changing the captain will reset confirmation status for both the old and new captain.
        They will both receive notifications about this change.
      </div>

      <label className="form-label">
        Select New Captain:
        <select
          value={newCaptainId}
          onChange={(e) => setNewCaptainId(e.target.value)}
          className="form-select"
        >
          <option value="">-- Select Player --</option>
          {eligiblePlayers.map((player) => (
            <option key={player.playerId._id} value={player.playerId._id}>
              {player.playerName} ({player.confirmationStatus})
            </option>
          ))}
        </select>
      </label>

      <div className="actions">
        <button
          onClick={handleSubmit}
          disabled={loading || !newCaptainId}
          className="btn-primary"
        >
          {loading ? 'Changing...' : 'Change Captain'}
        </button>
      </div>
    </div>
  );
}
```

---

## API Service Functions

```typescript
// src/api/matches.ts

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export async function addPlayersToTeam(
  matchId: string,
  teamId: 'team1' | 'team2',
  playerIds: string[]
) {
  const response = await fetch(
    `${API_URL}/matches/${matchId}/teams/${teamId}/players/bulk`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ playerIds }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add players');
  }

  return response.json();
}

export async function removePlayersFromTeam(
  matchId: string,
  teamId: 'team1' | 'team2',
  playerIds: string[]
) {
  const response = await fetch(
    `${API_URL}/matches/${matchId}/teams/${teamId}/players/bulk`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ playerIds }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove players');
  }

  return response.json();
}

export async function changeCaptain(
  matchId: string,
  teamId: 'team1' | 'team2',
  captainId: string
) {
  const response = await fetch(
    `${API_URL}/matches/${matchId}/teams/${teamId}/captain`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ captainId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to change captain');
  }

  return response.json();
}
```

---

## WebSocket Real-Time Updates

Listen for roster management events:

```typescript
// Subscribe to match updates
socket.send(JSON.stringify({
  type: 'subscribe',
  data: { matchId: '...' }
}));

// Handle roster events
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'match:players_added':
      console.log('Players added:', message.data);
      // Refresh match data
      break;

    case 'match:players_removed':
      console.log('Players removed:', message.data);
      // Refresh match data
      break;

    case 'match:captain_changed':
      console.log('Captain changed:', message.data);
      // Refresh match data
      break;

    case 'match:updated':
      console.log('Match updated:', message.data);
      // General match update
      break;
  }
};
```

---

## Authorization Checking

Before showing roster management UI, check if user is authorized:

```typescript
function canModifyRoster(match: IMatch, currentUser: User): boolean {
  // Admin
  if (currentUser.role === 'admin') return true;

  // Organizer
  if (match.organizerId === currentUser._id) return true;

  // Team captain
  const isCaptain = match.teams.some(
    team => team.captain.playerId === currentUser._id
  );
  if (isCaptain) return true;

  // Club owner/co-owner
  if (match.involvedClubs.length > 0) {
    // Check if user is owner/co-owner of any involved club
    // (requires fetching club data)
    return checkClubOwnership(match.involvedClubs, currentUser._id);
  }

  return false;
}
```

---

## Match Status Display (Feature Flag Aware)

```tsx
function MatchStatusBadge({ match }: { match: IMatch }) {
  const getStatusDisplay = () => {
    switch (match.status) {
      case 'pending_captain_confirmation':
        return {
          label: 'Waiting for Captains',
          color: 'yellow',
          description: 'Both team captains need to confirm'
        };

      case 'pending_participants':
        return {
          label: 'Waiting for Players',
          color: 'yellow',
          description: 'Need 3+ confirmations per team'
        };

      case 'ready':
        return {
          label: 'Ready to Start',
          color: 'green',
          description: 'Match can be started by organizer'
        };

      case 'active':
        return {
          label: 'In Progress',
          color: 'blue',
          description: 'Match is currently active'
        };

      case 'completed':
        return {
          label: 'Completed',
          color: 'gray',
          description: 'Match has ended'
        };

      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'red',
          description: 'Match was cancelled'
        };

      default:
        return {
          label: match.status,
          color: 'gray',
          description: ''
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className={`status-badge status-${status.color}`}>
      <span className="status-label">{status.label}</span>
      {status.description && (
        <span className="status-description">{status.description}</span>
      )}
    </div>
  );
}
```

---

## Best Practices

1. **Always handle partial success** - Show clear feedback for both successful and failed operations
2. **Validate before submitting** - Check player limits (max 20) and authorization client-side
3. **Provide clear error messages** - Display human-readable reasons from API response
4. **Use optimistic updates** - Update UI immediately, rollback on error
5. **Listen for WebSocket events** - Keep match data fresh with real-time updates
6. **Handle captain confirmation** - Show warning before changing captain
7. **Disable invalid selections** - Don't let users select captains or confirmed players for removal
8. **Show status badges** - Clearly indicate player confirmation status and captain role
9. **Rate limit awareness** - Show loading states and disable buttons during operations
10. **Feature flag awareness** - Don't assume `pending_participants` status exists

---

## TypeScript Types

```typescript
interface MatchPlayer {
  playerId: {
    _id: string;
    name: string;
    email: string;
  };
  playerName: string;
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  confirmedAt?: Date;
  isCaptain?: boolean;
}

interface BulkOperationResponse {
  success: string[];
  failed: Array<{
    playerId: string;
    reason: string;
  }>;
  match: IMatch;
}

interface IMatch {
  _id: string;
  name: string;
  status: MatchStatus;
  organizerId: string;
  teams: Array<{
    teamId: 'team1' | 'team2';
    teamName: string;
    captain: {
      playerId: string;
      confirmationStatus: 'pending' | 'confirmed' | 'declined';
      promotedFrom?: 'auto' | 'manual' | 'original';
    };
    players: MatchPlayer[];
  }>;
  involvedClubs: string[];
  // ... other match fields
}
```

---

## Testing Checklist

- [ ] Add 1 player successfully
- [ ] Add 20 players successfully (max limit)
- [ ] Try adding 21 players (should fail validation)
- [ ] Add players with partial success (some invalid IDs)
- [ ] Remove players successfully
- [ ] Try removing captain (should fail)
- [ ] Try removing confirmed player (should fail)
- [ ] Change captain successfully
- [ ] Verify both captains receive notifications
- [ ] Test authorization (non-authorized user blocked)
- [ ] Test rate limiting (11th request blocked)
- [ ] Verify WebSocket updates received
- [ ] Test with feature flag ON and OFF
- [ ] Verify match status transitions correctly

---

## Support

For issues or questions:
- Check API logs: `/var/log/kite-fighter-api/`
- Review audit logs for roster operations
- Verify WebSocket connection status
- Check match status matches expected workflow
