# MedContractHub Quick Start Guide

## 🚀 For New Developers

### 1. Initial Setup (5 minutes)
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/medcontracthub.git
cd medcontracthub

# Run setup script
npm run setup

# Configure environment
# Edit .env.local with your API keys
```

### 2. Daily Development Workflow

#### Starting Your Day
```bash
# Get latest changes
git checkout develop
git pull origin develop

# Start development server
npm run dev

# In another terminal, start Claude Code
claude
```

#### Working on a Feature
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Use Claude to help
claude "Help me implement [feature description]"

# Run tests frequently
npm test

# Commit with conventional commits
git add .
git commit  # Will use template
```

#### Before Pushing
```bash
# Run all checks
npm run lint
npm run type-check
npm test

# Push to GitHub
git push origin feature/your-feature-name
```

### 3. Common Claude Commands

```bash
# Generate a new component
claude "Create a new dashboard widget for [description] following our patterns"

# Fix a bug
claude "Debug why [issue description]. Check [relevant files]"

# Write tests
claude "Write comprehensive tests for [component/function]"

# Refactor code
claude "Refactor [file/component] to improve [performance/readability]"

# Document code
claude "Add JSDoc comments to all functions in [file]"
```

### 4. Deployment Process

#### To Staging (Automatic)
1. Merge PR to `develop` branch
2. GitHub Actions automatically deploys to staging
3. Check: https://staging.medcontracthub.com

#### To Production (Automatic)
1. Merge `develop` to `main` branch
2. GitHub Actions automatically deploys to production
3. Check: https://medcontracthub.com

### 5. Environment URLs

- **Local**: http://localhost:3000
- **Staging**: https://staging.medcontracthub.com
- **Production**: https://medcontracthub.com

### 6. Key Scripts

```bash
npm run dev              # Start development server
npm test                 # Run tests
npm run lint            # Check code style
npm run type-check      # Check TypeScript
npm run build           # Build for production
npm run setup           # Initial setup
npm run deploy:staging  # Deploy to staging
```

### 7. Troubleshooting

#### Tests Failing?
```bash
# Run specific test
npm test -- path/to/test.test.ts

# Debug with Claude
claude "Help me fix the failing test in [file]"
```

#### Build Errors?
```bash
# Check TypeScript errors
npm run type-check

# Clear cache and rebuild
rm -rf .next
npm run build
```

#### Environment Issues?
```bash
# Verify all env vars are set
grep -v '^#' .env.example | cut -d= -f1 | while read var; do
  grep -q "^$var=" .env.local || echo "Missing: $var"
done
```

### 8. Best Practices

1. **Always work on a feature branch**
2. **Run tests before pushing**
3. **Use conventional commits**
4. **Keep PRs small and focused**
5. **Update tests when changing code**
6. **Ask Claude for help when stuck**

### 9. Getting Help

- Read `CLAUDE.md` for project conventions
- Check `README.md` for detailed documentation
- Use Claude: `claude "Explain how [feature] works"`
- Create an issue on GitHub for bugs

### 10. Your First Task

Try this to get familiar:
```bash
# Create a simple feature
git checkout -b feature/add-footer-link

# Use Claude
claude "Add a 'Privacy Policy' link to the dashboard footer"

# Test your change
npm test

# Commit
git add .
git commit -m "feat: add privacy policy link to footer"

# Push and create PR
git push origin feature/add-footer-link
```

Welcome to the team! 🎉