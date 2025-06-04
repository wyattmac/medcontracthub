# MedContractHub Developer Scripts

This directory contains utility scripts to help with development and testing.

## Onboarding Scripts

### bypass-onboarding
Quick script to bypass onboarding for an existing user.

```bash
npm run bypass-onboarding <email>
```

Example:
```bash
npm run bypass-onboarding dev@example.com
```

This will:
- Find the user by email
- Create a default company with Pro plan (trialing)
- Mark onboarding as completed
- Set up initial usage tracking

### dev-setup
Enhanced developer setup with more options.

```bash
npm run dev-setup <email> [options]
```

Options:
- `--plan <starter|pro|enterprise>` - Set subscription plan (default: pro)
- `--trial` - Set up as trial user (default)
- `--active` - Set up as active subscriber
- `--admin` - Make user admin (default)
- `--user` - Make user regular user
- `--reset` - Reset existing user data before setup

Examples:
```bash
# Basic setup (Pro plan, trial, admin)
npm run dev-setup dev@example.com

# Enterprise plan with active subscription
npm run dev-setup enterprise@example.com --plan=enterprise --active

# Regular user with starter plan
npm run dev-setup user@example.com --plan=starter --user

# Reset and recreate user data
npm run dev-setup dev@example.com --reset
```

## Prerequisites

1. User must already exist (sign up through the app first)
2. `.env.local` file must contain:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Usage Notes

- These scripts use the service role key to bypass Row Level Security (RLS)
- They're intended for development only - never use in production
- The scripts create realistic test data including:
  - Company with SAM.gov registration details
  - NAICS codes for medical equipment
  - Usage tracking records
  - Sample saved opportunities

## Troubleshooting

If you get an error:
1. Make sure the user has signed up first
2. Check that all required environment variables are set
3. Verify the email format is correct
4. For database errors, check Supabase logs