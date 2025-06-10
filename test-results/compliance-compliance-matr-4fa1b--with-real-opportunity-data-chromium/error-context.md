# Test info

- Name: Compliance Matrix - Real Data Test >> should test compliance matrix with real opportunity data
- Location: /home/locklearwyatt/projects/medcontracthub/__tests__/e2e/compliance/compliance-matrix-real-data.test.ts:9:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="opportunity-card"], .opportunity-card, table tbody tr') to be visible

    at /home/locklearwyatt/projects/medcontracthub/__tests__/e2e/compliance/compliance-matrix-real-data.test.ts:44:18
    at /home/locklearwyatt/projects/medcontracthub/__tests__/e2e/compliance/compliance-matrix-real-data.test.ts:39:5
```

# Page snapshot

```yaml
- link "MedContractHub":
  - /url: /dashboard
- navigation:
  - link "Dashboard":
    - /url: /dashboard
  - link "Opportunities":
    - /url: /opportunities
  - link "Saved":
    - /url: /saved
  - link "Proposals":
    - /url: /proposals
  - link "Analytics":
    - /url: /analytics
  - link "Settings":
    - /url: /settings
- paragraph: Developer Mode
- paragraph: Authenticated User
- banner:
  - link "Home":
    - /url: /dashboard
  - text: Opportunities
  - button "Quick Actions"
- main:
  - heading "Search & Filters" [level=3]
  - button
  - paragraph: Refine your opportunity search with advanced filters
  - text: Search
  - textbox "Search"
  - button "Search"
  - text: Medical Industry (NAICS)
  - combobox: All Medical Industries
  - text: State
  - combobox: All States
  - text: Status
  - combobox: Active
  - text: Set-Aside Type
  - combobox: All Opportunities
  - text: Response Deadline From
  - textbox "Response Deadline From"
  - text: Response Deadline To
  - textbox "Response Deadline To"
  - text: Quick Medical Filters
  - button "Medical Equipment"
  - button "Pharmaceuticals"
  - button "Hospital Services"
  - button "Closing in 30 Days"
  - button "Small Business Set-Asides"
  - heading "🔍 Federal Contract Opportunities" [level=1]
  - paragraph:
    - text: Live federal medical supply contracts from
    - strong: SAM.gov
    - text: tailored to your capabilities. Real-time data powered by AI matching for optimal results.
  - text: SAM.gov API Active 24K+ Opportunities AI-Powered Matching
  - heading "Active Opportunities" [level=3]
  - text: 1,247 +84 new this week
  - heading "Expiring This Week" [level=3]
  - text: "23"
  - paragraph: Response deadlines ending
  - heading "Total Contract Value" [level=3]
  - text: $2.4B
  - paragraph: "Avg: $1.9M per contract"
  - heading "Match Quality" [level=3]
  - text: "High 156 Medium 342 Low 749 API Quota: 756 remaining 23,350 opportunities foundVirtual scrolling enabled"
  - button "Export (23350)"
  - button
  - button "Switch to standard list"
  - button "Refresh"
  - text: 40% Match Fair Match
  - link "Probes":
    - /url: /opportunities/e54b2586-a168-4987-bc91-4475f72aeef1
    - heading "Probes" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e54b2586a1684987bc914475f72aeef1
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e54b2586a1684987bc914475f72aeef1
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.DEPT OF THE NAVY.NAVSEA.NAVSEA WARFARE CENTER.NSWC DAHLGREN
  - paragraph: Location
  - paragraph: Dahlgren, VA
  - paragraph: Deadline
  - paragraph: Jun 16, 2025, 12:00 PM
  - text: 7d NAICS 334515 N0017825Q6773 Active 40% Match Fair Match
  - link "28--CAMSHAFT,ENGINE":
    - /url: /opportunities/e54c848e-1353-415f-9e75-85a83a6201db
    - heading "28--CAMSHAFT,ENGINE" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e54c848e1353415f9e7585a83a6201db
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e54c848e1353415f9e7585a83a6201db
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.DEFENSE LOGISTICS AGENCY.DLA LAND.DLA LAND COLUMBUS.DLA LAND AND MARITIME
  - paragraph: Deadline
  - paragraph: Jun 23, 2025, 8:00 PM
  - text: 15d NAICS 333618 SPE7L525T2748 Active 10% Match Low Match
  - link "PROJECT LABOR AGREEMENT (PLA) REQUEST FOR DESIGN-BUILD (DB) T-TA DEPOT MAINTENANCE COMPLEX (DMC), HILL AIR FORCE BASE (HAFB), UTAH (UT)":
    - /url: /opportunities/e5e5c370-ec14-4d64-968b-96608cfc8846
    - heading "PROJECT LABOR AGREEMENT (PLA) REQUEST FOR DESIGN-BUILD (DB) T-TA DEPOT MAINTENANCE COMPLEX (DMC), HILL AIR FORCE BASE (HAFB), UTAH (UT)" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e5e5c370ec144d64968b96608cfc8846
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e5e5c370ec144d64968b96608cfc8846
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.DEPT OF THE ARMY.US ARMY CORPS OF ENGINEERS.ENGINEER DIVISION SOUTH PACIFIC.W075 ENDIST SACRAMENTO
  - paragraph: Location
  - paragraph: Hill Air Force Base, UT
  - paragraph: Deadline
  - paragraph: Jun 9, 2025, 4:00 PM
  - text: 1d NAICS 236210 e5e5c370ec144d64968b96608cfc8846 Active 30% Match Low Match
  - link "Anniston Hazardous Waste Removal":
    - /url: /opportunities/e5fea319-3077-458c-b86e-2edc85b6d9f3
    - heading "Anniston Hazardous Waste Removal" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e5fea3193077458cb86e2edc85b6d9f3
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e5fea3193077458cb86e2edc85b6d9f3
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.DEFENSE LOGISTICS AGENCY.DLA DISPOSITION SERVICES.DLA DISPOSTION SERVICE - EBS
  - paragraph: Location
  - paragraph: Anniston, AL
  - paragraph: Deadline
  - paragraph: Jul 3, 2025, 5:00 PM
  - text: 25d NAICS 562211 SBA SP450025R0008 Active 10% Match Low Match
  - link "IESS Solicitation (RFP)":
    - /url: /opportunities/e69a5e01-bedb-4ad6-91bb-57aaba51899d
    - heading "IESS Solicitation (RFP)" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e69a5e01bedb4ad691bb57aaba51899d
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e69a5e01bedb4ad691bb57aaba51899d
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.US SPECIAL OPERATIONS COMMAND (USSOCOM).NAVAL SPECIAL WARFARE COMMAND
  - paragraph: Deadline
  - paragraph: Jul 9, 2025, 12:00 PM
  - text: 30d NAICS 561621 SBA H9224025RE002 Active 10% Match Low Match
  - link "Post Mortem Human Subjects (PMHS) Services":
    - /url: /opportunities/e6b9207c-949e-456f-8683-83bfb54e35a0
    - heading "Post Mortem Human Subjects (PMHS) Services" [level=3]
  - paragraph: https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=e6b9207c949e456f868383bfb54e35a0
  - button
  - link "View on SAM.gov":
    - /url: https://sam.gov/opp/e6b9207c949e456f868383bfb54e35a0
  - paragraph: Agency
  - paragraph: DEPT OF DEFENSE.DEFENSE HEALTH AGENCY (DHA).ARMY MED RES ACQ ACTIVITY
  - paragraph: Location
  - paragraph: Cahaba Hts, AL
  - paragraph: Deadline
  - paragraph: Jun 13, 2025, 1:00 PM
  - text: 4d NAICS 541990 HT942525R0048 Active Showing 1 to 25 of 23,350 opportunities
  - button "Previous" [disabled]
  - button "1"
  - button "2"
  - button "3"
  - text: ...
  - button "934"
  - button "Next"
  - heading "✅ SAM.gov Integration Active" [level=3]
  - paragraph: Successfully connected to SAM.gov API. Displaying live federal contract opportunities with real-time updates and AI-powered matching based on your NAICS codes.
  - text: Auto-sync enabled Real-time matching
- button "Open Tanstack query devtools":
  - img
- region "Notifications alt+T"
- alert: MedContractHub - Win More Federal Medical Supply Contracts
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test'
   2 |
   3 | const TEST_USER = {
   4 |   email: 'test@medcontracthub.com',
   5 |   password: 'Test123!@#'
   6 | }
   7 |
   8 | test.describe('Compliance Matrix - Real Data Test', () => {
   9 |   test('should test compliance matrix with real opportunity data', async ({ page }) => {
   10 |     // Step 1: Login with mock development account
   11 |     await test.step('Login to application', async () => {
   12 |       await page.goto('http://localhost:3002/login')
   13 |       
   14 |       // Use the mock development login
   15 |       const mockEmailInput = page.locator('input[type="email"][value*="@medcontracthub.com"]')
   16 |       if (await mockEmailInput.count() > 0) {
   17 |         console.log('Using mock development login')
   18 |         
   19 |         // Click Enter Development Mode button
   20 |         await page.click('button:has-text("Enter Development Mode")')
   21 |       } else {
   22 |         // Fallback to regular login fields if not in mock mode
   23 |         await page.fill('input[name="email"]', TEST_USER.email)
   24 |         await page.fill('input[name="password"]', TEST_USER.password)
   25 |         await page.click('button[type="submit"]')
   26 |       }
   27 |       
   28 |       // Wait for dashboard
   29 |       await page.waitForURL('**/dashboard', { timeout: 10000 })
   30 |       console.log('✅ Successfully logged in')
   31 |       
   32 |       await page.screenshot({ 
   33 |         path: 'test-results/compliance-real-01-dashboard.png',
   34 |         fullPage: true 
   35 |       })
   36 |     })
   37 |
   38 |     // Step 2: Navigate to opportunities and find one with attachments
   39 |     await test.step('Find opportunity with attachments', async () => {
   40 |       await page.goto('http://localhost:3002/opportunities')
   41 |       await page.waitForLoadState('networkidle')
   42 |       
   43 |       // Wait for opportunities to load
>  44 |       await page.waitForSelector('[data-testid="opportunity-card"], .opportunity-card, table tbody tr', {
      |                  ^ TimeoutError: page.waitForSelector: Timeout 30000ms exceeded.
   45 |         timeout: 30000
   46 |       })
   47 |       
   48 |       // Get all opportunities
   49 |       const opportunities = await page.locator('[data-testid="opportunity-card"], .opportunity-card, table tbody tr').all()
   50 |       console.log(`Found ${opportunities.length} opportunities`)
   51 |       
   52 |       // Look for opportunities with attachments by checking each one
   53 |       let foundOpportunityWithAttachments = false
   54 |       let opportunityIndex = 0
   55 |       
   56 |       for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
   57 |         console.log(`Checking opportunity ${i + 1}...`)
   58 |         
   59 |         // Click on the opportunity
   60 |         await opportunities[i].click()
   61 |         await page.waitForLoadState('networkidle')
   62 |         await page.waitForTimeout(2000)
   63 |         
   64 |         // Check if attachments section exists
   65 |         const hasAttachments = await page.locator('[data-testid="attachments-section"], [data-testid="opportunity-attachments"], :has-text("Attachments"), :has-text("Documents")').count() > 0
   66 |         const attachmentCount = await page.locator('[data-testid="attachment-item"], a[href*=".pdf"], a[href*=".doc"]').count()
   67 |         
   68 |         console.log(`Opportunity ${i + 1}: Has attachments section: ${hasAttachments}, Attachment count: ${attachmentCount}`)
   69 |         
   70 |         if (hasAttachments && attachmentCount > 0) {
   71 |           foundOpportunityWithAttachments = true
   72 |           opportunityIndex = i
   73 |           console.log(`✅ Found opportunity with ${attachmentCount} attachments`)
   74 |           
   75 |           // Get opportunity details
   76 |           const title = await page.locator('h1').textContent()
   77 |           const noticeId = await page.locator('text=/Notice ID|notice_id/i').locator('..').locator('p, span').last().textContent()
   78 |           console.log(`Opportunity: ${title}`)
   79 |           console.log(`Notice ID: ${noticeId}`)
   80 |           
   81 |           await page.screenshot({ 
   82 |             path: 'test-results/compliance-real-02-opportunity-detail.png',
   83 |             fullPage: true 
   84 |           })
   85 |           break
   86 |         } else {
   87 |           // Go back to opportunities list
   88 |           await page.goBack()
   89 |           await page.waitForLoadState('networkidle')
   90 |         }
   91 |       }
   92 |       
   93 |       if (!foundOpportunityWithAttachments) {
   94 |         console.log('⚠️  No opportunities with attachments found in the first 5 opportunities')
   95 |         // Still proceed with the first opportunity
   96 |         await opportunities[0].click()
   97 |         await page.waitForLoadState('networkidle')
   98 |       }
   99 |     })
  100 |
  101 |     // Step 3: Click Generate Compliance Matrix
  102 |     await test.step('Open compliance matrix generator', async () => {
  103 |       // Look for the compliance matrix button
  104 |       const complianceButton = page.locator('button:has-text("Generate Compliance Matrix"), [data-testid="generate-compliance-matrix"]')
  105 |       
  106 |       if (await complianceButton.count() > 0) {
  107 |         console.log('Found compliance matrix button')
  108 |         await complianceButton.click()
  109 |         
  110 |         // Wait for navigation to compliance page
  111 |         await page.waitForURL('**/compliance', { timeout: 10000 })
  112 |         console.log('✅ Navigated to compliance page')
  113 |         
  114 |         await page.screenshot({ 
  115 |           path: 'test-results/compliance-real-03-compliance-page.png',
  116 |           fullPage: true 
  117 |         })
  118 |       } else {
  119 |         throw new Error('Compliance matrix button not found')
  120 |       }
  121 |     })
  122 |
  123 |     // Step 4: Test manual matrix creation
  124 |     await test.step('Create manual compliance matrix', async () => {
  125 |       const createManualButton = page.locator('button:has-text("Create Manually")')
  126 |       
  127 |       if (await createManualButton.count() > 0) {
  128 |         console.log('Creating manual compliance matrix...')
  129 |         await createManualButton.click()
  130 |         
  131 |         // Wait for matrix to be created
  132 |         await page.waitForTimeout(3000)
  133 |         
  134 |         // Check if requirements section appeared
  135 |         const requirementsSection = await page.locator('[data-testid="requirements-list"], :has-text("Requirements")').count()
  136 |         
  137 |         if (requirementsSection > 0) {
  138 |           console.log('✅ Manual compliance matrix created successfully')
  139 |           
  140 |           await page.screenshot({ 
  141 |             path: 'test-results/compliance-real-04-manual-matrix.png',
  142 |             fullPage: true 
  143 |           })
  144 |         }
```