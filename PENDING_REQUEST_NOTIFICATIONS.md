# Pending Join Request Notifications - Implementation Guide

## Overview
Club owners and co-owners now receive visual notifications about pending join requests both on the clubs list page and when viewing club details.

## Features Implemented

### 1. Clubs List Page Notifications
**Location:** `/clubs` page

**Visual Indicator:**
- Orange "warning" colored chip badge on club cards
- Shows count: "1 pending request" or "2 pending requests"
- Appears below the "Owner" chip if present
- Only visible to owners and co-owners of that club

**How it works:**
1. Page loads all approved clubs
2. For each club, checks if current user is owner/co-owner using `getClubMembers()` API
3. If user has permission, fetches pending join requests using `getPendingJoinRequests()` API
4. Displays count badge only if there are pending requests (status === 'pending')

### 2. Club Details Page - Management Interface
**Location:** `/clubs/:id` page

**Visual Indicators:**
- **Tab Navigation**: "Manage Members" tab appears only for owners/co-owners
- **Debug Panel** (development mode only): Shows role detection info
- **Member Badges**: Shows "Owner" or "Co-Owner" chip below club name

**Debug Panel Information:**
When running in development mode (`NODE_ENV=development`), a gray debug panel shows:
- Current user's role in the club (owner/co_owner/member/null)
- Result of `isOwnerOrCoOwner()` function (true/false)
- Current user's ID for comparison

## Testing Instructions

### Scenario 1: Club Owner Views Pending Requests

**Prerequisites:**
- Backend must be running on `http://localhost:3000`
- At least one club exists with pending join requests
- Test user must be the club owner

**Steps:**
1. **Login as club owner**
   ```
   Navigate to: http://localhost:5173/login
   Use owner credentials
   ```

2. **View clubs list**
   ```
   Navigate to: http://localhost:5173/clubs
   ```
   
   **Expected Results:**
   - Club cards display with "Owner" chip
   - Orange notification badge shows: "X pending request(s)"
   - Badge only appears for clubs you own/co-own

3. **Click on club with pending requests**
   ```
   Click "View Details" on a club with pending requests
   ```
   
   **Expected Results:**
   - Page loads club details
   - Debug panel shows:
     - User Role: "owner" (or "co_owner")
     - isOwnerOrCoOwner(): true
     - User ID: [your user ID]
   - Two tabs appear: "About" and "Manage Members"

4. **Navigate to Manage Members tab**
   ```
   Click "Manage Members" tab
   ```
   
   **Expected Results:**
   - Tab switches to membership management interface
   - Two sub-tabs: "Pending Requests" and "Members"
   - "Pending Requests" shows list of players requesting to join
   - Each request has:
     - Player name and email
     - Request date
     - Optional message from player
     - "Approve" button (green)
     - "Reject" button (red)

5. **Approve a join request**
   ```
   Click "Approve" button on a request
   ```
   
   **Expected Results:**
   - Request removed from Pending Requests list
   - Player added to Members list with role "member"
   - Notification badge count decrements on clubs list page
   - Success notification appears

6. **Reject a join request**
   ```
   Click "Reject" button on a request
   Fill in rejection reason
   Click "Reject" in dialog
   ```
   
   **Expected Results:**
   - Dialog opens asking for rejection reason
   - After submission, request removed from list
   - Notification badge count decrements
   - Success notification appears

### Scenario 2: Club Co-Owner Views Pending Requests

**Prerequisites:**
- User must be assigned as co-owner of a club
- Club must have pending join requests

**Steps:**
Same as Scenario 1, but:
- Debug panel shows "User Role: co_owner"
- Co-owner can approve/reject requests
- Co-owner CANNOT change member roles (owner-only feature)

### Scenario 3: Regular Member (No Permissions)

**Prerequisites:**
- User is a regular member (not owner/co-owner)

**Steps:**
1. Login as regular member
2. Navigate to clubs list
3. Click on club

**Expected Results:**
- No notification badges visible (user doesn't have permission to review requests)
- No "Manage Members" tab visible on club details page
- Only "About" tab is shown
- Debug panel shows "User Role: member" and "isOwnerOrCoOwner(): false"

### Scenario 4: Non-Member Views Club

**Prerequisites:**
- User is not a member of the club

**Steps:**
1. Login as any user
2. Navigate to club they don't belong to

**Expected Results:**
- No notification badges
- No "Manage Members" tab
- Only club information visible
- "Join Club" button may be visible
- Debug panel shows "User Role: null" and "isOwnerOrCoOwner(): false"

## Troubleshooting

### Issue: Notification badges not appearing

**Possible Causes:**
1. **API errors**: Check browser console for errors
2. **Permissions**: Verify user is actually owner/co-owner using debug panel
3. **No pending requests**: Check backend to ensure there are actually pending requests

**Debug Steps:**
```javascript
// In browser console:
// 1. Check if user is authenticated
localStorage.getItem('token')

// 2. Manually call API to check pending requests
// (assuming you have a club ID)
const clubId = 'YOUR_CLUB_ID';
fetch(`http://localhost:3000/api/v1/clubs/${clubId}/join-requests`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
}).then(r => r.json()).then(console.log)
```

### Issue: "Manage Members" tab not visible

**Check Debug Panel:**
The debug panel (visible in development mode) shows:
- **If User Role is null**: User is not a member of the club
- **If User Role is "member"**: User is a regular member, not owner/co-owner
- **If isOwnerOrCoOwner() is false**: Role detection failed or user doesn't have permission

**Fix Steps:**
1. Verify backend has correct member roles in database
2. Check that `getClubMembers()` API is returning correct data
3. Verify user ID matching logic (check console logs for "Comparing: ...")

### Issue: Pending requests not loading

**Check Console Logs:**
Look for these debug messages:
```
Club members data: [...]
Current user: {...}
Comparing: [member ID] with [user ID]
Found user membership: {...}
Set userRole to: owner/co_owner/member
```

**Common Fixes:**
- **User object not loaded**: Ensure AuthContext has populated user before navigating to club page
- **ID mismatch**: Check if backend returns `_id` or `id` field consistently
- **API errors**: Verify backend endpoints are working correctly

## API Endpoints Used

### 1. Get Club Members with Roles
```
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
  }
]
```

### 2. Get Pending Join Requests
```
GET /api/v1/clubs/:clubId/join-requests
Authorization: Bearer <jwt_token>
```

**Response:**
```json
[
  {
    "playerId": "507f191e810c19729de860ea",
    "playerName": "Jane Smith",
    "playerEmail": "jane@example.com",
    "requestedAt": "2026-01-25T10:00:00.000Z",
    "status": "pending"
  }
]
```

### 3. Review Join Request
```
POST /api/v1/clubs/:clubId/join-request/review
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Approve Request:**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": true
}
```

**Reject Request:**
```json
{
  "playerId": "507f191e810c19729de860ea",
  "approved": false,
  "rejectionReason": "Club is currently full"
}
```

## Performance Considerations

### Clubs List Page
- Pending request counts are loaded after clubs list loads
- Makes one API call per club where user is owner/co-owner
- Cached in component state (`pendingRequestCounts`)
- Does not block initial page render

**Optimization Opportunities:**
- Consider adding pending request count to club data in backend
- Cache counts in localStorage with expiration
- Use WebSocket notifications to update counts in real-time

### Club Details Page
- Role detection happens during initial data load
- Single API call to `getClubMembers()`
- No repeated API calls during tab navigation

## Future Enhancements

### Planned Features:
- [ ] Real-time notifications using WebSocket
- [ ] Browser notifications for new join requests
- [ ] Email notifications (backend)
- [ ] Bulk approve/reject functionality
- [ ] Request expiration after X days
- [ ] Auto-approve based on criteria

### UI Improvements:
- [ ] Add "Mark all as read" functionality
- [ ] Show notification count in navigation bar
- [ ] Add notification sound
- [ ] Show request history (approved/rejected)

## Related Documentation

- [Club Membership System](./CLUB_MEMBERSHIP_SYSTEM.md) - Complete membership system documentation
- [Membership UI Implementation](./MEMBERSHIP_UI_IMPLEMENTATION.md) - UI component details
- [Authentication Quick Reference](./AUTHENTICATION_QUICK_REFERENCE.md) - Auth system
- [WebSocket Implementation](./WEBSOCKET_IMPLEMENTATION.md) - Real-time updates

## Code Locations

**Components:**
- `/src/components/ClubMembershipManagement.tsx` - Main membership management component
- `/src/pages/ClubsListPage.tsx` - Clubs list with notification badges
- `/src/pages/ClubDetailsPage.tsx` - Club details with role detection and tabs

**API Client:**
- `/src/api/clubs.ts` - Club-related API functions
  - `getClubMembers(clubId)` - Get members with roles
  - `getPendingJoinRequests(clubId)` - Get pending join requests
  - `reviewJoinRequest(clubId, playerId, approved, reason)` - Approve/reject requests

**Context:**
- `/src/contexts/AuthContext.tsx` - Authentication state management

## Support

For issues or questions:
1. Check debug panel in development mode
2. Review browser console for errors
3. Verify API responses using browser DevTools Network tab
4. Check backend logs for API errors

---

**Last Updated:** January 2026
