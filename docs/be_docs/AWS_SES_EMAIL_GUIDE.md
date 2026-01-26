# AWS SES Email Integration Guide

## Overview

The Kite Fighter API now uses **Amazon SES (Simple Email Service)** for sending notification emails to players and club owners. This guide covers setup, configuration, pricing, and usage.

---

## 📧 AWS SES Pricing

### Free Tier
- **62,000 emails per month** for FREE when sending from:
  - Amazon EC2
  - AWS Elastic Beanstalk
  - AWS Lambda
  - Amazon Lightsail
  - Or any other AWS compute service

### Paid Tier (After Free Tier)
- **$0.10 per 1,000 emails** sent
- **$0.12 per GB** of attachments sent
- No minimum fees
- Pay only for what you use

### Example Monthly Costs
| Monthly Emails | Cost |
|---------------|------|
| 62,000 (Free Tier) | $0.00 |
| 100,000 | $3.80 |
| 500,000 | $43.80 |
| 1,000,000 | $93.80 |

**Note:** If your API is deployed on AWS (EC2, Elastic Beanstalk, etc.), you get 62,000 FREE emails every month!

---

## 🚀 Setup Instructions

### Step 1: Set Up AWS SES

#### 1.1 Create AWS Account
If you don't have one already: https://aws.amazon.com/

#### 1.2 Verify Your Email Domain (Recommended for Production)

1. Go to AWS SES Console: https://console.aws.amazon.com/ses/
2. Click "Verified identities" → "Create identity"
3. Choose "Domain"
4. Enter your domain (e.g., `kitefighters.in`)
5. Enable "Easy DKIM"
6. Add the provided DNS records to your domain registrar
7. Wait for verification (usually 15-30 minutes)

#### 1.3 OR Verify Individual Email Address (For Testing)

1. Go to AWS SES Console
2. Click "Verified identities" → "Create identity"
3. Choose "Email address"
4. Enter your email (e.g., `noreply@kitefighters.in`)
5. Check your inbox and click the verification link

⚠️ **Important:** In sandbox mode, you can only send emails TO verified addresses. Request production access to send to any email.

### Step 2: Request Production Access (Required for Real Users)

By default, AWS SES starts in **Sandbox Mode** with limitations:
- Can only send TO verified email addresses
- Limited to 200 emails per 24 hours
- Maximum 1 email per second

**To remove limitations:**

1. Go to AWS SES Console
2. Click "Account dashboard"
3. Click "Request production access"
4. Fill out the form:
   - **Use case description:** "Transactional emails for Kite Fighter sports management platform (account approvals, club notifications, match updates)"
   - **Website URL:** Your website
   - **Expected sending rate:** Estimate your daily volume
5. Submit request (usually approved within 24 hours)

### Step 3: Create IAM User with SES Permissions

1. Go to IAM Console: https://console.aws.amazon.com/iam/
2. Click "Users" → "Add users"
3. User name: `kite-fighter-ses-sender`
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"
6. Click "Attach existing policies directly"
7. Search and select: **AmazonSESFullAccess** (or create custom policy)
8. Click through to "Create user"
9. **SAVE the Access Key ID and Secret Access Key** (shown only once!)

### Step 4: Configure Environment Variables

Update your `.env.development` or `.env.production`:

```bash
# Enable email sending
EMAIL_ENABLED=true

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...YOUR_KEY_HERE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Email Settings
AWS_SES_FROM_EMAIL=noreply@kitefighters.in
AWS_SES_FROM_NAME=Kite Fighter

# Frontend URL for email links
FRONTEND_URL=https://kitefighters.in
```

### Step 5: Install Dependencies

```bash
npm install
```

This will install `@aws-sdk/client-ses` (already added to package.json).

### Step 6: Test Email Sending

Start the server:
```bash
npm run dev
```

Trigger a notification (e.g., approve a player):
```bash
curl -X POST http://localhost:3000/api/v1/admin/players/{playerId}/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Check the logs for email sending confirmation.

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_ENABLED` | No | `false` | Enable/disable email sending |
| `AWS_REGION` | No | `us-east-1` | AWS region for SES |
| `AWS_ACCESS_KEY_ID` | Yes* | - | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | Yes* | - | IAM user secret key |
| `AWS_SES_FROM_EMAIL` | No | `noreply@example.com` | Sender email address (must be verified) |
| `AWS_SES_FROM_NAME` | No | `Kite Fighter` | Sender display name |
| `FRONTEND_URL` | No | `http://localhost:3000` | Frontend URL for email links |

*Required only if `EMAIL_ENABLED=true`

### Disabling Email in Development

Set `EMAIL_ENABLED=false` to disable email sending. Emails will be logged to console instead:

```bash
EMAIL_ENABLED=false
```

---

## 📨 Email Templates

The system includes beautiful HTML email templates for all notification types:

### Player Notifications
1. **Player Approved** - Welcome email with getting started guide
2. **Player Rejected** - Rejection notice with reason
3. **Player Deleted** - Account deletion confirmation

### Club Notifications
4. **Club Approved** - Club approval with next steps
5. **Club Rejected** - Rejection notice with reason
6. **Club Deleted** - Deletion confirmation

### Club Membership
7. **Join Request** - Notifies owners/co-owners of new join request
8. **Join Approved** - Welcomes new member
9. **Join Rejected** - Rejection with optional reason

All emails include:
- ✅ Beautiful HTML design with gradient headers
- ✅ Mobile-responsive layout
- ✅ Clear call-to-action buttons
- ✅ Plain text fallback for email clients without HTML support
- ✅ Branded with Kite Fighter colors and logo

---

## 🔍 Monitoring & Troubleshooting

### Check Email Sending Status

AWS SES Console → "Account dashboard" shows:
- Sending statistics
- Bounce rate
- Complaint rate
- Reputation metrics

### Common Issues

#### 1. Emails Not Sending in Sandbox Mode
**Problem:** Can only send to verified addresses in sandbox mode.

**Solution:** Request production access (see Step 2 above).

#### 2. "Email Address Not Verified" Error
**Problem:** Sender email not verified in SES.

**Solution:** Verify your email address or domain in SES Console.

#### 3. High Bounce Rate Warning
**Problem:** Sending to invalid email addresses.

**Solution:** 
- Validate email addresses before sending
- Remove invalid emails from database
- Use email verification on registration

#### 4. AWS Credentials Error
**Problem:** Invalid or expired AWS credentials.

**Solution:**
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Check IAM user has SES permissions
- Regenerate credentials if needed

### Logs

Email sending is logged with structured logging:

```typescript
// Success
✅ Email sent successfully via AWS SES
{ to: 'player@example.com', subject: 'Account Approved', messageId: '...' }

// Failure
❌ Failed to send email via AWS SES
{ err: Error, to: 'player@example.com', subject: 'Account Approved' }

// Disabled
📧 Email disabled - would send: 
{ to: 'player@example.com', subject: 'Account Approved' }
```

---

## 🎯 Best Practices

### 1. Use Domain Email (Not Gmail/Yahoo)
❌ `notifications@gmail.com`  
✅ `noreply@kitefighters.in`

### 2. Warm Up Your Domain (Production)
Start with low volume and gradually increase:
- Day 1-2: 50 emails/day
- Day 3-5: 200 emails/day
- Day 6-10: 500 emails/day
- Day 11+: Full volume

### 3. Monitor Bounce & Complaint Rates
- Bounce rate < 5%
- Complaint rate < 0.1%

High rates can hurt your sender reputation!

### 4. Implement Email Validation
Validate email addresses before storing in database:
```typescript
email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
```

### 5. Use Unsubscribe Links (Optional)
For marketing emails, include unsubscribe links to comply with regulations.

### 6. Test Before Production
Always test emails in development/staging before deploying to production.

---

## 🔐 Security Best Practices

### 1. Never Commit AWS Credentials
- Use environment variables
- Add `.env*` to `.gitignore`
- Use AWS IAM roles for EC2/ECS (no hardcoded keys!)

### 2. Use Least Privilege IAM Policy
Instead of `AmazonSESFullAccess`, use custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. Rotate AWS Credentials Regularly
Rotate access keys every 90 days for security.

### 4. Enable MFA on AWS Account
Protect your AWS root account with multi-factor authentication.

---

## 📊 Cost Optimization Tips

1. **Deploy on AWS:** Get 62,000 free emails/month
2. **Batch Processing:** The notification worker already processes emails in batches
3. **Remove Bounces:** Regularly clean up invalid email addresses
4. **Avoid Duplicate Notifications:** The queue system prevents duplicates
5. **Monitor Usage:** Set up AWS billing alerts

---

## 🚀 Production Deployment Checklist

- [ ] Domain verified in AWS SES
- [ ] Production access approved
- [ ] IAM user created with SES permissions
- [ ] Environment variables configured
- [ ] `EMAIL_ENABLED=true` in production
- [ ] Test emails sent successfully
- [ ] Monitoring set up in AWS CloudWatch
- [ ] Billing alerts configured
- [ ] Bounce/complaint handling implemented
- [ ] Email templates reviewed and tested

---

## 📚 Additional Resources

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SES Pricing](https://aws.amazon.com/ses/pricing/)
- [SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [SES Sending Limits](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html)

---

## 💡 Alternative Free Options

If you want to avoid AWS:

1. **SendGrid** - 100 emails/day free
2. **Mailgun** - 5,000 emails/month free (first 3 months)
3. **Brevo (Sendinblue)** - 300 emails/day free
4. **Postmark** - 100 emails/month free

To switch providers, modify `EmailService` class to use their SDK instead of AWS SES.

---

## Support

For issues with AWS SES integration:
1. Check logs for error messages
2. Verify AWS credentials and permissions
3. Ensure sender email is verified
4. Check AWS SES sending limits and quotas

For API-specific issues, check the main API documentation.
