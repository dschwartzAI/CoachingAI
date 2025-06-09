CREATE TABLE snippets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id text REFERENCES threads(id) ON DELETE CASCADE,
    message_id text REFERENCES messages(id) ON DELETE CASCADE,
    content text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their snippets" ON snippets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their snippets" ON snippets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their snippets" ON snippets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their snippets" ON snippets
    FOR DELETE USING (auth.uid() = user_id);
