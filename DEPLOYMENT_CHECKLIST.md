# MedContractHub Production Deployment Checklist

## 🎯 Pre-Deployment Checklist

### ✅ Code Quality
- [x] Build compiles successfully (`npm run build`)
- [ ] ESLint errors resolved (180 warnings remaining - non-blocking)
- [x] TypeScript errors fixed (0 errors)
- [ ] All tests passing (273/429 passing - review critical failures)

### ✅ Environment Configuration
- [x] Production environment file created (`.env.production`)
- [x] CSRF secret generated with secure random value
- [x] Sync token generated with secure random value
- [ ] Redis URL configured for production
- [ ] Sentry DSN configured for error monitoring
- [ ] Production domain set in `NEXT_PUBLIC_APP_URL`

### 🔄 Required Updates Before Deployment

#### 1. **Stripe Configuration** (CRITICAL)
- [ ] Replace test Stripe keys with production keys:
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`

#### 2. **Redis Configuration** (CRITICAL)
- [ ] Set production Redis URL (currently using localhost)
- [ ] Configure Redis cluster for high availability
- [ ] Set up L1/L2 cache for OCR service

#### 3. **Sentry Monitoring** (IMPORTANT)
- [ ] Create Sentry project
- [ ] Add `SENTRY_DSN` to environment
- [ ] Configure source maps upload

#### 4. **Database Migrations** (CRITICAL)
- [ ] Apply all migrations to production Supabase:
  ```bash
  # Connect to production database
  supabase db push --linked
  
  # Or manually apply migrations
  psql $SUPABASE_DB_URL < supabase/migrations/*.sql
  ```

### 📋 Vercel Deployment Configuration

1. **Environment Variables**
   - [ ] Copy all variables from `.env.production` to Vercel dashboard
   - [ ] Ensure sensitive keys are marked as secret

2. **Build Settings**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "installCommand": "npm install",
     "framework": "nextjs"
   }
   ```

3. **Function Configuration**
   - [ ] Set timeouts for AI/OCR routes (60s)
   - [ ] Configure regions (iad1)

4. **Cron Jobs**
   - [ ] SAM.gov sync: `0 */6 * * *`
   - [ ] Email reminders: `0 9 * * *`

### 🚀 Deployment Steps

1. **Test Production Build Locally**
   ```bash
   # Build and start
   npm run build
   npm start
   
   # Test critical paths:
   # - Authentication flow
   # - Opportunity search
   # - AI analysis
   # - Document OCR
   ```

2. **Deploy to Staging**
   ```bash
   npm run deploy:staging
   # Test all features in staging environment
   ```

3. **Production Deployment**
   ```bash
   # Final deployment
   npm run deploy:production
   
   # Or via Vercel CLI
   vercel --prod
   ```

### 🔍 Post-Deployment Verification

- [ ] Health check endpoint responding: `/api/health`
- [ ] Authentication working (login/logout)
- [ ] SAM.gov integration fetching opportunities
- [ ] AI analysis endpoints responding
- [ ] OCR processing documents
- [ ] Email notifications sending
- [ ] Cron jobs executing on schedule
- [ ] Error tracking in Sentry
- [ ] Performance monitoring active

### 🚨 Rollback Plan

If issues occur:
1. Revert to previous deployment in Vercel dashboard
2. Check error logs in Vercel Functions tab
3. Monitor Sentry for error spikes
4. Database rollback scripts available in `/scripts/rollback/`

### 📊 Monitoring Setup

1. **Vercel Analytics**
   - [ ] Enable Web Analytics
   - [ ] Enable Speed Insights

2. **Custom Monitoring**
   - [ ] Set up uptime monitoring
   - [ ] Configure alerts for:
     - Error rate > 1%
     - Response time > 3s
     - Failed cron jobs
     - Database connection errors

### 🎯 Final Checks

- [ ] All API keys are production keys (not test/dev)
- [ ] CORS configuration correct for production domain
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] SSL certificate active
- [ ] Domain DNS configured correctly

## 📝 Notes

- Current build has 180 ESLint warnings (non-blocking)
- 273/429 tests passing - review critical test failures
- Consider implementing feature flags for gradual rollout
- Set up blue-green deployment for zero-downtime updates

## 🚀 Ready for Production?

Once all CRITICAL items are checked, the application is ready for production deployment!