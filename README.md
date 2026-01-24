# Kite Fighters - Frontend Application

A mobile-first Progressive Web App (PWA) for managing kite fighting clubs, players, matches, and live fight recordings with real-time updates.

## Features

### Implemented ✅
- **Authentication System**: JWT-based login/registration with admin approval workflow
- **Theme System**: Light/Dark/System modes with Material-UI v6
- **API Client**: Complete integration with backend REST API (http://0.0.0.0:3000)
- **Real-time Updates**: Socket.io client for live match events
- **Notification Service**: In-app notifications with audio alerts (preloaded MP3s)
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Mobile-First Design**: 48px minimum touch targets, optimized layouts
- **Responsive UI**: Material-UI components with custom breakpoints

### Pending 🚧
- Service Worker & PWA configuration
- Offline caching with smart eviction (7-day TTL, 80% quota threshold)
- Matches list page with pull-to-refresh and infinite scroll
- Live match view with real-time fight updates
- Fight recording form and captain confirmation workflow
- Player profile with stats visualization and trophy showcase
- Admin dashboard with real-time approval badges
- Match creation form with team builder
- Settings drawer with sound toggle and cache management
- Protected route guards
- Onboarding tutorial

## Tech Stack

- **React 19** - UI library with TypeScript
- **Vite** - Build tool and dev server
- **Material-UI v6** - Component library
- **React Router v6** - Client-side routing
- **Axios** - HTTP client with interceptors
- **Native WebSocket** - Real-time communication (RFC 6455)
- **vite-plugin-pwa** - Progressive Web App support
- **Workbox** - Service worker and caching strategies
- **date-fns** - Date manipulation
- **@mui/x-data-grid** - Data tables

## Project Structure

```
src/
├── api/                  # API endpoint modules
│   ├── client.ts         # Axios instance with interceptors
│   ├── auth.ts           # Authentication endpoints
│   ├── players.ts        # Player management
│   ├── clubs.ts          # Club management
│   ├── matches.ts        # Match operations
│   ├── fights.ts         # Fight recording
│   └── admin.ts          # Admin approval operations
├── components/           # Reusable UI components
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
├── contexts/             # React Context providers
│   ├── ThemeContext.tsx  # Theme mode management
│   └── AuthContext.tsx   # Authentication state
├── hooks/                # Custom React hooks
│   └── useCanModify.ts   # Authorization helper
├── pages/                # Route components (to be implemented)
├── services/             # Singleton services
│   ├── notificationService.ts  # In-app notifications
│   └── socketService.ts        # WebSocket management
├── types/                # TypeScript definitions
│   └── index.ts          # All interfaces and enums
└── utils/                # Helper functions

public/
└── sounds/               # Audio notification files (pending)
    ├── info.mp3
    ├── success.mp3
    ├── warning.mp3
    └── error.mp3
```

## Installation

```bash
# Install dependencies
npm install

# Create .env file (already created)
# Contains:
# VITE_API_BASE_URL=http://0.0.0.0:3000/api/v1
# VITE_SOCKET_URL=http://0.0.0.0:3000
```

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Configuration

### Environment Variables
- `VITE_API_BASE_URL`: Backend API base URL (default: http://0.0.0.0:3000/api/v1)
- `VITE_SOCKET_URL`: WebSocket server URL (default: ws://localhost:3000/api/v1/ws/matches)

### Theme Customization
Theme settings are managed via [ThemeContext](src/contexts/ThemeContext.tsx):
- Supports light, dark, and system preference modes
- Persists selection to localStorage
- Custom Material-UI theme with mobile-first breakpoints
- 48px minimum touch target size for accessibility

## Authentication Flow

1. User registers via [RegisterForm](src/components/RegisterForm.tsx)
2. Account enters "pending" approval status (read-only access)
3. Admin approves/rejects via admin dashboard
4. JWT token stored in localStorage
5. Auto-refresh on app mount via [AuthContext](src/contexts/AuthContext.tsx)
6. 401 responses trigger logout and redirect to login

## API Integration

All API calls use the configured [Axios client](src/api/client.ts) with:
- Automatic Bearer token injection
- Response error handling
- Session expiration detection
- Formatted error messages

### Available API Modules
- **Auth**: register, login, getCurrentUser, logout
- **Players**: CRUD operations, club membership, deletion requests
- **Clubs**: CRUD operations, player lists
- **Matches**: Creation, participation confirmation, winner declaration
- **Fights**: Reporting, confirmation, dispute handling
- **Admin**: Approval workflows, dispute resolution

## Real-time Features (Socket.io)

[SocketService](src/services/socketService.ts) provides:
- Automatic JWT authentication handshake
- Reconnection with exponential backoff (5 attempts)
- Room management (match subscription/unsubscription)
- Event subscriptions with unsubscribe functions
- Automatic reconnection with exponential backoff
- Re-subscription to matches after reconnection

### WebSocket Events (Native WebSocket Protocol)
- `match:created` - New match created
- `match:started` - Match begins
- `match:updated` - Match details updated
- `match:completed` - Match finished
- `match:cancelled` - Match cancelled
- `fight:reported` - Fight result reported
- `fight:confirmed` - Fight confirmed by captains
- `fight:disputed` - Fight result disputed
- `fight:completed` - Fight finalized
- `subscribed` - Subscription confirmed
- `unsubscribed` - Unsubscription confirmed

## Offline Support (Pending)

Planned features:
- Service worker with Workbox strategies
- NetworkFirst for API calls
- CacheFirst for static assets
- StaleWhileRevalidate for match data (7-day TTL)
- Smart eviction at 80% storage quota
- Pin up to 20 matches for offline access
- Cache size display in settings

## PWA Features (Pending)

- Installable on mobile devices
- App shortcuts for quick actions
- Offline fallback page
- Background sync for fight reports
- Push notifications for match updates

## Mobile-First Design Principles

- Bottom navigation for primary actions
- Thumb-friendly button placement
- 48px minimum touch targets
- Pull-to-refresh gestures
- Infinite scroll with loading indicators
- Bottom sheets for forms
- Haptic feedback (where supported)
- Horizontal scrolling for fight sequences

## Browser Support

- Chrome/Edge 90+ (recommended)
- Safari 14+
- Firefox 88+
- Mobile: iOS Safari 14+, Chrome Android 90+

## Troubleshooting

### Token Expiration
If you're logged out unexpectedly, check:
1. Backend server is running at http://0.0.0.0:3000
2. JWT token validity in localStorage
3. Browser console for 401 errors

### WebSocket Connection Issues
1. Verify VITE_SOCKET_URL matches backend
2. Check browser console for connection errors
3. Backend must support Socket.io with JWT auth

### Audio Notifications Not Playing
1. Ensure sound files exist in public/sounds/
2. Check soundEnabled flag in localStorage
3. Browser may require user interaction before audio

## Backend Requirements

This frontend expects a Node.js backend at http://0.0.0.0:3000 with:
- REST API at /api/v1
- Socket.io server with JWT authentication
- Endpoints matching [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)

## Contributing

When implementing pending features:
1. Maintain mobile-first approach
2. Use existing patterns from completed components
3. Update this README with new features
4. Test on mobile devices/emulators
5. Ensure offline compatibility where applicable

## License

[Your License Here]
