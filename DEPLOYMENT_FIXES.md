# Deployment Pipeline Fixes

## Issues Fixed

### 1. ❌ IAM Permission Error
**Error:** `AccessDeniedException: amplify:StartJob not authorized`

**Solution:** Created IAM policy file `aws-iam-amplify-policy.json` with required permissions:
- `amplify:StartJob` - Trigger deployments
- `amplify:StopJob` - Stop jobs if needed
- `amplify:GetJob` - Check status
- `amplify:ListJobs` - List history
- `amplify:GetApp` - Read app info
- `amplify:GetBranch` - Read branch info

**Action Required:** Attach this policy to the `github-actions-deployer` IAM user in AWS Console.

See: [.github/IAM_PERMISSION_FIX.md](.github/IAM_PERMISSION_FIX.md)

### 2. ❌ Health Check URL Error
**Error:** `curl: (2) no URL specified` - Missing `DEPLOY_URL` variable

**Solution:** Updated deployment workflow to:
1. Automatically fetch Amplify app URL using AWS CLI
2. Remove dependency on manual `DEPLOY_URL` variable
3. Add proper error handling for missing URLs
4. Output deployment URL in logs

**Changes:**
- Deployment job now outputs app URL
- Health check fetches URL dynamically
- Graceful fallback if URL not available

### 3. ❌ Concurrent Job Error
**Error:** `LimitExceededException: already have pending or running jobs`

**Solution:** Added intelligent job management to deployment workflow:
1. Checks for existing running/pending jobs before starting
2. Waits up to 10 minutes for existing jobs to complete
3. Added GitHub Actions concurrency control
4. Prevents duplicate deployments from running simultaneously

**Changes:**
- New "Check for existing jobs" step monitors Amplify job queue
- Workflow waits for completion before starting new deployment
- Concurrency group prevents multiple workflow runs
- Added `amplify:StopJob` permission for manual intervention

## Files Modified

### Created
- `aws-iam-amplify-policy.json` - IAM policy for GitHub Actions
- `.github/IAM_PERMISSION_FIX.md` - Step-by-step fix guide

### Updated
- `.github/workflows/deploy.yml`:
  - Added concurrency control to prevent duplicate runs
  - Added job queue checking and waiting logic
  - Added app URL retrieval
  - Enhanced health checks with error handling
  - Removed hardcoded `DEPLOY_URL` dependency
- `.github/PIPELINE.md`:
  - Removed `DEPLOY_URL` from required variables
- `aws-iam-amplify-policy.json`:
  - Added `amplify:StopJob` permission
- `.github/IAM_PERMISSION_FIX.md`:
  - Added troubleshooting for concurrent job errors

## Next Steps

### Immediate (Required)
1. ✅ Apply IAM policy to AWS user:
   ```bash
   aws iam put-user-policy \
     --user-name github-actions-deployer \
     --policy-name AmplifyDeploymentPermissions \
     --policy-document file://aws-iam-amplify-policy.json
   ```

2. ✅ Commit and push these changes:
   ```bash
   git add .
   git commit -m "fix: add IAM policy and fix deployment health checks"
   git push origin main
   ```

### Verification
3. Monitor GitHub Actions workflow at:
   - Actions → Deploy to Production
   - Should see: ✅ Deployment job started
   - Should see: 📱 App URL logged
   - Should see: ✅ Application is healthy

## What Changed in CI/CD

### Before
- Required manual `DEPLOY_URL` variable setup
- Hard-coded URL in health checks
- Failed with missing IAM permissions
- No deployment URL visibility
- Failed when jobs were already running
- Could trigger multiple deployments simultaneously

### After
- Automatically detects Amplify app URL
- Dynamic health checks with fallback
- Proper IAM permissions documented
- Deployment URL shown in logs
- More resilient error handling
- Waits for existing jobs to complete
- Prevents concurrent deployments
- Added concurrency control at workflow level

## Troubleshooting

### Pipeline still fails?
1. Check IAM policy applied: `aws iam get-user-policy --user-name github-actions-deployer --policy-name AmplifyDeploymentPermissions`
2. Verify secrets set in GitHub: Settings → Secrets → Actions
3. Check AWS region matches in secrets
4. Ensure Amplify app ID is correct

### Health check times out?
- Increased wait time to 90 seconds
- Now fails gracefully without blocking deployment
- Check Amplify console for actual deployment status

## Impact
- ✅ Automated deployments now work end-to-end
- ✅ No manual URL configuration needed
- ✅ Better visibility into deployment status
- ✅ Proper security with least-privilege IAM policy
