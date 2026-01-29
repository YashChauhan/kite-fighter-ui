# Frontend Guide: Match Confirmation Workflow

## Overview

When a match is created between two clubs, it starts with **PENDING_CAPTAIN_CONFIRMATION** status. Both team captains must confirm their participation before the match can proceed.

## Match Status Flow

```
PENDING_CAPTAIN_CONFIRMATION
    ↓ (both captains confirm)
PENDING_PARTICIPANTS
    ↓ (all players confirm)
READY_TO_START
    ↓ (organizer starts)
ACTIVE
    ↓ (match completes)
COMPLETED
```

## 1. Creating a Match

### Endpoint
```
POST /api/v1/matches
```

### Headers
```
Authorization: Bearer <jwt_token>
```

### Request Body
```json
{
  "name": "Epic Battle",
  "description": "Championship match",
  "matchDate": "2026-01-30T18:00:00.000Z",
  "organizerId": "69759b32f81f442b742dcfa4",
  "team1": {
    "teamName": "Positive Vibes",
    "captainId": "69759b32f81f442b742dcfa4",
    "clubId": "6975ad62a0f3ab04c1cd0b11"
  },
  "team2": {
    "teamName": "Karma",
    "captainId": "6975b3c7f81f442b742dd06e",
    "clubId": "6975b3faa0f3ab04c1cd0b64"
  }
}
```

### Response (201 Created)
```json
{
  "_id": "69787de5fec7b7444cd04181",
  "name": "Epic Battle",
  "status": "pending_captain_confirmation",
  "teams": [
    {
      "teamId": "team1",
      "teamName": "Positive Vibes",
      "captain": {
        "playerId": "69759b32f81f442b742dcfa4",
        "confirmationStatus": "pending"
      },
      "players": [...]
    },
    {
      "teamId": "team2",
      "teamName": "Karma",
      "captain": {
        "playerId": "6975b3c7f81f442b742dd06e",
        "confirmationStatus": "pending"
      },
      "players": [...]
    }
  ]
}
```

### Important Notes
- If you provide `clubId`, **all approved club members are automatically added** to the team
- You don't need to provide `playerIds` when using `clubId`
- Captain must be a member of the specified club
- Match type is auto-determined:
  - `competitive`: Two different clubs
  - `training`: Same club or no clubs

## 2. Fetching Match Details

### Endpoint
```
GET /api/v1/matches/:matchId?populate=players,clubs
```

### Query Parameters
- `populate` (optional): Comma-separated fields to populate
  - `players` - Populates player details in teams
  - `clubs` - Populates club details
  - Example: `?populate=players,clubs`

### Response
```json
{
  "_id": "69787de5fec7b7444cd04181",
  "name": "Epic Battle",
  "status": "pending_captain_confirmation",
  "organizerId": {
    "_id": "69759b32f81f442b742dcfa4",
    "name": "Sumeet Verma",
    "email": "sum_verma@yahoo.co.in"
  },
  "teams": [
    {
      "teamName": "Positive Vibes",
      "clubId": {
        "_id": "6975ad62a0f3ab04c1cd0b11",
        "name": "Positive Vibes"
      },
      "captain": {
        "playerId": {
          "_id": "69759b32f81f442b742dcfa4",
          "name": "Sumeet Verma",
          "email": "sum_verma@yahoo.co.in"
        },
        "confirmationStatus": "pending",
        "confirmedAt": null
      },
      "players": [
        {
          "playerId": {
            "_id": "69759b32f81f442b742dcfa4",
            "name": "Sumeet Verma",
            "email": "sum_verma@yahoo.co.in"
          },
          "playerName": "Sumeet Verma",
          "confirmationStatus": "pending",
          "enteringStreak": 0
        }
        // ... more players
      ]
    }
    // team2 ...
  ]
}
```

## 3. Captain Confirmation

### Endpoint
```
PATCH /api/v1/matches/:matchId/confirm-participation
```

### Headers
```
Authorization: Bearer <captain_jwt_token>
```

### Request Body
```json
{
  "playerId": "69759b32f81f442b742dcfa4"
}
```

### Response (200 OK)
```json
{
  "_id": "69787de5fec7b7444cd04181",
  "status": "pending_captain_confirmation",
  "teams": [
    {
      "captain": {
        "confirmationStatus": "confirmed",
        "confirmedAt": "2026-01-27T12:00:00.000Z"
      }
    }
  ]
}
```

### What Happens
1. Captain calls this endpoint with their `playerId`
2. Their `confirmationStatus` changes from `pending` → `confirmed`
3. When **BOTH captains confirm**, match status changes to `pending_participants`
4. System may auto-promote a new captain if original captain doesn't confirm

## 3.1 Captain Decline

### Endpoint
```
PATCH /api/v1/matches/:matchId/decline-participation
```

### Headers
```
Authorization: Bearer <captain_jwt_token>
```

### Request Body
```json
{
  "playerId": "69759b32f81f442b742dcfa4",
  "reason": "Not available on this date"
}
```

### Response (200 OK)
```json
{
  "_id": "69787de5fec7b7444cd04181",
  "status": "pending_captain_confirmation",
  "teams": [
    {
      "captain": {
        "confirmationStatus": "declined",
        "confirmedAt": "2026-01-27T12:00:00.000Z"
      }
    }
  ]
}
```

### Expected Behavior
1. Captain's `confirmationStatus` changes to `declined`
2. System auto-promotes next available pending player as captain
3. New captain gets notification (WebSocket update)
4. If no one available, match status changes to `cancelled`
5. Organizer can see the cancellation reason in match details

### Auto-Promotion Logic
- Finds first player with `confirmationStatus: "pending"` in the team
- Promotes them to captain automatically
- Sets their `promotedFrom: "auto"`
- New captain status is `pending` (they need to confirm)

### Match Cancellation
- If no pending players available for promotion → match cancelled
- `cancellationReason` set to "Captain declined and no replacement available"

## 3.2 Player Confirmation Notification

### Automatic Notification on Confirmation

When any player (captain or regular participant) confirms their participation, they automatically receive a confirmation notification via email.

### What Gets Sent

**Email Subject:** ✅ Match Participation Confirmed

**Email Content Includes:**
- Match name
- Player's role (Captain or Participant)
- Match date and time
- Direct link to view match details
- Confirmation message

### Email Template Example

```
✅ Match Confirmed!

Hi [Player Name],

You have successfully confirmed your participation in the match!

Match: [Match Name]
Your Role: [Captain/Participant]
Date: [Match Date]

Get ready to compete! We'll notify you when all participants have confirmed 
and the match is ready to begin.

[View Match Details Button]

Good luck and fly high! 🪁
```

### Notification Trigger Points

1. **Captain Confirms:**
   - Receives email with role "Captain"
   - Includes leadership responsibilities reminder

2. **Regular Player Confirms:**
   - Receives email with role "Participant"
   - Includes team support message

3. **Auto-Promoted Captain Confirms:**
   - Receives email with role "Captain"
   - Same notification as original captain

### Notification Behavior

- **Sent To:** Player's registered email address
- **Timing:** Immediately after successful confirmation API call
- **Failure Handling:** If email fails, confirmation still succeeds (logged for admin review)
- **Queue System:** Uses exponential backoff retry (max 3 attempts)
- **Email Provider:** AWS SES (when enabled)

### Testing Confirmation Notifications

1. **Confirm Participation:**
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/matches/:matchId/confirm-participation \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"playerId": "player123"}'
   ```

2. **Check Email:**
   - Look for email at registered player address
   - Subject line: "✅ Match Participation Confirmed"

3. **Verify Notification Queue:**
   ```bash
   # Check notification queue in database
   db.notificationqueues.find({ eventType: "PARTICIPANT_CONFIRMED" })
   ```

### Frontend Integration

Display confirmation success message after API call:

```tsx
const confirmParticipation = async () => {
  try {
    const response = await axios.patch(
      `/api/v1/matches/${matchId}/confirm-participation`,
      { playerId: currentUserId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    // Show success notification
    toast.success(
      '✅ Participation confirmed! Check your email for details.',
      { duration: 5000 }
    );
    
    setMatch(response.data);
  } catch (error) {
    toast.error('Failed to confirm participation');
  }
};
```

### Notification Settings

Controlled via environment variables:
- `EMAIL_ENABLED=true` - Enables email notifications
- `AWS_SES_FROM_EMAIL` - Sender email address
- `AWS_SES_FROM_NAME` - Display name ("Kite Fighter")

### Notification Event Type

```typescript
// Event type in system
NotificationEventType.PARTICIPANT_CONFIRMED = 'PARTICIPANT_CONFIRMED'

// Payload structure
{
  resourceId: matchId,
  resourceType: 'match',
  name: matchName,
  email: playerEmail,
  metadata: {
    participantId: playerId,
    participantName: playerName,
    matchDate: matchDate,
    isCaptain: true/false
  }
}
```

### Troubleshooting

**Email Not Received?**
1. Check spam/junk folder
2. Verify `EMAIL_ENABLED=true` in environment
3. Check AWS SES credentials are configured
4. Review notification queue for failed attempts
5. Check player's email address is valid

**Notification Failed But Confirmation Succeeded?**
- This is expected behavior
- Confirmation is atomic and won't fail if email fails
- Admin can view failed notifications in audit logs

## 4. Checking Confirmation Status

### UI Implementation Example

```typescript
interface Match {
  _id: string;
  name: string;
  status: 'pending_captain_confirmation' | 'pending_participants' | 'ready_to_start' | 'active' | 'completed';
  teams: Team[];
}

interface Team {
  teamName: string;
  captain: {
    playerId: { _id: string; name: string };
    confirmationStatus: 'pending' | 'confirmed';
    confirmedAt: string | null;
  };
  players: Player[];
}

// Check if current user is a captain
function isUserCaptain(match: Match, userId: string): boolean {
  return match.teams.some(team => 
    team.captain.playerId._id === userId
  );
}

// Check if user has confirmed
function hasUserConfirmed(match: Match, userId: string): boolean {
  const team = match.teams.find(team => 
    team.captain.playerId._id === userId
  );
  return team?.captain.confirmationStatus === 'confirmed';
}

// Check if both captains confirmed
function areBothCaptainsConfirmed(match: Match): boolean {
  return match.teams.every(team => 
    team.captain.confirmationStatus === 'confirmed'
  );
}
```

### Display Logic

```typescript
function getMatchStatusDisplay(match: Match, currentUserId: string) {
  if (match.status === 'pending_captain_confirmation') {
    const isCaptain = isUserCaptain(match, currentUserId);
    const hasConfirmed = hasUserConfirmed(match, currentUserId);
    
    if (isCaptain && !hasConfirmed) {
      return {
        message: '⏳ Waiting for your confirmation',
        action: 'CONFIRM_BUTTON',
        variant: 'warning'
      };
    }
    
    if (isCaptain && hasConfirmed) {
      return {
        message: '✅ You confirmed. Waiting for other captain...',
        action: 'NONE',
        variant: 'success'
      };
    }
    
    return {
      message: '⏳ Waiting for captains to confirm',
      action: 'NONE',
      variant: 'info'
    };
  }
  
  // Handle other statuses...
}
```

## 5. WebSocket Real-Time Updates

Subscribe to match updates for real-time confirmation status changes.

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws');

ws.onopen = () => {
  // Subscribe to specific match
  ws.send(JSON.stringify({
    type: 'subscribe',
    matchId: '69787de5fec7b7444cd04181'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'match_updated':
      // Update UI with new match data
      updateMatchDisplay(message.data.match);
      break;
      
    case 'match_started':
      // Navigate to active match view
      router.push(`/matches/${message.matchId}/live`);
      break;
  }
};
```

## 6. Complete React Component Example

```tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface MatchConfirmationProps {
  matchId: string;
  currentUserId: string;
  authToken: string;
}

export const MatchConfirmation: React.FC<MatchConfirmationProps> = ({
  matchId,
  currentUserId,
  authToken
}) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const fetchMatch = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/v1/matches/${matchId}?populate=players,clubs`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      setMatch(response.data);
    } catch (error) {
      console.error('Failed to fetch match:', error);
    }
  };

  const confirmParticipation = async () => {
    setLoading(true);
    try {
      const response = await axios.patch(
        `http://localhost:3000/api/v1/matches/${matchId}/confirm-participation`,
        { playerId: currentUserId },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      setMatch(response.data);
    } catch (error) {
      console.error('Failed to confirm:', error);
      alert('Failed to confirm participation');
    } finally {
      setLoading(false);
    }
  };

  const declineParticipation = async () => {
    const reason = window.prompt('Optional: Provide a reason for declining');
    
    setLoading(true);
    try {
      const response = await axios.patch(
        `http://localhost:3000/api/v1/matches/${matchId}/decline-participation`,
        { 
          playerId: currentUserId,
          reason: reason || undefined,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      setMatch(response.data);
      
      // Show feedback based on result
      if (response.data.status === 'cancelled') {
        alert('Match has been cancelled as no replacement captain was available');
      } else {
        alert('You have declined. A new captain has been assigned.');
      }
    } catch (error) {
      console.error('Failed to decline:', error);
      alert('Failed to decline participation');
    } finally {
      setLoading(false);
    }
  };

  if (!match) return <div>Loading...</div>;

  const isCaptain = match.teams.some(t => t.captain.playerId._id === currentUserId);
  const hasConfirmed = match.teams.find(t => t.captain.playerId._id === currentUserId)
    ?.captain.confirmationStatus === 'confirmed';
  const bothConfirmed = match.teams.every(t => t.captain.confirmationStatus === 'confirmed');

  return (
    <div className="match-confirmation">
      <h2>{match.name}</h2>
      <p>Status: {match.status}</p>

      <div className="teams">
        {match.teams.map((team, index) => (
          <div key={index} className="team">
            <h3>{team.teamName}</h3>
            <p>
              Captain: {team.captain.playerId.name}
              {team.captain.confirmationStatus === 'confirmed' ? ' ✅' : ' ⏳'}
            </p>
            <p>{team.players.length} players</p>
          </div>
        ))}
      </div>

      {match.status === 'pending_captain_confirmation' && (
        <div className="confirmation-status">
          {isCaptain && !hasConfirmed && (
            <div className="action-buttons">
              <button 
                onClick={confirmParticipation}
                disabled={loading}
                className="btn-confirm"
              >
                {loading ? 'Confirming...' : 'Confirm Participation'}
              </button>
              
              <button 
                onClick={declineParticipation}
                disabled={loading}
                className="btn-decline"
              >
                {loading ? 'Declining...' : 'Decline'}
              </button>
            </div>
          )}

          {isCaptain && hasConfirmed && (
            <p className="success">✅ You've confirmed. Waiting for other captain...</p>
          )}

          {!isCaptain && (
            <p className="info">⏳ Waiting for captains to confirm</p>
          )}

          {bothConfirmed && (
            <p className="success">✅ Both captains confirmed! Match is ready.</p>
          )}
        </div>
      )}
    </div>
  );
};
```

## 7. Error Handling

### Common Errors

```typescript
try {
  await confirmParticipation();
} catch (error) {
  if (error.response?.status === 400) {
    // Already confirmed or not a captain
    alert(error.response.data.message);
  } else if (error.response?.status === 404) {
    // Match not found
    alert('Match not found');
  } else if (error.response?.status === 401) {
    // Not authenticated
    redirectToLogin();
  }
}
```

## 8. Notification Handling

### Match-Related Notifications

Players receive various notifications throughout the match lifecycle:

#### 1. Captain Assignment
**Trigger:** When match is created and captain is assigned

**Email Notification:**
- Subject: "🎯 You've been assigned as team captain"
- Contains: Match name, team name, confirmation link
- Event Type: `CAPTAIN_ASSIGNED`

#### 2. Participant Invitation
**Trigger:** When player is added to match team

**Email Notification:**
- Subject: "🎯 You're invited to a match"
- Contains: Match details, team name, date
- Event Type: `PARTICIPANT_INVITED`

#### 3. Confirmation Received (NEW ✨)
**Trigger:** When player confirms participation

**Email Notification:**
- Subject: "✅ Match Participation Confirmed"
- Contains: 
  - Match name and date
  - Player's role (Captain/Participant)
  - Link to view match details
  - Motivational message
- Event Type: `PARTICIPANT_CONFIRMED`

**Example:**
```
✅ Match Confirmed!

Hi Sumeet Verma,

You have successfully confirmed your participation in the match!

Match: Epic Battle
Your Role: Captain
Date: January 30, 2026 at 6:00 PM

Get ready to compete! We'll notify you when all participants 
have confirmed and the match is ready to begin.

[View Match Details]

Good luck and fly high! 🪁
```

#### 4. Captain Auto-Promoted
**Trigger:** When captain declines and player is promoted

**Email Notification:**
- Subject: "🎯 You've been promoted to team captain"
- Contains: Match details, reason for promotion, confirmation required
- Event Type: `CAPTAIN_AUTO_PROMOTED`

#### 5. Match Starting
**Trigger:** When all confirmations received and match begins

**Email Notification:**
- Subject: "🚀 Match is starting now!"
- Contains: Match details, team lineup
- Event Type: `MATCH_STARTING`

#### 6. Match Completed
**Trigger:** When match finishes

**Email Notification:**
- Subject: "🏆 Match completed"
- Contains: Final results, winning team, statistics
- Event Type: `MATCH_COMPLETED`

### Notification Event Types

```typescript
enum NotificationEventType {
  // Match creation & assignment
  CAPTAIN_ASSIGNED = 'CAPTAIN_ASSIGNED',
  CAPTAIN_DECLINED = 'CAPTAIN_DECLINED',
  CAPTAIN_AUTO_PROMOTED = 'CAPTAIN_AUTO_PROMOTED',
  PARTICIPANT_INVITED = 'PARTICIPANT_INVITED',
  
  // Match confirmation (NEW ✨)
  PARTICIPANT_CONFIRMED = 'PARTICIPANT_CONFIRMED',
  
  // Match lifecycle
  MATCH_STARTING = 'MATCH_STARTING',
  MATCH_COMPLETED = 'MATCH_COMPLETED',
  MATCH_CANCELLED = 'MATCH_CANCELLED',
  
  // Match results
  MATCH_WINNER_DECLARED = 'MATCH_WINNER_DECLARED',
  MATCH_RESULT_DISPUTED = 'MATCH_RESULT_DISPUTED',
  MATCH_RECONFIRMATION_REQUESTED = 'MATCH_RECONFIRMATION_REQUESTED',
}
```

### In-App Notification Polling

Poll for notifications or use WebSocket:

```typescript
// Fetch notifications
GET /api/v1/notifications

// Filter for specific event types
const matchNotifications = notifications.filter(n => 
  ['CAPTAIN_ASSIGNED', 'PARTICIPANT_CONFIRMED', 'MATCH_STARTING'].includes(n.eventType)
);
```

### Real-Time Notification Updates

Use WebSocket for instant notification delivery:

```typescript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'notification') {
    showToast(message.data.title, message.data.message);
  }
};
```

## 9. Best Practices

1. **Show clear status**: Display confirmation status prominently
2. **Disable buttons**: Prevent double-submissions during loading
3. **Real-time updates**: Use WebSocket for instant status changes
4. **Error feedback**: Show clear error messages
5. **Optimistic updates**: Show loading states immediately
6. **Validate permissions**: Check if user is captain before showing buttons
7. **Mobile friendly**: Make confirmation button prominent on mobile

## 10. API Reference Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/matches` | POST | Create match | ✅ Available |
| `/api/v1/matches/:id` | GET | Get match details | ✅ Available |
| `/api/v1/matches/:id/confirm-participation` | PATCH | Captain confirms | ✅ Available |
| `/api/v1/matches/:id/decline-participation` | PATCH | Captain declines | ✅ Available |
| `/api/v1/matches/:id/start` | POST | Start match | ✅ Available |
| `/api/v1/ws` | WebSocket | Real-time updates | ✅ Available |

## 11. Testing Checklist

### Match Creation & Confirmation
- [ ] Create match with two clubs
- [ ] Verify both captains see pending status
- [ ] Captain 1 confirms → status updates
- [ ] Captain 2 confirms → match status changes to `pending_participants`
- [ ] Captain declines → next player promoted to captain
- [ ] New captain receives pending status
- [ ] If no players available → match cancelled
- [ ] Non-captain cannot confirm/decline
- [ ] Already confirmed captain cannot decline
- [ ] WebSocket updates work in real-time
- [ ] Match shows all club players (not just captains)
- [ ] Populated data includes player names and emails

### Notification Testing (NEW ✨)
- [ ] Captain confirms → receives confirmation email
- [ ] Email subject: "✅ Match Participation Confirmed"
- [ ] Email shows role as "Captain"
- [ ] Email includes match name and date
- [ ] Email includes "View Match Details" link
- [ ] Regular player confirms → receives confirmation email
- [ ] Email shows role as "Participant"
- [ ] Auto-promoted captain confirms → receives captain confirmation
- [ ] Notification appears in notification queue
- [ ] Failed emails are logged (don't break confirmation)
- [ ] Email retry logic works (max 3 attempts)
- [ ] Check spam/junk folder if email not received
- [ ] Verify AWS SES credentials if emails not sending
- [ ] Test with EMAIL_ENABLED=false → no emails sent
- [ ] Test with EMAIL_ENABLED=true → emails sent successfully

## 12. Known Limitations & Workarounds

### ⚠️ No Captain Change After Creation
**Problem:** Cannot manually change captain after match is created.

**Current Workaround:**
- System will auto-promote if captain declines
- Or cancel and recreate the match

### ⚠️ No Edit Match
**Problem:** Cannot edit match details (date, teams) after creation.

**Current Workaround:**
- Must cancel and recreate the match

## Support

For questions or issues, check:
- [API Documentation](./API_DOCUMENTATION.md)
- [WebSocket Guide](./WEBSOCKET_IMPLEMENTATION.md)
- [Authentication Guide](./AUTHENTICATION_GUIDE.md)
