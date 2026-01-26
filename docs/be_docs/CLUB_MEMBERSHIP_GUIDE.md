# Club Membership Complete Guide

**Complete guide for implementing club membership features in your frontend application.**

## Table of Contents
- [Overview](#overview)
- [Role-Based Access System](#role-based-access-system)
- [Join Request Workflow](#join-request-workflow)
- [API Endpoints](#api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Common Issues](#common-issues)

---

## Overview

The Kite Fighter API includes a comprehensive role-based club membership system with an approval workflow. Players can request to join clubs, and club owners/co-owners can approve or reject these requests.

### Key Features
- ✅ Role-based access (Owner, Co-Owner, Member)
- ✅ Join request approval workflow
- ✅ Member role management
- ✅ Automatic owner assignment on club creation
- ✅ Real-time notifications via WebSocket

---

## Role-Based Access System

### Member Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control: manage members, change roles, approve/reject requests, update club details |
| **Co-Owner** | Approve/reject join requests, view member list |
| **Member** | Basic membership, can participate in matches |

### Automatic Owner Assignment
When a club is created, the creator is automatically assigned as the owner.

---

## Join Request Workflow

```
Player → Submit Request → Pending → Owner/Co-Owner Reviews → Approved/Rejected
                                          ↓
                                  Notifications Sent
```

**Steps:**
1. Player submits join request to a club
2. Request sent to all owners and co-owners
3. Owner/Co-owner reviews and approves/rejects
4. Player receives notification
5. If approved, player added as member with "member" role

---

## API Endpoints

### Base URLs
- **Production:** `https://api.kitefighters.in/api/v1`
- **App Runner:** `https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1`
- **Development:** `http://localhost:3000/api/v1`

### Player Endpoints

#### 1. Request to Join Club

**Endpoint:** `POST /membership/join-request`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "clubId": "6975ad62a0f3ab04c1cd0b11",
  "message": "I would like to join your club" // Optional, max 500 chars
}
```

**Success Response (201):**
```json
{
  "message": "Join request submitted successfully. Awaiting club owner approval.",
  "club": {
    "_id": "6975ad62a0f3ab04c1cd0b11",
    "name": "Phoenix Warriors",
    "joinRequests": [...]
  }
}
```

**Error Responses:**
- `409 Conflict` - Already a member or pending request exists
- `404 Not Found` - Club not found
- `401 Unauthorized` - Missing or invalid token

#### 2. Cancel Join Request

**Endpoint:** `DELETE /clubs/:clubId/join-request`

**Authentication:** Required

**URL Parameters:**
- `clubId` - Club ObjectId (24 character hex string)

**No Request Body Required**

**Success Response (200):**
```json
{
  "message": "Join request cancelled successfully.",
  "club": { ... }
}
```

### Club Owner/Co-Owner Endpoints

#### 3. Get Pending Join Requests

**Endpoint:** `GET /clubs/:clubId/join-requests`

**Authentication:** Required (Must be owner or co-owner)

**Success Response (200):**
```json
[
  {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "message": "I want to join",
    "requestedAt": "2026-01-25T10:00:00.000Z",
    "status": "pending"
  }
]
```

#### 4. Approve/Reject Join Request

**Endpoint:** `POST /clubs/:clubId/join-request/review`

**Authentication:** Required (Must be owner or co-owner)

**Request Body:**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": true, // true to approve, false to reject
  "rejectionReason": "Optional reason if rejecting (required if approved is false)"
}
```

**Success Response (200):**
```json
{
  "message": "Join request approved successfully.",
  "club": { ... }
}
```

#### 5. Get Club Members with Roles

**Endpoint:** `GET /clubs/:clubId/members`

**Authentication:** Required

**Success Response (200):**
```json
{
  "members": [
    {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "owner",
      "joinedAt": "2026-01-20T10:00:00.000Z"
    }
  ]
}
```

#### 6. Update Member Role

**Endpoint:** `PATCH /clubs/:clubId/members/role`

**Authentication:** Required (Owner only)

**Request Body:**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "role": "co_owner" // "owner", "co_owner", or "member"
}
```

**Success Response (200):**
```json
{
  "message": "Member role updated successfully.",
  "member": {
    "playerId": "507f191e810c19729de860ea",
    "role": "co-owner"
  }
}
```

---

## Frontend Integration

### React + Axios Example

```javascript
// src/api/clubs.js
import axios from 'axios';

const API_BASE_URL = 'https://api.kitefighters.in/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Request to join club
export const requestJoinClub = async (clubId, message) => {
  const response = await apiClient.post('/membership/join-request', {
    clubId,
    message,
  });
  return response.data;
};

// Cancel join request
export const cancelJoinRequest = async (clubId) => {
  const response = await apiClient.delete(`/clubs/${clubId}/join-request`);
  return response.data;
};

// Get pending join requests (owner/co-owner)
export const getPendingRequests = async (clubId) => {
  const response = await apiClient.get(`/clubs/${clubId}/join-requests`);
  return response.data;
};

// Approve/reject join request
export const reviewJoinRequest = async (clubId, playerId, approved, rejectionReason) => {
  const response = await apiClient.post(`/clubs/${clubId}/join-request/review`, {
    playerId,
    approved,
    rejectionReason,
  });
  return response.data;
};

// Get club members with roles
export const getClubMembers = async (clubId) => {
  const response = await apiClient.get(`/clubs/${clubId}/members`);
  return response.data;
};

// Update member role (owner only)
export const updateMemberRole = async (clubId, playerId, role) => {
  const response = await apiClient.patch(`/clubs/${clubId}/members/role`, {
    playerId,
    role, // "owner", "co_owner", or "member"
  });
  return response.data;
};
```

### React Component Example

```jsx
// src/components/ClubJoinButton.jsx
import React, { useState } from 'react';
import { requestJoinClub, cancelJoinRequest } from '../api/clubs';

function ClubJoinButton({ clubId, clubName, hasExistingRequest }) {
  const [loading, setLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(hasExistingRequest);
  const [message, setMessage] = useState('');

  const handleJoinRequest = async () => {
    setLoading(true);
    try {
      const result = await requestJoinClub(clubId, message);
      alert(result.message);
      setHasPendingRequest(true);
      setMessage('');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setLoading(true);
    try {
      const result = await cancelJoinRequest(clubId);
      alert(result.message);
      setHasPendingRequest(false);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="club-join-section">
      {!hasPendingRequest ? (
        <>
          <h3>Join {clubName}</h3>
          <textarea
            placeholder="Optional message to club owners..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
          />
          <button onClick={handleJoinRequest} disabled={loading}>
            {loading ? 'Submitting...' : 'Request to Join'}
          </button>
        </>
      ) : (
        <>
          <p>✓ Join request pending approval</p>
          <button onClick={handleCancelRequest} disabled={loading}>
            {loading ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </>
      )}
    </div>
  );
}

export default ClubJoinButton;
```

### Vanilla JavaScript Example

```javascript
// Request to join club
async function requestJoinClub(clubId, message) {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('https://api.kitefighters.in/api/v1/membership/join-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ clubId, message }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}

// Usage
document.getElementById('joinButton').addEventListener('click', async () => {
  try {
    const result = await requestJoinClub('6975ad62a0f3ab04c1cd0b11', 'I want to join!');
    alert(result.message);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});
```

---

## Common Issues

### Issue 1: 404 Not Found

**Problem:**
```
POST /api/v1/club-join-request → 404
```

**Solution:**
Use the correct endpoint path:
```
✅ POST /api/v1/membership/join-request
```

### Issue 2: 409 Conflict - Already a Member

**Error Response:**
```json
{
  "statusCode": 409,
  "message": "Player is already a member of this club"
}
```

**Solution:**
Check if user is already a member before showing the join button.

### Issue 3: 409 Conflict - Pending Request Exists

**Error Response:**
```json
{
  "statusCode": 409,
  "message": "Player already has a pending join request for this club"
}
```

**Solution:**
Show "Cancel Request" button instead of "Join" button.

### Issue 4: 401 Unauthorized

**Solution:**
Ensure JWT token is:
1. Present in Authorization header
2. Not expired
3. Valid format: `Bearer <token>`

### Issue 5: Missing clubId in Request

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "clubId is required"
}
```

**Solution:**
Always include clubId in request body:
```javascript
{ clubId: '6975ad62a0f3ab04c1cd0b11', message: 'optional' }
```

---

## Testing with curl

```bash
# Get JWT token first
TOKEN="your_jwt_token_here"

# Test join request
curl -X POST 'https://api.kitefighters.in/api/v1/membership/join-request' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"clubId":"6975ad62a0f3ab04c1cd0b11","message":"Test request"}'

# Test cancel request (club ID in URL, not body)
curl -X DELETE 'https://api.kitefighters.in/api/v1/clubs/6975ad62a0f3ab04c1cd0b11/join-request' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN"

# Get pending requests (owner/co-owner only)
curl -X GET 'https://api.kitefighters.in/api/v1/clubs/6975ad62a0f3ab04c1cd0b11/join-requests' \
  -H "Authorization: Bearer $TOKEN"
```

---

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Authentication Guide](./AUTHENTICATION_GUIDE.md) - JWT authentication
- [WebSocket Guide](./WEBSOCKET_IMPLEMENTATION.md) - Real-time updates
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production deployment

---

## Support

For issues or questions:
1. Check error response in browser console
2. Verify JWT token is valid
3. Ensure correct endpoint path is used
4. Check CORS settings if using different domain
