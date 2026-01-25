# Club Membership System with Role-Based Access

## Overview
The Kite Fighter API now includes a comprehensive role-based club membership system with an approval workflow. Club members can have different roles (Owner, Co-Owner, Member) with specific permissions, and players must request to join clubs with approval from club owners/co-owners.

## Features

### 1. **Member Roles**
- **Owner**: Full control over the club, can manage all members and approve join requests
- **Co-Owner**: Can approve/reject join requests, but cannot change member roles
- **Member**: Regular club member with no administrative privileges

### 2. **Join Request Workflow**
1. Player submits a join request to a club
2. Request is sent to all club owners and co-owners for review
3. Owner/Co-owner approves or rejects the request
4. Player receives notification of the decision
5. If approved, player is added as a club member

### 3. **Automatic Owner Assignment**
When a club is created, the creator is automatically assigned as the owner.

## API Endpoints

### Player Actions

#### Request to Join a Club
```http
POST /api/v1/clubs/join-request
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "clubId": "507f1f77bcf86cd799439011",
  "message": "I would like to join your club" // Optional
}
```

**Response:**
```json
{
  "message": "Join request submitted successfully. Awaiting club owner approval.",
  "club": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Phoenix Warriors",
    "joinRequests": [
      {
        "playerId": "507f191e810c19729de860ea",
        "playerName": "John Doe",
        "playerEmail": "john@example.com",
        "requestedAt": "2026-01-25T10:00:00.000Z",
        "status": "pending"
      }
    ]
  }
}
```

**Error Cases:**
- Player already a member: 409 Conflict
- Player already has pending request: 409 Conflict
- Club not found: 404 Not Found

#### Cancel Join Request
```http
DELETE /api/v1/clubs/:clubId/join-request
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Join request cancelled successfully.",
  "club": { ... }
}
```

### Owner/Co-Owner Actions

#### Get Pending Join Requests
```http
GET /api/v1/clubs/:clubId/join-requests
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "John Doe",
    "playerEmail": "john@example.com",
    "requestedAt": "2026-01-25T10:00:00.000Z",
    "status": "pending"
  }
]
```

#### Review Join Request (Approve/Reject)
```http
POST /api/v1/clubs/:clubId/join-request/review
Authorization: Bearer <jwt_token>
```

**Request Body (Approve):**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": true
}
```

**Request Body (Reject):**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": false,
  "rejectionReason": "Club is currently full"
}
```

**Response:**
```json
{
  "message": "Join request approved successfully.",
  "club": {
    "_id": "507f1f77bcf86cd799439011",
    "members": [
      {
        "playerId": "507f191e810c19729de860ea",
        "role": "member",
        "joinedAt": "2026-01-25T10:05:00.000Z"
      }
    ]
  }
}
```

**Permissions:**
- Only club owners and co-owners can review join requests
- Returns 400 if requester is not owner/co-owner

#### Get Club Members with Roles
```http
GET /api/v1/clubs/:clubId/members
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "playerId": {
      "_id": "507f191e810c19729de860ea",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "role": "owner",
    "joinedAt": "2026-01-20T10:00:00.000Z"
  },
  {
    "playerId": {
      "_id": "507f191e810c19729de860eb",
      "name": "Jane Smith",
      "email": "jane@example.com"
    },
    "role": "co_owner",
    "joinedAt": "2026-01-21T14:30:00.000Z"
  },
  {
    "playerId": {
      "_id": "507f191e810c19729de860ec",
      "name": "Bob Johnson",
      "email": "bob@example.com"
    },
    "role": "member",
    "joinedAt": "2026-01-25T10:05:00.000Z"
  }
]
```

### Owner-Only Actions

#### Update Member Role
```http
PATCH /api/v1/clubs/:clubId/members/role
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "playerId": "507f191e810c19729de860eb",
  "role": "co_owner"
}
```

**Response:**
```json
{
  "message": "Member role updated successfully.",
  "club": { ... }
}
```

**Permissions:**
- Only club owner can update member roles
- Owner cannot change their own role
- Returns 400 if requester is not owner

## Data Models

### Club Model Updates

```typescript
interface IClub {
  // ... existing fields ...
  
  // New fields
  members: Array<{
    playerId: ObjectId;
    role: 'owner' | 'co_owner' | 'member';
    joinedAt: Date;
  }>;
  
  joinRequests: Array<{
    playerId: ObjectId;
    playerName: string;
    playerEmail: string;
    requestedAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    reviewedBy?: ObjectId;
    reviewedAt?: Date;
    rejectionReason?: string;
  }>;
}
```

### Enums

```typescript
enum ClubMemberRole {
  OWNER = 'owner',
  CO_OWNER = 'co_owner',
  MEMBER = 'member',
}

enum ClubJoinRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
```

## Notifications

The system sends notifications for the following events:

### CLUB_JOIN_REQUEST
Sent to all club owners and co-owners when a player requests to join.

**Payload:**
```json
{
  "clubId": "507f1f77bcf86cd799439011",
  "clubName": "Phoenix Warriors",
  "playerId": "507f191e810c19729de860ea",
  "playerName": "John Doe",
  "playerEmail": "john@example.com",
  "ownersAndCoOwners": ["owner_id_1", "co_owner_id_1"]
}
```

### CLUB_JOIN_APPROVED
Sent to the player when their join request is approved.

**Payload:**
```json
{
  "clubId": "507f1f77bcf86cd799439011",
  "clubName": "Phoenix Warriors",
  "playerId": "507f191e810c19729de860ea",
  "playerName": "John Doe",
  "playerEmail": "john@example.com"
}
```

### CLUB_JOIN_REJECTED
Sent to the player when their join request is rejected.

**Payload:**
```json
{
  "clubId": "507f1f77bcf86cd799439011",
  "clubName": "Phoenix Warriors",
  "playerId": "507f191e810c19729de860ea",
  "playerName": "John Doe",
  "playerEmail": "john@example.com",
  "rejectionReason": "Club is currently full"
}
```

## Frontend Integration Examples

### Request to Join Club

```javascript
// api/clubs.js
export const requestJoinClub = async (clubId, message) => {
  const response = await apiClient.post('/clubs/join-request', {
    clubId,
    message,
  });
  return response.data;
};

// Usage
const handleJoinRequest = async (clubId) => {
  try {
    const result = await requestJoinClub(clubId, 'I would like to join');
    alert(result.message);
  } catch (error) {
    if (error.code === 'DUPLICATE_ERROR') {
      alert('You already requested to join this club');
    } else {
      alert('Failed to submit join request');
    }
  }
};
```

### Review Join Request (Owner/Co-Owner)

```javascript
// api/clubs.js
export const reviewJoinRequest = async (clubId, playerId, approved, rejectionReason) => {
  const response = await apiClient.post(`/clubs/${clubId}/join-request/review`, {
    playerId,
    approved,
    rejectionReason,
  });
  return response.data;
};

// Usage in component
const handleApprove = async (playerId) => {
  try {
    const result = await reviewJoinRequest(clubId, playerId, true);
    alert('Player approved!');
    refetchRequests();
  } catch (error) {
    alert('Failed to approve request');
  }
};

const handleReject = async (playerId, reason) => {
  try {
    const result = await reviewJoinRequest(clubId, playerId, false, reason);
    alert('Request rejected');
    refetchRequests();
  } catch (error) {
    alert('Failed to reject request');
  }
};
```

### Display Club Members with Roles

```javascript
// Component
const ClubMembersView = ({ clubId }) => {
  const [members, setMembers] = useState([]);
  
  useEffect(() => {
    const loadMembers = async () => {
      const response = await apiClient.get(`/clubs/${clubId}/members`);
      setMembers(response.data);
    };
    loadMembers();
  }, [clubId]);
  
  return (
    <div>
      <h3>Club Members</h3>
      {members.map((member) => (
        <div key={member.playerId._id} className="member-card">
          <div className="member-info">
            <h4>{member.playerId.name}</h4>
            <span className={`role-badge ${member.role}`}>
              {member.role === 'owner' && '👑 Owner'}
              {member.role === 'co_owner' && '⭐ Co-Owner'}
              {member.role === 'member' && '👤 Member'}
            </span>
          </div>
          <p>Joined: {new Date(member.joinedAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
};
```

### Update Member Role (Owner Only)

```javascript
// api/clubs.js
export const updateMemberRole = async (clubId, playerId, role) => {
  const response = await apiClient.patch(`/clubs/${clubId}/members/role`, {
    playerId,
    role,
  });
  return response.data;
};

// Usage
const handlePromoteToCoOwner = async (playerId) => {
  if (!confirm('Promote this member to co-owner?')) return;
  
  try {
    await updateMemberRole(clubId, playerId, 'co_owner');
    alert('Member promoted to co-owner!');
    refetchMembers();
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      alert('Only club owner can update member roles');
    } else {
      alert('Failed to update role');
    }
  }
};
```

## Migration Guide

### For Existing Clubs

If you have existing clubs in your database, you'll need to migrate them to add the owner information:

```javascript
// Migration script
const migrateClubs = async () => {
  const clubs = await Club.find({ status: 'approved', deletedAt: null });
  
  for (const club of clubs) {
    // If club has players but no members, migrate the first player as owner
    if (club.players.length > 0 && club.members.length === 0) {
      club.members.push({
        playerId: club.players[0],
        role: 'owner',
        joinedAt: club.createdAt || new Date(),
      });
      
      // Migrate other players as regular members
      for (let i = 1; i < club.players.length; i++) {
        club.members.push({
          playerId: club.players[i],
          role: 'member',
          joinedAt: club.createdAt || new Date(),
        });
      }
      
      await club.save();
      console.log(`Migrated club: ${club.name}`);
    }
  }
};
```

## Security Considerations

1. **Authentication Required**: All club membership endpoints require JWT authentication
2. **Role-Based Authorization**: 
   - Only owners can update member roles
   - Only owners and co-owners can review join requests
   - Players can only cancel their own join requests
3. **Validation**: All player IDs and club IDs are validated before processing
4. **Transaction Safety**: Member additions use MongoDB transactions to ensure data consistency

## Best Practices

1. **Always have at least one owner**: Before removing an owner, ensure another owner exists
2. **Communicate role changes**: Send notifications when member roles are updated
3. **Clear rejection reasons**: Provide clear reasons when rejecting join requests
4. **Review requests promptly**: Set up notifications to alert owners of pending requests
5. **Use co-owners**: Distribute moderation workload by assigning co-owners

## Future Enhancements

- [ ] Transfer ownership functionality
- [ ] Bulk approve/reject join requests
- [ ] Custom permissions beyond the three default roles
- [ ] Join request expiration after X days
- [ ] Member removal by owners
- [ ] Club invitation system (invite instead of request)
- [ ] Waitlist for clubs at capacity
- [ ] Member activity tracking
- [ ] Role-based match team formation

## Related Documentation

- [API Documentation](./API_DOCUMENTATION.md)
- [Authentication Quick Reference](./AUTHENTICATION_QUICK_REFERENCE.md)
- [WebSocket Implementation](./WEBSOCKET_IMPLEMENTATION.md)
