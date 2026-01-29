# Frontend Match Result Declaration Guide

## Overview
This guide covers the **Match Result Declaration** feature, which allows team captains to declare the winning team after all fights are completed. The system requires both captains to agree on the winner before the match is finalized.

### **🎯 Key Features:**
- ✅ **Captain-only declaration** - Only team captains can declare winners
- ✅ **Two-captain approval** - Both captains must agree on the winner
- ✅ **Two-round confirmation** - If captains disagree, they get a second chance
- ✅ **Automatic stats update** - Club stats updated for competitive matches
- ✅ **Dispute resolution** - Admin can resolve if captains can't agree

---

## 🎯 The Issue You're Facing

### **❌ Your Request (Incorrect)**
```json
{
  "winner": "team1"
}
```

### **✅ Correct Request**
```json
{
  "captainId": "697xxxxxxxxxxxxxxxx",  // ← Missing field! (Captain's ID)
  "winningTeamId": "team1",             // ← Wrong field name (not "winner")
  "confirmationRound": 1                // ← Optional (defaults to 1)
}
```

### **Key Differences:**
1. **Missing `captainId`** - Must be the ID of the captain declaring the result
2. **Wrong field name** - Should be `winningTeamId`, not `winner`
3. **Team ID format** - Use the actual `teamId` from the match (e.g., "team1", "team2")

---

## 📡 API Endpoint

### **Declare Match Winner**
```
POST /api/v1/matches/:id/result/declare
```

**Purpose**: Allows team captains to declare the winning team. Both captains must agree before the match is completed.

---

## 🔐 Authentication
**Current Implementation**: No authentication middleware at route level. The `captainId` is validated to ensure they are a captain in the match.

---

## 📥 Request Format

### **URL Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | ✅ Yes | Match ID (24-char MongoDB ObjectId) |

### **Request Body**
```typescript
{
  captainId: string;         // Captain's player ID - REQUIRED
  winningTeamId: string;     // Team ID (e.g., "team1", "team2") - REQUIRED
  confirmationRound?: number; // 1 or 2 (default: 1) - OPTIONAL
}
```

### **Complete Example**
```javascript
const declareMatchWinner = async (matchId, captainId, winningTeamId) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/matches/${matchId}/result/declare`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        captainId: captainId,
        winningTeamId: winningTeamId,  // "team1" or "team2"
        confirmationRound: 1           // Optional, defaults to 1
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
};

// Usage
await declareMatchWinner(
  '69787de5fec7b7444cd04181',  // Match ID
  '697xxxxxxxxxxxxxxxx',        // Current captain's ID
  'team1'                        // Winning team ID
);
```

---

## 📤 Response Format

### **Success Response (200)**
```typescript
{
  _id: string;
  name: string;
  status: 'active' | 'completed';  // Changes to 'completed' when both agree
  teams: [
    {
      teamId: string;          // e.g., "team1"
      teamName: string;
      captain: {...};
      players: [...];
    }
  ];
  matchResult: {
    status: 'pending' | 'agreed' | 'disputed';
    winningTeamId?: string;    // Set when both captains agree
    declarations: [
      {
        captainId: string;
        teamId: string;
        declaredWinner: string;  // The team ID they declared as winner
        declaredAt: string;
        confirmationRound: 1 | 2;
      }
    ];
    finalizedAt?: string;      // When match was completed
  };
  createdAt: string;
  updatedAt: string;
}
```

### **Error Responses**

#### **400 - Missing Required Field**
```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body must have required property 'captainId'"
}
```

#### **404 - Match Not Found**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "code": "NOT_FOUND",
  "message": "Match not found or not active"
}
```

#### **400 - Not a Captain**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Only team captains can declare winner"
}
```

#### **400 - Invalid Team**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Invalid winning team"
}
```

---

## 🎯 Pre-Declaration Validations

### **Client-Side Checks**
```javascript
function canDeclareWinner(match, currentUserId) {
  // 1. Match must be active
  if (match.status !== 'active') {
    return {
      allowed: false,
      reason: 'Match must be active to declare winner'
    };
  }

  // 2. Must be a team captain
  const isCaptain = match.teams.some(
    team => team.captain.playerId === currentUserId
  );

  if (!isCaptain) {
    return {
      allowed: false,
      reason: 'Only team captains can declare the winner'
    };
  }

  // 3. Check if captain already declared in current round
  const currentRound = getCurrentConfirmationRound(match);
  const alreadyDeclared = match.matchResult.declarations.some(
    d => d.captainId === currentUserId && d.confirmationRound === currentRound
  );

  if (alreadyDeclared) {
    return {
      allowed: false,
      reason: `You have already declared the winner for round ${currentRound}`
    };
  }

  return { allowed: true, currentRound };
}

function getCurrentConfirmationRound(match) {
  // If there are already 2 declarations in round 1 and they disagreed
  const round1Declarations = match.matchResult.declarations.filter(
    d => d.confirmationRound === 1
  );

  if (round1Declarations.length === 2) {
    const disagreed = round1Declarations[0].declaredWinner !== 
                      round1Declarations[1].declaredWinner;
    return disagreed ? 2 : 1;
  }

  return 1;
}
```

---

## 🔄 Declaration Workflow

### **Two-Round Confirmation Process**

```
Round 1:
--------
Captain 1 declares → Still pending
Captain 2 declares
    ↓
  ┌─────────────┐
  │   Match?    │
  └─────────────┘
    ↙        ↘
  Agree     Disagree
    ↓          ↓
 Match      Round 2
Completed   Required
    ↓          ↓
Update     Captain 1 declares
 Stats     Captain 2 declares
              ↓
          ┌─────────────┐
          │   Match?    │
          └─────────────┘
            ↙        ↘
          Agree     Disagree
            ↓          ↓
          Match     Admin
        Completed   Review
```

---

## 🎨 React Implementation

### **Match Result Declaration Component**
```jsx
import { useState, useEffect } from 'react';

function MatchResultDeclaration({ match, currentUserId }) {
  const [selectedWinner, setSelectedWinner] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if current user is a captain
  const myCaptainTeam = match.teams.find(
    team => team.captain.playerId === currentUserId
  );
  const isCaptain = !!myCaptainTeam;

  // Get current confirmation round
  const currentRound = getCurrentConfirmationRound(match);

  // Check if user already declared in current round
  const myDeclaration = match.matchResult.declarations.find(
    d => d.captainId === currentUserId && d.confirmationRound === currentRound
  );
  const hasAlreadyDeclared = !!myDeclaration;

  // Get other captain's declaration in current round
  const otherDeclaration = match.matchResult.declarations.find(
    d => d.captainId !== currentUserId && d.confirmationRound === currentRound
  );

  const handleDeclare = async () => {
    if (!selectedWinner) {
      setError('Please select the winning team');
      return;
    }

    const validation = canDeclareWinner(match, currentUserId);
    if (!validation.allowed) {
      setError(validation.reason);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/matches/${match._id}/result/declare`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            captainId: currentUserId,
            winningTeamId: selectedWinner,
            confirmationRound: currentRound
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const updatedMatch = await response.json();

      // Check if match is completed
      if (updatedMatch.status === 'completed') {
        showNotification({
          type: 'success',
          message: '🎉 Match completed! Both captains agreed on the winner.'
        });
        onMatchCompleted?.(updatedMatch);
      } else if (updatedMatch.matchResult.status === 'disputed') {
        showNotification({
          type: 'warning',
          message: currentRound === 1 
            ? '⚠️ Captains disagreed. Please confirm again in Round 2.'
            : '⚠️ Still disagreed. Match sent for admin review.'
        });
      } else {
        showNotification({
          type: 'info',
          message: '✅ Your declaration recorded. Waiting for other captain.'
        });
      }

      onDeclarationMade?.(updatedMatch);

    } catch (error) {
      setError(error.message || 'Failed to declare winner');
    } finally {
      setLoading(false);
    }
  };

  if (!isCaptain) {
    return (
      <div className="result-status">
        <p>Waiting for captains to declare the match winner...</p>
        {renderDeclarationStatus()}
      </div>
    );
  }

  if (hasAlreadyDeclared) {
    return (
      <div className="result-declared">
        <h3>Your Declaration (Round {currentRound})</h3>
        <div className="declaration-card">
          <p>
            You declared: <strong>{getTeamName(match, myDeclaration.declaredWinner)}</strong>
          </p>
          <small>Declared at: {new Date(myDeclaration.declaredAt).toLocaleString()}</small>
        </div>

        {otherDeclaration ? (
          <div className="other-declaration">
            <p>
              Other captain declared: <strong>{getTeamName(match, otherDeclaration.declaredWinner)}</strong>
            </p>
            {myDeclaration.declaredWinner !== otherDeclaration.declaredWinner && (
              <div className="disagreement-notice">
                ⚠️ Captains disagreed. {currentRound === 1 ? 'Moving to Round 2...' : 'Admin review required.'}
              </div>
            )}
          </div>
        ) : (
          <div className="waiting-other">
            ⏳ Waiting for other captain to declare...
          </div>
        )}

        {renderDeclarationStatus()}
      </div>
    );
  }

  return (
    <div className="declare-winner-form">
      <h3>Declare Match Winner {currentRound > 1 && `(Round ${currentRound})`}</h3>

      {currentRound > 1 && (
        <div className="round-2-notice">
          ⚠️ Round 2: Captains disagreed in Round 1. Please confirm the winner.
        </div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      <div className="team-selection">
        <h4>Select Winning Team:</h4>
        {match.teams.map(team => {
          const isMyTeam = team.teamId === myCaptainTeam?.teamId;
          
          return (
            <button
              key={team.teamId}
              type="button"
              className={`team-card ${selectedWinner === team.teamId ? 'selected' : ''}`}
              onClick={() => setSelectedWinner(team.teamId)}
            >
              <div className="team-header">
                <h5>{team.teamName}</h5>
                {isMyTeam && <span className="my-team-badge">Your Team</span>}
              </div>
              
              <div className="team-stats">
                <p>Captain: {team.captain.playerName || 'TBD'}</p>
                <p>Players: {team.players.filter(p => p.confirmationStatus === 'confirmed').length}</p>
              </div>

              {selectedWinner === team.teamId && (
                <div className="selected-indicator">✓ Selected</div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleDeclare}
        disabled={loading || !selectedWinner}
        className="declare-btn"
      >
        {loading ? 'Declaring...' : `Declare ${selectedWinner ? getTeamName(match, selectedWinner) : 'Winner'}`}
      </button>

      {renderDeclarationStatus()}
    </div>
  );

  function renderDeclarationStatus() {
    const round1Declarations = match.matchResult.declarations.filter(
      d => d.confirmationRound === 1
    );
    const round2Declarations = match.matchResult.declarations.filter(
      d => d.confirmationRound === 2
    );

    return (
      <div className="declarations-history">
        <h4>Declaration History</h4>
        
        {round1Declarations.length > 0 && (
          <div className="round-section">
            <h5>Round 1</h5>
            {round1Declarations.map((decl, idx) => (
              <div key={idx} className="declaration-item">
                <span>{getTeamName(match, decl.teamId)}'s Captain</span>
                <span>→</span>
                <span>{getTeamName(match, decl.declaredWinner)}</span>
              </div>
            ))}
            {round1Declarations.length === 2 && 
             round1Declarations[0].declaredWinner !== round1Declarations[1].declaredWinner && (
              <div className="disagreement-badge">❌ Disagreed</div>
            )}
          </div>
        )}

        {round2Declarations.length > 0 && (
          <div className="round-section">
            <h5>Round 2</h5>
            {round2Declarations.map((decl, idx) => (
              <div key={idx} className="declaration-item">
                <span>{getTeamName(match, decl.teamId)}'s Captain</span>
                <span>→</span>
                <span>{getTeamName(match, decl.declaredWinner)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

// Helper function
function getTeamName(match, teamId) {
  const team = match.teams.find(t => t.teamId === teamId);
  return team?.teamName || teamId;
}
```

---

## 📊 Match Result States

### **Result Status Enum**
```typescript
enum MatchResultStatus {
  PENDING = 'pending',      // No declarations yet or waiting for second captain
  AGREED = 'agreed',        // Both captains agreed
  DISPUTED = 'disputed',    // Captains disagreed
  RESOLVED = 'resolved'     // Admin resolved dispute
}
```

### **Match Status Transitions**
```typescript
ACTIVE → COMPLETED     // When both captains agree
ACTIVE → ACTIVE        // Still active during disagreement
COMPLETED → COMPLETED  // Final state
```

---

## 🔔 WebSocket Integration

### **Listen for Match Result Events**
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'MATCH_UPDATED':
      // Check if result was declared
      if (message.data.match.matchResult.declarations.length > 0) {
        handleResultDeclared(message.data.match);
      }
      break;

    case 'MATCH_COMPLETED':
      // Both captains agreed
      showNotification({
        type: 'success',
        message: '🎉 Match completed! Winner declared.'
      });
      handleMatchCompleted(message.data.match);
      break;
  }
};
```

---

## 📝 TypeScript Interfaces

```typescript
interface DeclareWinnerRequest {
  captainId: string;
  winningTeamId: string;
  confirmationRound?: number;
}

interface MatchResult {
  status: 'pending' | 'agreed' | 'disputed' | 'resolved';
  winningTeamId?: string;
  declarations: ResultDeclaration[];
  finalizedAt?: string;
}

interface ResultDeclaration {
  captainId: string;
  teamId: string;
  declaredWinner: string;  // teamId of the declared winner
  declaredAt: string;
  confirmationRound: 1 | 2;
}
```

---

## 🚨 Error Handling

### **Comprehensive Error Handler**
```javascript
async function declareWinnerWithErrorHandling(matchId, captainId, winningTeamId) {
  try {
    // Validate required fields
    if (!captainId) {
      throw new Error('Captain ID is required');
    }
    if (!winningTeamId) {
      throw new Error('Winning team ID is required');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/matches/${matchId}/result/declare`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainId,
          winningTeamId,
          confirmationRound: getCurrentConfirmationRound(match)
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      
      switch (error.statusCode) {
        case 400:
          if (error.code === 'FST_ERR_VALIDATION') {
            showError('Invalid request. Please check all fields.');
          } else if (error.message.includes('Only team captains')) {
            showError('Only team captains can declare the winner');
          } else if (error.message.includes('Invalid winning team')) {
            showError('Please select a valid team');
          }
          break;
          
        case 404:
          showError('Match not found or is no longer active');
          break;
          
        case 429:
          showError('Too many requests. Please wait and try again.');
          break;
          
        default:
          showError('Failed to declare winner. Please try again.');
      }
      
      throw new Error(error.message);
    }

    return await response.json();

  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      showError('Network error. Please check your connection.');
    }
    throw error;
  }
}
```

---

## 📋 State Management

### **Redux Example**
```javascript
// Action
export const declareMatchWinner = (matchId, captainId, winningTeamId, round) => async (dispatch) => {
  dispatch({ type: 'DECLARE_WINNER_REQUEST', payload: { matchId } });
  
  try {
    const response = await api.post(`/matches/${matchId}/result/declare`, {
      captainId,
      winningTeamId,
      confirmationRound: round
    });
    
    dispatch({
      type: 'DECLARE_WINNER_SUCCESS',
      payload: response.data
    });
    
    return response.data;
  } catch (error) {
    dispatch({
      type: 'DECLARE_WINNER_FAILURE',
      payload: error.response?.data || { message: error.message }
    });
    
    throw error;
  }
};

// Reducer
const matchReducer = (state, action) => {
  switch (action.type) {
    case 'DECLARE_WINNER_SUCCESS':
      return {
        ...state,
        currentMatch: action.payload,
        matches: state.matches.map(m =>
          m._id === action.payload._id ? action.payload : m
        )
      };
      
    default:
      return state;
  }
};
```

---

## 🔍 Common Issues & Solutions

### **Issue 1: "body must have required property 'captainId'"**
**Solution**: Include `captainId` in the request body (the ID of the current captain).

### **Issue 2: Wrong field name ("winner" instead of "winningTeamId")**
**Solution**: Use `winningTeamId`, not `winner`.

### **Issue 3: "Only team captains can declare winner"**
**Solution**: Verify the `captainId` matches one of the team captains in the match.

### **Issue 4: "Invalid winning team"**
**Solution**: Use the actual `teamId` from the match (e.g., "team1", "team2").

### **Issue 5: Captain already declared**
**Solution**: Check `match.matchResult.declarations` to see if captain already declared in current round.

---

## 🧪 Testing Checklist

### **Unit Tests**
- [ ] Field validation (required fields)
- [ ] Captain validation
- [ ] Team ID validation
- [ ] Round progression logic

### **Integration Tests**
- [ ] Successful declaration (both agree)
- [ ] Disagreement handling (round 1 → round 2)
- [ ] Persistent disagreement (admin review)
- [ ] Non-captain attempt error
- [ ] Match not active error

### **E2E Tests**
- [ ] Complete declaration flow
- [ ] Two-round confirmation
- [ ] WebSocket event reception
- [ ] Stats update for competitive matches

---

## 📞 Quick Reference

### **Correct Request Format**
```bash
curl -X POST http://localhost:3000/api/v1/matches/69787de5fec7b7444cd04181/result/declare \
  -H "Content-Type: application/json" \
  -d '{
    "captainId": "697xxxxxxxxxxxxxxxx",
    "winningTeamId": "team1",
    "confirmationRound": 1
  }'
```

### **Valid Team IDs**
- ✅ `"team1"` - First team in the match
- ✅ `"team2"` - Second team in the match
- ❌ `"winner"` - Invalid field name!

### **Confirmation Rounds**
- `1` - First attempt (default)
- `2` - Second attempt if round 1 disagreed

---

## 🔗 Related Documentation
- [Match Start Guide](./FRONTEND_MATCH_START_GUIDE.md)
- [Fight Reporting Guide](./FRONTEND_FIGHT_REPORTING_GUIDE.md)
- [WebSocket Implementation](./WEBSOCKET_IMPLEMENTATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
