-- Fix database constraint to allow 'workshop-generator' instead of 'highlevel-landing-page'

-- First, drop the existing constraint
ALTER TABLE threads DROP CONSTRAINT IF EXISTS valid_tool_id;

-- Add the new constraint with the correct tool IDs
ALTER TABLE threads ADD CONSTRAINT valid_tool_id 
CHECK (tool_id IN ('hybrid-offer', 'workshop-generator'));

-- Verify the constraint was created
SELECT conname, pg_get_constraintdef(oid) as definition 
FROM pg_constraint 
WHERE conrelid = 'threads'::regclass 
AND contype = 'c'; 