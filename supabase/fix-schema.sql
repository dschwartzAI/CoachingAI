-- Fix database schema issues
-- Run this in your Supabase SQL Editor

-- Add performance indexes for faster chat queries
CREATE INDEX IF NOT EXISTS threads_user_created_idx
ON public.threads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_thread_created_idx
ON public.messages (thread_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS messages_user_idx
ON public.messages (user_id);

-- Show current table structure for verification
SELECT 
    'user_profiles' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

SELECT 
    'threads' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'threads'
ORDER BY ordinal_position; 