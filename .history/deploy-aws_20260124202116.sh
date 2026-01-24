# AWS S3 + CloudFront Deployment Script
# Run this script to deploy to AWS S3

#!/bin/bash

# Configuration
BUCKET_NAME="kite-fighters-ui-prod"
REGION="ap-south-1"
DISTRIBUTION_ID="YOUR_CLOUDFRONT_DISTRIBUTION_ID"  # Replace with your CloudFront distribution ID

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AWS Deployment...${NC}"

# Build the project
echo -e "${BLUE}📦 Building project for production...${NC}"
npm run build:prod

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Sync to S3
echo -e "${BLUE}☁️  Uploading to S3...${NC}"
aws s3 sync dist/ s3://${BUCKET_NAME} --delete --region ${REGION}

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ S3 upload failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files uploaded to S3${NC}"

# Invalidate CloudFront cache (optional but recommended)
if [ "$DISTRIBUTION_ID" != "YOUR_CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID} --paths "/*"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
    else
        echo -e "${RED}⚠️  CloudFront invalidation failed (non-critical)${NC}"
    fi
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}🌐 Your app should be live at: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com${NC}"
