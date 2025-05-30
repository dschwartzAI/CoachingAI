-- Enable vector extension and add memory tables
CREATE EXTENSION IF NOT EXISTS vector;

-- Enum type for memory categories
CREATE TYPE memory_type AS ENUM ('episodic','fact','preference','artefact');

-- Table storing individual user memories
CREATE TABLE user_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id uuid REFERENCES threads(id) ON DELETE CASCADE,
    content text NOT NULL,
    type memory_type NOT NULL,
    embedding vector(1536),
    created_at timestamp with time zone DEFAULT now()
);

-- Table storing summary per user
CREATE TABLE memory_summaries (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    summary text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for user_memories
CREATE POLICY "Users can view their own memories"
    ON user_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
    ON user_memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
    ON user_memories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
    ON user_memories FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for memory_summaries
CREATE POLICY "Users can view their memory summaries"
    ON memory_summaries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their memory summaries"
    ON memory_summaries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their memory summaries"
    ON memory_summaries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their memory summaries"
    ON memory_summaries FOR DELETE
    USING (auth.uid() = user_id);

-- Optional dev policies
CREATE POLICY "Allow dev users to select user_memories"
  ON user_memories
  FOR SELECT
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to insert user_memories"
  ON user_memories
  FOR INSERT
  WITH CHECK (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to update user_memories"
  ON user_memories
  FOR UPDATE
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to delete user_memories"
  ON user_memories
  FOR DELETE
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to select memory_summaries"
  ON memory_summaries
  FOR SELECT
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to insert memory_summaries"
  ON memory_summaries
  FOR INSERT
  WITH CHECK (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to update memory_summaries"
  ON memory_summaries
  FOR UPDATE
  USING (user_id LIKE 'dev-user-%');

CREATE POLICY "Allow dev users to delete memory_summaries"
  ON memory_summaries
  FOR DELETE
  USING (user_id LIKE 'dev-user-%');
