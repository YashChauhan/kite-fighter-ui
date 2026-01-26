# Deployment Guide

**Complete guide for deploying Kite Fighter API to production using AWS App Runner.**

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [AWS App Runner Deployment](#aws-app-runner-deployment)
- [Environment Variables](#environment-variables)
- [Custom Domain Setup](#custom-domain-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Kite Fighter API is deployed on **AWS App Runner** with automatic scaling and container management.

### Current Production Setup
- **Platform:** AWS App Runner
- **Region:** ap-south-1 (Mumbai)
- **Custom Domain:** https://api.kitefighters.in
- **App Runner URL:** https://ef8mfpabua.ap-south-1.awsapprunner.com
- **Container Registry:** Amazon ECR
- **Compute:** 1 vCPU, 2 GB Memory
- **Auto-scaling:** Yes (1-25 instances)
- **Estimated Cost:** $25-40/month

###Why App Runner over Elastic Beanstalk?

**Previous Issue with AWS Elastic Beanstalk:**
- EB's nginx proxy has undocumented routing restrictions
- Blocks POST requests on nested plugin routes (e.g., `/api/v1/players/join-club-request`)
- Multiple deployment attempts all failed with 404 errors in production
- Code worked perfectly locally and in Docker

**App Runner Benefits:**
- ✅ No routing restrictions - all endpoints work
- ✅ Simpler configuration - less infrastructure to manage
- ✅ Automatic HTTPS and SSL certificates
- ✅ Built-in load balancing and auto-scaling
- ✅ Direct Docker container deployment
- ✅ Lower cost for small to medium traffic

---

## Prerequisites

### Required
- AWS Account (Account ID: 380714695818)
- Docker installed locally
- AWS CLI configured
- MongoDB Atlas cluster (or MongoDB with replica set support)

### Optional
- Domain registered (we use GoDaddy)
- Git repository for source code

---

## AWS App Runner Deployment

### Step 1: Build Docker Image for Correct Architecture

**Important:** AWS App Runner requires `linux/amd64` architecture.

```bash
# Navigate to project directory
cd /Users/yashvardhanchauhan/Documents/React/kite-fighter-api

# Build for linux/amd64 (not arm64)
docker buildx build --platform linux/amd64 -t kite-fighter-api .

# Verify image exists
docker images | grep kite-fighter-api
```

### Step 2: Create ECR Repository

```bash
# Login to AWS (configure credentials if needed)
aws configure

# Create ECR repository
aws ecr create-repository \
  --repository-name kite-fighter-api \
  --region ap-south-1

# Output will show repository URI:
# 380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api
```

### Step 3: Push Image to ECR

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  380714695818.dkr.ecr.ap-south-1.amazonaws.com

# Tag image
docker tag kite-fighter-api:latest \
  380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api:latest

# Push to ECR
docker push 380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api:latest
```

### Step 4: Create App Runner Service (AWS Console)

1. **Go to AWS App Runner Console**
   - Region: ap-south-1 (Mumbai)
   - Click "Create service"

2. **Source Configuration**
   - Source: Amazon ECR
   - ECR repository: `380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api`
   - Image tag: latest
   - Deployment trigger: Manual (or Automatic for CI/CD)

3. **Service Settings**
   - Service name: `kite-fighter-api`
   - Port: 3000
   - CPU: 1 vCPU
   - Memory: 2 GB
   - Auto-scaling: Min 1, Max 25 instances

4. **Environment Variables** (Click "Add environment variable" for each)
   ```
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb+srv://kiteManager:Password01@highdb.e3wccuv.mongodb.net/highDb?appName=highDb
   LOG_LEVEL=info
   AUDIT_LOG_TTL_DAYS=90
   RATE_LIMIT_MAX=100
   RATE_LIMIT_TIME_WINDOW=60000
   NOTIFICATION_WORKER_CRON=* * * * *
   NOTIFICATION_MAX_RETRIES=3
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345
   JWT_EXPIRES_IN=7d
   ADMIN_JWT_SECRET=your_super_secret_admin_jwt_key_change_in_production_67890
   AWS_REGION=ap-south-1
   AWS_SES_FROM_EMAIL=noreply@kitefighters.in
   AWS_SES_FROM_NAME=Kite Fighter
   EMAIL_ENABLED=false
   ```

5. **Security**
   - IAM role: Create new service role (auto-generated)

6. **Review and Create**
   - Review all settings
   - Click "Create & deploy"
   - Wait 3-5 minutes for deployment

7. **Verify Deployment**
   ```bash
   # Test health endpoint
   curl https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1/health
   
   # Should return:
   # {"status":"healthy","database":{"connected":true},...}
   ```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | JWT signing secret for players | `your_secret_key_here` |
| `ADMIN_JWT_SECRET` | JWT signing secret for admins | `your_admin_secret_key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `AUDIT_LOG_TTL_DAYS` | Audit log retention days | `90` |
| `RATE_LIMIT_MAX` | Max requests per time window | `100` |
| `RATE_LIMIT_TIME_WINDOW` | Rate limit window (ms) | `60000` |
| `JWT_EXPIRES_IN` | JWT token expiry | `7d` |
| `EMAIL_ENABLED` | Enable email notifications | `false` |

### Security Notes

⚠️ **Important:**
- Never commit `.env.production` to Git
- Change JWT secrets to strong random values
- Use MongoDB Atlas IP whitelist (0.0.0.0/0 for App Runner)
- Rotate secrets periodically

---

## Custom Domain Setup

### Step 1: Link Custom Domain in App Runner

1. Go to App Runner Console → Your service
2. Click "Custom domains" tab
3. Click "Link domain"
4. Enter: `api.kitefighters.in`
5. Click "Link domain"

**You'll see validation records like:**
```
Name: _5ef1999a32bbbfd228a580bcb345a0a8.api
Value: _13c447f0f142abbb76bb6aefaaddc25c.jkddzztszm.acm-validations.aws.

Name: _3749598cfa60815ad803bebadaa9d796.2a57178eoy15q2a7e1654jp7dqsxtlp.api
Value: _49a45ff67a48285a613d536dd18ac2ce.jkddzztszm.acm-validations.aws.
```

### Step 2: Configure DNS (GoDaddy)

1. **Add CNAME for API subdomain:**
   - Type: CNAME
   - Name: `api`
   - Value: `ef8mfpabua.ap-south-1.awsapprunner.com`
   - TTL: 600 seconds

2. **Add SSL Validation CNAME Records** (from App Runner):
   - Type: CNAME
   - Name: `_5ef1999a32bbbfd228a580bcb345a0a8.api`
   - Value: `_13c447f0f142abbb76bb6aefaaddc25c.jkddzztszm.acm-validations.aws.`
   - TTL: 600

   - Type: CNAME
   - Name: `_3749598cfa60815ad803bebadaa9d796.2a57178eoy15q2a7e1654jp7dqsxtlp.api`
   - Value: `_49a45ff67a48285a613d536dd18ac2ce.jkddzztszm.acm-validations.aws.`
   - TTL: 600

### Step 3: Wait for SSL Certificate

- **Time:** 10-30 minutes (sometimes up to 2 hours)
- **Status:** Check App Runner console → Custom domains tab
- **When ready:** Status changes from "Pending certificate DNS validation" to "Active"

### Step 4: Verify Custom Domain

```bash
# Check DNS propagation
nslookup api.kitefighters.in

# Should return:
# api.kitefighters.in canonical name = ef8mfpabua.ap-south-1.awsapprunner.com

# Test HTTPS (once SSL active)
curl https://api.kitefighters.in/api/v1/health
```

---

## Monitoring & Maintenance

### CloudWatch Logs

**View Logs:**
1. Go to CloudWatch Console
2. Log Groups → `/aws/apprunner/kite-fighter-api/service`
3. View application logs, request logs, system logs

**Useful Log Filters:**
```
# Error logs
[ERROR]

# API requests
[info] -

# Database connections
"database"
```

### Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Request Count | Total API requests | - |
| 4xx/5xx Errors | Client/Server errors | > 5% |
| Response Time | Average latency | > 1000ms |
| CPU Utilization | Container CPU usage | > 80% |
| Memory Utilization | Container memory | > 90% |
| Active Instances | Auto-scaled containers | - |

### Health Checks

```bash
# Automated health check (every 5 minutes)
curl https://api.kitefighters.in/api/v1/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-01-26T...",
  "uptime": 12345,
  "database": {
    "connected": true,
    "status": "connected"
  },
  "memory": {
    "heapUsed": "34 MB",
    "heapTotal": "35 MB",
    "rss": "88 MB"
  }
}
```

### Deployment Updates

**To deploy new version:**

1. Build and push new Docker image:
   ```bash
   docker buildx build --platform linux/amd64 -t kite-fighter-api .
   docker tag kite-fighter-api:latest 380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api:latest
   docker push 380714695818.dkr.ecr.ap-south-1.amazonaws.com/kite-fighter-api:latest
   ```

2. In App Runner Console:
   - Click "Deploy"
   - Select "Deploy latest image version"
   - Wait 3-5 minutes

3. **Verify deployment:**
   ```bash
   curl https://api.kitefighters.in/api/v1/health
   ```

---

## Troubleshooting

### Issue 1: Container Fails to Start (Exit Code 255)

**Symptom:**
App Runner shows "Service unhealthy" or deployment fails.

**Causes:**
- Missing environment variables
- Database connection failure
- Invalid MongoDB URI

**Solution:**
1. Check CloudWatch logs for error messages
2. Verify all required env vars are set
3. Test MongoDB connection from local:
   ```bash
   node -e "require('mongoose').connect('YOUR_MONGODB_URI').then(() => console.log('Connected')).catch(e => console.error(e))"
   ```

### Issue 2: Exec Format Error

**Symptom:**
```
exec format error: file is not in a format that can be executed
```

**Cause:**
Docker image built for wrong architecture (arm64 instead of amd64).

**Solution:**
Rebuild with correct platform:
```bash
docker buildx build --platform linux/amd64 -t kite-fighter-api .
```

### Issue 3: 404 Errors on Specific Endpoints

**Symptom:**
Some endpoints return 404 even though they exist in code.

**Solution:**
This was the issue with AWS EB. On App Runner, all endpoints should work.

Verify routes are registered in `src/server.ts`:
```javascript
await fastify.register(playerRoutes, { prefix: '/api/v1/players' });
await fastify.register(membershipRoutes, { prefix: '/api/v1/membership' });
```

### Issue 4: SSL Certificate Pending for Long Time

**Symptom:**
Custom domain status stuck on "Pending certificate DNS validation" for > 2 hours.

**Solution:**
1. Verify CNAME records in DNS:
   ```bash
   nslookup -type=CNAME _5ef1999a32bbbfd228a580bcb345a0a8.api.kitefighters.in
   ```

2. Check records match exactly (no extra spaces, trailing dots)

3. If still failing after 24 hours:
   - Unlink domain in App Runner
   - Delete CNAME records
   - Wait 5 minutes
   - Re-link and add records again

### Issue 5: High Memory Usage

**Symptom:**
Memory utilization consistently > 80%.

**Solution:**
1. Check for memory leaks in code
2. Increase memory allocation:
   - App Runner Console → Configuration
   - Change from 2 GB to 3 GB or 4 GB
3. Monitor garbage collection:
   ```javascript
   // In code
   if (global.gc) {
     global.gc();
   }
   ```

### Issue 6: Database Connection Timeouts

**Symptom:**
Health check fails with "database: { connected: false }".

**Solution:**
1. Check MongoDB Atlas network access:
   - IP Whitelist: Add `0.0.0.0/0` (allow all)
   - Or specific App Runner IPs if available

2. Verify connection string includes retry logic:
   ```
   mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority
   ```

3. Test connection from AWS region:
   ```bash
   # From EC2 in ap-south-1
   telnet cluster.mongodb.net 27017
   ```

---

## Cost Optimization

### Current Costs (Estimated)

| Resource | Monthly Cost |
|----------|--------------|
| App Runner (1-2 instances) | $15-25 |
| ECR Storage (< 1 GB) | < $1 |
| CloudWatch Logs (5 GB) | $2-3 |
| Data Transfer (10 GB) | $1-2 |
| **Total** | **$20-35** |

### Tips to Reduce Costs

1. **Use Smaller Instances:**
   - Current: 1 vCPU, 2 GB RAM
   - Consider: 0.25 vCPU, 0.5 GB RAM for low traffic

2. **Clean Up Old Images:**
   ```bash
   # Delete old ECR images
   aws ecr batch-delete-image \
     --repository-name kite-fighter-api \
     --image-ids imageTag=old-tag
   ```

3. **Reduce Log Retention:**
   - CloudWatch Logs → Retention: 7 days (instead of indefinite)

4. **Pause During Development:**
   - Delete App Runner service when not needed
   - Recreate when needed (< 5 minutes)

---

## Additional Resources

- [API Documentation](./API_DOCUMENTATION.md) - Complete API reference
- [Authentication Guide](./AUTHENTICATION_GUIDE.md) - JWT authentication
- [Club Membership Guide](./CLUB_MEMBERSHIP_GUIDE.md) - Club features
- [WebSocket Guide](./WEBSOCKET_IMPLEMENTATION.md) - Real-time updates

---

## Support

For deployment issues:
1. Check CloudWatch logs for errors
2. Verify environment variables
3. Test Docker image locally
4. Check MongoDB connection
5. Contact AWS Support if App Runner issues persist
