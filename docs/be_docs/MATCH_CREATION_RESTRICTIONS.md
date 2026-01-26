# Match Creation Restrictions Implementation

## Overview
Implemented restrictions so that only **admins** and **club owners/co-owners** can create matches in the Kite Fighter application. Regular players can no longer create matches.

## Changes Made

### 1. API Layer - `src/api/clubs.ts`

Added a new API function to retrieve club members with their roles:

```typescript
export const getClubMembers = async (clubId: string): Promise<Array<{
  playerId: {
    _id: string;
    name: string;
    email: string;
  };
  role: 'owner' | 'co_owner' | 'member';
  joinedAt: string;
}>> => {
  const response = await apiClient.get(`/clubs/${clubId}/members`);
  return response.data;
};
```

This function calls the backend endpoint `/clubs/:clubId/members` as documented in [CLUB_MEMBERSHIP_SYSTEM.md](./CLUB_MEMBERSHIP_SYSTEM.md).

### 2. Hook Layer - `src/hooks/useCanModify.ts`

Created a new hook `useCanCreateMatch` that determines if a user can create matches:

```typescript
export const useCanCreateMatch = (): boolean => {
  const { user, isAdmin, isApproved } = useAuth();
  const [isClubOwner, setIsClubOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClubOwnership = async () => {
      // Early returns for unapproved users
      if (!user || !isApproved()) {
        setIsClubOwner(false);
        setLoading(false);
        return;
      }

      // Admin can always create matches
      if (isAdmin()) {
        setIsClubOwner(true);
        setLoading(false);
        return;
      }

      // Check if user is owner/co-owner of any club
      try {
        const clubsResponse = await getClubs({ status: 'approved', limit: 100 });
        
        for (const club of clubsResponse.data) {
          const clubId = club._id || club.id;
          if (!clubId) continue;
          
          try {
            const members = await getClubMembers(clubId);
            const userMembership = members.find(
              m => (m.playerId._id || m.playerId) === (user._id || user.id)
            );
            
            if (userMembership && 
                (userMembership.role === 'owner' || 
                 userMembership.role === 'co_owner')) {
              setIsClubOwner(true);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error(`Failed to get members for club ${clubId}:`, err);
            continue;
          }
        }
        
        setIsClubOwner(false);
      } catch (err) {
        console.error('Failed to check club ownership:', err);
        setIsClubOwner(false);
      } finally {
        setLoading(false);
      }
    };

    checkClubOwnership();
  }, [user, isAdmin, isApproved]);

  return loading ? false : (isAdmin() || isClubOwner);
};
```

**Key Logic:**
1. Returns `false` immediately if user is not approved
2. Returns `true` immediately if user is an admin
3. Checks all approved clubs to see if the user is an owner or co-owner
4. Returns `false` during loading to prevent premature access
5. Returns `true` only if admin or club owner/co-owner

### 3. UI Layer - `src/pages/MatchesListPage.tsx`

Updated the matches list page to use the new hook:

**Before:**
```typescript
const canModify = useCanModify();
// ...
{canModify && <CreateMatchButton />}
```

**After:**
```typescript
import { useCanModify, useCanCreateMatch } from '../hooks/useCanModify';
// ...
const canModify = useCanModify();
const canCreateMatch = useCanCreateMatch();
// ...
{canCreateMatch && <CreateMatchButton />}
```

The "Create Match" button (FAB) and the empty state action are now controlled by `canCreateMatch` instead of `canModify`.

### 4. Type Definitions - `src/types/index.ts`

Added comprehensive types for club membership system:

```typescript
export const ClubMemberRole = {
  OWNER: "owner",
  CO_OWNER: "co_owner",
  MEMBER: "member",
} as const;
export type ClubMemberRole = (typeof ClubMemberRole)[keyof typeof ClubMemberRole];

export const ClubJoinRequestStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;
export type ClubJoinRequestStatus = (typeof ClubJoinRequestStatus)[keyof typeof ClubJoinRequestStatus];

export interface ClubMember {
  playerId: string | Player;
  role: ClubMemberRole;
  joinedAt: string;
}

export interface ClubJoinRequest {
  playerId: string;
  playerName: string;
  playerEmail: string;
  requestedAt: string;
  status: ClubJoinRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Club {
  // ... existing fields ...
  members?: ClubMember[];
  joinRequests?: ClubJoinRequest[];
}
```

## User Experience Flow

### For Regular Players (Members)
1. Navigate to matches list page
2. **"Create Match" button is NOT visible**
3. Cannot create matches

### For Club Owners/Co-Owners
1. Navigate to matches list page
2. **"Create Match" button is visible**
3. Can click to create matches for their club

### For Admins
1. Navigate to matches list page
2. **"Create Match" button is visible**
3. Can create matches for any club

## Security Considerations

### Frontend Validation ✅
The frontend now checks:
- User approval status
- Admin role
- Club ownership through member roles

### Backend Validation ✅ IMPLEMENTED
The backend API endpoint for creating matches now validates through the `canCreateMatch` middleware ([src/middleware/matchAuth.ts](src/middleware/matchAuth.ts)):

**Validation Logic:**
1. ✅ User must be authenticated (via `authenticate` middleware)
2. ✅ User must be either:
   - Admin (role === 'admin'), OR
   - Owner/Co-owner of team1's club, OR
   - Owner/Co-owner of team2's club
3. ✅ Matches without club affiliation can only be created by admins

**Implementation Details:**
```typescript
// src/middleware/matchAuth.ts
export const canCreateMatch = async (request: FastifyRequest, reply: FastifyReply) => {
  await authenticate(request, reply);
  
  const user = request.user;
  
  // Admins can always create matches
  if (user.role === UserRole.ADMIN) {
    return;
  }
  
  const body = request.body as any;
  const team1ClubId = body.team1?.clubId;
  const team2ClubId = body.team2?.clubId;
  
  // No clubs = admin-only
  if (!team1ClubId && !team2ClubId) {
    throw new ValidationError('Only admins can create matches without club affiliation');
  }
  
  // Check if user is owner/co-owner of either club
  const clubIds = [team1ClubId, team2ClubId].filter(Boolean);
  
  for (const clubId of clubIds) {
    const club = await Club.findById(clubId).select('members');
    const userMembership = club?.members?.find(
      m => m.playerId.toString() === user._id.toString()
    );
    
    if (userMembership?.role === 'owner' || userMembership?.role === 'co_owner') {
      return; // Authorized
    }
  }
  
  // Deny access
  throw new ValidationError(
    'Only admins and club owners/co-owners can create matches'
  );
};
```

**Route Protection:**
```typescript
// src/matches/match.routes.ts
fastify.post('/', {
  preHandler: [canCreateMatch],  // Authorization middleware
  schema: matchSchemas.createMatch,
}, matchController.createMatch);
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `400 Bad Request` with message:
  - "Only admins can create matches without club affiliation"
  - "Only admins and club owners/co-owners can create matches"

## Testing Checklist

### Backend Authorization Tests
- [x] **Admin User**: Can create matches for any clubs
- [x] **Club Owner**: Can create matches where their club is team1 or team2
- [x] **Club Co-Owner**: Can create matches where their club is team1 or team2
- [x] **Regular Member**: Cannot create matches (returns 400 error)
- [x] **Unapproved Player**: Cannot create matches (returns 401 error)
- [x] **Non-club Member**: Cannot create matches for clubs they don't own
- [x] **No Authentication**: Cannot create matches (returns 401 error)
- [x] **Training Match without Clubs**: Only admin can create (returns 400 for non-admins)

### Frontend UI Tests
- [ ] **Admin User**: Can see "Create Match" button
- [ ] **Club Owner**: Can see "Create Match" button
- [ ] **Club Co-Owner**: Can see "Create Match" button  
- [ ] **Regular Member**: Cannot see "Create Match" button
- [ ] **Unapproved Player**: Cannot see "Create Match" button
- [ ] **No Club Membership**: Regular approved player with no club ownership cannot see button
- [ ] **Multiple Clubs**: User who is owner of one club and member of another can see button
- [ ] **Loading State**: Button doesn't flash during permission check

### API Endpoint Tests

**Test 1: Admin creates match**
```bash
POST /api/v1/matches
Headers: Authorization: Bearer <admin_token>
Body: { team1: { clubId: "..." }, team2: { clubId: "..." } }
Expected: 201 Created
```

**Test 2: Club owner creates match for their club**
```bash
POST /api/v1/matches
Headers: Authorization: Bearer <owner_token>
Body: { team1: { clubId: "<their_club_id>" }, team2: { clubId: "..." } }
Expected: 201 Created
```

**Test 3: Regular member tries to create match**
```bash
POST /api/v1/matches
Headers: Authorization: Bearer <member_token>
Body: { team1: { clubId: "..." }, team2: { clubId: "..." } }
Expected: 400 Bad Request
Message: "Only admins and club owners/co-owners can create matches"
```

**Test 4: Non-admin creates match without clubs**
```bash
POST /api/v1/matches
Headers: Authorization: Bearer <owner_token>
Body: { team1: {}, team2: {} }  // No clubIds
Expected: 400 Bad Request
Message: "Only admins can create matches without club affiliation"
```

**Test 5: Unauthenticated request**
```bash
POST /api/v1/matches
Headers: (no auth header)
Expected: 401 Unauthorized
```

## Performance Considerations

The `useCanCreateMatch` hook:
- Caches the result until user changes
- Only runs when user is authenticated and approved
- Early exits for admins to avoid unnecessary API calls
- Handles errors gracefully (denies access on error)

To optimize further, consider:
1. **Caching club membership** in user profile
2. **WebSocket notifications** when user role changes
3. **Local storage** for club ownership status

## Related Documentation

- [Club Membership System](./CLUB_MEMBERSHIP_SYSTEM.md) - Complete club membership and role system
- [Authentication Quick Reference](./AUTHENTICATION_QUICK_REFERENCE.md) - Authentication and authorization
- Backend API documentation for `/clubs/:clubId/members` endpoint

## Migration Notes

If you have existing matches created by regular players:
- These matches remain valid
- Going forward, only admins and club owners can create new matches
- Consider running a data migration to assign ownership to existing matches

## Future Enhancements

- [ ] Add UI indicator showing which club the user can create matches for
- [ ] Add validation in match creation form to only allow creating matches for user's clubs
- [ ] Add notification when a player becomes club owner (gaining match creation ability)
- [ ] Add audit log for match creation attempts
- [ ] Add club selection dropdown in create match form (for users who own multiple clubs)
