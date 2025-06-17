-- Fix tool_id constraint to include ALL tools including 'ideal-client-extractor'
-- Run this in your Supabase SQL Editor

-- First, check the current constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as current_constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id';

-- Drop the existing constraint
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS valid_tool_id;

-- Add the new constraint with ALL tool IDs including ideal-client-extractor
ALTER TABLE public.threads ADD CONSTRAINT valid_tool_id CHECK (
    (tool_id IS NULL) OR 
    (tool_id = ANY (ARRAY[
        'hybrid-offer'::text, 
        'workshop-generator'::text, 
        'highlevel-landing-page'::text, 
        'marketing-audit'::text, 
        'business-plan'::text,
        'ideal-client-extractor'::text
    ]))
);

-- Verify the constraint was updated correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as new_constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id';

-- Test that we can now insert threads with the new tool
-- This is just a test, it will be rolled back
BEGIN;
INSERT INTO public.threads (id, title, user_id, tool_id) 
VALUES ('test-id', 'Test Thread', 'test-user', 'ideal-client-extractor');
-- If this works, the constraint is fixed
ROLLBACK; 