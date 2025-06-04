# MedContractHub Development Pipeline

## Overview

This document describes the complete CI/CD pipeline for MedContractHub, including local development, staging, and production deployment workflows.

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Local Dev      │────▶│   GitHub        │────▶│   Vercel        │
│  (feature/*)    │     │   (develop)     │     │   (Staging)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   GitHub        │────▶│   Vercel        │
                        │   (main)        │     │   (Production)  │
                        └─────────────────┘     └─────────────────┘
```

## 🚀 Environments

### Local Development
- **Branch**: `feature/*` branches
- **URL**: http://localhost:3000
- **Database**: Supabase (development project)
- **Tools**: Redis (docker-compose), Bull dashboard

### Staging
- **Branch**: `develop`
- **URL**: https://medcontracthub-staging.vercel.app
- **Database**: Supabase (staging project)
- **Purpose**: Integration testing, QA

### Production
- **Branch**: `main`
- **URL**: https://medcontracthub.com
- **Database**: Supabase (production project)
- **Purpose**: Live environment

## 📋 Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test locally
npm run dev
npm test

# Commit with conventional commits
git add .
git commit -m "feat: Add amazing feature"

# Push to GitHub
git push origin feature/your-feature-name
```

### 2. Pull Request

1. Create PR from feature branch to `develop`
2. CI pipeline runs automatically:
   - ✅ Linting & Type checking
   - ✅ Unit tests
   - ✅ Build verification
   - ✅ Security scanning
   - ✅ Preview deployment
3. Code review required
4. Merge to `develop`

### 3. Staging Deployment

When merged to `develop`:
1. CI pipeline runs full test suite
2. Database migrations execute
3. Deploys to staging environment
4. Creates Sentry release
5. Runs smoke tests

### 4. Production Release

1. Create PR from `develop` to `main`
2. Requires approval from maintainer
3. When merged:
   - Full test suite runs
   - Database migrations execute
   - Deploys to production
   - Creates Sentry release
   - Runs health checks

## 🔧 CI/CD Pipeline Details

### GitHub Actions Workflow

The pipeline (`/.github/workflows/ci.yml`) includes:

#### 1. Code Quality
```yaml
- ESLint for code style
- TypeScript type checking
- Prettier formatting check
```

#### 2. Testing
```yaml
- Jest unit tests with coverage
- Playwright E2E tests (main branch)
- Security vulnerability scanning
```

#### 3. Security Scanning
```yaml
- npm audit for dependencies
- Trivy for container scanning
- Dependency-check for known vulnerabilities
```

#### 4. Database Migrations
```yaml
- Automatic Supabase migrations
- Runs on develop and main branches
- Uses SUPABASE_DB_URL secret
```

#### 5. Deployment
```yaml
- Vercel deployments for all environments
- Preview deployments for PRs
- Staging deployment for develop
- Production deployment for main
```

#### 6. Monitoring
```yaml
- Sentry release creation
- Environment-specific source maps
- Performance monitoring
```

## 🔑 Required Secrets

Configure these in GitHub repository settings:

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_ACCESS_TOKEN`

### APIs
- `SAM_GOV_API_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `MISTRAL_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Deployment
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Monitoring
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## 🛠️ Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/wyattmac/medcontracthub.git
cd medcontracthub
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your values
code .env.local
```

### 3. Start Services

```bash
# Start Redis and Bull dashboard
docker-compose up -d

# Start development server
npm run dev

# In another terminal, start worker
npm run worker
```

### 4. Access Services

- **App**: http://localhost:3000
- **Bull Dashboard**: http://localhost:3001

## 📦 Deployment

### Manual Staging Deployment

```bash
npm run deploy:staging
```

### Manual Production Deployment

```bash
# Requires approval
npm run deploy:production
```

### Rollback

```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-url]
```

## 🔍 Monitoring

### Health Checks
- `/api/health` - Application health
- `/api/health/db` - Database connectivity
- `/api/health/redis` - Redis connectivity

### Logs
```bash
# View staging logs
vercel logs medcontracthub-staging.vercel.app

# View production logs
vercel logs medcontracthub.com
```

### Metrics
- Vercel Analytics for performance
- Sentry for error tracking
- Custom metrics in `/api/analytics`

## 🚨 Troubleshooting

### Build Failures
1. Check TypeScript errors: `npm run type-check`
2. Check lint errors: `npm run lint`
3. Clear cache: `rm -rf .next`

### Deployment Issues
1. Verify environment variables in Vercel
2. Check build logs in GitHub Actions
3. Verify database migrations completed

### Performance Issues
1. Check Redis connection
2. Monitor Bull queue dashboard
3. Review Vercel Analytics

## 🔐 Security

### Branch Protection
- `main` branch requires:
  - PR reviews
  - Status checks passing
  - Up-to-date with base branch

### Deployment Protection
- Production deployments require manual approval
- Staging deployments are automatic
- All deployments create Sentry releases

### Secret Management
- Use GitHub Secrets for CI/CD
- Use Vercel environment variables
- Never commit `.env.local`

## 📈 Best Practices

1. **Conventional Commits**: Use `feat:`, `fix:`, `docs:`, etc.
2. **Small PRs**: Keep changes focused and reviewable
3. **Test Coverage**: Maintain >80% coverage
4. **Documentation**: Update docs with code changes
5. **Security**: Run `npm audit` before commits

## 🔄 Maintenance

### Weekly
- Review and merge Dependabot PRs
- Clean up old preview deployments
- Review error logs in Sentry

### Monthly
- Update dependencies: `npm update`
- Review and optimize CI pipeline
- Audit production database

### Quarterly
- Security audit
- Performance review
- Cost optimization

---

For questions or issues, contact the development team or create an issue in GitHub.