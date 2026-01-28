# Match API - Frontend Fix Guide

## ❌ Issue Identified

**Error received:**
```json
{
    "statusCode": 400,
    "code": "FST_ERR_VALIDATION",
    "error": "Bad Request",
    "message": "params/id must match pattern \"^[0-9a-fA-F]{24}$\""
}
```

**Root Cause:**
The frontend is calling `POST /api/v1/matches/create` but this endpoint doesn't exist. The API expects `POST /api/v1/matches`.

Fastify's router is matching the URL pattern `/:id` with "create" as the ID parameter, which fails validation because "create" is not a valid MongoDB ObjectId.

---

## ✅ Solution

### Change Frontend API Call

**WRONG:**
```javascript
// ❌ This endpoint does NOT exist
POST /api/v1/matches/create?populate=players,clubs
```

**CORRECT:**
```javascript
// ✓ Use this endpoint
POST /api/v1/matches
```

---

## 📋 Complete API Reference

### Endpoint
```
POST /api/v1/matches
```

### Authentication Required
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Permission:** Admin OR Club Owner/Co-Owner only

### Request Body (Required Fields)

```typescript
{
  "name": string,              // 2-200 characters
  "matchDate": string,         // ISO 8601 date-time
  "organizerId": string,       // MongoDB ObjectId (24 hex chars)
  "team1": {
    "teamName": string,        // 2-100 characters
    "captainId": string,       // MongoDB ObjectId
    "playerIds": string[],     // Array of ObjectIds, min 2 players
    "clubId"?: string          // Optional: MongoDB ObjectId
  },
  "team2": {
    "teamName": string,
    "captainId": string,
    "playerIds": string[],
    "clubId"?: string
  }
}
```

### Optional Fields

```typescript
{
  "description"?: string,      // Max 1000 characters
  "location"?: {
    "name": string,
    "address": string,
    "coordinates"?: {
      "latitude": number,
      "longitude": number
    }
  },
  "rules"?: {
    "matchDuration"?: number,    // Minutes
    "maxFighters"?: number,
    "eliminationType"?: string   // e.g., "knockout", "points"
  }
}
```

### Example Request

```javascript
// Using fetch
const response = await fetch('http://localhost:3000/api/v1/matches', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    name: "Weekend Practice Match",
    description: "Friendly practice session",
    matchDate: "2026-02-01T10:00:00Z",
    organizerId: "679886c6bc5277ae84a48e66",  // Your user ID
    team1: {
      teamName: "Team Alpha",
      captainId: "679886c6bc5277ae84a48e66",
      playerIds: [
        "679886c6bc5277ae84a48e66",
        "679886c6bc5277ae84a48e67"
      ],
      clubId: "679886c6bc5277ae84a48e68"
    },
    team2: {
      teamName: "Team Beta",
      captainId: "679886c6bc5277ae84a48e69",
      playerIds: [
        "679886c6bc5277ae84a48e69",
        "679886c6bc5277ae84a48e70"
      ],
      clubId: "679886c6bc5277ae84a48e71"
    },
    location: {
      name: "Central Park",
      address: "New York, NY",
      coordinates: {
        latitude: 40.785091,
        longitude: -73.968285
      }
    },
    rules: {
      matchDuration: 60,
      maxFighters: 10,
      eliminationType: "knockout"
    }
  })
});

const data = await response.json();
console.log(data);
```

### Using Axios

```javascript
import axios from 'axios';

const createMatch = async (matchData, token) => {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/v1/matches',
      matchData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating match:', error.response?.data);
    throw error;
  }
};

// Usage
const matchData = {
  name: "Weekend Practice Match",
  matchDate: "2026-02-01T10:00:00Z",
  organizerId: userId,
  team1: { /* ... */ },
  team2: { /* ... */ }
};

const match = await createMatch(matchData, jwtToken);
```

---

## 🔍 Query Parameters

The `populate` parameter is **NOT** supported in the match creation endpoint. It's only available for GET requests:

**GET Endpoints with populate:**
```
GET /api/v1/matches?populate=organizerId
GET /api/v1/matches/:id?populate=teams.captain
```

**POST Endpoint (no populate):**
```
POST /api/v1/matches
```

The created match will automatically include populated fields in the response based on the controller logic.

---

## 🚨 Common Errors

### 1. 400 - params/id must match pattern
**Cause:** Using `/matches/create` instead of `/matches`
**Fix:** Remove `/create` from URL

### 2. 400 - body must have required property
**Cause:** Missing required fields in request body
**Fix:** Ensure all required fields are included:
- name
- matchDate  
- organizerId
- team1 (with teamName, captainId, playerIds)
- team2 (with teamName, captainId, playerIds)

### 3. 401 - Unauthorized
**Cause:** Missing or invalid JWT token
**Fix:** 
1. Login first: `POST /api/v1/auth/login`
2. Get JWT token from response
3. Include in Authorization header

### 4. 403 - Forbidden  
**Cause:** User doesn't have permission to create matches
**Fix:** Only admins and club owners/co-owners can create matches. Verify user role.

### 5. 422 - Validation Error
**Cause:** Invalid data format (e.g., invalid ObjectId, invalid date)
**Fix:** 
- ObjectIds must be 24 hexadecimal characters
- Dates must be ISO 8601 format
- playerIds arrays must have at least 2 players

---

## 🧪 Testing

### Quick Test (without auth)
```bash
curl -X GET http://localhost:3000/api/v1/matches
```

### Test Match Creation
```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "your@email.com", "password": "password"}'

# 2. Copy the JWT token from response

# 3. Create match
curl -X POST http://localhost:3000/api/v1/matches \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{
    "name": "Test Match",
    "matchDate": "2026-02-01T10:00:00Z",
    "organizerId": "679886c6bc5277ae84a48e66",
    "team1": {
      "teamName": "Team A",
      "captainId": "679886c6bc5277ae84a48e66",
      "playerIds": ["679886c6bc5277ae84a48e66", "679886c6bc5277ae84a48e67"]
    },
    "team2": {
      "teamName": "Team B",
      "captainId": "679886c6bc5277ae84a48e69",
      "playerIds": ["679886c6bc5277ae84a48e69", "679886c6bc5277ae84a48e70"]
    }
  }'
```

---

## 📖 Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Authentication Guide](./AUTHENTICATION_GUIDE.md)
- [Match Creation Restrictions](./MATCH_CREATION_RESTRICTIONS.md)

---

## ✅ Checklist for Frontend Developer

- [ ] Change URL from `POST /matches/create` to `POST /matches`
- [ ] Remove `?populate=players,clubs` from POST request (only for GET)
- [ ] Ensure all required fields are included in request body
- [ ] Add proper error handling for 401, 403, 422 errors
- [ ] Include JWT token in Authorization header
- [ ] Validate ObjectId format before sending (24 hex chars)
- [ ] Validate date format (ISO 8601)
- [ ] Ensure at least 2 players per team
- [ ] Test with valid user credentials

---

**Last Updated:** January 27, 2026  
**API Version:** 1.0.0
