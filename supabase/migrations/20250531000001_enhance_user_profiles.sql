-- Enhance user_profiles table with coaching-relevant fields
-- This provides James with much better context for personalized coaching

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS current_mrr text,
ADD COLUMN IF NOT EXISTS business_stage text,
ADD COLUMN IF NOT EXISTS biggest_challenge text,
ADD COLUMN IF NOT EXISTS primary_goal text; 