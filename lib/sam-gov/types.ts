/**
 * SAM.gov API Types
 * Based on: https://open.gsa.gov/api/get-opportunities-public-api/
 */

export interface ISAMOpportunity {
  noticeId: string
  title: string
  solicitationNumber: string
  fullParentPathName: string
  fullParentPathCode: string
  postedDate: string
  type: string
  baseType: string
  archiveType: string
  archiveDate?: string
  typeOfSetAsideDescription: string
  typeOfSetAside: string
  responseDeadLine: string
  naicsCode: string
  classificationCode: string
  active: string
  award?: ISAMAward
  pointOfContact?: ISAMPointOfContact[]
  description: string
  organizationType: string
  officeAddress?: ISAMOfficeAddress
  placeOfPerformance?: ISAMPlaceOfPerformance
  additionalInfoLink?: string
  uiLink: string
  links: ISAMLink[]
  resourceLinks?: string[]
  permissions?: ISAMPermission[]
}

export interface ISAMAward {
  date: string
  number: string
  amount: string
  awardee: ISAMAwardee
  justificationAuthority?: ISAMJustificationAuthority
}

export interface ISAMAwardee {
  name: string
  location: ISAMLocation
  ueiSAM: string
  cageCode?: string
}

export interface ISAMLocation {
  streetAddress: string
  streetAddress2?: string
  city: ISAMCity
  state: ISAMState
  zip: string
  country: ISAMCountry
}

export interface ISAMCity {
  code: string
  name: string
}

export interface ISAMState {
  code: string
  name: string
}

export interface ISAMCountry {
  code: string
  name: string
}

export interface ISAMJustificationAuthority {
  modificationNumber?: string
  authority: string
}

export interface ISAMPointOfContact {
  fax?: string
  type: string
  email?: string
  phone?: string
  title?: string
  fullName: string
}

export interface ISAMOfficeAddress {
  zipcode: string
  city: ISAMCity
  countryCode: string
  state: ISAMState
}

export interface ISAMPlaceOfPerformance {
  city?: ISAMCity
  country: ISAMCountry
  state?: ISAMState
  streetAddress?: string
  streetAddress2?: string
  zip?: string
}

export interface ISAMLink {
  rel: string
  href: string
}

export interface ISAMPermission {
  name: string
  roles: string[]
}

// API Response Types
export interface ISAMOpportunitiesResponse {
  totalRecords: number
  limit: number
  offset: number
  opportunitiesData: ISAMOpportunity[]
  links: ISAMLink[]
}

// API Request Parameters
export interface ISAMOpportunitiesParams {
  limit?: number
  offset?: number
  postedFrom?: string
  postedTo?: string
  modifiedFrom?: string
  modifiedTo?: string
  responseDeadLineFrom?: string
  responseDeadLineTo?: string
  archiveFrom?: string
  archiveTo?: string
  typeOfSetAsideDescription?: string
  typeOfSetAside?: string
  state?: string
  zipcode?: string
  typeOfNotice?: string
  noticeId?: string
  solicitationNumber?: string
  title?: string
  reviewBy?: string
  naicsCode?: string
  classificationCode?: string
  active?: string
  latest?: string
  orgPath?: string
  includeSections?: string
  emailId?: string
  mode?: string
  data?: string
}

// Error Response Types
export interface ISAMErrorResponse {
  title: string
  detail: string
  status: number
  type?: string
}

// Configuration Types
export interface ISAMApiConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
}

// Search and Filter Types
export interface IOpportunityFilters {
  searchQuery?: string
  naicsCode?: string
  typeOfSetAside?: string
  responseDeadlineFrom?: string
  responseDeadlineTo?: string
  state?: string
  organizationType?: string
  active?: boolean
  limit?: number
  offset?: number
}

export interface IOpportunitySearchResult {
  opportunities: ISAMOpportunity[]
  totalCount: number
  hasMore: boolean
  nextOffset?: number
}