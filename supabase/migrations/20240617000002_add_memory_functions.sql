-- Add PostgreSQL functions for memory system

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS match_user_memories(vector, int, uuid);
DROP FUNCTION IF EXISTS upsert_memory_summary(uuid, text);

-- Function for vector similarity search of user memories
CREATE OR REPLACE FUNCTION match_user_memories(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  type memory_type,
  thread_id text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_memories.id,
    user_memories.content,
    user_memories.type,
    user_memories.thread_id,
    user_memories.created_at,
    1 - (user_memories.embedding <=> query_embedding) AS similarity
  FROM user_memories
  WHERE (user_id IS NULL OR user_memories.user_id = user_id)
  ORDER BY user_memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for upserting memory summaries
CREATE OR REPLACE FUNCTION upsert_memory_summary(
  p_user_id uuid,
  p_summary text
)
RETURNS memory_summaries
LANGUAGE plpgsql
AS $$
DECLARE
  result memory_summaries;
BEGIN
  INSERT INTO memory_summaries (user_id, summary)
  VALUES (p_user_id, p_summary)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    summary = EXCLUDED.summary,
    updated_at = now()
  RETURNING * INTO result;
  
  RETURN result;
END;
$$; 