import { z } from 'zod'
import { 
  opportunityBusinessSchema,
  calculateResponseDaysRemaining,
  isOpportunityExpiringSoon,
  hasSetAsideMatch
} from './business-rules'
import { proposalBusinessSchema } from './business-rules'

// Opportunity with computed properties
export const opportunityWithComputedSchema = opportunityBusinessSchema.transform((data) => {
  const daysRemaining = calculateResponseDaysRemaining(data.responseDeadline)
  
  return {
    ...data,
    // Computed properties as methods
    isExpiringSoon: () => isOpportunityExpiringSoon(data.responseDeadline),
    daysRemaining: () => daysRemaining,
    isExpired: () => daysRemaining < 0,
    matchesSetAside: (certifications: string[]) => hasSetAsideMatch(data.setAsideTypes, certifications),
    getUrgencyLevel: () => {
      if (daysRemaining < 0) return 'expired'
      if (daysRemaining <= 3) return 'critical'
      if (daysRemaining <= 7) return 'high'
      if (daysRemaining <= 14) return 'medium'
      return 'low'
    },
    // Computed display values
    formattedValue: () => {
      if (!data.valueAmount) return 'Not specified'
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
      })
      return `${formatter.format(data.valueAmount.min)} - ${formatter.format(data.valueAmount.max)}`
    },
    formattedDeadline: () => {
      const deadline = new Date(data.responseDeadline)
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York'
      })
      return formatter.format(deadline)
    },
    // Computed properties as static values
    _computed: {
      daysRemaining,
      isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 7,
      isExpired: daysRemaining < 0,
      urgencyLevel: (() => {
        if (daysRemaining < 0) return 'expired'
        if (daysRemaining <= 3) return 'critical'
        if (daysRemaining <= 7) return 'high'
        if (daysRemaining <= 14) return 'medium'
        return 'low'
      })()
    }
  }
})

// Proposal with computed properties
export const proposalWithComputedSchema = proposalBusinessSchema.transform((data) => {
  const requiredSections = data.sections.filter(s => s.required)
  const completedRequiredSections = requiredSections.filter(s => s.content && s.content.trim().length > 0)
  const totalWordCount = data.sections.reduce((sum, s) => sum + (s.wordCount || 0), 0)
  
  return {
    ...data,
    // Computed properties as methods
    getCompletionPercentage: () => {
      if (requiredSections.length === 0) return 100
      return Math.round((completedRequiredSections.length / requiredSections.length) * 100)
    },
    isComplete: () => completedRequiredSections.length === requiredSections.length,
    getTotalWordCount: () => totalWordCount,
    canSubmit: () => {
      return data.status === 'draft' && 
             completedRequiredSections.length === requiredSections.length
    },
    getDaysUntilDue: () => {
      const dueDate = new Date(data.dueDate)
      const now = new Date()
      const diffTime = dueDate.getTime() - now.getTime()
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    },
    // Computed properties as static values
    _computed: {
      completionPercentage: requiredSections.length === 0 
        ? 100 
        : Math.round((completedRequiredSections.length / requiredSections.length) * 100),
      totalWordCount,
      requiredSectionsCount: requiredSections.length,
      completedSectionsCount: completedRequiredSections.length,
      isComplete: completedRequiredSections.length === requiredSections.length
    }
  }
})

// Company with computed properties
export const companyWithComputedSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  naicsCodes: z.array(z.string()),
  certifications: z.array(z.string()),
  samRegistrationDate: z.string().datetime().optional(),
  samExpirationDate: z.string().datetime().optional(),
  subscriptionPlan: z.enum(['starter', 'pro', 'enterprise']),
  subscriptionStatus: z.string()
}).transform((data) => {
  const samExpiration = data.samExpirationDate ? new Date(data.samExpirationDate) : null
  const now = new Date()
  
  return {
    ...data,
    // Computed properties as methods
    isSamRegistrationActive: () => {
      if (!samExpiration) return false
      return samExpiration > now
    },
    getDaysSamRegistrationRemaining: () => {
      if (!samExpiration) return null
      const diffTime = samExpiration.getTime() - now.getTime()
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    },
    isSamExpiringSoon: () => {
      if (!samExpiration) return false
      const daysRemaining = Math.ceil((samExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysRemaining >= 0 && daysRemaining <= 30
    },
    getEligibleSetAsides: () => {
      const setAsides: string[] = ['Total Small Business'] // Default for all small businesses
      
      if (data.certifications.includes('WOSB')) {
        setAsides.push('Women-Owned Small Business (WOSB)')
      }
      if (data.certifications.includes('EDWOSB')) {
        setAsides.push('Economically Disadvantaged WOSB (EDWOSB)')
      }
      if (data.certifications.includes('HUBZone')) {
        setAsides.push('HUBZone Small Business')
      }
      if (data.certifications.includes('SDVOSB')) {
        setAsides.push('Service-Disabled Veteran-Owned Small Business (SDVOSB)')
      }
      if (data.certifications.includes('VOSB')) {
        setAsides.push('Veteran-Owned Small Business (VOSB)')
      }
      if (data.certifications.includes('8(a)')) {
        setAsides.push('8(a) Business Development')
      }
      if (data.certifications.includes('Native American')) {
        setAsides.push('Native American Owned')
      }
      
      return setAsides
    },
    hasActiveSubscription: () => {
      return data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing'
    },
    // Computed properties as static values
    _computed: {
      isSamActive: samExpiration ? samExpiration > now : false,
      samDaysRemaining: samExpiration 
        ? Math.ceil((samExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      eligibleSetAsidesCount: (() => {
        let count = 1 // Total Small Business
        const certMap = ['WOSB', 'EDWOSB', 'HUBZone', 'SDVOSB', 'VOSB', '8(a)', 'Native American']
        certMap.forEach(cert => {
          if (data.certifications.includes(cert)) count++
        })
        return count
      })()
    }
  }
})

// Helper function to create computed properties from database records
export function addComputedProperties<T extends Record<string, any>>(
  record: T,
  computedFns: Record<string, (data: T) => any>
): T & { _computed: Record<string, any> } {
  const computed: Record<string, any> = {}
  
  for (const [key, fn] of Object.entries(computedFns)) {
    computed[key] = fn(record)
  }
  
  return {
    ...record,
    _computed: computed
  }
}

// Type helpers for computed schemas
export type OpportunityWithComputed = z.infer<typeof opportunityWithComputedSchema>
export type ProposalWithComputed = z.infer<typeof proposalWithComputedSchema>
export type CompanyWithComputed = z.infer<typeof companyWithComputedSchema>