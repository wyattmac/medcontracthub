# AI Proposal Generator Testing and Fix Plan

## Current State Analysis

### Working Components:
1. **Backend API Route** (`/api/proposals/generate`):
   - Fixed import error (changed from `withErrorHandler` to `enhancedRouteHandler`)
   - Properly structured with validation, rate limiting, and authentication
   - Accepts RFP document URL and generates proposal sections using AI

2. **Frontend Components**:
   - `AIProposalGenerator` component exists and is integrated
   - `ProposalDocumentAnalyzer` component for analyzing attachments
   - `CreateProposalForm` includes AI generation features
   - Components are properly wired together

3. **Backend Services**:
   - `RFPDocumentProcessor` - Processes RFP documents using Mistral OCR
   - `ProposalIntelligenceService` - Uses Claude API for proposal generation
   - Both services have proper types and interfaces

### Issues Identified:
- Test script has TypeScript compilation errors due to module resolution
- Docker container showing "unhealthy" status
- Need to test full workflow from UI to backend

## Implementation Plan

### Phase 1: Fix Environment and Dependencies

#### 1.1 Fix Docker Container Health
```bash
# Restart Docker containers with proper environment
docker-compose down
docker-compose up -d --build

# Verify all services are healthy
./docker-logs.sh status
curl http://localhost:3000/api/health | jq .
```

#### 1.2 Fix TypeScript Configuration
- Update test script to use relative imports instead of `@/` aliases
- Ensure all required types are properly imported
- Add proper error handling

### Phase 2: Backend Testing

#### 2.1 Create Test API Endpoint
Create `/api/proposals/test-generate/route.ts` that:
- Bypasses authentication for testing
- Uses mock RFP data
- Tests each component individually

#### 2.2 Update Test Script
Fix `scripts/test-proposal-generation.ts`:
- Use relative imports
- Match actual type interfaces
- Add comprehensive error handling

### Phase 3: Frontend Testing

#### 3.1 Manual UI Testing Flow
1. Navigate to http://localhost:3000/opportunities
2. Find an opportunity and click "Mark for Proposal"
3. Process RFP document (if available)
4. Click "Generate with AI"
5. Select section to generate
6. Verify results display

#### 3.2 Test Error Scenarios
- Test with missing RFP document
- Test with invalid inputs
- Verify error messages display correctly

### Phase 4: Integration Testing

#### 4.1 End-to-End Test
1. Start from opportunity page
2. Complete full proposal generation workflow
3. Save generated content
4. Verify data persistence

#### 4.2 Performance Testing
- Test with large RFP documents
- Monitor API response times
- Verify rate limiting works

## Files to Create/Modify

### 1. Test API Endpoint
`app/api/proposals/test-generate/route.ts`

### 2. Fixed Test Script
`scripts/test-proposal-generation-fixed.ts`

### 3. Package.json Script
Add: `"test:proposal-gen": "tsx scripts/test-proposal-generation-fixed.ts"`

## Testing Commands Sequence

```bash
# 1. Restart Docker
docker-compose down && docker-compose up -d

# 2. Wait for services to be ready (30 seconds)
sleep 30

# 3. Check health
curl http://localhost:3000/api/health | jq .

# 4. Run backend test
npm run test:proposal-gen

# 5. Test via UI (manual)
# Navigate to http://localhost:3000/opportunities

# 6. Check logs for any errors
./docker-logs.sh app | grep -i error
```

## Success Criteria

1. ✅ Docker containers are healthy
2. ✅ Test script runs without TypeScript errors
3. ✅ Backend API generates proposal content
4. ✅ Frontend displays generated content
5. ✅ No errors in console or logs
6. ✅ Generated content is saved properly

## Troubleshooting

### If Docker container is unhealthy:
1. Check environment variables: `docker-compose exec app env | grep SUPABASE`
2. Verify `.env.local` exists and has all required variables
3. Check logs: `./docker-logs.sh app`

### If TypeScript errors persist:
1. Use `npx tsx` instead of `npx ts-node`
2. Check Node.js version: `node --version` (should be 18+)
3. Clear TypeScript cache: `rm -rf node_modules/.cache`

### If AI generation fails:
1. Verify API keys are set: `ANTHROPIC_API_KEY` and `MISTRAL_API_KEY`
2. Check rate limits aren't exceeded
3. Test with smaller RFP documents first

## Next Steps After Testing

1. Document any additional issues found
2. Create unit tests for AI services
3. Add monitoring for AI API usage
4. Implement caching for generated content
5. Add progress indicators for long-running operations