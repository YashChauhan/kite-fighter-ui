# Frontend-Backend API Integration Verification Report

**Generated:** January 26, 2026  
**Status:** ⚠️ CRITICAL ISSUES FOUND

## Summary

Cross-verified frontend API implementations in `src/api/` against backend documentation in `docs/be_docs/`. Found **1 critical endpoint mismatch** and several potential issues.

---

## 🚨 Critical Issues

### 1. Club Join Request Endpoint Mismatch

**Location:** `src/api/clubs.ts` line 74

**Current Implementation:**
```typescript
const response = await apiClient.post(`/clubs/join-request`, {
  clubId,
  message,
});
```

**Backend Documentation:** `docs/be_docs/CLUB_MEMBERSHIP_GUIDE.md`  
**Correct Endpoint:** `/membership/join-request`

**Issue:** Frontend is using `/clubs/join-request` but backend expects `/membership/join-request`

**Status:** ❌ Will return 404 in production

**Fix Required:**
```typescript
const response = await apiClient.post(`/membership/join-request`, {
  clubId,
  message,
});
```

**Backend Documentation Says:**
- Primary endpoint: `POST /api/v1/membership/join-request` ✅
- Legacy endpoint: `POST /api/v1/players/join-club-request` (backward compatibility)
- **NOT:** `/api/v1/clubs/join-request` ❌

---

## ✅ Verified Correct Implementations

### Authentication Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `POST /auth/register` | `src/api/auth.ts:9` | ✅ Matches | ✅ |
| `POST /auth/login` | `src/api/auth.ts:19` | ✅ Matches | ✅ |
| `GET /auth/me` | `src/api/auth.ts:27` | ✅ Matches | ✅ |

**Response Format:** Both expect `{ message, data: { player, token } }`

### Club Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `GET /clubs` | `src/api/clubs.ts:6` | ✅ Matches | ✅ |
| `GET /clubs/:id` | `src/api/clubs.ts:16` | ✅ Matches | ✅ |
| `GET /clubs/:id/players` | `src/api/clubs.ts:27` | ✅ Matches | ✅ |
| `POST /clubs` | `src/api/clubs.ts:38` | ✅ Matches | ✅ |
| `PUT /clubs/:id` | `src/api/clubs.ts:49` | ✅ Matches | ✅ |
| `GET /clubs/:id/members` | `src/api/clubs.ts:67` | ✅ Matches | ✅ |
| `DELETE /clubs/:id/join-request` | `src/api/clubs.ts:84` | ✅ Matches | ✅ |
| `POST /clubs/:id/leave` | `src/api/clubs.ts:91` | ✅ Matches | ✅ |

### Player Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `GET /players` | `src/api/players.ts:6` | ✅ Matches | ✅ |
| `GET /players/:id` | `src/api/players.ts:17` | ✅ Matches | ✅ |
| `PUT /players/:id` | `src/api/players.ts:28` | ✅ Matches | ✅ |
| `PATCH /players/:id/join-club` | `src/api/players.ts:37` | ✅ Matches | ✅ |
| `PATCH /players/:id/leave-club` | `src/api/players.ts:46` | ✅ Matches | ✅ |
| `DELETE /players/:id` | `src/api/players.ts:55` | ✅ Matches | ✅ |

### Match Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `GET /matches` | `src/api/matches.ts:6` | ✅ Matches | ✅ |
| `GET /matches/:id` | `src/api/matches.ts:17` | ✅ Matches | ✅ |
| `POST /matches` | `src/api/matches.ts:39` | ✅ Matches | ✅ |
| `PATCH /matches/:id/confirm-participation` | `src/api/matches.ts:49` | ✅ Matches | ✅ |
| `POST /matches/:id/start` | `src/api/matches.ts:59` | ✅ Matches | ✅ |
| `POST /matches/:id/result/declare` | `src/api/matches.ts:64` | ✅ Matches | ✅ |

### Fight Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `GET /fights` | `src/api/fights.ts:11` | ✅ Matches | ✅ |
| `GET /fights/match/:matchId` | `src/api/fights.ts:13` | ✅ Matches | ✅ |
| `GET /fights/:id` | `src/api/fights.ts:25` | ✅ Matches | ✅ |
| `POST /fights` | `src/api/fights.ts:34` | ✅ Matches | ✅ |
| `POST /fights/:id/confirm` | `src/api/fights.ts:42` | ✅ Matches | ✅ |

### Admin Endpoints
| Endpoint | FE Implementation | BE Documentation | Status |
|----------|-------------------|------------------|--------|
| `GET /admin/players/pending` | `src/api/admin.ts:5` | ✅ Matches | ✅ |
| `POST /admin/players/:id/approve` | `src/api/admin.ts:10` | ✅ Matches | ✅ |
| `POST /admin/players/:id/reject` | `src/api/admin.ts:18` | ✅ Matches | ✅ |
| `GET /admin/clubs/pending` | `src/api/admin.ts:27` | ✅ Matches | ✅ |
| `POST /admin/clubs/:id/approve` | `src/api/admin.ts:32` | ✅ Matches | ✅ |
| `POST /admin/clubs/:id/reject` | `src/api/admin.ts:37` | ✅ Matches | ✅ |
| `POST /admin/fights/:id/resolve` | `src/api/admin.ts:46` | ✅ Matches | ✅ |
| `POST /admin/matches/:id/result/resolve` | `src/api/admin.ts:53` | ✅ Matches | ✅ |

---

## ⚠️ Potential Issues & Recommendations

### 1. Response Format Inconsistencies

**Auth Responses:**
- Backend wraps data in `{ message, data: { player, token } }`
- Frontend expects `response.data` which would be `{ player, token }`
- **Status:** ✅ Correctly handled by axios interceptor

**Other Endpoints:**
- Most return `{ data: [...] }` with optional `pagination`
- Frontend correctly accesses `response.data`

### 2. Missing Endpoint Implementations

**Backend Documented but Not Implemented in FE:**

1. **Club Join Request Review**
   - Endpoint: `POST /clubs/:id/join-request/review`
   - Purpose: Owners approve/reject join requests
   - **Recommendation:** Add to `src/api/clubs.ts`

2. **Get Pending Join Requests**
   - Endpoint: `GET /clubs/:id/join-requests`
   - Purpose: View pending requests for club
   - **Recommendation:** Add to `src/api/clubs.ts`

3. **Update Member Role**
   - Endpoint: `PATCH /clubs/:id/members/role`
   - Purpose: Owner changes member roles (owner/co-owner/member)
   - **Recommendation:** Add to `src/api/clubs.ts`

4. **Player Fight Stats**
   - Endpoint: `GET /players/:id/fight-stats`
   - Purpose: Get detailed fight statistics
   - **Recommendation:** Consider if needed, may be included in player object

5. **Cancel Join Request**
   - Endpoint: `DELETE /clubs/:id/join-request`
   - Status: ✅ Already implemented in `src/api/clubs.ts:84`

### 3. WebSocket Connection

**Status:** ✅ Correctly implemented

- Uses native WebSocket (not socket.io) ✅
- Connects to `ws://localhost:3000/api/v1/ws/matches` ✅
- JWT token in query param ✅
- Auto-reconnection logic ✅
- Subscription persistence ✅

**Documentation:** `docs/be_docs/WEBSOCKET_IMPLEMENTATION.md`

### 4. Type Definitions

**Status:** ⚠️ Mostly correct, minor discrepancies

**FightStatus Enum:**
- FE: `PENDING_CAPTAIN_CONFIRMATION | CONFIRMED | DISPUTED | ADMIN_RESOLVED`
- BE: Same ✅

**MatchStatus Enum:**
- FE: `PENDING_CAPTAIN_CONFIRMATION | PENDING_PARTICIPANTS | ACTIVE | COMPLETED | CANCELLED`
- BE: Same ✅
- FE also includes aliases: `SCHEDULED`, `LIVE`, `DISPUTED` (for compatibility)

**Club Member Roles:**
- FE: `"owner" | "co_owner" | "member"`
- BE: Same ✅

---

## 📋 Action Items

### Critical (Fix Immediately)

1. **Fix club join request endpoint**
   ```typescript
   // src/api/clubs.ts line 74
   - const response = await apiClient.post(`/clubs/join-request`, {
   + const response = await apiClient.post(`/membership/join-request`, {
   ```

### High Priority

2. **Add missing club membership endpoints**
   ```typescript
   // src/api/clubs.ts
   export const getPendingJoinRequests = async (clubId: string) => {
     const response = await apiClient.get(`/clubs/${clubId}/join-requests`);
     return response.data;
   };
   
   export const reviewJoinRequest = async (
     clubId: string,
     playerId: string,
     approved: boolean,
     rejectionReason?: string
   ) => {
     const response = await apiClient.post(
       `/clubs/${clubId}/join-request/review`,
       { playerId, approved, rejectionReason }
     );
     return response.data;
   };
   
   export const updateMemberRole = async (
     clubId: string,
     playerId: string,
     role: "owner" | "co_owner" | "member"
   ) => {
     const response = await apiClient.patch(
       `/clubs/${clubId}/members/role`,
       { playerId, role }
     );
     return response.data;
   };
   ```

### Medium Priority

3. **Update `.github/copilot-instructions.md`**
   - Change documentation of join endpoint from `/players/join-club-request` to `/membership/join-request`
   - Document the correct workflow for club membership

4. **Add integration tests**
   - Test join request flow end-to-end
   - Verify response formats match backend

### Low Priority

5. **Document endpoint history**
   - Create a migration guide for endpoint changes
   - Document why `/clubs/join-request` was changed to `/membership/join-request`

---

## 🔍 Testing Checklist

Before deploying, verify these endpoints:

- [ ] Register new player
- [ ] Login with credentials
- [ ] Request to join club (TEST WITH NETWORK INSPECTOR)
- [ ] Get club members with roles
- [ ] Create match (as owner/co-owner)
- [ ] WebSocket connection and subscriptions
- [ ] Fight recording and confirmation
- [ ] Admin approvals

---

## 📚 Reference Documentation

- **Backend API Docs:** `docs/be_docs/API_DOCUMENTATION.md`
- **Club Membership:** `docs/be_docs/CLUB_MEMBERSHIP_GUIDE.md`
- **Authentication:** `docs/be_docs/AUTHENTICATION_GUIDE.md`
- **WebSocket:** `docs/be_docs/WEBSOCKET_IMPLEMENTATION.md`
- **Match Restrictions:** `docs/be_docs/MATCH_CREATION_RESTRICTIONS.md`

---

## 🎯 Backend Documentation Notes

### Endpoint Migration History (from DEPLOYMENT_GUIDE.md)

> **Issue with Nested Routes on AWS App Runner:**
> - Blocks POST requests on nested plugin routes (e.g., `/api/v1/players/join-club-request`)
> - **Solution:** Moved to `/api/v1/membership/join-request`

This explains why the endpoint changed from `/players/join-club-request` to `/membership/join-request`.

---

## Conclusion

**Overall Assessment:** Frontend is well-implemented but has **1 critical bug** that will cause join requests to fail.

**Immediate Action Required:**
1. Fix `/clubs/join-request` → `/membership/join-request`
2. Test in development before pushing to production
3. Add missing membership management endpoints

**Estimated Fix Time:** 15 minutes  
**Risk Level:** High (join requests currently broken)
