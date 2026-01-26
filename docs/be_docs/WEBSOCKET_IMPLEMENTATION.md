# WebSocket Implementation for Kite Fighter API

## Overview
Real-time WebSocket support has been added to the Kite Fighter API using `@fastify/websocket`. This enables live updates for matches and fights, allowing clients to receive instant notifications without polling.

## Features

### WebSocket Endpoint
- **URL**: `ws://localhost:3000/api/v1/ws/matches`
- **Authentication**: Optional JWT token via query parameter
- **Protocol**: Native WebSocket (RFC 6455)

### Message Types

#### Connection Events
- `connect` - Initial connection established
- `disconnect` - Connection closed
- `error` - Error occurred

#### Match Events
- `match:created` - New match created
- `match:updated` - Match details updated
- `match:started` - Match started
- `match:completed` - Match completed
- `match:cancelled` - Match cancelled

#### Fight Events
- `fight:reported` - Fight result reported
- `fight:confirmed` - Fight result confirmed by captains
- `fight:disputed` - Fight result disputed
- `fight:completed` - Fight finalized

#### Subscription Events
- `subscribe` - Subscribe to match updates (client → server)
- `unsubscribe` - Unsubscribe from match (client → server)
- `subscribed` - Subscription confirmed (server → client)
- `unsubscribed` - Unsubscription confirmed (server → client)

## Connection

### Without Authentication
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws/matches');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### With Authentication
```javascript
const token = 'your_jwt_token'; // From login response
const ws = new WebSocket(`ws://localhost:3000/api/v1/ws/matches?token=${token}`);
```

## Subscribing to Match Updates

### Subscribe to Specific Match
```javascript
// Send subscription request
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { matchId: '507f1f77bcf86cd799439011' }
}));

// Confirmation received
{
  "type": "subscribed",
  "data": { "matchId": "507f1f77bcf86cd799439011" },
  "timestamp": "2026-01-23T15:30:00.000Z",
  "matchId": "507f1f77bcf86cd799439011"
}
```

### Unsubscribe from Match
```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  data: { matchId: '507f1f77bcf86cd799439011' }
}));
```

## Receiving Live Updates

### Match Created
```json
{
  "type": "match:created",
  "data": {
    "match": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Team Battle",
      "status": "pending_captain_confirmation",
      "matchDate": "2026-01-25T10:00:00.000Z",
      "teams": [...],
      "matchType": "training"
    }
  },
  "timestamp": "2026-01-23T15:30:00.000Z",
  "matchId": "507f1f77bcf86cd799439011"
}
```

### Match Started
```json
{
  "type": "match:started",
  "data": {
    "match": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "active",
      ...
    }
  },
  "timestamp": "2026-01-25T10:00:00.000Z",
  "matchId": "507f1f77bcf86cd799439011"
}
```

### Fight Reported
```json
{
  "type": "fight:reported",
  "data": {
    "fight": {
      "_id": "507f1f77bcf86cd799439012",
      "matchId": "507f1f77bcf86cd799439011",
      "player1": {
        "playerId": "...",
        "playerName": "Alex Thunder",
        "teamId": "team1"
      },
      "player2": {
        "playerId": "...",
        "playerName": "Jordan Sky",
        "teamId": "team2"
      },
      "proposedResult": "player1",
      "status": "pending_captain_confirmation"
    },
    "matchId": "507f1f77bcf86cd799439011"
  },
  "timestamp": "2026-01-25T10:15:00.000Z",
  "matchId": "507f1f77bcf86cd799439011"
}
```

### Fight Confirmed
```json
{
  "type": "fight:confirmed",
  "data": {
    "fight": {
      "_id": "507f1f77bcf86cd799439012",
      "status": "confirmed",
      "captainConfirmations": [...]
    },
    "matchId": "507f1f77bcf86cd799439011"
  },
  "timestamp": "2026-01-25T10:16:00.000Z",
  "matchId": "507f1f77bcf86cd799439011"
}
```

## React Integration Example

```typescript
import { useEffect, useState } from 'react';

interface WSMessage {
  type: string;
  data?: any;
  timestamp: string;
  matchId?: string;
}

function useMatchWebSocket(matchId: string, token?: string) {
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const url = token
      ? `ws://localhost:3000/api/v1/ws/matches?token=${token}`
      : 'ws://localhost:3000/api/v1/ws/matches';
    
    const websocket = new WebSocket(url);
    
    websocket.onopen = () => {
      setConnected(true);
      // Subscribe to match
      websocket.send(JSON.stringify({
        type: 'subscribe',
        data: { matchId }
      }));
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
      
      // Handle specific events
      if (message.type === 'fight:confirmed') {
        console.log('Fight confirmed!', message.data);
      }
    };
    
    websocket.onclose = () => {
      setConnected(false);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [matchId, token]);
  
  return { messages, connected, ws };
}

// Usage
function MatchLive({ matchId }: { matchId: string }) {
  const token = localStorage.getItem('jwt_token');
  const { messages, connected } = useMatchWebSocket(matchId, token);
  
  return (
    <div>
      <div>Status: {connected ? '🟢 Live' : '🔴 Disconnected'}</div>
      <h2>Match Updates</h2>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.type}</strong>: {JSON.stringify(msg.data)}
        </div>
      ))}
    </div>
  );
}
```

## Server Statistics

Get real-time WebSocket connection statistics:

```bash
curl http://localhost:3000/api/v1/ws/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "totalConnections": 5,
    "totalRooms": 2,
    "roomDetails": [
      {
        "matchId": "507f1f77bcf86cd799439011",
        "connections": 3
      },
      {
        "matchId": "507f1f77bcf86cd799439012",
        "connections": 2
      }
    ]
  }
}
```

## Testing

### Using Test Client
Open `test-websocket.html` in your browser for a complete interactive test client.

### Using websocat CLI
```bash
# Install websocat
brew install websocat

# Connect
websocat ws://localhost:3000/api/v1/ws/matches

# Subscribe to match (type after connection)
{"type":"subscribe","data":{"matchId":"507f1f77bcf86cd799439011"}}
```

### Using curl (WebSocket upgrade)
```bash
curl --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Sec-WebSocket-Version: 13" \
     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     http://localhost:3000/api/v1/ws/matches
```

## Architecture

### Components

1. **WebSocket Service** (`src/websocket/websocket.service.ts`)
   - Manages connections and rooms
   - Broadcasts events to subscribers
   - Tracks connection metadata

2. **WebSocket Routes** (`src/websocket/websocket.routes.ts`)
   - Handles WebSocket connections
   - Authenticates clients
   - Routes messages to service

3. **WebSocket Types** (`src/websocket/websocket.types.ts`)
   - TypeScript interfaces and enums
   - Message schemas

4. **Integration Points**
   - Match Service: Broadcasts match events
   - Fight Service: Broadcasts fight events

### Room-Based Broadcasting

Clients subscribe to specific matches. Events are only sent to clients subscribed to the relevant match:

```
Match A Room:
  - Client 1 (subscribed)
  - Client 2 (subscribed)
  
Match B Room:
  - Client 3 (subscribed)

When fight reported in Match A:
  → Only Client 1 and Client 2 receive the event
```

## Performance Considerations

- Maximum payload size: 1MB
- Automatic cleanup of empty rooms
- Connection metadata tracking
- Efficient room-based broadcasting

## Security

- Optional JWT authentication
- Token verification on connection
- Invalid tokens are rejected immediately
- No sensitive data in error messages

## Troubleshooting

### Connection Refused
- Ensure server is running: `npm run dev`
- Check port 3000 is not blocked
- Verify WebSocket URL is correct

### Authentication Failed
- Check JWT token is valid
- Token must not be expired
- Use token from `/api/v1/auth/login`

### Not Receiving Updates
- Ensure you subscribed to the match
- Check match ID is correct
- Verify match events are being triggered

### Disconnections
- Network issues
- Server restart
- Implement reconnection logic in client

## Future Enhancements

- [ ] Ping/pong heartbeat for connection health
- [ ] Reconnection with subscription restoration
- [ ] Message acknowledgment system
- [ ] Rate limiting for message sending
- [ ] Admin broadcast to all connections
- [ ] Player-specific notifications
- [ ] Chat functionality
- [ ] Typing indicators

## Related Documentation

- [Authentication Quick Reference](./AUTHENTICATION_QUICK_REFERENCE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- Fastify WebSocket: https://github.com/fastify/fastify-websocket
