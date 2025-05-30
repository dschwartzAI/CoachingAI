-- Add allow_memory column to user_profiles
alter table public.user_profiles add column allow_memory boolean default true not null;
