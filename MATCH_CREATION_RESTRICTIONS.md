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

### Frontend Validation
The frontend now checks:
- User approval status
- Admin role
- Club ownership through member roles

### Backend Validation Required
⚠️ **IMPORTANT**: The backend API endpoint for creating matches must also validate:
- User is authenticated
- User is an admin OR
- User is owner/co-owner of the club(s) involved in the match

**Example Backend Validation:**
```javascript
// In POST /api/v1/matches endpoint
const createMatch = async (req, res) => {
  const { team1, team2 } = req.body;
  const userId = req.user._id;
  
  // Check if user is admin
  if (req.user.role === 'admin') {
    // Allow match creation
    return createMatchInternal(req.body);
  }
  
  // Check if user is owner/co-owner of team1's club
  const team1Club = await Club.findById(team1.clubId);
  const team1Member = team1Club.members.find(m => 
    m.playerId.toString() === userId.toString()
  );
  
  // Check if user is owner/co-owner of team2's club
  const team2Club = await Club.findById(team2.clubId);
  const team2Member = team2Club.members.find(m => 
    m.playerId.toString() === userId.toString()
  );
  
  if (
    (team1Member && ['owner', 'co_owner'].includes(team1Member.role)) ||
    (team2Member && ['owner', 'co_owner'].includes(team2Member.role))
  ) {
    // Allow match creation
    return createMatchInternal(req.body);
  }
  
  // Deny access
  return res.status(403).json({
    code: 'FORBIDDEN',
    message: 'Only admins and club owners can create matches'
  });
};
```

## Testing Checklist

- [ ] **Admin User**: Can see "Create Match" button
- [ ] **Club Owner**: Can see "Create Match" button
- [ ] **Club Co-Owner**: Can see "Create Match" button
- [ ] **Regular Member**: Cannot see "Create Match" button
- [ ] **Unapproved Player**: Cannot see "Create Match" button
- [ ] **No Club Membership**: Regular approved player with no club ownership cannot see button
- [ ] **Multiple Clubs**: User who is owner of one club and member of another can see button
- [ ] **Loading State**: Button doesn't flash during permission check

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
