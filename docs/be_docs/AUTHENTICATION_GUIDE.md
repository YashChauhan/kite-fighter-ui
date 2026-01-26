# Authentication Guide

**Complete guide for implementing JWT authentication in your frontend application.**

## Table of Contents
- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Token Management](#token-management)
- [Common Issues](#common-issues)

---

## Overview

The Kite Fighter API uses **JWT (JSON Web Token)** authentication for securing endpoints. There are two separate authentication systems:

### 1. Player Authentication
- **Purpose:** Regular player access to API
- **Secret:** `JWT_SECRET`
- **Endpoints:** Most public-facing endpoints
- **Token expiry:** 7 days (default)

### 2. Admin Authentication  
- **Purpose:** Admin-only operations (approvals, deletions)
- **Secret:** `ADMIN_JWT_SECRET`
- **Endpoints:** `/api/v1/admin/*`
- **Token expiry:** 7 days (default)

---

## Authentication Flow

```
User enters credentials
        ↓
POST /api/v1/auth/login
        ↓
API validates credentials
        ↓
JWT token returned
        ↓
Store token (localStorage/sessionStorage)
        ↓
Include in Authorization header for subsequent requests
```

---

## API Endpoints

### Base URLs
- **Production:** `https://api.kitefighters.in/api/v1`
- **App Runner:** `https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1`
- **Development:** `http://localhost:3000/api/v1`

### 1. Register Player

**Endpoint:** `POST /auth/register`

**Authentication:** None required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "clubs": ["6975ad62a0f3ab04c1cd0b11"] // Optional: array of club IDs
}
```

**Success Response (201):**
```json
{
  "message": "Player registered successfully",
  "data": {
    "player": {
      "id": "6975e691f81f442b742dd239",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "player",
      "status": "PENDING"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note:** Players start with `PENDING` status and cannot login until approved by admin.

### 2. Login Player

**Endpoint:** `POST /auth/login`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "data": {
    "player": {
      "id": "6975e691f81f442b742dd239",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "player",
      "status": "APPROVED"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Player not approved by admin yet
- `404 Not Found` - Player doesn't exist

### 3. Get Current User

**Endpoint:** `GET /auth/me`

**Authentication:** Required (JWT token)

**Success Response (200):**
```json
{
  "data": {
    "id": "6975e691f81f442b742dd239",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player",
    "status": "APPROVED",
    "clubs": ["6975ad62a0f3ab04c1cd0b11"],
    "fightStats": {
      "wins": 5,
      "losses": 2,
      "draws": 1
    },
    "currentStreak": {},
    "bestStreak": {},
    "starTrophies": {}
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - User not found

### 4. Refresh Token (Optional)

**Endpoint:** `POST /auth/refresh`

**Authentication:** Required (valid or expired JWT token)

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "player": { ... }
}
```

---

## Frontend Integration

### React + Axios Example

#### Step 1: Create Auth API Client

```javascript
// src/api/auth.js
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

// Handle 401 errors (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('jwt_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Register player
export const register = async (name, email, password, clubs = []) => {
  const response = await apiClient.post('/auth/register', {
    name,
    email,
    password,
    clubs,
  });
  return response.data;
};

// Login player
export const login = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password });
  
  // Store token
  if (response.data.token) {
    localStorage.setItem('jwt_token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.player));
  }
  
  return response.data;
};

// Get current user
export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// Logout
export const logout = () => {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export default apiClient;
```

#### Step 2: Create Auth Context (React)

```javascript
// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { login as apiLogin, getCurrentUser, logout as apiLogout } from '../api/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('jwt_token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    setUser(data.player);
    return data;
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

#### Step 3: Login Component

```jsx
// src/components/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
```

#### Step 4: Protected Route Component

```jsx
// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

export default ProtectedRoute;
```

### Vanilla JavaScript Example

```javascript
// auth.js

// Register
async function register(name, email, password) {
  const response = await fetch('https://api.kitefighters.in/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}

// Login
async function login(email, password) {
  const response = await fetch('https://api.kitefighters.in/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  const data = await response.json();
  
  // Store token
  localStorage.setItem('jwt_token', data.token);
  localStorage.setItem('user', JSON.stringify(data.player));
  
  return data;
}

// Get current user
async function getCurrentUser() {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch('https://api.kitefighters.in/api/v1/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Not authenticated');
  }
  
  return await response.json();
}

// Logout
function logout() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Check if user is logged in
function isAuthenticated() {
  return !!localStorage.getItem('jwt_token');
}

// Usage
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const result = await login(email, password);
    console.log('Logged in:', result.player.name);
    window.location.href = '/dashboard.html';
  } catch (error) {
    alert(`Login failed: ${error.message}`);
  }
});
```

---

## Token Management

### Storing Tokens

**Options:**

1. **localStorage** (Recommended for most cases)
   - Persists across browser sessions
   - Accessible from any tab
   - Vulnerable to XSS attacks

```javascript
localStorage.setItem('jwt_token', token);
const token = localStorage.getItem('jwt_token');
localStorage.removeItem('jwt_token');
```

2. **sessionStorage** (More secure, but expires on tab close)
```javascript
sessionStorage.setItem('jwt_token', token);
```

3. **Memory only** (Most secure, but lost on refresh)
```javascript
let token = null; // Store in app state
```

### Token Format

The Authorization header must be formatted as:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Structure

JWT tokens have 3 parts separated by dots:
```
header.payload.signature
```

**Decoded Payload Example:**
```json
{
  "id": "6975e691f81f442b742dd239",
  "email": "john@example.com",
  "role": "player",
  "iat": 1737879257,  // Issued at
  "exp": 1738484057   // Expires at
}
```

### Token Expiry

- Default expiry: **7 days**
- After expiry, user must login again
- Consider implementing auto-refresh before expiry

---

## Common Issues

### Issue 1: 401 Unauthorized

**Causes:**
- Token missing from request
- Token expired
- Invalid token format
- Token corrupted

**Solutions:**
```javascript
// Check token exists
const token = localStorage.getItem('jwt_token');
if (!token) {
  // Redirect to login
}

// Check token format
console.log('Token:', token); // Should start with "eyJ"

// Check Authorization header
headers: {
  'Authorization': `Bearer ${token}` // Note the space after Bearer
}
```

### Issue 2: 403 Forbidden (Player Not Approved)

**Error Response:**
```json
{
  "statusCode": 403,
  "message": "Account pending admin approval"
}
```

**Solution:**
Show appropriate message to user that they need to wait for admin approval.

### Issue 3: CORS Errors

**Error in Console:**
```
Access to fetch at 'https://api.kitefighters.in' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**Solution:**
This should not happen with the production API. If it does, contact backend team.

### Issue 4: Token Not Persisting

**Problem:**
User logged in but token disappears after refresh.

**Solution:**
Make sure you're using `localStorage` (not a variable):
```javascript
// ✅ Correct
localStorage.setItem('jwt_token', token);

// ❌ Wrong
let token = data.token; // Lost on refresh
```

### Issue 5: Expired Token Not Detected

**Solution:**
Decode JWT and check expiry:
```javascript
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
}

const token = localStorage.getItem('jwt_token');
if (token && isTokenExpired(token)) {
  localStorage.removeItem('jwt_token');
  // Redirect to login
}
```

---

## Security Best Practices

1. **Never expose tokens in URLs** - Always use headers
2. **Use HTTPS in production** - Prevents token interception
3. **Clear tokens on logout** - Remove from storage completely
4. **Validate tokens on every request** - Backend validates automatically
5. **Handle 401 errors globally** - Redirect to login automatically
6. **Don't store sensitive data in token** - Backend controls payload
7. **Implement refresh tokens** - For long-lived sessions (optional)

---

## Testing with curl

```bash
# Register
curl -X POST 'https://api.kitefighters.in/api/v1/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","email":"john@example.com","password":"test123"}'

# Login
curl -X POST 'https://api.kitefighters.in/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"john@example.com","password":"test123"}'

# Get current user (replace TOKEN with your JWT)
curl -X GET 'https://api.kitefighters.in/api/v1/auth/me' \
  -H 'Authorization: Bearer TOKEN'
```

---

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Club Membership Guide](./CLUB_MEMBERSHIP_GUIDE.md) - Club features
- [WebSocket Guide](./WEBSOCKET_IMPLEMENTATION.md) - Real-time updates
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Production setup

---

## Support

For authentication issues:
1. Check JWT token in localStorage
2. Verify Authorization header format
3. Check token expiry date
4. Ensure user is approved by admin
5. Check network tab for request/response details
