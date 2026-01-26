# API Documentation

Comprehensive API documentation for Kite Fighter API v1.0.0

**🎯 Frontend Integration Guide**

This documentation is designed for frontend developers and AI agents building client applications. Each endpoint includes complete request/response examples, frontend integration code, and UI workflow patterns.

## Table of Contents

- [Overview](#overview)
- [Frontend Quick Start](#frontend-quick-start)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
  - [Players](#players)
  - [Clubs](#clubs)
  - [Matches](#matches)
  - [Fights](#fights)
  - [Admin](#admin)
  - [Health](#health)
- [Frontend Integration Examples](#frontend-integration-examples)
- [Approval Workflow](#approval-workflow)
- [Notification Events](#notification-events)
- [UI State Management](#ui-state-management)
- [API Versioning Strategy](#api-versioning-strategy)

---

## Quick Endpoint Reference

### Club Membership Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/v1/membership/join-request` | POST | Request to join a club | ✅ Yes |
| `/api/v1/players/join-club-request` | POST | Legacy endpoint (same as above) | ✅ Yes |
| `/api/v1/membership/cancel-request` | DELETE | Cancel pending join request | ✅ Yes |
| `/api/v1/clubs/:id/join-requests` | GET | Get pending requests (owners only) | ✅ Yes |
| `/api/v1/clubs/:id/join-request/review` | POST | Approve/reject request (owners) | ✅ Yes |
| `/api/v1/clubs/:id/members` | GET | Get club members with roles | ✅ Yes |
| `/api/v1/clubs/:id/members/role` | PATCH | Update member role (owner only) | ✅ Yes |

**⚠️ Important:** Use `/api/v1/membership/join-request` for new implementations. The `/api/v1/players/join-club-request` endpoint exists for backward compatibility.

---

## Overview

**Base URL (Development):** `http://localhost:3000/api/v1`

**Production URL:** `https://api.kitefighters.in/api/v1`

**App Runner URL:** `https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1`

**Content Type:** `application/json`

**API Version:** v1

All endpoints return JSON responses. Timestamps are in ISO 8601 format.

### Key Features for Frontend

✅ RESTful API design  
✅ Consistent error responses  
✅ Pagination support on list endpoints  
✅ Search and filtering capabilities  
✅ Approval workflow (pending → approved/rejected)  
✅ Soft delete with admin confirmation  
✅ Rate limiting protection  

---

## Frontend Quick Start

### Installation

```bash
# Using axios
npm install axios

# Using fetch (built-in, no installation needed)
```

### API Client Setup

```javascript
// api/client.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data || {};
    return Promise.reject({
      statusCode: errorData.statusCode || 500,
      code: errorData.code || 'UNKNOWN_ERROR',
      message: errorData.message || 'An error occurred',
    });
  }
);

export default apiClient;
```

### Using Fetch API

```javascript
// api/fetchClient.js
const API_BASE_URL = 'http://localhost:3000/api/v1';

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw {
        statusCode: data.statusCode,
        code: data.code,
        message: data.message,
      };
    }
    
    return data;
  } catch (error) {
    throw error;
  }
}

export default apiRequest;
```

---

## Data Models

Understanding the data structures returned by the API.

### Player Object

```typescript
interface Player {
  _id: string;                    // MongoDB ObjectId
  name: string;                   // 2-100 characters
  email: string;                  // Unique, lowercase
  clubs: string[] | Club[];       // Array of club IDs or populated Club objects
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;       // Present if status is 'rejected'
  deletionRequested: boolean;     // True if player requested deletion
  deletionReason?: string;        // Optional reason for deletion
  deletedAt?: Date;               // Present if soft deleted
  
  // Fight Statistics (New Match System)
  fightStats: {
    training: {                   // All fights (superset)
      wins: number;
      losses: number;
      draws: number;
    };
    competitive: {                // Competitive matches only (subset)
      wins: number;
      losses: number;
      draws: number;
    };
  };
  
  // Streak Tracking
  currentStreak: {
    count: number;                // Current win streak
    lastFightId: string;
    lastMatchId: string;
    lastFightDate: Date;
    lastTeamId: string;           // For same-team reset detection
    active: boolean;
    currentTier: 'GREEN' | 'GOLDEN' | 'RAINBOW' | null;
  };
  
  bestStreak: {
    count: number;                // Best win streak ever
    achievedAt: Date;
    matchId: string;
    fightId: string;
  };
  
  // Star Trophy System
  starTrophies: {
    green: { count: number };     // 7+ win streaks
    golden: { count: number };    // 9+ win streaks
    rainbow: { count: number };   // 10+ win streaks
  };
  
  stars: Array<{                  // Trophy history
    tier: 'GREEN' | 'GOLDEN' | 'RAINBOW';
    streakCount: number;
    awardedAt: Date;
    matchId: string;
    fightId: string;
  }>;
  
  createdAt: Date;                // ISO 8601 timestamp
  updatedAt: Date;                // ISO 8601 timestamp
}
```

### Club Object

```typescript
interface Club {
  _id: string;                    // MongoDB ObjectId
  name: string;                   // 2-100 characters, unique
  description?: string;           // Optional, max 500 characters
  foundedDate?: Date;             // Optional
  players: string[] | Player[];   // Array of player IDs or populated Player objects
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;       // Present if status is 'rejected'
  deletionRequested: boolean;     // True if club requested deletion
  deletionReason?: string;        // Optional reason for deletion
  deletedAt?: Date;               // Present if soft deleted
  
  // Competitive Match Statistics
  competitiveMatchStats: {
    matchesWon: number;
    matchesLost: number;
    matchesDraw: number;
  };
  
  createdAt: Date;                // ISO 8601 timestamp
  updatedAt: Date;                // ISO 8601 timestamp
}
```

### Match Object

```typescript
interface Match {
  _id: string;
  name: string;                   // Match name
  description?: string;           // Optional description
  matchType: 'competitive' | 'training';  // Auto-determined by clubs
  matchDate: Date;
  organizerId: string;            // Player who created the match
  status: 'PENDING_CAPTAIN_CONFIRMATION' | 'PENDING_PARTICIPANTS' | 
          'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  
  teams: [Team, Team];            // Exactly 2 teams
  
  matchResult: {
    winningTeamId?: string;
    status: 'PENDING' | 'DECLARED' | 'DISPUTED' | 'AGREED' | 'ADMIN_RESOLVED';
    declarations: Array<{
      captainId: string;
      teamId: string;
      declaredWinner: string;
      declaredAt: Date;
      confirmationRound: 1 | 2;
    }>;
    resolvedBy?: string;          // Admin ID if dispute resolved
    finalizedAt?: Date;
  };
  
  involvedClubs: string[];        // Club IDs involved in match
  allParticipants: string[];      // All player IDs
  
  statistics: Array<{             // Per-player match stats
    playerId: string;
    wins: number;
    losses: number;
    draws: number;
  }>;
  
  lastFighterPerTeam: {           // For same-team streak reset
    [teamId: string]: string;     // Last fighter playerId per team
  };
  
  createdAt: Date;
  updatedAt: Date;
}

interface Team {
  teamId: string;                 // Generated team ID
  teamName: string;
  clubId?: string;                // Optional club affiliation
  captain: {
    playerId: string;
    confirmationStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED';
    promotedFrom?: 'ORGANIZER' | 'FIRST_CONFIRMED';
    confirmedAt?: Date;
  };
  players: Array<{
    playerId: string;
    playerName: string;
    confirmationStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED';
    confirmedAt?: Date;
    enteringStreak: number;       // Streak at match start
    currentStreak: number;        // Updated during match
    currentTier?: 'GREEN' | 'GOLDEN' | 'RAINBOW';
  }>;
}
```

### Fight Object

```typescript
interface Fight {
  _id: string;
  matchId: string;
  matchType: 'competitive' | 'training';  // Denormalized for queries
  
  reportedBy: {
    reporterId: string;
    reporterName: string;
    teamId: string;
  };
  
  player1: {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
  };
  
  player2: {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
  };
  
  proposedResult: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
  resultNote?: string;            // Optional, max 500 characters
  
  status: 'PENDING_CAPTAIN_CONFIRMATION' | 'CONFIRMED' | 
          'DISPUTED' | 'ADMIN_RESOLVED';
  
  captainConfirmations: Array<{
    captainId: string;
    captainName: string;
    teamId: string;
    agreedResult: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
    confirmedAt: Date;
    notes?: string;
    confirmationOrder: 1 | 2;
  }>;
  
  disputeDetails?: {
    reason: string;
    resolvedBy?: string;          // Admin ID
    resolvedAt?: Date;
    finalResult?: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

### Paginated Response

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;      // Current page (1-indexed)
    limit: number;     // Items per page
    total: number;     // Total items
    pages: number;     // Total pages
  };
}
```

### Enums

```typescript
// Approval Status
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// Match Types
type MatchType = 'competitive' | 'training';

// Match Status
type MatchStatus = 'PENDING_CAPTAIN_CONFIRMATION' | 'PENDING_PARTICIPANTS' | 
                   'ACTIVE' | 'COMPLETED' | 'CANCELLED';

// Fight Status
type FightStatus = 'PENDING_CAPTAIN_CONFIRMATION' | 'CONFIRMED' | 
                   'DISPUTED' | 'ADMIN_RESOLVED';

// Fight Result
type FightResult = 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';

// Star Tiers
type StarType = 'GREEN' | 'GOLDEN' | 'RAINBOW';

// Confirmation Status
type ConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';
```

---

## Authentication

### Current State (v1.0.0)

🔓 **Authentication is currently a placeholder**

All endpoints are publicly accessible. Admin endpoints use a mock admin ID.

### Future Implementation

JWT (JSON Web Token) authentication will be implemented in a future release:

```http
Authorization: Bearer <jwt_token>
```

**Planned Flow:**
1. User logs in → Receives JWT token
2. Token included in Authorization header
3. Server validates token
4. Request processed with user context

**Admin Endpoints:**
- Will require valid JWT with admin role
- Regular users will receive 403 Forbidden

---

## Error Handling

### Error Response Format

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "message": "Detailed error message"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_ID` | 400 | Invalid ID format |
| `UNAUTHORIZED` | 401 | Authentication required |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_ERROR` | 409 | Resource already exists |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Common Errors

#### Duplicate Email
```json
{
  "statusCode": 409,
  "code": "DUPLICATE_ERROR",
  "message": "Player with this email already exists"
}
```

#### Invalid ID
```json
{
  "statusCode": 400,
  "code": "INVALID_ID",
  "message": "Invalid ID format"
}
```

#### Not Found
```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Player not found"
}
```

---

## Rate Limiting

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| POST (Create) | 5 requests | 1 minute |
| GET (Read) | 100 requests | 1 minute |
| Other | 100 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

### Rate Limit Exceeded

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

---

## Pagination

### Query Parameters

```http
GET /api/v1/players?page=2&limit=10&sort=-createdAt
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (min: 1) |
| `limit` | integer | 10 | Items per page (min: 1, max: 100) |
| `sort` | string | -createdAt | Sort field (prefix with - for descending) |

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

---

## API Endpoints

## Players

### Create Player

Creates a new player with pending status. Admin approval required before the player becomes active.

**Endpoint:** `POST /api/v1/players`

**Rate Limit:** 5 requests/minute

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "clubs": ["507f1f77bcf86cd799439011"]  // Optional: Array of club IDs
}
```

**Success Response:** `201 Created`

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "clubs": ["507f1f77bcf86cd799439011"],
  "status": "pending",
  "deletionRequested": false,
  "createdAt": "2024-01-23T10:30:00.000Z",
  "updatedAt": "2024-01-23T10:30:00.000Z"
}
```

**Error Responses:**

```json
// 409 Conflict - Duplicate email
{
  "statusCode": 409,
  "code": "DUPLICATE_ERROR",
  "message": "Player with this email already exists"
}

// 400 Bad Request - Invalid club ID
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "One or more clubs not found or not approved"
}

// 429 Too Many Requests
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

**Frontend Example (Axios):**

```javascript
// api/players.js
import apiClient from './client';

export const createPlayer = async (playerData) => {
  try {
    const response = await apiClient.post('/players', playerData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Usage in component
const handleSubmit = async (formData) => {
  try {
    const newPlayer = await createPlayer({
      name: formData.name,
      email: formData.email,
      clubs: formData.selectedClubIds, // Optional
    });
    
    // Show success message
    alert(`Player created! Status: ${newPlayer.status}`);
    
    // Redirect or update UI
    navigate('/players');
  } catch (error) {
    // Handle specific errors
    if (error.code === 'DUPLICATE_ERROR') {
      setError('This email is already registered');
    } else if (error.code === 'VALIDATION_ERROR') {
      setError('Invalid club selection');
    } else {
      setError('Failed to create player');
    }
  }
};
```

**Frontend Example (Fetch):**

```javascript
const createPlayer = async (playerData) => {
  const response = await fetch('http://localhost:3000/api/v1/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playerData),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw data;
  }
  
  return data;
};
```

**Validation Rules:**
- `name`: Required, 2-100 characters
- `email`: Required, valid email format, unique, converted to lowercase
- `clubs`: Optional, must be approved club IDs

---

### Get All Players

Returns paginated list of approved and non-deleted players.

**Endpoint:** `GET /api/v1/players`

**Rate Limit:** 100 requests/minute

**Query Parameters:**

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `page` | integer | 1 | Page number (min: 1) | `?page=2` |
| `limit` | integer | 10 | Items per page (1-100) | `&limit=20` |
| `sort` | string | -createdAt | Sort field (- for desc) | `&sort=name` or `&sort=-createdAt` |
| `search` | string | - | Search by name (case-insensitive) | `&search=john` |
| `clubId` | string | - | Filter by club membership | `&clubId=507f...` |
| `populate` | string | - | Populate clubs data | `&populate=clubs` |

**Success Response:** `200 OK`

```json
{
  "data": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "clubs": ["507f1f77bcf86cd799439011"],
      "status": "approved",
      "deletionRequested": false,
      "createdAt": "2024-01-23T10:30:00.000Z",
      "updatedAt": "2024-01-23T10:30:00.000Z"
    },
    {
      "_id": "507f191e810c19729de860eb",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "clubs": [],
      "status": "approved",
      "deletionRequested": false,
      "createdAt": "2024-01-23T09:15:00.000Z",
      "updatedAt": "2024-01-23T09:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**With Population (populate=clubs):**

```json
{
  "data": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "clubs": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Phoenix Warriors",
          "description": "Elite fighters",
          "status": "approved"
        }
      ],
      "status": "approved",
      "createdAt": "2024-01-23T10:30:00.000Z",
      "updatedAt": "2024-01-23T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**Frontend Example (React Hook):**

```javascript
// hooks/usePlayers.js
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export const usePlayers = (options = {}) => {
  const [players, setPlayers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);
      if (options.search) params.append('search', options.search);
      if (options.clubId) params.append('clubId', options.clubId);
      if (options.populate) params.append('populate', options.populate);
      if (options.sort) params.append('sort', options.sort);
      
      const response = await apiClient.get(`/players?${params}`);
      
      setPlayers(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [options.page, options.limit, options.search, options.clubId]);

  return { players, pagination, loading, error, refetch: fetchPlayers };
};

// Usage in component
function PlayersList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { players, pagination, loading, error } = usePlayers({
    page,
    limit: 10,
    search,
    populate: 'clubs',
    sort: '-createdAt',
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <ul>
        {players.map((player) => (
          <li key={player._id}>
            {player.name} - {player.email}
            <span>Clubs: {player.clubs.length}</span>
          </li>
        ))}
      </ul>
      
      {pagination && (
        <div>
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page} of {pagination.pages}</span>
          <button
            disabled={page === pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### Get Player by ID

Returns a single approved player by ID.

**Endpoint:** `GET /api/v1/players/:id`

**Rate Limit:** 100 requests/minute

**URL Parameters:**
- `id` - Player ObjectId (24 character hex string)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `populate` | string | Populate clubs (`?populate=clubs`) |

**Success Response:** `200 OK`

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "clubs": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Phoenix Warriors",
      "description": "Elite fighters",
      "status": "approved"
    }
  ],
  "status": "approved",
  "deletionRequested": false,
  "createdAt": "2024-01-23T10:30:00.000Z",
  "updatedAt": "2024-01-23T10:30:00.000Z"
}
```

**Error Response:**

```json
// 404 Not Found
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Player not found"
}

// 400 Bad Request - Invalid ID format
{
  "statusCode": 400,
  "code": "INVALID_ID",
  "message": "Invalid ID format"
}
```

**Frontend Example:**

```javascript
// api/players.js
export const getPlayerById = async (playerId, populate = false) => {
  const params = populate ? '?populate=clubs' : '';
  const response = await apiClient.get(`/players/${playerId}${params}`);
  return response.data;
};

// Usage in component
function PlayerDetails({ playerId }) {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const data = await getPlayerById(playerId, true);
        setPlayer(data);
      } catch (error) {
        console.error('Failed to fetch player:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlayer();
  }, [playerId]);

  if (loading) return <div>Loading...</div>;
  if (!player) return <div>Player not found</div>;

  return (
    <div>
      <h2>{player.name}</h2>
      <p>Email: {player.email}</p>
      <p>Status: {player.status}</p>
      <div>
        <h3>Clubs ({player.clubs.length})</h3>
        <ul>
          {player.clubs.map((club) => (
            <li key={club._id}>{club.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

### Update Player

Updates player information (name and email only).

**Endpoint:** `PUT /api/v1/players/:id`

**Rate Limit:** 100 requests/minute

**URL Parameters:**
- `id` - Player ObjectId

**Request Body:**

```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

**Success Response:** `200 OK`

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "John Updated",
  "email": "john.updated@example.com",
  "clubs": ["507f1f77bcf86cd799439011"],
  "status": "approved",
  "deletionRequested": false,
  "createdAt": "2024-01-23T10:30:00.000Z",
  "updatedAt": "2024-01-23T11:45:00.000Z"
}
```

**Frontend Example:**

```javascript
export const updatePlayer = async (playerId, updates) => {
  const response = await apiClient.put(`/players/${playerId}`, updates);
  return response.data;
};

// Usage
const handleUpdate = async (playerId, formData) => {
  try {
    const updated = await updatePlayer(playerId, {
      name: formData.name,
      email: formData.email,
    });
    
    alert('Player updated successfully!');
    setPlayer(updated);
  } catch (error) {
    if (error.code === 'DUPLICATE_ERROR') {
      setError('Email already in use');
    } else {
      setError('Update failed');
    }
  }
};
```

---

### Join Club

Adds player to a club. Uses MongoDB transactions for bidirectional consistency.

**Endpoint:** `PATCH /api/v1/players/:id/join-club`

**Rate Limit:** 100 requests/minute

**URL Parameters:**
- `id` - Player ObjectId

**Request Body:**

```json
{
  "clubId": "507f1f77bcf86cd799439011"
}
```

**Success Response:** `200 OK`

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "clubs": ["507f1f77bcf86cd799439011"],  // Club added
  "status": "approved",
  "createdAt": "2024-01-23T10:30:00.000Z",
  "updatedAt": "2024-01-23T12:00:00.000Z"
}
```

**Error Responses:**

```json
// 409 Conflict - Already a member
{
  "statusCode": 409,
  "code": "DUPLICATE_ERROR",
  "message": "Player is already a member of this club"
}

// 404 Not Found - Club doesn't exist
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Club not found"
}
```

**Frontend Example:**

```javascript
export const joinClub = async (playerId, clubId) => {
  const response = await apiClient.patch(`/players/${playerId}/join-club`, {
    clubId,
  });
  return response.data;
};

// Usage
const handleJoinClub = async (playerId, clubId) => {
  try {
    const updatedPlayer = await joinClub(playerId, clubId);
    alert('Successfully joined club!');
    setPlayer(updatedPlayer);
  } catch (error) {
    if (error.code === 'DUPLICATE_ERROR') {
      alert('Already a member of this club');
    } else {
      alert('Failed to join club');
    }
  }
};
```

---

### Leave Club

Removes player from a club.

**Endpoint:** `PATCH /api/v1/players/:id/leave-club`

**Rate Limit:** 100 requests/minute

**Request Body:**

```json
{
  "clubId": "507f1f77bcf86cd799439011"
}
```

**Success Response:** `200 OK`

**Frontend Example:**

```javascript
export const leaveClub = async (playerId, clubId) => {
  const response = await apiClient.patch(`/players/${playerId}/leave-club`, {
    clubId,
  });
  return response.data;
};
```

---

### Request Player Deletion

Requests deletion of a player. Admin approval required.

**Endpoint:** `DELETE /api/v1/players/:id`

**Rate Limit:** 100 requests/minute

**Success Response:** `200 OK`

```json
{
  "message": "Player deletion requested. Admin approval required."
}
```

**Frontend Example:**

```javascript
export const requestPlayerDeletion = async (playerId) => {
  const response = await apiClient.delete(`/players/${playerId}`);
  return response.data;
};

// Usage
const handleDeleteRequest = async (playerId) => {
  if (!confirm('Are you sure you want to request deletion?')) return;
  
  try {
    const result = await requestPlayerDeletion(playerId);
    alert(result.message);
    navigate('/players');
  } catch (error) {
    alert('Failed to request deletion');
  }
};
```

---

### Record Fight Result

Records the outcome of a fight between two players. Both players must be approved. Updates fight statistics (wins/losses/draws) for both players atomically using a database transaction.

**Endpoint:** `POST /api/v1/players/fights/record`

**Rate Limit:** 100 requests/minute

**Request Body:**

```json
{
  "player1Id": "507f191e810c19729de860ea",
  "player2Id": "507f1f77bcf86cd799439012",
  "result": "player1"
}
```

**Field Descriptions:**
- `player1Id`: MongoDB ObjectId of first player (required)
- `player2Id`: MongoDB ObjectId of second player (required)
- `result`: Fight outcome (required) - one of:
  - `"player1"` - Player 1 wins (player1 +win, player2 +loss)
  - `"player2"` - Player 2 wins (player2 +win, player1 +loss)
  - `"draw"` - Tie (both players +draw)

**Success Response:** `200 OK`

```json
{
  "message": "Fight recorded successfully",
  "player1": {
    "_id": "507f191e810c19729de860ea",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "fightStats": {
      "wins": 5,
      "losses": 2,
      "draws": 1
    }
  },
  "player2": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "fightStats": {
      "wins": 3,
      "losses": 4,
      "draws": 1
    }
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Invalid result
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "body/result must be equal to one of the allowed values: player1, player2, draw"
}

// 400 Bad Request - Same player
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Players cannot fight themselves"
}

// 404 Not Found - Player doesn't exist
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "One or both players not found"
}

// 400 Bad Request - Player not approved
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Both players must be approved to record fights"
}
```

**Frontend Example (Axios):**

```javascript
// api/players.js
export const recordFight = async (player1Id, player2Id, result) => {
  try {
    const response = await apiClient.post('/players/fights/record', {
      player1Id,
      player2Id,
      result,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Usage in component
const handleFightSubmit = async (formData) => {
  try {
    const result = await recordFight(
      formData.player1Id,
      formData.player2Id,
      formData.result // 'player1', 'player2', or 'draw'
    );
    
    alert('Fight recorded successfully!');
    console.log('Updated stats:', result.player1.fightStats, result.player2.fightStats);
    
    // Refresh leaderboard or player stats
    refreshLeaderboard();
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      setError(error.message);
    } else {
      setError('Failed to record fight');
    }
  }
};
```

**Frontend Example (Fetch):**

```javascript
const recordFight = async (player1Id, player2Id, result) => {
  const response = await fetch('http://localhost:3000/api/v1/players/fights/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player1Id, player2Id, result }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw data;
  }
  
  return data;
};
```

**React Component Example:**

```jsx
import { useState, useEffect } from 'react';
import { recordFight } from '../api/players';

const RecordFightForm = () => {
  const [players, setPlayers] = useState([]);
  const [formData, setFormData] = useState({
    player1Id: '',
    player2Id: '',
    result: 'player1',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await recordFight(
        formData.player1Id,
        formData.player2Id,
        formData.result
      );
      
      alert(`Fight recorded! ${result.player1.name} vs ${result.player2.name}`);
      
      // Reset form
      setFormData({ player1Id: '', player2Id: '', result: 'player1' });
    } catch (err) {
      setError(err.message || 'Failed to record fight');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Record Fight Result</h2>
      
      {error && <div className="error">{error}</div>}
      
      <select
        value={formData.player1Id}
        onChange={(e) => setFormData({ ...formData, player1Id: e.target.value })}
        required
      >
        <option value="">Select Player 1</option>
        {players.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={formData.player2Id}
        onChange={(e) => setFormData({ ...formData, player2Id: e.target.value })}
        required
      >
        <option value="">Select Player 2</option>
        {players.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={formData.result}
        onChange={(e) => setFormData({ ...formData, result: e.target.value })}
        required
      >
        <option value="player1">Player 1 Wins</option>
        <option value="player2">Player 2 Wins</option>
        <option value="draw">Draw</option>
      </select>

      <button type="submit" disabled={loading}>
        {loading ? 'Recording...' : 'Record Fight'}
      </button>
    </form>
  );
};

export default RecordFightForm;
```

**Validation Rules:**
- `player1Id`: Required, valid MongoDB ObjectId, must exist and be approved
- `player2Id`: Required, valid MongoDB ObjectId, must exist and be approved, cannot be same as player1Id
- `result`: Required, must be one of: "player1", "player2", "draw"

**Business Logic:**
- Both players must be approved (status: "approved")
- Players cannot fight themselves (player1Id !== player2Id)
- Updates are atomic - if one update fails, both are rolled back
- Statistics are updated based on result:
  - `player1`: player1.wins++, player2.losses++
  - `player2`: player2.wins++, player1.losses++
  - `draw`: player1.draws++, player2.draws++

---

### Get Player Fight Statistics

Retrieves a player's fight statistics including wins, losses, draws, total fights, and win rate.

**Endpoint:** `GET /api/v1/players/:id/fight-stats`

**Rate Limit:** 100 requests/minute

**URL Parameters:**
- `id`: MongoDB ObjectId of the player (required)

**Success Response:** `200 OK`

```json
{
  "_id": "507f191e810c19729de860ea",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "fightStats": {
    "wins": 5,
    "losses": 2,
    "draws": 1
  },
  "totalFights": 8,
  "winRate": 62.5
}
```

**Field Descriptions:**
- `fightStats.wins`: Number of fights won
- `fightStats.losses`: Number of fights lost
- `fightStats.draws`: Number of tied fights
- `totalFights`: Total number of fights (wins + losses + draws)
- `winRate`: Win percentage (wins / totalFights * 100), rounded to 2 decimals, or 0 if no fights

**Error Responses:**

```json
// 404 Not Found
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Player not found"
}
```

**Frontend Example (Axios):**

```javascript
// api/players.js
export const getPlayerFightStats = async (playerId) => {
  try {
    const response = await apiClient.get(`/players/${playerId}/fight-stats`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Usage in component
const PlayerStatsCard = ({ playerId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getPlayerFightStats(playerId);
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
  }, [playerId]);

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div>No stats available</div>;

  return (
    <div className="stats-card">
      <h3>{stats.name}'s Fight Record</h3>
      <div className="stats-grid">
        <div className="stat">
          <span className="label">Wins:</span>
          <span className="value">{stats.fightStats.wins}</span>
        </div>
        <div className="stat">
          <span className="label">Losses:</span>
          <span className="value">{stats.fightStats.losses}</span>
        </div>
        <div className="stat">
          <span className="label">Draws:</span>
          <span className="value">{stats.fightStats.draws}</span>
        </div>
        <div className="stat">
          <span className="label">Total Fights:</span>
          <span className="value">{stats.totalFights}</span>
        </div>
        <div className="stat">
          <span className="label">Win Rate:</span>
          <span className="value">{stats.winRate}%</span>
        </div>
      </div>
    </div>
  );
};
```

**React Component Example - Leaderboard:**

```jsx
import { useState, useEffect } from 'react';
import { getAllPlayers } from '../api/players';

const FightLeaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('winRate'); // 'winRate', 'wins', 'totalFights'

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        // Get all players with populated data
        const response = await getAllPlayers({ limit: 100 });
        
        // Calculate stats for each player
        const playersWithStats = response.data.map(player => ({
          ...player,
          totalFights: (player.fightStats?.wins || 0) + 
                      (player.fightStats?.losses || 0) + 
                      (player.fightStats?.draws || 0),
          winRate: player.fightStats?.wins && 
                   (player.fightStats.wins + player.fightStats.losses + player.fightStats.draws) > 0
            ? ((player.fightStats.wins / (player.fightStats.wins + player.fightStats.losses + player.fightStats.draws)) * 100).toFixed(2)
            : 0,
        }));
        
        setPlayers(playersWithStats);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPlayers();
  }, []);

  const sortedPlayers = [...players].sort((a, b) => {
    if (sortBy === 'winRate') return b.winRate - a.winRate;
    if (sortBy === 'wins') return (b.fightStats?.wins || 0) - (a.fightStats?.wins || 0);
    if (sortBy === 'totalFights') return b.totalFights - a.totalFights;
    return 0;
  });

  if (loading) return <div>Loading leaderboard...</div>;

  return (
    <div className="leaderboard">
      <h2>Fight Leaderboard</h2>
      
      <div className="sort-controls">
        <button onClick={() => setSortBy('winRate')}>Sort by Win Rate</button>
        <button onClick={() => setSortBy('wins')}>Sort by Wins</button>
        <button onClick={() => setSortBy('totalFights')}>Sort by Total Fights</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Draws</th>
            <th>Total</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, index) => (
            <tr key={player._id}>
              <td>{index + 1}</td>
              <td>{player.name}</td>
              <td>{player.fightStats?.wins || 0}</td>
              <td>{player.fightStats?.losses || 0}</td>
              <td>{player.fightStats?.draws || 0}</td>
              <td>{player.totalFights}</td>
              <td>{player.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FightLeaderboard;
```

**TypeScript Interface:**

```typescript
interface FightStats {
  wins: number;
  losses: number;
  draws: number;
}

interface PlayerWithStats {
  _id: string;
  name: string;
  email: string;
  fightStats: FightStats;
  totalFights: number;
  winRate: number;
  status: 'pending' | 'approved' | 'rejected';
  clubs?: string[];
  createdAt: string;
  updatedAt: string;
}

interface RecordFightRequest {
  player1Id: string;
  player2Id: string;
  result: 'player1' | 'player2' | 'draw';
}

interface RecordFightResponse {
  message: string;
  player1: PlayerWithStats;
  player2: PlayerWithStats;
}
```

**Custom Hook Example:**

```typescript
// hooks/useFightStats.ts
import { useState, useEffect } from 'react';
import { getPlayerFightStats } from '../api/players';

interface UseFightStatsReturn {
  stats: PlayerWithStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useFightStats = (playerId: string): UseFightStatsReturn => {
  const [stats, setStats] = useState<PlayerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlayerFightStats(playerId);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load fight stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (playerId) {
      fetchStats();
    }
  }, [playerId]);

  return { stats, loading, error, refetch: fetchStats };
};

// Usage:
const MyComponent = ({ playerId }) => {
  const { stats, loading, error, refetch } = useFightStats(playerId);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h3>{stats.name}</h3>
      <p>Win Rate: {stats.winRate}%</p>
      <button onClick={refetch}>Refresh Stats</button>
    </div>
  );
};
```

---

## Clubs

### Create Club

Creates a new club with pending status. Admin approval required.

**Endpoint:** `POST /api/v1/clubs`

**Rate Limit:** 5 requests/minute

**Request Body:**

```json
{
  "name": "Phoenix Warriors",
  "description": "Elite kite fighters",
  "foundedDate": "2020-01-15",
  "players": ["507f191e810c19729de860ea"]  // Optional
}
```

**Response:** `201 Created`

---

### Get All Clubs

Returns paginated list of approved and non-deleted clubs.

**Endpoint:** `GET /api/v1/clubs`

**Rate Limit:** 100 requests/minute

**Query Parameters:** Same as players (page, limit, sort, search, populate)

**Response:** `200 OK`

---

### Get Club by ID

**Endpoint:** `GET /api/v1/clubs/:id`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `populate` | string | Populate players (`?populate=players`) |

**Response:** `200 OK`

---

### Get Club Players

Returns all approved players that are members of the club.

**Endpoint:** `GET /api/v1/clubs/:id/players`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `populate` | boolean | Populate player clubs (`?populate=true`) |

**Response:** `200 OK`

```json
[
  {
    "_id": "507f191e810c19729de860ea",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "clubs": [...],
    "status": "approved"
  }
]
```

---

### Update Club

**Endpoint:** `PUT /api/v1/clubs/:id`

**Request Body:**

```json
{
  "name": "Phoenix Warriors Updated",
  "description": "New description",
  "foundedDate": "2020-01-15"
}
```

---

### Request Club Deletion

**Endpoint:** `DELETE /api/v1/clubs/:id`

**Response:** `200 OK`

```json
{
  "message": "Club deletion requested. Admin approval required."
}
```

---

## Club Membership Management

### Request to Join Club

Authenticated players can request to join a club. The request will be sent to club owners and co-owners for approval.

**Endpoint:** `POST /api/v1/membership/join-request`

**Alternative Endpoints:**
- `POST /api/v1/players/join-club-request` (Legacy, works on all platforms)
- `POST /api/v1/membership/join-request` (Recommended, created as AWS workaround)

**Authentication:** Required (JWT token)

**Rate Limit:** 10 requests/minute

**Request Body:**

```json
{
  "clubId": "6975ad62a0f3ab04c1cd0b11",  // Required: Club ObjectId
  "message": "I would like to join your club!"  // Optional, max 500 chars
}
```

**Success Response:** `201 Created`

```json
{
  "message": "Join request submitted successfully. Awaiting club owner approval.",
  "club": {
    "_id": "6975ad62a0f3ab04c1cd0b11",
    "name": "Phoenix Warriors",
    "description": "Elite kite fighters",
    "status": "approved"
  }
}
```

**Error Responses:**

```json
// 401 Unauthorized - No token
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Unauthorized"
}

// 404 Not Found - Club doesn't exist
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Club not found"
}

// 400 Bad Request - Already a member
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Player is already a member of this club"
}

// 400 Bad Request - Pending request exists
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Join request already pending for this club"
}
```

**Frontend Example (React + Axios):**

```javascript
// api/clubs.js
import apiClient from './client';

export const requestJoinClub = async (clubId, message) => {
  const response = await apiClient.post('/membership/join-request', {
    clubId: clubId,
    message: message || undefined,
  });
  return response.data;
};

// Usage in component
import { useState } from 'react';
import { requestJoinClub } from '../api/clubs';

function ClubJoinButton({ club }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleJoinRequest = async () => {
    setLoading(true);
    try {
      const result = await requestJoinClub(club._id, message);
      alert(result.message);
      // Update UI to show pending status
    } catch (error) {
      if (error.code === 'VALIDATION_ERROR') {
        alert('You already have a pending request or are already a member');
      } else if (error.code === 'UNAUTHORIZED') {
        alert('Please log in to join a club');
      } else {
        alert('Failed to send join request');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea
        placeholder="Optional: Write a message to club owners..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
      />
      <button onClick={handleJoinRequest} disabled={loading}>
        {loading ? 'Sending Request...' : 'Request to Join'}
      </button>
    </div>
  );
}
```

**Frontend Example (Fetch API):**

```javascript
const requestJoinClub = async (clubId, message) => {
  const token = localStorage.getItem('jwt_token'); // Or get from your auth context
  
  const response = await fetch(`https://api.kitefighters.in/api/v1/membership/join-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ 
      clubId: clubId,
      message: message || undefined 
    }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw data;
  }
  
  return data;
};

// Usage
try {
  const result = await requestJoinClub('6975ad62a0f3ab04c1cd0b11', 'I want to join!');
  console.log(result.message); // "Join request submitted successfully..."
} catch (error) {
  console.error('Error:', error.message);
}
```

---

### Cancel Join Request

Cancel a pending join request for a club.

**Endpoint:** `DELETE /api/v1/membership/cancel-request`

**Authentication:** Required (JWT token)

**Request Body:**

```json
{
  "clubId": "6975ad62a0f3ab04c1cd0b11"  // Required: Club ObjectId
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Join request cancelled successfully.",
  "club": { ... }
}
```

**Frontend Example:**

```javascript
export const cancelJoinRequest = async (clubId) => {
  const response = await apiClient.delete('/membership/cancel-request', {
    data: { clubId }
  });
  return response.data;
};
```

---

### Get Pending Join Requests (Club Owners)

Get all pending join requests for a club. Only accessible to club owners and co-owners.

**Endpoint:** `GET /api/v1/clubs/:id/join-requests`

**Authentication:** Required (JWT token - must be owner/co-owner)

**URL Parameters:**
- `id` - Club ObjectId

**Success Response:** `200 OK`

```json
[
  {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "message": "I would like to join your club!",
    "requestedAt": "2026-01-25T10:30:00.000Z",
    "status": "pending"
  }
]
```

**Frontend Example:**

```javascript
export const getPendingJoinRequests = async (clubId) => {
  const response = await apiClient.get(`/clubs/${clubId}/join-requests`);
  return response.data;
};

// Usage in owner dashboard
function ClubJoinRequests({ clubId }) {
  const [requests, setRequests] = useState([]);
  
  useEffect(() => {
    const loadRequests = async () => {
      try {
        const data = await getPendingJoinRequests(clubId);
        setRequests(data);
      } catch (error) {
        console.error('Failed to load join requests:', error);
      }
    };
    loadRequests();
  }, [clubId]);
  
  return (
    <div>
      <h3>Pending Join Requests ({requests.length})</h3>
      {requests.map((request) => (
        <div key={request.playerId}>
          <p>{request.playerName} - {request.playerEmail}</p>
          <p>{request.message}</p>
          {/* Add approve/reject buttons */}
        </div>
      ))}
    </div>
  );
}
```

---

### Review Join Request (Approve/Reject)

Club owners and co-owners can approve or reject pending join requests.

**Endpoint:** `POST /api/v1/clubs/:id/join-request/review`

**Authentication:** Required (JWT token - must be owner/co-owner)

**URL Parameters:**
- `id` - Club ObjectId

**Request Body:**

```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": true,
  "reason": "Welcome to the club!"  // Optional, used for rejection
}
```

**Success Response:** `200 OK`

```json
{
  "message": "Join request approved successfully.",
  "club": { ... }
}
```

**Frontend Example:**

```javascript
export const reviewJoinRequest = async (clubId, playerId, approved, reason) => {
  const response = await apiClient.post(`/clubs/${clubId}/join-request/review`, {
    playerId,
    approved,
    reason,
  });
  return response.data;
};

// Usage
const handleApprove = async (playerId) => {
  try {
    await reviewJoinRequest(clubId, playerId, true);
    alert('Player approved!');
    refetchRequests();
  } catch (error) {
    alert('Failed to approve request');
  }
};

const handleReject = async (playerId) => {
  const reason = prompt('Enter rejection reason (optional):');
  try {
    await reviewJoinRequest(clubId, playerId, false, reason);
    alert('Request rejected');
    refetchRequests();
  } catch (error) {
    alert('Failed to reject request');
  }
};
```

---

### Get Club Members with Roles

Get all club members with their roles (owner, co_owner, member).

**Endpoint:** `GET /api/v1/clubs/:id/members`

**Authentication:** Required (JWT token)

**Success Response:** `200 OK`

```json
[
  {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "role": "owner",
    "joinedAt": "2025-01-15T08:00:00.000Z"
  },
  {
    "playerId": "507f191e810c19729de860eb",
    "playerName": "Jane Smith",
    "playerEmail": "jane@example.com",
    "role": "co_owner",
    "joinedAt": "2025-02-01T09:30:00.000Z"
  }
]
```

---

### Update Member Role

Club owners can promote/demote members. Only owners can change roles.

**Endpoint:** `PATCH /api/v1/clubs/:id/members/role`

**Authentication:** Required (JWT token - must be owner)

**Request Body:**

```json
{
  "playerId": "507f191e810c19729de860eb",
  "newRole": "co_owner"  // 'owner', 'co_owner', or 'member'
}
```

**Success Response:** `200 OK`

---

## Matches

Team-based match management system with captain confirmations, fight tracking, and streak management.

### Match System Overview

**Key Features:**
- **Team-Based Matches**: Exactly 2 teams with minimum 2 players each
- **Match Type Auto-Detection**: Competitive (2 different clubs) or Training (same club/no club)
- **Captain Confirmations**: Both captains must confirm participant involvement and match results
- **Global Streaks**: Career win streaks continue across matches with same-team reset logic
- **Star Trophy System**: Green (7+ streak), Golden (9+ streak), Rainbow (10+ streak)

### Match Object

```typescript
interface Match {
  _id: string;
  name: string;
  description?: string;
  matchType: 'competitive' | 'training';  // Auto-determined
  matchDate: Date;
  organizerId: string;
  status: 'PENDING_CAPTAIN_CONFIRMATION' | 'PENDING_PARTICIPANTS' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  teams: [
    {
      teamId: string;
      teamName: string;
      clubId?: string;
      captain: {
        playerId: string;
        confirmationStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED';
        promotedFrom?: 'ORGANIZER' | 'FIRST_CONFIRMED';
        confirmedAt?: Date;
      };
      players: Array<{
        playerId: string;
        playerName: string;
        confirmationStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED';
        confirmedAt?: Date;
        enteringStreak: number;
        currentStreak: number;
        currentTier?: 'GREEN' | 'GOLDEN' | 'RAINBOW';
      }>;
    },
    // Team 2 has same structure
  ];
  matchResult: {
    winningTeamId?: string;
    status: 'PENDING' | 'DECLARED' | 'DISPUTED' | 'AGREED' | 'ADMIN_RESOLVED';
    declarations: Array<{
      captainId: string;
      teamId: string;
      declaredWinner: string;
      declaredAt: Date;
      confirmationRound: 1 | 2;
    }>;
    resolvedBy?: string;
    finalizedAt?: Date;
  };
  involvedClubs: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Match Status Flow

```
PENDING_CAPTAIN_CONFIRMATION
  ↓ (both captains confirm)
PENDING_PARTICIPANTS
  ↓ (min 4 players confirmed, 2 per team)
ACTIVE
  ↓ (both captains declare same winner)
COMPLETED
```

---

### Create Match

Creates a new team-based match with captain assignments. Match type is automatically determined based on club membership.

**Endpoint:** `POST /api/v1/matches`

**Rate Limit:** 10 requests/minute

**Request Body:**

```json
{
  "name": "Championship Finals 2024",
  "description": "Final match of the season",
  "matchDate": "2024-02-15T14:00:00Z",
  "organizerId": "507f191e810c19729de860ea",
  "team1": {
    "teamName": "Phoenix Warriors",
    "captainId": "507f191e810c19729de860ea",
    "playerIds": [
      "507f191e810c19729de860ea",
      "507f191e810c19729de860eb"
    ],
    "clubId": "507f1f77bcf86cd799439011"  // Optional
  },
  "team2": {
    "teamName": "Dragon Fighters",
    "captainId": "507f191e810c19729de860ec",
    "playerIds": [
      "507f191e810c19729de860ec",
      "507f191e810c19729de860ed"
    ],
    "clubId": "507f1f77bcf86cd799439012"  // Optional
  }
}
```

**Success Response:** `201 Created`

```json
{
  "_id": "65b8f7a2c1d3e4f5a6b7c8d9",
  "name": "Championship Finals 2024",
  "matchType": "competitive",  // Auto-determined: 2 different clubs
  "status": "PENDING_CAPTAIN_CONFIRMATION",
  "matchDate": "2024-02-15T14:00:00.000Z",
  "teams": [
    {
      "teamId": "team-1",
      "teamName": "Phoenix Warriors",
      "clubId": "507f1f77bcf86cd799439011",
      "captain": {
        "playerId": "507f191e810c19729de860ea",
        "confirmationStatus": "PENDING"
      },
      "players": [...]
    },
    {
      "teamId": "team-2",
      "teamName": "Dragon Fighters",
      "clubId": "507f1f77bcf86cd799439012",
      "captain": {
        "playerId": "507f191e810c19729de860ec",
        "confirmationStatus": "PENDING"
      },
      "players": [...]
    }
  ],
  "createdAt": "2024-01-23T10:00:00.000Z"
}
```

**Match Type Rules:**
- **Competitive**: Both teams have clubIds AND they're different
- **Training**: Same club OR no clubs OR mixed club/no-club

**Frontend Example:**

```javascript
// api/matches.js
export const createMatch = async (matchData) => {
  const response = await apiClient.post('/matches', matchData);
  return response.data;
};

// Usage
const handleCreateMatch = async (formData) => {
  try {
    const match = await createMatch({
      name: formData.name,
      description: formData.description,
      matchDate: formData.date,
      organizerId: currentUserId,
      team1: {
        teamName: formData.team1Name,
        captainId: formData.team1Captain,
        playerIds: formData.team1Players,
        clubId: formData.team1Club, // Optional
      },
      team2: {
        teamName: formData.team2Name,
        captainId: formData.team2Captain,
        playerIds: formData.team2Players,
        clubId: formData.team2Club, // Optional
      },
    });
    
    alert(`Match created! Type: ${match.matchType}`);
    navigate(`/matches/${match._id}`);
  } catch (error) {
    setError(error.message);
  }
};
```

---

### Get Match by ID

Retrieves detailed match information including teams, players, and current status.

**Endpoint:** `GET /api/v1/matches/:id`

**Rate Limit:** 100 requests/minute

**Success Response:** `200 OK`

```json
{
  "_id": "65b8f7a2c1d3e4f5a6b7c8d9",
  "name": "Championship Finals 2024",
  "matchType": "competitive",
  "status": "ACTIVE",
  "teams": [
    {
      "teamId": "team-1",
      "teamName": "Phoenix Warriors",
      "captain": {
        "playerId": "507f191e810c19729de860ea",
        "confirmationStatus": "CONFIRMED",
        "confirmedAt": "2024-01-23T10:05:00.000Z"
      },
      "players": [
        {
          "playerId": "507f191e810c19729de860ea",
          "playerName": "John Doe",
          "confirmationStatus": "CONFIRMED",
          "enteringStreak": 5,
          "currentStreak": 5,
          "currentTier": null
        },
        {
          "playerId": "507f191e810c19729de860eb",
          "playerName": "Jane Smith",
          "confirmationStatus": "CONFIRMED",
          "enteringStreak": 8,
          "currentStreak": 8,
          "currentTier": "GREEN"
        }
      ]
    }
  ],
  "statistics": [
    {
      "playerId": "507f191e810c19729de860ea",
      "wins": 3,
      "losses": 1,
      "draws": 0
    }
  ]
}
```

---

### Confirm Participation

Player or captain confirms their participation in the match.

**Endpoint:** `PATCH /api/v1/matches/:id/confirm-participation`

**Rate Limit:** 50 requests/minute

**Request Body:**

```json
{
  "playerId": "507f191e810c19729de860ea"
}
```

**Success Response:** `200 OK`

**Status Transitions:**
- When both captains confirm → `PENDING_PARTICIPANTS`
- Players can now confirm their participation

---

### Start Match

Starts the match after sufficient player confirmations (minimum 4 players, 2 per team).

**Endpoint:** `POST /api/v1/matches/:id/start`

**Rate Limit:** 20 requests/minute

**Request Body:**

```json
{
  "initiatorId": "507f191e810c19729de860ea"
}
```

**Success Response:** `200 OK`

**Actions:**
- Auto-promotes unconfirmed captains (selects first confirmed player)
- Validates minimum 2 confirmed players per team
- Updates player entering streaks from current player data
- Changes status to `ACTIVE`

**Frontend Example:**

```javascript
export const startMatch = async (matchId, initiatorId) => {
  const response = await apiClient.post(`/matches/${matchId}/start`, {
    initiatorId,
  });
  return response.data;
};

const handleStartMatch = async () => {
  try {
    const match = await startMatch(matchId, currentUserId);
    alert('Match started! Fights can now be recorded.');
    refetchMatch();
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      alert('Need at least 2 confirmed players per team');
    }
  }
};
```

---

### Declare Match Winner

Captain declares the winning team. Both captains must agree for the match to complete.

**Endpoint:** `POST /api/v1/matches/:id/result/declare`

**Rate Limit:** 30 requests/minute

**Request Body:**

```json
{
  "captainId": "507f191e810c19729de860ea",
  "winningTeamId": "team-1",
  "confirmationRound": 1  // 1 or 2
}
```

**Success Response:** `200 OK`

**Confirmation Flow:**
1. **Round 1**: First captain declares winner
2. **Round 2**: Second captain declares winner
   - If they agree → Match `COMPLETED`, club stats updated (if competitive)
   - If they disagree → Status becomes `DISPUTED`, admin resolution needed

**Frontend Example:**

```javascript
export const declareWinner = async (matchId, captainId, winningTeamId) => {
  const response = await apiClient.post(`/matches/${matchId}/result/declare`, {
    captainId,
    winningTeamId,
    confirmationRound: 1,
  });
  return response.data;
};

const handleDeclareWinner = async (teamId) => {
  if (!confirm('Declare this team as winner?')) return;
  
  try {
    const match = await declareWinner(matchId, currentCaptainId, teamId);
    
    if (match.matchResult.status === 'AGREED') {
      alert('Match completed! Both captains agreed.');
    } else {
      alert('Winner declared. Waiting for other captain to confirm.');
    }
    
    refetchMatch();
  } catch (error) {
    alert('Failed to declare winner');
  }
};
```

---

### Admin: Resolve Match Dispute

Admin resolves disputed match result when captains disagree.

**Endpoint:** `POST /api/v1/admin/matches/:id/result/resolve`

**Rate Limit:** 50 requests/minute

**Request Body:**

```json
{
  "adminId": "mock-admin-123",
  "winningTeamId": "team-1"
}
```

**Success Response:** `200 OK`

**Actions:**
- Sets final winner
- Updates club stats if competitive match
- Changes status to `COMPLETED`

---

### Admin: Cancel Match

Admin cancels a non-completed match.

**Endpoint:** `DELETE /api/v1/admin/matches/:id`

**Rate Limit:** 50 requests/minute

**Request Body:**

```json
{
  "adminId": "mock-admin-123",
  "reason": "Insufficient participants"
}
```

**Success Response:** `200 OK`

---

## Fights

Individual fight tracking within matches with captain confirmation system and automatic streak/star management.

### Fight System Overview

**Key Features:**
- **Captain Dual-Confirmation**: Both team captains must approve fight results
- **Automatic Stats Tracking**: Training (all fights) and Competitive (competitive matches only)
- **Global Career Streaks**: Win streaks continue across matches
- **Same-Team Reset**: Streak resets to 1 if same-team member fought last
- **Star Trophy Awards**: Automatically awarded when streak ends at tier thresholds
- **Dispute Resolution**: Captains can disagree, triggering admin review

### Fight Object

```typescript
interface Fight {
  _id: string;
  matchId: string;
  matchType: 'competitive' | 'training';  // Denormalized for queries
  reportedBy: {
    reporterId: string;
    reporterName: string;
    teamId: string;
  };
  player1: {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
  };
  player2: {
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
  };
  proposedResult: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
  resultNote?: string;  // Optional, max 500 chars
  status: 'PENDING_CAPTAIN_CONFIRMATION' | 'CONFIRMED' | 'DISPUTED' | 'ADMIN_RESOLVED';
  captainConfirmations: Array<{
    captainId: string;
    captainName: string;
    teamId: string;
    agreedResult: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
    confirmedAt: Date;
    notes?: string;
    confirmationOrder: 1 | 2;
  }>;
  disputeDetails?: {
    reason: string;
    resolvedBy?: string;
    resolvedAt?: Date;
    finalResult?: 'PLAYER1_WIN' | 'PLAYER2_WIN' | 'DRAW';
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Streak & Star System

**Tier Thresholds:**
- **7+ wins**: Green Star 🟢
- **9+ wins**: Golden Star 🟡
- **10+ wins**: Rainbow Star 🌈

**Streak Rules:**
1. Continues across matches and fights
2. Resets to 1 if same-team member fought last in the match
3. Resets to 0 on loss or draw
4. Stars awarded when streak ends (finalized)
5. Best streak always tracked

**Player Stats Structure:**

```typescript
interface PlayerFightStats {
  training: {
    wins: number;
    losses: number;
    draws: number;
  };
  competitive: {  // Subset of training
    wins: number;
    losses: number;
    draws: number;
  };
}

interface CurrentStreak {
  count: number;
  lastFightId: string;
  lastMatchId: string;
  lastFightDate: Date;
  lastTeamId: string;  // For same-team reset detection
  active: boolean;
  currentTier: 'GREEN' | 'GOLDEN' | 'RAINBOW' | null;
}

interface BestStreak {
  count: number;
  achievedAt: Date;
  matchId: string;
  fightId: string;
}

interface StarTrophies {
  green: { count: number };
  golden: { count: number };
  rainbow: { count: number };
}

// Trophy history
interface StarAward {
  tier: 'GREEN' | 'GOLDEN' | 'RAINBOW';
  streakCount: number;
  awardedAt: Date;
  matchId: string;
  fightId: string;
}
```

---

### Report Fight Result

Report a fight result within an active match. Both fighters must be confirmed participants.

**Endpoint:** `POST /api/v1/fights`

**Rate Limit:** 100 requests/minute

**Request Body:**

```json
{
  "matchId": "65b8f7a2c1d3e4f5a6b7c8d9",
  "reporterId": "507f191e810c19729de860ea",
  "player1Id": "507f191e810c19729de860ea",
  "player2Id": "507f191e810c19729de860eb",
  "result": "PLAYER1_WIN",
  "resultNote": "Knockout in round 2"  // Optional, max 500 chars
}
```

**Result Options:**
- `PLAYER1_WIN` - Player 1 wins
- `PLAYER2_WIN` - Player 2 wins
- `DRAW` - Tie

**Success Response:** `201 Created`

```json
{
  "_id": "65b8f7a2c1d3e4f5a6b7c8da",
  "matchId": "65b8f7a2c1d3e4f5a6b7c8d9",
  "matchType": "competitive",
  "status": "PENDING_CAPTAIN_CONFIRMATION",
  "proposedResult": "PLAYER1_WIN",
  "player1": {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "John Doe",
    "teamId": "team-1",
    "teamName": "Phoenix Warriors"
  },
  "player2": {
    "playerId": "507f191e810c19729de860eb",
    "playerName": "Jane Smith",
    "teamId": "team-1",
    "teamName": "Phoenix Warriors"
  },
  "createdAt": "2024-01-23T10:30:00.000Z"
}
```

**Validations:**
- Match must be ACTIVE
- Reporter must be a confirmed participant
- Both players must be confirmed participants
- Players cannot fight themselves

**Frontend Example:**

```javascript
// api/fights.js
export const reportFight = async (fightData) => {
  const response = await apiClient.post('/fights', fightData);
  return response.data;
};

// Usage
const handleReportFight = async (formData) => {
  try {
    const fight = await reportFight({
      matchId: currentMatchId,
      reporterId: currentUserId,
      player1Id: formData.fighter1,
      player2Id: formData.fighter2,
      result: formData.result, // 'PLAYER1_WIN', 'PLAYER2_WIN', 'DRAW'
      resultNote: formData.notes,
    });
    
    alert('Fight reported! Waiting for captain confirmations.');
    refetchFights();
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      alert(error.message);
    } else {
      alert('Failed to report fight');
    }
  }
};
```

---

### Confirm Fight Result

Captain confirms or disputes a reported fight result.

**Endpoint:** `POST /api/v1/fights/:id/confirm`

**Rate Limit:** 100 requests/minute

**Request Body:**

```json
{
  "captainId": "507f191e810c19729de860ea",
  "agreedResult": "PLAYER1_WIN",
  "notes": "Confirmed, clean win"  // Optional
}
```

**Success Response:** `200 OK`

**Confirmation Flow:**

1. **First Captain Confirms**:
   - Adds confirmation to array
   - Status remains `PENDING_CAPTAIN_CONFIRMATION`

2. **Second Captain Confirms**:
   - **If results match**: 
     - Status → `CONFIRMED`
     - Player stats updated (training + competitive if applicable)
     - Streaks updated automatically
     - Stars awarded if streak reaches tier
   - **If results differ**:
     - Status → `DISPUTED`
     - Admin resolution required

**Automatic Updates on Confirmation:**

```javascript
// What happens when both captains agree:
{
  "fight": {
    "status": "CONFIRMED",
    "captainConfirmations": [
      {
        "captainId": "captain1",
        "agreedResult": "PLAYER1_WIN",
        "confirmationOrder": 1
      },
      {
        "captainId": "captain2",
        "agreedResult": "PLAYER1_WIN",
        "confirmationOrder": 2
      }
    ]
  },
  "playerUpdates": {
    "winner": {
      "fightStats": {
        "training": { "wins": 6 },  // Always updated
        "competitive": { "wins": 3 }  // Updated if matchType=competitive
      },
      "currentStreak": {
        "count": 6,  // Or reset to 1 if same-team reset triggered
        "currentTier": null  // GREEN/GOLDEN/RAINBOW when threshold reached
      },
      "starTrophies": {
        // Stars awarded when streak ends, not during
      }
    },
    "loser": {
      "fightStats": {
        "training": { "losses": 2 },
        "competitive": { "losses": 1 }
      },
      "currentStreak": {
        "count": 0,  // Streak finalized and reset
        "active": false
      },
      "stars": [
        // Star added if previous streak was at tier level (7+, 9+, 10+)
        {
          "tier": "GREEN",
          "streakCount": 7,
          "awardedAt": "2024-01-23T10:30:00Z"
        }
      ]
    }
  }
}
```

**Frontend Example:**

```javascript
export const confirmFight = async (fightId, captainId, agreedResult, notes) => {
  const response = await apiClient.post(`/fights/${fightId}/confirm`, {
    captainId,
    agreedResult,
    notes,
  });
  return response.data;
};

const FightConfirmationButton = ({ fight, currentCaptain }) => {
  const [selectedResult, setSelectedResult] = useState(fight.proposedResult);
  
  const handleConfirm = async () => {
    try {
      const updatedFight = await confirmFight(
        fight._id,
        currentCaptain._id,
        selectedResult,
        ''
      );
      
      if (updatedFight.status === 'CONFIRMED') {
        alert('Fight confirmed! Player stats updated.');
      } else if (updatedFight.status === 'DISPUTED') {
        alert('Captains disagree! Admin resolution required.');
      } else {
        alert('Confirmation recorded. Waiting for other captain.');
      }
      
      refetchFights();
    } catch (error) {
      alert('Failed to confirm fight');
    }
  };
  
  return (
    <div className="fight-confirmation">
      <h4>Confirm Fight Result</h4>
      <p>Proposed: {fight.proposedResult}</p>
      
      <select
        value={selectedResult}
        onChange={(e) => setSelectedResult(e.target.value)}
      >
        <option value="PLAYER1_WIN">Player 1 Wins</option>
        <option value="PLAYER2_WIN">Player 2 Wins</option>
        <option value="DRAW">Draw</option>
      </select>
      
      <button onClick={handleConfirm}>
        Confirm as Captain
      </button>
    </div>
  );
};
```

---

### Get Fight by ID

Retrieves detailed fight information including confirmation status.

**Endpoint:** `GET /api/v1/fights/:id`

**Rate Limit:** 100 requests/minute

**Success Response:** `200 OK`

---

### Get Match Fights

Retrieves all fights for a specific match with optional status filtering.

**Endpoint:** `GET /api/v1/fights/match/:matchId`

**Rate Limit:** 100 requests/minute

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `PENDING_CAPTAIN_CONFIRMATION`, `CONFIRMED`, `DISPUTED`, `ADMIN_RESOLVED` |

**Success Response:** `200 OK`

```json
[
  {
    "_id": "65b8f7a2c1d3e4f5a6b7c8da",
    "matchId": "65b8f7a2c1d3e4f5a6b7c8d9",
    "status": "CONFIRMED",
    "player1": {
      "playerName": "John Doe",
      "teamName": "Phoenix Warriors"
    },
    "player2": {
      "playerName": "Jane Smith",
      "teamName": "Phoenix Warriors"
    },
    "proposedResult": "PLAYER1_WIN",
    "captainConfirmations": [...]
  }
]
```

**Frontend Example:**

```javascript
export const getMatchFights = async (matchId, status) => {
  const params = status ? `?status=${status}` : '';
  const response = await apiClient.get(`/fights/match/${matchId}${params}`);
  return response.data;
};

const MatchFightsView = ({ matchId }) => {
  const [fights, setFights] = useState([]);
  const [filter, setFilter] = useState('all');
  
  useEffect(() => {
    const loadFights = async () => {
      const status = filter === 'all' ? undefined : filter;
      const data = await getMatchFights(matchId, status);
      setFights(data);
    };
    loadFights();
  }, [matchId, filter]);
  
  return (
    <div>
      <h3>Match Fights</h3>
      
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All Fights</option>
        <option value="PENDING_CAPTAIN_CONFIRMATION">Pending</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="DISPUTED">Disputed</option>
      </select>
      
      <div className="fights-list">
        {fights.map(fight => (
          <FightCard key={fight._id} fight={fight} />
        ))}
      </div>
    </div>
  );
};
```

---

### Admin: Resolve Fight Dispute

Admin resolves a disputed fight when captains disagree on the result.

**Endpoint:** `POST /api/v1/admin/fights/:id/resolve`

**Rate Limit:** 50 requests/minute

**Request Body:**

```json
{
  "adminId": "mock-admin-123",
  "finalResult": "PLAYER1_WIN"
}
```

**Success Response:** `200 OK`

**Actions:**
- Sets final result
- Updates player stats with admin's decision
- Updates streaks and awards stars if applicable
- Changes status to `ADMIN_RESOLVED`

---

### Player Profile with Stats

Complete example showing how to display player statistics with new match system data:

```javascript
// components/PlayerProfile.jsx
import { useState, useEffect } from 'react';
import { getPlayerById } from '../api/players';

const PlayerProfile = ({ playerId }) => {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayer = async () => {
      try {
        const data = await getPlayerById(playerId, true);
        setPlayer(data);
      } catch (error) {
        console.error('Failed to load player:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPlayer();
  }, [playerId]);

  if (loading) return <div>Loading...</div>;
  if (!player) return <div>Player not found</div>;

  const totalTraining = 
    player.fightStats.training.wins +
    player.fightStats.training.losses +
    player.fightStats.training.draws;
    
  const totalCompetitive =
    player.fightStats.competitive.wins +
    player.fightStats.competitive.losses +
    player.fightStats.competitive.draws;

  return (
    <div className="player-profile">
      <header>
        <h1>{player.name}</h1>
        <p>{player.email}</p>
      </header>

      {/* Current Streak */}
      {player.currentStreak.active && (
        <div className="current-streak">
          <h3>🔥 Active Streak: {player.currentStreak.count} wins</h3>
          {player.currentStreak.currentTier && (
            <span className={`tier-badge ${player.currentStreak.currentTier}`}>
              {player.currentStreak.currentTier} TIER
            </span>
          )}
        </div>
      )}

      {/* Best Streak */}
      {player.bestStreak.count > 0 && (
        <div className="best-streak">
          <h3>🏆 Best Streak: {player.bestStreak.count} wins</h3>
          <small>Achieved on {new Date(player.bestStreak.achievedAt).toLocaleDateString()}</small>
        </div>
      )}

      {/* Star Trophies */}
      <div className="star-trophies">
        <h3>⭐ Star Trophies</h3>
        <div className="trophies-grid">
          <div className="trophy green">
            <span className="emoji">🟢</span>
            <span className="count">{player.starTrophies.green.count}</span>
            <span className="label">Green Stars</span>
          </div>
          <div className="trophy golden">
            <span className="emoji">🟡</span>
            <span className="count">{player.starTrophies.golden.count}</span>
            <span className="label">Golden Stars</span>
          </div>
          <div className="trophy rainbow">
            <span className="emoji">🌈</span>
            <span className="count">{player.starTrophies.rainbow.count}</span>
            <span className="label">Rainbow Stars</span>
          </div>
        </div>
      </div>

      {/* Fight Statistics */}
      <div className="fight-stats">
        <div className="stats-section">
          <h3>Training Stats (All Fights)</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{player.fightStats.training.wins}</span>
              <span className="label">Wins</span>
            </div>
            <div className="stat">
              <span className="value">{player.fightStats.training.losses}</span>
              <span className="label">Losses</span>
            </div>
            <div className="stat">
              <span className="value">{player.fightStats.training.draws}</span>
              <span className="label">Draws</span>
            </div>
            <div className="stat">
              <span className="value">{totalTraining}</span>
              <span className="label">Total</span>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <h3>Competitive Stats</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="value">{player.fightStats.competitive.wins}</span>
              <span className="label">Wins</span>
            </div>
            <div className="stat">
              <span className="value">{player.fightStats.competitive.losses}</span>
              <span className="label">Losses</span>
            </div>
            <div className="stat">
              <span className="value">{player.fightStats.competitive.draws}</span>
              <span className="label">Draws</span>
            </div>
            <div className="stat">
              <span className="value">{totalCompetitive}</span>
              <span className="label">Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Star History */}
      {player.stars && player.stars.length > 0 && (
        <div className="star-history">
          <h3>Star Award History</h3>
          <ul>
            {player.stars.map((star, index) => (
              <li key={index}>
                <span className={`tier-badge ${star.tier}`}>{star.tier}</span>
                <span>{star.streakCount} win streak</span>
                <span>{new Date(star.awardedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
```

---

## Admin

All admin endpoints require authentication (currently placeholder).

### Get Pending Players

**Endpoint:** `GET /api/v1/admin/players/pending`

**Query Parameters:** page, limit

**Response:** `200 OK` - Paginated list of pending players

---

### Approve Player

**Endpoint:** `POST /api/v1/admin/players/:id/approve`

**Response:** `200 OK`

**Actions:**
- Sets status to `approved`
- Logs audit entry
- Triggers `PLAYER_APPROVED` notification

---

### Reject Player

**Endpoint:** `POST /api/v1/admin/players/:id/reject`

**Request Body:**

```json
{
  "reason": "Incomplete information provided"
}
```

**Response:** `200 OK`

**Actions:**
- Sets status to `rejected`
- Stores rejection reason
- Logs audit entry
- Triggers `PLAYER_REJECTED` notification

---

### Get Player Deletion Requests

**Endpoint:** `GET /api/v1/admin/players/deletion-requests`

**Response:** `200 OK` - Paginated list of players requesting deletion

---

### Confirm Player Deletion

**Endpoint:** `POST /api/v1/admin/players/:id/confirm-deletion`

**Request Body:**

```json
{
  "reason": "User requested account deletion"  // Optional
}
```

**Response:** `200 OK`

**Actions:**
- Soft deletes player (sets `deletedAt`)
- Removes player from all clubs (transaction)
- Logs audit entry
- Triggers `PLAYER_DELETED` notification

---

### Club Admin Endpoints

Same pattern as players:

- `GET /api/v1/admin/clubs/pending`
- `POST /api/v1/admin/clubs/:id/approve`
- `POST /api/v1/admin/clubs/:id/reject`
- `GET /api/v1/admin/clubs/deletion-requests`
- `POST /api/v1/admin/clubs/:id/confirm-deletion`

---

### Get Audit Logs

**Endpoint:** `GET /api/v1/admin/audit-logs`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `resourceType` | string | Filter by `player` or `club` |
| `resourceId` | string | Filter by resource ID |

**Response:** `200 OK`

```json
{
  "data": [
    {
      "_id": "...",
      "adminId": "mock-admin-123",
      "action": "approve",
      "resourceType": "player",
      "resourceId": "507f191e810c19729de860ea",
      "details": {},
      "createdAt": "2024-01-23T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

**Features:**
- Audit logs have 90-day TTL (configurable)
- Minimal data stored (adminId reference only)
- Cannot be deleted or modified

---

## Health

### Health Check

**Endpoint:** `GET /api/v1/health`

**Response:** `200 OK` (healthy) or `503 Service Unavailable` (unhealthy)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-23T10:30:00.000Z",
  "uptime": 3600,
  "database": {
    "connected": true,
    "status": "connected"
  },
  "memory": {
    "heapUsed": "45 MB",
    "heapTotal": "60 MB",
    "rss": "120 MB"
  }
}
```

---

## Approval Workflow

### Player/Club Registration Flow

```
1. User creates resource
   ↓
2. Status = PENDING
   ↓
3. Admin reviews from /admin/*/pending
   ↓
4a. APPROVE                    4b. REJECT
    ↓                              ↓
    Status = APPROVED              Status = REJECTED
    ↓                              ↓
    Notification sent              Rejection reason + Notification
```

### Deletion Flow

```
1. User requests deletion
   ↓
2. deletionRequested = true
   ↓
3. Admin reviews from /admin/*/deletion-requests
   ↓
4. Admin confirms deletion
   ↓
5. Soft delete (deletedAt set)
   ↓
6. Remove from all relations (transaction)
   ↓
7. Notification sent
```

---

## Notification Events

### Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| **Player Events** | | |
| `PLAYER_APPROVED` | Admin approves player | Player ID, name, email |
| `PLAYER_REJECTED` | Admin rejects player | Player ID, name, email, reason |
| `PLAYER_DELETED` | Admin confirms deletion | Player ID, name, email |
| **Club Events** | | |
| `CLUB_APPROVED` | Admin approves club | Club ID, name |
| `CLUB_REJECTED` | Admin rejects club | Club ID, name, reason |
| `CLUB_DELETED` | Admin confirms deletion | Club ID, name |
| **Match Events** | | |
| `CAPTAIN_ASSIGNED` | Captain assigned to team | Match ID, captain ID, team name |
| `CAPTAIN_AUTO_PROMOTED` | Captain auto-promoted on match start | Match ID, captain ID, team name |
| `PARTICIPANT_INVITED` | Player invited to match | Match ID, participant IDs, match date |
| `MATCH_STARTING` | Match begins (status=ACTIVE) | Match ID, all participant IDs |
| `MATCH_WINNER_DECLARED` | Captain declares winner | Match ID, captain ID, winning team, participants |
| `MATCH_RESULT_DISPUTED` | Captains disagree on winner | Match ID, all participants |
| `MATCH_RECONFIRMATION_REQUESTED` | Second round confirmation needed | Match ID, captain ID, participants |
| `MATCH_COMPLETED` | Match finishes (both captains agree) | Match ID, winning team, participants |
| `MATCH_CANCELLED` | Admin cancels match | Match ID, reason, participants |
| **Fight Events** | | |
| `FIGHT_REPORTED` | Fight result reported | Fight ID, match ID, players, reporter |
| `FIGHT_CAPTAIN_APPROVAL_NEEDED` | Captain needs to confirm fight | Fight ID, captain ID, players, result |
| `FIGHT_CONFIRMED` | Both captains confirmed fight | Fight ID, match ID, players, final result |
| `FIGHT_DISPUTED` | Captains disagree on fight result | Fight ID, match ID, players |
| **Streak & Star Events** | | |
| `STAR_TIER_REACHED` | Player reaches star tier (7/9/10) | Player ID, tier, streak count, match ID, team |
| `STREAK_FINALIZED` | Player's streak ends | Player ID, final count, tier, match ID |
| `STARS_EARNED` | Stars awarded to player | Player ID, tier, total stars, match ID, team |
| `STREAK_RESET` | Streak reset (same-team/loss/draw) | Player ID, previous streak, reason, match ID |
| `BEST_STREAK_UPDATED` | New personal best streak | Player ID, new best, previous best, match ID |

### Notification System

**Queue Processing:**
- Worker runs every minute (configurable via cron)
- Failed notifications retry with exponential backoff
- Max 3 retry attempts (configurable)
- Backoff: 2^retryCount minutes

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: After 2 minutes
- Attempt 3: After 4 minutes
- Attempt 4: After 8 minutes (final)

**Status Flow:**
```
PENDING → (success) → SENT
        → (failure) → PENDING (retry scheduled)
        → (max retries) → FAILED
```

**Current Implementation:**
- Notifications logged to console (placeholder)
- Ready for email/SMS/push integration

---

## API Versioning Strategy

### Current Version: v1

All endpoints are prefixed with `/api/v1/`

### Versioning Approach

**URI Versioning** is used for clear, explicit version identification.

### Version Lifecycle

1. **Current (v1)** - Stable, production-ready
2. **Deprecated** - Marked for removal, supported for 6 months
3. **Sunset** - No longer supported

### Future v2 Migration

When breaking changes are needed:

1. New endpoints under `/api/v2/`
2. v1 remains available
3. Deprecation notice in v1 responses:
   ```json
   {
     "deprecation": {
       "version": "v1",
       "sunset": "2025-06-01",
       "message": "Please migrate to v2",
       "migrationGuide": "https://docs.example.com/v2"
     }
   }
   ```
4. v1 sunset after 6 months

### Breaking vs Non-Breaking Changes

**Non-Breaking (v1.x):**
- Adding new endpoints
- Adding optional fields
- Adding new query parameters
- Performance improvements

**Breaking (v2.0):**
- Removing endpoints
- Changing required fields
- Modifying response structure
- Changing authentication method

### Deprecation Policy

- Minimum 6 months notice
- Documented in API changelog
- Deprecation warnings in responses
- Migration guide provided

---

## Frontend Integration Examples

Complete examples for common frontend workflows.

### Complete Player Registration Flow

```javascript
// components/PlayerRegistrationForm.jsx
import { useState } from 'react';
import { createPlayer, getPlayers } from '../api/players';

function PlayerRegistrationForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError(null);

    try {
      const newPlayer = await createPlayer(formData);
      
      setStatus('success');
      
      // Show success message with pending status info
      alert(`Registration successful! 
        Name: ${newPlayer.name}
        Email: ${newPlayer.email}
        Status: ${newPlayer.status}
        
        Your account is pending admin approval.`);
      
      // Reset form
      setFormData({ name: '', email: '' });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/players';
      }, 2000);
      
    } catch (err) {
      setStatus('error');
      
      // Handle specific error cases
      switch (err.code) {
        case 'DUPLICATE_ERROR':
          setError('This email is already registered. Please use a different email.');
          break;
        case 'VALIDATION_ERROR':
          setError('Please check your input and try again.');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          setError('Too many requests. Please wait a moment and try again.');
          break;
        default:
          setError('Registration failed. Please try again later.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Player Registration</h2>
      
      {status === 'success' && (
        <div className="alert alert-success">
          Registration successful! Pending admin approval.
        </div>
      )}
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      <div className="form-group">
        <label>Name:</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          minLength={2}
          maxLength={100}
          disabled={status === 'loading'}
        />
      </div>
      
      <div className="form-group">
        <label>Email:</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={status === 'loading'}
        />
      </div>
      
      <button 
        type="submit" 
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Registering...' : 'Register'}
      </button>
      
      <p className="help-text">
        Note: All registrations require admin approval before activation.
      </p>
    </form>
  );
}
```

### Player List with Search and Pagination

```javascript
// components/PlayersListPage.jsx
import { useState } from 'react';
import { usePlayers } from '../hooks/usePlayers';
import { requestPlayerDeletion } from '../api/players';

function PlayersListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  const { players, pagination, loading, error, refetch } = usePlayers({
    page,
    limit: 10,
    search,
    populate: 'clubs',
    sort: '-createdAt',
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1); // Reset to first page
  };

  const handleDeleteRequest = async (playerId, playerName) => {
    if (!confirm(`Request deletion for ${playerName}?`)) return;
    
    try {
      await requestPlayerDeletion(playerId);
      alert('Deletion request submitted. Waiting for admin approval.');
      refetch();
    } catch (err) {
      alert('Failed to request deletion');
    }
  };

  if (loading) {
    return <div className="loading">Loading players...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error loading players: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div className="players-page">
      <h1>Players Directory</h1>
      
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">Search</button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setPage(1);
            }}
          >
            Clear
          </button>
        )}
      </form>
      
      {/* Results Count */}
      {pagination && (
        <p className="results-info">
          Showing {players.length} of {pagination.total} players
          {search && ` matching "${search}"`}
        </p>
      )}
      
      {/* Players List */}
      {players.length === 0 ? (
        <p className="no-results">No players found.</p>
      ) : (
        <div className="players-grid">
          {players.map((player) => (
            <div key={player._id} className="player-card">
              <h3>{player.name}</h3>
              <p className="email">{player.email}</p>
              
              <div className="status-badge">
                Status: <span className={`status-${player.status}`}>
                  {player.status}
                </span>
              </div>
              
              <div className="clubs-info">
                <strong>Clubs ({player.clubs.length}):</strong>
                {player.clubs.length > 0 ? (
                  <ul>
                    {player.clubs.map((club) => (
                      <li key={club._id}>{club.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No clubs</p>
                )}
              </div>
              
              <div className="actions">
                <a href={`/players/${player._id}`}>View Details</a>
                <button
                  onClick={() => handleDeleteRequest(player._id, player.name)}
                  className="btn-danger"
                  disabled={player.deletionRequested}
                >
                  {player.deletionRequested ? 'Deletion Pending' : 'Request Deletion'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            ← Previous
          </button>
          
          <span className="page-info">
            Page {page} of {pagination.pages}
          </span>
          
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === pagination.pages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
```

### Club Membership Management

```javascript
// components/ClubMembershipManager.jsx
import { useState, useEffect } from 'react';
import { getPlayerById, joinClub, leaveClub } from '../api/players';
import { getAllClubs } from '../api/clubs';

function ClubMembershipManager({ playerId }) {
  const [player, setPlayer] = useState(null);
  const [availableClubs, setAvailableClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [playerData, clubsData] = await Promise.all([
        getPlayerById(playerId, true), // with populate
        getAllClubs({ page: 1, limit: 100 }),
      ]);
      
      setPlayer(playerData);
      
      // Filter out clubs player is already in
      const playerClubIds = playerData.clubs.map(c => c._id);
      const available = clubsData.data.filter(
        club => !playerClubIds.includes(club._id)
      );
      setAvailableClubs(available);
    } catch (err) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async (clubId, clubName) => {
    if (!confirm(`Join ${clubName}?`)) return;
    
    setActionLoading(true);
    try {
      const updated = await joinClub(playerId, clubId);
      alert(`Successfully joined ${clubName}!`);
      await loadData(); // Refresh data
    } catch (err) {
      if (err.code === 'DUPLICATE_ERROR') {
        alert('Already a member of this club');
      } else {
        alert('Failed to join club');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveClub = async (clubId, clubName) => {
    if (!confirm(`Leave ${clubName}?`)) return;
    
    setActionLoading(true);
    try {
      await leaveClub(playerId, clubId);
      alert(`Left ${clubName}`);
      await loadData(); // Refresh data
    } catch (err) {
      alert('Failed to leave club');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!player) return <div>Player not found</div>;

  return (
    <div className="membership-manager">
      <h2>Club Membership for {player.name}</h2>
      
      {/* Current Clubs */}
      <section className="current-clubs">
        <h3>Current Clubs ({player.clubs.length})</h3>
        {player.clubs.length === 0 ? (
          <p>Not a member of any clubs</p>
        ) : (
          <div className="clubs-list">
            {player.clubs.map((club) => (
              <div key={club._id} className="club-card">
                <h4>{club.name}</h4>
                {club.description && <p>{club.description}</p>}
                <button
                  onClick={() => handleLeaveClub(club._id, club.name)}
                  disabled={actionLoading}
                  className="btn-secondary"
                >
                  Leave Club
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* Available Clubs */}
      <section className="available-clubs">
        <h3>Available Clubs ({availableClubs.length})</h3>
        {availableClubs.length === 0 ? (
          <p>No available clubs to join</p>
        ) : (
          <div className="clubs-list">
            {availableClubs.map((club) => (
              <div key={club._id} className="club-card">
                <h4>{club.name}</h4>
                {club.description && <p>{club.description}</p>}
                <button
                  onClick={() => handleJoinClub(club._id, club.name)}
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  Join Club
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Admin Dashboard for Approvals

```javascript
// components/AdminApprovalsDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  getPendingPlayers, 
  approvePlayer, 
  rejectPlayer 
} from '../api/admin';

function AdminApprovalsDashboard() {
  const [pendingPlayers, setPendingPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadPendingPlayers();
  }, []);

  const loadPendingPlayers = async () => {
    setLoading(true);
    try {
      const response = await getPendingPlayers({ page: 1, limit: 50 });
      setPendingPlayers(response.data);
    } catch (err) {
      alert('Failed to load pending players');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (playerId, playerName) => {
    if (!confirm(`Approve ${playerName}?`)) return;
    
    setActionLoading(playerId);
    try {
      await approvePlayer(playerId);
      alert(`${playerName} approved successfully!`);
      await loadPendingPlayers(); // Refresh list
    } catch (err) {
      alert('Failed to approve player');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (playerId, playerName) => {
    const reason = prompt(`Enter rejection reason for ${playerName}:`);
    if (!reason) return;
    
    setActionLoading(playerId);
    try {
      await rejectPlayer(playerId, reason);
      alert(`${playerName} rejected`);
      await loadPendingPlayers(); // Refresh list
    } catch (err) {
      alert('Failed to reject player');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div>Loading pending approvals...</div>;

  return (
    <div className="admin-dashboard">
      <h1>Pending Player Approvals</h1>
      
      {pendingPlayers.length === 0 ? (
        <p>No pending approvals</p>
      ) : (
        <>
          <p className="count">{pendingPlayers.length} players waiting for approval</p>
          
          <div className="approvals-list">
            {pendingPlayers.map((player) => (
              <div key={player._id} className="approval-card">
                <div className="player-info">
                  <h3>{player.name}</h3>
                  <p>{player.email}</p>
                  <small>
                    Registered: {new Date(player.createdAt).toLocaleDateString()}
                  </small>
                  {player.clubs.length > 0 && (
                    <p>Requested clubs: {player.clubs.length}</p>
                  )}
                </div>
                
                <div className="actions">
                  <button
                    onClick={() => handleApprove(player._id, player.name)}
                    disabled={actionLoading === player._id}
                    className="btn-success"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(player._id, player.name)}
                    disabled={actionLoading === player._id}
                    className="btn-danger"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## UI State Management

Best practices for managing API state in your frontend application.

### Status Display

```javascript
// utils/statusHelpers.js

export const STATUS_COLORS = {
  pending: '#FFA500',    // Orange
  approved: '#4CAF50',   // Green
  rejected: '#F44336',   // Red
};

export const STATUS_LABELS = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function getStatusBadge(status) {
  return {
    text: STATUS_LABELS[status] || status,
    color: STATUS_COLORS[status] || '#999',
    className: `status-${status}`,
  };
}

// Usage in component
function PlayerStatus({ status, rejectionReason }) {
  const badge = getStatusBadge(status);
  
  return (
    <div className={`status-badge ${badge.className}`}>
      <span style={{ backgroundColor: badge.color }}>
        {badge.text}
      </span>
      {status === 'rejected' && rejectionReason && (
        <div className="rejection-reason">
          <small>Reason: {rejectionReason}</small>
        </div>
      )}
    </div>
  );
}
```

### Error Handling Utility

```javascript
// utils/errorHandler.js

export class APIError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'APIError';
  }
}

export function handleAPIError(error, context = '') {
  console.error(`API Error${context ? ` [${context}]` : ''}:`, error);
  
  const messages = {
    NOT_FOUND: 'Resource not found',
    DUPLICATE_ERROR: 'This record already exists',
    VALIDATION_ERROR: 'Please check your input',
    RATE_LIMIT_EXCEEDED: 'Too many requests, please slow down',
    UNAUTHORIZED: 'Please log in to continue',
    INTERNAL_SERVER_ERROR: 'Server error, please try again later',
  };
  
  return messages[error.code] || error.message || 'An error occurred';
}

// Usage
try {
  await createPlayer(data);
} catch (error) {
  const userMessage = handleAPIError(error, 'Create Player');
  setError(userMessage);
}
```

### Loading States

```javascript
// hooks/useLoadingState.js
import { useState } from 'react';

export function useLoadingState(initialState = false) {
  const [loading, setLoading] = useState(initialState);
  const [error, setError] = useState(null);

  const withLoading = async (asyncFn) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFn();
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, setError, withLoading };
}

// Usage
function MyComponent() {
  const { loading, error, withLoading } = useLoadingState();
  
  const handleAction = () => {
    withLoading(async () => {
      const data = await createPlayer({ name, email });
      // Success handling
    }).catch(() => {
      // Error already set in hook
    });
  };
  
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <div>...</div>;
}
```

### Workflow State Machine

```javascript
// utils/workflowStates.js

export const PLAYER_WORKFLOW = {
  // Initial state after registration
  PENDING: {
    canEdit: true,
    canDelete: true,
    canJoinClubs: false,
    message: 'Awaiting admin approval',
    nextStates: ['APPROVED', 'REJECTED'],
  },
  
  // After admin approval
  APPROVED: {
    canEdit: true,
    canDelete: true,
    canJoinClubs: true,
    message: 'Active player',
    nextStates: ['DELETION_REQUESTED'],
  },
  
  // After admin rejection
  REJECTED: {
    canEdit: false,
    canDelete: true,
    canJoinClubs: false,
    message: 'Registration rejected',
    nextStates: [],
  },
  
  // After requesting deletion
  DELETION_REQUESTED: {
    canEdit: false,
    canDelete: false,
    canJoinClubs: false,
    message: 'Deletion pending admin confirmation',
    nextStates: ['DELETED'],
  },
};

export function getPlayerCapabilities(player) {
  const state = player.deletionRequested 
    ? PLAYER_WORKFLOW.DELETION_REQUESTED 
    : PLAYER_WORKFLOW[player.status.toUpperCase()];
    
  return state || {};
}

// Usage in component
function PlayerActions({ player }) {
  const capabilities = getPlayerCapabilities(player);
  
  return (
    <div className="player-actions">
      <p className="status-message">{capabilities.message}</p>
      
      {capabilities.canEdit && (
        <button onClick={handleEdit}>Edit Profile</button>
      )}
      
      {capabilities.canJoinClubs && (
        <button onClick={handleManageClubs}>Manage Clubs</button>
      )}
      
      {capabilities.canDelete && (
        <button onClick={handleRequestDeletion}>Request Deletion</button>
      )}
    </div>
  );
}
```

### Optimistic Updates

```javascript
// Example: Optimistic club join
async function optimisticJoinClub(playerId, clubId, clubData) {
  // Optimistically update UI
  const optimisticPlayer = {
    ...currentPlayer,
    clubs: [...currentPlayer.clubs, clubData],
  };
  setPlayer(optimisticPlayer);
  
  try {
    // Make actual API call
    const updatedPlayer = await joinClub(playerId, clubId);
    // Update with real data
    setPlayer(updatedPlayer);
    showSuccess('Joined club successfully!');
  } catch (error) {
    // Revert on error
    setPlayer(currentPlayer);
    showError('Failed to join club');
  }
}
```

---

## Additional Resources

- **Swagger UI:** http://localhost:3000/api/docs
- **GitHub Repository:** [Link to repo]
- **Issue Tracker:** [Link to issues]

---

## Changelog

### v1.0.0 (2024-01-23)

Initial release with:
- Player and club management
- Admin approval workflow
- Notification system
- Audit logging
- Rate limiting
- OpenAPI documentation
