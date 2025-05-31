-- Create snippets table for storing highlighted text snippets
CREATE TABLE IF NOT EXISTS "public"."snippets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "note" TEXT,
  "tag" TEXT,
  "source_type" TEXT NOT NULL DEFAULT 'conversation',
  "source_id" TEXT,
  "source_context" TEXT,
  "message_id" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "snippets_user_id_idx" ON "public"."snippets" ("user_id");
CREATE INDEX IF NOT EXISTS "snippets_source_type_idx" ON "public"."snippets" ("source_type");
CREATE INDEX IF NOT EXISTS "snippets_tag_idx" ON "public"."snippets" ("tag");
CREATE INDEX IF NOT EXISTS "snippets_created_at_idx" ON "public"."snippets" ("created_at");

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER "handle_snippets_updated_at" 
  BEFORE UPDATE ON "public"."snippets" 
  FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Enable Row Level Security
ALTER TABLE "public"."snippets" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for snippets
-- Users can view their own snippets
CREATE POLICY "Users can view their own snippets" 
  ON "public"."snippets" 
  FOR SELECT 
  USING (auth.uid()::text = user_id);

-- Users can insert their own snippets
CREATE POLICY "Users can insert their own snippets" 
  ON "public"."snippets" 
  FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own snippets
CREATE POLICY "Users can update their own snippets" 
  ON "public"."snippets" 
  FOR UPDATE 
  USING (auth.uid()::text = user_id);

-- Users can delete their own snippets
CREATE POLICY "Users can delete their own snippets" 
  ON "public"."snippets" 
  FOR DELETE 
  USING (auth.uid()::text = user_id);

-- Add snippets to realtime publication if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE snippets;
  END IF;
END $$; 