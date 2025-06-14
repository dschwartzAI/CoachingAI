-- Fix tool_id constraint to allow 'ideal-client-extractor'
-- This version uses the correct ARRAY syntax that matches your existing constraint
-- Run this in your Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS valid_tool_id;

-- Add the new constraint with the correct ARRAY syntax including the new tool ID
ALTER TABLE public.threads ADD CONSTRAINT valid_tool_id CHECK (
    (tool_id IS NULL) OR 
    (tool_id = ANY (ARRAY['hybrid-offer'::text, 'workshop-generator'::text, 'ideal-client-extractor'::text]))
);

-- Verify the constraint was added correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id'; 