export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          duns_number: string | null
          cage_code: string | null
          ein: string | null
          description: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          phone: string | null
          website: string | null
          certifications: string[]
          naics_codes: string[]
          sam_registration_date: string | null
          sam_expiration_date: string | null
          subscription_plan: 'starter' | 'pro' | 'enterprise'
          subscription_status: string
          stripe_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          duns_number?: string | null
          cage_code?: string | null
          ein?: string | null
          description?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          phone?: string | null
          website?: string | null
          certifications?: string[]
          naics_codes?: string[]
          sam_registration_date?: string | null
          sam_expiration_date?: string | null
          subscription_plan?: 'starter' | 'pro' | 'enterprise'
          subscription_status?: string
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          duns_number?: string | null
          cage_code?: string | null
          ein?: string | null
          description?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          phone?: string | null
          website?: string | null
          certifications?: string[]
          naics_codes?: string[]
          sam_registration_date?: string | null
          sam_expiration_date?: string | null
          subscription_plan?: 'starter' | 'pro' | 'enterprise'
          subscription_status?: string
          stripe_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          company_id: string | null
          email: string
          full_name: string | null
          phone: string | null
          title: string | null
          role: 'admin' | 'user'
          avatar_url: string | null
          is_active: boolean
          onboarding_completed: boolean
          email_notifications: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          email: string
          full_name?: string | null
          phone?: string | null
          title?: string | null
          role?: 'admin' | 'user'
          avatar_url?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          email_notifications?: boolean
        }
        Update: {
          id?: string
          company_id?: string | null
          email?: string
          full_name?: string | null
          phone?: string | null
          title?: string | null
          role?: 'admin' | 'user'
          avatar_url?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          email_notifications?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      opportunities: {
        Row: {
          id: string
          notice_id: string
          title: string
          description: string | null
          agency: string
          sub_agency: string | null
          office: string | null
          posted_date: string
          response_deadline: string
          archive_date: string | null
          naics_code: string | null
          naics_description: string | null
          place_of_performance_state: string | null
          place_of_performance_city: string | null
          set_aside_type: string | null
          contract_type: string | null
          estimated_value_min: number | null
          estimated_value_max: number | null
          award_date: string | null
          award_amount: number | null
          awardee_name: string | null
          awardee_duns: string | null
          status: 'active' | 'awarded' | 'cancelled' | 'expired'
          solicitation_number: string | null
          primary_contact_name: string | null
          primary_contact_email: string | null
          primary_contact_phone: string | null
          attachments: any[]
          additional_info: any
          sam_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          notice_id: string
          title: string
          description?: string | null
          agency: string
          sub_agency?: string | null
          office?: string | null
          posted_date: string
          response_deadline: string
          archive_date?: string | null
          naics_code?: string | null
          naics_description?: string | null
          place_of_performance_state?: string | null
          place_of_performance_city?: string | null
          set_aside_type?: string | null
          contract_type?: string | null
          estimated_value_min?: number | null
          estimated_value_max?: number | null
          award_date?: string | null
          award_amount?: number | null
          awardee_name?: string | null
          awardee_duns?: string | null
          status?: 'active' | 'awarded' | 'cancelled' | 'expired'
          solicitation_number?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          attachments?: any[]
          additional_info?: any
          sam_url?: string | null
        }
        Update: {
          id?: string
          notice_id?: string
          title?: string
          description?: string | null
          agency?: string
          sub_agency?: string | null
          office?: string | null
          posted_date?: string
          response_deadline?: string
          archive_date?: string | null
          naics_code?: string | null
          naics_description?: string | null
          place_of_performance_state?: string | null
          place_of_performance_city?: string | null
          set_aside_type?: string | null
          contract_type?: string | null
          estimated_value_min?: number | null
          estimated_value_max?: number | null
          award_date?: string | null
          award_amount?: number | null
          awardee_name?: string | null
          awardee_duns?: string | null
          status?: 'active' | 'awarded' | 'cancelled' | 'expired'
          solicitation_number?: string | null
          primary_contact_name?: string | null
          primary_contact_email?: string | null
          primary_contact_phone?: string | null
          attachments?: any[]
          additional_info?: any
          sam_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      saved_opportunities: {
        Row: {
          id: string
          user_id: string
          opportunity_id: string
          notes: string | null
          tags: string[]
          is_pursuing: boolean
          reminder_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          opportunity_id: string
          notes?: string | null
          tags?: string[]
          is_pursuing?: boolean
          reminder_date?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          opportunity_id?: string
          notes?: string | null
          tags?: string[]
          is_pursuing?: boolean
          reminder_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      proposals: {
        Row: {
          id: string
          opportunity_id: string
          company_id: string
          created_by: string
          title: string
          status: 'draft' | 'submitted' | 'under_review' | 'awarded' | 'rejected' | 'withdrawn'
          solicitation_number: string | null
          submission_deadline: string | null
          submitted_at: string | null
          submitted_by: string | null
          total_proposed_price: number | null
          proposal_summary: string | null
          win_probability: number | null
          ai_generated: boolean
          ai_generation_prompt: string | null
          ai_generation_model: string | null
          version_number: number
          parent_proposal_id: string | null
          notes: string | null
          tags: string[]
          metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          company_id: string
          created_by: string
          title: string
          status?: 'draft' | 'submitted' | 'under_review' | 'awarded' | 'rejected' | 'withdrawn'
          solicitation_number?: string | null
          submission_deadline?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_proposed_price?: number | null
          proposal_summary?: string | null
          win_probability?: number | null
          ai_generated?: boolean
          ai_generation_prompt?: string | null
          ai_generation_model?: string | null
          version_number?: number
          parent_proposal_id?: string | null
          notes?: string | null
          tags?: string[]
          metadata?: any
        }
        Update: {
          id?: string
          opportunity_id?: string
          company_id?: string
          created_by?: string
          title?: string
          status?: 'draft' | 'submitted' | 'under_review' | 'awarded' | 'rejected' | 'withdrawn'
          solicitation_number?: string | null
          submission_deadline?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_proposed_price?: number | null
          proposal_summary?: string | null
          win_probability?: number | null
          ai_generated?: boolean
          ai_generation_prompt?: string | null
          ai_generation_model?: string | null
          version_number?: number
          parent_proposal_id?: string | null
          notes?: string | null
          tags?: string[]
          metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
      proposal_sections: {
        Row: {
          id: string
          proposal_id: string
          section_type: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance' | 'pricing' | 'certifications' | 'attachments' | 'other'
          title: string
          content: string | null
          word_count: number | null
          sort_order: number
          is_required: boolean
          max_pages: number | null
          ai_generated: boolean
          ai_generation_prompt: string | null
          last_edited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          section_type: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance' | 'pricing' | 'certifications' | 'attachments' | 'other'
          title: string
          content?: string | null
          word_count?: number | null
          sort_order?: number
          is_required?: boolean
          max_pages?: number | null
          ai_generated?: boolean
          ai_generation_prompt?: string | null
          last_edited_by?: string | null
        }
        Update: {
          id?: string
          proposal_id?: string
          section_type?: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance' | 'pricing' | 'certifications' | 'attachments' | 'other'
          title?: string
          content?: string | null
          word_count?: number | null
          sort_order?: number
          is_required?: boolean
          max_pages?: number | null
          ai_generated?: boolean
          ai_generation_prompt?: string | null
          last_edited_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      opportunity_analyses: {
        Row: {
          id: string
          opportunity_id: string
          company_id: string
          analysis_type: string
          analysis_data: any
          score: number | null
          generated_at: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          company_id: string
          analysis_type: string
          analysis_data: any
          score?: number | null
          generated_at?: string
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          company_id?: string
          analysis_type?: string
          analysis_data?: any
          score?: number | null
          generated_at?: string
          expires_at?: string
          created_at?: string
        }
      }
      compliance_matrices: {
        Row: {
          id: string
          opportunity_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          title: string
          rfp_document_url: string | null
          status: 'draft' | 'in_progress' | 'completed' | 'archived'
          metadata: any
        }
        Insert: {
          id?: string
          opportunity_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          title: string
          rfp_document_url?: string | null
          status?: 'draft' | 'in_progress' | 'completed' | 'archived'
          metadata?: any
        }
        Update: {
          id?: string
          opportunity_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          title?: string
          rfp_document_url?: string | null
          status?: 'draft' | 'in_progress' | 'completed' | 'archived'
          metadata?: any
        }
      }
      compliance_requirements: {
        Row: {
          id: string
          matrix_id: string
          section: 'L' | 'M' | 'C' | 'Other'
          requirement_number: string
          requirement_text: string
          requirement_type: 'submission' | 'evaluation' | 'technical' | 'administrative' | 'past_performance' | 'pricing' | null
          page_reference: string | null
          is_mandatory: boolean
          parent_requirement_id: string | null
          sort_order: number
          extracted_metadata: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          matrix_id: string
          section: 'L' | 'M' | 'C' | 'Other'
          requirement_number: string
          requirement_text: string
          requirement_type?: 'submission' | 'evaluation' | 'technical' | 'administrative' | 'past_performance' | 'pricing' | null
          page_reference?: string | null
          is_mandatory?: boolean
          parent_requirement_id?: string | null
          sort_order?: number
          extracted_metadata?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          matrix_id?: string
          section?: 'L' | 'M' | 'C' | 'Other'
          requirement_number?: string
          requirement_text?: string
          requirement_type?: 'submission' | 'evaluation' | 'technical' | 'administrative' | 'past_performance' | 'pricing' | null
          page_reference?: string | null
          is_mandatory?: boolean
          parent_requirement_id?: string | null
          sort_order?: number
          extracted_metadata?: any
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          company_id: string | null
          email: string
          full_name: string | null
          phone: string | null
          title: string | null
          role: 'admin' | 'user'
          avatar_url: string | null
          is_active: boolean
          onboarding_completed: boolean
          email_notifications: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          email: string
          full_name?: string | null
          phone?: string | null
          title?: string | null
          role?: 'admin' | 'user'
          avatar_url?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          email_notifications?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          email?: string
          full_name?: string | null
          phone?: string | null
          title?: string | null
          role?: 'admin' | 'user'
          avatar_url?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          email_notifications?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      compliance_responses: {
        Row: {
          id: string
          requirement_id: string
          proposal_section: string | null
          response_status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable' | 'deferred'
          response_location: string | null
          assigned_to: string | null
          notes: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requirement_id: string
          proposal_section?: string | null
          response_status?: 'not_started' | 'in_progress' | 'completed' | 'not_applicable' | 'deferred'
          response_location?: string | null
          assigned_to?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requirement_id?: string
          proposal_section?: string | null
          response_status?: 'not_started' | 'in_progress' | 'completed' | 'not_applicable' | 'deferred'
          response_location?: string | null
          assigned_to?: string | null
          notes?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}