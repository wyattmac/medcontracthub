/**
 * SAM.gov API Integration
 * Exports all SAM.gov related types, client, and hooks
 */

// Types
export type {
  ISAMOpportunity,
  ISAMAward,
  ISAMAwardee,
  ISAMLocation,
  ISAMCity,
  ISAMState,
  ISAMCountry,
  ISAMJustificationAuthority,
  ISAMPointOfContact,
  ISAMOfficeAddress,
  ISAMPlaceOfPerformance,
  ISAMLink,
  ISAMPermission,
  ISAMOpportunitiesResponse,
  ISAMOpportunitiesParams,
  ISAMErrorResponse,
  ISAMApiConfig,
  IOpportunityFilters,
  IOpportunitySearchResult
} from './types'

// Client
export {
  SAMApiClient,
  SAMApiError,
  createSAMApiClient,
  getSAMApiClient
} from './client'

// Default client instance alias
export const samApiClient = getSAMApiClient

// Hooks
export {
  useOpportunities,
  useOpportunityDetail,
  useOpportunitiesByNAICS,
  useSAMHealthCheck,
  useRefreshOpportunities,
  usePrefetchOpportunityDetail,
  useCachedOpportunities,
  usePrefetchOpportunities,
  samQueryKeys
} from './hooks'