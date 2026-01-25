# Club Join Feature - Frontend Integration Guide

## Working Endpoint

**POST `/api/v1/clubs/join-request`**

This endpoint allows authenticated players to request to join a club. The club ID is sent in the request body.

## API Details

- **URL:** `https://api.kitefighters.in/api/v1/clubs/join-request`
- **Method:** `POST`
- **Authentication:** Required (JWT Bearer token)
- **Rate Limit:** 10 requests/minute
- **Content-Type:** `application/json`

## Request Format

### Headers
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

### Body
```json
{
  "clubId": "6975ad62a0f3ab04c1cd0b11",
  "message": "I would like to join your club!"
}
```

**Fields:**
- `clubId` (required): MongoDB ObjectId (24-character hex string) of the club to join
- `message` (optional): Optional message to club owners (max 500 characters)

## Success Response

**Status Code:** `201 Created`

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

## Error Responses

### 401 Unauthorized - No Token
```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Unauthorized"
}
```

### 401 Unauthorized - Invalid/Expired Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 404 Not Found - Club Doesn't Exist
```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Club not found"
}
```

### 400 Bad Request - Already a Member
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Player is already a member of this club"
}
```

### 400 Bad Request - Pending Request Exists
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Join request already pending for this club"
}
```

### 429 Rate Limit Exceeded
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded"
}
```

## Frontend Implementation Examples

### React with Axios

```javascript
// api/clubs.js
import axios from 'axios';

const API_BASE_URL = 'https://api.kitefighters.in/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const requestJoinClub = async (clubId, message) => {
  try {
    const response = await apiClient.post('/clubs/join-request', {
      clubId,
      message: message || undefined,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

// Usage in component
import { requestJoinClub } from '../api/clubs';

function ClubJoinButton({ clubId }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleJoinRequest = async () => {
    setLoading(true);
    try {
      const result = await requestJoinClub(clubId, message);
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

### Fetch API

```javascript
const requestJoinClub = async (clubId, message) => {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('https://api.kitefighters.in/api/v1/clubs/join-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      clubId,
      message: message || undefined,
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

### TypeScript Interface

```typescript
interface JoinClubRequest {
  clubId: string;
  message?: string;
}

interface JoinClubResponse {
  message: string;
  club: {
    _id: string;
    name: string;
    description?: string;
    status: 'approved' | 'pending' | 'rejected';
  };
}

const requestJoinClub = async (
  request: JoinClubRequest
): Promise<JoinClubResponse> => {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch(
    'https://api.kitefighters.in/api/v1/clubs/join-request',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw error;
  }
  
  return response.json();
};
```

## User Flow

1. **User browses clubs** → GET `/api/v1/clubs`
2. **User selects a club** → GET `/api/v1/clubs/:id`
3. **User clicks "Request to Join"** → POST `/api/v1/clubs/join-request` with `{clubId, message}`
4. **Request is pending** → Club owners notified
5. **Owner reviews request** → GET `/api/v1/clubs/:id/join-requests` (owner only)
6. **Owner approves/rejects** → POST `/api/v1/clubs/:id/join-request/review`
7. **Player receives notification** → Player added to club members

## Testing

### Local Development
```bash
curl -X POST 'http://localhost:3000/api/v1/clubs/join-request' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"clubId":"CLUB_ID_HERE","message":"I want to join!"}'
```

### Production
```bash
curl -X POST 'https://api.kitefighters.in/api/v1/clubs/join-request' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"clubId":"6975ad62a0f3ab04c1cd0b11","message":"Testing!"}'
```

## Notes

- The endpoint works locally and is properly configured
- If production returns 404, there may be a deployment or routing configuration issue
- The club must be approved (status: "approved") to receive join requests
- The player must be authenticated with a valid JWT token
- Club owners and co-owners will be notified of pending join requests
- The same endpoint can be used for both development and production by changing the base URL

## Related Endpoints

- **GET `/api/v1/clubs`** - List all clubs
- **GET `/api/v1/clubs/:id`** - Get club details
- **GET `/api/v1/clubs/:id/join-requests`** - Get pending requests (owner/co-owner only)
- **POST `/api/v1/clubs/:id/join-request/review`** - Approve/reject request (owner/co-owner only)
- **DELETE `/api/v1/clubs/:id/join-request`** - Cancel own pending request
- **GET `/api/v1/clubs/:id/members`** - Get club members with roles

## Support

If you encounter issues:
1. Verify your JWT token is valid and not expired
2. Check that the clubId is a valid MongoDB ObjectId (24-character hex string)
3. Ensure the club exists and has status "approved"
4. Check rate limiting (max 10 requests/minute)
5. Verify network connectivity and CORS configuration
