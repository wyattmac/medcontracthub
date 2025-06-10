# Production Testing Guide for AI Proposal Generator

## Overview

This guide outlines the proper testing approach for the AI Proposal Generator feature in MedContractHub. All tests should simulate production behavior with proper authentication and error handling.

## Testing Philosophy

1. **No Authentication Bypasses**: All tests must use proper authentication flows
2. **Production-Like Environment**: Test with the same constraints as production
3. **Complete User Journeys**: Test full workflows, not isolated components
4. **Error Handling**: Verify graceful handling of all error scenarios
5. **Performance**: Monitor response times and resource usage

## Authentication for Testing

### Development Environment Setup

1. **Mock Authentication** (Preferred for local testing):
   ```bash
   # Navigate to login page
   http://localhost:3000/login
   
   # Use any email to create a mock session
   test@medcontracthub.com
   ```

2. **Real Supabase Authentication** (For integration testing):
   - Create a test account in Supabase
   - Use real credentials
   - Complete full onboarding flow

### Environment Variables

Ensure these are set in `.env.local`:
```env
# Development settings
NODE_ENV=development
DEVELOPMENT_AUTH_BYPASS=false  # Should be false for production testing

# Required API Keys
ANTHROPIC_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
```

## Testing the AI Proposal Generator

### 1. Manual UI Testing Flow

#### Prerequisites
- Docker environment running and healthy
- Valid API keys configured
- Test data available (opportunities)

#### Step-by-Step Process

1. **Start the Application**:
   ```bash
   ./easy-docker.sh
   # Select option 1 (Quick Start Development)
   ```

2. **Login**:
   - Navigate to http://localhost:3000
   - Click "Sign In"
   - Use mock login for development
   - Verify redirect to dashboard

3. **Navigate to Opportunities**:
   - Click "Opportunities" in navigation
   - Verify opportunities load
   - Check pagination works

4. **Select an Opportunity**:
   - Click on any opportunity card
   - Verify detail page loads
   - Check all information displays correctly

5. **Start Proposal Process**:
   - Click "Mark for Proposal" button
   - Verify redirect to proposal creation page
   - Check opportunity details pre-populate

6. **Upload RFP Document** (if available):
   - Click "Upload RFP Document"
   - Select a PDF file
   - Wait for OCR processing
   - Verify extracted text displays

7. **Use AI Generator**:
   - Switch to "AI Generator" tab
   - Select section to generate (e.g., "Executive Summary")
   - Add any additional context
   - Click "Generate with AI"
   - Monitor progress indicator
   - Verify content generates successfully

8. **Review Generated Content**:
   - Check word count
   - Review win themes
   - Check compliance score
   - Verify evaluation alignment
   - Review any identified risks

9. **Save Proposal**:
   - Make any edits to generated content
   - Click "Save Proposal"
   - Verify save confirmation
   - Check proposal appears in proposals list

### 2. Automated E2E Testing

Create Playwright test at `__tests__/e2e/proposals/ai-proposal-generation.test.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('AI Proposal Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Login using mock authentication
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@medcontracthub.com')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should generate proposal content using AI', async ({ page }) => {
    // Navigate to opportunities
    await page.goto('/opportunities')
    
    // Select first opportunity
    await page.click('[data-testid="opportunity-card"]:first-child')
    
    // Click Mark for Proposal
    await page.click('button:has-text("Mark for Proposal")')
    
    // Wait for proposal form
    await page.waitForSelector('[data-testid="proposal-form"]')
    
    // Switch to AI Generator tab
    await page.click('button:has-text("AI Generator")')
    
    // Select section and generate
    await page.selectOption('select[name="section"]', 'executive_summary')
    await page.click('button:has-text("Generate with AI")')
    
    // Wait for generation to complete (max 60 seconds)
    await page.waitForSelector('[data-testid="generation-result"]', { 
      timeout: 60000 
    })
    
    // Verify content was generated
    const content = await page.textContent('[data-testid="generated-content"]')
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(100)
    
    // Check metrics
    const wordCount = await page.textContent('[data-testid="word-count"]')
    expect(parseInt(wordCount)).toBeGreaterThan(50)
    
    // Save the proposal
    await page.click('button:has-text("Save Proposal")')
    await page.waitForSelector('[data-testid="save-success"]')
  })
})
```

### 3. API Testing

Create API test at `__tests__/api/proposals/generate.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

describe('Proposal Generation API', () => {
  let authToken: string
  let opportunityId: string

  beforeAll(async () => {
    // Get auth token from Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )
    
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword'
    })
    
    authToken = session?.access_token || ''
    
    // Get a test opportunity
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id')
      .limit(1)
      .single()
    
    opportunityId = opportunities?.id || ''
  })

  it('should generate proposal content with proper authentication', async () => {
    const response = await fetch('http://localhost:3000/api/proposals/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-csrf-token': await getCSRFToken()
      },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        section: 'executive_summary',
        rfp_document_url: 'https://example.com/test-rfp.pdf',
        rfp_document_name: 'Test RFP',
        include_analysis: true,
        auto_save: false
      })
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.content).toBeTruthy()
    expect(data.data.word_count).toBeGreaterThan(0)
  })

  it('should reject requests without authentication', async () => {
    const response = await fetch('http://localhost:3000/api/proposals/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        opportunity_id: opportunityId,
        section: 'executive_summary'
      })
    })

    expect(response.status).toBe(401)
  })
})
```

### 4. Performance Testing

Monitor these metrics during testing:

1. **API Response Times**:
   - Proposal generation: < 30 seconds
   - RFP processing: < 10 seconds
   - Section extraction: < 5 seconds

2. **Resource Usage**:
   - Memory usage should not exceed 512MB
   - CPU usage should stabilize after generation
   - No memory leaks after multiple generations

3. **Rate Limiting**:
   - AI endpoints: 50 requests/hour
   - Verify rate limit headers in responses
   - Test rate limit error handling

### 5. Error Scenarios to Test

1. **Missing RFP Document**:
   - Attempt generation without uploading RFP
   - Should show clear error message

2. **Invalid API Keys**:
   - Test with incorrect Anthropic/Mistral keys
   - Should fail gracefully with helpful error

3. **Large Documents**:
   - Test with RFP > 100 pages
   - Should handle or reject appropriately

4. **Network Failures**:
   - Simulate API timeouts
   - Test retry mechanisms

5. **Concurrent Requests**:
   - Multiple users generating simultaneously
   - Verify no data crossover

## Monitoring and Logging

### What to Monitor

1. **Application Logs**:
   ```bash
   ./docker-logs.sh app | grep -E "proposal|generation|AI"
   ```

2. **Error Tracking**:
   - Check Sentry for any errors
   - Monitor error rates
   - Track error patterns

3. **API Usage**:
   - Track Anthropic API calls
   - Monitor Mistral OCR usage
   - Calculate costs

### Success Metrics

- ✅ All user flows complete without errors
- ✅ Generated content is relevant and high quality
- ✅ Response times meet performance targets
- ✅ Error messages are helpful and actionable
- ✅ No authentication bypasses in code
- ✅ Rate limiting works correctly
- ✅ All data is properly sanitized
- ✅ No sensitive data in logs

## Production Deployment Checklist

Before deploying to production:

1. [ ] Remove all test endpoints
2. [ ] Verify all API keys are production keys
3. [ ] Enable production error tracking
4. [ ] Set up monitoring alerts
5. [ ] Document rate limits for users
6. [ ] Create user documentation
7. [ ] Set up backup for generated proposals
8. [ ] Implement usage analytics
9. [ ] Configure cost alerts for AI APIs
10. [ ] Security review completed

## Troubleshooting Common Issues

### Issue: "Authentication required" error
**Solution**: Ensure you're logged in with a valid session. Check browser developer tools for auth tokens.

### Issue: AI generation times out
**Solution**: 
1. Check API keys are valid
2. Verify network connectivity
3. Try with smaller document/section
4. Check rate limits

### Issue: Generated content is poor quality
**Solution**:
1. Verify RFP document processed correctly
2. Check company profile data is complete
3. Review prompts in AI services
4. Test with different sections

### Issue: Save fails after generation
**Solution**:
1. Check database connection
2. Verify user has permission
3. Check for validation errors
4. Review browser console for errors

## Summary

This testing approach ensures the AI Proposal Generator is production-ready by:
- Using proper authentication throughout
- Testing complete user journeys
- Verifying error handling
- Monitoring performance
- Documenting all requirements

Remember: **No shortcuts in testing = No surprises in production**