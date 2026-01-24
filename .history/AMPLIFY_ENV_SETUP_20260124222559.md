# AWS Amplify Environment Variables Setup Guide

## 🔍 How to Find Environment Variables in AWS Amplify

### Method 1: From App Dashboard

1. **Login to AWS Console**: https://console.aws.amazon.com/amplify
2. **Select your app** from the list (kite-fighter-ui)
3. Look at the **left sidebar** under the app name
4. Click on **"Environment variables"** (under "Hosting environments" section)
5. Click **"Manage variables"** button in the top right

### Method 2: From App Settings

1. In your app's main page
2. Look for tabs at the top: **Overview**, **Deployments**, **Environment variables**, etc.
3. Click the **"Environment variables"** tab
4. Click **"Manage variables"** button

### Method 3: Navigation Path

```
AWS Amplify Console 
  → Your App (kite-fighter-ui) 
    → Environment variables (left sidebar or top tabs)
      → Manage variables button
```

## ✅ Required Environment Variables

Add these two variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `VITE_API_BASE_URL` | `http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com/api/v1` | Backend API endpoint |
| `VITE_ENVIRONMENT` | `production` | Environment identifier |

## 📝 Step-by-Step Instructions

### Step 1: Navigate to Environment Variables

```
1. Open AWS Amplify Console
2. Click on your app: kite-fighter-ui
3. In left sidebar, find "Environment variables" 
   (it's under the "Hosting environments" or "App settings" section)
```

### Step 2: Add Variables

```
1. Click "Manage variables" button (top right)
2. Click "Add variable" or use the form
3. For first variable:
   - Variable name: VITE_API_BASE_URL
   - Value: http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com/api/v1
4. Click "+ Add variable" to add another
5. For second variable:
   - Variable name: VITE_ENVIRONMENT
   - Value: production
6. Click "Save" button at bottom
```

### Step 3: Wait for Deployment

- Amplify will automatically trigger a new build
- This will take about 1-2 minutes
- Check the "Deployments" tab to monitor progress

## 🔍 Can't Find Environment Variables?

### If you don't see "Environment variables" in the sidebar:

1. **Make sure you're viewing the correct app** - Check the app name at the top
2. **Check your IAM permissions** - You need:
   - `amplify:GetApp`
   - `amplify:UpdateApp`
   - `amplify:GetEnvironmentVariables`
   - `amplify:PutEnvironmentVariables`

3. **Try the alternate navigation**:
   - From Amplify home → All apps → Click your app
   - Look for "App settings" in the menu
   - Expand "App settings" → Click "Environment variables"

4. **Check if you're in the right region**:
   - Your Amplify app is in: **ap-south-1 (Mumbai)**
   - Make sure the region selector (top right) shows "Asia Pacific (Mumbai)"

### If Environment Variables section is empty or broken:

Try using AWS CLI to add variables:

```bash
# Set your app ID (get from Amplify console URL or AWS CLI)
export APP_ID="your-app-id"

# Add environment variables
aws amplify update-app \
  --app-id $APP_ID \
  --environment-variables \
    VITE_API_BASE_URL=http://kite-fighter-prod.eba-vnye9xcq.ap-south-1.elasticbeanstalk.com/api/v1,VITE_ENVIRONMENT=production \
  --region ap-south-1
```

## 🔐 Finding Your Amplify App ID

If you need the App ID for CLI commands:

1. Go to Amplify Console
2. Click on your app
3. Look at the URL in your browser:
   ```
   https://console.aws.amazon.com/amplify/home?region=ap-south-1#/XXXXX/...
   ```
   The `XXXXX` part is your App ID

OR use CLI:
```bash
aws amplify list-apps --region ap-south-1
```

## ✅ Verify Variables Were Added

After saving, you should see your variables listed:

```
Variable name          Value
─────────────────────────────────────────────
VITE_API_BASE_URL      http://kite-fighter-prod...
VITE_ENVIRONMENT       production
```

## 🚀 After Adding Variables

1. Amplify will start a new deployment automatically
2. Go to "Deployments" tab to watch progress
3. Once completed, visit your app URL
4. Open browser DevTools (F12) → Console
5. You should see: `🚀 API Environment: production`

## 🐛 Troubleshooting

### Variables not taking effect?

1. **Check the deployment logs**:
   - Go to Deployments tab
   - Click on latest deployment
   - Check "Build" logs
   - Search for "VITE_API_BASE_URL" - you should see it in the environment

2. **Clear browser cache**:
   ```
   Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   ```

3. **Redeploy manually**:
   - Go to Deployments tab
   - Click "Redeploy this version" on the latest deployment

### Still having CORS errors?

The environment variables fix the API URL on the frontend. You still need to:
1. Configure CORS on your backend (see [BACKEND_CORS_FIX.md](BACKEND_CORS_FIX.md))
2. Allow your Amplify domain in the backend CORS configuration

## 📞 Need More Help?

- Check AWS Amplify Documentation: https://docs.amplify.aws/
- AWS Support: https://console.aws.amazon.com/support/
- Check deployment logs in Amplify Console for specific error messages

---

**Quick Reference**: After adding environment variables, go to **Deployments** tab to verify they were included in the build.
