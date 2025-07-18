-- Fix tool_id constraint to allow 'ideal-client-extractor'
-- This version handles all existing tool IDs and adds the new one
-- Run this in your Supabase SQL Editor

-- First, check current constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id';

-- Drop the existing constraint (if it exists)
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS valid_tool_id;

-- Add the new constraint with ALL known tool IDs including the new one
-- This includes all tool IDs that might exist in your system
ALTER TABLE public.threads ADD CONSTRAINT valid_tool_id CHECK (
    tool_id IS NULL OR 
    tool_id IN (
        'hybrid-offer', 
        'workshop-generator', 
        'ideal-client-extractor',
        'highlevel-landing-page',
        'marketing-audit',
        'business-plan'
    )
);

-- Verify the constraint was added correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id'; 