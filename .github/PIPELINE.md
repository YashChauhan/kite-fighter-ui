# GitHub Actions CI/CD Pipeline

This repository uses GitHub Actions for continuous integration and deployment.

## 🚀 Workflows

### 1. CI Pipeline (`ci.yml`)
**Triggers:** Push to any branch, Pull requests to main/develop

**Jobs:**
- **Lint & Test**: Runs ESLint and test suite with coverage
- **Build**: Creates development and production builds
- **Type Check**: Validates TypeScript types
- **Security Scan**: Runs npm audit for vulnerabilities

### 2. Deploy Pipeline (`deploy.yml`)
**Triggers:** Push to main branch, Manual workflow dispatch

**Jobs:**
- **Deploy**: Builds and deploys to AWS Amplify
- **Post-Deploy Health Check**: Verifies deployment success

### 3. PR Checks (`pr-checks.yml`)
**Triggers:** Pull request opened/updated

**Jobs:**
- **PR Info**: Displays PR metadata
- **Code Quality**: Runs linting and tests, comments results on PR
- **Size Check**: Analyzes bundle size
- **Conflict Check**: Detects merge conflicts

## ⚙️ Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

### Production Secrets
```
AWS_ACCESS_KEY_ID         # AWS access key for Amplify
AWS_SECRET_ACCESS_KEY     # AWS secret key
AWS_REGION                # AWS region (e.g., ap-south-1)
AMPLIFY_APP_ID            # Amplify application ID
VITE_API_BASE_URL_PROD    # Production API URL
VITE_SOCKET_URL_PROD      # Production WebSocket URL
```

### Development Secrets (Optional)
```
VITE_API_BASE_URL_DEV     # Development API URL
VITE_SOCKET_URL_DEV       # Development WebSocket URL
```

## 🔧 Setup Instructions

### 1. Configure GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret** and add each secret

**For AWS Amplify deployment:**
```bash
AWS_ACCESS_KEY_ID: <your-aws-access-key>
AWS_SECRET_ACCESS_KEY: <your-aws-secret>
AWS_REGION: ap-south-1
AMPLIFY_APP_ID: <your-amplify-app-id>
```

**For environment variables:**
```bash
VITE_API_BASE_URL_PROD: https://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1
VITE_SOCKET_URL_PROD: wss://ef8mfpabua.ap-south-1.awsapprunner.com/api/v1/ws/matches
```

### 2. Get AWS Amplify App ID

```bash
aws amplify list-apps --region ap-south-1
```

Or from AWS Console: **Amplify → Your App → General → App settings → App ARN** (extract the ID from ARN)

### 3. Create AWS IAM User for GitHub Actions

1. Go to AWS IAM Console
2. Create new user: `github-actions-kite-fighters`
3. Attach policy: `AdministratorAccess-Amplify` (or create custom policy)
4. Generate access key
5. Save credentials as GitHub secrets

**Minimal IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:StartJob",
        "amplify:GetJob",
        "amplify:ListJobs"
      ],
      "Resource": "arn:aws:amplify:ap-south-1:*:apps/<your-app-id>/*"
    }
  ]
}
```

### 4. Configure Branch Protection Rules (Optional)

In **Settings → Branches → Add rule**:
- Branch name pattern: `main`
- ✅ Require status checks to pass before merging
- Select: `Lint & Test`, `Build`, `Type Check`
- ✅ Require branches to be up to date before merging

## 📊 Pipeline Status Badges

Add to your README.md:

```markdown
![CI Pipeline](https://github.com/YashChauhan/kite-fighter-ui/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/YashChauhan/kite-fighter-ui/actions/workflows/deploy.yml/badge.svg)
```

## 🎯 Usage

### Automatic Triggers

- **Push to any branch** → Runs CI pipeline
- **Open/update PR** → Runs PR checks + CI
- **Merge to main** → Runs CI + Deploy

### Manual Deployment

1. Go to **Actions** tab
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Choose environment (production/staging)
5. Click **Run workflow**

## 🐛 Troubleshooting

### Pipeline fails with "npm ci" errors
- Ensure `package-lock.json` is committed
- Check Node.js version in workflow matches your local version

### Deployment fails
- Verify AWS credentials are correct
- Check Amplify App ID is valid
- Ensure AWS IAM user has necessary permissions

### Environment variables not working
- Secrets must be set in GitHub repository settings
- Secret names must match exactly (case-sensitive)
- Re-run workflow after adding/updating secrets

### Tests fail in CI but pass locally
- Check if tests depend on local files/services
- Ensure test setup is in `vitest.setup.ts`
- Review environment differences

## 📝 Notes

- **Node.js Version**: 22.12 (update in workflows if changed)
- **Coverage Reports**: Available in Actions artifacts (30 days retention)
- **Build Artifacts**: Available for 7 days after workflow run
- **Deployment**: Only triggers on main branch

## 🔄 Updating Workflows

After modifying workflow files:
```bash
git add .github/workflows/
git commit -m "chore: update CI/CD pipeline"
git push
```

Workflows will automatically update on next run.
