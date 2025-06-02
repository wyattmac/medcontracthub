-- MedContractHub Database Schema
-- This file contains all table definitions, RLS policies, and triggers
-- for the medical supply federal contracting platform

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create custom types
create type certification_type as enum (
  'sdvosb', -- Service-Disabled Veteran-Owned Small Business
  'vosb',   -- Veteran-Owned Small Business
  'wosb',   -- Woman-Owned Small Business
  'edwosb', -- Economically Disadvantaged Woman-Owned Small Business
  'sdb',    -- Small Disadvantaged Business
  'hubzone' -- HUBZone
);

create type opportunity_status as enum (
  'active',
  'awarded',
  'cancelled',
  'expired'
);

create type user_role as enum (
  'admin',
  'user'
);

create type subscription_plan as enum (
  'starter',     -- $97/month
  'pro',         -- $297/month
  'enterprise'   -- $997/month
);

create type proposal_status as enum (
  'draft',       -- In progress, not yet submitted
  'submitted',   -- Submitted to government
  'under_review',-- Being reviewed by agency
  'awarded',     -- Proposal was successful
  'rejected',    -- Proposal was unsuccessful
  'withdrawn'    -- Proposal was withdrawn
);

create type proposal_section_type as enum (
  'executive_summary',
  'technical_approach',
  'management_approach',
  'past_performance',
  'pricing',
  'certifications',
  'attachments',
  'other'
);

-- Extend auth.users with profile data
-- Note: We don't create auth.users as it's managed by Supabase Auth
-- Instead, we'll create a profiles table that references it

-- Companies table
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  duns_number text unique, -- DUNS number for SAM.gov registration
  cage_code text unique,   -- Commercial and Government Entity code
  ein text,                -- Employer Identification Number
  description text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  phone text,
  website text,
  certifications certification_type[] default '{}',
  naics_codes text[] default '{}', -- North American Industry Classification System codes
  sam_registration_date timestamp with time zone,
  sam_expiration_date timestamp with time zone,
  subscription_plan subscription_plan default 'starter',
  subscription_status text default 'active',
  stripe_customer_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  company_id uuid references public.companies(id) on delete set null,
  email text unique not null,
  full_name text,
  phone text,
  title text,
  role user_role default 'user',
  avatar_url text,
  is_active boolean default true,
  onboarding_completed boolean default false,
  email_notifications boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Opportunities table (SAM.gov data)
create table public.opportunities (
  id uuid default uuid_generate_v4() primary key,
  notice_id text unique not null, -- SAM.gov notice ID
  title text not null,
  description text,
  agency text not null,
  sub_agency text,
  office text,
  posted_date timestamp with time zone not null,
  response_deadline timestamp with time zone not null,
  archive_date timestamp with time zone,
  naics_code text,
  naics_description text,
  place_of_performance_state text,
  place_of_performance_city text,
  set_aside_type text, -- Type of set-aside (SDVOSB, WOSB, etc.)
  contract_type text,  -- Fixed-price, cost-reimbursement, etc.
  estimated_value_min numeric(15, 2),
  estimated_value_max numeric(15, 2),
  award_date timestamp with time zone,
  award_amount numeric(15, 2),
  awardee_name text,
  awardee_duns text,
  status opportunity_status default 'active',
  solicitation_number text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  attachments jsonb default '[]'::jsonb,
  additional_info jsonb default '{}'::jsonb,
  sam_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Saved opportunities (user's bookmarked opportunities)
create table public.saved_opportunities (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  opportunity_id uuid references public.opportunities(id) on delete cascade not null,
  notes text,
  tags text[] default '{}',
  is_pursuing boolean default false,
  reminder_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, opportunity_id)
);

-- AI analysis cache for opportunities
create table public.opportunity_analyses (
  id uuid default uuid_generate_v4() primary key,
  opportunity_id uuid references public.opportunities(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  analysis_type text not null, -- 'match_score', 'requirements', 'competition', 'strategy'
  analysis_data jsonb not null,
  score numeric(3, 2), -- 0.00 to 1.00 for match scores
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days') not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(opportunity_id, company_id, analysis_type)
);

-- Email subscription preferences
create table public.email_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subscription_type text not null, -- 'daily_digest', 'opportunity_alert', 'deadline_reminder'
  is_active boolean default true,
  frequency text default 'daily', -- 'immediate', 'daily', 'weekly'
  filters jsonb default '{}'::jsonb, -- Store user's filter preferences
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, subscription_type)
);

-- Audit logs for compliance and tracking
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null, -- 'login', 'logout', 'view_opportunity', 'save_opportunity', etc.
  entity_type text, -- 'opportunity', 'profile', 'company', etc.
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposals table
create table public.proposals (
  id uuid default uuid_generate_v4() primary key,
  opportunity_id uuid references public.opportunities(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null not null,
  title text not null,
  status proposal_status default 'draft',
  solicitation_number text,
  submission_deadline timestamp with time zone,
  submitted_at timestamp with time zone,
  submitted_by uuid references auth.users(id) on delete set null,
  total_proposed_price numeric(15, 2),
  proposal_summary text,
  win_probability numeric(3, 2), -- 0.00 to 1.00
  ai_generated boolean default false,
  ai_generation_prompt text,
  ai_generation_model text,
  version_number integer default 1,
  parent_proposal_id uuid references public.proposals(id) on delete set null,
  notes text,
  tags text[] default '{}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposal sections table
create table public.proposal_sections (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  section_type proposal_section_type not null,
  title text not null,
  content text,
  word_count integer,
  sort_order integer default 0,
  is_required boolean default false,
  max_pages integer,
  ai_generated boolean default false,
  ai_generation_prompt text,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposal attachments table
create table public.proposal_attachments (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  section_id uuid references public.proposal_sections(id) on delete set null,
  file_name text not null,
  file_path text not null, -- Supabase storage path
  file_size bigint,
  file_type text,
  description text,
  is_required boolean default false,
  uploaded_by uuid references auth.users(id) on delete set null not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposal submissions table (tracks submission attempts)
create table public.proposal_submissions (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  submission_method text not null, -- 'sam_gov', 'email', 'portal', 'manual'
  submission_reference text, -- External reference number
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  submitted_by uuid references auth.users(id) on delete set null not null,
  submission_status text default 'pending', -- 'pending', 'confirmed', 'failed'
  confirmation_number text,
  response_data jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposal collaborators table
create table public.proposal_collaborators (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'editor', -- 'owner', 'editor', 'reviewer', 'viewer'
  permissions jsonb default '{"can_edit": true, "can_submit": false, "can_delete": false}'::jsonb,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamp with time zone default timezone('utc'::text, now()) not null,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(proposal_id, user_id)
);

-- Proposal templates table
create table public.proposal_templates (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null not null,
  name text not null,
  description text,
  category text, -- 'general', 'medical_supplies', 'services', etc.
  template_data jsonb not null, -- Structured template content
  is_public boolean default false,
  usage_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proposal reviews table (for internal review process)
create table public.proposal_reviews (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  reviewer_id uuid references auth.users(id) on delete set null not null,
  review_type text not null default 'general', -- 'general', 'technical', 'pricing', 'compliance'
  status text not null default 'pending', -- 'pending', 'approved', 'rejected', 'needs_changes'
  comments text,
  score integer, -- 1-10 rating
  recommendations text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index idx_opportunities_status on public.opportunities(status);
create index idx_opportunities_response_deadline on public.opportunities(response_deadline);
create index idx_opportunities_naics on public.opportunities(naics_code);
create index idx_opportunities_agency on public.opportunities(agency);
create index idx_saved_opportunities_user on public.saved_opportunities(user_id);
create index idx_opportunity_analyses_opportunity on public.opportunity_analyses(opportunity_id);
create index idx_opportunity_analyses_company on public.opportunity_analyses(company_id);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_created on public.audit_logs(created_at);

-- Proposal indexes
create index idx_proposals_company on public.proposals(company_id);
create index idx_proposals_opportunity on public.proposals(opportunity_id);
create index idx_proposals_status on public.proposals(status);
create index idx_proposals_submission_deadline on public.proposals(submission_deadline);
create index idx_proposal_sections_proposal on public.proposal_sections(proposal_id);
create index idx_proposal_sections_type on public.proposal_sections(section_type);
create index idx_proposal_attachments_proposal on public.proposal_attachments(proposal_id);
create index idx_proposal_submissions_proposal on public.proposal_submissions(proposal_id);
create index idx_proposal_collaborators_proposal on public.proposal_collaborators(proposal_id);
create index idx_proposal_collaborators_user on public.proposal_collaborators(user_id);
create index idx_proposal_templates_company on public.proposal_templates(company_id);
create index idx_proposal_reviews_proposal on public.proposal_reviews(proposal_id);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger handle_companies_updated_at before update on public.companies
  for each row execute function public.handle_updated_at();

create trigger handle_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger handle_opportunities_updated_at before update on public.opportunities
  for each row execute function public.handle_updated_at();

create trigger handle_saved_opportunities_updated_at before update on public.saved_opportunities
  for each row execute function public.handle_updated_at();

create trigger handle_email_subscriptions_updated_at before update on public.email_subscriptions
  for each row execute function public.handle_updated_at();

create trigger handle_proposals_updated_at before update on public.proposals
  for each row execute function public.handle_updated_at();

create trigger handle_proposal_sections_updated_at before update on public.proposal_sections
  for each row execute function public.handle_updated_at();

create trigger handle_proposal_attachments_updated_at before update on public.proposal_attachments
  for each row execute function public.handle_updated_at();

create trigger handle_proposal_templates_updated_at before update on public.proposal_templates
  for each row execute function public.handle_updated_at();

create trigger handle_proposal_reviews_updated_at before update on public.proposal_reviews
  for each row execute function public.handle_updated_at();

-- Enable Row Level Security on all tables
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.opportunity_analyses enable row level security;
alter table public.email_subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- Enable RLS on proposal tables
alter table public.proposals enable row level security;
alter table public.proposal_sections enable row level security;
alter table public.proposal_attachments enable row level security;
alter table public.proposal_submissions enable row level security;
alter table public.proposal_collaborators enable row level security;
alter table public.proposal_templates enable row level security;
alter table public.proposal_reviews enable row level security;

-- RLS Policies

-- Companies policies
create policy "Users can view their own company"
  on public.companies for select
  to authenticated
  using (
    id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy "Admin users can manage companies"
  on public.companies for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can view profiles in their company"
  on public.profiles for select
  to authenticated
  using (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

-- Opportunities policies (public read for authenticated users)
create policy "Authenticated users can view all opportunities"
  on public.opportunities for select
  to authenticated
  using (true);

create policy "Admin users can manage opportunities"
  on public.opportunities for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Saved opportunities policies
create policy "Users can view their own saved opportunities"
  on public.saved_opportunities for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can manage their own saved opportunities"
  on public.saved_opportunities for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Opportunity analyses policies
create policy "Users can view analyses for their company"
  on public.opportunity_analyses for select
  to authenticated
  using (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy "System can manage opportunity analyses"
  on public.opportunity_analyses for all
  to service_role
  using (true)
  with check (true);

-- Email subscriptions policies
create policy "Users can view their own subscriptions"
  on public.email_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can manage their own subscriptions"
  on public.email_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Audit logs policies
create policy "Users can view their own audit logs"
  on public.audit_logs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admin users can view all audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "System can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to log audit events
create or replace function public.log_audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_changes jsonb default null
)
returns void as $$
begin
  insert into public.audit_logs (
    user_id,
    company_id,
    action,
    entity_type,
    entity_id,
    changes
  )
  select
    auth.uid(),
    profiles.company_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_changes
  from public.profiles
  where profiles.id = auth.uid();
end;
$$ language plpgsql security definer;

-- Grant execute permission on audit log function
grant execute on function public.log_audit to authenticated;

-- Proposal RLS Policies

-- Proposals policies
create policy "Users can view proposals for their company"
  on public.proposals for select
  to authenticated
  using (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

create policy "Users can create proposals for their company"
  on public.proposals for insert
  to authenticated
  with check (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    ) and created_by = auth.uid()
  );

create policy "Users can update proposals they have access to"
  on public.proposals for update
  to authenticated
  using (
    id in (
      select proposal_id from public.proposal_collaborators
      where user_id = auth.uid()
      and (permissions->>'can_edit')::boolean = true
    )
    or created_by = auth.uid()
  );

create policy "Users can delete proposals they own"
  on public.proposals for delete
  to authenticated
  using (
    created_by = auth.uid()
    or id in (
      select proposal_id from public.proposal_collaborators
      where user_id = auth.uid()
      and (permissions->>'can_delete')::boolean = true
    )
  );

-- Proposal sections policies
create policy "Users can view proposal sections they have access to"
  on public.proposal_sections for select
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Users can manage proposal sections they can edit"
  on public.proposal_sections for all
  to authenticated
  using (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where (p.created_by = auth.uid())
      or (pc.user_id = auth.uid() and (pc.permissions->>'can_edit')::boolean = true)
    )
  )
  with check (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where (p.created_by = auth.uid())
      or (pc.user_id = auth.uid() and (pc.permissions->>'can_edit')::boolean = true)
    )
  );

-- Proposal attachments policies
create policy "Users can view proposal attachments they have access to"
  on public.proposal_attachments for select
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Users can manage proposal attachments they can edit"
  on public.proposal_attachments for all
  to authenticated
  using (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where (p.created_by = auth.uid())
      or (pc.user_id = auth.uid() and (pc.permissions->>'can_edit')::boolean = true)
    )
  )
  with check (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where (p.created_by = auth.uid())
      or (pc.user_id = auth.uid() and (pc.permissions->>'can_edit')::boolean = true)
    ) and uploaded_by = auth.uid()
  );

-- Proposal submissions policies
create policy "Users can view proposal submissions for their company"
  on public.proposal_submissions for select
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Users can create proposal submissions"
  on public.proposal_submissions for insert
  to authenticated
  with check (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where (p.created_by = auth.uid())
      or (pc.user_id = auth.uid() and (pc.permissions->>'can_submit')::boolean = true)
    ) and submitted_by = auth.uid()
  );

-- Proposal collaborators policies
create policy "Users can view collaborators for proposals they have access to"
  on public.proposal_collaborators for select
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Proposal owners can manage collaborators"
  on public.proposal_collaborators for all
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where created_by = auth.uid()
    )
  )
  with check (
    proposal_id in (
      select id from public.proposals
      where created_by = auth.uid()
    )
  );

-- Proposal templates policies
create policy "Users can view templates for their company"
  on public.proposal_templates for select
  to authenticated
  using (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
    or is_public = true
  );

create policy "Users can create templates for their company"
  on public.proposal_templates for insert
  to authenticated
  with check (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    ) and created_by = auth.uid()
  );

create policy "Users can update their own templates"
  on public.proposal_templates for update
  to authenticated
  using (created_by = auth.uid());

create policy "Users can delete their own templates"
  on public.proposal_templates for delete
  to authenticated
  using (created_by = auth.uid());

-- Proposal reviews policies
create policy "Users can view reviews for proposals they have access to"
  on public.proposal_reviews for select
  to authenticated
  using (
    proposal_id in (
      select id from public.proposals
      where company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    )
  );

create policy "Users can create reviews for proposals they can review"
  on public.proposal_reviews for insert
  to authenticated
  with check (
    proposal_id in (
      select p.id from public.proposals p
      left join public.proposal_collaborators pc on p.id = pc.proposal_id
      where p.company_id in (
        select company_id from public.profiles
        where profiles.id = auth.uid()
      )
    ) and reviewer_id = auth.uid()
  );

create policy "Users can update their own reviews"
  on public.proposal_reviews for update
  to authenticated
  using (reviewer_id = auth.uid());

create policy "Users can delete their own reviews"
  on public.proposal_reviews for delete
  to authenticated
  using (reviewer_id = auth.uid());