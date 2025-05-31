-- Remove problematic dev user policies that expect text patterns on UUID columns

-- Drop dev policies for user_memories
DROP POLICY IF EXISTS "Allow dev users to select user_memories" ON user_memories;
DROP POLICY IF EXISTS "Allow dev users to insert user_memories" ON user_memories;
DROP POLICY IF EXISTS "Allow dev users to update user_memories" ON user_memories;
DROP POLICY IF EXISTS "Allow dev users to delete user_memories" ON user_memories;

-- Drop dev policies for memory_summaries  
DROP POLICY IF EXISTS "Allow dev users to select memory_summaries" ON memory_summaries;
DROP POLICY IF EXISTS "Allow dev users to insert memory_summaries" ON memory_summaries;
DROP POLICY IF EXISTS "Allow dev users to update memory_summaries" ON memory_summaries;
DROP POLICY IF EXISTS "Allow dev users to delete memory_summaries" ON memory_summaries; 