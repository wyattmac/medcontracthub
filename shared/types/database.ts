/**
 * Database Types
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      opportunities: {
        Row: {
          id: string
          notice_id: string
          title: string
          agency: string
          department: string | null
          posted_date: string
          response_deadline: string
          naics_codes: string[]
          set_aside_types: string[]
          contract_type: string
          value_amount: Json | null
          place_of_performance: Json | null
          description: string
          attachments: Json[] | null
          active: boolean
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          notice_id: string
          title: string
          agency: string
          department?: string | null
          posted_date: string
          response_deadline: string
          naics_codes: string[]
          set_aside_types: string[]
          contract_type: string
          value_amount?: Json | null
          place_of_performance?: Json | null
          description: string
          attachments?: Json[] | null
          active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          notice_id?: string
          title?: string
          agency?: string
          department?: string | null
          posted_date?: string
          response_deadline?: string
          naics_codes?: string[]
          set_aside_types?: string[]
          contract_type?: string
          value_amount?: Json | null
          place_of_performance?: Json | null
          description?: string
          attachments?: Json[] | null
          active?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      saved_opportunities: {
        Row: {
          id: string
          opportunity_id: string
          user_id: string
          notes: string | null
          saved_at: string
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          user_id: string
          notes?: string | null
          saved_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          user_id?: string
          notes?: string | null
          saved_at?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_id: string | null
          role: string
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          company_id?: string | null
          role?: string
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          company_id?: string | null
          role?: string
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          duns_number: string | null
          cage_code: string | null
          naics_codes: string[]
          certifications: string[]
          employees_count: number | null
          annual_revenue: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          duns_number?: string | null
          cage_code?: string | null
          naics_codes: string[]
          certifications?: string[]
          employees_count?: number | null
          annual_revenue?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          duns_number?: string | null
          cage_code?: string | null
          naics_codes?: string[]
          certifications?: string[]
          employees_count?: number | null
          annual_revenue?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}