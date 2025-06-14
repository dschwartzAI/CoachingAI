-- Check the complete current constraint definition
-- Run this first to see what tool IDs are currently allowed

SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.threads'::regclass 
AND conname = 'valid_tool_id'; 