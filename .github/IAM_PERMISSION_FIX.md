# AWS IAM Permission Fix for GitHub Actions Deployer

## Error
```
AccessDeniedException: User: arn:aws:iam::380714695818:user/github-actions-deployer 
is not authorized to perform: amplify:StartJob
```

## Root Cause
The IAM user `github-actions-deployer` lacks the necessary Amplify permissions to trigger deployment jobs.

## Solution

### Option 1: Quick Fix via AWS Console (Recommended)

1. **Open AWS IAM Console**
   ```
   https://console.aws.amazon.com/iam/
   ```

2. **Navigate to Users**
   - Click "Users" in the left sidebar
   - Search for `github-actions-deployer`
   - Click on the username

3. **Attach Inline Policy**
   - Click "Permissions" tab
   - Click "Add permissions" → "Create inline policy"
   - Switch to "JSON" tab
   - Copy and paste the policy from `aws-iam-amplify-policy.json`
   - Click "Review policy"
   - Name it: `AmplifyDeploymentPermissions`
   - Click "Create policy"

4. **Verify Permissions**
   - The user should now have:
     - `amplify:StartJob`
     - `amplify:GetJob`
     - `amplify:ListJobs`
     - `amplify:GetApp`
     - `amplify:GetBranch`

### Option 2: AWS CLI (Alternative)

```bash
# Create the policy
aws iam put-user-policy \
  --user-name github-actions-deployer \
  --policy-name AmplifyDeploymentPermissions \
  --policy-document file://aws-iam-amplify-policy.json

# Verify the policy was attached
aws iam list-user-policies --user-name github-actions-deployer
```

### Option 3: Use Managed Policy (Less Secure)

Attach the AWS managed policy `AdministratorAccess-Amplify`:

```bash
aws iam attach-user-policy \
  --user-name github-actions-deployer \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess-Amplify
```

⚠️ **Note**: This grants broader permissions than necessary. Use Option 1 for least-privilege access.

## Testing the Fix

1. **Re-run the GitHub Actions workflow**
   ```bash
   # Trigger manually from GitHub Actions UI
   # OR push a new commit
   git commit --allow-empty -m "test: trigger deployment"
   git push origin main
   ```

2. **Monitor the deployment**
   - Go to GitHub Actions tab
   - Watch for successful `Trigger Amplify deployment` step

## Verification Checklist

- [ ] IAM policy attached to `github-actions-deployer` user
- [ ] Policy includes `amplify:StartJob` permission
- [ ] Resource ARN matches your account ID (380714695818)
- [ ] GitHub Actions workflow re-run successful
- [ ] Amplify deployment triggered without errors

## Additional Resources

- **IAM Policy File**: `aws-iam-amplify-policy.json`
- **Pipeline Documentation**: `.github/PIPELINE.md`
- **Deployment Workflow**: `.github/workflows/deploy.yml`

## Troubleshooting

### Error persists after applying policy
1. Wait 1-2 minutes for IAM propagation
2. Verify the policy is attached:
   ```bash
   aws iam get-user-policy \
     --user-name github-actions-deployer \
     --policy-name AmplifyDeploymentPermissions
   ```
3. Check the resource ARN in the policy matches your Amplify app

### Cannot find IAM user
The user might be named differently. Check GitHub secrets:
- `AWS_ACCESS_KEY_ID` → Use this to identify the user
- Run: `aws iam get-user --user-name <username>`

### Wrong AWS Region
Update the policy if your Amplify app is in a different region:
```json
"Resource": "arn:aws:amplify:YOUR_REGION:380714695818:apps/*/..."
```
