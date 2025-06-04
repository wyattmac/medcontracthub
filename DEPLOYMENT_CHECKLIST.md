# Production Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] TypeScript compilation successful (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code reviewed and approved
- [ ] No console.log statements in production code

### Database
- [ ] Database migrations tested in staging
- [ ] Backup production database
- [ ] Migration rollback plan documented

### Environment Variables
- [ ] All required env vars set in Vercel
- [ ] Stripe webhook endpoint configured
- [ ] API keys are production keys (not test)

### Testing
- [ ] Tested in staging environment
- [ ] Critical user flows tested manually:
  - [ ] Sign up and login
  - [ ] Search opportunities
  - [ ] AI analysis
  - [ ] Export functionality
  - [ ] Billing/subscription flow
- [ ] Load testing completed (if major changes)

### Security
- [ ] Security headers configured
- [ ] Rate limiting tested
- [ ] No exposed secrets in code

## Deployment Steps

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Monitor deployment**
   - Watch GitHub Actions: https://github.com/YOUR_REPO/actions
   - Check Vercel dashboard: https://vercel.com/dashboard

3. **Verify deployment**
   - [ ] Check health endpoint: https://medcontracthub.com/api/health
   - [ ] Test critical features
   - [ ] Monitor error rates in logs

## Post-Deployment

### Immediate (0-15 minutes)
- [ ] Verify health check passing
- [ ] Test login functionality
- [ ] Check error monitoring (Sentry/logs)
- [ ] Verify Stripe webhooks receiving

### Short-term (15-60 minutes)
- [ ] Monitor performance metrics
- [ ] Check for increased error rates
- [ ] Verify background jobs running
- [ ] Test email notifications

### If Issues Arise

1. **Quick Rollback**
   ```bash
   # Revert in Vercel dashboard or:
   vercel rollback
   ```

2. **Database Rollback**
   ```sql
   -- Run rollback migration if needed
   ```

3. **Communication**
   - [ ] Update status page
   - [ ] Notify team in Slack
   - [ ] Create incident report

## Rollback Plan

1. **Instant Rollback** (< 2 minutes)
   - Use Vercel's instant rollback feature
   - Previous deployment remains cached

2. **Code Rollback** (5-10 minutes)
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Database Rollback** (if needed)
   - Run rollback migrations
   - Restore from backup if critical

## Contact Information

- **On-call Developer**: [Your Name] - [Phone]
- **DevOps Support**: [Contact]
- **Stripe Support**: https://support.stripe.com
- **Vercel Support**: https://vercel.com/support

## Notes

- Deployments happen automatically on merge to main
- Staging deploys on merge to develop
- Keep this checklist updated with lessons learned