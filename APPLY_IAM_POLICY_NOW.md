# 🚨 URGENT: Apply IAM Policy Now

## Current Issue
The IAM user `github-actions-deployer` has `amplify:GetApp` permission, but the Resource ARN is too restrictive. The `GetApp` action needs app-level access, not branch-level.

## Quick Fix (5 minutes via AWS Console)

### Step 1: Open AWS IAM Console
1. Go to: https://console.aws.amazon.com/iam/
2. **Important:** Log in with an AWS account that has IAM admin permissions (not `kite-fighter-deployer`)

### Step 2: Navigate to the User
1. Click **"Users"** in the left sidebar
2. Search for: `github-actions-deployer`
3. Click on the username

### Step 3: Apply the Policy
1. Click the **"Permissions"** tab
2. Look for existing policy named `AmplifyDeploymentPermissions`

#### If Policy Exists (Update It):
- Click on `AmplifyDeploymentPermissions`
- Click **"Edit policy"**
- Click **"JSON"** tab
- Delete all content and paste this:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AmplifyAppLevelPermissions",
            "Effect": "Allow",
            "Action": [
                "amplify:GetApp"
            ],
            "Resource": [
                "arn:aws:amplify:*:380714695818:apps/*"
            ]
        },
        {
            "Sid": "AmplifyBranchAndJobPermissions",
            "Effect": "Allow",
            "Action": [
                "amplify:StartJob",
                "amplify:StopJob",
                "amplify:GetJob",
                "amplify:ListJobs",
                "amplify:GetBranch"
            ],
            "Resource": [
                "arn:aws:amplify:*:380714695818:apps/*/branches/main",
                "arn:aws:amplify:*:380714695818:apps/*/branches/main/jobs/*"
            ]
        }
    ]
}
```

- Click **"Review policy"**
- Click **"Save changes"**

#### If Policy Doesn't Exist (Create It):
- Click **"Add permissions"** → **"Create inline policy"**
- Click **"JSON"** tab
- Paste the JSON from above
- Click **"Review policy"**
- Name it: `AmplifyDeploymentPermissions`
- Click **"Create policy"**

### Step 4: Verify
Check that these permissions are now listed:
- ✅ amplify:StartJob
- ✅ amplify:StopJob
- ✅ amplify:GetJob
- ✅ amplify:ListJobs
- ✅ amplify:GetApp ← **This was missing!**
- ✅ amplify:GetBranch

### Step 5: Re-run GitHub Actions
1. Go to your GitHub repository
2. Click **Actions** tab
3. Find the failed workflow
4. Click **"Re-run failed jobs"**

## Alternative: Use AWS Admin Account CLI

If you have AWS CLI configured with admin credentials:

```bash
# Switch to admin profile (if you have one configured)
export AWS_PROFILE=admin  # or whatever your admin profile is named

# Apply the policy
aws iam put-user-policy \
  --user-name github-actions-deployer \
  --policy-name AmplifyDeploymentPermissions \
  --policy-document file://aws-iam-amplify-policy.json

# Verify it was applied
aws iam get-user-policy \
  --user-name github-actions-deployer \
  --policy-name AmplifyDeploymentPermissions
```

## Why This Happened

The IAM policy file exists in your repo (`aws-iam-amplify-policy.json`), but it needs to be **applied to AWS**. Having the file locally doesn't automatically update AWS permissions.

## Expected Result

After applying the policy, your deployment workflow will:
1. ✅ Start Amplify jobs
2. ✅ Check for existing jobs
3. ✅ Get app URL automatically
4. ✅ Run health checks
5. ✅ Complete successfully

## Troubleshooting

### "I don't have AWS Console access"
Contact your AWS administrator and share:
- User to modify: `github-actions-deployer`
- Policy to apply: `aws-iam-amplify-policy.json` (from this repo)
- Or share this guide: `.github/IAM_PERMISSION_FIX.md`

### "Policy applied but still failing"
1. Wait 1-2 minutes for IAM propagation
2. Re-run the GitHub Actions workflow
3. Check that the policy JSON is correct in AWS Console

### "Cannot find the user"
The IAM user might have a different name. Check your GitHub Secrets:
- Settings → Secrets → Actions
- Look at `AWS_ACCESS_KEY_ID`
- Use AWS Console to find which user owns that access key
