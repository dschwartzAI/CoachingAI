-- Create simplified coaching memories table for session summaries
-- This replaces the complex per-message classification system

CREATE TABLE coaching_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id text REFERENCES threads(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('goals', 'challenges', 'wins', 'preferences', 'context')),
    content text NOT NULL,
    session_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE coaching_memories ENABLE ROW LEVEL SECURITY;

-- Policies for coaching_memories
CREATE POLICY "Users can view their own coaching memories"
    ON coaching_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coaching memories"
    ON coaching_memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coaching memories"
    ON coaching_memories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coaching memories"
    ON coaching_memories FOR DELETE
    USING (auth.uid() = user_id);

-- Index for efficient querying
CREATE INDEX idx_coaching_memories_user_category ON coaching_memories(user_id, category);
CREATE INDEX idx_coaching_memories_session_date ON coaching_memories(session_date DESC); 