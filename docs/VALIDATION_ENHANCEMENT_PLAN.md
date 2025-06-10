# Validation Enhancement Plan

## Overview
This document outlines the plan to enhance the existing Zod validation system in MedContractHub, based on a thorough analysis of the codebase and senior engineering recommendations.

## Documentation Resources
**Important**: Always use Context7 for up-to-date, version-specific documentation when implementing validation patterns. Context7 provides current documentation for Zod and other libraries used in this project.

To check documentation:
- Ask: "Use Context7 to look up Zod validation patterns"
- Ask: "Check Context7 for latest Zod transform methods"
- Ask: "Find Zod v3 refinement examples in Context7"

## Key Principle
**Enhance existing TypeScript/Zod validation rather than introducing Pydantic/Python**, maintaining architectural simplicity and leveraging current team expertise.

## Implementation Timeline

### Week 1: Foundation (Days 1-5)

#### Day 1-2: Audit & Create Shared Schemas
1. **Create Core Validation Module**
   - `/lib/validation/shared-schemas.ts` - Common validation patterns
   - `/lib/validation/business-rules.ts` - Domain-specific validations
   - `/lib/validation/constants.ts` - Regex patterns, error messages

2. **Shared Schemas to Implement**
   ```typescript
   // lib/validation/shared-schemas.ts
   export const emailSchema = z.string().email().toLowerCase().trim()
   export const phoneSchema = z.string().regex(/^\+?1?\d{10,14}$/, "Invalid phone format")
   export const uuidSchema = z.string().uuid("Invalid ID format")
   export const urlSchema = z.string().url("Invalid URL")
   export const dateSchema = z.string().datetime("Invalid date format")
   export const dunsSchema = z.string().regex(/^\d{9}$/, "DUNS must be 9 digits")
   export const cageSchema = z.string().regex(/^[A-Z0-9]{5}$/, "CAGE must be 5 alphanumeric")
   export const einSchema = z.string().regex(/^\d{2}-\d{7}$/, "EIN format: XX-XXXXXXX")
   export const naicsSchema = z.string().regex(/^\d{6}$/, "NAICS must be 6 digits")
   export const zipSchema = z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")
   ```

#### Day 3: Add Missing Validations
1. **Update API Routes**
   - `/api/opportunities/search/route.ts` - Add email/phone validation
   - `/api/proposals/route.ts` - Add date range validation
   - `/api/billing/checkout/route.ts` - Add email validation

2. **Update Form Components**
   - `/app/(auth)/signup/page.tsx` - Add Zod validation
   - `/app/(auth)/onboarding/page.tsx` - Complete form validation
   - `/components/dashboard/proposals/create-proposal-form.tsx` - Date validation

#### Day 4-5: Implement Computed Properties
1. **Create Computed Property System**
   ```typescript
   // lib/validation/computed-properties.ts
   export const opportunityWithComputed = opportunitySchema.transform(data => ({
     ...data,
     isExpiringSoon: () => daysUntilDeadline(data.responseDeadline) <= 7,
     daysRemaining: () => daysUntilDeadline(data.responseDeadline),
     matchesSetAside: (certifications: string[]) => hasSetAsideMatch(data, certifications)
   }))
   ```

2. **Update Entity Classes**
   - Modify `/core/contracts/entities/Opportunity.ts`
   - Add computed fields to database queries
   - Create transform utilities

### Week 2-3: Enhancement (Days 6-15)

#### Day 6-8: Validation Utility Classes
1. **Create Validation Services**
   ```typescript
   // lib/validation/services/opportunity-validator.ts
   export class OpportunityValidator {
     static schema = opportunitySchema
     
     static async validateWithBusinessRules(data: unknown) {
       const validated = this.schema.parse(data)
       
       // Business rules
       if (!isValidNAICS(validated.naicsCodes)) {
         throw new ValidationError("Invalid NAICS codes")
       }
       
       return validated
     }
   }
   ```

2. **Implement for Each Domain**
   - `/lib/validation/services/company-validator.ts`
   - `/lib/validation/services/proposal-validator.ts`
   - `/lib/validation/services/billing-validator.ts`

#### Day 9-11: OpenAPI Generation
1. **Setup OpenAPI Tools**
   ```bash
   npm install @anatine/zod-openapi zod-to-json-schema
   ```

2. **Create OpenAPI Generator**
   ```typescript
   // lib/api/openapi-generator.ts
   export function generateOpenAPISpec() {
     return {
       openapi: '3.0.0',
       paths: generatePathsFromRoutes(),
       components: { schemas: generateSchemasFromZod() }
     }
   }
   ```

3. **Add Documentation Route**
   - `/app/api/docs/route.ts` - Serve OpenAPI spec
   - `/app/api/docs/ui/page.tsx` - Swagger UI

#### Day 12-15: Error Message Enhancement
1. **Create Error Message System**
   ```typescript
   // lib/validation/error-messages.ts
   export const errorMessages = {
     required: (field: string) => `${field} is required`,
     invalid: (field: string) => `${field} is invalid`,
     tooShort: (field: string, min: number) => `${field} must be at least ${min} characters`,
     // ... more messages
   }
   ```

2. **Custom Error Formatter**
   ```typescript
   // lib/validation/error-formatter.ts
   export function formatZodError(error: ZodError): UserFriendlyError {
     return {
       message: "Validation failed",
       fields: error.errors.reduce((acc, err) => ({
         ...acc,
         [err.path.join('.')]: getFieldError(err)
       }), {})
     }
   }
   ```

### Month 2+: Long-term Improvements

#### Phase 1: Advanced Validation Features
1. **Conditional Validation**
   ```typescript
   const proposalSchema = z.object({
     type: z.enum(['federal', 'state']),
     federalContractNumber: z.string().optional()
   }).refine(data => {
     if (data.type === 'federal' && !data.federalContractNumber) {
       return false
     }
     return true
   }, "Federal proposals require contract number")
   ```

2. **Cross-Field Validation**
   - Date range validation
   - Budget min/max validation
   - Dependent field validation

#### Phase 2: Python Integration (If Needed)
1. **Identify Python Use Cases**
   - Advanced NLP for proposal analysis
   - Machine learning for opportunity matching
   - Complex document processing

2. **Create Minimal Python Service**
   ```python
   # services/ml-processor/main.py
   from fastapi import FastAPI
   from pydantic import BaseModel
   
   class DocumentAnalysis(BaseModel):
       opportunity_id: str
       document_text: str
       
   @app.post("/analyze")
   async def analyze_document(analysis: DocumentAnalysis):
       # ML processing here
       return {"score": 0.95}
   ```

#### Phase 3: Type-Safe API with tRPC
1. **Evaluate tRPC Benefits**
   - End-to-end type safety
   - Automatic client generation
   - Better than REST for internal APIs

2. **Migration Strategy**
   - Start with internal APIs
   - Gradually migrate endpoints
   - Keep REST for public APIs

## Validation Gaps Identified

### Missing Validations
1. **Email Validation**
   - Onboarding Form
   - Login/Signup Forms
   - Company Profile Forms

2. **Phone Validation**
   - Onboarding Form
   - Company Profile
   - Contact Forms

3. **Date Validation**
   - Proposal Forms
   - Opportunity Filters
   - SAM Registration Dates

4. **URL Validation**
   - Company Website
   - Opportunity URLs

### Inconsistencies to Fix
1. **Pagination Patterns** - Standardize on string-to-number transforms
2. **UUID Validation** - Always use `.uuid()` validation
3. **Datetime Handling** - Standardize on ISO 8601 with `.datetime()`
4. **Status Enums** - Create shared enum types

## Success Metrics

### Week 1 Deliverables
- ✅ All forms have Zod validation
- ✅ Shared validation schemas in use
- ✅ Computed properties implemented

### Week 2-3 Deliverables
- ✅ Validation service classes created
- ✅ OpenAPI documentation available
- ✅ User-friendly error messages

### Long-term Goals
- ✅ 100% validation coverage
- ✅ Python used only where necessary
- ✅ Type-safe API if beneficial

## Implementation Checklist

### Week 1 Tasks
- [ ] Create /lib/validation directory structure
- [ ] Implement shared-schemas.ts
- [ ] Update all API routes with consistent validation
- [ ] Add Zod to all form components
- [ ] Implement computed properties pattern
- [ ] Test all validation changes

### Week 2-3 Tasks
- [ ] Create validation service classes
- [ ] Setup OpenAPI generation
- [ ] Create API documentation UI
- [ ] Implement error message system
- [ ] Add validation tests
- [ ] Update developer documentation

### Month 2+ Tasks
- [ ] Evaluate Python ML needs
- [ ] Consider tRPC migration
- [ ] Implement advanced validations
- [ ] Performance optimization
- [ ] Monitoring and metrics

## Key Benefits
1. **Type Safety**: Runtime validation matching TypeScript types
2. **Consistency**: Shared schemas across the application
3. **Developer Experience**: Better error messages and documentation
4. **Maintainability**: Single validation system in TypeScript
5. **Performance**: No network overhead from separate validation service