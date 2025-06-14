-- Fix tool_id constraint to allow 'ideal-client-extractor'
-- Run this in your Supabase SQL Editor

-- First, check current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id';

-- Drop the existing constraint (if it exists)
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS valid_tool_id;

-- Add the new constraint with all tool IDs including the new one
ALTER TABLE public.threads ADD CONSTRAINT valid_tool_id CHECK (
    tool_id IS NULL OR 
    tool_id IN ('hybrid-offer', 'workshop-generator', 'ideal-client-extractor')
);

-- Verify the constraint was added correctly
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id'; 