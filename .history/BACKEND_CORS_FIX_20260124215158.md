# Backend CORS Configuration Fix

## Issue
Your frontend is deployed on AWS Amplify but the backend API is returning CORS errors:
```
XMLHttpRequest cannot load http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com/api/v1/auth/register 
due to access control checks.
```

## Solution

You need to configure CORS on your backend API server to allow requests from your Amplify domain.

### For Express.js Backend

1. **Install CORS package** (if not already installed):
```bash
npm install cors
```

2. **Update your server configuration**:

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:5173',                                    // Local development
    'http://localhost:3000',                                    // Local development alternate
    'https://main.do9my3i5pe474.amplifyapp.com',               // Your Amplify domain
    'https://*.amplifyapp.com',                                 // Any Amplify preview branches
  ],
  credentials: true,                                            // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight request for 10 minutes
};

app.use(cors(corsOptions));

// Your routes...
app.use('/api/v1', routes);
```

### Alternative: Permissive CORS (Development Only)

For development/testing, you can use a more permissive configuration:

```javascript
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true,
}));
```

**⚠️ Warning:** Don't use this in production as it allows any domain.

### For Other Frameworks

#### FastAPI (Python)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://main.do9my3i5pe474.amplifyapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Spring Boot (Java)
```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "http://localhost:5173",
                    "https://main.do9my3i5pe474.amplifyapp.com"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

## Testing

After updating your backend:

1. **Redeploy your backend** to Elastic Beanstalk
2. **Test from Amplify**:
   - Open your Amplify URL: https://main.do9my3i5pe474.amplifyapp.com
   - Open browser DevTools (F12)
   - Try to register/login
   - Check Network tab - should show successful requests without CORS errors

3. **Verify CORS headers**:
```bash
curl -I \
  -H "Origin: https://main.do9my3i5pe474.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com/api/v1/auth/register
```

You should see headers like:
```
Access-Control-Allow-Origin: https://main.do9my3i5pe474.amplifyapp.com
Access-Control-Allow-Credentials: true
```

## Common Issues

### Issue: Preflight requests failing
**Solution:** Ensure your server handles OPTIONS requests:
```javascript
app.options('*', cors(corsOptions));
```

### Issue: Credentials not working
**Solution:** Set both `credentials: true` in CORS config AND use `withCredentials` in axios:
```javascript
// In your API client
axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
```

### Issue: Wildcard subdomain not working
**Solution:** Use a regex pattern or function:
```javascript
origin: function (origin, callback) {
  const allowedPatterns = [
    /\.amplifyapp\.com$/,
    /^http:\/\/localhost:\d+$/,
  ];
  
  if (!origin || allowedPatterns.some(pattern => pattern.test(origin))) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

## Your Specific Configuration

Add this to your backend running on:
`http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com`

```javascript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://main.do9my3i5pe474.amplifyapp.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
```

---

**After fixing CORS on your backend, your frontend will work properly! 🚀**
