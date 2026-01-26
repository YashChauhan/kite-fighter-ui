# Kite Fighters - AI Coding Agent Instructions

## Project Overview
React 19 + TypeScript PWA for managing kite fighting clubs, players, matches, and live fight recordings. Backend API at `http://0.0.0.0:3000/api/v1` (dev) or AWS Elastic Beanstalk (prod).

## Critical Architecture Patterns

### API Client Structure
All API calls go through [`src/api/client.ts`](../src/api/client.ts) with automatic JWT token injection and 401 handling. Organize endpoints by domain:
- `auth.ts` - Login/register/profile
- `clubs.ts` - Club CRUD + membership with role-based access (owner/co-owner/member)
- `players.ts` - Player management
- `matches.ts` - Match operations (captains must confirm participation)
- `fights.ts` - Fight recording with captain confirmation workflow
- `admin.ts` - Admin approval operations

**Important**: Backend endpoints sometimes differ from documentation. Recent fix: join-club request is `/membership/join-request` NOT `/clubs/join-request` or `/players/join-club-request`. Always verify 404s against actual backend routes and check `docs/be_docs/` for latest API documentation.

### Real-Time Communication
Native WebSocket client in [`src/services/socketService.ts`](../src/services/socketService.ts) (NOT socket.io). Connects to `ws://localhost:3000/api/v1/ws/matches` with JWT token in query param. Auto-reconnects up to 5 times. Subscribe to matches via `subscribeToMatch(matchId)` - subscriptions persist across reconnects.

### Authentication Flow
[`AuthContext`](../src/contexts/AuthContext.tsx) provides:
- `isAuthenticated()` - Has token + user
- `isAdmin()` - User role check
- `isApproved()` - User status check (approval required for most actions)
- `canEditEmail()` - Role-based permission

Token stored in localStorage. 401 responses trigger session-expired event + redirect. All protected API calls require approval status check.

### Authorization Patterns
Use [`useCanModify`](../src/hooks/useCanModify.ts) hook for edit permissions (requires approved status). For match creation, use `useCanCreateMatch()` which checks if user is club owner/co-owner by fetching club memberships and comparing roles.

## Development Workflow

### Environment Setup
```bash
npm install
# Uses .env.development automatically in dev mode
npm run dev  # Vite dev server on port 5173
```

Environment variables:
- `VITE_API_BASE_URL` - Backend API URL (defaults to `http://localhost:3000/api/v1`)
- `VITE_SOCKET_URL` - WebSocket URL (defaults to `ws://localhost:3000`)
- `VITE_ENVIRONMENT` - `development` or `production`

### Testing
```bash
npm test              # Vitest with happy-dom
npm run test:ui       # Visual test UI
npm run test:coverage # Coverage report
```

Tests use `@testing-library/react` v16 with React 19. See [`vitest.setup.ts`](../vitest.setup.ts) for global config.

### Build & Deploy
```bash
npm run build         # Production build with vite
npm run build:dev     # Development build
npm run preview:prod  # Preview production build locally
```

**AWS Deployment**: Uses AWS Amplify with [`amplify.yml`](../amplify.yml). Environment variables MUST be set in Amplify Console (not in code). See [`AWS_DEPLOYMENT.md`](../AWS_DEPLOYMENT.md).

**Critical**: Backend CORS must allow Amplify domain. See [`BACKEND_CORS_FIX.md`](../BACKEND_CORS_FIX.md) for configuration.

## Type System

All types in [`src/types/index.ts`](../src/types/index.ts). Key patterns:

```typescript
// Enums as const objects for type safety
export const MatchStatus = {
  PENDING_CAPTAIN_CONFIRMATION: "PENDING_CAPTAIN_CONFIRMATION",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

// API responses include pagination
interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; totalPages: number; totalItems: number; };
}
```

## Business Logic Specifics

### Club Membership System
Three roles with distinct permissions (see [`CLUB_MEMBERSHIP_SYSTEM.md`](../CLUB_MEMBERSHIP_SYSTEM.md)):
- **Owner**: Full control, created automatically when club is created
- **Co-Owner**: Can approve join requests only
- **Member**: No admin privileges

Join workflow:
1. Player requests via `POST /membership/join-request` with `{ clubId, message }`
2. Owner/co-owner reviews via `POST /clubs/:id/join-request/review`
3. Player added as member if approved

Check member roles with `GET /clubs/:id/members` which returns `{ playerId, role, joinedAt }[]`.

### Match Creation Restrictions
Documented in [`MATCH_CREATION_RESTRICTIONS.md`](../MATCH_CREATION_RESTRICTIONS.md). Only club owners/co-owners and admins can create matches. Captains must confirm participation before match becomes active.

### Fight Recording
Captains record fights and opposing captain must confirm. Status flow: `PENDING_CAPTAIN_CONFIRMATION` → `CONFIRMED`. Disputes escalate to admin resolution.

## UI/UX Conventions

- **Mobile-First**: 48px minimum touch targets, responsive breakpoints
- **Theme**: Material-UI v6 with `ThemeContext` for light/dark/system modes
- **Notifications**: [`notificationService.ts`](../src/services/notificationService.ts) with audio alerts (preloaded MP3s in `public/sounds/`)
- **Layout**: All pages wrap in [`AppLayout.tsx`](../src/components/AppLayout.tsx) for consistent navigation

## Common Pitfalls

1. **Backend endpoint mismatches**: Documentation may not reflect actual routes. Test with network inspector.
2. **CORS issues**: Backend must explicitly allow Amplify domain in production.
3. **Approval status**: Most actions require `user.status === 'approved'`. Check with `isApproved()`.
4. **WebSocket reconnection**: Subscriptions must be re-established after disconnect (handled automatically).
5. **Token expiration**: Listen for `session-expired` event to show re-login prompt.

## File Organization

```
src/
├── api/          # Domain-specific endpoint modules
├── components/   # Reusable UI components + __tests__
├── contexts/     # React Context providers (Auth, Theme)
├── hooks/        # Custom React hooks (authorization, etc)
├── pages/        # Route components (mostly pending)
├── services/     # Singleton services (socket, notifications, offline)
├── types/        # All TypeScript definitions in index.ts
└── utils/        # Helper functions
```

## Next Steps (Pending Features)
- Service Worker + offline caching (Workbox)
- Matches/Players list pages with infinite scroll
- Live match view with real-time updates
- Admin dashboard with approval badges
- Protected route guards
- Settings drawer with cache management
