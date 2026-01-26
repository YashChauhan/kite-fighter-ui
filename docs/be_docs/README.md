# Kite Fighter API Documentation

**Welcome to the Kite Fighter API documentation hub!**

This folder contains all the documentation you need to integrate with and deploy the Kite Fighter API.

---

## 📚 Documentation Index

### For Frontend Developers

| Document | Description | Use When |
|----------|-------------|----------|
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | Complete API reference with all endpoints, request/response examples | Building any feature that uses the API |
| **[AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)** | JWT authentication, login/register, token management | Implementing user authentication |
| **[CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md)** | Club join requests, member roles, approval workflow | Building club membership features |
| **[WEBSOCKET_IMPLEMENTATION.md](./WEBSOCKET_IMPLEMENTATION.md)** | Real-time match updates via WebSocket | Adding live match updates |

### For DevOps / Deployment

| Document | Description | Use When |
|----------|-------------|----------|
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | AWS App Runner deployment, environment variables, DNS setup | Deploying to production or staging |
| **[AWS_SES_EMAIL_GUIDE.md](./AWS_SES_EMAIL_GUIDE.md)** | Email notification configuration with AWS SES | Setting up email notifications |

### For Backend Developers

| Document | Description | Use When |
|----------|-------------|----------|
| **[MATCH_CREATION_RESTRICTIONS.md](./MATCH_CREATION_RESTRICTIONS.md)** | Match creation rules and restrictions | Understanding match business logic |
| **[VALIDATION_REPORT.md](./VALIDATION_REPORT.md)** | 🆕 Documentation validation report | Verifying doc accuracy, understanding fixes made |

---

## 🚀 Quick Start Guides

### Frontend Developer Quick Start

1. **Setup Authentication**
   - Read: [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)
   - Implement: Login/Register forms
   - Test: `POST /api/v1/auth/login`

2. **Fetch Data**
   - Read: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
   - Find your endpoint (e.g., `/api/v1/players`, `/api/v1/clubs`)
   - Add JWT token to requests

3. **Implement Club Features**
   - Read: [CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md)
   - Use endpoint: `POST /api/v1/membership/join-request`
   - Handle approvals and rejections

4. **Add Real-Time Updates (Optional)**
   - Read: [WEBSOCKET_IMPLEMENTATION.md](./WEBSOCKET_IMPLEMENTATION.md)
   - Connect to: `wss://api.kitefighters.in/api/v1/ws/matches`

### DevOps Quick Start

1. **Deploy to AWS App Runner**
   - Read: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) → AWS App Runner section
   - Build Docker image for linux/amd64
   - Push to ECR, create App Runner service

2. **Configure Environment Variables**
   - Required: `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_JWT_SECRET`
   - Optional: Email, logging, rate limiting

3. **Setup Custom Domain**
   - Add CNAME: `api` → App Runner URL
   - Add SSL validation CNAMEs
   - Wait 10-30 minutes for SSL

---

## ✅ Documentation Validation

All documentation has been validated against the actual API implementation.

**Validation Results:**
- ✅ Authentication endpoints validated (3 errors fixed)
- ✅ Club membership endpoints validated (4 errors fixed)
- ✅ Match/Fight/Admin endpoints validated (no errors)
- ✅ Automated test suite: **12/13 tests passing**

**Run Validation Tests:**
```bash
# From project root
./test-api-docs.sh

# Expected output: 12/13 tests passing
# (SSL pending certificate validation)
```

See [VALIDATION_REPORT.md](./VALIDATION_REPORT.md) for detailed validation report.

---

## 🔗 Production URLs

| Environment | URL |
|-------------|-----|
| **Production (Custom Domain)** | `https://api.kitefighters.in/api/v1` |
| **Production (App Runner)** | `https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1` |
| **Development** | `http://localhost:3000/api/v1` |
| **Swagger UI** | `https://api.kitefighters.in/api/docs` |

---

## 📋 Common Integration Patterns

### Pattern 1: Basic API Call with Auth

```javascript
// Setup
const API_BASE_URL = 'https://api.kitefighters.in/api/v1';
const token = localStorage.getItem('jwt_token');

// Make request
const response = await fetch(`${API_BASE_URL}/clubs`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const clubs = await response.json();
```

### Pattern 2: Club Join Request

```javascript
// POST /api/v1/membership/join-request
const response = await fetch('https://api.kitefighters.in/api/v1/membership/join-request', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clubId: '6975ad62a0f3ab04c1cd0b11',
    message: 'I want to join!',
  }),
});
```

### Pattern 3: WebSocket for Live Updates

```javascript
const ws = new WebSocket('wss://api.kitefighters.in/api/v1/ws/matches');

ws.onopen = () => {
  // Subscribe to match updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    matchId: '6975ad62a0f3ab04c1cd0b11',
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Match update:', update);
};
```

---

## ❓ Frequently Asked Questions

### Q: Which endpoint should I use for club join requests?

**A:** Use `POST /api/v1/membership/join-request` (not `/club-join-request` or `/clubs/:id/join`).

See: [CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md)

### Q: How do I handle JWT token expiry?

**A:** Tokens expire after 7 days. Catch 401 errors and redirect to login.

See: [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) → Token Management

### Q: Why am I getting 404 errors?

**A:** Check you're using the correct endpoint path. Common mistake: missing `/players/` or `/membership/` prefix.

See: [CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md) → Common Issues

### Q: How do I test the API?

**A:** Use curl, Postman, or Swagger UI at https://api.kitefighters.in/api/docs

See: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Q: Can I use the App Runner URL directly?

**A:** Yes, but prefer the custom domain `api.kitefighters.in` for production.

See: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 🔧 Troubleshooting

| Issue | Solution | Documentation |
|-------|----------|---------------|
| 401 Unauthorized | Check JWT token exists and is valid | [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) |
| 404 Not Found | Verify endpoint path is correct | [CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md) |
| 409 Conflict | User already member or has pending request | [CLUB_MEMBERSHIP_GUIDE.md](./CLUB_MEMBERSHIP_GUIDE.md) |
| CORS Errors | Should not happen with production API | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) |
| SSL Certificate Pending | Wait 10-30 minutes for AWS ACM validation | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) |

---

## 📞 Support

For issues or questions:
1. Check the relevant documentation above
2. Review error responses in browser console
3. Check Swagger UI: https://api.kitefighters.in/api/docs
4. Verify JWT token and endpoint paths
5. Test with curl to isolate frontend vs backend issues

---

## 🗂️ Document Organization

```
docs/
├── README.md (this file)                    # Documentation index
├── API_DOCUMENTATION.md                     # Complete API reference (4500+ lines)
├── AUTHENTICATION_GUIDE.md                  # JWT authentication guide
├── CLUB_MEMBERSHIP_GUIDE.md                 # Club membership features
├── WEBSOCKET_IMPLEMENTATION.md              # Real-time WebSocket
├── DEPLOYMENT_GUIDE.md                      # AWS App Runner deployment
├── AWS_SES_EMAIL_GUIDE.md                   # Email notifications
└── MATCH_CREATION_RESTRICTIONS.md           # Match business logic
```

**Archived/Legacy:**
- `src/docs/` - Old documentation (consolidated into above files)

---

## ✨ Recent Updates

- **Jan 26, 2026:** Consolidated documentation from 13 files to 7 focused guides
- **Jan 25, 2026:** Migrated from AWS Elastic Beanstalk to AWS App Runner
- **Jan 25, 2026:** Fixed club join endpoint documentation (now `/membership/join-request`)
- **Jan 23, 2026:** Added WebSocket implementation guide
- **Jan 23, 2026:** Added authentication quick reference

---

## 📝 Contributing

When updating documentation:
1. Keep examples up-to-date with actual API behavior
2. Include curl and frontend code examples
3. Add common issues and solutions
4. Update this README if adding new docs
5. Test all code examples before committing

---

**Happy coding! 🚀**
