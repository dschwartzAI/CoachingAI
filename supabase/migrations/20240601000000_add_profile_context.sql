-- Add new columns to store user profile context
alter table public.user_profiles add column full_name text;
alter table public.user_profiles add column occupation text;
alter table public.user_profiles add column desired_mrr text;
alter table public.user_profiles add column desired_hours text;
