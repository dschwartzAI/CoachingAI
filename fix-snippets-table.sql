-- Fix snippets table schema
-- This script will create the snippets table with the correct structure

-- Drop the table if it exists (be careful with this in production!)
DROP TABLE IF EXISTS public.snippets;

-- Create the snippets table with the correct schema
CREATE TABLE public.snippets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    content TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints (optional, but recommended)
-- Note: Make sure the referenced tables exist first
-- ALTER TABLE public.snippets 
-- ADD CONSTRAINT fk_snippets_thread_id 
-- FOREIGN KEY (thread_id) REFERENCES public.threads(id) ON DELETE CASCADE;

-- ALTER TABLE public.snippets 
-- ADD CONSTRAINT fk_snippets_message_id 
-- FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

-- Add RLS (Row Level Security) policy for user access
ALTER TABLE public.snippets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own snippets
CREATE POLICY "Users can only access their own snippets" ON public.snippets
    FOR ALL USING (auth.uid()::text = user_id);

-- Grant necessary permissions
GRANT ALL ON public.snippets TO authenticated;
GRANT ALL ON public.snippets TO service_role; 