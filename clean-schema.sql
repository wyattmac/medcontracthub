-- MedContractHub Database Schema
-- Copy this ENTIRE content into Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create custom types
create type certification_type as enum (
  'sdvosb', 'vosb', 'wosb', 'edwosb', 'sdb', 'hubzone'
);

create type opportunity_status as enum (
  'active', 'awarded', 'cancelled', 'expired'
);

create type user_role as enum (
  'admin', 'user'
);

create type subscription_plan as enum (
  'starter', 'pro', 'enterprise'
);

create type proposal_status as enum (
  'draft', 'submitted', 'under_review', 'awarded', 'rejected', 'withdrawn'
);

create type proposal_section_type as enum (
  'executive_summary', 'technical_approach', 'management_approach', 
  'past_performance', 'pricing', 'certifications', 'attachments', 'other'
);

-- Companies table
create table public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  duns_number text unique,
  cage_code text unique,
  ein text,
  description text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
  phone text,
  website text,
  certifications certification_type[] default '{}',
  naics_codes text[] default '{}',
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

-- Opportunities table
create table public.opportunities (
  id uuid default uuid_generate_v4() primary key,
  notice_id text unique not null,
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
  set_aside_type text,
  contract_type text,
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

-- Saved opportunities
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
  win_probability numeric(3, 2),
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

-- Additional support tables
create table public.opportunity_analyses (
  id uuid default uuid_generate_v4() primary key,
  opportunity_id uuid references public.opportunities(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  analysis_type text not null,
  analysis_data jsonb not null,
  score numeric(3, 2),
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default (timezone('utc'::text, now()) + interval '7 days') not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(opportunity_id, company_id, analysis_type)
);

create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for performance
create index idx_opportunities_status on public.opportunities(status);
create index idx_opportunities_response_deadline on public.opportunities(response_deadline);
create index idx_opportunities_naics on public.opportunities(naics_code);
create index idx_opportunities_agency on public.opportunities(agency);
create index idx_saved_opportunities_user on public.saved_opportunities(user_id);

-- Enable Row Level Security
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.opportunity_analyses enable row level security;
alter table public.proposals enable row level security;
alter table public.audit_logs enable row level security;

-- RLS Policies
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

create policy "Users can view their own company" 
  on public.companies for select 
  to authenticated 
  using (id in (select company_id from public.profiles where profiles.id = auth.uid()));

create policy "Authenticated users can view all opportunities" 
  on public.opportunities for select 
  to authenticated 
  using (true);

create policy "Users can view their own saved opportunities" 
  on public.saved_opportunities for select 
  to authenticated 
  using (user_id = auth.uid());

create policy "Users can manage their own saved opportunities" 
  on public.saved_opportunities for all 
  to authenticated 
  using (user_id = auth.uid()) 
  with check (user_id = auth.uid());

create policy "Users can view proposals for their company" 
  on public.proposals for select 
  to authenticated 
  using (company_id in (select company_id from public.profiles where profiles.id = auth.uid()));

-- Functions and Triggers
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created 
  after insert on auth.users 
  for each row execute function public.handle_new_user();

create or replace function public.handle_updated_at() 
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_companies_updated_at 
  before update on public.companies 
  for each row execute function public.handle_updated_at();

create trigger handle_profiles_updated_at 
  before update on public.profiles 
  for each row execute function public.handle_updated_at();

create trigger handle_opportunities_updated_at 
  before update on public.opportunities 
  for each row execute function public.handle_updated_at();

create trigger handle_saved_opportunities_updated_at 
  before update on public.saved_opportunities 
  for each row execute function public.handle_updated_at();

create trigger handle_proposals_updated_at 
  before update on public.proposals 
  for each row execute function public.handle_updated_at();

-- Grant permissions
grant execute on function public.handle_new_user to authenticated;
grant execute on function public.handle_updated_at to authenticated;

-- Insert sample data
insert into public.opportunities (
  notice_id, title, description, agency, posted_date, response_deadline,
  naics_code, naics_description, place_of_performance_state, status,
  solicitation_number, estimated_value_min, estimated_value_max
) values 
(
  'SAMPLE_001',
  'Medical Supplies for VA Hospital System', 
  'Procurement of medical supplies including surgical instruments and diagnostic equipment.',
  'Department of Veterans Affairs',
  now(),
  now() + interval '30 days',
  '339112',
  'Surgical and Medical Instrument Manufacturing',
  'CA',
  'active',
  'VA-2024-001',
  500000,
  2000000
),
(
  'SAMPLE_002',
  'Diagnostic Equipment Maintenance Services',
  'Comprehensive maintenance and repair services for diagnostic imaging equipment.',
  'Department of Defense', 
  now(),
  now() + interval '45 days',
  '811219',
  'Other Electronic and Precision Equipment Repair and Maintenance',
  'TX',
  'active',
  'DOD-2024-MED-002',
  1000000,
  5000000
);